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
    const esPasado = fin < hoy;
    const esActivo = inicio <= hoy && fin >= hoy;
    const esFuturo = inicio > hoy;

    let estadoBadge = '';
    let estadoClase = '';
    
    // NUEVO ORDEN: Primero comprobamos si está validado (es lo más importante)
    if (v.is_validated) {
        estadoBadge = '<span class="badge-estado validado">✅ Validado</span>';
        estadoClase = 'viaje-pasado'; // O la clase CSS que prefieras para validados
    } else if (esActivo) {
        estadoBadge = '<span class="badge-estado activo">🔴 En curso</span>';
        estadoClase = 'viaje-activo';
    } else if (esFuturo) {
        estadoBadge = '<span class="badge-estado futuro">📅 Próximo</span>';
        estadoClase = 'viaje-futuro';
    } else {
        estadoBadge = '<span class="badge-estado pasado">📍 Visitado (Sin validar)</span>';
        estadoClase = 'viaje-pasado';
    }

    const inicioFormato = inicio.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
    const finFormato = fin.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });

    let botonesAcciones = '';
    // Solo mostramos el botón si está activo Y NO está validado todavía
    if (esActivo && !v.is_validated) {
        botonesAcciones += `<button class="btn-validar" onclick="validarViajeHandler(event, ${v.id})">📍 Validar visita</button>`;
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
    }
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

// ═══════════════════════════════════════════════════════════════════════════
// ACCIONES DE VIAJE
// ═══════════════════════════════════════════════════════════════════════════

