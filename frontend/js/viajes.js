const token = localStorage.getItem('sofia_token');

// ── INIT ───────────────────────────────────────────────────────────────────
window.onload = function() {
    if (!token) {
        alert("Sesión no válida. Redirigiendo al login...");
        window.location.href = '/';
        return;
    }
    cargarViajes();
};

// ── CARGAR VIAJES ──────────────────────────────────────────────────────────
function cargarViajes() {
    fetch(`${API_URL}/mis-viajes/`, {
        headers: { 'Authorization': `Token ${token}` }
    })
    .then(res => {
        if (res.status === 401) {
            localStorage.removeItem('sofia_token');
            window.location.href = '/';
            throw new Error("Sesión expirada");
        }
        return res.json();
    })
    .then(viajes => {
        renderViajes(viajes);
    })
    .catch(err => console.error("Error cargando viajes:", err));
}

// ── RENDER VIAJES ──────────────────────────────────────────────────────────
function renderViajes(viajes) {
    const grid = document.getElementById('viajes-grid');

    if (!viajes || viajes.length === 0) {
        grid.innerHTML = `
            <div class="viajes-vacio">
                <div class="vacio-icono">🗺️</div>
                <h3>Aún no tienes viajes</h3>
                <p>Añade tu primer destino y empieza a explorar el mundo</p>
                <button class="btn-blue" onclick="toggleFormulario()">+ Añadir mi primer viaje</button>
            </div>
        `;
        return;
    }

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0); // Normalizar a medianoche

    // Separar viajes
    const futuros = viajes.filter(v => new Date(v.start_date) > hoy);
    const pasados = viajes.filter(v => new Date(v.end_date) < hoy);
    const enCurso = viajes.filter(v => {
        const inicio = new Date(v.start_date);
        const fin = new Date(v.end_date);
        return inicio <= hoy && fin >= hoy;
    });

    let html = '';

    // PRÓXIMOS VIAJES
    if (futuros.length > 0 || enCurso.length > 0) {
        html += '<h2 class="seccion-titulo">Próximos Viajes</h2>';
        html += '<div class="viajes-subseccion">';
        [...enCurso, ...futuros].forEach(v => {
            html += renderViajeCard(v, hoy);
        });
        html += '</div>';
    }

    // VIAJES PASADOS
    if (pasados.length > 0) {
        html += '<h2 class="seccion-titulo">🗺️ Viajes Pasados</h2>';
        html += '<div class="viajes-subseccion">';
        pasados.forEach(v => {
            html += renderViajeCard(v, hoy);
        });
        html += '</div>';
    }

    grid.innerHTML = html;
}

function renderViajeCard(v, hoy) {
    const inicio = new Date(v.start_date);
    const fin = new Date(v.end_date);
    const esPasado = fin < hoy;
    const esActivo = inicio <= hoy && fin >= hoy;
    const esFuturo = inicio > hoy;

    let estadoBadge = '';
    let estadoClase = '';
    if (esActivo) {
        estadoBadge = '<span class="badge-estado activo">🔴 En curso</span>';
        estadoClase = 'viaje-activo';
    } else if (esFuturo) {
        estadoBadge = '<span class="badge-estado futuro">📅 Próximo</span>';
        estadoClase = 'viaje-futuro';
    } else {
        estadoBadge = v.is_validated 
            ? '<span class="badge-estado validado">✅ Validado</span>'
            : '<span class="badge-estado pasado">📍 Visitado</span>';
        estadoClase = 'viaje-pasado';
    }

    const inicioFormato = inicio.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
    const finFormato = fin.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });

    return `
        <div class="viaje-card ${estadoClase}" onclick="abrirDetalleViaje(${v.id})">
            <div class="viaje-header">
                <div>
                    <h3>${v.destination}</h3>
                    <p class="viaje-pais">${v.country_code || 'País desconocido'}</p>
                </div>
                ${estadoBadge}
            </div>
            <div class="viaje-fechas">
                <div class="fecha-item">
                    <span class="fecha-label">Inicio</span>
                    <span class="fecha-valor">${inicioFormato}</span>
                </div>
                <div class="fecha-separador">→</div>
                <div class="fecha-item">
                    <span class="fecha-label">Fin</span>
                    <span class="fecha-valor">${finFormato}</span>
                </div>
            </div>
            <div class="viaje-acciones">
                ${esActivo ? `<button class="btn-validar" onclick="validarViaje(${v.id})">📍 Validar visita</button>` : ''}
                <button class="btn-eliminar" onclick="eliminarViaje(${v.id}, this)">🗑️ Eliminar</button>
            </div>
        </div>
    `;
}

