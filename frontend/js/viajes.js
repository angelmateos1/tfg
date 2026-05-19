const token = localStorage.getItem('sofia_token');
let viajeActual = null;

// ═══════════════════════════════════════════════════════════════════════════
// INICIALIZACIÓN
// ═══════════════════════════════════════════════════════════════════════════

window.onload = function() {
    if (!token) {
        alert("Sesión no válida. Redirigiendo al login...");
        window.location.href = '/';
        return;
    }
    cargarViajes();
};

// ═══════════════════════════════════════════════════════════════════════════
// CARGAR Y RENDERIZAR VIAJES
// ═══════════════════════════════════════════════════════════════════════════

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
    hoy.setHours(0, 0, 0, 0);

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
    inicio.setHours(0, 0, 0, 0);
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

    let botonesAcciones = '';
    if (esActivo) {
        botonesAcciones += `<button class="btn-validar" onclick="validarViajeHandler(event, ${v.id})">📍 Validar Visit</button>`;
    }
    botonesAcciones += `<button class="btn-eliminar" onclick="eliminarViajeHandler(event, ${v.id})">🗑️ Eliminar</button>`;

    return `
        <div class="viaje-card ${estadoClase}" onclick="abrirDetalleViaje(${v.id})">
            <div class="viaje-header">
                <div>
                    <h3>${v.destination}</h3>
                    <p class="viaje-pais">${v.country_code || 'País desconocido'}</p>
                </div>
                ${estadoBadge}
            </div>
            <div class="viaje-dates">
                <div class="date-item">
                    <span class="date-label">Inicio</span>
                    <span class="date-valor">${inicioFormato}</span>
                </div>
                <div class="date-separador">→</div>
                <div class="date-item">
                    <span class="date-label">Fin</span>
                    <span class="date-valor">${finFormato}</span>
                </div>
            </div>
            <div class="viaje-acciones">
                ${botonesAcciones}
            </div>
        </div>
    `;
}

// ═══════════════════════════════════════════════════════════════════════════
// FORMULARIO NUEVO VIAJE
// ═══════════════════════════════════════════════════════════════════════════

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
        // Cerrar y limpiar recomendador
        const panel = document.getElementById('recomendador-panel');
        if (panel && !panel.classList.contains('oculto-viajes')) {
            panel.classList.add('oculto-viajes');
        }
        document.getElementById('input-tipo-viaje').value = '';
        document.getElementById('recomendador-feedback').textContent = '';
    }
}


// ═══════════════════════════════════════════════════════════════════════════
// RECOMENDADOR IA DE DESTINOS
// ═══════════════════════════════════════════════════════════════════════════

function toggleRecomendador() {
    const panel = document.getElementById('recomendador-panel');
    panel.classList.toggle('oculto-viajes');

    if (!panel.classList.contains('oculto-viajes')) {
        document.getElementById('input-tipo-viaje').focus();
        document.getElementById('recomendador-feedback').textContent = '';
    } else {
        document.getElementById('input-tipo-viaje').value = '';
        document.getElementById('recomendador-feedback').textContent = '';
    }
}

