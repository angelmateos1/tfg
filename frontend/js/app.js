let map = null;

window.onload = function() {
    const token = localStorage.getItem('sofia_token');
    if (!token) {
        mostrarLogin();
    } else {
        mostrarApp();
    }
};

function mostrarLogin() {
    document.getElementById('loginSection').style.display = 'flex';
    document.getElementById('appSection').style.display = 'none';
}

function mostrarApp() {
    const loginSection = document.getElementById('loginSection');
    const appSection = document.getElementById('appSection');
    
    loginSection.style.display = 'none';
    appSection.style.display = 'flex';

    const mapa = document.getElementById('miMapa');
    
    const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
            const { width, height } = entry.contentRect;
            if (width > 0 && height > 0) {
                observer.disconnect(); 
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
        mostrarApp();
    })
    .catch(err => {
        console.error("Error en el login:", err);
        mostrarCustomPopup('❌ Error en el login', err.message, 'error');
    })
    .finally(() => {
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
    mostrarLogin();
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
            mapWrapper.style.display = 'none';
        })
        .catch(err => console.error("Error cargando vista:", err));
}

function cerrarVista() {
    const contenedor = document.getElementById('contenedorCentral');
    const mapWrapper = document.getElementById('mapWrapper');

    contenedor.classList.add('oculto');
    contenedor.innerHTML = '';
    mapWrapper.style.display = 'flex';

    setTimeout(() => {
        if (map) map.invalidateSize();
    }, 100);
}

function inicializarMapa() {
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

        if (data.paises && data.paises.length > 0) {
            pintarPaisesEnMapa(data.paises);
        }

        setTimeout(() => {
            map.eachLayer(layer => {
                if (layer instanceof L.Marker) {
                    map.removeLayer(layer);
                }
            });

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

function procesarNuevoViaje() {
    const destino = document.getElementById('inputDestino').value.trim();
    const inicio = document.getElementById('inputInicio').value;
    const fin = document.getElementById('inputFin').value;

    if (!destino || !inicio || !fin) return mostrarCustomPopup('❌ Error', 'Rellena todos los campos para añadir un viaje', 'error');
    if (inicio > fin) return mostrarCustomPopup('❌ Error', 'La fecha de fin no puede ser anterior a la de inicio', 'error');

    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(destino)}&addressdetails=1`)
        .then(res => res.json())
        .then(data => {
            if (data.length === 0) return mostrarCustomPopup('❌ Error', 'Lugar no encontrado. Prueba con otro nombre.', 'error');

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
            if (!res) return;
            if (res.ok) {
                mostrarCustomPopup('✅ Éxito', '¡Viaje añadido correctamente!', 'success');
                cerrarVista();
                cargarDatosMapa();
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

    fetch('https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson')
        .then(res => res.json())
        .then(geojson => {
            if (geojsonLayer !== null) {
                map.removeLayer(geojsonLayer);
                geojsonLayer = null;
            }


            geojsonLayer = L.geoJSON(geojson, {

                style: function(feature) {
                    const codigo2 = feature.properties.ISO_A2?.toUpperCase() || '';
                    const codigo3 = feature.properties.ADM0_A3?.toUpperCase() || feature.properties.ISO_A3?.toUpperCase() || '';
                    
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
        mostrarCustomPopup('❌ Error', 'No estás autenticado. Inicia sesión primero.', 'error');
        return;
    }

    window.location.href = '/perfil/';
};

function mostrarRanking() {
    const token = localStorage.getItem('sofia_token');
    
    if (!token) {
        mostrarCustomPopup('❌ Error', 'No estás autenticado. Inicia sesión primero.', 'error');
        return;
    }

    window.location.href = '/ranking/';
};

function mostrarViajes() {
    const token = localStorage.getItem('sofia_token');
    
    if (!token) {
        mostrarCustomPopup('❌ Error', 'No estás autenticado. Inicia sesión primero.', 'error');
        return;
    }

    window.location.href = '/viajes/';
}

window.addEventListener('pageshow', function(event) {
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
            window.location.reload();
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

    const inputs = ['recup-email', 'recup-codigo', 'recup-nueva-password', 'recup-nueva-password2'];
    
    inputs.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.value = '';
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
        if (data.error) {
            feedback.textContent = '❌ ' + (Array.isArray(data.error) ? data.error.join(', ') : data.error);
            feedback.style.color = '#ef4444';
        } else {
            feedback.textContent = '✅ ' + data.mensaje;
            feedback.style.color = '#22c55e';
            
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
    const code = document.getElementById('recup-codigo').value.trim();
    const nueva_password = document.getElementById('recup-nueva-password').value;
    const feedback = document.getElementById('recuperacion-feedback');

    if (!code || !nueva_password) {
        feedback.textContent = '❌ Rellena todos los campos';
        feedback.style.color = '#ef4444';
        return;
    }

    feedback.textContent = '⏳ Verificando...';
    feedback.style.color = '#64748b';

    fetch(`${API_URL}/verificar-codigo/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email,code, nueva_password })
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

function mostrarConfirmacionPopup(mensaje, onConfirm) {
    document.querySelectorAll('.custom-popup.confirm').forEach(p => p.remove());

    const popup = document.createElement('div');
    popup.className = 'custom-popup confirm';

    popup.innerHTML = `
        <div class="popup-content">
            <h4>Confirmar</h4>
            <p>${mensaje}</p>
            <div style="display:flex;gap:10px;justify-content:flex-end;">
                <button class="btn-cancelar-popup">Cancelar</button>
                <button class="btn-confirmar-popup">Confirmar</button>
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

function mostrarCustomPopup(titulo, mensaje, tipo) {
    const popup = document.createElement('div');
    popup.className = `custom-popup ${tipo}`;
    
    popup.innerHTML = `
        <div class="popup-content">
            <h4>${titulo}</h4>
            <p>${mensaje}</p>
            <button onclick="this.parentElement.parentElement.remove()">Aceptar</button>
        </div>
    `;

    document.body.appendChild(popup);

    setTimeout(() => {
        if (document.body.contains(popup)) {
            popup.remove();
        }
    }, 4000);
}