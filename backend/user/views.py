from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.authentication import TokenAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser
from .serializers import AmistadSerializer
from .models import User, LogroDefinicion, LogroDesbloqueado, Amistad
import logging

logger = logging.getLogger(__name__)

class PerfilView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def get(self, request):
        user = request.user
        
        # Logros desbloqueados
        desbloqueados = LogroDesbloqueado.objects.filter(user=user).select_related('logro')
        
        # Todos los logros del sistema
        todos_logros = LogroDefinicion.objects.all()
        
        logros_data = []
        for logro_def in todos_logros:
            desbloqueado_obj = desbloqueados.filter(logro=logro_def).first()
            logros_data.append({
                'codigo': logro_def.codigo,
                'nombre': logro_def.nombre,
                'descripcion': logro_def.descripcion,
                'icono': logro_def.icono,
                'desbloqueado': desbloqueado_obj is not None,
                'fecha': desbloqueado_obj.fecha if desbloqueado_obj else None
            })

        amistades = Amistad.objects.filter(usuario=user).select_related('amigo')
        
        # ✅ FIX: Usar directamente .url que devuelve la URL de Cloudinary
        foto_url = user.foto_perfil.url if user.foto_perfil else None

        return Response({
            "username": user.username,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "bio": user.bio,
            "date_joined": user.date_joined,
            "codigo_amigo": user.codigo_amigo,
            "foto_perfil": foto_url,
            "logros": logros_data,
            "amigos": AmistadSerializer(amistades, many=True).data
        })

    def patch(self, request):
        user = request.user
        
        # ✅ ACTUALIZAR CAMPOS DE TEXTO
        if 'first_name' in request.data:
            user.first_name = request.data.get('first_name', '').strip()
        
        if 'last_name' in request.data:
            user.last_name = request.data.get('last_name', '').strip()
        
        if 'bio' in request.data:
            user.bio = request.data.get('bio', '').strip()
        
        # Actualizar foto
        if 'foto_perfil' in request.FILES:
            foto = request.FILES['foto_perfil']
            user.foto_perfil = foto
        
        # ✅ GUARDAR USUARIO
        user.save()
        
        foto_url = user.foto_perfil.url if user.foto_perfil else None
        
        return Response({
            "mensaje": "Perfil actualizado",
            "foto_perfil": foto_url,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "bio": user.bio
        })


class RankingView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from travel.models import Travel, Monument

        def calcular_puntos(user):
            paises = Travel.objects.filter(user=user).values('country_code').distinct().count()
            monumentos = Monument.objects.filter(travel__user=user).count()
            return (paises * 10) + (monumentos * 1), paises, monumentos

        # Todos los usuarios
        todos = User.objects.all()
        ranking = []
        for u in todos:
            puntos, paises, monumentos = calcular_puntos(u)
            # ✅ FIX: Usar directamente .url
            foto_url = u.foto_perfil.url if u.foto_perfil else None
            ranking.append({
                "id": u.id,
                "username": u.username,
                "foto_perfil": foto_url,
                "paises": paises,
                "monumentos": monumentos,
                "puntos": puntos,
            })

        ranking.sort(key=lambda x: x['puntos'], reverse=True)

        # Posición del usuario actual
        mi_posicion = next((i+1 for i, r in enumerate(ranking) if r['id'] == request.user.id), None)
        mi_datos = next((r for r in ranking if r['id'] == request.user.id), None)

        # IDs de amigos
        amigos_ids = set(
            Amistad.objects.filter(usuario=request.user).values_list('amigo_id', flat=True)
        )

        return Response({
            "mi_posicion": mi_posicion,
            "yo": mi_datos,
            "ranking": ranking,
            "amigos_ids": list(amigos_ids),
        })

