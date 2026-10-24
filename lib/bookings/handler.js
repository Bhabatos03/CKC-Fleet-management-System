// lib/bookings/handler.js
//
// Vehicle Booking Management API (Phase 1: create, edit, register, submit, cancel).
// The main /api route calls handleBookings() for every path that starts with "bookings".
//
//   GET    bookings              list (filters, sort, pagination; ?format=csv exports)
//   GET    bookings/meta         showrooms, Brand Hosts and the signed-in user's details
//   GET    bookings/:id          one booking with its status history
//   POST   bookings              create (saveAs: "Draft" or "Requested")
//   PUT    bookings/:id          edit a Draft or Requested booking
//   POST   bookings/:id/status   move to Requested (from Draft) or Cancelled (with a reason)
//
// There is deliberately no DELETE. Bookings are cancelled, never removed.

import { randomUUID } from 'crypto'
import { sameOrigin } from '../session.js'
import {
  STORE_IDS, BOOKING_ROLES, BOOKING_TYPES, STATUSES, TRANSITIONS, PHASE1_TARGETS,
  EDITABLE_STATUSES, CANCELLABLE_STATUSES,
} from './constants.js'
import {
  normalizeBooking, errorSummary, clean, cleanMultiline, normMobile, maskMobile, todayIST,
} from './validate.js'

class HttpError extends Error {
  constructor(status, message, fields) { super(message); this.status = status; this.fields = fields }
}

const isStaff = (a) => a.role === 'admin' || a.role === 'store_admin'
const actorOf = (a) => ({ userId: a.userId || null, username: a.username, name: a.name || a.username, role: a.role })
const canManage = (b, a) => isStaff(a) || (!!b.createdBy?.userId && b.createdBy.userId === a.userId)
const scopeFilter = (a) => (a.role === 'admin' ? {} : { storeId: a.storeId })
const UUID_RE = /^[0-9a-f-]{36}$/i
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// ---------- one-time setup ----------
let indexesReady = false
async function ensureIndexes(db) {
  if (indexesReady) return
  const b = db.collection('bookings')
  const ok = (p) => p.catch(() => {})
  await Promise.all([
    ok(b.createIndex({ id: 1 }, { unique: true })),
    ok(b.createIndex({ bookingNo: 1 }, { unique: true, partialFilterExpression: { bookingNo: { $type: 'string' } } })),
    ok(b.createIndex({ storeId: 1, 'trip.travelDate': 1 })),
    ok(b.createIndex({ status: 1 })),
    ok(b.createIndex({ createdAt: -1 })),
    ok(b.createIndex({ customerKey: 1 })),
    ok(b.createIndex({ 'brandHost.username': 1 })),
    // Stops the same form being saved twice by a double click or a retry
    ok(b.createIndex({ 'createdBy.userId': 1, clientRequestId: 1 }, { unique: true, partialFilterExpression: { clientRequestId: { $type: 'string' } } })),
    ok(db.collection('booking_status_history').createIndex({ bookingId: 1, at: 1 })),
    ok(db.collection('booking_audit').createIndex({ bookingId: 1, at: 1 })),
    ok(db.collection('rate_limits').createIndex({ expireAt: 1 }, { expireAfterSeconds: 0 })),
  ])
  indexesReady = true
}

async function limited(db, key, max, windowMs = 60000) {
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

// Booking numbers are issued when a booking is submitted, so drafts leave no gaps in the register.
async function nextBookingNo(db) {
  const year = todayIST().slice(0, 4)
  const r = await db.collection('booking_counters').findOneAndUpdate(
    { _id: `booking-${year}` }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: 'after' })
  const doc = r && r.seq !== undefined ? r : r?.value
  return `CKC/VB/${year}/${String(doc.seq).padStart(4, '0')}`
}

const customerKeyOf = (party, r) => {
  if (party !== 'customer') return null
  if (r.crmRef) return `crm:${r.crmRef.toLowerCase()}`
  return r.mobileKey ? `mob:${r.mobileKey}` : null
}

