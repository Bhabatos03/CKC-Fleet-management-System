// lib/bookings/feedback.js
//
// Trip feedback from the customer (or employee) and from the driver.
//
// How it works:
//  - After a trip is Completed, the Brand Host who created the booking asks for feedback links.
//  - Each link carries a random 256-bit token. Only a hash of it is stored, so a database leak reveals no working link.
//  - A link works once, for FEEDBACK.expiryDays days, and the page behind it shows NOTHING about the booking.
//  - Nothing is sent from here. The Brand Host copies the link and shares it. (No WhatsApp or SMS is configured.)
//  - Feedback is optional: an unanswered link just expires.

import { randomBytes, createHash, randomUUID } from 'crypto'
import { FEEDBACK, DRIVER_ISSUES } from './constants.js'
import { clean, cleanMultiline } from './validate.js'

export class FeedbackError extends Error {
  constructor(status, message, fields) { super(message); this.status = status; this.fields = fields }
}

const hashOf = (t) => createHash('sha256').update(String(t)).digest('hex')
export const newToken = () => randomBytes(32).toString('base64url')
export const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/

async function rateLimited(db, key, max, windowMs = 60000) {
  const col = db.collection('rate_limits')
  const now = Date.now()
  const rec = await col.findOne({ _id: key })
  if (rec && now - rec.first < windowMs) {
    if (rec.count >= max) return true
    await col.updateOne({ _id: key }, { $inc: { count: 1 } })
    return false
  }
  await col.replaceOne({ _id: key }, { _id: key, count: 1, first: now, expireAt: new Date(now + windowMs) }, { upsert: true })
  return false
}

// Who is asked, for a booking. A driver is asked only if one was assigned.
export function rolesFor(booking) {
  const roles = ['customer']
  if (booking.allocation?.driverId) roles.push('driver')
  return roles
}
// Customers (and delivery recipients) must have agreed to be asked; employees need no consent
export const needsConsent = (booking) => booking.party === 'customer' || booking.party === 'delivery'

// Create fresh links for a completed booking. A role that has already answered is left alone. An unanswered old link is replaced.
export async function issueLinks(db, booking, { by, consent }) {
  if (booking.status !== 'Completed') throw new FeedbackError(409, 'Feedback can be requested after the trip is completed')
  if (needsConsent(booking) && !consent) {
    throw new FeedbackError(400, 'Confirm that the customer agreed to receive a feedback request', { consent: 'Required' })
  }
  if (await rateLimited(db, `fbl:${by.userId || by.username}`, FEEDBACK.linksPerHour, 3600000)) {
    throw new FeedbackError(429, 'Too many feedback links requested. Please try again later.')
  }
  const col = db.collection('booking_feedback')
  const existing = await col.find({ bookingId: booking.id }).toArray()
  const now = Date.now()
  const expiresAt = new Date(now + FEEDBACK.expiryDays * 86400000).toISOString()
  const out = []
  for (const role of rolesFor(booking)) {
    if (existing.some(f => f.role === role && f.status === 'submitted')) { out.push({ role, status: 'submitted' }); continue }
    await col.deleteMany({ bookingId: booking.id, role, status: 'pending' })
    const token = newToken()
    await col.insertOne({
      id: randomUUID(), bookingId: booking.id, bookingNo: booking.bookingNo || '', storeId: booking.storeId, role,
      status: 'pending', tokenHash: hashOf(token), createdAt: new Date(now).toISOString(), expiresAt,
      issuedBy: { userId: by.userId || null, username: by.username },
      driverId: booking.allocation?.driverId || null, driverName: booking.allocation?.driverName || '',
      vehicleId: booking.allocation?.vehicleId || null, vehicleNumber: booking.allocation?.vehicleNumber || '',
      travelDate: booking.trip?.travelDate || '', party: booking.party,
    })
    out.push({ role, status: 'pending', token, path: `/feedback#${token}`, expiresAt })
  }
  return out
}

// What the Brand Host sees for a booking: has each person answered? (never the link, which cannot be shown again)
export async function feedbackStatus(db, bookingId) {
  const rows = await db.collection('booking_feedback').find({ bookingId }).toArray()
  const now = new Date().toISOString()
  return rows.map(f => ({
    role: f.role, status: f.status === 'pending' && f.expiresAt < now ? 'expired' : f.status,
    ...(f.status === 'submitted' ? { rating: f.rating, comment: f.comment || '', issues: f.issues || [], submittedAt: f.submittedAt } : { expiresAt: f.expiresAt }),
  }))
}

