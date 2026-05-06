from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.response import Response
from django.shortcuts import get_object_or_404

from .models import Monument, Route, Travel, Visita
from .serializers import (
    MonumentSerializer, 
    TravelSerializer, 
    MapDataSerializer, 
    TravelCreateSerializer
)
from .utils import calcular_distancia

class MonumentViewSet(viewsets.ModelViewSet):
    queryset = Monument.objects.all()
    serializer_class = MonumentSerializer

class TravelViewSet(viewsets.ModelViewSet):
    queryset = Travel.objects.all()
    serializer_class = TravelSerializer 

from rest_framework.authentication import TokenAuthentication
from rest_framework.permissions import IsAuthenticated

from django.utils import timezone

class MapStatsView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            # Solo viajes cuya fecha de fin ya pasó
            viajes_pasados = Travel.objects.filter(
                user=request.user,
                end_date__lt=timezone.now().date()  # ← solo pasados
            )
            
            paises_visitados = list(viajes_pasados.values_list('country_code', flat=True).distinct())
            
            # Todos los viajes (para los marcadores)
            todos_viajes = Travel.objects.filter(user=request.user)
            serializer = TravelSerializer(todos_viajes, many=True)
            
            return Response({
                "paises": paises_visitados,  # solo países de viajes pasados
                "markers": serializer.data    # todos los viajes (pins)
            })
        except Exception as e:
            print(f"Error: {e}")
            return Response({"error": str(e)}, status=500)
        

class ViajeCreateView(APIView):
    authentication_classes = [TokenAuthentication]   # ← añadir
    permission_classes = [IsAuthenticated]            # ← añadir

    def post(self, request):
        serializer = TravelCreateSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(user=request.user)
            return Response({"mensaje": "Viaje creado exitosamente"}, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ValidarVisitaView(APIView):
    authentication_classes = [TokenAuthentication]   # ← añadir
    permission_classes = [IsAuthenticated]            # ← añadir

    def post(self, request, viaje_id):
        viaje = get_object_or_404(Travel, id=viaje_id)
        user_lat = float(request.data.get('latitud'))
        user_lon = float(request.data.get('longitud'))
        distancia = calcular_distancia(user_lat, user_lon, viaje.latitude, viaje.longitude)

        if distancia <= 200:
            viaje.is_validated = True
            viaje.save()
            return Response({
                "mensaje": "¡Visita validada! Estás en el lugar correcto.",
                "distancia_metros": round(distancia, 2)
            }, status=status.HTTP_200_OK)
        else:
            return Response({
                "error": "Estás demasiado lejos del lugar.",
                "distancia_metros": round(distancia, 2)
            }, status=status.HTTP_400_BAD_REQUEST)
        
class MisViajesView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        viajes = Travel.objects.filter(user=request.user).order_by('-start_date')
        serializer = TravelSerializer(viajes, many=True)
        return Response(serializer.data)


class EliminarViajeView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]

    def delete(self, request, viaje_id):
        viaje = get_object_or_404(Travel, id=viaje_id, user=request.user)
        viaje.delete()
        return Response({"mensaje": "Viaje eliminado correctamente"})
    
class DetalleViajeView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, viaje_id):
        viaje = get_object_or_404(Travel, id=viaje_id, user=request.user)
        rutas = Route.objects.filter(travel=viaje)
        
        rutas_data = [{
            'id': r.id,
            'name': r.name,
            'itinerary': r.itinerary
        } for r in rutas]

        serializer = TravelSerializer(viaje)
        return Response({
            "viaje": serializer.data,
            "rutas": rutas_data
        })

    def patch(self, request, viaje_id):
        """Actualizar itinerario manualmente"""
        viaje = get_object_or_404(Travel, id=viaje_id, user=request.user)
        nombre = request.data.get('nombre', 'Mi itinerario')
        itinerario = request.data.get('itinerario', '')

        # Actualizar o crear ruta
        ruta, created = Route.objects.update_or_create(
            travel=viaje,
            name=nombre,
            defaults={'itinerary': itinerario}
        )

        return Response({
            "mensaje": "Itinerario guardado",
            "ruta": {
                'id': ruta.id,
                'name': ruta.name,
                'itinerary': ruta.itinerary
            }
        })