// ---------- what the browser is allowed to see ----------
function present(b, auth) {
  const { _id, customerKey, clientRequestId, ...rest } = b
  const out = JSON.parse(JSON.stringify(rest))
  if (out.requester) delete out.requester.mobileKey
  if (out.delivery) delete out.delivery.recipientMobileKey
  const showContacts = isStaff(auth) || (!!b.createdBy?.userId && b.createdBy.userId === auth.userId)
  if (!showContacts) {
    if (out.requester?.mobile) out.requester.mobile = maskMobile(out.requester.mobile)
    if (out.delivery?.recipientMobile) out.delivery.recipientMobile = maskMobile(out.delivery.recipientMobile)
    out.contactsMasked = true
  }
  const manage = canManage(b, auth)
  out.permissions = {
    canEdit: manage && EDITABLE_STATUSES.includes(b.status),
    canSubmit: manage && b.status === 'Draft',
    canCancel: manage && CANCELLABLE_STATUSES.includes(b.status),
  }
  return out
}

async function loadBooking(db, auth, id) {
  if (!UUID_RE.test(id)) throw new HttpError(404, 'Booking not found')
  // Out-of-scope bookings look exactly like missing ones, so another showroom's data is never confirmed to exist
  const b = await db.collection('bookings').findOne({ id, ...scopeFilter(auth) })
  if (!b) throw new HttpError(404, 'Booking not found')
  return b
}

async function record(db, auth, bookingId, action, { from = null, to = null, remarks = '', changedFields } = {}) {
  const at = new Date().toISOString()
  const by = actorOf(auth)
  const jobs = [db.collection('booking_audit').insertOne({
    id: randomUUID(), bookingId, action, by, at, ...(changedFields ? { changedFields } : {}),
  })]
  if (to) {
    jobs.push(db.collection('booking_status_history').insertOne({
      id: randomUUID(), bookingId, from, to, by, at, remarks: clean(remarks, 300),
    }))
  }
  await Promise.all(jobs)
}

async function resolveBrandHost(db, auth, storeId, requestedUsername) {
  let u = null
  if (requestedUsername && isStaff(auth)) {
    u = await db.collection('users').findOne({ username: requestedUsername, role: 'brand_host', status: 'Active' })
    if (!u || u.storeId !== storeId) throw new HttpError(400, 'That Brand Host does not belong to this showroom')
  } else {
    u = await db.collection('users').findOne({ username: auth.username })
  }
  return {
    userId: u?.id || auth.userId || null,
    username: u?.username || auth.username,
    name: u?.name || auth.name || auth.username,
    empId: u?.empId || '',
    contact: u?.mobile || '',
  }
}

function resolveStore(auth, body) {
  if (auth.role === 'admin') {
    const s = clean(body.storeId, 20)
    if (!STORE_IDS.includes(s)) throw new HttpError(400, 'Please choose a showroom', { storeId: 'Choose a showroom' })
    return s
  }
  return auth.storeId // Brand Hosts and store admins can only book for their own showroom
}

const failValidation = (errors) => {
  const fields = Object.fromEntries(errors.map(e => [e.field, e.message]))
  return new HttpError(400, errorSummary(errors), fields)
}

// ---------- list / export ----------
const SORTS = { travel: 'trip.startAt', created: 'createdAt', updated: 'updatedAt', no: 'bookingNo', status: 'status' }

function buildListQuery(auth, sp) {
  const and = [scopeFilter(auth)]
  if (auth.role === 'admin') {
    const s = sp.get('store')
    if (s && STORE_IDS.includes(s)) and.push({ storeId: s })
  }
  const status = sp.get('status')
  if (status && STATUSES.includes(status)) and.push({ status })
  const type = sp.get('type')
  if (type && BOOKING_TYPES.some(t => t.value === type)) and.push({ bookingType: type })
  const from = sp.get('from'), to = sp.get('to')
  if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) and.push({ 'trip.travelDate': { $gte: from } })
  if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) and.push({ 'trip.travelDate': { $lte: to } })
  const host = clean(sp.get('host'), 60)
  if (host) and.push({ 'brandHost.username': host })
  const q = clean(sp.get('q'), 60)
  if (q) {
    const rx = new RegExp(escapeRe(q), 'i')
    const ors = [
      { bookingNo: rx }, { 'requester.name': rx }, { 'requester.crmRef': rx }, { 'requester.empId': rx },
      { 'delivery.recipientName': rx }, { 'trip.pickup.address': rx }, { 'trip.drop.address': rx },
    ]
    const digits = normMobile(q)
    // Phone search needs the full number, so partial digits cannot be used to browse contact details
    if (digits.length === 10) ors.push({ 'requester.mobileKey': digits }, { 'delivery.recipientMobileKey': digits })
    and.push({ $or: ors })
  }
  return and.length === 1 ? and[0] : { $and: and }
}

