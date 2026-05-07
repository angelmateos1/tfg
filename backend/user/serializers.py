from rest_framework import serializers
from .models import User, Amistad

class AmigoPerfil(serializers.ModelSerializer):
    foto_perfil = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'codigo_amigo', 'foto_perfil']

    def get_foto_perfil(self, obj):
        # ✅ Devuelve la URL de Cloudinary directamente
        if obj.foto_perfil:
            return obj.foto_perfil.url
        return None

class AmistadSerializer(serializers.ModelSerializer):
    amigo = AmigoPerfil(read_only=True)

    class Meta:
        model = Amistad
        fields = ['id', 'amigo', 'fecha']