function pedirRecomendacionIA() {
    const tipoViaje = document.getElementById('input-tipo-viaje').value.trim();
    const feedback  = document.getElementById('recomendador-feedback');

    if (!tipoViaje) {
        feedback.textContent = '❌ Escribe el tipo de viaje que buscas';
        feedback.style.color = '#ef4444';
        return;
    }

    feedback.textContent = '✨ Buscando el destino perfecto...';
    feedback.style.color = '#7c3aed';

    const btnBuscar = document.querySelector('#recomendador-panel .btn-ia');
    if (btnBuscar) btnBuscar.disabled = true;

    fetch(`${API_URL}/recomendar-destino/`, {
        method: 'POST',
        headers: {
            'Authorization': `Token ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ tipo_viaje: tipoViaje })
    })
    .then(res => {
        if (!res.ok) return res.json().then(err => { throw new Error(err.error || 'Error del servidor'); });
        return res.json();
    })
    .then(data => {
        if (!data.destino) throw new Error('No se recibió ningún destino');

        // Rellenar el campo destino y cerrar el panel
        document.getElementById('input-destino').value = data.destino;
        feedback.textContent = `✅ Destino sugerido: ${data.destino}`;
        feedback.style.color = '#22c55e';

        setTimeout(() => {
            toggleRecomendador();
            document.getElementById('input-inicio').focus();
        }, 1200);
    })
    .catch(err => {
        console.error("Error recomendación IA:", err);
        feedback.textContent = '❌ ' + err.message;
        feedback.style.color = '#ef4444';
    })
    .finally(() => {
        if (btnBuscar) btnBuscar.disabled = false;
    });
}

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
        feedback.textContent = '❌ La date de fin no puede ser anterior a la de inicio';
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
                feedback.textContent = '❌ Lugar no encontrado. Prueba con otro name.';
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

// ═══════════════════════════════════════════════════════════════════════════
// ACCIONES DE VIAJE
// ═══════════════════════════════════════════════════════════════════════════

function validarViajeHandler(e, viajeId) {
    e.stopPropagation();
    validarViaje(viajeId);
}

function eliminarViajeHandler(e, viajeId) {
    e.stopPropagation();
    eliminarViaje(viajeId);
}

function eliminarViaje(viajeId) {
    if (!confirm('¿Seguro que quieres eliminar este viaje?')) return;

    fetch(`${API_URL}/eliminar-viaje/${viajeId}/`, {
        method: 'DELETE',
        headers: { 'Authorization': `Token ${token}` }
    })
    .then(res => {
        if (res.ok) {
            cargarViajes();
        } else {
            alert('❌ Error al eliminar el viaje');
        }
    })
    .catch(err => {
        console.error("Error eliminando viaje:", err);
        alert('❌ Error al eliminar el viaje');
    });
}

function validarViaje(viajeId) {
    if (!navigator.geolocation) {
        alert('❌ Tu navegador no soporta geolocalización');
        return;
    }

    // Encontrar el botón para actualizar su estado
    const btn = document.querySelector(`[onclick*="validarViajeHandler(event, ${viajeId})"]`);
    const mensajeOriginal = btn ? btn.textContent : '📍 Validar Visit';
    if (btn) btn.disabled = true;
    if (btn) btn.textContent = '📍 Obteniendo ubicación...';

    navigator.geolocation.getCurrentPosition(
        position => {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;

            if (btn) btn.textContent = '⏳ Validando...';

            fetch(`${API_URL}/validar-Visit/${viajeId}/`, {
                method: 'POST',
                headers: {
                    'Authorization': `Token ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ latitud: lat, longitud: lon })
            })
            .then(res => res.json())
            .then(data => {
                const distancia = Math.round(data.distancia_metros || 0);
                
                // El servidor retorna siempre JSON con los campos mensaje o error
                if (data.mensaje) {
                    // Éxito - mostrar alert y recargar
                    alert(`✅ ${data.mensaje}\n📏 Distancia: ${distancia}m`);
                    cargarViajes();
                } else if (data.error) {
                    // Error - mostrar alert pero no recargar
                    alert(`❌ ${data.error}\n📏 Distancia: ${distancia}m`);
                    if (btn) btn.textContent = mensajeOriginal;
                    if (btn) btn.disabled = false;
                } else {
                    // Respuesta inesperada
                    alert('❌ Error: respuesta del servidor no válida');
                    if (btn) btn.textContent = mensajeOriginal;
                    if (btn) btn.disabled = false;
                }
            })
            .catch(err => {
                console.error("Error validando Visit:", err);
                alert(`❌ Error al validar la Visit: ${err.message}`);
                if (btn) btn.textContent = mensajeOriginal;
                if (btn) btn.disabled = false;
            });
        },
        error => {
            console.error("Error geolocalización:", error);
            alert('❌ No se pudo obtener tu ubicación. Activa el GPS y los permisos de ubicación.');
            if (btn) btn.textContent = mensajeOriginal;
            if (btn) btn.disabled = false;
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        }
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// MODAL DETALLE VIAJE
// ═══════════════════════════════════════════════════════════════════════════

function abrirDetalleViaje(viajeId) {
    fetch(`${API_URL}/viaje/${viajeId}/`, {
        headers: { 'Authorization': `Token ${token}` }
    })
    .then(res => {
        if (!res.ok) {
            throw new Error('Error al cargar el viaje');
        }
        return res.json();
    })
    .then(data => {
        
        viajeActual = data.viaje;
        
        document.getElementById('modal-titulo').textContent = data.viaje.destination;
        document.getElementById('modal-destino').textContent = data.viaje.destination;
        document.getElementById('modal-pais').textContent = data.viaje.country_code || '—';
        
        const inicio = new Date(data.viaje.start_date).toLocaleDateString('es-ES');
        const fin = new Date(data.viaje.end_date).toLocaleDateString('es-ES');
        document.getElementById('modal-dates').textContent = `${inicio} - ${fin}`;
        
        // Itinerario
        let itinerario = '';
        if (data.rutas && data.rutas.length > 0 && data.rutas[0].itinerary) {
            itinerario = data.rutas[0].itinerary;
        }
        document.getElementById('itinerario-texto').value = itinerario;
        
        // Limpiar feedback
        document.getElementById('itinerario-feedback').textContent = '';
        document.getElementById('monumento-feedback').textContent = '';
        
        // Cargar monumentos
        cargarMonumentos(viajeId);
        
        // Mostrar modal
        document.getElementById('modal-detalle').classList.add('activo');
    })
    .catch(err => {
        console.error("Error cargando detalle:", err);
        alert('❌ Error al cargar el viaje');
    });
}

