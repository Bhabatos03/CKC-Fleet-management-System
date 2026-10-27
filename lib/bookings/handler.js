// lib/bookings/handler.js
//
// Vehicle Booking Management API (Phases 1 and 2).
// The main /api route calls handleBookings() for every path that starts with "bookings".
//
//   GET    bookings                    list (filters, sort, pagination; ?format=csv exports)
//   GET    bookings/meta               showrooms, Brand Hosts, vehicles, drivers, the signed-in user
//   GET    bookings/alerts             today's bookings for the showroom, those needing a vehicle first
//   GET    bookings/availability       vehicles and drivers free for a time (?bookingId= or the trip fields)
//   GET    bookings/geo/search         place search for the location boxes (?q=)
//   GET    bookings/geo/tile/z/x/y     one map picture, fetched through our server
//   POST   bookings/geo/route          route estimate for chosen places ({ points: [{lat,lng}, ...] })
//   GET    bookings/:id                one booking with its status history
//   POST   bookings                    create (saveAs: "Draft", "Requested" or "Confirmed")
//   PUT    bookings/:id                edit; also moves the time or changes the vehicle/driver
//   POST   bookings/:id/status         submit a draft (Requested) or cancel (with a reason)
//   POST   bookings/:id/confirm        confirm a Requested booking, optionally with a vehicle and driver
//   POST   bookings/:id/allocate       give a Confirmed booking a vehicle and driver, or change them
//   GET    bookings/open-trips         trips in progress for the showroom (all showrooms for Admin)
//   POST   bookings/:id/start          start the trip (only the Brand Host who created the booking)
//   POST   bookings/:id/complete       close the trip, optionally with end time and kilometres (same Brand Host only)
//   POST   bookings/:id/no-show        record that the trip did not happen, with a reason (same Brand Host only)
//   POST   bookings/:id/feedback-links create one-time feedback links for a completed trip (same Brand Host only)
//   GET    bookings/feedback           feedback received, with averages (Admin, Store Admin)
//
// There is deliberately no DELETE. Bookings are cancelled, never removed.

import { randomUUID } from 'crypto'
import { sameOrigin } from '../session.js'
import {
  STORE_IDS, BOOKING_ROLES, BOOKING_TYPES, STATUSES, TRANSITIONS, DIRECT_STATUS_TARGETS,
  EDITABLE_STATUSES, CANCELLABLE_STATUSES, ALLOCATABLE_STATUSES, ALLOCATE_ROLES, WRITE_ROLES, ALLOCATION, GEO,
  BOOKING_MODES, DEPARTMENTS, ADVANCE, STARTABLE_STATUSES, NO_SHOW_STATUSES, TRIP,
} from './constants.js'
import { issueLinks, feedbackStatus, feedbackReport, FeedbackError } from './feedback.js'
import {
  normalizeBooking, errorSummary, clean, cleanMultiline, normMobile, maskMobile, todayIST, nowTimeIST, isValidTime, toStartAt,
} from './validate.js'
import { computeAvailability, windowOf, slotsOf } from './availability.js'
import { acquireLocks, finishLocks, rollbackLocks, releaseBooking } from './locks.js'
import { searchPlaces, routeEstimate, routeForTrip, routeSignature, fetchTile, GeoError } from './geo.js'

class HttpError extends Error {
  constructor(status, message, fields) { super(message); this.status = status; this.fields = fields }
}

