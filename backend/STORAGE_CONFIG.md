# 📦 Configuración de Almacenamiento (Storage)

## 🎯 Resumen

El sistema está configurado para usar **almacenamiento local en desarrollo** y **Cloudinary en producción** (Render) automáticamente.

## 🔧 Cómo funciona

### 📍 Detección de entorno

El archivo `core/settings.py` detecta automáticamente el entorno mediante:

```python
IS_PRODUCTION = os.environ.get('RENDER') == 'true' or os.environ.get('DATABASE_URL') is not None
```

### 💻 En LOCAL (desarrollo)

- **Storage**: `FileSystemStorage` (almacenamiento local)
- **Ubicación**: `/home/angel/tfg/backend/media/`
- **URL**: `/media/fotos_perfil/...`
- **Configuración**:
  ```python
  MEDIA_URL = '/media/'
  MEDIA_ROOT = '/home/angel/tfg/backend/media'
  ```
- **Ventajas**:
  - ✅ No requiere credenciales de Cloudinary
  - ✅ Rápido para desarrollo local
  - ✅ Fácil de debuggear

### 🚀 En RENDER (producción)

- **Storage**: `RawMediaCloudinaryStorage` (Cloudinary)
- **Ubicación**: Cloudinary CDN
- **URL**: `https://res.cloudinary.com/dudliookp/raw/upload/v1/...`
- **Requisitos**:
  - Variable de entorno `RENDER=true` (automática en Render)
  - Variables de Cloudinary configuradas (automático en Render)
  
## 📋 Variables de entorno necesarias (solo en Render)

En tu dashboard de Render, agrega estas variables:

```
CLOUDINARY_CLOUD_NAME=dudliookp
CLOUDINARY_API_KEY=867447551763412
CLOUDINARY_API_SECRET=xxxxxxxxxxxxx
```

## ✅ Flujo de subida de foto

### En LOCAL:
1. Usuario sube foto desde `/perfil/`
2. Django guarda en `/media/fotos_perfil/`
3. Frontend recibe: `/media/fotos_perfil/foto.jpg`
4. Navegador solicita a `http://localhost:8000/media/fotos_perfil/foto.jpg`
5. Django sirve el archivo ✅

### En RENDER:
1. Usuario sube foto desde `https://tu-app.render.com/perfil/`
2. Django guarda en Cloudinary
3. Frontend recibe: `https://res.cloudinary.com/dudliookp/raw/upload/v1/fotos_perfil/foto.jpg`
4. Navegador solicita a Cloudinary
5. Cloudinary sirve el archivo ✅

## 🧪 Test de configuración

Para verificar que todo está correcto:

```bash
# En local
cd backend
python3 manage.py shell << 'EOF'
from django.core.files.storage import default_storage
print(default_storage.__class__.__name__)  # Debe ser: FileSystemStorage
EOF

# Simular Render
RENDER=true python3 -c "
import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
import django
django.setup()
from django.core.files.storage import default_storage
print(default_storage.__class__.__name__)  # Debe ser: RawMediaCloudinaryStorage
"
```

## 📝 Cambios realizados

1. **`core/settings.py`**: Agregada detección automática de entorno y configuración dual de storage
2. **`core/urls.py`**: Configurado servicio de archivos media en desarrollo

## 🔍 Troubleshooting

### Foto no se ve en local
- Verifica que el archivo existe en `/backend/media/fotos_perfil/`
- Verifica que `DEBUG=False` no está forzado
- Reinicia el servidor

### Foto no se ve en Render
- Verifica que las variables de Cloudinary están configuradas en Render
- Verifica que `RENDER=true` está configurado en Render
- Revisa los logs de Render para errores de Cloudinary

## 📚 Referencias

- [Django Storages Documentation](https://django-storages.readthedocs.io/)
- [Cloudinary Storage for Django](https://github.com/cloudinary/pydantic-settings)
