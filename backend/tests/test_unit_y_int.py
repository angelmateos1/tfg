"""
Tests unitarios para TravelQuest
Ejecutar: python manage.py test test/test
"""

from django.test import TestCase
from django.db import IntegrityError
from datetime import date, timedelta

from user.models import (
    User, Amistad,
    LogroDefinicion, LogroDesbloqueado,
    CodigoRecuperacion,
)
from travel.models import Travel, Monument, Visita, Route


# ═══════════════════════════════════════════════════════════════════════════
# FACTORIES
# ═══════════════════════════════════════════════════════════════════════════

def make_user(username='testuser', password='pass1234'):
    return User.objects.create_user(username=username, password=password)


def make_logro(codigo='primer_viaje', nombre='Primer Viaje', icono='✈️'):
    """Crea el logro. Si ya existe (por el signal), lo devuelve."""
    logro, _ = LogroDefinicion.objects.get_or_create(
        codigo=codigo,
        defaults={'nombre': nombre, 'descripcion': 'desc', 'icono': icono}
    )
    return logro


def make_travel(user, destination='París', country_code='FR',
                lat=48.8566, lon=2.3522, start=None, end=None):
    start = start or date.today()
    end   = end   or date.today() + timedelta(days=5)
    return Travel.objects.create(
        destination=destination,
        country_code=country_code,
        latitude=lat, longitude=lon,
        start_date=start, end_date=end,
        user=user,
    )


def make_monument(travel, name='Torre Eiffel', description='Monumento icónico',
                  ratio=50.0, points=10):
    return Monument.objects.create(
        name=name, description=description,
        travel=travel, ratio_validation=ratio, points=points,
    )
    

def make_visita(user, monument, rating=5, validated=True):
    return Visita.objects.create(
        user=user, monument=monument,
        date=date.today(), rating=rating, validation=validated,
    )


# ═══════════════════════════════════════════════════════════════════════════
# USER
# ═══════════════════════════════════════════════════════════════════════════

class UserCreationTests(TestCase):

    def test_crear_usuario_basico(self):
        user = make_user('alice')
        self.assertEqual(user.username, 'alice')
        self.assertTrue(user.check_password('pass1234'))

    def test_codigo_amigo_se_genera_automaticamente(self):
        user = make_user('bob')
        self.assertTrue(user.codigo_amigo.startswith('TQ-'))
        self.assertEqual(len(user.codigo_amigo), 11)

    def test_codigo_amigo_es_unico_entre_usuarios(self):
        u1 = make_user('u1')
        u2 = make_user('u2')
        self.assertNotEqual(u1.codigo_amigo, u2.codigo_amigo)

    def test_codigo_amigo_no_cambia_al_guardar_de_nuevo(self):
        user = make_user('carol')
        codigo_original = user.codigo_amigo
        user.bio = 'Actualizada'
        user.save()
        user.refresh_from_db()
        self.assertEqual(user.codigo_amigo, codigo_original)

    def test_todos_los_codigos_amigo_son_unicos(self):
        users = [make_user(f'usr{i}') for i in range(5)]
        codigos = [u.codigo_amigo for u in users]
        self.assertEqual(len(codigos), len(set(codigos)))

    def test_bio_vacia_por_defecto(self):
        user = make_user('dave')
        self.assertEqual(user.bio, '')

    def test_foto_perfil_nula_por_defecto(self):
        user = make_user('eve')
        self.assertFalse(bool(user.foto_perfil))

    def test_str_devuelve_username(self):
        user = make_user('frank')
        self.assertEqual(str(user), 'frank')

    def test_dos_usuarios_mismo_username_falla(self):
        make_user('duplicado')
        with self.assertRaises(Exception):
            make_user('duplicado')

    def test_codigo_amigo_formato_correcto(self):
        user = make_user('george')
        partes = user.codigo_amigo.split('-')
        self.assertEqual(partes[0], 'TQ')
        self.assertEqual(len(partes[1]), 8)


# ═══════════════════════════════════════════════════════════════════════════
# AMISTAD
# ═══════════════════════════════════════════════════════════════════════════

