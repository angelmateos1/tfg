from rest_framework import serializers
from .models import User, Amistad

class AmigoPerfil(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'codigo_amigo', 'foto_perfil']

class AmistadSerializer(serializers.ModelSerializer):
    amigo = AmigoPerfil(read_only=True)

    class Meta:
        model = Amistad
        fields = ['id', 'amigo', 'fecha']