from django.db.models.signals import post_save
from django.dispatch import receiver
from django.db.models import Count

from .models import Travel, Visit  
from user.models import Achievement, UnlockedAchievement, User 


@receiver(post_save, sender=Travel)
def comprobar_logros_viaje(sender, instance, created, **kwargs):
    user = instance.user
    
    if created:
        total_viajes = Travel.objects.filter(user=user).count()
        if total_viajes == 1:
            achievement, _ = Achievement.objects.get_or_create(
                code='primer_viaje', 
                defaults={'name': 'Primer Viaje', 'description': 'Añade tu primer viaje', 'icon': '✈️'}
            )
            UnlockedAchievement.objects.get_or_create(user=user, achievement=achievement)


    paises_distintos = Travel.objects.filter(user=user).exclude(country_code='').values('country_code').distinct().count()
    
    if paises_distintos >= 5:
        achievement, _ = Achievement.objects.get_or_create(
            code='explorador', 
            defaults={'name': 'Explorador', 'description': 'Visita 5 países distintos', 'icon': '🗺️'}
        )
        UnlockedAchievement.objects.get_or_create(user=user, achievement=achievement)
        
    if paises_distintos >= 10:
        achievement, _ = Achievement.objects.get_or_create(
            code='trotamundos', 
            defaults={'name': 'Trotamundos', 'description': 'Visita 10 países distintos', 'icon': '🌍'}
        )
        UnlockedAchievement.objects.get_or_create(user=user, achievement=achievement)

@receiver(post_save, sender=Visit)
def comprobar_logros_visita_y_fotos(sender, instance, created, **kwargs):
    user = getattr(instance, 'user', None) or instance.travel.user
    

    if instance.validation:
        achievement, _ = Achievement.objects.get_or_create(
            code='aventurero', 
            defaults={'name': 'Aventurero', 'description': 'Valida una visita', 'icon': '🏔️'}
        )
        UnlockedAchievement.objects.get_or_create(user=user, achievement=achievement)



@receiver(post_save, sender=User)
def comprobar_logros_sociales(sender, instance, **kwargs):
    user = instance
    
    if hasattr(user, 'friends'):
        total_amigos = user.friends.count()
        if total_amigos >= 1:
            achievement, _ = Achievement.objects.get_or_create(
                code='social', 
                defaults={'name': 'Social', 'description': 'Añade tu primer amigo', 'icon': '👥'}
            )
            UnlockedAchievement.objects.get_or_create(user=user, achievement=achievement)