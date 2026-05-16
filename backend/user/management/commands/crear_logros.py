from django.core.management.base import BaseCommand
from user.models import User, Achievement, UnlockedAchievement

class Command(BaseCommand):
    help = 'Crea el catálogo de logros del sistema y asigna algunos a varios users'

    def handle(self, *args, **kwargs):
        achievements = [
            {'code': 'primer_viaje',  'name': 'Primer Viaje',   'description': 'Añade tu primer viaje',              'icon': '✈️'},
            {'code': 'explorador',    'name': 'Explorador',     'description': 'Visita 5 países distintos',          'icon': '🗺️'},
            {'code': 'trotamundos',   'name': 'Trotamundos',    'description': 'Visita 10 países distintos',         'icon': '🌍'},
            {'code': 'fotografo',     'name': 'Fotógrafo',      'description': 'Sube 10 fotos de viajes',            'icon': '📸'},
            {'code': 'aventurero',    'name': 'Aventurero',     'description': 'Valida una Visita',                  'icon': '🏔️'},
            {'code': 'social',        'name': 'Social',         'description': 'Añade tu primer Amigo',              'icon': '👥'},
        ]

        for l in achievements:
             Achievement.objects.get_or_create(
               code=l['code'],
                defaults={
                    'name': l['name'],
                    'description': l['description'],
                    'icon': l['icon']
                }
            )

        self.stdout.write(self.style.SUCCESS(f'✅ {len(achievements)} logros creados en el catálogo.'))

        # 2. BUSCAMOS LOS LOGROS EN EL CATÁLOGO
        logro_viaje = Achievement.objects.get(code='primer_viaje')
        logro_social = Achievement.objects.get(code='social')
        logro_foto = Achievement.objects.get(code='fotografo')
        logro_trota = Achievement.objects.get(code='trotamundos')
        logro_aventura = Achievement.objects.get(code='aventurero')

        
        angel = User.objects.filter(username='angel').first()
        if angel:
            UnlockedAchievement.objects.get_or_create(user=angel,achievement=logro_viaje)
            UnlockedAchievement.objects.get_or_create(user=angel,achievement=logro_social)
            self.stdout.write("🌟logros asignados a Ángel.")

        maria = User.objects.filter(username='maria').first()
        if maria:
            UnlockedAchievement.objects.get_or_create(user=maria,achievement=logro_viaje)
            UnlockedAchievement.objects.get_or_create(user=maria,achievement=logro_foto)
            UnlockedAchievement.objects.get_or_create(user=maria,achievement=logro_trota)
            self.stdout.write("🌟logros asignados a María.")

        carlos = User.objects.filter(username='carlos').first()
        if carlos:
            UnlockedAchievement.objects.get_or_create(user=carlos,achievement=logro_aventura)
            UnlockedAchievement.objects.get_or_create(user=carlos,achievement=logro_social)
            self.stdout.write("🌟logros asignados a Carlos.")

        self.stdout.write(self.style.SUCCESS('¡Todos los logros repartidos con éxito!'))

        