const csvCell = (v) => {
  let s = v === null || v === undefined ? '' : String(v)
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}` // stops spreadsheet formulas from running
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

async function listBookings(ctx) {
  const { db, auth, request, json } = ctx
  const sp = new URL(request.url).searchParams
  const query = buildListQuery(auth, sp)
  const sortKey = SORTS[sp.get('sort')] || SORTS.created
  const dir = sp.get('dir') === 'asc' ? 1 : -1
  const col = db.collection('bookings')

  if (sp.get('format') === 'csv') {
    if (await limited(db, `bk-export|${auth.username}`, 5, 60000)) throw new HttpError(429, 'Too many exports. Please wait a minute.')
    const rows = (await col.find(query).sort({ [sortKey]: dir, id: 1 }).limit(5000).toArray()).map(b => present(b, auth))
    const head = ['Booking ID', 'Status', 'Booking Type', 'Priority', 'Showroom', 'Travel Date', 'Pickup Time', 'Name', 'Contact',
      'Brand Host', 'Pickup Location', 'Drop Location', 'Passengers', 'Cancellation Reason', 'Created By', 'Created At', 'Last Updated']
    const lines = [head.map(csvCell).join(',')]
    for (const b of rows) {
      lines.push([
        b.bookingNo || 'DRAFT', b.status, b.bookingType, b.priority, b.storeId, b.trip?.travelDate, b.trip?.pickupTime,
        b.requester?.name, b.requester?.mobile, b.brandHost?.name, b.trip?.pickup?.address, b.trip?.drop?.address,
        b.trip?.passengers ?? '', b.cancellation?.reason || '', b.createdBy?.name, b.createdAt, b.updatedAt,
      ].map(csvCell).join(','))
    }
    return new Response('﻿' + lines.join('\r\n'), {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="bookings-${todayIST()}.csv"`,
        'Cache-Control': 'no-store',
      },
    })
  }

  const pageSize = Math.min(Math.max(parseInt(sp.get('pageSize'), 10) || 25, 1), 100)
  const page = Math.max(parseInt(sp.get('page'), 10) || 1, 1)
  const [total, rows] = await Promise.all([
    col.countDocuments(query),
    col.find(query).sort({ [sortKey]: dir, id: 1 }).skip((page - 1) * pageSize).limit(pageSize).toArray(),
  ])
  return json({ items: rows.map(b => present(b, auth)), total, page, pageSize })
}

// ---------- single booking ----------
async function getBooking(ctx, id) {
  const { db, auth, json } = ctx
  const b = await loadBooking(db, auth, id)
  const history = await db.collection('booking_status_history').find({ bookingId: id }).sort({ at: 1 }).toArray()
  const out = { booking: present(b, auth), history: history.map(({ _id, ...h }) => h) }
  if (auth.role === 'admin') {
    const audit = await db.collection('booking_audit').find({ bookingId: id }).sort({ at: 1 }).toArray()
    out.audit = audit.map(({ _id, ...a }) => a)
  }
  return json(out)
}

async function getMeta(ctx) {
  const { db, auth, json } = ctx
  const me = await db.collection('users').findOne({ username: auth.username })
  let brandHosts = []
  if (isStaff(auth)) {
    const hostQuery = { role: 'brand_host', status: 'Active', ...(auth.role === 'admin' ? {} : { storeId: auth.storeId }) }
    const hosts = await db.collection('users').find(hostQuery).toArray()
    brandHosts = hosts.map(h => ({ username: h.username, name: h.name, storeId: h.storeId || '' }))
  }
  return json({
    stores: auth.role === 'admin' ? STORE_IDS : [auth.storeId],
    me: { name: auth.name, username: auth.username, role: auth.role, storeId: auth.storeId || '', empId: me?.empId || '', mobile: me?.mobile || '' },
    brandHosts,
    today: todayIST(),
  })
}

