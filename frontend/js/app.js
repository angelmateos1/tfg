let map = null;

// --- 1. INICIALIZACIÓN ---
window.onload = function() {
    const token = localStorage.getItem('sofia_token');
    if (!token) {
        mostrarLogin();
    } else {
        mostrarApp();
    }
};

// --- 2. AUTENTICACIÓN ---
function mostrarLogin() {
    document.getElementById('loginSection').style.display = 'flex';
    document.getElementById('appSection').style.display = 'none';
}

function mostrarApp() {
    const loginSection = document.getElementById('loginSection');
    const appSection = document.getElementById('appSection');
    
    loginSection.style.display = 'none';
    appSection.style.display = 'flex';

    // Esperamos a que #miMapa tenga dimensiones reales
    const mapa = document.getElementById('miMapa');
    
    const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
            const { width, height } = entry.contentRect;
            if (width > 0 && height > 0) {
                observer.disconnect(); // dejamos de observar
                inicializarMapa();
            }
        }
    });

    observer.observe(mapa);
}



function hacerLogin() {

    const userField = document.getElementById('username');
    const passField = document.getElementById('password');

    if (!userField || !passField) {
        console.error("No se encuentran los campos input en el HTML");
        return;
    }

    const datos = {
        username: userField.value.trim(),
        password: passField.value
    };

    // Deshabilitar botón para evitar doble click
    const btn = document.querySelector('.btn-entrar');
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Entrando...';
    }

    fetch(`${API_URL}/login/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datos)
    })
    .then(res => {
        if (!res.ok) {
            if (res.status === 400) throw new Error("Usuario o contraseña incorrectos");
            throw new Error("Error en el servidor: " + res.status);
        }
        return res.json();
    })
    .then(data => {
        if (!data.token) throw new Error("El servidor no devolvió un token");
        localStorage.setItem('sofia_token', data.token);
        mostrarApp(); // ← ya no necesita recarga
    })
    .catch(err => {
        console.error("Error en el login:", err);
        alert(err.message);
    })
    .finally(() => {
        // Rehabilitar botón siempre, haya error o no
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'Entrar al mapa';
        }
    });
}

function cerrarSesion() {
    localStorage.removeItem('sofia_token');
    if (map !== null) {
        map.remove();
        map = null;
    }
    mostrarLogin(); // ← sin recarga, más limpio
}

function cargarVista(rutaArchivo) {
    fetch(rutaArchivo)
        .then(res => {
            if (!res.ok) throw new Error("Vista no encontrada: " + rutaArchivo);
            return res.text();
        })
        .then(html => {
            const contenedor = document.getElementById('contenedorCentral');
            const mapWrapper = document.getElementById('mapWrapper');

            contenedor.innerHTML = html;
            contenedor.classList.remove('oculto');
            mapWrapper.style.display = 'none'; // ← ocultar mapa
        })
        .catch(err => console.error("Error cargando vista:", err));
}

function cerrarVista() {
    const contenedor = document.getElementById('contenedorCentral');
    const mapWrapper = document.getElementById('mapWrapper');

    contenedor.classList.add('oculto');
    contenedor.innerHTML = '';
    mapWrapper.style.display = 'flex'; // ← mostrar mapa de nuevo

    // Forzar redibujado de Leaflet al volver
    setTimeout(() => {
        if (map) map.invalidateSize();
    }, 100);
}

// --- 4. LÓGICA DEL MAPA ---
function inicializarMapa() {
    // Si ya existe un mapa, lo destruimos antes de crear uno nuevo
    if (map !== null) {
        map.remove();
        map = null;
    }

    const contenedorMapa = document.getElementById('miMapa');
    if (!contenedorMapa) {
        console.error("No se encontró el contenedor #miMapa");
        return;
    }

    map = L.map('miMapa', { zoomControl: false }).setView([40, 0], 3);
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(map);

    map.invalidateSize();
    setTimeout(() => {
        map.invalidateSize();
        cargarDatosMapa();
    }, 500);

    cargarDatosMapa();
}

function cargarDatosMapa() {
    const token = localStorage.getItem('sofia_token');

    if (!token) {
        console.warn("No hay token, redirigiendo al login...");
        mostrarLogin();
        return;
    }

    fetch(`${API_URL}/map-data/`, {
        headers: {
            'Authorization': `Token ${token}`,
            'Content-Type': 'application/json'
        }
    })
    .then(res => {
        if (res.status === 401) {
            localStorage.removeItem('sofia_token');
            mostrarLogin();
            throw new Error("Sesión expirada");
        }
        if (!res.ok) throw new Error("Error del servidor: " + res.status);
        return res.json();
    })
    .then(data => {

        // 1️⃣ PRIMERO: Pintar países
        if (data.paises && data.paises.length > 0) {
            pintarPaisesEnMapa(data.paises);
        }

        // 2️⃣ SEGUNDO: Añadir marcadores (con un pequeño delay para que GeoJSON termine)
        setTimeout(() => {
            // Limpiar marcadores anteriores
            map.eachLayer(layer => {
                if (layer instanceof L.Marker) {
                    map.removeLayer(layer);
                }
            });

            // Añadir nuevos marcadores
            if (data.markers && Array.isArray(data.markers)) {
                data.markers.forEach(viaje => {
                    L.marker([viaje.latitude, viaje.longitude])
                        .addTo(map)
                        .bindPopup(`<b>${viaje.destination}</b>`);
                });
            } else {
                console.warn("No hay marcadores para mostrar.");
            }
        }, 300);
    })
    .catch(err => console.error("Error cargando datos del mapa:", err));
}

// --- 5. FUNCIONES DE VIAJES ---
function procesarNuevoViaje() {
    const destino = document.getElementById('inputDestino').value.trim();
    const inicio = document.getElementById('inputInicio').value;
    const fin = document.getElementById('inputFin').value;

    if (!destino || !inicio || !fin) return alert("Rellena todos los campos");
    if (inicio > fin) return alert("La fecha de fin no puede ser anterior a la de inicio");

    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(destino)}&addressdetails=1`)
        .then(res => res.json())
        .then(data => {
            if (data.length === 0) return alert("Lugar no encontrado. Prueba con otro nombre.");

            const lat = data[0].lat;
            const lon = data[0].lon;
            const pais = data[0].address?.country_code?.toUpperCase() || 'XX';

            return fetch(`${API_URL}/nuevo-viaje/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Token ${localStorage.getItem('sofia_token')}`
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
            if (!res) return; // si el lugar no se encontró, res es undefined
            if (res.ok) {
                alert("¡Viaje añadido correctamente!");
                cerrarVista();
                cargarDatosMapa(); // recarga solo los datos, sin destruir el mapa
            } else {
                return res.json().then(err => {
                    throw new Error(JSON.stringify(err));
                });
            }
        })
        .catch(err => console.error("Error procesando viaje:", err));
}