// ── TOGGLE FORMULARIO ──────────────────────────────────────────────────────
function toggleFormulario() {
    const form = document.getElementById('formulario-nuevo');
    form.classList.toggle('oculto-viajes');
    
    if (!form.classList.contains('oculto-viajes')) {
        document.getElementById('input-destino').focus();
    } else {
        // Limpiar formulario al cerrar
        document.getElementById('input-destino').value = '';
        document.getElementById('input-inicio').value = '';
        document.getElementById('input-fin').value = '';
        document.getElementById('form-feedback').textContent = '';
    }
}

// ── GUARDAR VIAJE ──────────────────────────────────────────────────────────
function guardarViaje() {
    const destino = document.getElementById('input-destino').value.trim();
    const inicio = document.getElementById('input-inicio').value;
    const fin = document.getElementById('input-fin').value;
    const feedback = document.getElementById('form-feedback');

    feedback.textContent = '';

    if (!destino || !inicio || !fin) {
        feedback.textContent = '❌ Rellena todos los campos';
        feedback.style.color = '#ef4444';
        return;
    }

    if (inicio > fin) {
        feedback.textContent = '❌ La fecha de fin no puede ser anterior a la de inicio';
        feedback.style.color = '#ef4444';
        return;
    }

    feedback.textContent = '🔍 Buscando ubicación...';
    feedback.style.color = '#3b82f6';

    // Geocodificar con Nominatim
    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(destino)}&addressdetails=1`)
        .then(res => res.json())
        .then(data => {
            if (data.length === 0) {
                feedback.textContent = '❌ Lugar no encontrado. Prueba con otro nombre.';
                feedback.style.color = '#ef4444';
                return;
            }

            const lat = data[0].lat;
            const lon = data[0].lon;
            const pais = data[0].address?.country_code?.toUpperCase() || 'XX';

            feedback.textContent = '💾 Guardando viaje...';

            return fetch(`${API_URL}/nuevo-viaje/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Token ${token}`
                },
                body: JSON.stringify({
                    destination: destino,
                    country_code: pais,
                    latitude: lat,
                    longitude: lon,
                    start_date: inicio,
                    end_date: fin
                })
            });
        })
        .then(res => {
            if (!res) return;
            if (res.ok) {
                feedback.textContent = '✅ ¡Viaje añadido correctamente!';
                feedback.style.color = '#22c55e';
                setTimeout(() => {
                    toggleFormulario();
                    cargarViajes();
                }, 1500);
            } else {
                return res.json().then(err => {
                    throw new Error(JSON.stringify(err));
                });
            }
        })
        .catch(err => {
            console.error("Error guardando viaje:", err);
            feedback.textContent = '❌ Error al guardar el viaje';
            feedback.style.color = '#ef4444';
        });
}

// ── ELIMINAR VIAJE ─────────────────────────────────────────────────────────
function eliminarViaje(viajeId, btn) {
    if (!confirm('¿Seguro que quieres eliminar este viaje?')) return;

    fetch(`${API_URL}/eliminar-viaje/${viajeId}/`, {
        method: 'DELETE',
        headers: { 'Authorization': `Token ${token}` }
    })
    .then(res => {
        if (res.ok) {
            btn.closest('.viaje-card').remove();
            
            // Si no quedan viajes, recargar para mostrar el estado vacío
            const grid = document.getElementById('viajes-grid');
            if (grid.children.length === 0) {
                cargarViajes();
            }
        }
    })
    .catch(err => console.error("Error eliminando viaje:", err));
}

// ── VALIDAR VISITA ─────────────────────────────────────────────────────────
function validarViaje(viajeId) {
    if (!navigator.geolocation) {
        alert('Tu navegador no soporta geolocalización');
        return;
    }

    navigator.geolocation.getCurrentPosition(
        position => {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;

            fetch(`${API_URL}/validar-visita/${viajeId}/`, {
                method: 'POST',
                headers: {
                    'Authorization': `Token ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ latitud: lat, longitud: lon })
            })
            .then(res => res.json())
            .then(data => {
                if (data.mensaje) {
                    alert(`✅ ${data.mensaje}\nDistancia: ${data.distancia_metros}m`);
                    cargarViajes(); // recargar para actualizar el estado
                } else {
                    alert(`❌ ${data.error}\nDistancia: ${data.distancia_metros}m`);
                }
            })
            .catch(err => console.error("Error validando visita:", err));
        },
        error => {
            alert('No se pudo obtener tu ubicación. Activa el GPS.');
        }
    );
}

