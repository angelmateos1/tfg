from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.authentication import TokenAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser
from .serializers import FriendshipSerializer
from .models import User, Achievement, UnlockedAchievement, Friendship
import logging

logger = logging.getLogger(__name__)

class PerfilView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def get(self, request):
        user = request.user
        
        desbloqueados = UnlockedAchievement.objects.filter(user=user).select_related('achievement')

        todos_logros = Achievement.objects.all()
        
        achievements_data = []
        for achievement_def in todos_logros:
            desbloqueado_obj = desbloqueados.filter(achievement=achievement_def).first()
            achievements_data.append({
                'code': achievement_def.code,
                'name': achievement_def.name,
                'description': achievement_def.description,
                'icon': achievement_def.icon,
                'unlocked': desbloqueado_obj is not None,
                'date': desbloqueado_obj.date if desbloqueado_obj else None
            })

        friendships = Friendship.objects.filter(user=user).select_related('friend')
        
        foto_url = user.profile_picture.url if user.profile_picture else None

        return Response({
            "username": user.username,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "bio": user.bio,
            "date_joined": user.date_joined,
            "friendship_code": user.friendship_code,
            "profile_picture": foto_url,
            "achievements": achievements_data,
            "friends": FriendshipSerializer(friendships, many=True).data
        })

    def patch(self, request):
        user = request.user
        
        if 'first_name' in request.data:
            user.first_name = request.data.get('first_name', '').strip()
        
        if 'last_name' in request.data:
            user.last_name = request.data.get('last_name', '').strip()
        
        if 'bio' in request.data:
            user.bio = request.data.get('bio', '').strip()
        
        if 'profile_picture' in request.FILES:
            foto = request.FILES['profile_picture']
            user.profile_picture = foto
        
        user.save()
        
        foto_url = user.profile_picture.url if user.profile_picture else None
        
        return Response({
            "mensaje": "Perfil actualizado",
            "profile_picture": foto_url,
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

        todos = User.objects.all()
        ranking = []
        for u in todos:
            puntos, paises, monumentos = calcular_puntos(u)
            foto_url = u.profile_picture.url if u.profile_picture else None
            ranking.append({
                "id": u.id,
                "username": u.username,
                "profile_picture": foto_url,
                "paises": paises,
                "monumentos": monumentos,
                "puntos": puntos,
            })

        ranking.sort(key=lambda x: x['puntos'], reverse=True)

        mi_posicion = next((i+1 for i, r in enumerate(ranking) if r['id'] == request.user.id), None)
        mi_datos = next((r for r in ranking if r['id'] == request.user.id), None)

        friends_ids = set(
            Friendship.objects.filter(user=request.user).values_list('friend_id', flat=True)
        )

        return Response({
            "mi_posicion": mi_posicion,
            "yo": mi_datos,
            "ranking": ranking,
            "friends_ids": list(friends_ids),
        })

class AñadirfriendView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        code = request.data.get('friendship_code', '').strip().upper()

        if not code:
            return Response({"error": "Debes introducir un código"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            friend = User.objects.get(friendship_code=code)
        except User.DoesNotExist:
            return Response({"error": "No existe ningún user con ese código"}, status=status.HTTP_404_NOT_FOUND)

        if friend == request.user:
            return Response({"error": "No puedes añadirte a ti mismo"}, status=status.HTTP_400_BAD_REQUEST)

        if Friendship.objects.filter(user=request.user, friend=friend).exists():
            return Response({"error": "Ya sois friends"}, status=status.HTTP_400_BAD_REQUEST)

        Friendship.objects.create(user=request.user, friend=friend)
        Friendship.objects.create(user=friend, friend=request.user)

        achievement_social = Achievement.objects.filter(codigo='social').first()
        if achievement_social:
            UnlockedAchievement.objects.get_or_create(user=request.user,achievement=achievement_social)

        if achievement_social:
            UnlockedAchievement.objects.get_or_create(user=friend,achievement=achievement_social)

        return Response({"mensaje": f"¡{friend.username} añadido como friend!"})


class EliminarfriendView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]

    def delete(self, request, friend_id):
        Friendship.objects.filter(user=request.user, friend_id=friend_id).delete()
        Friendship.objects.filter(user_id=friend_id, friend=request.user).delete()
        return Response({"mensaje": "Amigo eliminado"})
    
    
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError

from rest_framework.authtoken.models import Token

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
            return Response({"error": "El user ya existe"}, status=400)

        if User.objects.filter(email=email).exists():
            return Response({"error": "El email ya está registrado"}, status=400)

        try:
            validate_password(password)
        except ValidationError as e:
            return Response({"error": list(e.messages)}, status=400)

        user = User.objects.create_user(
            username=username,
            email=email,
            password=password
        )

        token, _ = Token.objects.get_or_create(user=user)

        return Response({
            "mensaje": "Usuario creado correctamente",
            "token": token.key,
            "username": user.username
        }, status=201)
    
from django.core.mail import send_mail
from django.utils import timezone
from datetime import timedelta
from .models import RecoveryCode

class SolicitarRecuperacionView(APIView):
    def post(self, request):
        email = request.data.get('email', '').strip()

        if not email:
            return Response({"error": "Introduce tu email"}, status=400)

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response({"mensaje": "Si el email existe, recibirás un código de recuperación"})

        code = RecoveryCode.generar_codigo()
        RecoveryCode.objects.create(user=user,code=code)

        from django.core.mail import send_mail
        from django.conf import settings
        
        try:
            send_mail(
                subject='TravelQuest - Código de recuperación',
                message=f'Hola {user.username},\n\nTu código de recuperación es: {code}\n\nEste código expira en 15 minutos.\n\nSi no solicitaste esto, ignora este mensaje.',
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[email],
                fail_silently=False,
            )
            logger.info(f"✉️ Email enviado a {email} con código: {code}")
        except Exception as e:
            logger.error(f"❌ Error enviando email a {email}: {str(e)}")
            return Response({"error": f"Error al enviar el email: {str(e)}"}, status=500)

        return Response({"mensaje": "Código enviado a tu email"})


class VerificarCodigoView(APIView):
    def post(self, request):
        email = request.data.get('email', '').strip()
        code = request.data.get('codigo', '').strip()
        nueva_password = request.data.get('nueva_password', '')

        if not email or not code or not nueva_password:
            return Response({"error": "Faltan datos"}, status=400)

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response({"error": "Email no encontrado"}, status=404)

        hace_15_min = timezone.now() - timedelta(minutes=15)
        code_obj = RecoveryCode.objects.filter(
            user=user,
            code=code,
            used=False,
            created__gte=hace_15_min
        ).first()

        if not code_obj:
            return Response({"error": "Código inválido o expirado"}, status=400)

        try:
            validate_password(nueva_password)
        except ValidationError as e:
            return Response({"error": list(e.messages)}, status=400)

        user.set_password(nueva_password)
        user.save()

        code_obj.usado = True
        code_obj.save()

        return Response({"mensaje": "Contraseña cambiada correctamente"})