// lib/session.js
//
// Server-side login sessions. The browser holds only a random ID in an HttpOnly
// cookie. The role and store live in MongoDB and are looked up on every request,
// so the browser can no longer claim to be an administrator.

import { randomBytes, createHash, scrypt as scryptCb, timingSafeEqual } from 'crypto'
import { promisify } from 'util'

const scrypt = promisify(scryptCb)

export const COOKIE_NAME = 'fp_session'
const MIN = 60 * 1000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

// idle: signed out after this much inactivity (renews with use)
// absolute: signed out after this long, whatever the activity
const POLICY = {
  admin: { idle: 30 * MIN, absolute: 12 * HOUR },
  store_admin: { idle: 30 * MIN, absolute: 12 * HOUR },
  security: { idle: 7 * DAY, absolute: 30 * DAY },
}
const DEFAULT_POLICY = { idle: 30 * MIN, absolute: 12 * HOUR }

const sha256 = (s) => createHash('sha256').update(s).digest('hex')

export function parseCookies(header) {
  const out = {}
  if (!header) return out
  header.split(';').forEach((part) => {
    const i = part.indexOf('=')
    if (i < 0) return
    try { out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim()) } catch {}
  })
  return out
}

function cookieString(value, maxAgeSeconds) {
  const parts = [`${COOKIE_NAME}=${value}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${maxAgeSeconds}`]
  if (process.env.NODE_ENV === 'production') parts.push('Secure')
  return parts.join('; ')
}

export const clearCookie = () => cookieString('', 0)

// Call after the password has been checked. Returns the cookie to send back.
export async function createSession(db, user, meta = {}) {
  const policy = POLICY[user.role] || DEFAULT_POLICY
  const token = randomBytes(32).toString('base64url')
  const now = Date.now()
  const col = db.collection('sessions')
  await col.createIndex({ expireAt: 1 }, { expireAfterSeconds: 0 }).catch(() => {})
  await col.insertOne({
    _id: sha256(token), // only a hash is stored, so a database leak does not leak usable sessions
    userId: user.id || String(user._id || ''),
    username: user.username,
    name: user.name || user.username,
    role: user.role,
    storeId: user.storeId || '',
    createdAt: now,
    lastSeen: now,
    idleMs: policy.idle,
    expiresAt: now + policy.absolute,
    expireAt: new Date(now + policy.absolute), // lets MongoDB clean up old sessions by itself
    ip: meta.ip || null,
    userAgent: (meta.userAgent || '').slice(0, 200),
  })
  return { token, cookie: cookieString(token, Math.floor(policy.absolute / 1000)) }
}

export async function getSession(db, request) {
  const token = parseCookies(request.headers.get('cookie'))[COOKIE_NAME]
  if (!token) return null
  const col = db.collection('sessions')
  const s = await col.findOne({ _id: sha256(token) })
  if (!s) return null
  const now = Date.now()
  if (now > s.expiresAt || now - s.lastSeen > s.idleMs) {
    await col.deleteOne({ _id: s._id }).catch(() => {})
    return null
  }
  if (now - s.lastSeen > MIN) await col.updateOne({ _id: s._id }, { $set: { lastSeen: now } }).catch(() => {})
  return s
}

export async function destroySession(db, request) {
  const token = parseCookies(request.headers.get('cookie'))[COOKIE_NAME]
  if (token) await db.collection('sessions').deleteOne({ _id: sha256(token) }).catch(() => {})
}

// What every API route should call. Returns { role, storeId, name, userId, via } or null.
// While ALLOW_LEGACY_HEADERS is not 'false', the old x-user-role headers still work
// as a fallback so the app keeps running during the switch. Set it to 'false' to enforce sessions.
export async function getAuth(db, request) {
  const s = await getSession(db, request)
  if (s) return { role: s.role, storeId: s.storeId || '', name: s.name, userId: s.userId, via: 'session' }
  if (process.env.ALLOW_LEGACY_HEADERS !== 'false') {
    const role = request.headers.get('x-user-role')
    if (role) return { role, storeId: request.headers.get('x-store-id') || '', name: '', userId: null, via: 'legacy-header' }
  }
  return null
}

// Extra protection for requests that change data: refuse ones sent from another website.
export function sameOrigin(request) {
  const m = request.method
  if (m === 'GET' || m === 'HEAD' || m === 'OPTIONS') return true
  const origin = request.headers.get('origin')
  if (!origin) return true
  try {
    const host = request.headers.get('x-forwarded-host') || request.headers.get('host')
    return new URL(origin).host === host
  } catch { return false }
}

// Passwords: salted scrypt (built into Node). Format: scrypt1$<salt>$<hash>
export async function hashPassword(plain) {
  const salt = randomBytes(16)
  const key = await scrypt(plain, salt, 64)
  return `scrypt1$${salt.toString('base64')}$${key.toString('base64')}`
}

export async function verifyPassword(plain, stored) {
  if (typeof stored !== 'string' || !stored.startsWith('scrypt1$')) return false
  const [, saltB64, keyB64] = stored.split('$')
  if (!saltB64 || !keyB64) return false
  const key = Buffer.from(keyB64, 'base64')
  const test = await scrypt(plain, Buffer.from(saltB64, 'base64'), key.length)
  return key.length === test.length && timingSafeEqual(key, test)
}