// ── NAVEGACIÓN ─────────────────────────────────────────────────────────────
function volverAlMapa() {
    window.location.href = '/';
}

let viajeActual = null;

function abrirDetalleViaje(viajeId) {
    fetch(`${API_URL}/viaje/${viajeId}/`, {
        headers: { 'Authorization': `Token ${token}` }
    })
    .then(res => res.json())
    .then(data => {
        console.log("📦 Datos del viaje recibidos:", data);
        
        viajeActual = data.viaje;
        
        document.getElementById('modal-titulo').textContent = data.viaje.destination;
        document.getElementById('modal-destino').textContent = data.viaje.destination;
        document.getElementById('modal-pais').textContent = data.viaje.country_code || '—';
        
        const inicio = new Date(data.viaje.start_date).toLocaleDateString('es-ES');
        const fin = new Date(data.viaje.end_date).toLocaleDateString('es-ES');
        document.getElementById('modal-fechas').textContent = `${inicio} - ${fin}`;
        
        // IMPORTANTE: verificar que data.rutas existe y tiene elementos
        let itinerario = '';
        if (data.rutas && data.rutas.length > 0 && data.rutas[0].itinerary) {
            itinerario = data.rutas[0].itinerary;
        }
        document.getElementById('itinerario-texto').value = itinerario;
        
        // Cargar monumentos
        cargarMonumentos(viajeId);
        
        document.getElementById('modal-detalle').classList.add('activo');
    })
    .catch(err => {
        console.error("Error cargando detalle:", err);
        alert('Error al cargar el viaje');
    });
}

function cerrarModalDetalle() {
    document.getElementById('modal-detalle').classList.remove('activo');
    viajeActual = null;
}

