const token = localStorage.getItem('sofia_token');

const LOGROS_SISTEMA = [
    { id: 'primer_viaje', icono: '✈️', nombre: 'Primer Viaje',   descripcion: 'Añade tu primer viaje' },
    { id: 'explorador',   icono: '🗺️', nombre: 'Explorador',     descripcion: 'Visita 5 países distintos' },
    { id: 'trotamundos',  icono: '🌍', nombre: 'Trotamundos',    descripcion: 'Visita 10 países distintos' },
    { id: 'fotografo',    icono: '📸', nombre: 'Fotógrafo',      descripcion: 'Sube 10 fotos de viajes' },
    { id: 'aventurero',   icono: '🏔️', nombre: 'Aventurero',     descripcion: 'Valida una visita in situ' },
    { id: 'social',       icono: '👥', nombre: 'Social',         descripcion: 'Añade tu primer amigo' },
];

// ── INIT ───────────────────────────────────────────────────────────────────
window.onload = function() {
    if (!token) {
        alert("Sesión no válida. Redirigiendo al login...");
        window.location.href = '/';
        return;
    }
    cargarPerfil();
    iniciarEventos();
};

// ── CARGAR PERFIL ──────────────────────────────────────────────────────────
function cargarPerfil() {
    fetch(`${API_URL}/perfil/`, {
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
    .then(data => {
        const nombre = data.first_name
            ? `${data.first_name} ${data.last_name}`.trim()
            : data.username;

        const iniciales = nombre.split(' ')
            .map(n => n[0]).join('').toUpperCase().slice(0, 2);

        // Sidebar
        document.getElementById('perfil-iniciales').textContent = iniciales;
        document.getElementById('perfil-nombre-corto').textContent = nombre;
        document.getElementById('perfil-email-corto').textContent = data.email || 'Sin email';
        document.getElementById('perfil-codigo').textContent = data.codigo_amigo || '—';

        const fecha = new Date(data.date_joined);
        document.getElementById('perfil-fecha-corto').textContent =
            'Miembro desde ' + fecha.toLocaleDateString('es-ES', { year: 'numeric', month: 'long' });

        // Foto
        if (data.foto_perfil) {
            const foto = document.getElementById('perfil-foto');
            foto.src = data.foto_perfil;
            foto.style.display = 'block';
            document.getElementById('perfil-iniciales').style.display = 'none';
        }

        // Info personal
        document.getElementById('perfil-nombre').textContent = nombre;
        document.getElementById('perfil-email').textContent = data.email || '—';
        document.getElementById('perfil-bio').textContent = data.bio || 'Sin biografía';

        // Campos edición
        document.getElementById('edit-nombre').value = data.first_name || '';
        document.getElementById('edit-apellidos').value = data.last_name || '';
        document.getElementById('edit-bio').value = data.bio || '';

        // Contar logros desbloqueados
        const desbloqueados = data.logros.filter(l => l.desbloqueado).length;
        document.getElementById('stat-logros').textContent = desbloqueados;
        document.getElementById('stat-logros-seccion').textContent = desbloqueados;

        // Renderizar logros
        renderLogros(data.logros);

        // Amigos
        renderAmigos(data.amigos);

        // Stats viajes y países
        fetch(`${API_URL}/map-data/`, {
            headers: { 'Authorization': `Token ${token}` }
        })
        .then(r => r.json())
        .then(mapData => {
            document.getElementById('stat-paises').textContent = mapData.paises?.length || 0;
            document.getElementById('stat-viajes').textContent = mapData.markers?.length || 0;
        })
        .catch(err => console.error("Error cargando map-data:", err));
    })
    .catch(err => console.error("Error cargando perfil:", err));
}

// ── RENDER AMIGOS ──────────────────────────────────────────────────────────
function renderAmigos(amigos) {
    const lista = document.getElementById('amigos-lista');
    if (!amigos || amigos.length === 0) {
        lista.innerHTML = '<p class="text-muted">Aún no tienes amigos añadidos.</p>';
        return;
    }
    lista.innerHTML = amigos.map(a => {
        const iniciales = a.amigo.username.slice(0, 2).toUpperCase();
        const foto = a.amigo.foto_perfil
            ? `<img src="${a.amigo.foto_perfil}" alt="foto">`
            : `<span>${iniciales}</span>`;
        return `
            <div class="amigo-row">
                <div class="amigo-avatar-small">${foto}</div>
                <div class="amigo-datos">
                    <h4>${a.amigo.username}</h4>
                    <p>${a.amigo.codigo_amigo}</p>
                </div>
                <button class="btn-delete" onclick="eliminarAmigo(${a.amigo.id}, this)">🗑️</button>
            </div>
        `;
    }).join('');
}

// ── RENDER LOGROS ──────────────────────────────────────────────────────────
function renderLogros(logrosData) {
    const grid = document.getElementById('logros-grid');
    
    grid.innerHTML = logrosData.map(l => {
        const fechaLogro = l.desbloqueado && l.fecha
            ? new Date(l.fecha).toLocaleDateString('es-ES')
            : null;
        
        return `
            <div class="logro-card ${l.desbloqueado ? 'desbloqueado' : 'bloqueado'}">
                <div class="logro-icono">${l.icono}</div>
                <div class="logro-nombre">${l.nombre}</div>
                <div class="logro-desc">
                    ${l.desbloqueado ? '✅ ' + fechaLogro : l.descripcion}
                </div>
            </div>
        `;
    }).join('');
}

// ── EVENTOS ────────────────────────────────────────────────────────────────
function iniciarEventos() {
    // Copiar código
    document.getElementById('btn-copiar').addEventListener('click', () => {
        const codigo = document.getElementById('perfil-codigo').textContent;
        navigator.clipboard.writeText(codigo).then(() => {
            const fb = document.getElementById('copiar-feedback');
            fb.classList.add('visible');
            setTimeout(() => fb.classList.remove('visible'), 2000);
        });
    });

    // Subir foto
    document.getElementById('input-foto').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('foto_perfil', file);

        fetch(`${API_URL}/perfil/`, {
            method: 'PATCH',
            headers: { 'Authorization': `Token ${token}` },
            body: formData
        })
        .then(res => res.json())
        .then(() => {
            const reader = new FileReader();
            reader.onload = ev => {
                const foto = document.getElementById('perfil-foto');
                foto.src = ev.target.result;
                foto.style.display = 'block';
                document.getElementById('perfil-iniciales').style.display = 'none';
            };
            reader.readAsDataURL(file);
        })
        .catch(err => console.error("Error subiendo foto:", err));
    });
}