let geojsonLayer = null;

function pintarPaisesEnMapa(paisesVisitados) {

    const visitados = paisesVisitados.map(p => 
        typeof p === 'string' ? p.toUpperCase() : p.country_code.toUpperCase()
    );

    // Usar Natural Earth - más confiable para ISO_A3
    fetch('https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson')
        .then(res => res.json())
        .then(geojson => {
            if (geojsonLayer !== null) {
                map.removeLayer(geojsonLayer);
                geojsonLayer = null;
            }


            geojsonLayer = L.geoJSON(geojson, {

                style: function(feature) {
                    // Sacamos el código de 2 letras (ej: "CZ") y el de 3 letras (ej: "FRA") del mapa
                    const codigo2 = feature.properties.ISO_A2?.toUpperCase() || '';
                    const codigo3 = feature.properties.ADM0_A3?.toUpperCase() || feature.properties.ISO_A3?.toUpperCase() || '';
                    
                    // Si la lista de Django tiene CUALQUIERA de los dos, lo damos por visitado
                    const visitado = visitados.includes(codigo2) || visitados.includes(codigo3);
                    
                    return {
                        fillColor: visitado ? '#2563eb' : 'transparent',
                        fillOpacity: visitado ? 0.4 : 0,
                        color: visitado ? '#1d4ed8' : 'transparent',
                        weight: visitado ? 2 : 0,
                    };
                },
                onEachFeature: function(feature, layer) {
                    const codigo2 = feature.properties.ISO_A2?.toUpperCase() || '';
                    const codigo3 = feature.properties.ADM0_A3?.toUpperCase() || feature.properties.ISO_A3?.toUpperCase() || '';
                    
                    if (visitados.includes(codigo2) || visitados.includes(codigo3)) {
                        layer.bindPopup(`<b>${feature.properties.NAME}</b><br>✅ Visitado`);
                    }
                }
            }).addTo(map);

            geojsonLayer.bringToBack();
        })
        .catch(err => console.error("Error cargando GeoJSON:", err));
}

function mostrarPerfil() {
    const token = localStorage.getItem('sofia_token');
    
    if (!token) {
        alert("No estás autenticado. Inicia sesión primero.");
        return;
    }

    window.location.href = '/perfil/';
};

function mostrarRanking() {
    const token = localStorage.getItem('sofia_token');
    
    if (!token) {
        alert("No estás autenticado. Inicia sesión primero.");
        return;
    }

    window.location.href = '/ranking/';
};

function mostrarViajes() {
    const token = localStorage.getItem('sofia_token');
    
    if (!token) {
        alert("No estás autenticado. Inicia sesión primero.");
        return;
    }

    window.location.href = '/viajes/';
}

// ── DETECTAR VUELTA DESDE OTRAS PÁGINAS ────────────────────────────────────
window.addEventListener('pageshow', function(event) {
    // Si volvemos con el botón "atrás" del navegador, refrescar el mapa
    if (event.persisted || performance.navigation.type === 2) {
        if (map !== null) {
            cargarDatosMapa();
        }
    }
});

function mostrarRegistro() {
    document.getElementById('form-login-view').style.display = 'none';
    document.getElementById('form-registro-view').style.display = 'block';
}