function guardarItinerario() {
    const itinerario = document.getElementById('itinerario-texto').value.trim();
    const feedback = document.getElementById('itinerario-feedback');

    if (!itinerario) {
        feedback.textContent = '❌ Escribe un itinerario primero';
        feedback.style.color = '#ef4444';
        return;
    }

    fetch(`${API_URL}/viaje/${viajeActual.id}/`, {
        method: 'PATCH',
        headers: {
            'Authorization': `Token ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ itinerario })
    })
    .then(res => res.json())
    .then(data => {
        feedback.textContent = '✅ ' + data.mensaje;
        feedback.style.color = '#22c55e';
    })
    .catch(err => {
        console.error("Error guardando itinerario:", err);
        feedback.textContent = '❌ Error al guardar';
        feedback.style.color = '#ef4444';
    });
}

function generarItinerarioIA() {
    const feedback = document.getElementById('itinerario-feedback');
    const textarea = document.getElementById('itinerario-texto');

    if (!viajeActual || !viajeActual.id) {
        feedback.textContent = '❌ Error: no hay viaje seleccionado';
        feedback.style.color = '#ef4444';
        return;
    }

    feedback.textContent = '✨ Generando itinerario con IA... (puede tardar 10-20 segundos)';
    feedback.style.color = '#7c3aed';
    textarea.disabled = true;

    fetch(`${API_URL}/viaje/${viajeActual.id}/generar-itinerario/`, {
        method: 'POST',
        headers: { 'Authorization': `Token ${token}` }
    })
    .then(res => {
        if (!res.ok) {
            return res.json().then(err => {
                throw new Error(err.error || 'Error del servidor');
            });
        }
        return res.json();
    })
    .then(data => {
        console.log("🤖 Itinerario generado:", data);
        
        if (data.itinerario) {
            textarea.value = data.itinerario;
            feedback.textContent = '✅ ' + data.mensaje;
            feedback.style.color = '#22c55e';
        } else {
            throw new Error('La respuesta no contiene itinerario');
        }
        
        textarea.disabled = false;
    })
    .catch(err => {
        console.error("Error generando itinerario:", err);
        textarea.disabled = false;
        feedback.textContent = '❌ ' + err.message;
        feedback.style.color = '#ef4444';
    });
}

function abrirDetalleViaje(viajeId) {
    fetch(`${API_URL}/viaje/${viajeId}/`, {
        headers: { 'Authorization': `Token ${token}` }
    })
    .then(res => res.json())
    .then(data => {
        viajeActual = data.viaje;
        
        document.getElementById('modal-titulo').textContent = data.viaje.destination;
        document.getElementById('modal-destino').textContent = data.viaje.destination;
        document.getElementById('modal-pais').textContent = data.viaje.country_code || '—';
        
        const inicio = new Date(data.viaje.start_date).toLocaleDateString('es-ES');
        const fin = new Date(data.viaje.end_date).toLocaleDateString('es-ES');
        document.getElementById('modal-fechas').textContent = `${inicio} - ${fin}`;
        
        // Itinerario
        const itinerario = data.rutas.length > 0 ? data.rutas[0].itinerary : '';
        document.getElementById('itinerario-texto').value = itinerario;
        
        // Cargar monumentos
        cargarMonumentos(viajeId);
        
        document.getElementById('modal-detalle').classList.add('activo');
    })
    .catch(err => console.error("Error cargando detalle:", err));
}

function cargarMonumentos(viajeId) {
    fetch(`${API_URL}/viaje/${viajeId}/monumentos/`, {
        headers: { 'Authorization': `Token ${token}` }
    })
    .then(res => res.json())
    .then(monumentos => {
        renderMonumentos(monumentos);
    })
    .catch(err => console.error("Error cargando monumentos:", err));
}

function renderMonumentos(monumentos) {
    const lista = document.getElementById('monumentos-lista');
    
    if (!monumentos || monumentos.length === 0) {
        lista.innerHTML = '<div class="monumentos-vacio">Aún no has visitado ningún monumento en este viaje</div>';
        return;
    }

    lista.innerHTML = monumentos.map(m => `
        <div class="monumento-item">
            <div class="monumento-info">
                <div class="monumento-icono">🏛️</div>
                <div class="monumento-detalles">
                    <h4>${m.name}</h4>
                    <p>${m.description || 'Sin descripción'}</p>
                </div>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
                <span class="monumento-puntos">+${m.points} pts</span>
                <button class="btn-eliminar-monumento" onclick="eliminarMonumento(${m.id})">🗑️</button>
            </div>
        </div>
    `).join('');
}

function toggleFormMonumento() {
    const form = document.getElementById('form-monumento');
    form.classList.toggle('oculto-viajes');
    
    if (!form.classList.contains('oculto-viajes')) {
        document.getElementById('input-nombre-monumento').focus();
    }
}

function validarMonumento() {
    const nombre = document.getElementById('input-nombre-monumento').value.trim();
    const feedback = document.getElementById('monumento-feedback');

    if (!nombre) {
        feedback.textContent = '❌ Escribe el nombre del monumento';
        feedback.style.color = '#ef4444';
        return;
    }

    if (!navigator.geolocation) {
        feedback.textContent = '❌ Tu navegador no soporta geolocalización';
        feedback.style.color = '#ef4444';
        return;
    }

    feedback.textContent = '📍 Obteniendo tu ubicación...';
    feedback.style.color = '#3b82f6';

    navigator.geolocation.getCurrentPosition(
        position => {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;

            feedback.textContent = '⏳ Validando ubicación...';

            fetch(`${API_URL}/validar-monumento/`, {
                method: 'POST',
                headers: {
                    'Authorization': `Token ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    viaje_id: viajeActual.id,
                    nombre: nombre,
                    latitud: lat,
                    longitud: lon
                })
            })
            .then(res => res.json())
            .then(data => {
                if (data.error) {
                    feedback.textContent = '❌ ' + data.error;
                    feedback.style.color = '#ef4444';
                } else {
                    feedback.textContent = '✅ ' + data.mensaje;
                    feedback.style.color = '#22c55e';
                    document.getElementById('input-nombre-monumento').value = '';
                    
                    // Recargar lista de monumentos
                    setTimeout(() => {
                        cargarMonumentos(viajeActual.id);
                        toggleFormMonumento();
                    }, 1500);
                }
            })
            .catch(err => {
                console.error("Error validando monumento:", err);
                feedback.textContent = '❌ Error al validar';
                feedback.style.color = '#ef4444';
            });
        },
        error => {
            feedback.textContent = '❌ No se pudo obtener tu ubicación. Activa el GPS.';
            feedback.style.color = '#ef4444';
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        }
    );
}

function eliminarMonumento(monumentoId) {
    if (!confirm('¿Eliminar esta visita?')) return;

    fetch(`${API_URL}/eliminar-monumento/${monumentoId}/`, {
        method: 'DELETE',
        headers: { 'Authorization': `Token ${token}` }
    })
    .then(res => {
        if (res.ok) {
            cargarMonumentos(viajeActual.id);
        }
    })
    .catch(err => console.error("Error eliminando monumento:", err));
}