from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from user.models import User, Amistad, LogroDefinicion, LogroDesbloqueado
from travel.models import Travel, Monument, Visita, Route  # Cambia 'travel' por el nombre real de tu app si es distinto

class Command(BaseCommand):
    help = 'Puebla la base de datos con datos de prueba para el TFG'

    def handle(self, *args, **kwargs):
        self.stdout.write("Borrando datos antiguos...")
        # Borramos en orden para evitar problemas de claves foráneas
        Visita.objects.all().delete()
        Monument.objects.all().delete()
        Route.objects.all().delete()
        Travel.objects.all().delete()
        #LogroDefinicion.objects.all().delete()
        LogroDesbloqueado.objects.all().delete()
        Amistad.objects.all().delete()
        User.objects.filter(is_superuser=False).delete() # Mantenemos a los superusuarios por si tienes el tuyo admin

        self.stdout.write("Creando usuarios...")
        # 1. Creamos al usuario principal (el de tus pruebas)
        angel = User.objects.create_user(
            username='angel',
            email='angel@example.com',
            password='angel',
            first_name='Ángel',
            last_name='García',
            bio='Apasionado por los viajes y la aventura. Mi objetivo es visitar todos los continentes.'
        )

        # 2. Creamos un par de amigos
        maria = User.objects.create_user(
            username='maria', email='maria@example.com', password='password123',
            first_name='María', last_name='López', bio='Fotógrafa de viajes.'
        )
        carlos = User.objects.create_user(
            username='carlos', email='carlos@example.com', password='password123',
            first_name='Carlos', last_name='Ruiz', bio='Siempre buscando la próxima escapada.'
        )

        self.stdout.write("Estableciendo amistades...")
        # Amistades cruzadas (Ángel es amigo de María y Carlos)
        Amistad.objects.create(usuario=angel, amigo=maria)
        Amistad.objects.create(usuario=maria, amigo=angel)
        Amistad.objects.create(usuario=angel, amigo=carlos)

        self.stdout.write("Creando el catálogo de logros...")
        # 1. Creamos las definiciones de los logros en el sistema

        self.stdout.write("Desbloqueando logros para los usuarios...")
        # 2. Se los asignamos a los usuarios

    
        self.stdout.write("Creando viajes (pasados y futuros)...")
        hoy = timezone.now().date()

        # Viaje pasado de Ángel (Ya visitado)
        viaje_paris = Travel.objects.create(
            user=angel, destination='París, Francia', country_code='FRA',
            latitude=48.8566, longitude=2.3522,
            start_date=hoy - timedelta(days=300), end_date=hoy - timedelta(days=290),
            is_validated=True
        )

        # Viaje futuro de Ángel (Planeado)
        viaje_tokyo = Travel.objects.create(
            user=angel, destination='Tokio, Japón', country_code='JPN',
            latitude=35.6762, longitude=139.6503,
            start_date=hoy + timedelta(days=60), end_date=hoy + timedelta(days=75),
            is_validated=False
        )

        # Viaje de María
        viaje_roma = Travel.objects.create(
            user=maria, destination='Roma, Italia', country_code='ITA',
            latitude=41.9028, longitude=12.4964,
            start_date=hoy - timedelta(days=100), end_date=hoy - timedelta(days=90),
            is_validated=True
        )

        self.stdout.write("Añadiendo rutas y monumentos...")
        self.stdout.write("Añadiendo rutas y monumentos...")
        
        # --- RUTAS ---
        # Ruta de París (Ángel)
        Route.objects.create(
            travel=viaje_paris, name='París Clásico', 
            itinerary='Día 1: Torre Eiffel y Sena. Día 2: Louvre. Día 3: Montmartre.'
        )
        # Ruta de Tokio (Ángel - Futuro)
        Route.objects.create(
            travel=viaje_tokyo, name='Tokio Express', 
            itinerary='Día 1: Shibuya y Shinjuku. Día 2: Templo Senso-ji y Akihabara.'
        )
        # Ruta de Roma (María)
        Route.objects.create(
            travel=viaje_roma, name='Roma Imperial', 
            itinerary='Día 1: Coliseo y Foro. Día 2: Vaticano.'
        )

        # --- MONUMENTOS ---
        # Monumentos París
        torre_eiffel = Monument.objects.create(
            travel=viaje_paris, name='Torre Eiffel', 
            description='Símbolo icónico de París de hierro forjado.',
            ratio_validation=20.5, points=1
        )
        louvre = Monument.objects.create(
            travel=viaje_paris, name='Museo del Louvre', 
            description='Museo de arte más grande del mundo.',
            ratio_validation=15.0, points=1
        )
        
        # Monumentos Tokio (Para el viaje futuro)
        skytree = Monument.objects.create(
            travel=viaje_tokyo, name='Tokyo Skytree', 
            description='Torre de comunicaciones más alta de Japón.',
            ratio_validation=10.0, points=1
        )

        # Monumentos Roma (Para María)
        coliseo = Monument.objects.create(
            travel=viaje_roma, name='Coliseo Romano', 
            description='Antiguo anfiteatro de gladiadores.',
            ratio_validation=25.0, points=1
        )

        self.stdout.write("Registrando visitas a monumentos...")
        
        # Visitas de Ángel en París (Pasadas y validadas)
        Visita.objects.create(
            user=angel, monument=torre_eiffel, 
            date=viaje_paris.start_date + timedelta(days=1), rating=5, validation=True
        )
        Visita.objects.create(
            user=angel, monument=louvre, 
            date=viaje_paris.start_date + timedelta(days=2), rating=4, validation=True
        )

        # Visita de María en Roma
        Visita.objects.create(
            user=maria, monument=coliseo, 
            date=viaje_roma.start_date + timedelta(days=1), rating=5, validation=True
        )
        
        # (Nota: No le ponemos visitas a Tokio porque es un viaje futuro)

        self.stdout.write(self.style.SUCCESS('¡Base de datos poblada con éxito! Ya puedes probar la app.'))