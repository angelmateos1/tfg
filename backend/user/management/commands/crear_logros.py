from django.core.management.base import BaseCommand
from user.models import User, LogroDefinicion, LogroDesbloqueado

class Command(BaseCommand):
    help = 'Crea el catálogo de logros del sistema y asigna algunos a varios usuarios'

    def handle(self, *args, **kwargs):
        # 1. CREAMOS EL CATÁLOGO
        logros = [
            {'codigo': 'primer_viaje',  'nombre': 'Primer Viaje',   'descripcion': 'Añade tu primer viaje',              'icono': '✈️'},
            {'codigo': 'explorador',    'nombre': 'Explorador',     'descripcion': 'Visita 5 países distintos',          'icono': '🗺️'},
            {'codigo': 'trotamundos',   'nombre': 'Trotamundos',    'descripcion': 'Visita 10 países distintos',         'icono': '🌍'},
            {'codigo': 'fotografo',     'nombre': 'Fotógrafo',      'descripcion': 'Sube 10 fotos de viajes',            'icono': '📸'},
            {'codigo': 'aventurero',    'nombre': 'Aventurero',     'descripcion': 'Valida una visita',                  'icono': '🏔️'},
            {'codigo': 'social',        'nombre': 'Social',         'descripcion': 'Añade tu primer amigo',              'icono': '👥'},
        ]

        for l in logros:
            LogroDefinicion.objects.get_or_create(
                codigo=l['codigo'],
                defaults={
                    'nombre': l['nombre'],
                    'descripcion': l['descripcion'],
                    'icono': l['icono']
                }
            )
        
        self.stdout.write(self.style.SUCCESS(f'✅ {len(logros)} logros creados en el catálogo.'))

        # 2. BUSCAMOS LOS LOGROS EN EL CATÁLOGO
        logro_viaje = LogroDefinicion.objects.get(codigo='primer_viaje')
        logro_social = LogroDefinicion.objects.get(codigo='social')
        logro_foto = LogroDefinicion.objects.get(codigo='fotografo')
        logro_trota = LogroDefinicion.objects.get(codigo='trotamundos')
        logro_aventura = LogroDefinicion.objects.get(codigo='aventurero')

        """"
        angel = User.objects.filter(username='angel').first()
        if angel:
            LogroDesbloqueado.objects.get_or_create(user=angel, logro=logro_viaje)
            LogroDesbloqueado.objects.get_or_create(user=angel, logro=logro_social)
            self.stdout.write("🌟 Logros asignados a Ángel.")

        # --- Para María ---
        maria = User.objects.filter(username='maria').first()
        if maria:
            LogroDesbloqueado.objects.get_or_create(user=maria, logro=logro_viaje)
            LogroDesbloqueado.objects.get_or_create(user=maria, logro=logro_foto)
            LogroDesbloqueado.objects.get_or_create(user=maria, logro=logro_trota)
            self.stdout.write("🌟 Logros asignados a María.")

        # --- Para Carlos ---
        carlos = User.objects.filter(username='carlos').first()
        if carlos:
            LogroDesbloqueado.objects.get_or_create(user=carlos, logro=logro_aventura)
            LogroDesbloqueado.objects.get_or_create(user=carlos, logro=logro_social)
            self.stdout.write("🌟 Logros asignados a Carlos.")

        self.stdout.write(self.style.SUCCESS('¡Todos los logros repartidos con éxito!'))

        """