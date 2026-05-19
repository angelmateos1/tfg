const token = localStorage.getItem('sofia_token');

const LOGROS_SISTEMA = [
    { id: 'primer_viaje',icon: '✈️', name: 'Primer Viaje',  description: 'Añade tu primer viaje' },
    { id: 'explorador',  icon: '🗺️', name: 'Explorador',    description: 'Visit 5 países distintos' },
    { id: 'trotamundos', icon: '🌍', name: 'Trotamundos',   description: 'Visit 10 países distintos' },
    { id: 'fotografo',   icon: '📸', name: 'Fotógrafo',     description: 'Sube 10 fotos de viajes' },
    { id: 'aventurero',  icon: '🏔️', name: 'Aventurero',    description: 'Valida una Visit in situ' },
    { id: 'social',      icon: '👥', name: 'Social',        description: 'Añade tu primer Amigo' },
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
        const name = data.first_name
            ? `${data.first_name} ${data.last_name}`.trim()
            : data.username;

        const iniciales = name.split(' ')
            .map(n => n[0]).join('').toUpperCase().slice(0, 2);

        // Sidebar
        document.getElementById('perfil-iniciales').textContent = iniciales;
        document.getElementById('perfil-name-corto').textContent = name;
        document.getElementById('perfil-email-corto').textContent = data.email || 'Sin email';
        document.getElementById('perfil-codigo').textContent = data.friendship_code || '—';

        const date = new Date(data.date_joined);
        document.getElementById('perfil-date-corto').textContent =
            'Miembro desde ' + date.toLocaleDateString('es-ES', { year: 'numeric', month: 'long' });

        // Foto
        if (data.profile_picture) {
            const foto = document.getElementById('perfil-foto');
            foto.src = data.profile_picture;
            foto.style.display = 'block';
            document.getElementById('perfil-iniciales').style.display = 'none';
        }

        // Info personal
        document.getElementById('perfil-name').textContent = name;
        document.getElementById('perfil-email').textContent = data.email || '—';
        document.getElementById('perfil-bio').textContent = data.bio || 'Sin biografía';

        // Campos edición
        document.getElementById('edit-name').value = data.first_name || '';
        document.getElementById('edit-apellidos').value = data.last_name || '';
        document.getElementById('edit-bio').value = data.bio || '';

        const desbloqueados = data.achievements.filter(l => l.unlocked).length;
        document.getElementById('stat-logros').textContent = desbloqueados;
        document.getElementById('stat-logros-seccion').textContent = desbloqueados;

        renderLogros(data.achievements);

        renderFriends(data.friends);

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

// ── RENDER FRIENDS ──────────────────────────────────────────────────────────
function renderFriends(friends) {
    const lista = document.getElementById('friends-lista');
    if (!friends || friends.length === 0) {
        lista.innerHTML = '<p class="text-muted">Aún no tienes amigos añadidos.</p>';
        return;
    }
    lista.innerHTML = friends.map(a => {
        const iniciales = a.friend.username.slice(0, 2).toUpperCase();
        const foto = a.friend.profile_picture
            ? `<img src="${a.friend.profile_picture}" alt="foto">`
            : `<span>${iniciales}</span>`;
        return `
            <div class="friend-row">
                <div class="friend-avatar-small">${foto}</div>
                <div class="friend-datos">
                    <h4>${a.friend.username}</h4>
                    <p>${a.friend.friendship_code}</p>
                </div>
                <button class="btn-delete" onclick="eliminarfriend(${a.friend.id}, this)">🗑️</button>
            </div>
        `;
    }).join('');
}

// ── RENDER LOGROS ──────────────────────────────────────────────────────────
function renderLogros(logrosData) {
    const grid = document.getElementById('logros-grid');
    
    grid.innerHTML =logrosData.map(l => {
        const dateLogro = l.unlocked && l.date
            ? new Date(l.date).toLocaleDateString('es-ES')
            : null;
        
        return `
            <div class="logro-card ${l.unlocked ? 'desbloqueado' : 'bloqueado'}">
                <div class="logro-icono">${l.icon}</div>
                <div class="logro-name">${l.name}</div>
                <div class="logro-desc">
                    ${l.unlocked ? '✅ ' + dateLogro : l.description}
                </div>
            </div>
        `;
    }).join('');
}

function iniciarEventos() {
    document.getElementById('btn-copiar').addEventListener('click', () => {
        const code = document.getElementById('perfil-codigo').textContent;
        navigator.clipboard.writeText(code).then(() => {
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
        formData.append('profile_picture', file);

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
    formData.append('first_name', document.getElementById('edit-name').value.trim());
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
        toggleEditar();
        cargarPerfil();
    })
    .catch(err => {
        alert('❌ Error al guardar los cambios');
    });
}

// ── friendS ─────────────────────────────────────────────────────────────────
function toggleAñadirfriend() {
    const form = document.getElementById('form-añadir-friend');
    form.classList.toggle('oculto-perfil');
    if (!form.classList.contains('oculto-perfil')) {
        document.getElementById('input-codigo-friend').focus();
    }
}

function añadirfriend() {
    constcode = document.getElementById('input-codigo-friend').value.trim();
    const feedback = document.getElementById('friend-feedback');

    if (!codigo) {
        feedback.textContent = '❌ Introduce un código';
        feedback.style.color = '#ef4444';
        return;
    }

    fetch(`${API_URL}/friends/añadir/`, {
        method: 'POST',
        headers: {
            'Authorization': `Token ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ friendship_code:code })
    })
    .then(res => res.json())
    .then(data => {
        if (data.error) {
            feedback.textContent = '❌ ' + data.error;
            feedback.style.color = '#ef4444';
        } else {
            feedback.textContent = '✅ ' + data.mensaje;
            feedback.style.color = '#22c55e';
            document.getElementById('input-codigo-friend').value = '';
            setTimeout(() => {
                cargarPerfil();
                toggleAñadirfriend();
            }, 1500);
        }
    })
    .catch(err => {
        console.error("Error añadiendo friend:", err);
        feedback.textContent = '❌ Error al añadir friend';
        feedback.style.color = '#ef4444';
    });
}

function eliminarfriend(friendId, btn) {
    mostrarConfirmacionPopup(
        '¿Eliminar este friend?',
        () => {
            fetch(`${API_URL}/friends/eliminar/${friendId}/`, {
                method: 'DELETE',
                headers: { 'Authorization': `Token ${token}` }
            })
            .then(res => {
                if (res.ok) {
                    btn.closest('.friend-row').remove();
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