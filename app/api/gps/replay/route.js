// app/api/gps/replay/route.js
//
// Route replay: the GPS path a vehicle took between two times, from Intellicar's
// history API. Intellicar allows only 24 history calls per vehicle per day, so:
//   - a finished trip is fetched from Intellicar once, then served from MongoDB
//   - each vehicle is capped at 20 fresh history calls per day (margin of 4)
//   - the API document does not say whether times are in seconds or milliseconds,
//     so we try milliseconds first, then seconds, and remember which one works
//
// GET /api/gps/replay?vehicleId=<id>&start=<epoch ms>&end=<epoch ms>

import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const MONGO_URL = process.env.MONGO_URL
const DB_NAME = process.env.DB_NAME || 'ckc_fleet'
const IC_BASE = 'https://apiplatform.intellicar.in/api/standard'

const MAX_RANGE_MS = 7 * 86400000 // longest trip we will replay
const DAILY_HISTORY_CAP = 20 // Intellicar allows 24 per vehicle per day
const ONGOING_BUCKET_MS = 10 * 60 * 1000 // trips still in progress are refreshed at most every 10 min
const MAX_POINTS = 1200 // thin out very long trips before sending to the browser

async function getDb() {
  if (!globalThis._gpsMongo) {
    globalThis._gpsMongo = new MongoClient(MONGO_URL).connect().catch((e) => {
      globalThis._gpsMongo = null
      throw e
    })
  }
  const client = await globalThis._gpsMongo
  return client.db(DB_NAME)
}