class AmistadTests(TestCase):

    def setUp(self):
        self.u1 = make_user('u1')
        self.u2 = make_user('u2')
        self.u3 = make_user('u3')

    def test_crear_amistad(self):
        a = Amistad.objects.create(usuario=self.u1, amigo=self.u2)
        self.assertIsNotNone(a.pk)

    def test_amistad_campos(self):
        a = Amistad.objects.create(usuario=self.u1, amigo=self.u2)
        self.assertEqual(a.usuario, self.u1)
        self.assertEqual(a.amigo, self.u2)

    def test_amistad_str(self):
        a = Amistad.objects.create(usuario=self.u1, amigo=self.u2)
        self.assertIn('u1', str(a))
        self.assertIn('u2', str(a))

    def test_amistad_duplicada_falla(self):
        Amistad.objects.create(usuario=self.u1, amigo=self.u2)
        with self.assertRaises(IntegrityError):
            Amistad.objects.create(usuario=self.u1, amigo=self.u2)

    def test_amistad_inversa_es_posible(self):
        Amistad.objects.create(usuario=self.u1, amigo=self.u2)
        a2 = Amistad.objects.create(usuario=self.u2, amigo=self.u1)
        self.assertIsNotNone(a2.pk)

    def test_eliminar_usuario_elimina_sus_amistades(self):
        Amistad.objects.create(usuario=self.u1, amigo=self.u2)
        self.u1.delete()
        self.assertEqual(Amistad.objects.count(), 0)

    def test_usuario_puede_tener_multiples_amigos(self):
        Amistad.objects.create(usuario=self.u1, amigo=self.u2)
        Amistad.objects.create(usuario=self.u1, amigo=self.u3)
        self.assertEqual(Amistad.objects.filter(usuario=self.u1).count(), 2)

    def test_amistad_tiene_fecha(self):
        a = Amistad.objects.create(usuario=self.u1, amigo=self.u2)
        self.assertIsNotNone(a.fecha)


# ═══════════════════════════════════════════════════════════════════════════
# TRAVEL
# El signal dispara al crear Travel e intenta obtener LogroDefinicion
# con codigo='primer_viaje', así que hay que crearlo antes en setUp.
# ═══════════════════════════════════════════════════════════════════════════

class TravelModelTests(TestCase):

    def setUp(self):
        make_logro('primer_viaje')   # ← necesario para el signal
        self.user = make_user()

    def test_crear_viaje_basico(self):
        viaje = make_travel(self.user)
        self.assertIsNotNone(viaje.pk)
        self.assertEqual(viaje.destination, 'París')

    def test_str_devuelve_destino(self):
        viaje = make_travel(self.user, destination='Roma')
        self.assertEqual(str(viaje), 'Roma')

    def test_is_validated_false_por_defecto(self):
        viaje = make_travel(self.user)
        self.assertFalse(viaje.is_validated)

    def test_country_code_puede_ser_nulo(self):
        viaje = Travel.objects.create(
            destination='Desconocido', country_code=None,
            latitude=0.0, longitude=0.0,
            start_date=date.today(),
            end_date=date.today() + timedelta(days=1),
            user=self.user,
        )
        self.assertIsNone(viaje.country_code)

    def test_validar_viaje(self):
        viaje = make_travel(self.user)
        viaje.is_validated = True
        viaje.save()
        viaje.refresh_from_db()
        self.assertTrue(viaje.is_validated)

    def test_eliminar_usuario_elimina_viajes(self):
        make_travel(self.user)
        self.user.delete()
        self.assertEqual(Travel.objects.count(), 0)

    def test_usuario_puede_tener_multiples_viajes(self):
        make_travel(self.user, destination='París')
        make_travel(self.user, destination='Roma')
        make_travel(self.user, destination='Tokio')
        self.assertEqual(Travel.objects.filter(user=self.user).count(), 3)

    def test_viaje_pasado(self):
        viaje = make_travel(self.user,
            start=date.today() - timedelta(days=10),
            end=date.today()   - timedelta(days=5))
        self.assertTrue(viaje.end_date < date.today())

    def test_viaje_futuro(self):
        viaje = make_travel(self.user,
            start=date.today() + timedelta(days=10),
            end=date.today()   + timedelta(days=20))
        self.assertTrue(viaje.start_date > date.today())

    def test_viaje_en_curso(self):
        viaje = make_travel(self.user,
            start=date.today() - timedelta(days=2),
            end=date.today()   + timedelta(days=2))
        self.assertTrue(viaje.start_date <= date.today() <= viaje.end_date)

    def test_coordenadas_guardadas_correctamente(self):
        viaje = make_travel(self.user, lat=40.4168, lon=-3.7038)
        viaje.refresh_from_db()
        self.assertAlmostEqual(viaje.latitude,  40.4168, places=3)
        self.assertAlmostEqual(viaje.longitude, -3.7038, places=3)

    def test_country_code_longitud_maxima(self):
        viaje = make_travel(self.user, country_code='ESP')
        self.assertEqual(viaje.country_code, 'ESP')

    def test_viaje_sin_usuario_falla(self):
        with self.assertRaises(Exception):
            Travel.objects.create(
                destination='Sevilla', latitude=37.38, longitude=-5.97,
                start_date=date.today(),
                end_date=date.today() + timedelta(days=3),
                user=None,
            )

    def test_viaje_de_un_solo_dia(self):
        hoy = date.today()
        viaje = make_travel(self.user, start=hoy, end=hoy)
        self.assertEqual(viaje.start_date, viaje.end_date)


