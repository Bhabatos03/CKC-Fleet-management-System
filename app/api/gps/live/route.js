// app/api/gps/live/route.js
//
// Live vehicle positions from Intellicar, cached in MongoDB.
// The browser only ever talks to this route; this route talks to Intellicar.
//
// Env vars (server only, never in browser code or GitHub):
//   INTELLICAR_USERNAME, INTELLICAR_PASSWORD, MONGO_URL, DB_NAME

import { NextResponse, after } from 'next/server'
import { MongoClient } from 'mongodb'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const MONGO_URL = process.env.MONGO_URL
const DB_NAME = process.env.DB_NAME || 'ckc_fleet'
const IC_BASE = 'https://apiplatform.intellicar.in/api/standard'

// Intellicar limits: 720 latest-position calls per vehicle per day, max 3 calls
// per second, at least 400 ms between calls. One refresh per vehicle every
// 150 s is about 576 calls/day, which stays inside the limit.
const REFRESH_MS = 150 * 1000
const CALL_GAP_MS = 500
const LOCK_MS = 90 * 1000

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

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

async function icPost(path, body) {
  const res = await fetch(`${IC_BASE}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
    cache: 'no-store',
  })
  let json = null
  try { json = await res.json() } catch {}
  return { status: res.status, json }
}

// Token is stored in MongoDB so every server instance shares one login.
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

// Only one refresh sweep at a time across all users and server instances.
async function acquireLock(db) {
  const now = Date.now()
  try {
    await db.collection('gps_state').findOneAndUpdate(
      { _id: 'refresh_lock', until: { $lt: now } },
      { $set: { until: now + LOCK_MS } },
      { upsert: true }
    )
    return true
  } catch (e) {
    if (e.code === 11000) return false // lock already held
    throw e
  }
}

async function refreshStale(db, vehicles) {
  const positions = db.collection('gps_positions')
  const ids = vehicles.map((v) => v.trackerId)
  const existing = await positions.find({ _id: { $in: ids } }).toArray()
  const fetchedAt = Object.fromEntries(existing.map((p) => [p._id, p.fetchedAt || 0]))

  const now = Date.now()
  const stale = ids
    .filter((id) => now - (fetchedAt[id] || 0) > REFRESH_MS)
    .sort((a, b) => (fetchedAt[a] || 0) - (fetchedAt[b] || 0)) // oldest first
  if (!stale.length) return
  if (!(await acquireLock(db))) return

  try {
    let token = await getToken(db)
    for (const id of stale) {
      try {
        let r = await icPost('getlastgpsstatus', { token, vehicleno: id })
        if (r.status === 401) {
          token = await getToken(db, true)
          r = await icPost('getlastgpsstatus', { token, vehicleno: id })
        }
        const d = r.json && r.json.status === 'SUCCESS' ? r.json.data : null
        // Keep the last known position if this call fails; only record the error.
        const set = d
          ? { lat: d.lat, lng: d.lng, speed: d.speed, heading: d.heading, ignition: d.ignstatus, commtime: d.commtime, error: null, fetchedAt: Date.now() }
          : { error: (r.json && r.json.msg) || `HTTP ${r.status}`, fetchedAt: Date.now() }
        await positions.updateOne({ _id: id }, { $set: set }, { upsert: true })
      } catch {
        await positions.updateOne({ _id: id }, { $set: { error: 'Request failed', fetchedAt: Date.now() } }, { upsert: true })
      }
      await sleep(CALL_GAP_MS)
    }
  } finally {
    await db.collection('gps_state').updateOne({ _id: 'refresh_lock' }, { $set: { until: 0 } })
  }
}

export async function GET(request) {
  const role = request.headers.get('x-user-role')
  const storeId = request.headers.get('x-store-id') || ''
  if (role !== 'admin' && role !== 'store_admin') {
    return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
  }

  const db = await getDb()
  let vehicles = await db
    .collection('vehicles')
    .find(
      { trackerId: { $exists: true, $nin: ['', null] } },
      { projection: { _id: 0, id: 1, vehicleNumber: 1, trackerId: 1, storeId: 1, assignedLocation: 1 } }
    )
    .toArray()

  // Store admins only see their own store's vehicles. If the vehicle has no
  // matching store field they see nothing, never everything.
  if (role === 'store_admin') {
    vehicles = vehicles.filter((v) => storeId && (v.storeId === storeId || v.assignedLocation === storeId))
  }

  const positions = await db
    .collection('gps_positions')
    .find({ _id: { $in: vehicles.map((v) => v.trackerId) } })
    .toArray()
  const byId = Object.fromEntries(positions.map((p) => [p._id, p]))

  // Respond immediately with cached data, then refresh stale vehicles.
  after(() => refreshStale(db, vehicles).catch((e) => console.error('GPS refresh failed:', e.message)))

  return NextResponse.json(
    vehicles.map((v) => {
      const p = byId[v.trackerId] || {}
      return {
        vehicleId: v.id,
        vehicleNumber: v.vehicleNumber,
        trackerId: v.trackerId,
        lat: p.lat ?? null,
        lng: p.lng ?? null,
        speed: p.speed ?? null,
        heading: p.heading ?? null,
        ignition: p.ignition ?? null,
        commtime: p.commtime ?? null,
        fetchedAt: p.fetchedAt ?? null,
        error: p.error ?? null,
      }
    })
  )
}