const CHANGED = 'This booking was changed by someone else. Please reload it and try again.'
const isStaff = (a) => a.role === 'admin' || a.role === 'store_admin'
const actorOf = (a) => ({ userId: a.userId || null, username: a.username, name: a.name || a.username, role: a.role })
// Only Brand Hosts change bookings: edit and cancel are for the Brand Host who created it.
const canManage = (b, a) => a.role === 'brand_host' && !!b.createdBy?.userId && b.createdBy.userId === a.userId
// Confirming and allocating is day-to-day work for the whole showroom team: any Brand Host of the showroom may do it,
// so a booking is never stuck waiting for the person who typed it in. Editing and cancelling stay with the creator and staff.
const canOperate = (b, a) => a.role === 'brand_host' && !!a.storeId && a.storeId === b.storeId
const addDays = (date, n) => { const d = new Date(`${date}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
// Advance bookings are allocated on the travel day. Until then only the day it opens is shown.
const allocationOpensOn = (b) => (b.priority === 'Advance' && b.trip?.travelDate ? addDays(b.trip.travelDate, -ADVANCE.allocateFromDaysBefore) : null)
const allocationLocked = (b) => { const d = allocationOpensOn(b); return !!d && todayIST() < d }
const scopeFilter = (a) => (a.role === 'admin' ? {} : { storeId: a.storeId })
const UUID_RE = /^[0-9a-f-]{36}$/i
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const assertTransition = (from, to) => {
  if (!TRANSITIONS[from]?.includes(to)) throw new HttpError(409, `A ${from} booking cannot be moved to ${to}`)
}

// ---------- one-time setup ----------
const indexed = new Set()
async function ensureIndexes(db) {
  const key = db.databaseName || 'default'
  if (indexed.has(key)) return
  const b = db.collection('bookings')
  const ok = (p) => p.catch(() => {})
  await Promise.all([
    ok(b.createIndex({ id: 1 }, { unique: true })),
    ok(b.createIndex({ bookingNo: 1 }, { unique: true, partialFilterExpression: { bookingNo: { $type: 'string' } } })),
    ok(b.createIndex({ storeId: 1, 'trip.travelDate': 1 })),
    ok(b.createIndex({ status: 1 })),
    ok(b.createIndex({ storeId: 1, 'trip.travelDate': 1, status: 1 })),
    ok(b.createIndex({ createdAt: -1 })),
    ok(b.createIndex({ customerKey: 1 })),
    ok(b.createIndex({ 'brandHost.username': 1 })),
    ok(b.createIndex({ 'allocation.vehicleId': 1, 'trip.travelDate': 1 })),
    ok(b.createIndex({ 'allocation.driverId': 1, 'trip.travelDate': 1 })),
    // Stops the same form being saved twice by a double click or a retry
    ok(b.createIndex({ 'createdBy.userId': 1, clientRequestId: 1 }, { unique: true, partialFilterExpression: { clientRequestId: { $type: 'string' } } })),
    ok(db.collection('booking_locks').createIndex({ slot: 1 })),
    ok(db.collection('booking_locks').createIndex({ bookingId: 1 })),
    ok(db.collection('booking_locks').createIndex({ token: 1 })),
    ok(db.collection('booking_status_history').createIndex({ bookingId: 1, at: 1 })),
    ok(db.collection('booking_audit').createIndex({ bookingId: 1, at: 1 })),
    ok(db.collection('booking_feedback').createIndex({ tokenHash: 1 }, { unique: true, partialFilterExpression: { tokenHash: { $type: 'string' } } })),
    ok(db.collection('booking_feedback').createIndex({ bookingId: 1, role: 1 })),
    ok(db.collection('booking_feedback').createIndex({ storeId: 1, submittedAt: -1 })),
    ok(db.collection('rate_limits').createIndex({ expireAt: 1 }, { expireAfterSeconds: 0 })),
  ])
  indexed.add(key)
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
// A trip still open after its planned end (plus a short grace) is overdue: the Brand Host is asked whether it has finished
const isOverdue = (b) => b.status === 'In Progress' && !!b.schedule?.endAt && Date.now() > Date.parse(b.schedule.endAt) + TRIP.overrunGraceMinutes * 60000
function present(b, auth) {
  const { _id, customerKey, clientRequestId, ...rest } = b
  const out = JSON.parse(JSON.stringify(rest))
  if (out.requester) delete out.requester.mobileKey
  if (out.delivery) delete out.delivery.recipientMobileKey
  const showContacts = isStaff(auth) || (!!b.createdBy?.userId && b.createdBy.userId === auth.userId)
  if (!showContacts) {
    if (out.requester?.mobile) out.requester.mobile = maskMobile(out.requester.mobile)
    if (out.delivery?.recipientMobile) out.delivery.recipientMobile = maskMobile(out.delivery.recipientMobile)
    if (out.allocation) delete out.allocation.driverMobile
    out.contactsMasked = true
  }
  const manage = canManage(b, auth)
  out.permissions = {
    canEdit: manage && EDITABLE_STATUSES.includes(b.status),
    canSubmit: manage && b.status === 'Draft',
    canConfirm: canOperate(b, auth) && b.status === 'Requested',
    canAllocate: canOperate(b, auth) && ALLOCATE_ROLES.includes(auth.role) && ALLOCATABLE_STATUSES.includes(b.status) && !allocationLocked(b),
    allocationOpensOn: allocationLocked(b) ? allocationOpensOn(b) : null,
    canCancel: manage && CANCELLABLE_STATUSES.includes(b.status),
    canStart: manage && STARTABLE_STATUSES.includes(b.status) && !!b.allocation && (b.trip?.travelDate || '9999') <= todayIST(),
    canComplete: manage && b.status === 'In Progress',
    canNoShow: manage && NO_SHOW_STATUSES.includes(b.status),
    canRequestFeedback: manage && b.status === 'Completed',
    tripOverdue: isOverdue(b),
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

// chain: a run of statuses passed through in one action, for example Confirmed -> Driver Assigned -> Vehicle Assigned
let seqCounter = 0
async function record(db, auth, bookingId, action, { from = null, to = null, remarks = '', changedFields, chain, details } = {}) {
  const at = new Date().toISOString()
  const by = actorOf(auth)
  const jobs = [db.collection('booking_audit').insertOne({
    id: randomUUID(), bookingId, action, by, at,
    ...(changedFields ? { changedFields } : {}), ...(details ? { details } : {}),
  })]
  // seq keeps history in order when steps share a timestamp (a chained change, or two changes in one millisecond)
  const base = new Date(at).getTime() * 1000 + (seqCounter++ % 10) * 100
  const hist = (f, t, i = 0) => db.collection('booking_status_history').insertOne({
    id: randomUUID(), bookingId, from: f, to: t, by, at, seq: base + i, remarks: clean(remarks, 300),
  })
  if (chain) for (let i = 0; i < chain.length - 1; i++) jobs.push(hist(chain[i], chain[i + 1], i))
  else if (to) jobs.push(hist(from, to))
  await Promise.all(jobs)
}

// A booking is always made by, and in the name of, the signed-in Brand Host
async function resolveBrandHost(db, auth, requestedUsername) {
  if (requestedUsername && requestedUsername !== auth.username) throw new HttpError(403, 'A booking is always made in your own name')
  const u = await db.collection('users').findOne({ username: auth.username })
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

// ============ vehicle and driver allocation ============

// Checks that the vehicle and driver are free and suitable for this booking, then takes their time slots.
// The caller must save the booking next with saveWithPlan(), which keeps or gives back the slots.
async function planAllocation(ctx, { booking, trip, party, vehicleId, driverId }) {
  const { db, auth } = ctx
  const win = windowOf(trip)
  if (!win) throw new HttpError(400, 'Set the travel date and pickup time before allocating a vehicle')
  if (win.startMs < Date.now() - 5 * 60000) throw new HttpError(400, 'The pickup time has already passed')
  if (allocationLocked(booking)) {
    throw new HttpError(409, `Advance bookings are allocated on the travel day (${allocationOpensOn(booking)}). The booking can be confirmed now and given a vehicle and driver then.`)
  }

  // Always check again now. Whatever the screen showed earlier may be out of date.
  const avail = await computeAvailability(db, {
    storeId: booking.storeId, trip, passengers: trip.passengers, isDelivery: party === 'delivery',
    excludeBookingId: booking.id, showDriverMobile: true,
  })
  if (avail.error) throw new HttpError(400, avail.error)
  const v = avail.vehicles.find(x => x.id === vehicleId)
  const d = avail.drivers.find(x => x.id === driverId)
  if (!v) throw new HttpError(400, 'That vehicle is not available to this showroom')
  if (!d) throw new HttpError(400, 'That driver is not available to this showroom')
  if (!v.eligible) throw new HttpError(409, `${v.vehicleNumber} cannot be used: ${v.reasons.join(', ')}`, { vehicleId: v.reasons.join(', ') })
  if (!d.eligible) throw new HttpError(409, `${d.name} cannot be assigned: ${d.reasons.join(', ')}`, { driverId: d.reasons.join(', ') })

  const token = randomUUID()
  const got = await acquireLocks(db, { bookingId: booking.id, token, vehicleId, driverId, slots: slotsOf(win.startMs, win.endMs) })
  if (!got.ok) throw new HttpError(409, 'Another booking has just taken that vehicle or driver. Please check availability again.')

  return {
    token, keep: got.keep,
    allocation: {
      vehicleId, vehicleNumber: v.vehicleNumber, vehicleModel: `${v.make} ${v.model}`.trim(),
      driverId, driverName: d.name, driverMobile: d.mobile || '', by: actorOf(auth), at: new Date().toISOString(),
    },
    schedule: {
      startAt: new Date(win.startMs).toISOString(), endAt: new Date(win.endMs).toISOString(),
      assumedEnd: win.assumedEnd, bufferMinutes: ALLOCATION.bufferMinutes,
    },
  }
}

// Saves the booking only if nobody changed it meanwhile. If it cannot be saved, the slots just taken are given back.
async function saveWithPlan(db, plan, filter, update) {
  let res
  try {
    res = await db.collection('bookings').updateOne(filter, update)
  } catch (e) {
    if (plan) await rollbackLocks(db, plan.token).catch(() => {})
    throw e
  }
  if (!res.matchedCount) {
    if (plan) await rollbackLocks(db, plan.token).catch(() => {})
    throw new HttpError(409, CHANGED)
  }
  if (plan) await finishLocks(db, filter.id, plan.keep)
}

const sameAlloc = (a, vehicleId, driverId) => a && a.vehicleId === vehicleId && a.driverId === driverId

// Requested -> Confirmed, and (if a vehicle and driver are given) -> Driver Assigned -> Vehicle Assigned in one step
async function confirmCore(ctx, b, { vehicleId, driverId }) {
  const { db, auth } = ctx
  if (!canOperate(b, auth)) throw new HttpError(403, 'You can only confirm bookings in your own showroom')
  if (b.status !== 'Requested') throw new HttpError(409, `A ${b.status} booking cannot be confirmed`)
  const wantsAlloc = !!(vehicleId || driverId)
  if (wantsAlloc && !(vehicleId && driverId)) throw new HttpError(400, 'Choose both a vehicle and a driver')
  if (wantsAlloc && !ALLOCATE_ROLES.includes(auth.role)) throw new HttpError(403, 'You are not allowed to allocate vehicles')

  // The saved booking may have gone stale since it was submitted (for example the date has now passed)
  const { errors } = normalizeBooking(b, { submit: true, stored: true })
  if (errors.length) throw failValidation(errors)

  const now = new Date().toISOString()
  const set = { status: 'Confirmed', confirmedAt: now, confirmedBy: actorOf(auth), updatedAt: now, updatedBy: actorOf(auth) }
  let plan = null
  let chain = ['Requested', 'Confirmed']
  if (wantsAlloc) {
    plan = await planAllocation(ctx, { booking: b, trip: b.trip, party: b.party, vehicleId, driverId })
    set.status = 'Vehicle Assigned'
    set.allocation = plan.allocation
    set.schedule = plan.schedule
    chain = ['Requested', 'Confirmed', 'Driver Assigned', 'Vehicle Assigned']
  }
  for (let i = 0; i < chain.length - 1; i++) assertTransition(chain[i], chain[i + 1])

  await saveWithPlan(db, plan, { id: b.id, status: 'Requested', version: b.version }, { $set: set, $inc: { version: 1 } })
  await record(db, auth, b.id, plan ? 'Confirmed and allocated' : 'Confirmed', {
    chain, ...(plan ? { details: { vehicle: plan.allocation.vehicleNumber, driver: plan.allocation.driverName } } : {}),
  })
  return db.collection('bookings').findOne({ id: b.id })
}

// Confirmed -> Vehicle Assigned, or a change of vehicle/driver on a Vehicle Assigned booking
async function allocateCore(ctx, b, { vehicleId, driverId }) {
  const { db, auth } = ctx
  if (!canOperate(b, auth)) throw new HttpError(403, 'You can only allocate bookings in your own showroom')
  if (!ALLOCATE_ROLES.includes(auth.role)) throw new HttpError(403, 'You are not allowed to allocate vehicles')
  if (!ALLOCATABLE_STATUSES.includes(b.status)) throw new HttpError(409, `A ${b.status} booking cannot be given a vehicle. Confirm it first.`)
  if (!vehicleId || !driverId) throw new HttpError(400, 'Choose both a vehicle and a driver')
  if (sameAlloc(b.allocation, vehicleId, driverId)) throw new HttpError(409, 'That vehicle and driver are already assigned')

  const plan = await planAllocation(ctx, { booking: b, trip: b.trip, party: b.party, vehicleId, driverId })
  const now = new Date().toISOString()
  const set = { allocation: plan.allocation, schedule: plan.schedule, updatedAt: now, updatedBy: actorOf(auth) }
  const first = b.status === 'Confirmed'
  const chain = ['Confirmed', 'Driver Assigned', 'Vehicle Assigned']
  if (first) { for (let i = 0; i < chain.length - 1; i++) assertTransition(chain[i], chain[i + 1]); set.status = 'Vehicle Assigned' }

  await saveWithPlan(db, plan, { id: b.id, status: b.status, version: b.version }, { $set: set, $inc: { version: 1 } })
  await record(db, auth, b.id, first ? 'Vehicle and driver allocated' : 'Vehicle or driver changed', {
    ...(first ? { chain } : {}),
    details: {
      ...(b.allocation ? { from: { vehicle: b.allocation.vehicleNumber, driver: b.allocation.driverName } } : {}),
      to: { vehicle: plan.allocation.vehicleNumber, driver: plan.allocation.driverName },
    },
  })
  return db.collection('bookings').findOne({ id: b.id })
}

// ============ list / export ============
const SORTS = { travel: 'trip.startAt', created: 'createdAt', updated: 'updatedAt', no: 'bookingNo', status: 'status' }

function buildListQuery(auth, sp) {
  const and = [scopeFilter(auth)]
  if (auth.role === 'admin') {
    const s = sp.get('store')
    if (s && STORE_IDS.includes(s)) and.push({ storeId: s })
  }
  const status = sp.get('status')
  if (status && STATUSES.includes(status)) and.push({ status })
  const mode = sp.get('mode')
  if (mode === 'Advance') and.push({ priority: 'Advance' })
  else if (mode === 'Normal') and.push({ priority: { $ne: 'Advance' } })
  const type = sp.get('type')
  if (type && BOOKING_TYPES.some(t => t.value === type)) and.push({ bookingType: type })
  const from = sp.get('from'), to = sp.get('to')
  if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) and.push({ 'trip.travelDate': { $gte: from } })
  if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) and.push({ 'trip.travelDate': { $lte: to } })
  const host = clean(sp.get('host'), 60)
  if (host) and.push({ 'brandHost.username': host })
  const vehicle = clean(sp.get('vehicle'), 64)
  if (vehicle) and.push({ 'allocation.vehicleId': vehicle })
  const driver = clean(sp.get('driver'), 64)
  if (driver) and.push({ 'allocation.driverId': driver })
  const q = clean(sp.get('q'), 60)
  if (q) {
    const rx = new RegExp(escapeRe(q), 'i')
    const ors = [
      { bookingNo: rx }, { 'requester.name': rx }, { 'requester.crmRef': rx }, { 'requester.empId': rx },
      { 'delivery.recipientName': rx }, { 'trip.pickup.address': rx }, { 'trip.drop.address': rx },
      { 'allocation.vehicleNumber': rx }, { 'allocation.driverName': rx },
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
    const head = ['Booking ID', 'Status', 'Booking Type', 'Booking Mode', 'Showroom', 'Travel Date', 'Pickup Time', 'Name', 'Contact',
      'Brand Host', 'Pickup Location', 'Drop Location', 'Passengers', 'Vehicle', 'Driver', 'Cancellation Reason', 'Created By', 'Created At', 'Last Updated']
    const lines = [head.map(csvCell).join(',')]
    for (const b of rows) {
      lines.push([
        b.bookingNo || 'DRAFT', b.status, b.bookingType, b.priority === 'Advance' ? 'Advance' : 'Normal', b.storeId, b.trip?.travelDate, b.trip?.pickupTime,
        b.requester?.name, b.requester?.mobile, b.brandHost?.name, b.trip?.pickup?.address, b.trip?.drop?.address,
        b.trip?.passengers ?? '', b.allocation?.vehicleNumber || '', b.allocation?.driverName || '',
        b.cancellation?.reason || '', b.createdBy?.name, b.createdAt, b.updatedAt,
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

// ============ single booking, meta, availability ============
async function getBooking(ctx, id) {
  const { db, auth, json } = ctx
  const b = await loadBooking(db, auth, id)
  const history = await db.collection('booking_status_history').find({ bookingId: id }).sort({ seq: 1 }).toArray()
  const out = { booking: present(b, auth), history: history.map(({ _id, seq, ...h }) => h) }
  if (b.status === 'Completed') out.feedback = await feedbackStatus(db, id)
  if (auth.role === 'admin') {
    const audit = await db.collection('booking_audit').find({ bookingId: id }).sort({ seq: 1 }).toArray()
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
  // Names only, for the register's vehicle and driver filters
  const [vs, ds] = await Promise.all([db.collection('vehicles').find({}).toArray(), db.collection('drivers').find({}).toArray()])
  const inPool = (loc) => auth.role === 'admin' || (!!loc && loc === auth.storeId)
  return json({
    stores: auth.role === 'admin' ? STORE_IDS : [auth.storeId],
    me: { name: auth.name, username: auth.username, role: auth.role, storeId: auth.storeId || '', empId: me?.empId || '', mobile: me?.mobile || '' },
    brandHosts,
    vehicles: vs.filter(v => inPool(v.assignedLocation)).map(v => ({ id: v.id, vehicleNumber: v.vehicleNumber })),
    drivers: ds.filter(d => inPool(d.assignedLocation)).map(d => ({ id: d.id, name: d.name })),
    canAllocate: ALLOCATE_ROLES.includes(auth.role),
    canCreate: WRITE_ROLES.includes(auth.role),
    modes: BOOKING_MODES,
    departments: DEPARTMENTS,
    today: todayIST(),
  })
}

async function availabilityRoute(ctx) {
  const { db, auth, request, json } = ctx
  if (await limited(db, `bk-avail|${auth.username}`, 60)) throw new HttpError(429, 'Too many availability checks. Please wait a moment.')
  const sp = new URL(request.url).searchParams
  let storeId = auth.role === 'admin' ? clean(sp.get('storeId'), 20) : auth.storeId
  let trip = null, passengers = null, party = '', b = null

  const bookingId = clean(sp.get('bookingId'), 40)
  if (bookingId) {
    b = await loadBooking(db, auth, bookingId)
    storeId = b.storeId; trip = b.trip; passengers = b.trip?.passengers; party = b.party
  }
  if (sp.get('travelDate')) { // the form's unsaved values win over the saved booking
    const stops = Math.min(parseInt(sp.get('stops'), 10) || 0, 5)
    trip = {
      travelDate: clean(sp.get('travelDate'), 10), pickupTime: clean(sp.get('pickupTime'), 5),
      expectedDropTime: clean(sp.get('expectedDropTime'), 5), tripType: clean(sp.get('tripType'), 20),
      returnLeg: { date: clean(sp.get('returnDate'), 10), time: clean(sp.get('returnTime'), 5) },
      stops: Array.from({ length: stops }, () => ({ address: 'stop' })),
    }
    passengers = sp.get('passengers'); party = clean(sp.get('party'), 20)
  }
  if (!trip) throw new HttpError(400, 'Enter the travel date and pickup time to check availability')
  if (auth.role === 'admin' && !STORE_IDS.includes(storeId)) throw new HttpError(400, 'Choose a showroom first')

  const showMobile = isStaff(auth) || (!!b && b.createdBy?.userId === auth.userId)
  const result = await computeAvailability(db, {
    storeId, trip, passengers, isDelivery: party === 'delivery', excludeBookingId: b?.id, showDriverMobile: showMobile,
  })
  if (result.error) throw new HttpError(400, result.error)
  return json(result)
}

// ============ create ============
async function createBooking(ctx) {
  const { db, auth, body, json } = ctx
  if (await limited(db, `bk-create|${auth.username}`, 30)) throw new HttpError(429, 'Too many bookings in a short time. Please wait a minute.')

  const wantsConfirm = body.saveAs === 'Confirmed'
  const saveAs = body.saveAs === 'Requested' || wantsConfirm ? 'Requested' : 'Draft'
  const storeId = resolveStore(auth, body)
  const clientRequestId = clean(body.clientRequestId, 64)
  const col = db.collection('bookings')

  if (clientRequestId) {
    const dup = await col.findOne({ 'createdBy.userId': auth.userId, clientRequestId })
    if (dup) return json({ booking: present(dup, auth), duplicate: true })
  }

  const { value, errors } = normalizeBooking(body, { submit: saveAs === 'Requested', firstSubmit: saveAs === 'Requested' })
  if (errors.length) throw failValidation(errors)
  await attachRoute(ctx, value.trip, null)

  const brandHost = await resolveBrandHost(db, auth, clean(body.brandHostUsername, 60))
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
    allocation: null,
    schedule: null,
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

  if (wantsConfirm) return await confirmAfterSave(ctx, doc.id)
  return json({ booking: present(doc, auth) })
}

// Confirm right after a save. If the vehicle or driver is no longer free, the booking stays safely
// saved as Requested and the reason is returned, so nothing the Brand Host typed is lost.
async function confirmAfterSave(ctx, id) {
  const { db, auth, body, json } = ctx
  const saved = await db.collection('bookings').findOne({ id })
  try {
    const fresh = await confirmCore(ctx, saved, { vehicleId: clean(body.vehicleId, 64), driverId: clean(body.driverId, 64) })
    return json({ booking: present(fresh, auth) })
  } catch (e) {
    if (!(e instanceof HttpError)) throw e
    const cur = await db.collection('bookings').findOne({ id })
    return json({ booking: present(cur, auth), confirmError: e.message })
  }
}

// ============ edit ============
const EDIT_KEYS = ['bookingType', 'source', 'priority', 'department', 'remarks', 'requester', 'delivery', 'trip']

// Everything that decides whether the same vehicle and driver still fit
const scheduleSig = (trip, party) => [
  trip?.travelDate, trip?.pickupTime, trip?.expectedDropTime, trip?.tripType,
  trip?.returnLeg?.date, trip?.returnLeg?.time, (trip?.stops || []).length, trip?.passengers, party === 'delivery',
]

async function updateBooking(ctx, id) {
  const { db, auth, body, json } = ctx
  const prev = await loadBooking(db, auth, id)
  if (!canManage(prev, auth)) throw new HttpError(403, 'You can only edit bookings you created')
  if (!EDITABLE_STATUSES.includes(prev.status)) throw new HttpError(409, `A ${prev.status} booking can no longer be edited here`)
  if (Number(body.version) !== prev.version) throw new HttpError(409, CHANGED)

  const submitting = prev.status === 'Draft' && (body.saveAs === 'Requested' || body.saveAs === 'Confirmed')
  const { value, errors } = normalizeBooking(body, { submit: prev.status !== 'Draft' || submitting, firstSubmit: submitting })
  if (errors.length) throw failValidation(errors)
  await attachRoute(ctx, value.trip, prev.trip)

  const type = BOOKING_TYPES.find(t => t.value === value.bookingType)
  const next = {
    bookingType: value.bookingType, party: value.party, legs: type.legs, source: value.source, priority: value.priority,
    department: value.department, remarks: value.remarks, requester: value.requester, delivery: value.delivery, trip: value.trip,
    customerKey: customerKeyOf(value.party, value.requester),
  }
  const changedFields = EDIT_KEYS.filter(k => JSON.stringify(prev[k] ?? null) !== JSON.stringify(next[k] ?? null))

  const now = new Date().toISOString()
  const set = { ...next, updatedAt: now, updatedBy: actorOf(auth) }
  if (submitting) { set.status = 'Requested'; set.bookingNo = prev.bookingNo || await nextBookingNo(db) }

  // Moving the time, passengers or route of a booking that already has a vehicle, or choosing another
  // vehicle or driver, is checked again from scratch. A failed check changes nothing.
  const vId = clean(body.vehicleId, 64)
  const dId = clean(body.driverId, 64)
  const scheduleChanged = JSON.stringify(scheduleSig(prev.trip, prev.party)) !== JSON.stringify(scheduleSig(next.trip, next.party))
  let plan = null
  let chain = null
  let details
  if (prev.status === 'Vehicle Assigned' && prev.allocation) {
    const vehicleId = vId || prev.allocation.vehicleId
    const driverId = dId || prev.allocation.driverId
    const allocChanged = !sameAlloc(prev.allocation, vehicleId, driverId)
    if (scheduleChanged || allocChanged) {
      if (!ALLOCATE_ROLES.includes(auth.role)) throw new HttpError(403, 'You are not allowed to change the time or vehicle of an allocated booking')
      plan = await planAllocation(ctx, { booking: { ...prev, priority: next.priority }, trip: next.trip, party: next.party, vehicleId, driverId })
      set.allocation = plan.allocation
      set.schedule = plan.schedule
      details = { from: { vehicle: prev.allocation.vehicleNumber, driver: prev.allocation.driverName }, to: { vehicle: plan.allocation.vehicleNumber, driver: plan.allocation.driverName } }
    }
  } else if (prev.status === 'Confirmed' && vId && dId) {
    if (!ALLOCATE_ROLES.includes(auth.role)) throw new HttpError(403, 'You are not allowed to allocate vehicles')
    plan = await planAllocation(ctx, { booking: { ...prev, priority: next.priority }, trip: next.trip, party: next.party, vehicleId: vId, driverId: dId })
    set.allocation = plan.allocation
    set.schedule = plan.schedule
    set.status = 'Vehicle Assigned'
    chain = ['Confirmed', 'Driver Assigned', 'Vehicle Assigned']
    for (let i = 0; i < chain.length - 1; i++) assertTransition(chain[i], chain[i + 1])
    details = { to: { vehicle: plan.allocation.vehicleNumber, driver: plan.allocation.driverName } }
  }

  const update = { $set: set, $inc: { version: 1 } }
  const timeChanged = prev.trip?.travelDate !== next.trip.travelDate || prev.trip?.pickupTime !== next.trip.pickupTime
  if (prev.status !== 'Draft' && timeChanged) {
    update.$push = { scheduleHistory: {
      at: now, by: actorOf(auth),
      from: { travelDate: prev.trip?.travelDate, pickupTime: prev.trip?.pickupTime },
      to: { travelDate: next.trip.travelDate, pickupTime: next.trip.pickupTime },
    } }
  }

  await saveWithPlan(db, plan, { id, version: prev.version, status: prev.status }, update)
  await record(db, auth, id, submitting ? 'Edited and submitted' : plan ? 'Edited and reallocated' : 'Edited', {
    changedFields, ...(submitting ? { from: 'Draft', to: 'Requested' } : {}), ...(chain ? { chain } : {}), ...(details ? { details } : {}),
  })

  if (body.saveAs === 'Confirmed' && (submitting || prev.status === 'Requested')) return await confirmAfterSave(ctx, id)
  const fresh = await db.collection('bookings').findOne({ id })
  return json({ booking: present(fresh, auth) })
}

// ============ status changes ============
async function changeStatus(ctx, id) {
  const { db, auth, body, json } = ctx
  const target = clean(body.status, 30)
  if (!STATUSES.includes(target)) throw new HttpError(400, 'Unknown status')
  const b = await loadBooking(db, auth, id)
  if (!canManage(b, auth)) throw new HttpError(403, 'You can only change bookings you created')
  assertTransition(b.status, target)
  if (!DIRECT_STATUS_TARGETS.includes(target)) throw new HttpError(400, `Use Confirm or Allocate to move a booking to ${target}`)

  const now = new Date().toISOString()
  const set = { status: target, updatedAt: now, updatedBy: actorOf(auth) }
  let remarks = ''

  if (target === 'Requested') {
    const { errors } = normalizeBooking(b, { submit: true, firstSubmit: true })
    if (errors.length) throw failValidation(errors)
    set.bookingNo = b.bookingNo || await nextBookingNo(db)
  }
  if (target === 'Cancelled') {
    const reason = cleanMultiline(body.reason, 300)
    if (reason.length < 3) throw new HttpError(400, 'A cancellation reason is required', { reason: 'Enter a reason' })
    set.cancellation = { reason, by: actorOf(auth), at: now }
    remarks = reason
  }

  await saveWithPlan(db, null, { id, status: b.status, version: b.version }, { $set: set, $inc: { version: 1 } })
  // A cancelled booking gives its vehicle and driver straight back
  if (target === 'Cancelled') await releaseBooking(db, id)

  await record(db, auth, id, `Status: ${b.status} → ${target}`, { from: b.status, to: target, remarks })
  const fresh = await db.collection('bookings').findOne({ id })
  return json({ booking: present(fresh, auth) })
}

async function confirmRoute(ctx, id) {
  const { db, auth, body, json } = ctx
  const b = await loadBooking(db, auth, id)
  const fresh = await confirmCore(ctx, b, { vehicleId: clean(body.vehicleId, 64), driverId: clean(body.driverId, 64) })
  return json({ booking: present(fresh, auth) })
}

async function allocateRoute(ctx, id) {
  const { db, auth, body, json } = ctx
  const b = await loadBooking(db, auth, id)
  const fresh = await allocateCore(ctx, b, { vehicleId: clean(body.vehicleId, 64), driverId: clean(body.driverId, 64) })
  return json({ booking: present(fresh, auth) })
}


// ============ trip lifecycle (Phase 5A) ============
// Start, close and no-show belong to the Brand Host who created the booking, because each booking is owned by one showroom Brand Host.
// Admin, Store Admin and other Brand Hosts can see the trip but cannot change it.
const creatorOnly = (b, auth, what) => {
  if (!canManage(b, auth)) throw new HttpError(403, `Only the Brand Host who created this booking can ${what}`)
}

async function startTrip(ctx, id) {
  const { db, auth, json } = ctx
  const b = await loadBooking(db, auth, id)
  creatorOnly(b, auth, 'start the trip')
  if (!STARTABLE_STATUSES.includes(b.status)) throw new HttpError(409, `A ${b.status} booking cannot be started`)
  assertTransition(b.status, 'In Progress')
  if (!b.allocation) throw new HttpError(409, 'Assign a vehicle and driver before starting the trip')
  if ((b.trip?.travelDate || '9999') > todayIST()) throw new HttpError(409, `This trip is for ${b.trip.travelDate}. It can be started on the travel day.`)
  const now = new Date().toISOString()
  await saveWithPlan(db, null, { id, status: b.status, version: b.version }, {
    $set: { status: 'In Progress', actual: { startedAt: now, startedBy: actorOf(auth) }, updatedAt: now, updatedBy: actorOf(auth) }, $inc: { version: 1 },
  })
  await record(db, auth, id, `Status: ${b.status} → In Progress`, { from: b.status, to: 'In Progress', remarks: 'Trip started' })
  return json({ booking: present(await db.collection('bookings').findOne({ id }), auth) })
}

const istDateOf = (iso) => new Date(Date.parse(iso) + 330 * 60000).toISOString().slice(0, 10)

async function completeTrip(ctx, id) {
  const { db, auth, body, json } = ctx
  const b = await loadBooking(db, auth, id)
  creatorOnly(b, auth, 'close the trip')
  if (b.status !== 'In Progress') throw new HttpError(409, `A ${b.status} booking cannot be completed. Only a trip in progress can be closed.`)
  assertTransition(b.status, 'Completed')

  const nowMs = Date.now()
  let endedAt = new Date(nowMs).toISOString()
  const endTime = clean(body.endTime, 5)
  if (endTime) {
    if (!isValidTime(endTime)) throw new HttpError(400, 'Enter the end time as HH:MM', { endTime: 'Use HH:MM' })
    // The end time is on the day the trip was started
    const ms = Date.parse(toStartAt(istDateOf(b.actual?.startedAt || new Date(nowMs).toISOString()), endTime))
    if (ms > nowMs + 5 * 60000) throw new HttpError(400, 'The end time cannot be in the future', { endTime: 'Cannot be in the future' })
    if (b.actual?.startedAt && ms < Date.parse(b.actual.startedAt) - 60000) throw new HttpError(400, 'The end time is before the trip started', { endTime: 'Before the start time' })
    endedAt = new Date(ms).toISOString()
  }
  let km = null
  if (body.km !== undefined && body.km !== null && body.km !== '') {
    km = Number(body.km)
    if (!Number.isFinite(km) || km < 0 || km > TRIP.maxKm) throw new HttpError(400, `Kilometres must be between 0 and ${TRIP.maxKm}`, { km: `0 to ${TRIP.maxKm}` })
    km = Math.round(km * 10) / 10
  }
  const notes = cleanMultiline(body.notes, 300)
  const now = new Date(nowMs).toISOString()
  const actual = { ...(b.actual || {}), endedAt, closedAt: now, closedBy: actorOf(auth), ...(km !== null ? { km } : {}), ...(notes ? { notes } : {}) }
  await saveWithPlan(db, null, { id, status: 'In Progress', version: b.version }, {
    $set: { status: 'Completed', actual, updatedAt: now, updatedBy: actorOf(auth) }, $inc: { version: 1 },
  })
  // The vehicle and driver are free again as soon as the trip is closed
  await releaseBooking(db, id)
  await record(db, auth, id, 'Status: In Progress → Completed', { from: 'In Progress', to: 'Completed', remarks: notes, details: { km, endedAt } })
  return json({ booking: present(await db.collection('bookings').findOne({ id }), auth) })
}

async function noShowTrip(ctx, id) {
  const { db, auth, body, json } = ctx
  const b = await loadBooking(db, auth, id)
  creatorOnly(b, auth, 'mark this trip as a no-show')
  if (!NO_SHOW_STATUSES.includes(b.status)) throw new HttpError(409, `A ${b.status} booking cannot be marked as a no-show`)
  assertTransition(b.status, 'No-Show')
  const reason = cleanMultiline(body.reason, 300)
  if (reason.length < 3) throw new HttpError(400, 'A reason is required', { reason: 'Enter a reason' })
  const now = new Date().toISOString()
  await saveWithPlan(db, null, { id, status: b.status, version: b.version }, {
    $set: { status: 'No-Show', noShow: { reason, by: actorOf(auth), at: now }, updatedAt: now, updatedBy: actorOf(auth) }, $inc: { version: 1 },
  })
  await releaseBooking(db, id)
  await record(db, auth, id, `Status: ${b.status} → No-Show`, { from: b.status, to: 'No-Show', remarks: reason })
  return json({ booking: present(await db.collection('bookings').findOne({ id }), auth) })
}

// Trips in progress for the showroom. Everyone in the showroom sees them; `canAct` is true only for the creator.
async function openTrips(ctx) {
  const { db, auth, json } = ctx
  const rows = await db.collection('bookings').find({ ...scopeFilter(auth), status: 'In Progress' }).sort({ 'trip.startAt': 1 }).limit(100).toArray()
  const items = rows.map(b => ({
    id: b.id, bookingNo: b.bookingNo, storeId: b.storeId, bookingType: b.bookingType, name: b.requester?.name || '',
    travelDate: b.trip?.travelDate || '', pickupTime: b.trip?.pickupTime || '', expectedDropTime: b.trip?.expectedDropTime || '',
    pickup: b.trip?.pickup?.address || '', drop: b.trip?.drop?.address || '',
    vehicleNumber: b.allocation?.vehicleNumber || '', driverName: b.allocation?.driverName || '',
    startedAt: b.actual?.startedAt || null, overdue: isOverdue(b), plannedEndAt: b.schedule?.endAt || null,
    createdByName: b.createdBy?.name || b.createdBy?.username || '', canAct: canManage(b, auth),
  }))
  return json({ items, overdue: items.filter(x => x.overdue).length })
}

// ============ feedback (Phase 5A) ============
async function feedbackLinks(ctx, id) {
  const { db, auth, body, json } = ctx
  const b = await loadBooking(db, auth, id)
  creatorOnly(b, auth, 'request feedback')
  try {
    const links = await issueLinks(db, b, { by: actorOf(auth), consent: body.consent === true })
    if (links.some(l => l.token)) {
      await record(db, auth, id, 'Feedback links created', { details: { roles: links.filter(l => l.token).map(l => l.role), customerAgreed: body.consent === true } })
    }
    // The links are shown once. Only a hash is stored, so they cannot be shown again.
    return json({ links })
  } catch (e) {
    if (e instanceof FeedbackError) throw new HttpError(e.status, e.message, e.fields)
    throw e
  }
}

async function feedbackSummary(ctx) {
  const { db, auth, json } = ctx
  if (!isStaff(auth)) throw new HttpError(403, 'Feedback summaries are for Admin and Store Admin')
  const days = Math.min(Math.max(parseInt(new URL(ctx.request.url).searchParams.get('days'), 10) || 90, 1), 365)
  return json(await feedbackReport(db, scopeFilter(auth), { days }))
}

// ============ same-day alerts ============
// Everything travelling today for the signed-in user's showroom, with the ones that still need a vehicle and driver first.
// Contact numbers are never included.
const ALERT_STATUSES = ['Requested', 'Confirmed', 'Driver Assigned', 'Vehicle Assigned', 'Driver Notified', 'In Progress']
async function todayAlerts(ctx) {
  const { db, auth, json } = ctx
  const today = todayIST()
  const rows = await db.collection('bookings')
    .find({ ...scopeFilter(auth), 'trip.travelDate': today, status: { $in: ALERT_STATUSES } })
    .sort({ 'trip.startAt': 1 }).limit(100).toArray()
  const now = nowTimeIST()
  const items = rows.map(b => {
    const needsAction = !b.allocation && (b.status === 'Requested' || b.status === 'Confirmed')
    return {
      id: b.id, bookingNo: b.bookingNo, storeId: b.storeId, status: b.status, mode: b.priority === 'Advance' ? 'Advance' : 'Normal',
      bookingType: b.bookingType, name: b.requester?.name || '', pickupTime: b.trip?.pickupTime || '',
      pickup: b.trip?.pickup?.address || '', drop: b.trip?.drop?.address || '',
      allocated: !!b.allocation, vehicleNumber: b.allocation?.vehicleNumber || '', driverName: b.allocation?.driverName || '',
      needsAction, overdue: needsAction && (b.trip?.pickupTime || '99:99') < now, canAct: canOperate(b, auth),
    }
  }).sort((x, y) => Number(y.needsAction) - Number(x.needsAction) || x.pickupTime.localeCompare(y.pickupTime))
  return json({ date: today, time: now, items, needsAction: items.filter(x => x.needsAction).length })
}

// ============ entry point ============
// ---------- places and routes (Phase 3) ----------
const geoLimit = async (ctx, kind, max) => {
  const who = ctx.auth.userId || ctx.auth.username
  if (await limited(ctx.db, `geo:${kind}:${who}`, max)) throw new HttpError(429, 'Too many map lookups. Please wait a moment.')
}
const asHttp = (e) => (e instanceof GeoError ? new HttpError(e.status, e.message) : e)

async function geoSearch(ctx) {
  const q = new URL(ctx.request.url).searchParams.get('q')
  await geoLimit(ctx, 'search', GEO.searchPerMinute)
  try { return ctx.json({ places: await searchPlaces(q, { fetch: ctx.geo.fetch }) }) } catch (e) { throw asHttp(e) }
}

async function geoRoute(ctx) {
  await geoLimit(ctx, 'route', GEO.routePerMinute)
  try {
    const route = await routeEstimate(ctx.body.points, { fetch: ctx.geo.fetch })
    return ctx.json(route ? { route } : { route: null, message: 'No road route was found between these places.' })
  } catch (e) { throw asHttp(e) }
}

// Map pictures are plain public map data; the limit only stops one account from hammering the provider.
const tileUse = new Map()
async function geoTile(ctx, z, x, y) {
  const who = ctx.auth.userId || ctx.auth.username
  const slot = Math.floor(Date.now() / 60000)
  const rec = tileUse.get(who)
  const n = rec && rec.slot === slot ? rec.n + 1 : 1
  if (tileUse.size > 500) tileUse.clear()
  tileUse.set(who, { slot, n })
  if (n > GEO.tilesPerMinute) throw new HttpError(429, 'Too many map pictures requested. Please wait a moment.')
  try {
    const t = await fetchTile(z, x, y, { fetch: ctx.geo.fetch })
    return new Response(t.body, { status: 200, headers: { 'Content-Type': t.type, 'Cache-Control': 'private, max-age=604800', 'X-Content-Type-Options': 'nosniff' } })
  } catch (e) { throw asHttp(e) }
}

// The distance and time saved on a booking, for reports. Best effort: if the map service is down the booking still saves.
// Unchanged places reuse the saved estimate, so editing a booking never creates a spurious change.
async function attachRoute(ctx, trip, prevTrip) {
  const sig = routeSignature([trip.pickup, ...(trip.stops || []), trip.drop])
  if (!sig) { trip.route = null; return }
  if (prevTrip?.route?.sig === sig) { trip.route = prevTrip.route; return }
  try {
    const r = await routeForTrip(trip, { fetch: ctx.geo.fetch })
    trip.route = r ? { ...r, estimatedAt: new Date().toISOString() } : null
  } catch (e) {
    trip.route = null
  }
}

export async function handleBookings({ db, request, path, auth, body, json, geo }) {
  try {
    if (!auth || auth.via !== 'session') throw new HttpError(401, 'Not signed in')
    if (!BOOKING_ROLES.includes(auth.role)) throw new HttpError(403, 'You do not have access to vehicle bookings')
    if (auth.role !== 'admin' && !auth.storeId) throw new HttpError(403, 'Your account is not linked to a showroom')
    const method = request.method
    if (method !== 'GET' && !sameOrigin(request)) throw new HttpError(403, 'Forbidden')
    // Admins and Store Admins can view bookings but cannot create or change them
    if (method !== 'GET' && !WRITE_ROLES.includes(auth.role)) throw new HttpError(403, 'Only Brand Hosts can create or change bookings')

    await ensureIndexes(db)
    const ctx = { db, request, auth, body: body || {}, json, geo: geo || {} }
    const parts = path.split('/').slice(1) // after "bookings"

    if (parts.length === 0) {
      if (method === 'GET') return await listBookings(ctx)
      if (method === 'POST') return await createBooking(ctx)
    } else if (parts.length === 1) {
      if (method === 'GET' && parts[0] === 'meta') return await getMeta(ctx)
      if (method === 'GET' && parts[0] === 'availability') return await availabilityRoute(ctx)
      if (method === 'GET' && parts[0] === 'alerts') return await todayAlerts(ctx)
      if (method === 'GET' && parts[0] === 'open-trips') return await openTrips(ctx)
      if (method === 'GET' && parts[0] === 'feedback') return await feedbackSummary(ctx)
      if (method === 'GET') return await getBooking(ctx, parts[0])
      if (method === 'PUT') return await updateBooking(ctx, parts[0])
    } else if (parts.length === 5 && parts[0] === 'geo' && parts[1] === 'tile' && method === 'GET') {
      return await geoTile(ctx, parts[2], parts[3], parts[4].replace(/\.png$/, ''))
    } else if (parts.length === 2 && parts[0] === 'geo') {
      if (method === 'GET' && parts[1] === 'search') return await geoSearch(ctx)
      if (method === 'POST' && parts[1] === 'route') return await geoRoute(ctx)
    } else if (parts.length === 2 && method === 'POST') {
      if (parts[1] === 'status') return await changeStatus(ctx, parts[0])
      if (parts[1] === 'confirm') return await confirmRoute(ctx, parts[0])
      if (parts[1] === 'allocate') return await allocateRoute(ctx, parts[0])
      if (parts[1] === 'start') return await startTrip(ctx, parts[0])
      if (parts[1] === 'complete') return await completeTrip(ctx, parts[0])
      if (parts[1] === 'no-show') return await noShowTrip(ctx, parts[0])
      if (parts[1] === 'feedback-links') return await feedbackLinks(ctx, parts[0])
    }
    throw new HttpError(405, 'Method not allowed')
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message, ...(e.fields ? { fields: e.fields } : {}) }, e.status)
    // Log the error type only: database errors can quote customer data
    console.error('Booking error:', e?.name, e?.code || '')
    return json({ error: 'Something went wrong with the booking request.' }, 500)
  }
}
