// Asegúrate de que esta URL coincida con la configuración de tu servidor Django

// Variables globales para la vista del ranking
let rankingGlobal = [];
let amigosIds = new Set();
let modoActual = 'global';
const MEDALLAS = ['🥇', '🥈', '🥉'];

// Esperamos a que el HTML del ranking cargue completamente antes de ejecutar nada
window.onload = function() {
    
    // 1. Verificamos si el usuario ha iniciado sesión
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
        amigosIds = new Set(data.amigos_ids);

        // 3. Pintamos los datos del usuario actual (Yo)
        const yo = data.yo;
        const pos = data.mi_posicion;

        document.getElementById('mi-pos-numero').textContent = '#' + pos;
        document.getElementById('mi-pos-grande').textContent = '#' + pos;
        document.getElementById('mi-nombre').textContent = yo.username;
        document.getElementById('mi-paises').textContent = yo.paises + ' países';
        document.getElementById('mi-monumentos').textContent = yo.monumentos + ' monumentos';
        document.getElementById('mi-puntos').textContent = yo.puntos + ' puntos';

        // Gestión del Avatar del usuario
        const avatarEl = document.getElementById('mi-avatar');
        if (yo.foto_perfil) {
            avatarEl.innerHTML = `<img src="${yo.foto_perfil}" alt="foto">`;
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

// Función para pintar la lista de usuarios en el HTML
function renderRanking(lista) {
    const contenedor = document.getElementById('ranking-lista');
    
    if (!lista || lista.length === 0) {
        contenedor.innerHTML = '<p class="text-muted-r">No hay datos disponibles.</p>';
        return;
    }

    contenedor.innerHTML = lista.map((u, index) => {
        // Calculamos la posición real dependiendo del modo (Global o Amigos)
        const posicion = modoActual === 'global'
            ? index + 1
            : rankingGlobal.findIndex(r => r.id === u.id) + 1;

        // Asignamos medallas al top 3
        const medalla = posicion <= 3
            ? `<span class="medalla">${MEDALLAS[posicion - 1]}</span>`
            : `<span class="pos-numero">#${posicion}</span>`;

        // Generamos el avatar de cada usuario de la lista
        const avatar = u.foto_perfil
            ? `<img src="${u.foto_perfil}" alt="foto">`
            : `<span>${u.username.slice(0, 2).toUpperCase()}</span>`;

        // Estilo especial para el número 1
        const esTop = posicion === 1 ? 'fila-top' : '';

        // Retornamos el bloque de HTML para este usuario
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
    document.getElementById('btn-amigos').classList.remove('active');
    document.getElementById('ranking-titulo').textContent = 'Tabla de Clasificación';
    renderRanking(rankingGlobal);
}

function mostrarAmigos() {
    modoActual = 'amigos';
    document.getElementById('btn-amigos').classList.add('active');
    document.getElementById('btn-global').classList.remove('active');
    document.getElementById('ranking-titulo').textContent = 'Ranking de Amigos';
    
    // Filtramos la lista global para mostrar solo a los amigos
    const soloAmigos = rankingGlobal.filter(u => amigosIds.has(u.id));
    renderRanking(soloAmigos);
}

function cerrarVista() {
    window.location.href = '/';
}