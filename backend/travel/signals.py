from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import Travel
from user.models import LogroDefinicion, LogroDesbloqueado

@receiver(post_save, sender=Travel)
def comprobar_logros_viaje(sender, instance, created, **kwargs):
    user = instance.user
    
    # Primer viaje
    if created:
        total_viajes = Travel.objects.filter(user=user).count()
        if total_viajes == 1:
            logro = LogroDefinicion.objects.get(codigo='primer_viaje')
            LogroDesbloqueado.objects.get_or_create(user=user, logro=logro)
    
    # Explorador (5 países)
    paises_distintos = Travel.objects.filter(user=user).values('country_code').distinct().count()
    if paises_distintos >= 5:
        logro = LogroDefinicion.objects.get(codigo='explorador')
        LogroDesbloqueado.objects.get_or_create(user=user, logro=logro)
    
    # Trotamundos (10 países)
    if paises_distintos >= 10:
        logro = LogroDefinicion.objects.get(codigo='trotamundos')
        LogroDesbloqueado.objects.get_or_create(user=user, logro=logro)