import os
from groq import Groq
from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
import random
from rest_framework.authentication import TokenAuthentication
from rest_framework.permissions import IsAuthenticated

from django.utils import timezone

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

        # 🔍 Distancia máxima permitida: 5 km (5000 metros)
        if distancia <= 5000:
            viaje.is_validated = True
            viaje.save()
            return Response({
                "validado": True,
                "mensaje": "¡Visita validada! Estás en el lugar correcto.",
                "distancia_metros": round(distancia, 2)
            }, status=status.HTTP_200_OK)
        else:
            return Response({
                "validado": False,
                "error": "Estás demasiado lejos del lugar.",
                "distancia_metros": round(distancia, 2)
            }, status=status.HTTP_200_OK)
        
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
            'itinerary': r.itinerary  # ← CRÍTICO: debe coincidir con el modelo
        } for r in rutas]

        serializer = TravelSerializer(viaje)
        return Response({
            "viaje": serializer.data,
            "rutas": rutas_data
        })

    def patch(self, request, viaje_id):
        """Actualizar itinerario manualmente"""
        viaje = get_object_or_404(Travel, id=viaje_id, user=request.user)
        
        # IMPORTANTE: el campo se llama 'itinerario' en el request
        itinerario_texto = request.data.get('itinerario', '').strip()

        if not itinerario_texto:
            return Response({"error": "El itinerario no puede estar vacío"}, status=400)

        # Buscar o crear ruta para este viaje
        ruta, created = Route.objects.update_or_create(
            travel=viaje,
            name=f"Itinerario - {viaje.destination}",
            defaults={'itinerary': itinerario_texto}  # ← guardar en el campo correcto
        )

        return Response({
            "mensaje": "Itinerario guardado correctamente",
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
        """Eliminar un monumento de un viaje"""
        monumento = get_object_or_404(Monument, id=monumento_id)
        if monumento.travel.user != request.user:
            return Response({"error": "No autorizado"}, status=403)
        monumento.delete()
        return Response({"mensaje": "Monumento eliminado correctamente"})
    

class RecomendarDestinoView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        tipo_viaje = request.data.get('tipo_viaje', '').strip()
        
        if not tipo_viaje:
            return Response({"error": "Debes especificar un tipo de viaje."}, status=400)

        # 1. Inicializamos el cliente de Groq usando la clave de tu .env o Render
        try:
            client = Groq(api_key=os.environ.get("GROQ_API_KEY"))
        except Exception as e:
            print("Error cargando API Key:", e)
            return Response({"error": "Error de configuración en el servidor."}, status=500)

        # 2. 🧠 EL CEREBRO: El System Prompt que evita la masificación
        prompt_sistema = """
        Eres un experto agente de viajes especializado en turismo sostenible. 
        Tu misión absoluta es EVITAR LA MASIFICACIÓN TURÍSTICA (overtourism). 
        Cuando el usuario te pida un tipo de viaje, debes recomendar un destino alternativo, 
        poco conocido, original y que no sufra de exceso de turistas. 
        PROHIBIDO recomendar capitales famosas o destinos masificados (ej: París, Venecia, Roma, Bali, Cancún, Kioto).
        Tu respuesta debe contener ÚNICAMENTE el nombre de la ciudad/región y el país, 
        en formato 'Destino, País' (ejemplo: 'Gante, Bélgica' o 'Azores, Portugal'). 
        No añadas saludos, ni introducciones, ni puntos finales. Solo el nombre del lugar.
        """

        try:
            # 3. Hacemos la llamada a Groq
            chat_completion = client.chat.completions.create(
                messages=[
                    {
                        "role": "system",
                        "content": prompt_sistema
                    },
                    {
                        "role": "user",
                        "content": f"Busco un destino para este tipo de viaje: {tipo_viaje}"
                    }
                ],
                model="llama-3.3-70b-versatile", # O el modelo rápido que estés usando en Groq
                temperature=0.8, # Un poco alta para que sea creativo y original
                max_tokens=20, # Muy pocos tokens para que no se enrolle
            )

            # 4. Extraemos la respuesta y la limpiamos un poco por seguridad
            destino_sugerido = chat_completion.choices[0].message.content.strip()
            destino_sugerido = destino_sugerido.replace('"', '').replace('.', '')

            return Response({"destino": destino_sugerido})

        except Exception as e:
            # Por si Groq se cae, devuelve un error controlado y no un 500 fatal
            print(f"Error de conexión con Groq: {e}")
            return Response({"error": "La IA está descansando. Inténtalo de nuevo."}, status=503)