class GenerarItinerarioIAView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request, viaje_id):
        viaje = get_object_or_404(Travel, id=viaje_id, user=request.user)
        
        from groq import Groq
        import os

        client = Groq(api_key=os.environ.get("GROQ_API_KEY"))
        
        duracion = (viaje.end_date - viaje.start_date).days + 1

        prompt = f"""Crea un itinerario de viaje detallado para {viaje.destination}.
Duración: {duracion} días (del {viaje.start_date} al {viaje.end_date}).

Formato de respuesta (sin introducción, solo el itinerario):

Día 1: [Título del día]
- Mañana: [actividades]
- Tarde: [actividades]
- Noche: [actividades]

Día 2: [Título del día]
...

Incluye lugares turísticos, restaurantes recomendados y consejos prácticos."""

        chat_completion = client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model="llama-3.3-70b-versatile",
            temperature=0.7,
            max_tokens=2000
        )

        itinerario_generado = chat_completion.choices[0].message.content

        # Guardar como ruta
        ruta, _ = Route.objects.update_or_create(
            travel=viaje,
            name=f"Itinerario IA - {viaje.destination}",
            defaults={'itinerary': itinerario_generado}
        )

        return Response({
            "mensaje": "Itinerario generado con IA",
            "itinerario": itinerario_generado,
            "ruta_id": ruta.id
        })

class MonumentosViajeView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, viaje_id):
        """Listar monumentos de un viaje"""
        viaje = get_object_or_404(Travel, id=viaje_id, user=request.user)
        monumentos = Monument.objects.filter(travel=viaje)
        
        monumentos_data = [{
            'id': m.id,
            'name': m.name,
            'description': m.description,
            'points': m.points,
            'visitado': Visita.objects.filter(user=request.user, monument=m).exists()
        } for m in monumentos]

        return Response(monumentos_data)


class ValidarMonumentoView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        """Validar visita a monumento por geolocalización"""
        viaje_id = request.data.get('viaje_id')
        nombre_monumento = request.data.get('nombre').strip()
        user_lat = float(request.data.get('latitud'))
        user_lon = float(request.data.get('longitud'))

        viaje = get_object_or_404(Travel, id=viaje_id, user=request.user)

        # Buscar monumentos cercanos conocidos (base de datos local o API externa)
        # Por ahora, creamos el monumento si no existe
        
        # Calcular distancia al destino del viaje
        from .utils import calcular_distancia
        distancia = calcular_distancia(user_lat, user_lon, viaje.latitude, viaje.longitude)

        # Debe estar dentro del radio del viaje (ej: 50km)
        if distancia > 50000:  # 50km en metros
            return Response({
                "error": f"Estás demasiado lejos de {viaje.destination}",
                "distancia_km": round(distancia / 1000, 2)
            }, status=400)

        # Crear o buscar monumento
        monumento, created = Monument.objects.get_or_create(
            travel=viaje,
            name=nombre_monumento,
            defaults={
                'description': f'Visitado en {viaje.destination}',
                'points': 1
            }
        )

        # Registrar visita
        from django.utils import timezone
        visita, created_visita = Visita.objects.get_or_create(
            user=request.user,
            monument=monumento,
            defaults={
                'date': timezone.now().date(),
                'rating': 5,
                'valitation': True
            }
        )

        if not created_visita:
            return Response({
                "error": "Ya visitaste este monumento"
            }, status=400)

        return Response({
            "mensaje": f"¡Visita validada a {nombre_monumento}!",
            "puntos": monumento.points,
            "distancia_km": round(distancia / 1000, 2)
        })


class EliminarMonumentoView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]

    def delete(self, request, monumento_id):
        """Eliminar una visita a monumento"""
        visita = get_object_or_404(Visita, id=monumento_id, user=request.user)
        visita.delete()
        return Response({"mensaje": "Visita eliminada"})