function cerrarModalDetalle() {
    document.getElementById('modal-detalle').classList.remove('activo');
    viajeActual = null;
    
    // Limpiar formulario de monumentos
    const formMonumento = document.getElementById('form-monumento');
    if (!formMonumento.classList.contains('oculto-viajes')) {
        formMonumento.classList.add('oculto-viajes');
    }
    document.getElementById('input-name-monumento').value = '';
    document.getElementById('monumento-feedback').textContent = '';
}

// ═══════════════════════════════════════════════════════════════════════════
// ITINERARIO
// ═══════════════════════════════════════════════════════════════════════════

function guardarItinerario() {
    const itinerario = document.getElementById('itinerario-texto').value.trim();
    const feedback = document.getElementById('itinerario-feedback');

    if (!itinerario) {
        feedback.textContent = '❌ Escribe un itinerario primero';
        feedback.style.color = '#ef4444';
        return;
    }

    feedback.textContent = '💾 Guardando...';
    feedback.style.color = '#3b82f6';

    fetch(`${API_URL}/viaje/${viajeActual.id}/`, {
        method: 'PATCH',
        headers: {
            'Authorization': `Token ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ itinerario })
    })
    .then(res => {
        if (!res.ok) {
            throw new Error('Error al guardar');
        }
        return res.json();
    })
    .then(data => {
        feedback.textContent = '✅ ' + (data.mensaje || 'Itinerario guardado');
        feedback.style.color = '#22c55e';
        setTimeout(() => {
            feedback.textContent = '';
        }, 3000);
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
        
        if (data.itinerario) {
            textarea.value = data.itinerario;
            viajeActual.itinerario = data.itinerario;
            feedback.textContent = '✅ ' + (data.mensaje || 'Itinerario generado correctamente');
            feedback.style.color = '#22c55e';
            setTimeout(() => {
                feedback.textContent = '';
            }, 5000);
        } else {
            throw new Error('La respuesta no contiene itinerario');
        }
    })
    .catch(err => {
        console.error("Error generando itinerario:", err);
        feedback.textContent = '❌ ' + err.message;
        feedback.style.color = '#ef4444';
    })
    .finally(() => {
        textarea.disabled = false;
    });
}

// ═══════════════════════════════════════════════════════════════════════════
// MONUMENTOS
// ═══════════════════════════════════════════════════════════════════════════

function cargarMonumentos(viajeId) {
    fetch(`${API_URL}/viaje/${viajeId}/monumentos/`, {
        headers: { 'Authorization': `Token ${token}` }
    })
    .then(res => {
        if (!res.ok) {
            throw new Error('Error al cargar monumentos');
        }
        return res.json();
    })
    .then(monumentos => {
        renderMonumentos(monumentos);
    })
    .catch(err => {
        console.error("Error cargando monumentos:", err);
        document.getElementById('monumentos-lista').innerHTML = 
            '<div class="monumentos-vacio">Error al cargar monumentos</div>';
    });
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
        document.getElementById('input-name-monumento').focus();
        document.getElementById('monumento-feedback').textContent = '';
    } else {
        document.getElementById('input-name-monumento').value = '';
        document.getElementById('monumento-feedback').textContent = '';
    }
}

function validarMonumento() {
    const name = document.getElementById('input-name-monumento').value.trim();
    const feedback = document.getElementById('monumento-feedback');

    if (!name) {
        feedback.textContent = '❌ Escribe el name del monumento';
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
                    name: name,
                    latitud: lat,
                    longitud: lon
                })
            })
            .then(res => {
                if (!res.ok) {
                    return res.json().then(data => {
                        throw new Error(data.error || 'Error del servidor');
                    });
                }
                return res.json();
            })
            .then(data => {
                if (data.error) {
                    feedback.textContent = '❌ ' + data.error;
                    feedback.style.color = '#ef4444';
                } else {
                    feedback.textContent = '✅ ' + (data.mensaje || 'Monumento añadido correctamente');
                    feedback.style.color = '#22c55e';
                    document.getElementById('input-name-monumento').value = '';
                    
                    // Recargar lista de monumentos
                    setTimeout(() => {
                        cargarMonumentos(viajeActual.id);
                        toggleFormMonumento();
                    }, 1500);
                }
            })
            .catch(err => {
                console.error("Error validando monumento:", err);
                feedback.textContent = '❌ ' + err.message;
                feedback.style.color = '#ef4444';
            });
        },
        error => {
            console.error("Error de geolocalización:", error);
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
    if (!confirm('¿Eliminar esta Visit?')) return;

    fetch(`${API_URL}/eliminar-monumento/${monumentoId}/`, {
        method: 'DELETE',
        headers: { 'Authorization': `Token ${token}` }
    })
    .then(res => {
        if (res.ok) {
            cargarMonumentos(viajeActual.id);
        } else {
            alert('❌ Error al eliminar el monumento');
        }
    })
    .catch(err => {
        console.error("Error eliminando monumento:", err);
        alert('❌ Error al eliminar el monumento');
    });
}

// ═══════════════════════════════════════════════════════════════════════════
// NAVEGACIÓN
// ═══════════════════════════════════════════════════════════════════════════

function volverAlMapa() {
    window.location.href = '/';
}