async function loadPending(db, token) {
  if (!TOKEN_RE.test(String(token || ''))) throw new FeedbackError(404, 'This link is not valid or has already been used')
  const f = await db.collection('booking_feedback').findOne({ tokenHash: hashOf(token), status: 'pending' })
  if (!f) throw new FeedbackError(404, 'This link is not valid or has already been used')
  if (f.expiresAt < new Date().toISOString()) throw new FeedbackError(410, 'This feedback link has expired')
  return f
}

// The form needs only to know which questions to show. No booking, name, place or number is ever returned.
export async function getForm(db, token, ip = 'x') {
  if (await rateLimited(db, `fbg:${hashOf(ip).slice(0, 16)}`, FEEDBACK.submitsPerMinute)) throw new FeedbackError(429, 'Too many attempts. Please wait a moment.')
  const f = await loadPending(db, token)
  return { role: f.role, issues: f.role === 'driver' ? DRIVER_ISSUES : [] }
}

export async function submitFeedback(db, token, body, ip = 'x') {
  if (await rateLimited(db, `fbs:${hashOf(ip).slice(0, 16)}`, FEEDBACK.submitsPerMinute)) throw new FeedbackError(429, 'Too many attempts. Please wait a moment.')
  const f = await loadPending(db, token)
  const rating = Number(body?.rating)
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new FeedbackError(400, 'Please choose a rating from 1 to 5', { rating: 'Choose 1 to 5' })
  const comment = cleanMultiline(body?.comment, FEEDBACK.maxComment)
  let issues = []
  if (f.role === 'driver') {
    const list = Array.isArray(body?.issues) ? body.issues : []
    issues = [...new Set(list.map(x => clean(x, 40)).filter(x => DRIVER_ISSUES.includes(x)))]
  }
  // tokenHash is cleared in the same write, so a link cannot be used twice even if two requests arrive together
  const res = await db.collection('booking_feedback').updateOne(
    { id: f.id, status: 'pending', tokenHash: f.tokenHash },
    { $set: { status: 'submitted', rating, comment, issues, submittedAt: new Date().toISOString(), tokenHash: null } })
  if (!res.matchedCount) throw new FeedbackError(404, 'This link is not valid or has already been used')
  return { ok: true }
}

// ---------- for Admin and Store Admin ----------
// scope: {} for admin, { storeId } for store admin
export async function feedbackReport(db, scope, { days = 90 } = {}) {
  const since = new Date(Date.now() - days * 86400000).toISOString()
  const rows = (await db.collection('booking_feedback').find({ ...scope, status: 'submitted', submittedAt: { $gte: since } }).sort({ submittedAt: -1 }).limit(500).toArray())
  const avg = (xs) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null)
  const group = (key, label, role) => {
    const m = new Map()
    for (const f of rows) {
      if (f.role !== role || !f[key]) continue
      if (!m.has(f[key])) m.set(f[key], { id: f[key], label: f[label] || f[key], ratings: [] })
      m.get(f[key]).ratings.push(f.rating)
    }
    return [...m.values()].map(g => ({ id: g.id, label: g.label, count: g.ratings.length, average: avg(g.ratings) })).sort((a, b) => (a.average ?? 9) - (b.average ?? 9))
  }
  const customer = rows.filter(f => f.role === 'customer')
  const driver = rows.filter(f => f.role === 'driver')
  return {
    days,
    totals: { customer: { count: customer.length, average: avg(customer.map(f => f.rating)) }, driver: { count: driver.length, average: avg(driver.map(f => f.rating)) } },
    // customers rate the driver and vehicle that served them
    byDriver: group('driverId', 'driverName', 'customer'),
    byVehicle: group('vehicleId', 'vehicleNumber', 'customer'),
    items: rows.slice(0, 100).map(f => ({
      id: f.id, bookingId: f.bookingId, bookingNo: f.bookingNo, storeId: f.storeId, role: f.role, rating: f.rating, comment: f.comment || '',
      issues: f.issues || [], driverName: f.driverName, vehicleNumber: f.vehicleNumber, travelDate: f.travelDate, submittedAt: f.submittedAt,
      low: f.rating <= FEEDBACK.lowRating,
    })),
  }
}
