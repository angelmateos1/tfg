from django.conf import settings
from django.contrib import admin
from django.urls import path, include
from rest_framework.authtoken.views import obtain_auth_token
from django.views.generic import TemplateView
from django.conf.urls.static import static

urlpatterns = [
    path('', TemplateView.as_view(template_name='index.html'), name='vista_inicio'),
    path('perfil/', TemplateView.as_view(template_name='perfil.html'), name='vista_perfil'),
    path('ranking/', TemplateView.as_view(template_name='ranking.html'), name='vista_ranking'),
    path('viajes/', TemplateView.as_view(template_name='viajes.html'), name='vista_viajes'),
    path('admin/', admin.site.urls),
    path('api/', include('travel.urls')),
    path('api/', include('user.urls')),
    path('api/login/', obtain_auth_token, name='api_token_auth'),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)