async function validarViajeHandler(event, viajeId) {
    event.stopPropagation();

    if (!navigator.geolocation) {
        mostrarCustomPopup('Error', 'Tu navegador no soporta geolocalización.', 'error');
        return;
    }

    const btn = event.currentTarget;
    const mensajeOriginal = btn.innerHTML; 
    btn.disabled = true;
    btn.innerHTML = '📍 Obteniendo ubicación...';

    navigator.geolocation.getCurrentPosition(
        async (position) => {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;

            btn.innerHTML = '⏳ Validando...';

            try {
                const token = localStorage.getItem('sofia_token'); 

                const response = await fetch(`${API_URL}/validar-visita/${viajeId}/`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Token ${token}`
                    },
                    body: JSON.stringify({ latitud: lat, longitud: lon })
                });
                
                const data = await response.json();
                const distancia = data.distancia_metros ? Math.round(data.distancia_metros) : 0;

                if (data.validado) {
                    mostrarCustomPopup('¡Éxito!', `✅ ${data.mensaje || 'Visita validada'}. Distancia: ${distancia}m`, 'success');
                    cargarViajes(); 
                } else {
                    mostrarCustomPopup('Aviso', `❌ ${data.error || 'No se pudo validar'}. Distancia: ${distancia}m`, 'error');
                    btn.innerHTML = mensajeOriginal;
                    btn.disabled = false;
                }
            } catch (error) {
                console.error("Error validando visita:", error);
                mostrarCustomPopup('Error', 'Problema de conexión con el servidor.', 'error');
                btn.innerHTML = mensajeOriginal;
                btn.disabled = false;
            }
        },
        (error) => {
            console.error("Error geolocalización:", error);
            mostrarCustomPopup('Error', 'Activa el GPS y da permisos de ubicación.', 'error');
            btn.innerHTML = mensajeOriginal;
            btn.disabled = false;
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        }
    );
}

// 2. FUNCIÓN PARA EL POPUP CUSTOM (Vanilla JS)
function mostrarCustomPopup(titulo, mensaje, tipo) {
    // Crear contenedor
    const popup = document.createElement('div');
    popup.className = `custom-popup ${tipo}`;
    
    // Contenido
    popup.innerHTML = `
        <div class="popup-content">
            <h4>${titulo}</h4>
            <p>${mensaje}</p>
            <button onclick="this.parentElement.parentElement.remove()">Aceptar</button>
        </div>
    `;

    // Añadir al body
    document.body.appendChild(popup);

    // Auto-eliminar después de 4 segundos
    setTimeout(() => {
        if (document.body.contains(popup)) {
            popup.remove();
        }
    }, 4000);
}

function eliminarViajeHandler(e, viajeId) {
    e.stopPropagation();
    mostrarConfirmacionPopup(
        '¿Seguro que quieres eliminar este viaje?',
        () => eliminarViaje(viajeId)
    );
}

function eliminarViaje(viajeId) {
    fetch(`${API_URL}/eliminar-viaje/${viajeId}/`, {
        method: 'DELETE',
        headers: { 'Authorization': `Token ${token}` }
    })
    .then(res => {
        if (res.ok) {
            // Recargar la lista de viajes para evitar manipulación directa del DOM
            mostrarCustomPopup(
                '🗑️ Viaje eliminado',
                'El viaje ha sido eliminado correctamente.',
                'success'
            );
            setTimeout(() => {
                cargarViajes();
            }, 800);
        } else {
            return res.json().then(err => {
                throw new Error(err.error || 'Error al eliminar el viaje');
            });
        }
    })
    .catch(err => {
        console.error("Error eliminando viaje:", err);
        mostrarCustomPopup(
            '❌ Error',
            'No se pudo eliminar el viaje.',
            'error'
        );
    });
}

function eliminarMonumento(monumentoId) {
    mostrarConfirmacionPopup(
        '¿Eliminar esta visita?',
        () => {
            fetch(`${API_URL}/eliminar-monumento/${monumentoId}/`, {
                method: 'DELETE',
                headers: { 'Authorization': `Token ${token}` }
            })
            .then(res => {
                if (res.ok) {
                    mostrarCustomPopup(
                        '🗑️ Monumento eliminado',
                        'La visita al monumento ha sido eliminada.',
                        'success'
                    );
                    setTimeout(() => {
                        cargarMonumentos(viajeActual.id);
                    }, 800);
                } else {
                    return res.json().then(err => {
                        throw new Error(err.error || 'Error al eliminar el monumento');
                    });
                }
            })
            .catch(err => {
                console.error("Error eliminando monumento:", err);
                mostrarCustomPopup(
                    '❌ Error',
                    'No se pudo eliminar el monumento.',
                    'error'
                );
            });
        }
    );
}

// Popup de confirmación reutilizable
function mostrarConfirmacionPopup(mensaje, onConfirm) {
    // Elimina otros popups de confirmación si existen
    document.querySelectorAll('.custom-popup.confirm').forEach(p => p.remove());

    const popup = document.createElement('div');
    popup.className = 'custom-popup confirm';

    popup.innerHTML = `
        <div class="popup-content">
            <h4>Confirmar</h4>
            <p>${mensaje}</p>
            <div style="display:flex;gap:10px;justify-content:flex-end;">
                <button class="btn-cancelar-popup">Cancelar</button>
                <button class="btn-confirmar-popup">Eliminar</button>
            </div>
        </div>
    `;

    document.body.appendChild(popup);

    popup.querySelector('.btn-cancelar-popup').onclick = () => popup.remove();
    popup.querySelector('.btn-confirmar-popup').onclick = () => {
        popup.remove();
        onConfirm();
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// MODAL DETALLE VIAJE
// ═══════════════════════════════════════════════════════════════════════════

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
    .catch(err => {
        console.error("Error cargando detalle:", err);
        mostrarCustomPopup(
            '❌ Error',
            'Error al cargar el viaje',
            'error'
        );
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
    document.getElementById('input-nombre-monumento').value = '';
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
        console.log("🤖 Itinerario generado:", data);
        
        if (data.itinerario) {
            textarea.value = data.itinerario;
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
        document.getElementById('input-nombre-monumento').focus();
        document.getElementById('monumento-feedback').textContent = '';
    } else {
        document.getElementById('input-nombre-monumento').value = '';
        document.getElementById('monumento-feedback').textContent = '';
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