# ═══════════════════════════════════════════════════════════════════════════
# MONUMENT
# ═══════════════════════════════════════════════════════════════════════════

class MonumentModelTests(TestCase):

    def setUp(self):
        make_logro('primer_viaje')
        self.user   = make_user()
        self.travel = make_travel(self.user)

    def test_crear_monumento(self):
        m = make_monument(self.travel)
        self.assertIsNotNone(m.pk)

    def test_str_devuelve_nombre(self):
        m = make_monument(self.travel, name='Coliseo')
        self.assertEqual(str(m), 'Coliseo')

    def test_ratio_validation_por_defecto(self):
        m = Monument.objects.create(name='T', description='d', travel=self.travel)
        self.assertEqual(m.ratio_validation, 50.0)

    def test_points_por_defecto(self):
        m = Monument.objects.create(name='T', description='d', travel=self.travel)
        self.assertEqual(m.points, 10)

    def test_points_personalizado(self):
        m = make_monument(self.travel, points=100)
        self.assertEqual(m.points, 100)

    def test_ratio_personalizado(self):
        m = make_monument(self.travel, ratio=200.0)
        self.assertEqual(m.ratio_validation, 200.0)

    def test_eliminar_viaje_elimina_monumentos(self):
        make_monument(self.travel)
        self.travel.delete()
        self.assertEqual(Monument.objects.count(), 0)

    def test_viaje_puede_tener_multiples_monumentos(self):
        make_monument(self.travel, name='M1')
        make_monument(self.travel, name='M2')
        make_monument(self.travel, name='M3')
        self.assertEqual(Monument.objects.filter(travel=self.travel).count(), 3)

    def test_mismo_nombre_en_viajes_distintos(self):
        u2      = make_user('otro')
        travel2 = make_travel(u2, destination='Roma')
        m1 = make_monument(self.travel, name='X')
        m2 = make_monument(travel2,     name='X')
        self.assertNotEqual(m1.pk, m2.pk)

    def test_descripcion_larga(self):
        desc = 'a' * 1000
        m = make_monument(self.travel, description=desc)
        m.refresh_from_db()
        self.assertEqual(m.description, desc)


# ═══════════════════════════════════════════════════════════════════════════
# VISITA
# ═══════════════════════════════════════════════════════════════════════════

class VisitaModelTests(TestCase):

    def setUp(self):
        make_logro('primer_viaje')
        self.user     = make_user()
        self.travel   = make_travel(self.user)
        self.monument = make_monument(self.travel)

    def test_crear_visita(self):
        v = make_visita(self.user, self.monument)
        self.assertIsNotNone(v.pk)

    def test_str_contiene_monumento_y_fecha(self):
        v = make_visita(self.user, self.monument)
        self.assertIn('Torre Eiffel', str(v))
        self.assertIn(str(date.today()), str(v))

    def test_validation_false_por_defecto(self):
        v = Visita.objects.create(
            user=self.user, monument=self.monument,
            date=date.today(), rating=3,
        )
        self.assertFalse(v.validation)

    def test_visita_validada(self):
        v = make_visita(self.user, self.monument, validated=True)
        self.assertTrue(v.validation)

    def test_rating_se_guarda(self):
        v = make_visita(self.user, self.monument, rating=4)
        self.assertEqual(v.rating, 4)

    def test_eliminar_usuario_elimina_visitas(self):
        make_visita(self.user, self.monument)
        self.user.delete()
        self.assertEqual(Visita.objects.count(), 0)

    def test_eliminar_monumento_elimina_visitas(self):
        make_visita(self.user, self.monument)
        self.monument.delete()
        self.assertEqual(Visita.objects.count(), 0)

    def test_usuario_puede_visitar_varios_monumentos(self):
        m2 = make_monument(self.travel, name='Louvre')
        m3 = make_monument(self.travel, name='Notre Dame')
        make_visita(self.user, self.monument)
        make_visita(self.user, m2)
        make_visita(self.user, m3)
        self.assertEqual(Visita.objects.filter(user=self.user).count(), 3)

    def test_dos_usuarios_mismo_monumento(self):
        u2 = make_user('user2')
        make_visita(self.user, self.monument)
        make_visita(u2,        self.monument)
        self.assertEqual(Visita.objects.filter(monument=self.monument).count(), 2)

    def test_fecha_de_visita(self):
        v = make_visita(self.user, self.monument)
        self.assertEqual(v.date, date.today())


