// --- 1. Definición de URLs y Áreas Geográficas ---

const VP_URL = "https://gtfsrt.renfe.com/vehicle_positions.json";
const TU_URL = "https://gtfsrt.renfe.com/trip_updates.json";

// Coordenadas aproximadas del rectángulo delimitador (Bounding Box) de la C. Valenciana
// Se utiliza para filtrar los trenes relevantes.
const VALENCIA_BBOX = {
    minLat: 37.95, // Sur (Alicante)
    maxLat: 40.80, // Norte (Castellón)
    minLon: -1.80, // Oeste
    maxLon: 0.70   // Este
};

// Almacena los datos combinados de los trenes: { tripId: { lat, lon, delay, marker } }
let trenesCV = {};
// Grupo de capas de Leaflet para gestionar todos los marcadores
let trainMarkersGroup = L.layerGroup();

// --- 2. Inicialización del Mapa ---

const map = L.map('mapid').setView([39.4699, -0.3774], 10); // Centrado en Valencia
trainMarkersGroup.addTo(map);

// Añadir la capa base de OpenStreetMap
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: 'Datos de mapa &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

// Icono personalizado para los trenes
const trainIcon = L.icon({
    iconUrl: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#E30013" width="24px" height="24px"><path d="M0 0h24v24H0z" fill="none"/><path d="M12 2c-4.42 0-8 3.58-8 8v8h16v-8c0-4.42-3.58-8-8-8zm-1 16H8v-2h3v2zm4 0h-3v-2h3v2zm3-4H6v-2h12v2zm-1-4H7V8h10v2z"/></svg>'),
    iconSize: [24, 24], 
    iconAnchor: [12, 12], 
    popupAnchor: [0, -12] 
});

// --- 3. Funciones de Procesamiento de Datos ---

/**
 * Filtra los trenes para asegurar que están dentro del Bounding Box de la C. Valenciana.
 * @param {number} lat - Latitud del tren.
 * @param {number} lon - Longitud del tren.
 * @returns {boolean} - Verdadero si está dentro del área.
 */
function isValenciaTrain(lat, lon) {
    return lat >= VALENCIA_BBOX.minLat && 
           lat <= VALENCIA_BBOX.maxLat &&
           lon >= VALENCIA_BBOX.minLon &&
           lon <= VALENCIA_BBOX.maxLon;
}

/**
 * Procesa los datos de trip_updates.json y actualiza el objeto trenesCV con los retrasos.
 * @param {Array} entities - El array 'entity' de trip_updates.json.
 */
function processTripUpdates(entities) {
    entities.forEach(entity => {
        const tripUpdate = entity.tripUpdate;
        const tripId = tripUpdate.trip.tripId;
        const delay = tripUpdate.delay || 0; // Retraso en segundos

        if (trenesCV[tripId]) {
            trenesCV[tripId].delay = delay;
        } else {
            // Si el tripId no existe en vehicle_positions, lo ignoramos por ahora
            // porque no tenemos su ubicación.
        }
    });
}

/**
 * Procesa los datos de vehicle_positions.json, filtra por C. Valenciana y actualiza los marcadores.
 * @param {Array} entities - El array 'entity' de vehicle_positions.json.
 */
function processVehiclePositions(entities) {
    let activeTripIds = new Set();

    entities.forEach(entity => {
        const vehicle = entity.vehicle;
        const tripId = vehicle.trip.tripId;
        const lat = vehicle.position.latitude;
        const lon = vehicle.position.longitude;
        
        // 1. Filtrado geográfico
        if (!isValenciaTrain(lat, lon)) {
            return;
        }

        activeTripIds.add(tripId);
        
        // 2. Almacenar/Actualizar datos y posición
        if (!trenesCV[tripId]) {
            // Nuevo tren detectado
            trenesCV[tripId] = { lat, lon, delay: 0, marker: null };
            updateMarker(tripId);
        } else {
            // Tren existente, actualizar posición
            trenesCV[tripId].lat = lat;
            trenesCV[tripId].lon = lon;
            updateMarker(tripId);
        }
    });

    // 3. Limpiar marcadores de trenes que ya no están en los datos (se han ido o han terminado)
    Object.keys(trenesCV).forEach(tripId => {
        if (!activeTripIds.has(tripId)) {
            if (trenesCV[tripId].marker) {
                trainMarkersGroup.removeLayer(trenesCV[tripId].marker);
            }
            delete trenesCV[tripId];
        }
    });
}

/**
 * Crea o actualiza un marcador de Leaflet en el mapa.
 * @param {string} tripId - El ID del viaje.
 */
function updateMarker(tripId) {
    const data = trenesCV[tripId];
    
    // Convertir segundos de retraso a un formato legible
    const delayMinutes = Math.round(data.delay / 60);
    const delayText = delayMinutes > 0 ? `<span class="delay-bad">+${delayMinutes} min de retraso</span>` : `<span class="delay-good">A tiempo</span>`;

    const popupContent = `
        <strong>ID Viaje:</strong> ${tripId}<br>
        <strong>Retraso:</strong> ${delayText}
    `;

    if (data.marker) {
        // Marcador existente: mover y actualizar popup
        data.marker.setLatLng([data.lat, data.lon]);
        data.marker.bindPopup(popupContent, {closeButton: false, autoClose: false});
    } else {
        // Nuevo marcador: crear y añadir al mapa
        const marker = L.marker([data.lat, data.lon], { icon: trainIcon })
            .bindPopup(popupContent, {closeButton: false, autoClose: false});

        data.marker = marker;
        trainMarkersGroup.addLayer(marker);
    }
}

// --- 4. Función de Consulta y Actualización Principal ---

async function fetchAndUpdateData() {
    console.log("Actualizando datos...");
    
    try {
        // 1. Obtener Retrasos (Trip Updates)
        const tu_response = await fetch(TU_URL);
        const tu_data = await tu_response.json();
        processTripUpdates(tu_data.entity);

        // 2. Obtener Posiciones (Vehicle Positions)
        const vp_response = await fetch(VP_URL);
        const vp_data = await vp_response.json();
        processVehiclePositions(vp_data.entity);
        
        console.log(`Datos actualizados. Trenes visibles: ${Object.keys(trenesCV).length}`);

    } catch (error) {
        console.error("Error al obtener o procesar datos de Renfe GTFS-RT:", error);
    }
}

// --- 5. Ejecución ---

// Ejecutar la actualización inmediatamente al cargar
fetchAndUpdateData();

// Establecer un intervalo para actualizar los datos cada 15 segundos (15000 ms)
setInterval(fetchAndUpdateData, 15000);