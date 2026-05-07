from rest_framework import serializers
from .models import User, Amistad

class AmigoPerfil(serializers.ModelSerializer):
    foto_perfil = serializers.ImageField()

    def get_foto_perfil(self, obj):
        if obj.foto_perfil:
            return obj.foto_perfil.url
        return None

    class Meta:
        model = User
        fields = ['id', 'username', 'codigo_amigo', 'foto_perfil']

class AmistadSerializer(serializers.ModelSerializer):
    amigo = AmigoPerfil(read_only=True)

    class Meta:
        model = Amistad
        fields = ['id', 'amigo', 'fecha']