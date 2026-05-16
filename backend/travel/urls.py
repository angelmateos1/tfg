from django.urls import path
from .views import (
    EliminarMonumentoView, GenerarItinerarioIAView, MapStatsView, MonumentosViajeView, ValidarMonumentoView, ViajeCreateView, ValidarVisitView, DetalleViajeView,
    MisViajesView, EliminarViajeView, RecomendarDestinoView
)

urlpatterns = [
    path('map-data/', MapStatsView.as_view()),
    path('nuevo-viaje/', ViajeCreateView.as_view()),
    path('validar-Visit/<int:viaje_id>/', ValidarVisitView.as_view()),
    path('mis-viajes/', MisViajesView.as_view()),
    path('eliminar-viaje/<int:viaje_id>/', EliminarViajeView.as_view()),
    path('viaje/<int:viaje_id>/', DetalleViajeView.as_view()),
    path('viaje/<int:viaje_id>/generar-itinerario/', GenerarItinerarioIAView.as_view()),
    path('viaje/<int:viaje_id>/monumentos/', MonumentosViajeView.as_view()),
    path('validar-monumento/', ValidarMonumentoView.as_view()),
    path('eliminar-monumento/<int:monumento_id>/', EliminarMonumentoView.as_view()),
    path('recomendar-destino/', RecomendarDestinoView.as_view(), name='recomendar-destino'),
]