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

from .models import Monument, Route, Travel, Visit
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
            viajes_pasados = Travel.objects.filter(
                user=request.user,
                end_date__lt=timezone.now().date()
            )
            
            paises_visitados = list(viajes_pasados.values_list('country_code', flat=True).distinct())
            
            todos_viajes = Travel.objects.filter(user=request.user)
            serializer = TravelSerializer(todos_viajes, many=True)
            
            return Response({
                "paises": paises_visitados,  
                "markers": serializer.data   
            })
        except Exception as e:
            print(f"Error: {e}")
            return Response({"error": str(e)}, status=500)
        

class ViajeCreateView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = TravelCreateSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(user=request.user)
            return Response({"mensaje": "Viajecreated exitosamente"}, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ValidarVisitView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request, viaje_id):
        viaje = get_object_or_404(Travel, id=viaje_id)
        user_lat = float(request.data.get('latitud'))
        user_lon = float(request.data.get('longitud'))
        distancia = calcular_distancia(user_lat, user_lon, viaje.latitude, viaje.longitude)

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
        
        itinerario_texto = request.data.get('itinerario', '').strip()

        if not itinerario_texto:
            return Response({"error": "El itinerario no puede estar vacío"}, status=400)

        ruta, created = Route.objects.update_or_create(
            travel=viaje,
            name=f"Itinerario - {viaje.destination}",
            defaults={'itinerary': itinerario_texto}
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
            'Visitado': Visit.objects.filter(user=request.user, monument=m).exists()
        } for m in monumentos]

        return Response(monumentos_data)


class ValidarMonumentoView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        """Validar Visit a monumento por geolocalización"""
        viaje_id = request.data.get('viaje_id')
        name_monumento = request.data.get('name').strip()
        user_lat = float(request.data.get('latitud'))
        user_lon = float(request.data.get('longitud'))

        viaje = get_object_or_404(Travel, id=viaje_id, user=request.user)

        
        from .utils import calcular_distancia
        distancia = calcular_distancia(user_lat, user_lon, viaje.latitude, viaje.longitude)

        if distancia > 50000: 
            return Response({
                "error": f"Estás demasiado lejos de {viaje.destination}",
                "distancia_km": round(distancia / 1000, 2)
            }, status=400)

        monumento, created = Monument.objects.get_or_create(
            travel=viaje,
            name=name_monumento,
            defaults={
                'description': f'Visitado en {viaje.destination}',
                'points': 1
            }
        )

        from django.utils import timezone
        Visit, created_Visit = Visit.objects.get_or_create(
            user=request.user,
            monument=monumento,
            defaults={
                'date': timezone.now().date(),
                'rating': 5,
                'validation': True
            }
        )

        if not created_Visit:
            return Response({
                "error": "Ya Visitste este monumento"
            }, status=400)

        return Response({
            "mensaje": f"¡Visita validada a {name_monumento}!",
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

        try:
            client = Groq(api_key=os.environ.get("GROQ_API_KEY"))
        except Exception as e:
            print("Error cargando API Key:", e)
            return Response({"error": "Error de configuración en el servidor."}, status=500)

        prompt_sistema = """
        Eres un experto agente de viajes especializado en turismo sostenible. 
        Tu misión absoluta es EVITAR LA MASIFICACIÓN TURÍSTICA (overtourism). 
        Cuando el user te pida un tipo de viaje, debes recomendar un destino alternativo, 
        poco conocido, original y que no sufra de exceso de turistas. 
        PROHIBIDO recomendar capitales famosas o destinos masificados (ej: París, Venecia, Roma, Bali, Cancún, Kioto).
        Tu respuesta debe contener ÚNICAMENTE el nombre de la ciudad/región y el país, 
        en formato 'Destino, País' (ejemplo: 'Gante, Bélgica' o 'Azores, Portugal'). 
        No añadas saludos, ni introducciones, ni puntos finales. Solo el nombre del lugar.
        """

        try:
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
                model="llama-3.3-70b-versatile",
                temperature=0.8,
                max_tokens=20,
            )

            destino_sugerido = chat_completion.choices[0].message.content.strip()
            destino_sugerido = destino_sugerido.replace('"', '').replace('.', '')

            return Response({"destino": destino_sugerido})

        except Exception as e:
            print(f"Error de conexión con Groq: {e}")
            return Response({"error": "La IA está descansando. Inténtalo de nuevo."}, status=503)