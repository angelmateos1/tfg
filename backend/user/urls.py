from django.urls import path
from .views import (
    PerfilView, AñadirfriendView, EliminarfriendView, RankingView, 
    RegistroView, SolicitarRecuperacionView, VerificarCodigoView
)

urlpatterns = [
    path('perfil/', PerfilView.as_view(), name='perfil'),
    path('friends/añadir/', AñadirfriendView.as_view(), name='añadir-friend'),
    path('friends/eliminar/<int:friend_id>/', EliminarfriendView.as_view(), name='eliminar-friend'),
    path('ranking/', RankingView.as_view(), name='ranking'),
    path('registro/', RegistroView.as_view(), name='registro'),
    path('recuperar/', SolicitarRecuperacionView.as_view(), name='solicitar-recuperacion'),
    path('verificar-codigo/', VerificarCodigoView.as_view(), name='verificar-codigo'),
]