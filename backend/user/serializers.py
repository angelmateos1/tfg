from rest_framework import serializers
from .models import User, Friendship

class friendPerfil(serializers.ModelSerializer):
    profile_picture = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'friendship_code', 'profile_picture']

    def get_profile_picture(self, obj):
        # ✅ Devuelve la URL de Cloudinary directamente
        if obj.profile_picture:
            return obj.profile_picture.url
        return None

class FriendshipSerializer(serializers.ModelSerializer):
    friend = friendPerfil(read_only=True)

    class Meta:
        model = Friendship
        fields = ['id', 'friend', 'date']