# ═══════════════════════════════════════════════════════════════════════════
# ROUTE (itinerario del viaje)
# Cada viaje tiene UN solo itinerario guardado como Route.
# El patrón usado en las vistas es update_or_create por nombre.
# ═══════════════════════════════════════════════════════════════════════════

class RouteModelTests(TestCase):

    def setUp(self):
        make_logro('primer_viaje')   # ← necesario para el signal
        self.user   = make_user()
        self.travel = make_travel(self.user)

    def _make_itinerario(self, texto='Día 1: Louvre\nDía 2: Torre Eiffel'):
        """Crea el itinerario del viaje, igual que hace la vista."""
        route, _ = Route.objects.update_or_create(
            travel=self.travel,
            name=f'Itinerario - {self.travel.destination}',
            defaults={'itinerary': texto}
        )
        return route

    def test_crear_itinerario(self):
        r = self._make_itinerario()
        self.assertIsNotNone(r.pk)

    def test_str_devuelve_nombre(self):
        r = self._make_itinerario()
        self.assertIn(self.travel.destination, str(r))

    def test_viaje_sin_itinerario_por_defecto(self):
        self.assertEqual(self.travel.routes.count(), 0)

    def test_viaje_tiene_un_solo_itinerario(self):
        self._make_itinerario('versión 1')
        self._make_itinerario('versión 2')
        self.assertEqual(self.travel.routes.count(), 1)

    def test_actualizar_itinerario_sobreescribe(self):
        self._make_itinerario('versión 1')
        r = self._make_itinerario('versión 2')
        r.refresh_from_db()
        self.assertEqual(r.itinerary, 'versión 2')

    def test_contenido_itinerario_se_guarda(self):
        texto = 'Día 1: Asakusa\nDía 2: Shibuya\nDía 3: Akihabara'
        r = self._make_itinerario(texto)
        r.refresh_from_db()
        self.assertEqual(r.itinerary, texto)

    def test_itinerario_largo(self):
        texto = 'Día X: actividades\n' * 100
        r = self._make_itinerario(texto)
        r.refresh_from_db()
        self.assertEqual(r.itinerary, texto)

    def test_eliminar_viaje_elimina_itinerario(self):
        self._make_itinerario()
        self.travel.delete()
        self.assertEqual(Route.objects.count(), 0)

    def test_acceder_itinerario_desde_viaje(self):
        self._make_itinerario('mi itinerario')
        itinerario = self.travel.routes.first().itinerary
        self.assertEqual(itinerario, 'mi itinerario')

    def test_dos_viajes_tienen_itinerarios_independientes(self):
        u2      = make_user('otro')
        travel2 = make_travel(u2, destination='Roma')
        Route.objects.update_or_create(
            travel=self.travel, name=f'Itinerario - {self.travel.destination}',
            defaults={'itinerary': 'plan París'}
        )
        Route.objects.update_or_create(
            travel=travel2, name=f'Itinerario - {travel2.destination}',
            defaults={'itinerary': 'plan Roma'}
        )
        self.assertEqual(self.travel.routes.first().itinerary, 'plan París')
        self.assertEqual(travel2.routes.first().itinerary, 'plan Roma')


# ═══════════════════════════════════════════════════════════════════════════
# LOGRO DEFINICION
# ═══════════════════════════════════════════════════════════════════════════