function mostrarLoginForm() {
    document.getElementById('form-login-view').style.display = 'block';
    document.getElementById('form-registro-view').style.display = 'none';
}

function hacerRegistro() {
    const username = document.getElementById('reg-username').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    const password2 = document.getElementById('reg-password2').value;
    const feedback = document.getElementById('registro-feedback');

    feedback.textContent = '';

    if (!username || !email || !password || !password2) {
        feedback.textContent = '❌ Rellena todos los campos';
        feedback.style.color = '#ef4444';
        return;
    }

    // Deshabilitar botón mientras se procesa
    const btn = event.target;
    btn.disabled = true;
    btn.textContent = 'Creando cuenta...';

    fetch(`${API_URL}/registro/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password, password2 })
    })
    .then(res => {
        if (!res.ok) {
            return res.json().then(data => {
                throw new Error(data.error || 'Error al crear cuenta');
            });
        }
        return res.json();
    })
    .then(data => {
        feedback.textContent = '✅ ' + data.mensaje;
        feedback.style.color = '#22c55e';
        localStorage.setItem('sofia_token', data.token);
        setTimeout(() => {
            window.location.reload(); // Recargar para iniciar sesión automáticamente
        }, 1500);
    })
    .catch(err => {
        console.error("Error en registro:", err);
        feedback.textContent = '❌ ' + err.message;
        feedback.style.color = '#ef4444';
        btn.disabled = false;
        btn.textContent = 'Crear cuenta';
    });
}

function mostrarRecuperacion() {
    // Lista de IDs que queremos ocultar/mostrar
    const vistas = ['form-login-view', 'form-registro-view', 'form-recuperacion-view', 'paso-1-recuperacion', 'paso-2-recuperacion'];
    
    vistas.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            if (id === 'form-recuperacion-view' || id === 'paso-1-recuperacion') {
                el.style.display = 'block';
            } else {
                el.style.display = 'none';
            }
        }
    });

    // Lista de inputs que queremos limpiar
    const inputs = ['recup-email', 'recup-codigo', 'recup-nueva-password', 'recup-nueva-password2'];
    
    inputs.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.value = ''; // Solo lo limpia si existe
        }
    });

    const feedback = document.getElementById('recuperacion-feedback');
    if (feedback) feedback.textContent = '';
}

function volverAlLogin() {
    document.getElementById('form-login-view').style.display = 'block';
    document.getElementById('form-registro-view').style.display = 'none';
    document.getElementById('form-recuperacion-view').style.display = 'none';
}

function enviarCodigoRecuperacion() {
    const email = document.getElementById('recup-email').value.trim();
    const feedback = document.getElementById('recuperacion-feedback');

    if (!email) {
        feedback.textContent = '❌ Introduce tu email';
        feedback.style.color = '#ef4444';
        return;
    }

    feedback.textContent = '⏳ Enviando código...';
    feedback.style.color = '#64748b';

    fetch(`${API_URL}/recuperar/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
    })
    .then(res => res.json())
    .then(data => {
        // CORRECCIÓN AQUÍ: Comprobamos si Django nos devuelve un error (ej. "Usuario no encontrado")
        if (data.error) {
            feedback.textContent = '❌ ' + (Array.isArray(data.error) ? data.error.join(', ') : data.error);
            feedback.style.color = '#ef4444';
        } else {
            feedback.textContent = '✅ ' + data.mensaje;
            feedback.style.color = '#22c55e';
            
            // Mostrar paso 2 SOLO si todo ha ido bien
            document.getElementById('paso-1-recuperacion').style.display = 'none';
            document.getElementById('paso-2-recuperacion').style.display = 'block';
        }
    })
    .catch(err => {
        console.error("Error:", err);
        feedback.textContent = '❌ Error de conexión al enviar código';
        feedback.style.color = '#ef4444';
    });
}

function verificarCodigoRecuperacion() {
    const email = document.getElementById('recup-email').value.trim();
    const codigo = document.getElementById('recup-codigo').value.trim();
    const nueva_password = document.getElementById('recup-nueva-password').value;
    const feedback = document.getElementById('recuperacion-feedback');

    if (!codigo || !nueva_password) {
        feedback.textContent = '❌ Rellena todos los campos';
        feedback.style.color = '#ef4444';
        return;
    }

    feedback.textContent = '⏳ Verificando...';
    feedback.style.color = '#64748b';

    fetch(`${API_URL}/verificar-codigo/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, codigo, nueva_password })
    })
    .then(res => res.json())
    .then(data => {
        if (data.error) {
            feedback.textContent = '❌ ' + (Array.isArray(data.error) ? data.error.join(', ') : data.error);
            feedback.style.color = '#ef4444';
        } else {
            feedback.textContent = '✅ ' + data.mensaje;
            feedback.style.color = '#22c55e';
            setTimeout(() => mostrarLoginForm(), 2000);
        }
    })
    .catch(err => {
        console.error("Error:", err);
        feedback.textContent = '❌ Error al verificar código';
        feedback.style.color = '#ef4444';
    });
}