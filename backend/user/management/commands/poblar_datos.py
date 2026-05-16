from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from user.models import User, Friendship, Achievement, UnlockedAchievement
from travel.models import Travel, Monument, Visit, Route

class Command(BaseCommand):
    help = 'Puebla la base de datos con datos de prueba para el TFG'

    def handle(self, *args, **kwargs):
        self.stdout.write("Borrando datos antiguos...")
        Visit.objects.all().delete()
        Monument.objects.all().delete()
        Route.objects.all().delete()
        Travel.objects.all().delete()
        #Achievement.objects.all().delete()
        UnlockedAchievement.objects.all().delete()
        Friendship.objects.all().delete()
        User.objects.filter(is_superuser=False).delete() 

        self.stdout.write("Creando users...")
        angel = User.objects.create_user(
            username='angel',
            email='angel@example.com',
            password='angel',
            first_name='Ángel',
            last_name='García',
            bio='Apasionado por los viajes y la aventura. Mi objetivo es Visitr todos los continentes.'
        )

        maria = User.objects.create_user(
            username='maria', email='maria@example.com', password='password123',
            first_name='María', last_name='López', bio='Fotógrafa de viajes.'
        )
        carlos = User.objects.create_user(
            username='carlos', email='carlos@example.com', password='password123',
            first_name='Carlos', last_name='Ruiz', bio='Siempre buscando la próxima escapada.'
        )

        self.stdout.write("Estableciendo friendships...")
        Friendship.objects.create(user=angel, friend=maria)
        Friendship.objects.create(user=maria, friend=angel)
        Friendship.objects.create(user=angel, friend=carlos)

        self.stdout.write("Creando el catálogo de logros...")

        self.stdout.write("Desbloqueando logros para los users...")

        self.stdout.write("Creando viajes (pasados y futuros)...")
        hoy = timezone.now().date()

        viaje_paris = Travel.objects.create(
            user=angel, destination='París, Francia', country_code='FRA',
            latitude=48.8566, longitude=2.3522,
            start_date=hoy - timedelta(days=300), end_date=hoy - timedelta(days=290),
            is_validated=True
        )

        viaje_tokyo = Travel.objects.create(
            user=angel, destination='Tokio, Japón', country_code='JPN',
            latitude=35.6762, longitude=139.6503,
            start_date=hoy + timedelta(days=60), end_date=hoy + timedelta(days=75),
            is_validated=False
        )

        viaje_roma = Travel.objects.create(
            user=maria, destination='Roma, Italia', country_code='ITA',
            latitude=41.9028, longitude=12.4964,
            start_date=hoy - timedelta(days=100), end_date=hoy - timedelta(days=90),
            is_validated=True
        )

        self.stdout.write("Añadiendo rutas y monumentos...")
        self.stdout.write("Añadiendo rutas y monumentos...")
        

        Route.objects.create(
            travel=viaje_paris, name='París Clásico', 
            itinerary='Día 1: Torre Eiffel y Sena. Día 2: Louvre. Día 3: Montmartre.'
        )
        Route.objects.create(
            travel=viaje_tokyo, name='Tokio Express', 
            itinerary='Día 1: Shibuya y Shinjuku. Día 2: Templo Senso-ji y Akihabara.'
        )
        Route.objects.create(
            travel=viaje_roma, name='Roma Imperial', 
            itinerary='Día 1: Coliseo y Foro. Día 2: Vaticano.'
        )


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

        coliseo = Monument.objects.create(
            travel=viaje_roma, name='Coliseo Romano', 
            description='Antiguo anfiteatro de gladiadores.',
            ratio_validation=25.0, points=1
        )

        self.stdout.write("Registrando Visits a monumentos...")
        
        Visit.objects.create(
            user=angel, monument=torre_eiffel, 
            date=viaje_paris.start_date + timedelta(days=1), rating=5, validation=True
        )
        Visit.objects.create(
            user=angel, monument=louvre, 
            date=viaje_paris.start_date + timedelta(days=2), rating=4, validation=True
        )

        Visit.objects.create(
            user=maria, monument=coliseo, 
            date=viaje_roma.start_date + timedelta(days=1), rating=5, validation=True
        )
        

        self.stdout.write(self.style.SUCCESS('¡Base de datos poblada con éxito! Ya puedes probar la app.'))