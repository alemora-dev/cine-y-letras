import './style.css';
import L from 'leaflet';

// ============================================
// MAPA LEAFLET Y COORDENADAS BASE
// ============================================

const map = L.map('map', {
  center: [4.5709, -74.2973], // Centro de Colombia
  zoom: 6,
  zoomControl: false
});

// Estilo de mapa base suave y neutro para resaltar marcadores
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; CartoDB',
  subdomains: 'abcd',
  maxZoom: 19
}).addTo(map);

// Coordenadas aproximadas por departamento para simular el "click por región"
const REGION_COORDS = {
  "ANTIOQUIA": [6.2442, -75.5812],
  "CUNDINAMARCA": [4.6097, -74.0817],
  "VALLE DEL CAUCA": [3.4516, -76.5320],
  "BOLIVAR": [10.3910, -75.4794],
  "ATLANTICO": [10.9685, -74.7813],
  "SANTANDER": [7.1193, -73.1227],
  "BOYACA": [5.5353, -73.3678],
  "NARIÑO": [1.2136, -77.2811],
  "MAGDALENA": [11.2408, -74.1990],
  "TOLIMA": [4.4389, -75.2322]
};

let currentMarkers = [];

function renderMapPoints() {
  Object.keys(REGION_COORDS).forEach(regionName => {
    const coords = REGION_COORDS[regionName];

    const icon = L.divIcon({
      className: 'custom-marker',
      iconSize: [12, 12]
    });

    const marker = L.marker(coords, { icon }).addTo(map);
    marker.bindTooltip(regionName, { direction: 'top', offset: [0, -10] });

    marker.on('click', () => {
      // Activar zona
      document.getElementById('active-region').textContent = `Explorando: ${regionName}`;
      map.flyTo(coords, 8, { duration: 1.5 });
      fetchCulturalData(regionName);
    });

    currentMarkers.push(marker);
  });
}

// Inicializar el mapa
renderMapPoints();


// ============================================
// API SODA (MinCultura - Bienes de Interés)
// ============================================
// endpoint ejemplo real de datos abietos: https://www.datos.gov.co/resource/te39-v28f.json
const MINCULTURA_API = "https://www.datos.gov.co/resource/te39-v28f.json";

const gridContainer = document.getElementById('grid');

function renderLoading() {
  gridContainer.innerHTML = `
    <div class="loader">
      <div class="spinner"></div>
      <p>Buscando patrimonio en los archivos Nacionales...</p>
    </div>
  `;
}

function renderEmpty() {
  gridContainer.innerHTML = `
    <div class="empty-state">
      <p>No se encontraron registros de bienes de interés cultural con coordenadas en esta región en la base primaria.</p>
    </div>
  `;
}

async function fetchCulturalData(regionName) {
  renderLoading();

  try {
    // Buscamos por departamento. SoDA usa $where
    const url = `${MINCULTURA_API}?$where=upper(departamento)='${regionName}'&$limit=20`;
    const response = await fetch(url);
    if (!response.ok) throw new Error("Error fetching Mincultura");

    let rawData = await response.json();

    // Si la API SODA X5G8 falla o está inactiva y devuelve 0, probamos un fallback genérico.
    if (rawData.length === 0) {
      renderEmpty();
      return;
    }

    drawGallery(rawData, regionName);

  } catch (err) {
    console.error(err);
    gridContainer.innerHTML = `<div class="empty-state" style="color:red">Error de conexión a la API Nacional.</div>`;
  }
}

// ============================================
// WIKIMEDIA COMMONS API (Enriquecimiento Visual)
// ============================================

/**
 * Busca una imagen libre de derechos en Wikimedia relacionada con el término.
 */
async function fetchWikiImage(searchTerm, fallbackTerm) {
  try {
    const query = encodeURIComponent(`${searchTerm} Colombia`);
    const url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=pageimages&generator=search&gsrsearch=${query}&gsrlimit=1&pithumbsize=600&origin=*`;

    const res = await fetch(url);
    const data = await res.json();

    if (data.query && data.query.pages) {
      const pages = Object.values(data.query.pages);
      if (pages.length > 0 && pages[0].thumbnail) {
        return pages[0].thumbnail.source;
      }
    }

    // Si no encuentra, busca por la región genérica
    if (fallbackTerm) {
      const fallbackQ = encodeURIComponent(`${fallbackTerm} Colombia architecture`);
      const urlFallback = `https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=pageimages&generator=search&gsrsearch=${fallbackQ}&gsrlimit=1&pithumbsize=400&origin=*`;
      const resFb = await fetch(urlFallback);
      const dataFb = await resFb.json();
      if (dataFb.query && dataFb.query.pages) {
        const pages = Object.values(dataFb.query.pages);
        if (pages.length > 0 && pages[0].thumbnail) {
          return pages[0].thumbnail.source;
        }
      }
    }
  } catch (e) {
    console.warn("Wikimedia API Error", e);
  }

  // Imagen por defecto si no hay coincidencias
  return `https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?auto=format&fit=crop&q=80&w=600&h=400`;
}

// ============================================
// RENDERIZADO DE GALERÍA (MASONRY)
// ============================================

async function drawGallery(data, regionName) {
  gridContainer.innerHTML = '<div class="masonry" id="masonry-grid"></div>';
  const masonryContainer = document.getElementById('masonry-grid');

  // Como Wikimedia puede ser lento, renderizamos los cartones y hacemos lazy load asincrono de imágenes

  for (const item of data) {
    // Campos típicos de esa API SODA te39-v28f: nombre_del_lugar, municipio, tipo_lugar
    const title = item.nombre_del_lugar || item.nombre_del_bien || item.nombre || "Espacio Cultural No Identificado";
    const city = item.municipio || "Varios";
    const scope = item.tipo_lugar || item.ambito || item.clasificacion || "Espacio Cultural";

    const card = document.createElement('div');
    card.className = 'cultural-card';
    card.innerHTML = `
      <img src="data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=" 
           alt="${title}" class="card-image loading" id="img-${item.id || Math.random().toString(36).substring(2, 11)}">
      <div class="card-content">
        <div class="card-meta">${city} &bull; ${scope}</div>
        <h3 class="card-title">${title}</h3>
        <p class="card-desc">${item.direcci_n_f_sica || item.direccion || item.acto_administrativo || 'Sin detalles adicionales disponibles.'}</p>
      </div>
    `;

    masonryContainer.appendChild(card);

    // Promesa en paralelo para enriquecer imagen sin bloquear el for loop visual
    const imgId = card.querySelector('img').id;
    enrichImage(title, regionName, imgId);
  }
}

async function enrichImage(specificSearch, regionTerm, imgElementId) {
  // Extraemos palabras clave importantes para buscar en wikipedia, ej "Catedral Primada"
  const cleanSearch = specificSearch.split('-')[0].split(',')[0].trim();

  const imageUrl = await fetchWikiImage(cleanSearch, regionTerm);

  const imgEl = document.getElementById(imgElementId);
  if (imgEl) {
    imgEl.src = imageUrl;
    imgEl.onload = () => imgEl.classList.remove('loading');
  }
}
