/**
 * Geolocalização gratuita, sem chave: geocodifica endereço em latitude/
 * longitude pelo Nominatim (OpenStreetMap) e mede distância em linha reta
 * entre dois pontos — usado pra ordenar o romaneio por proximidade do CD e
 * pra desenhar o mapa da rota. Não é o trajeto real pelas ruas (isso exigiria
 * uma API de rotas paga) — é só uma aproximação prática, sem custo.
 *
 * O Nominatim pede no máximo 1 requisição por segundo; por isso as chamadas
 * em lote (ver Romaneio) esperam entre uma geocodificação e outra.
 */

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

/** @returns {Promise<{lat:number, lng:number}|null>} null se não achar. */
export async function geocodificarEndereco(endereco) {
  if (!endereco) return null;
  const params = new URLSearchParams({ q: endereco, format: "json", limit: "1", countrycodes: "br" });
  const resp = await fetch(`${NOMINATIM_URL}?${params.toString()}`, { headers: { Accept: "application/json" } });
  if (!resp.ok) throw new Error(`Nominatim: erro ${resp.status}`);
  const achados = await resp.json();
  if (!achados.length) return null;
  return { lat: Number(achados[0].lat), lng: Number(achados[0].lon) };
}

const OSRM_URL = "https://router.project-osrm.org/route/v1/driving/";

/**
 * Rota real pelas ruas entre os pontos, na ordem dada — OSRM, demo pública,
 * gratuita e sem chave (o mesmo serviço que o Leaflet Routing Machine usa por
 * padrão). É só pra desenhar o mapa; pode falhar (fora do ar, sem rota entre
 * os pontos) — quem chama deve cair pra linha reta nesse caso.
 * @param {{lat:number, lng:number}[]} pontos
 * @returns {Promise<[number,number][]|null>} pontos [lat,lng] do traçado, ou null.
 */
export async function rotaPorRuas(pontos) {
  if (!pontos || pontos.length < 2) return null;
  const coordsStr = pontos.map((p) => `${p.lng},${p.lat}`).join(";");
  const resp = await fetch(`${OSRM_URL}${coordsStr}?overview=full&geometries=geojson`);
  if (!resp.ok) throw new Error(`OSRM: erro ${resp.status}`);
  const corpo = await resp.json();
  const coordenadas = corpo?.routes?.[0]?.geometry?.coordinates;
  if (!coordenadas?.length) return null;
  return coordenadas.map(([lng, lat]) => [lat, lng]);
}

/** Distância em linha reta (km) entre dois pontos — fórmula de haversine. */
export function distanciaKm(a, b) {
  if (!a || !b) return Infinity;
  const R = 6371;
  const toRad = (v) => (v * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export const aguardar = (ms) => new Promise((r) => setTimeout(r, ms));
