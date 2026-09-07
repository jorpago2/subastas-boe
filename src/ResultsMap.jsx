import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const fixMojibake = value => String(value ?? '').replace(/[ŕŔ]/g, 'a').replace(/[čČ]/g, 'e').replace(/[ńŃňŇ]/g, 'n');
const key = value => fixMojibake(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').replace(/[’'´`]/g, '').replace(/[^a-z0-9]+/g, '');
const aliases = new Map([
  [key('Alcira'), key('Alzira')], [key('Játiva'), key('Xàtiva')], [key('Puerto de Sagunto'), key('Sagunto')],
  [key('Puzol'), key('Puçol')], [key('Playa de Puzol'), key('Puçol')], [key('Torrente'), key('Torrent')],
  [key('Villamarchante'), key('Vilamarxant')], [key('Moixent-Mogente'), key('Mogente')],
  [key('Montroi-Montroy'), key('Montroi')], [key('Alberique'), key('Alberic')], [key('Benaguacil'), key('Benaguasil')],
  [key('Alfahuir'), key('Alfauir')], [key('Almisera'), key('Almiserà')], [key('Olleria'), key("l'Olleria")],
  [key('Polinya del Xuquer'), key('Polinyà de Xúquer')], [key('Pobla de Farnals'), key('la Pobla de Farnals')],
  [key('Pobla de Vallbona'), key('la Pobla de Vallbona')], [key('Pobla Llarga'), key('la Pobla Llarga')],
  [key('Real de Gandia'), key('el Real de Gandia')], [key('Ribarroja'), key('Riba-roja de Túria')],
  [key('Guadasequies'), key('Guadasséquies')], [key('Algimia de Alfara'), key("Algímia d'Alfara")],
  [key("Alcudia (L')"), key("l'Alcúdia")], [key('Algar Palancia'), key('Algar de Palancia')],
  [key('Llombay'), key('Llombai')], [key('Daimuz'), key('Daimús')], [key('Ribarroja del Turia'), key('Riba-roja de Túria')],
  [key('Riba-roja del Túria'), key('Riba-roja de Túria')], [key('Culelra'), key('Cullera')],
  [key('Canet de Berenguer'), key("Canet d'En Berenguer")], [key('Benicull del Xuquer'), key('Benicull de Xúquer')],
  [key('Alquería de la Condesa'), key("l'Alqueria de la Comtessa")], [key('Onteniente'), key('Ontinyent')],
  [key('Almacera'), key('Almàssera')], [key('Motsserrat'), key('Montserrat')], [key('Puebla de Farnals'), key('la Pobla de Farnals')],
  [key('Almusafes'), key('Almussafes')], [key('Rafelbuñol'), key('Rafelbunyol')], [key('El Puig'), key('el Puig de Santa Maria')],
  [key('El Puig de Sta.Maria'), key('el Puig de Santa Maria')], [key('El Ponton'), key('Requena')],
  [key('Partida Albotaina. Algemesi'), key('Algemesí')], [key('Xeraco(Gandia)'), key('Xeraco')],
  [key('Grao de Gandia'), key('Gandia')], [key('Playa de Gandia'), key('Gandia')], [key('El Perelló'), key('Sueca')],
  [key('Mareny'), key('Sueca')], [key('Mareny de Barraquetes (Sueca)'), key('Sueca')], [key('El Pouet (Sueca)'), key('Sueca')],
  [key('Sueca (El Perello)'), key('Sueca')], [key('Benicalap'), key('València')], [key('Benifareig'), key('València')],
  [key('Benimamet'), key('València')], [key('Benimamet-Beniferri'), key('València')], [key('Nazaret'), key('València')],
  [key('El Saler-Valencia'), key('València')],
  [key('Castellar'), key('València')], [key('Massarrojos'), key('València')], [key('Moncada'), key('Moncada')],
  [key('Almardá (Sagunto)'), key('Sagunto')], [key('Sagunto-Port'), key('Sagunto')], [key('Puerti de Sagunto'), key('Sagunto')],
  [key('Sagunt/Sagunto'), key('Sagunto')], [key('Villanueva de Castellón/Castelló de la Ribera'), key('Villanueva de Castellón')],
  [key('Rotgla y Corbera'), key('Rotglà i Corberà')], [key('Real de Montroi'), key('Real')], [key('Aldaida'), key('Aldaia')],
]);

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[character]));

function municipalityFor(row, lookup) {
  const matches = new Map();
  for (const town of row.towns || []) {
    const townKey = key(town);
    const direct = lookup.get(townKey) || lookup.get(aliases.get(townKey));
    if (!direct) return null;
    matches.set(direct.id, direct);
  }
  return matches.size === 1 ? [...matches.values()][0] : null;
}

export default function ResultsMap({ rows, onSelect }) {
  const rootRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const [municipalities, setMunicipalities] = useState(null);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${import.meta.env.BASE_URL}data/municipalities-valencia.json`, { signal: controller.signal })
      .then(response => { if (!response.ok) throw new Error('No se pudieron cargar las coordenadas municipales.'); return response.json(); })
      .then(data => setMunicipalities(Array.isArray(data) ? data : []))
      .catch(error => { if (error.name !== 'AbortError') setLoadError(error.message); });
    return () => controller.abort();
  }, []);

  const lookup = useMemo(() => new Map((municipalities || []).flatMap(municipality => {
    const names = String(municipality.nombre || '').split(/[\/()]/).map(key).filter(Boolean);
    return names.map(name => [name, municipality]);
  })), [municipalities]);

  const groups = useMemo(() => {
    if (!municipalities) return [];
    const grouped = new Map();
    for (const row of rows) {
      const municipality = municipalityFor(row, lookup);
      if (!municipality) continue;
      const group = grouped.get(municipality.id) || { municipality, rows: [] };
      group.rows.push(row);
      grouped.set(municipality.id, group);
    }
    return [...grouped.values()];
  }, [lookup, municipalities, rows]);

  useEffect(() => {
    if (!rootRef.current || mapRef.current) return undefined;
    const map = L.map(rootRef.current, { scrollWheelZoom: false });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap contributors' }).addTo(map);
    const layer = L.layerGroup().addTo(map);
    mapRef.current = map;
    layerRef.current = layer;
    window.setTimeout(() => map.invalidateSize(), 0);
    return () => { map.remove(); mapRef.current = null; layerRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer || !municipalities) return;
    layer.clearLayers();
    const bounds = [];
    for (const group of groups) {
      const { lat, lon, nombre } = group.municipality;
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      bounds.push([lat, lon]);
      const count = group.rows.length;
      const preview = group.rows.slice(0, 8).map(row => `<button type="button" class="results-map-popup-link" data-auction-id="${escapeHtml(row.id)}">${escapeHtml(row.description || row.id)}</button>`).join('');
      const more = count > 8 ? `<p class="results-map-popup-more">+ ${count - 8} inmuebles; consulta la lista.</p>` : '';
      const popup = `<strong>${escapeHtml(nombre)}</strong><p>${count} ${count === 1 ? 'inmueble filtrado' : 'inmuebles filtrados'}</p><div class="results-map-popup-list">${preview}</div>${more}`;
      const marker = L.marker([lat, lon], {
        title: `${nombre}: ${count} ${count === 1 ? 'inmueble' : 'inmuebles'}`,
        icon: L.divIcon({ className: 'results-map-marker', html: `<span>${count}</span>`, iconSize: [34, 34], iconAnchor: [17, 17], popupAnchor: [0, -18] }),
      }).bindPopup(popup, { maxWidth: 340 });
      marker.on('popupopen', event => event.popup.getElement()?.querySelectorAll('[data-auction-id]').forEach(button => button.addEventListener('click', () => {
        const row = group.rows.find(item => item.id === button.dataset.auctionId);
        if (row) onSelect(row);
      })));
      marker.addTo(layer);
    }
    if (bounds.length === 1) map.setView(bounds[0], 13);
    else if (bounds.length > 1) map.fitBounds(bounds, { padding: [28, 28], maxZoom: 12 });
    else map.setView([39.4699, -0.3763], 9);
    window.setTimeout(() => map.invalidateSize(), 0);
  }, [groups, municipalities, onSelect]);

  const mappedRows = groups.reduce((total, group) => total + group.rows.length, 0);
  const missingRows = rows.length - mappedRows;
  return <section className="results-map" aria-labelledby="results-map-title">
    <div className="results-map-heading"><div><p className="eyebrow">MAPA DE RESULTADOS</p><h2 id="results-map-title">Subastas por municipio</h2><p>{rows.length} {rows.length === 1 ? 'inmueble' : 'inmuebles'} · {groups.length} {groups.length === 1 ? 'municipio' : 'municipios'} con ubicación</p></div><p className="results-map-note">Cada punto representa el centro de un municipio, no la posición del inmueble. Las fichas muestran una búsqueda por dirección cuando se puede identificar.</p></div>
    <div ref={rootRef} className="results-map-canvas" role="application" aria-label="Mapa de inmuebles filtrados" />
    {loadError && <p className="results-map-status">{loadError}</p>}
    {!loadError && !municipalities && <p className="results-map-status">Cargando ubicaciones municipales…</p>}
    {missingRows > 0 && <p className="results-map-status">{missingRows} {missingRows === 1 ? 'inmueble no tiene' : 'inmuebles no tienen'} un municipio reconocible y no se muestran en el mapa.</p>}
    <p className="results-map-attribution">Coordenadas a nivel municipal · mapa © OpenStreetMap contributors</p>
  </section>;
}