// ---------- create ----------
async function createBooking(ctx) {
  const { db, auth, body, json } = ctx
  if (await limited(db, `bk-create|${auth.username}`, 30)) throw new HttpError(429, 'Too many bookings in a short time. Please wait a minute.')

  const saveAs = body.saveAs === 'Requested' ? 'Requested' : 'Draft'
  const storeId = resolveStore(auth, body)
  const clientRequestId = clean(body.clientRequestId, 64)
  const col = db.collection('bookings')

  if (clientRequestId) {
    const dup = await col.findOne({ 'createdBy.userId': auth.userId, clientRequestId })
    if (dup) return json({ booking: present(dup, auth), duplicate: true })
  }

  const { value, errors } = normalizeBooking(body, { submit: saveAs === 'Requested' })
  if (errors.length) throw failValidation(errors)

  const brandHost = await resolveBrandHost(db, auth, storeId, clean(body.brandHostUsername, 60))
  const now = new Date().toISOString()
  const actor = actorOf(auth)
  const type = BOOKING_TYPES.find(t => t.value === value.bookingType)
  const doc = {
    id: randomUUID(),
    bookingNo: saveAs === 'Requested' ? await nextBookingNo(db) : null,
    status: saveAs,
    bookingDate: todayIST(),
    storeId,
    bookingType: value.bookingType,
    party: value.party,
    legs: type.legs,
    source: value.source,
    priority: value.priority,
    department: value.department,
    remarks: value.remarks,
    requester: value.requester,
    delivery: value.delivery,
    trip: value.trip,
    customerKey: customerKeyOf(value.party, value.requester),
    brandHost,
    vehicleId: null, // set in Phase 2
    driverId: null,  // set in Phase 2
    cancellation: null,
    createdBy: actor, createdAt: now, updatedBy: actor, updatedAt: now, version: 1,
    ...(clientRequestId ? { clientRequestId } : {}),
  }
  try {
    await col.insertOne(doc)
  } catch (e) {
    if (e?.code === 11000 && clientRequestId) {
      const dup = await col.findOne({ 'createdBy.userId': auth.userId, clientRequestId })
      if (dup) return json({ booking: present(dup, auth), duplicate: true })
    }
    throw e
  }
  await record(db, auth, doc.id, 'Created', { from: null, to: saveAs })
  return json({ booking: present(doc, auth) })
}

// ---------- edit ----------
const EDIT_KEYS = ['bookingType', 'source', 'priority', 'department', 'remarks', 'requester', 'delivery', 'trip']

async function updateBooking(ctx, id) {
  const { db, auth, body, json } = ctx
  const prev = await loadBooking(db, auth, id)
  if (!canManage(prev, auth)) throw new HttpError(403, 'You can only edit bookings you created')
  if (!EDITABLE_STATUSES.includes(prev.status)) throw new HttpError(409, `A ${prev.status} booking can no longer be edited here`)
  if (Number(body.version) !== prev.version) throw new HttpError(409, 'This booking was changed by someone else. Please reload it and try again.')

  const submitting = prev.status === 'Draft' && body.saveAs === 'Requested'
  const { value, errors } = normalizeBooking(body, { submit: prev.status !== 'Draft' || submitting })
  if (errors.length) throw failValidation(errors)

  const type = BOOKING_TYPES.find(t => t.value === value.bookingType)
  const next = {
    bookingType: value.bookingType, party: value.party, legs: type.legs, source: value.source, priority: value.priority,
    department: value.department, remarks: value.remarks, requester: value.requester, delivery: value.delivery, trip: value.trip,
    customerKey: customerKeyOf(value.party, value.requester),
  }
  if (isStaff(auth) && body.brandHostUsername && body.brandHostUsername !== prev.brandHost?.username) {
    next.brandHost = await resolveBrandHost(db, auth, prev.storeId, clean(body.brandHostUsername, 60))
  }
  const changedFields = EDIT_KEYS.filter(k => JSON.stringify(prev[k] ?? null) !== JSON.stringify(next[k] ?? null))
  if (next.brandHost) changedFields.push('brandHost')

  const now = new Date().toISOString()
  const set = { ...next, updatedAt: now, updatedBy: actorOf(auth) }
  if (submitting) { set.status = 'Requested'; set.bookingNo = prev.bookingNo || await nextBookingNo(db) }

  // The version in the filter means two people saving at once cannot overwrite each other
  const res = await db.collection('bookings').updateOne(
    { id, version: prev.version, status: prev.status }, { $set: set, $inc: { version: 1 } })
  if (!res.matchedCount) throw new HttpError(409, 'This booking was changed by someone else. Please reload it and try again.')

  await record(db, auth, id, submitting ? 'Edited and submitted' : 'Edited', {
    changedFields, ...(submitting ? { from: 'Draft', to: 'Requested' } : {}),
  })
  const fresh = await db.collection('bookings').findOne({ id })
  return json({ booking: present(fresh, auth) })
}