class AñadirAmigoView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        codigo = request.data.get('codigo_amigo', '').strip().upper()

        if not codigo:
            return Response({"error": "Debes introducir un código"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            amigo = User.objects.get(codigo_amigo=codigo)
        except User.DoesNotExist:
            return Response({"error": "No existe ningún usuario con ese código"}, status=status.HTTP_404_NOT_FOUND)

        if amigo == request.user:
            return Response({"error": "No puedes añadirte a ti mismo"}, status=status.HTTP_400_BAD_REQUEST)

        if Amistad.objects.filter(usuario=request.user, amigo=amigo).exists():
            return Response({"error": "Ya sois amigos"}, status=status.HTTP_400_BAD_REQUEST)

        # Crear amistades bidireccionales
        Amistad.objects.create(usuario=request.user, amigo=amigo)
        Amistad.objects.create(usuario=amigo, amigo=request.user)

        # ✅ DESBLOQUEAR LOGRO DE AMISTAD para el usuario actual
        logro_social = LogroDefinicion.objects.filter(codigo='social').first()
        if logro_social:
            LogroDesbloqueado.objects.get_or_create(user=request.user, logro=logro_social)

        # ✅ DESBLOQUEAR LOGRO DE AMISTAD para el amigo también
        if logro_social:
            LogroDesbloqueado.objects.get_or_create(user=amigo, logro=logro_social)

        return Response({"mensaje": f"¡{amigo.username} añadido como amigo!"})


class EliminarAmigoView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]

    def delete(self, request, amigo_id):
        Amistad.objects.filter(usuario=request.user, amigo_id=amigo_id).delete()
        Amistad.objects.filter(usuario_id=amigo_id, amigo=request.user).delete()
        return Response({"mensaje": "Amigo eliminado"})
    
    
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError

from rest_framework.authtoken.models import Token  # ← AÑADIR AL INICIO

class RegistroView(APIView):
    def post(self, request):
        username = request.data.get('username', '').strip()
        email = request.data.get('email', '').strip()
        password = request.data.get('password', '')
        password2 = request.data.get('password2', '')

        if not username or not email or not password:
            return Response({"error": "Todos los campos son obligatorios"}, status=400)

        if password != password2:
            return Response({"error": "Las contraseñas no coinciden"}, status=400)

        if User.objects.filter(username=username).exists():
            return Response({"error": "El usuario ya existe"}, status=400)

        if User.objects.filter(email=email).exists():
            return Response({"error": "El email ya está registrado"}, status=400)

        try:
            validate_password(password)
        except ValidationError as e:
            return Response({"error": list(e.messages)}, status=400)

        # Crear usuario
        user = User.objects.create_user(
            username=username,
            email=email,
            password=password
        )

        # Generar token
        token, _ = Token.objects.get_or_create(user=user)

        return Response({
            "mensaje": "Usuario creado correctamente",
            "token": token.key,
            "username": user.username
        }, status=201)
    
from django.core.mail import send_mail
from django.utils import timezone
from datetime import timedelta
from .models import CodigoRecuperacion

class SolicitarRecuperacionView(APIView):
    def post(self, request):
        email = request.data.get('email', '').strip()

        if not email:
            return Response({"error": "Introduce tu email"}, status=400)

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            # Por seguridad, no revelar si el email existe
            return Response({"mensaje": "Si el email existe, recibirás un código de recuperación"})

        # Generar código
        codigo = CodigoRecuperacion.generar_codigo()
        CodigoRecuperacion.objects.create(user=user, codigo=codigo)

        # Enviar email
        from django.core.mail import send_mail
        from django.conf import settings
        
        try:
            send_mail(
                subject='TravelQuest - Código de recuperación',
                message=f'Hola {user.username},\n\nTu código de recuperación es: {codigo}\n\nEste código expira en 15 minutos.\n\nSi no solicitaste esto, ignora este mensaje.',
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[email],
                fail_silently=False,
            )
            logger.info(f"✉️ Email enviado a {email} con código: {codigo}")
        except Exception as e:
            logger.error(f"❌ Error enviando email a {email}: {str(e)}")
            return Response({"error": f"Error al enviar el email: {str(e)}"}, status=500)

        return Response({"mensaje": "Código enviado a tu email"})


class VerificarCodigoView(APIView):
    def post(self, request):
        email = request.data.get('email', '').strip()
        codigo = request.data.get('codigo', '').strip()
        nueva_password = request.data.get('nueva_password', '')

        if not email or not codigo or not nueva_password:
            return Response({"error": "Faltan datos"}, status=400)

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response({"error": "Email no encontrado"}, status=404)

        # Buscar código válido (no usado, creado en últimos 15 min)
        hace_15_min = timezone.now() - timedelta(minutes=15)
        codigo_obj = CodigoRecuperacion.objects.filter(
            user=user,
            codigo=codigo,
            usado=False,
            creado__gte=hace_15_min
        ).first()

        if not codigo_obj:
            return Response({"error": "Código inválido o expirado"}, status=400)

        # Validar nueva contraseña
        try:
            validate_password(nueva_password)
        except ValidationError as e:
            return Response({"error": list(e.messages)}, status=400)

        # Cambiar contraseña
        user.set_password(nueva_password)
        user.save()

        # Marcar código como usado
        codigo_obj.usado = True
        codigo_obj.save()

        return Response({"mensaje": "Contraseña cambiada correctamente"})