from django.db import models
from django.contrib.auth.models import AbstractUser
import uuid

def generar_codigo_amigo():
    return 'TQ-' + uuid.uuid4().hex[:8].upper()

class User(AbstractUser):
    codigo_amigo = models.CharField(max_length=20, unique=True, blank=True)
    foto_perfil = models.ImageField(upload_to='fotos_perfil/', blank=True, null=True)
    bio = models.TextField(blank=True, default='')

    def save(self, *args, **kwargs):
        if not self.codigo_amigo:
            codigo = generar_codigo_amigo()
            while User.objects.filter(codigo_amigo=codigo).exists():
                codigo = generar_codigo_amigo()
            self.codigo_amigo = codigo
        super().save(*args, **kwargs)

    def __str__(self):
        return self.username

class Amistad(models.Model):
    usuario = models.ForeignKey(User, on_delete=models.CASCADE, related_name='amistades')
    amigo = models.ForeignKey(User, on_delete=models.CASCADE, related_name='amigo_de')
    fecha = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('usuario', 'amigo')

    def __str__(self):
        return f"{self.usuario.username} → {self.amigo.username}"


# ─── SISTEMA DE LOGROS ───────────────────────────────────────────────────

class LogroDefinicion(models.Model):
    """Catálogo de logros disponibles en el juego"""
    codigo = models.CharField(max_length=50, unique=True)  # 'primer_viaje', 'explorador', etc.
    nombre = models.CharField(max_length=100)
    descripcion = models.TextField()
    icono = models.CharField(max_length=10, default='🏆')  # emoji
    
    def __str__(self):
        return self.nombre

class LogroDesbloqueado(models.Model):
    """Logros que un usuario ha conseguido"""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='logros_desbloqueados')
    logro = models.ForeignKey(LogroDefinicion, on_delete=models.CASCADE)
    fecha = models.DateField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'logro')

    def __str__(self):
        return f"{self.user.username} - {self.logro.nombre}"
    
import random
import string

class CodigoRecuperacion(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    codigo = models.CharField(max_length=6)
    creado = models.DateTimeField(auto_now_add=True)
    usado = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.user.username} - {self.codigo}"

    @staticmethod
    def generar_codigo():
        return ''.join(random.choices(string.digits, k=6))