// ---------- status changes ----------
async function changeStatus(ctx, id) {
  const { db, auth, body, json } = ctx
  const target = clean(body.status, 30)
  if (!STATUSES.includes(target)) throw new HttpError(400, 'Unknown status')
  const b = await loadBooking(db, auth, id)
  if (!canManage(b, auth)) throw new HttpError(403, 'You can only change bookings you created')
  if (!TRANSITIONS[b.status].includes(target)) throw new HttpError(409, `A ${b.status} booking cannot be moved to ${target}`)
  if (!PHASE1_TARGETS.includes(target)) throw new HttpError(400, `Moving a booking to ${target} is not available yet`)

  const now = new Date().toISOString()
  const set = { status: target, updatedAt: now, updatedBy: actorOf(auth) }
  let remarks = ''

  if (target === 'Requested') {
    const { errors } = normalizeBooking(b, { submit: true })
    if (errors.length) throw failValidation(errors)
    set.bookingNo = b.bookingNo || await nextBookingNo(db)
  }
  if (target === 'Cancelled') {
    const reason = cleanMultiline(body.reason, 300)
    if (reason.length < 3) throw new HttpError(400, 'A cancellation reason is required', { reason: 'Enter a reason' })
    set.cancellation = { reason, by: actorOf(auth), at: now }
    remarks = reason
  }

  const res = await db.collection('bookings').updateOne(
    { id, status: b.status, version: b.version }, { $set: set, $inc: { version: 1 } })
  if (!res.matchedCount) throw new HttpError(409, 'This booking was changed by someone else. Please reload it and try again.')

  await record(db, auth, id, `Status: ${b.status} → ${target}`, { from: b.status, to: target, remarks })
  const fresh = await db.collection('bookings').findOne({ id })
  return json({ booking: present(fresh, auth) })
}

// ---------- entry point ----------
export async function handleBookings({ db, request, path, auth, body, json }) {
  try {
    if (!auth || auth.via !== 'session') throw new HttpError(401, 'Not signed in')
    if (!BOOKING_ROLES.includes(auth.role)) throw new HttpError(403, 'You do not have access to vehicle bookings')
    if (auth.role !== 'admin' && !auth.storeId) throw new HttpError(403, 'Your account is not linked to a showroom')
    const method = request.method
    if (method !== 'GET' && !sameOrigin(request)) throw new HttpError(403, 'Forbidden')

    await ensureIndexes(db)
    const ctx = { db, request, auth, body: body || {}, json }
    const parts = path.split('/').slice(1) // after "bookings"

    if (parts.length === 0) {
      if (method === 'GET') return await listBookings(ctx)
      if (method === 'POST') return await createBooking(ctx)
    } else if (parts.length === 1) {
      if (method === 'GET' && parts[0] === 'meta') return await getMeta(ctx)
      if (method === 'GET') return await getBooking(ctx, parts[0])
      if (method === 'PUT') return await updateBooking(ctx, parts[0])
    } else if (parts.length === 2 && parts[1] === 'status' && method === 'POST') {
      return await changeStatus(ctx, parts[0])
    }
    throw new HttpError(405, 'Method not allowed')
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message, ...(e.fields ? { fields: e.fields } : {}) }, e.status)
    // Log the error type only: database errors can quote customer data
    console.error('Booking error:', e?.name, e?.code || '')
    return json({ error: 'Something went wrong with the booking request.' }, 500)
  }
}
