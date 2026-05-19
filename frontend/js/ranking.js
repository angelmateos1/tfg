
let rankingGlobal = [];
let friendsIds = new Set();
let modoActual = 'global';
const MEDALLAS = ['🥇', '🥈', '🥉'];

window.onload = function() {
    
    const token = localStorage.getItem('sofia_token');
    if (!token) {
        mostrarCustomPopup("❌ Sesión no válida", "Redirigiendo al login...", "error");
        window.location.href = '/'; 
        return;
    }

    fetch(`${API_URL}/ranking/`, {
        method: 'GET',
        headers: { 
            'Authorization': `Token ${token}`,
            'Content-Type': 'application/json'
        }
    })
    .then(res => {
        if (!res.ok) throw new Error("Error al cargar ranking: " + res.status);
        return res.json();
    })
    .then(data => {
        rankingGlobal = data.ranking;
        friendsIds = new Set(data.friends_ids);

        const yo = data.yo;
        const pos = data.mi_posicion;

        document.getElementById('mi-pos-numero').textContent = '#' + pos;
        document.getElementById('mi-pos-grande').textContent = '#' + pos;
        document.getElementById('mi-name').textContent = yo.username;
        document.getElementById('mi-paises').textContent = yo.paises + ' países';
        document.getElementById('mi-monumentos').textContent = yo.monumentos + ' monumentos';
        document.getElementById('mi-puntos').textContent = yo.puntos + ' puntos';

        const avatarEl = document.getElementById('mi-avatar');
        if (yo.profile_picture) {
            avatarEl.innerHTML = `<img src="${yo.profile_picture}" alt="foto">`;
        } else {
            avatarEl.textContent = yo.username.slice(0, 2).toUpperCase();
        }

        renderRanking(rankingGlobal);
    })
    .catch(err => {
        console.error("Error cargando ranking:", err);
        document.getElementById('ranking-lista').innerHTML = '<p class="text-danger">Error al cargar la clasificación. Inténtalo más tarde.</p>';
    });

};

function renderRanking(lista) {
    const contenedor = document.getElementById('ranking-lista');
    
    if (!lista || lista.length === 0) {
        contenedor.innerHTML = '<p class="text-muted-r">No hay datos disponibles.</p>';
        return;
    }

    contenedor.innerHTML = lista.map((u, index) => {
        const posicion = modoActual === 'global'
            ? index + 1
            : rankingGlobal.findIndex(r => r.id === u.id) + 1;

        const medalla = posicion <= 3
            ? `<span class="medalla">${MEDALLAS[posicion - 1]}</span>`
            : `<span class="pos-numero">#${posicion}</span>`;

        const avatar = u.profile_picture
            ? `<img src="${u.profile_picture}" alt="foto">`
            : `<span>${u.username.slice(0, 2).toUpperCase()}</span>`;

        const esTop = posicion === 1 ? 'fila-top' : '';

        return `
            <div class="ranking-fila ${esTop}">
                <div class="fila-pos">${medalla}</div>
                <div class="fila-avatar">${avatar}</div>
                <div class="fila-datos">
                    <h4>${u.username}</h4>
                    <p>${u.paises} países &nbsp;·&nbsp; ${u.monumentos} monumentos</p>
                </div>
                <div class="fila-puntos">
                    <span class="badge-puntos">${u.puntos} pts</span>
                </div>
            </div>
        `;
    }).join('');
}

function mostrarGlobal() {
    modoActual = 'global';
    document.getElementById('btn-global').classList.add('active');
    document.getElementById('btn-friends').classList.remove('active');
    document.getElementById('ranking-titulo').textContent = 'Tabla de Clasificación';
    renderRanking(rankingGlobal);
}

function mostrarfriends() {
    modoActual = 'friends';
    document.getElementById('btn-friends').classList.add('active');
    document.getElementById('btn-global').classList.remove('active');
    document.getElementById('ranking-titulo').textContent = 'Ranking de amigos';
    
    const solofriends = rankingGlobal.filter(u => friendsIds.has(u.id));
    renderRanking(solofriends);
}

function cerrarVista() {
    window.location.href = '/';
}