async function icPost(path, body, timeoutMs = 20000) {
  const res = await fetch(`${IC_BASE}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
    cache: 'no-store',
  })
  let json = null
  try { json = await res.json() } catch {}
  return { status: res.status, json }
}

async function getToken(db, force = false) {
  const col = db.collection('gps_state')
  const saved = await col.findOne({ _id: 'intellicar_token' })
  if (!force && saved?.token && saved.exp - Date.now() > 24 * 3600 * 1000) return saved.token

  const { json } = await icPost('gettoken', {
    username: process.env.INTELLICAR_USERNAME,
    password: process.env.INTELLICAR_PASSWORD,
  })
  if (!json || json.status !== 'SUCCESS') throw new Error('Intellicar login failed')

  const token = json.data.token
  const exp = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).exp * 1000
  await col.updateOne({ _id: 'intellicar_token' }, { $set: { token, exp } }, { upsert: true })
  return token
}

function haversineKm(a, b) {
  const R = 6371
  const toRad = (x) => (x * Math.PI) / 180
  const dLat = toRad(b[0] - a[0])
  const dLng = toRad(b[1] - a[1])
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

// rows from Intellicar -> compact points [lat, lng, time, speed] plus a summary
function buildRoute(rows) {
  const pts = rows
    .map((r) => [Number(r.lat), Number(r.lng), Number(r.commtime), Number(r.speed) || 0])
    .filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]) && Number.isFinite(p[2]) && (p[0] !== 0 || p[1] !== 0))
    .sort((a, b) => a[2] - b[2])

  let dist = 0
  let maxSpeed = 0
  for (let i = 0; i < pts.length; i++) {
    if (i > 0) dist += haversineKm(pts[i - 1], pts[i])
    if (pts[i][3] > maxSpeed) maxSpeed = pts[i][3]
  }
  const step = Math.max(1, Math.ceil(pts.length / MAX_POINTS))
  const slim = pts.filter((_, i) => i % step === 0 || i === pts.length - 1)
  return { points: slim, count: pts.length, distanceKm: Math.round(dist * 10) / 10, maxSpeed: Math.round(maxSpeed) }
}

const fail = (error, status) => NextResponse.json({ error }, { status })

export async function GET(request) {
  const role = request.headers.get('x-user-role')
  const storeId = request.headers.get('x-store-id') || ''
  if (role !== 'admin' && role !== 'store_admin') return fail('Not allowed', 403)

  const url = new URL(request.url)
  const vehicleId = url.searchParams.get('vehicleId')
  let start = Number(url.searchParams.get('start'))
  let end = Number(url.searchParams.get('end'))
  if (!vehicleId || !Number.isFinite(start) || !Number.isFinite(end) || start >= end) return fail('Invalid trip times', 400)
  if (end - start > MAX_RANGE_MS) return fail('Trips longer than 7 days cannot be replayed', 400)

  try {
    const db = await getDb()
    const veh = await db.collection('vehicles').findOne(
      { id: vehicleId },
      { projection: { _id: 0, id: 1, vehicleNumber: 1, trackerId: 1, storeId: 1, assignedLocation: 1 } }
    )
    if (!veh || !veh.trackerId) return fail('This vehicle has no tracker number', 404)
    if (role === 'store_admin' && !(storeId && (veh.storeId === storeId || veh.assignedLocation === storeId))) {
      return fail('Not allowed', 403)
    }

    const now = Date.now()
    const ongoing = end > now - ONGOING_BUCKET_MS
    if (ongoing) end = Math.floor(now / ONGOING_BUCKET_MS) * ONGOING_BUCKET_MS
    start = Math.floor(start / 60000) * 60000
    end = ongoing ? end : Math.ceil(end / 60000) * 60000
    if (end <= start) return NextResponse.json({ points: [], count: 0, distanceKm: 0, maxSpeed: 0 })

    // Saved result? No Intellicar call needed. (Saved empty results are ignored.)
    const cache = db.collection('gps_routes')
    const key = `${veh.trackerId}_${start}_${end}`
    const hit = await cache.findOne({ _id: key })
    if (hit && hit.count > 0) {
      const { _id, expireAt, ...rest } = hit
      return NextResponse.json({ ...rest, cached: true })
    }

    // Daily budget per vehicle: every Intellicar history call is counted
    const state = db.collection('gps_state')
    const day = new Date().toISOString().slice(0, 10)
    const spend = async () => {
      const c = await state.findOneAndUpdate(
        { _id: `history_${veh.trackerId}_${day}` },
        { $inc: { count: 1 } },
        { upsert: true, returnDocument: 'after' }
      )
      return ((c && c.value !== undefined ? c.value : c) || {}).count || 0
    }
    if ((await spend()) > DAILY_HISTORY_CAP) {
      return fail('Route history limit reached for this vehicle today. Try again tomorrow.', 429)
    }

    let token = await getToken(db)
    const known = (await state.findOne({ _id: 'history_unit' }))?.unit // 'ms' or 's', once seen working
    const order = known === 's' ? ['s', 'ms'] : ['ms', 's']
    const makeBody = (t, unit) => ({
      token: t,
      vehicleno: veh.trackerId,
      starttime: unit === 's' ? Math.floor(start / 1000) : start,
      endtime: unit === 's' ? Math.floor(end / 1000) : end,
    })

    let rows = []
    let usedUnit = null
    for (let i = 0; i < order.length; i++) {
      if (i > 0 && (await spend()) > DAILY_HISTORY_CAP) break // the retry also costs a call
      let r = await icPost('getgpshistory', makeBody(token, order[i]))
      if (r.status === 401) {
        token = await getToken(db, true)
        r = await icPost('getgpshistory', makeBody(token, order[i]))
      }
      if (r.status === 429) return fail('Intellicar history limit reached for this vehicle today. Try again tomorrow.', 429)
      if (!r.json || r.json.status !== 'SUCCESS' || !Array.isArray(r.json.data)) {
        return fail((r.json && r.json.msg) || `Intellicar returned an error (HTTP ${r.status})`, 502)
      }
      rows = r.json.data
      if (rows.length > 0) { usedUnit = order[i]; break }
    }
    if (usedUnit && usedUnit !== known) {
      await state.updateOne({ _id: 'history_unit' }, { $set: { unit: usedUnit } }, { upsert: true })
    }

    const route = buildRoute(rows)
    if (route.count === 0) {
      console.log('Route replay: no points', { tracker: veh.trackerId, start, end, tried: order, rowsReturned: rows.length, sample: rows[0] || null })
    }

    const doc = { _id: key, trackerId: veh.trackerId, start, end, ...route, cachedAt: now }
    if (ongoing) {
      // Unfinished trips are only kept for a day
      doc.expireAt = new Date(now + 24 * 3600 * 1000)
      await cache.createIndex({ expireAt: 1 }, { expireAfterSeconds: 0 }).catch(() => {})
    }
    if (route.count > 0) await cache.replaceOne({ _id: key }, doc, { upsert: true })

    const { _id, expireAt, ...out } = doc
    return NextResponse.json({ ...out, cached: false })
  } catch (e) {
    console.error('Route replay failed:', e.message)
    return fail('Could not fetch the route. Please try again.', 500)
  }
}