class LogroDefinicionTests(TestCase):

    def test_crear_logro(self):
        l = make_logro()
        self.assertIsNotNone(l.pk)
        self.assertEqual(l.codigo, 'primer_viaje')

    def test_str_devuelve_nombre(self):
        l = make_logro(nombre='Explorador')
        self.assertEqual(str(l), 'Explorador')

    def test_icono_por_defecto(self):
        l = LogroDefinicion.objects.create(
            codigo='sin_icono', nombre='Test', descripcion='desc'
        )
        self.assertEqual(l.icono, '🏆')

    def test_icono_personalizado(self):
        l = make_logro(icono='🌍')
        self.assertEqual(l.icono, '🌍')

    def test_codigo_unico_falla_con_create(self):
        LogroDefinicion.objects.create(
            codigo='unico', nombre='X', descripcion='d'
        )
        with self.assertRaises(IntegrityError):
            LogroDefinicion.objects.create(
                codigo='unico', nombre='Y', descripcion='d'
            )

    def test_get_or_create_no_duplica(self):
        l1, c1 = LogroDefinicion.objects.get_or_create(
            codigo='goc', defaults={'nombre': 'A', 'descripcion': 'd'}
        )
        l2, c2 = LogroDefinicion.objects.get_or_create(
            codigo='goc', defaults={'nombre': 'B', 'descripcion': 'd'}
        )
        self.assertTrue(c1)
        self.assertFalse(c2)
        self.assertEqual(l1.pk, l2.pk)

    def test_multiples_logros(self):
        make_logro(codigo='l1', nombre='Logro 1')
        make_logro(codigo='l2', nombre='Logro 2')
        make_logro(codigo='l3', nombre='Logro 3')
        self.assertEqual(LogroDefinicion.objects.count(), 3)


# ═══════════════════════════════════════════════════════════════════════════
# LOGRO DESBLOQUEADO
# ═══════════════════════════════════════════════════════════════════════════

class LogroDesbloqueadoTests(TestCase):

    def setUp(self):
        self.user  = make_user()
        self.logro = make_logro()

    def test_desbloquear_logro(self):
        ld = LogroDesbloqueado.objects.create(user=self.user, logro=self.logro)
        self.assertIsNotNone(ld.pk)

    def test_str_contiene_usuario_y_logro(self):
        ld = LogroDesbloqueado.objects.create(user=self.user, logro=self.logro)
        self.assertIn('testuser',     str(ld))
        self.assertIn('Primer Viaje', str(ld))

    def test_fecha_se_asigna_automaticamente(self):
        ld = LogroDesbloqueado.objects.create(user=self.user, logro=self.logro)
        self.assertEqual(ld.fecha, date.today())

    def test_mismo_logro_dos_veces_falla(self):
        LogroDesbloqueado.objects.create(user=self.user, logro=self.logro)
        with self.assertRaises(IntegrityError):
            LogroDesbloqueado.objects.create(user=self.user, logro=self.logro)

    def test_dos_usuarios_mismo_logro(self):
        u2 = make_user('user2')
        LogroDesbloqueado.objects.create(user=self.user, logro=self.logro)
        ld2 = LogroDesbloqueado.objects.create(user=u2, logro=self.logro)
        self.assertIsNotNone(ld2.pk)

    def test_usuario_multiples_logros(self):
        l2 = make_logro(codigo='l2', nombre='Logro 2')
        l3 = make_logro(codigo='l3', nombre='Logro 3')
        LogroDesbloqueado.objects.create(user=self.user, logro=self.logro)
        LogroDesbloqueado.objects.create(user=self.user, logro=l2)
        LogroDesbloqueado.objects.create(user=self.user, logro=l3)
        self.assertEqual(LogroDesbloqueado.objects.filter(user=self.user).count(), 3)

    def test_eliminar_usuario_elimina_logros(self):
        LogroDesbloqueado.objects.create(user=self.user, logro=self.logro)
        self.user.delete()
        self.assertEqual(LogroDesbloqueado.objects.count(), 0)

    def test_related_name(self):
        LogroDesbloqueado.objects.create(user=self.user, logro=self.logro)
        self.assertEqual(self.user.logros_desbloqueados.count(), 1)

    def test_get_or_create_no_duplica(self):
        ld1, c1 = LogroDesbloqueado.objects.get_or_create(
            user=self.user, logro=self.logro
        )
        ld2, c2 = LogroDesbloqueado.objects.get_or_create(
            user=self.user, logro=self.logro
        )
        self.assertTrue(c1)
        self.assertFalse(c2)
        self.assertEqual(ld1.pk, ld2.pk)


# ═══════════════════════════════════════════════════════════════════════════
# CODIGO RECUPERACION
# ═══════════════════════════════════════════════════════════════════════════