// ── EDITAR PERFIL ──────────────────────────────────────────────────────────
function toggleEditar() {
    document.getElementById('info-ver').classList.toggle('oculto-perfil');
    document.getElementById('info-editar').classList.toggle('oculto-perfil');
}

function guardarPerfil() {
    const formData = new FormData();
    formData.append('first_name', document.getElementById('edit-nombre').value.trim());
    formData.append('last_name', document.getElementById('edit-apellidos').value.trim());
    formData.append('bio', document.getElementById('edit-bio').value.trim());

    fetch(`${API_URL}/perfil/`, {
        method: 'PATCH',
        headers: { 'Authorization': `Token ${token}` },
        body: formData
    })
    .then(res => {
        if (!res.ok) throw new Error('Error al guardar');
        return res.json();
    })
    .then(data => {
        console.log("✅ Perfil guardado:", data);
        toggleEditar();
        cargarPerfil();
    })
    .catch(err => {
        console.error("Error guardando perfil:", err);
        alert('❌ Error al guardar los cambios');
    });
}

// ── AMIGOS ─────────────────────────────────────────────────────────────────
function toggleAñadirAmigo() {
    const form = document.getElementById('form-añadir-amigo');
    form.classList.toggle('oculto-perfil');
    if (!form.classList.contains('oculto-perfil')) {
        document.getElementById('input-codigo-amigo').focus();
    }
}

function añadirAmigo() {
    const codigo = document.getElementById('input-codigo-amigo').value.trim();
    const feedback = document.getElementById('amigo-feedback');

    if (!codigo) {
        feedback.textContent = '❌ Introduce un código';
        feedback.style.color = '#ef4444';
        return;
    }

    fetch(`${API_URL}/amigos/añadir/`, {
        method: 'POST',
        headers: {
            'Authorization': `Token ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ codigo_amigo: codigo })
    })
    .then(res => res.json())
    .then(data => {
        if (data.error) {
            feedback.textContent = '❌ ' + data.error;
            feedback.style.color = '#ef4444';
        } else {
            feedback.textContent = '✅ ' + data.mensaje;
            feedback.style.color = '#22c55e';
            document.getElementById('input-codigo-amigo').value = '';
            setTimeout(() => {
                cargarPerfil();
                toggleAñadirAmigo();
            }, 1500);
        }
    })
    .catch(err => {
        console.error("Error añadiendo amigo:", err);
        feedback.textContent = '❌ Error al añadir amigo';
        feedback.style.color = '#ef4444';
    });
}

function eliminarAmigo(amigoId, btn) {
    mostrarConfirmacionPopup(
        '¿Eliminar este amigo?',
        () => {
            fetch(`${API_URL}/amigos/eliminar/${amigoId}/`, {
                method: 'DELETE',
                headers: { 'Authorization': `Token ${token}` }
            })
            .then(res => {
                if (res.ok) {
                    btn.closest('.amigo-row').remove();
                    mostrarCustomPopup(
                        '👤 Amigo eliminado',
                        'El amigo ha sido eliminado correctamente.',
                        'success'
                    );
                } else {
                    return res.json().then(err => {
                        throw new Error(err.error || 'Error al eliminar el amigo');
                    });
                }
            })
            .catch(err => {
                mostrarCustomPopup(
                    '❌ Error',
                    'No se pudo eliminar el amigo.',
                    'error'
                );
            });
        }
    );
}

// ── NAVEGACIÓN ─────────────────────────────────────────────────────────────
function volverAlMapa() {
    window.location.href = '/';
}

// Popup de confirmación reutilizable
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

// Popup de notificación reutilizable
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