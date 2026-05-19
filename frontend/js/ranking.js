// Asegúrate de que esta URL coincida con la configuración de tu servidor Django

// Variables globales para la vista del ranking
let rankingGlobal = [];
let friendsIds = new Set();
let modoActual = 'global';
const MEDALLAS = ['🥇', '🥈', '🥉'];

// Esperamos a que el HTML del ranking cargue completamente antes de ejecutar nada
window.onload = function() {
    
    // 1. Verificamos si el user ha iniciado sesión
    const token = localStorage.getItem('sofia_token');
    if (!token) {
        alert("Sesión no válida. Redirigiendo al login...");
        window.location.href = '/'; 
        return;
    }

    // 2. Solicitamos los datos del ranking a la API
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
        // Guardamos los datos recibidos
        rankingGlobal = data.ranking;
        friendsIds = new Set(data.friends_ids);

        // 3. Pintamos los datos del user actual (Yo)
        const yo = data.yo;
        const pos = data.mi_posicion;

        document.getElementById('mi-pos-numero').textContent = '#' + pos;
        document.getElementById('mi-pos-grande').textContent = '#' + pos;
        document.getElementById('mi-name').textContent = yo.username;
        document.getElementById('mi-paises').textContent = yo.paises + ' países';
        document.getElementById('mi-monumentos').textContent = yo.monumentos + ' monumentos';
        document.getElementById('mi-puntos').textContent = yo.puntos + ' puntos';

        // Gestión del Avatar del user
        const avatarEl = document.getElementById('mi-avatar');
        if (yo.profile_picture) {
            avatarEl.innerHTML = `<img src="${yo.profile_picture}" alt="foto">`;
        } else {
            avatarEl.textContent = yo.username.slice(0, 2).toUpperCase();
        }

        // 4. Renderizamos la lista global por defecto
        renderRanking(rankingGlobal);
    })
    .catch(err => {
        console.error("Error cargando ranking:", err);
        document.getElementById('ranking-lista').innerHTML = '<p class="text-danger">Error al cargar la clasificación. Inténtalo más tarde.</p>';
    });

};

// Función para pintar la lista de users en el HTML
function renderRanking(lista) {
    const contenedor = document.getElementById('ranking-lista');
    
    if (!lista || lista.length === 0) {
        contenedor.innerHTML = '<p class="text-muted-r">No hay datos disponibles.</p>';
        return;
    }

    contenedor.innerHTML = lista.map((u, index) => {
        // Calculamos la posición real dependiendo del modo (Global o friends)
        const posicion = modoActual === 'global'
            ? index + 1
            : rankingGlobal.findIndex(r => r.id === u.id) + 1;

        // Asignamos medallas al top 3
        const medalla = posicion <= 3
            ? `<span class="medalla">${MEDALLAS[posicion - 1]}</span>`
            : `<span class="pos-numero">#${posicion}</span>`;

        // Generamos el avatar de cada user de la lista
        const avatar = u.profile_picture
            ? `<img src="${u.profile_picture}" alt="foto">`
            : `<span>${u.username.slice(0, 2).toUpperCase()}</span>`;

        // Estilo especial para el número 1
        const esTop = posicion === 1 ? 'fila-top' : '';

        // Retornamos el bloque de HTML para este user
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

// Funciones para los botones de filtrado
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
    
    // Filtramos la lista global para mostrar solo a los friends
    const solofriends = rankingGlobal.filter(u => friendsIds.has(u.id));
    renderRanking(solofriends);
}

function cerrarVista() {
    window.location.href = '/';
}