class CodigoRecuperacionTests(TestCase):

    def setUp(self):
        self.user = make_user()

    def test_generar_codigo_6_caracteres(self):
        self.assertEqual(len(CodigoRecuperacion.generar_codigo()), 6)

    def test_generar_codigo_solo_digitos(self):
        for _ in range(20):
            self.assertTrue(CodigoRecuperacion.generar_codigo().isdigit())

    def test_generar_codigo_es_aleatorio(self):
        codigos = {CodigoRecuperacion.generar_codigo() for _ in range(30)}
        self.assertGreater(len(codigos), 1)

    def test_crear_codigo(self):
        cr = CodigoRecuperacion.objects.create(user=self.user, codigo='123456')
        self.assertIsNotNone(cr.pk)

    def test_usado_false_por_defecto(self):
        cr = CodigoRecuperacion.objects.create(user=self.user, codigo='000000')
        self.assertFalse(cr.usado)

    def test_marcar_como_usado(self):
        cr = CodigoRecuperacion.objects.create(user=self.user, codigo='111111')
        cr.usado = True
        cr.save()
        cr.refresh_from_db()
        self.assertTrue(cr.usado)

    def test_str_contiene_usuario_y_codigo(self):
        cr = CodigoRecuperacion.objects.create(user=self.user, codigo='999999')
        self.assertIn('testuser', str(cr))
        self.assertIn('999999',   str(cr))

    def test_creado_se_asigna_automaticamente(self):
        cr = CodigoRecuperacion.objects.create(user=self.user, codigo='222222')
        self.assertIsNotNone(cr.creado)

    def test_usuario_multiples_codigos(self):
        for i in range(3):
            CodigoRecuperacion.objects.create(
                user=self.user, codigo=f'10000{i}'
            )
        self.assertEqual(CodigoRecuperacion.objects.filter(user=self.user).count(), 3)

    def test_eliminar_usuario_elimina_codigos(self):
        CodigoRecuperacion.objects.create(user=self.user, codigo='333333')
        self.user.delete()
        self.assertEqual(CodigoRecuperacion.objects.count(), 0)


# ═══════════════════════════════════════════════════════════════════════════
# INTEGRACIÓN
# ═══════════════════════════════════════════════════════════════════════════

class IntegrationTests(TestCase):

    def setUp(self):
        make_logro('primer_viaje') 
        self.user   = make_user('viajero')
        self.travel = make_travel(self.user, destination='Tokio', country_code='JP')

    def test_flujo_completo_viaje_monumento_visita(self):
        m = make_monument(self.travel, name='Senso-ji', points=50)
        v = make_visita(self.user, m, rating=5, validated=True)
        self.assertEqual(m.travel, self.travel)
        self.assertEqual(v.monument, m)
        self.assertTrue(v.validation)

    def test_viaje_con_itinerario(self):
        r = Route.objects.create(
            travel=self.travel, name='Plan Tokio',
            itinerary='Día 1: Asakusa\nDía 2: Shibuya',
        )
        self.assertEqual(self.travel.routes.first(), r)
        self.assertIn('Asakusa', r.itinerary)

    def test_validar_viaje_cambia_is_validated(self):
        self.assertFalse(self.travel.is_validated)
        self.travel.is_validated = True
        self.travel.save()
        self.travel.refresh_from_db()
        self.assertTrue(self.travel.is_validated)

    def test_cascade_delete_travel_borra_todo(self):
        m = make_monument(self.travel)
        make_visita(self.user, m)
        Route.objects.create(travel=self.travel, name='R', itinerary='...')
        self.travel.delete()
        self.assertEqual(Monument.objects.count(), 0)
        self.assertEqual(Visita.objects.count(), 0)
        self.assertEqual(Route.objects.count(), 0)

    def test_logro_desbloqueado_tras_primer_viaje(self):
        logro = LogroDefinicion.objects.get(codigo='primer_viaje')
        tiene_el_logro = self.user.logros_desbloqueados.filter(logro=logro).exists()
        self.assertTrue(tiene_el_logro, "El sistema no le ha dado el logro automáticamente al usuario")
        self.assertEqual(self.user.logros_desbloqueados.count(), 1)

    def test_usuario_multiples_paises(self):
        make_travel(self.user, destination='París',  country_code='FR')
        make_travel(self.user, destination='Berlín', country_code='DE')
        paises = set(Travel.objects.filter(user=self.user)
                     .values_list('country_code', flat=True))
        self.assertIn('JP', paises)
        self.assertIn('FR', paises)
        self.assertIn('DE', paises)