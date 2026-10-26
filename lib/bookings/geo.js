// lib/bookings/geo.js
//
// Place search and route estimates, built on OpenStreetMap data. The browser never talks to the map
// services directly. Every request goes through our server, because:
//   - customer addresses are personal data and should not be sent from every staff browser to third parties,
//   - the public services have fair-use rules (an identifying User-Agent, caching, low volume) that only a
//     single server-side client can follow.
//
// Providers (both can be replaced with your own server or a paid plan by setting an environment variable):
//   GEOCODER_URL  place search, Photon-compatible.  Default: https://photon.komoot.io/api/
//   ROUTING_URL   route estimates, OSRM-compatible. Default: https://router.project-osrm.org
//   GEO_CONTACT   an email or website put in the User-Agent so providers can reach you (recommended)
//   GEO_BIAS      "lat,lon" to rank results near your city first, for example 12.9716,77.5946
//
// The public Nominatim service is NOT used: its policy forbids search-as-you-type.

import { GEO, ALLOCATION } from './constants.js'

const MIN = 60 * 1000
export class GeoError extends Error {
  constructor(message, status = 502) { super(message); this.status = status }
}

const env = (k) => (typeof process !== 'undefined' && process.env ? process.env[k] : '') || ''
const base = (url) => String(url).replace(/\/+$/, '')

// ---------- small cache, shared by all requests handled by this server instance ----------
const caches = { search: new Map(), route: new Map() }
function cacheGet(name, key, now) {
  const m = caches[name]
  const hit = m.get(key)
  if (!hit) return undefined
  if (hit.exp < now) { m.delete(key); return undefined }
  return hit.val
}
function cacheSet(name, key, val, ttlMs, now) {
  const m = caches[name]
  if (m.size >= 500) m.delete(m.keys().next().value) // oldest first
  m.set(key, { val, exp: now + ttlMs })
}
export const clearGeoCache = () => { caches.search.clear(); caches.route.clear() }

// ---------- helpers ----------
export const cleanQuery = (q) => String(q ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, GEO.maxQueryLength)

// A point must be a real coordinate inside India's bounding box (this tool is for local trips)
export function validPoint(p) {
  const lat = Number(p?.lat), lng = Number(p?.lng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (lat < GEO.bounds.minLat || lat > GEO.bounds.maxLat || lng < GEO.bounds.minLng || lng > GEO.bounds.maxLng) return null
  return { lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6 }
}

async function getJson(fetchImpl, url, { timeoutMs = GEO.timeoutMs } = {}) {
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), timeoutMs)
  try {
    const contact = env('GEO_CONTACT')
    const res = await fetchImpl(url, {
      signal: ctl.signal,
      headers: { 'User-Agent': `CKC-FleetPulse/1.0 (vehicle booking${contact ? `; ${contact}` : ''})`, Accept: 'application/json' },
    })
    if (res.status === 429) throw new GeoError('The map service is busy. Please try again in a moment.', 503)
    if (!res.ok) throw new GeoError('The map service is not available right now.', 502)
    return await res.json()
  } catch (e) {
    if (e instanceof GeoError) throw e
    throw new GeoError(e?.name === 'AbortError' ? 'The map service took too long to answer.' : 'The map service is not available right now.', 502)
  } finally { clearTimeout(timer) }
}

// ---------- place search ----------
const uniq = (arr) => { const seen = new Set(); return arr.filter(x => { const k = x.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true }) }

export function shapePlace(f) {
  const c = f?.geometry?.coordinates
  const pt = validPoint({ lat: c?.[1], lng: c?.[0] })
  if (!pt) return null
  const p = f.properties || {}
  const cc = String(p.countrycode || '').toUpperCase()
  if (cc && cc !== 'IN') return null
  const street = [p.housenumber, p.street].filter(Boolean).join(' ')
  const parts = uniq([p.name, street, p.district, p.locality, p.city || p.county, p.state, p.postcode].filter(Boolean).map(String))
  if (!parts.length) return null
  const address = parts.join(', ').slice(0, 300)
  const kind = [p.osm_value, p.osm_key].find(x => x && x !== 'yes') || ''
  return {
    label: address, address, lat: pt.lat, lng: pt.lng,
    kind: String(kind).replace(/_/g, ' ').slice(0, 40),
    ref: p.osm_type && p.osm_id ? `${String(p.osm_type)[0].toUpperCase()}${p.osm_id}` : '',
  }
}

export async function searchPlaces(q, { fetch: fetchImpl = globalThis.fetch, now = Date.now() } = {}) {
  const query = cleanQuery(q)
  if (query.length < GEO.minQueryLength) return []
  const key = query.toLowerCase()
  const hit = cacheGet('search', key, now)
  if (hit) return hit

  const url = new URL(env('GEOCODER_URL') || 'https://photon.komoot.io/api/')
  url.searchParams.set('q', query)
  url.searchParams.set('limit', String(GEO.maxResults + 4)) // some results are dropped below
  url.searchParams.set('lang', 'en')
  const bias = env('GEO_BIAS').split(',').map(Number)
  if (bias.length === 2 && bias.every(Number.isFinite)) { url.searchParams.set('lat', String(bias[0])); url.searchParams.set('lon', String(bias[1])) }

  const data = await getJson(fetchImpl, url.toString())
  const seen = new Set()
  const out = []
  for (const f of Array.isArray(data?.features) ? data.features : []) {
    const place = shapePlace(f)
    if (!place || seen.has(place.address.toLowerCase())) continue
    seen.add(place.address.toLowerCase())
    out.push(place)
    if (out.length >= GEO.maxResults) break
  }
  cacheSet('search', key, out, 10 * MIN, now)
  return out
}

