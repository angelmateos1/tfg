from django.db import models
from django.contrib.auth.models import AbstractUser
import uuid
import random
import string

def generar_friendship_code():
    return 'TQ-' + uuid.uuid4().hex[:8].upper()

class User(AbstractUser):
    friendship_code = models.CharField(max_length=20, unique=True, blank=True)
    profile_picture = models.ImageField(upload_to='fotos_perfil/', blank=True, null=True)
    bio = models.TextField(blank=True, default='')

    def save(self, *args, **kwargs):
        if not self.friendship_code:
            code = generar_friendship_code()
            while User.objects.filter(friendship_code=code).exists():
               code = generar_friendship_code()
            self.friendship_code = code
        super().save(*args, **kwargs)

    def __str__(self):
        return self.username

class Friendship(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='friendships')
    friend = models.ForeignKey(User, on_delete=models.CASCADE, related_name='friend_of')
    date = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'friend')

    def __str__(self):
        return f"{self.user.username} → {self.friend.username}"



class Achievement(models.Model):
    """Catálogo de logros disponibles en el juego"""
    code = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=100)
    description = models.TextField()
    icon = models.CharField(max_length=10, default='🏆')
    
    def __str__(self):
        return self.name

class UnlockedAchievement(models.Model):
    """Logros que un user ha conseguido"""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='logros_desbloqueados')
    achievement = models.ForeignKey(Achievement, on_delete=models.CASCADE)
    date = models.DateField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'achievement')

    def __str__(self):
        return f"{self.user.username} - {self.achievement.name}"
    

class RecoveryCode(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    code = models.CharField(max_length=6)
    created = models.DateTimeField(auto_now_add=True)
    used = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.user.username} - {self.code}"

    @staticmethod
    def generar_codigo():
        return ''.join(random.choices(string.digits, k=6))