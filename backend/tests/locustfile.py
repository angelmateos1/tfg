"""
Pruebas de carga para TravelQuest con Locust.
Ejecución: locust -f locustfile.py --headless -u 50 -r 5 --run-time 2m --host http://localhost:8000
"""

from locust import HttpUser, task, between, events
from datetime import date, timedelta
import random

DESTINOS = [
    {'destination': 'París',   'country_code': 'FR', 'latitude': 48.8566,  'longitude': 2.3522},
    {'destination': 'Roma',    'country_code': 'IT', 'latitude': 41.9028,  'longitude': 12.4964},
    {'destination': 'Tokio',   'country_code': 'JP', 'latitude': 35.6762,  'longitude': 139.6503},
    {'destination': 'Londres', 'country_code': 'GB', 'latitude': 51.5074,  'longitude': -0.1278},
    {'destination': 'Berlín',  'country_code': 'DE', 'latitude': 52.5200,  'longitude': 13.4050},
]

TOKEN = '41f91e9f23cc3f57a50a8c044c8e34b870f14a1d'


class ViajeroUser(HttpUser):
    """user activo: crea, consulta y modifica viajes."""
    wait_time = between(1, 3)

    def on_start(self):
        self.viaje_ids = []
        self._refrescar_viajes()

    def _headers(self):
        return {
            'Authorization': f'Token {TOKEN}',
            'Content-Type': 'application/json',
        }

    def _refrescar_viajes(self):
        try:
            res = self.client.get('/api/mis-viajes/', headers=self._headers())
            if res.status_code == 200:
                self.viaje_ids = [v['id'] for v in res.json()]
        except:
            pass


    @task(5)
    def ver_mis_viajes(self):
        self.client.get('/api/mis-viajes/', headers=self._headers())

    @task(4)
    def ver_mapa(self):
        self.client.get('/api/map-data/', headers=self._headers())

    @task(3)
    def ver_detalle_viaje(self):
        if self.viaje_ids:
            viaje_id = random.choice(self.viaje_ids)
            self.client.get(f'/api/viaje/{viaje_id}/', headers=self._headers())

    @task(3)
    def ver_monumentos(self):
        if self.viaje_ids:
            viaje_id = random.choice(self.viaje_ids)
            self.client.get(f'/api/viaje/{viaje_id}/monumentos/', headers=self._headers())


    @task(2)
    def crear_viaje(self):
        """Crear viajes sin eliminarlos para evitar 404 durante la prueba."""
        destino = random.choice(DESTINOS)
        payload = {
            **destino,
            'start_date': str(date.today()),
            'end_date': str(date.today() + timedelta(days=5)),
        }
        res = self.client.post('/api/nuevo-viaje/', json=payload, headers=self._headers())
        if res.status_code == 201:
            self._refrescar_viajes()

    @task(2)
    def guardar_itinerario(self):
        """Guardar itinerario en un viaje existente."""
        if self.viaje_ids:
            viaje_id = random.choice(self.viaje_ids)
            self.client.patch(
                f'/api/viaje/{viaje_id}/',
                json={'itinerario': 'Día 1: centro\nDía 2: museos\nDía 3: alrededores'},
                headers=self._headers()
            )


class userLigero(HttpUser):
    """user casual: solo consulta sin crear."""
    wait_time = between(2, 5)
    weight = 3

    def _headers(self):
        return {
            'Authorization': f'Token {TOKEN}',
            'Content-Type': 'application/json',
        }

    @task(6)
    def ver_mapa(self):
        self.client.get('/api/map-data/', headers=self._headers())

    @task(4)
    def ver_viajes(self):
        self.client.get('/api/mis-viajes/', headers=self._headers())


@events.quitting.add_listener
def resumen_final(environment, **kwargs):
    stats = environment.stats.total
    print("\n" + "═" * 70)
    print("RESUMEN PRUEBA DE CARGA - TRAVELQUEST")
    print("═" * 70)
    print(f"  Total peticiones:       {stats.num_requests}")
    print(f"  Fallos:                 {stats.num_failures}")
    print(f"  Tasa de error:          {stats.fail_ratio * 100:.1f}%")
    print(f"  Peticiones/segundo:     {stats.current_rps:.2f} req/s")
    print(f"\n  Tiempos de respuesta:")
    print(f"    Mínimo:               {stats.min_response_time:.0f} ms")
    print(f"    Promedio:             {stats.avg_response_time:.0f} ms")
    print(f"    p50:                  {stats.get_response_time_percentile(0.5):.0f} ms")
    print(f"    p95:                  {stats.get_response_time_percentile(0.95):.0f} ms")
    print(f"    p99:                  {stats.get_response_time_percentile(0.99):.0f} ms")
    print(f"    Máximo:               {stats.max_response_time:.0f} ms")
    print("═" * 70)
    
    print("\nDETALLES POR ENDPOINT:")
    print("─" * 70)
    for key in sorted(stats.entries.keys()):
        entry = stats.entries[key]
        fail_rate = (entry.num_failures / entry.num_requests * 100) if entry.num_requests > 0 else 0
        print(f"\n  {entry.name}")
        print(f"    Requests: {entry.num_requests}  |  Fallos: {entry.num_failures} ({fail_rate:.1f}%)")
        print(f"    Avg: {entry.avg_response_time:.0f}ms  |  p95: {entry.get_response_time_percentile(0.95):.0f}ms  |  p99: {entry.get_response_time_percentile(0.99):.0f}ms")
    print("─" * 70)