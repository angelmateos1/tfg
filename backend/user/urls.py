from django.urls import path
from .views import (
    PerfilView, AñadirAmigoView, EliminarAmigoView, RankingView, 
    RegistroView, SolicitarRecuperacionView, VerificarCodigoView
)

urlpatterns = [
    path('perfil/', PerfilView.as_view(), name='perfil'),
    path('amigos/añadir/', AñadirAmigoView.as_view(), name='añadir-amigo'),
    path('amigos/eliminar/<int:amigo_id>/', EliminarAmigoView.as_view(), name='eliminar-amigo'),
    path('ranking/', RankingView.as_view(), name='ranking'),
    path('registro/', RegistroView.as_view(), name='registro'),
    path('recuperar/', SolicitarRecuperacionView.as_view(), name='solicitar-recuperacion'),
    path('verificar-codigo/', VerificarCodigoView.as_view(), name='verificar-codigo'),
]