// ---------- route estimate ----------
const sigOf = (pts) => pts.map(p => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join('|')
export const routeSignature = (points) => {
  const pts = (points || []).map(validPoint)
  return pts.length >= 2 && pts.every(Boolean) ? sigOf(pts) : ''
}

// Keep the map line light: at most ~250 points
function thin(coords, max = 250) {
  if (coords.length <= max) return coords
  const step = (coords.length - 1) / (max - 1)
  return Array.from({ length: max }, (_, i) => coords[Math.round(i * step)])
}

// points: pickup, any stops in order, drop. Returns null when the provider finds no road route.
export async function routeEstimate(points, { fetch: fetchImpl = globalThis.fetch, now = Date.now(), withGeometry = true } = {}) {
  const pts = (Array.isArray(points) ? points : []).map(validPoint)
  if (pts.length < 2 || pts.length > 7 || !pts.every(Boolean)) throw new GeoError('Choose pickup and drop places from the search list to get a route estimate.', 400)
  const sig = sigOf(pts)
  let r = cacheGet('route', sig, now)
  if (!r) {
    const root = base(env('ROUTING_URL') || 'https://router.project-osrm.org')
    const coords = pts.map(p => `${p.lng},${p.lat}`).join(';')
    const data = await getJson(fetchImpl, `${root}/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=false`, { timeoutMs: GEO.routeTimeoutMs })
    const rt = data?.code === 'Ok' ? data.routes?.[0] : null
    if (!rt || !Number.isFinite(rt.distance) || !Number.isFinite(rt.duration)) { cacheSet('route', sig, { none: true }, 5 * MIN, now); return null }
    r = {
      distanceKm: Math.round(rt.distance / 100) / 10,
      durationMin: Math.max(1, Math.round(rt.duration / 60)),
      geometry: thin((rt.geometry?.coordinates || []).map(c => [c[1], c[0]])),
    }
    cacheSet('route', sig, r, 60 * MIN, now)
  }
  if (r.none) return null
  const stops = Math.max(0, pts.length - 2)
  // Free-flow road time stretched for city traffic, plus a pause at each stop. A planning figure, not a promise.
  const plannedMin = Math.round(r.durationMin * GEO.trafficFactor + stops * ALLOCATION.stopMinutes)
  return {
    distanceKm: r.distanceKm, durationMin: r.durationMin, plannedMin, trafficFactor: GEO.trafficFactor,
    ...(withGeometry ? { geometry: r.geometry } : {}),
  }
}

// What gets saved on the booking. Never includes the map line.
export async function routeForTrip(trip, opts = {}) {
  const chain = [trip?.pickup, ...(trip?.stops || []), trip?.drop]
  const sig = routeSignature(chain)
  if (!sig) return null
  const est = await routeEstimate(chain, { ...opts, withGeometry: false })
  if (!est) return null
  return { sig, distanceKm: est.distanceKm, durationMin: est.durationMin, plannedMin: est.plannedMin, legs: 'outbound', source: 'OpenStreetMap routing estimate' }
}

// ---------- map pictures ----------
// Map tiles are fetched here, not by the browser. OpenStreetMap's tile servers expect an identifying User-Agent
// and refuse anonymous browser traffic from shared hosting, which shows up as a grey map. TILE_URL can point to
// any "{z}/{x}/{y}" tile service (a paid one, or your own) without changing any code.
export async function fetchTile(z, x, y, { fetch: fetchImpl = globalThis.fetch } = {}) {
  const zi = Number(z), xi = Number(x), yi = Number(y)
  const ok = Number.isInteger(zi) && Number.isInteger(xi) && Number.isInteger(yi) && zi >= 0 && zi <= 19 && xi >= 0 && yi >= 0 && xi < 2 ** zi && yi < 2 ** zi
  if (!ok) throw new GeoError('Invalid map tile', 400)
  const url = (env('TILE_URL') || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png').replace('{z}', zi).replace('{x}', xi).replace('{y}', yi)
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), GEO.timeoutMs)
  try {
    const contact = env('GEO_CONTACT')
    const res = await fetchImpl(url, { signal: ctl.signal, headers: { 'User-Agent': `CKC-FleetPulse/1.0 (vehicle booking${contact ? `; ${contact}` : ''})`, Accept: 'image/png,image/*' } })
    if (!res.ok) throw new GeoError('The map pictures are not available right now.', 502)
    const type = res.headers?.get?.('content-type') || 'image/png'
    if (!/^image\//.test(type)) throw new GeoError('The map pictures are not available right now.', 502)
    return { body: Buffer.from(await res.arrayBuffer()), type }
  } catch (e) {
    if (e instanceof GeoError) throw e
    throw new GeoError('The map pictures are not available right now.', 502)
  } finally { clearTimeout(timer) }
}
