// lib/bookings.js
//
// Rules for the Vehicle Booking module. There is no database or web code in
// here (except the booking ID counter), so everything can be tested on its own.
// All dates and times are India time (IST).

export const BOOKING_TYPES = [
  'Customer Pickup', 'Customer Drop', 'Customer Pickup & Drop',
  'Employee Pickup', 'Employee Drop', 'Employee Pickup & Drop',
  'Item Delivery', 'Other',
]
export const BOOKING_SOURCES = ['Phone Call', 'In-Person Request', 'Internal Request', 'Other']
export const PRIORITIES = ['Normal', 'Urgent']
export const TRIP_TYPES = ['One-Way', 'Round Trip', 'Multiple Stops']
export const PURPOSES = ['Customer Visit', 'Store Visit', 'Airport/Railway Transfer', 'Employee Transport', 'Item Delivery', 'Other']
export const CUSTOMER_TYPES = ['New Customer', 'Existing Customer', 'Other']
export const ITEM_CATEGORIES = ['Jewellery', 'Documents', 'Packaging Material', 'Other']

export const STATUSES = [
  'Draft', 'Requested', 'Confirmed', 'Driver Assigned', 'Vehicle Assigned', 'Driver Notified',
  'In Progress', 'Completed', 'Cancelled', 'No-Show', 'Failed Delivery', 'Rescheduled',
]

// Which status a booking may move to next. Enforced on the server.
// 'Rescheduled' closes the old booking; the new schedule is a new booking that links back to it.
const TRANSITIONS = {
  'Draft': ['Requested', 'Confirmed', 'Cancelled'],
  'Requested': ['Confirmed', 'Cancelled', 'Rescheduled'],
  'Confirmed': ['Driver Assigned', 'Vehicle Assigned', 'Driver Notified', 'In Progress', 'Cancelled', 'Rescheduled', 'No-Show'],
  'Driver Assigned': ['Vehicle Assigned', 'Driver Notified', 'In Progress', 'Cancelled', 'Rescheduled', 'No-Show'],
  'Vehicle Assigned': ['Driver Assigned', 'Driver Notified', 'In Progress', 'Cancelled', 'Rescheduled', 'No-Show'],
  'Driver Notified': ['In Progress', 'Cancelled', 'Rescheduled', 'No-Show'],
  'In Progress': ['Completed', 'No-Show', 'Failed Delivery', 'Cancelled'],
  'Completed': [], 'Cancelled': [], 'No-Show': [], 'Failed Delivery': [], 'Rescheduled': [],
}
const REASON_REQUIRED = ['Cancelled', 'No-Show', 'Failed Delivery', 'Rescheduled']
export const EDITABLE_STATUSES = ['Draft', 'Requested', 'Confirmed', 'Driver Assigned', 'Vehicle Assigned', 'Driver Notified']
export const TERMINAL_STATUSES = ['Completed', 'Cancelled', 'No-Show', 'Failed Delivery', 'Rescheduled']

export const categoryOf = (type) =>
  typeof type !== 'string' ? null
  : type.startsWith('Customer') ? 'customer'
  : type.startsWith('Employee') ? 'employee'
  : type === 'Item Delivery' ? 'delivery'
  : type === 'Other' ? 'other' : null

// ---------- small helpers ----------

const IST = '+05:30'
const IST_OFFSET_MS = 5.5 * 3600 * 1000

// Plain text only: non-strings (for example objects sent to attack the database) become ''
export const str = (v, max) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max) : '')

export function isDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const [y, m, d] = s.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d))
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d
}
export const isTime = (s) => typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s)
export const toEpoch = (date, time) => Date.parse(`${date}T${time}:00${IST}`)
export const istToday = (now = Date.now()) => new Date(now + IST_OFFSET_MS).toISOString().slice(0, 10)

// 10-digit Indian mobile number, or null. Handles +91, 91, 0 prefixes, spaces and dashes.
export function normalisePhone(raw) {
  if (typeof raw !== 'string' && typeof raw !== 'number') return null
  let d = String(raw).replace(/\D/g, '')
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2)
  else if (d.length === 11 && d.startsWith('0')) d = d.slice(1)
  return /^[6-9]\d{9}$/.test(d) ? d : null
}
export const maskPhone = (p) => (typeof p === 'string' && p.length >= 6 ? `${p.slice(0, 2)}••••••${p.slice(-2)}` : p ? '••••' : '')

// Item delivery notes must not carry values, weights or inventory details
const SENSITIVE = /(₹|\brs\.?|\binr)\s*\d|\d\s*(lakh|lakhs|crore|crores)\b|\bworth\b|\bcarats?\b|\b\d+(\.\d+)?\s*(g|gm|gms|grams?|kg)\b/i

function place(v, label, errors, key, required = true) {
  const p = v && typeof v === 'object' && !Array.isArray(v) ? v : {}
  const address = str(p.address, 250)
  if (address.length < 3) {
    if (required) errors[key] = `${label} is required`
    return null
  }
  const lat = Number(p.lat)
  const lng = Number(p.lng)
  const hasPos = p.lat != null && p.lng != null && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
  return { address, landmark: str(p.landmark, 120), placeId: str(p.placeId, 200), source: str(p.source, 20) || 'manual', ...(hasPos ? { lat, lng } : {}) }
}

// ---------- validation ----------

export function validateBookingInput(input, { today = istToday(), allowPast = false } = {}) {
  const e = {}
  const b = input && typeof input === 'object' && !Array.isArray(input) ? input : {}
  const pick = (list, v, fallback) => (list.includes(v) ? v : fallback)

  const cat = categoryOf(b.bookingType)
  if (!BOOKING_TYPES.includes(b.bookingType)) e.bookingType = 'Select a booking type'

  const out = {
    bookingType: BOOKING_TYPES.includes(b.bookingType) ? b.bookingType : '',
    category: cat,
    bookingSource: pick(BOOKING_SOURCES, b.bookingSource, 'Phone Call'),
    priority: pick(PRIORITIES, b.priority, 'Normal'),
    showroom: str(b.showroom, 60),
    remarks: str(b.remarks, 500),
  }
  if (!out.showroom) e.showroom = 'Requesting showroom or department is required'

  const phone = (value, key, label) => {
    const p = normalisePhone(value)
    if (!p) e[key] = `Enter a valid 10-digit mobile number for ${label}`
    return p || ''
  }
  const needText = (value, key, label, max = 100) => {
    const s = str(value, max)
    if (!s) e[key] = `${label} is required`
    return s
  }

  if (cat === 'customer') {
    out.customerName = needText(b.customerName, 'customerName', 'Customer name')
    out.customerPhone = phone(b.customerPhone, 'customerPhone', 'the customer')
    out.crmId = str(b.crmId, 40)
    out.customerRef = out.crmId ? `crm:${out.crmId.toLowerCase()}` : out.customerPhone ? `ph:${out.customerPhone}` : ''
    out.customerType = pick(CUSTOMER_TYPES, b.customerType, '')
    out.preferredLanguage = str(b.preferredLanguage, 30)
  } else if (cat === 'employee') {
    out.employeeName = needText(b.employeeName, 'employeeName', 'Employee name')
    out.employeePhone = phone(b.employeePhone, 'employeePhone', 'the employee')
    out.employeeId = str(b.employeeId, 30)
    out.department = str(b.department, 60)
    out.approvingManager = str(b.approvingManager, 100)
  } else if (cat === 'delivery') {
    out.requesterName = needText(b.requesterName, 'requesterName', 'Requester name')
    out.requesterPhone = phone(b.requesterPhone, 'requesterPhone', 'the requester')
    out.sendingDept = str(b.sendingDept, 60) || out.showroom
    out.receivingDept = str(b.receivingDept, 60)
    out.recipientName = str(b.recipientName, 100)
    out.recipientPhone = ''
    if (!out.receivingDept && !out.recipientName) e.recipientName = 'Enter the receiving showroom/department or the authorised recipient'
    if (out.recipientName) out.recipientPhone = phone(b.recipientPhone, 'recipientPhone', 'the recipient')
    out.itemCategory = pick(ITEM_CATEGORIES, b.itemCategory, '')
    if (!out.itemCategory) e.itemCategory = 'Select an item category'
    out.deliveryRef = str(b.deliveryRef, 60)
    out.itemDescription = str(b.itemDescription, 200)
    out.specialHandling = str(b.specialHandling, 300)
    out.authorisationRef = str(b.authorisationRef, 60)
    for (const k of ['itemDescription', 'specialHandling']) {
      if (SENSITIVE.test(out[k])) e[k] = 'Do not enter item values, weights or inventory details here. Use the authorised reference number.'
    }
    if (SENSITIVE.test(out.remarks)) e.remarks = 'Do not enter item values, weights or inventory details in remarks.'
  } else if (cat === 'other') {
    out.contactName = needText(b.contactName, 'contactName', 'Contact name')
    out.contactPhone = phone(b.contactPhone, 'contactPhone', 'the contact')
  }

  // Trip details
  out.travelDate = str(b.travelDate, 10)
  if (!isDate(out.travelDate)) e.travelDate = 'Select a valid travel date'
  else if (!allowPast && out.travelDate < today) e.travelDate = 'Travel date cannot be in the past'
  out.pickupTime = str(b.pickupTime, 5)
  if (!isTime(out.pickupTime)) e.pickupTime = 'Enter the pickup time (HH:MM)'
  out.expectedDropTime = str(b.expectedDropTime, 5)
  if (out.expectedDropTime && !isTime(out.expectedDropTime)) e.expectedDropTime = 'Enter the drop time as HH:MM'

  out.tripType = pick(TRIP_TYPES, b.tripType, 'One-Way')
  out.pickup = place(b.pickup, 'Pickup location', e, 'pickup')
  out.drop = place(b.drop, 'Drop location', e, 'drop')
  out.stops = (Array.isArray(b.stops) ? b.stops : []).slice(0, 5).map((s) => place(s, 'Stop', {}, 'x', false)).filter(Boolean)
  if (out.tripType === 'Multiple Stops' && out.stops.length === 0) e.stops = 'Add at least one additional stop'

  if (out.tripType === 'Round Trip') {
    out.returnDate = str(b.returnDate, 10)
    out.returnTime = str(b.returnTime, 5)
    out.returnPickup = place(b.returnPickup, 'Return pickup', {}, 'x', false)
    if (!isDate(out.returnDate)) e.returnDate = 'Select the return date'
    if (!isTime(out.returnTime)) e.returnTime = 'Enter the return pickup time'
    if (!e.returnDate && !e.returnTime && !e.travelDate && !e.pickupTime && toEpoch(out.returnDate, out.returnTime) <= toEpoch(out.travelDate, out.pickupTime)) {
      e.returnTime = 'Return time must be after the pickup time'
    }
  }

  if (cat !== 'delivery') {
    const n = Number(b.passengers)
    if (!Number.isInteger(n) || n < 1 || n > 60) e.passengers = 'Enter the number of passengers (1 to 60)'
    out.passengers = Number.isInteger(n) ? n : 0
  } else {
    out.passengers = 0
  }
  out.purpose = pick(PURPOSES, b.purpose, { customer: 'Customer Visit', employee: 'Employee Transport', delivery: 'Item Delivery', other: 'Other' }[cat] || '')
  out.luggage = str(b.luggage, 200)
  out.instructions = str(b.instructions, 500)

  return { ok: Object.keys(e).length === 0, errors: e, value: out }
}

// The period a vehicle and driver are tied up. A round trip blocks the whole time until the return ends.
export function computeWindow(t, { defaultTripMinutes = 120, defaultReturnMinutes = 60 } = {}) {
  const start = toEpoch(t.travelDate, t.pickupTime)
  let end
  if (t.tripType === 'Round Trip' && t.returnDate && t.returnTime) end = toEpoch(t.returnDate, t.returnTime) + defaultReturnMinutes * 60000
  else if (t.expectedDropTime) {
    end = toEpoch(t.travelDate, t.expectedDropTime)
    if (end <= start) end += 24 * 3600000
  } else end = start + defaultTripMinutes * 60000
  return { start, end }
}

// ---------- status workflow ----------

export function checkTransition(booking, to, ctx = {}) {
  const fail = (error) => ({ ok: false, error })
  const from = booking.status
  if (!STATUSES.includes(to)) return fail('Unknown status')
  if (!(TRANSITIONS[from] || []).includes(to)) return fail(`A ${from} booking cannot move to ${to}`)
  if (REASON_REQUIRED.includes(to) && str(ctx.reason, 300).length < 3) return fail('A reason is required')
  if (to === 'Driver Assigned' && !(booking.driverId || ctx.driverId)) return fail('Select a driver first')
  if (to === 'Vehicle Assigned' && !(booking.vehicleId || ctx.vehicleId)) return fail('Select a vehicle first')
  if (to === 'In Progress' && !((booking.vehicleId || ctx.vehicleId) && (booking.driverId || ctx.driverId))) return fail('A vehicle and a driver must be assigned before the trip starts')
  if (to === 'Completed') return checkCompletion(booking, ctx.completion || booking.completion)
  return { ok: true }
}

// A booking cannot be Completed until the trip or delivery details are recorded.
export function checkCompletion(booking, c) {
  const fail = (error) => ({ ok: false, error })
  if (!c || typeof c !== 'object') return fail('Enter the trip completion details first')
  const pick = Date.parse(c.actualPickupAt)
  const drop = Date.parse(c.actualDropAt)
  if (!Number.isFinite(pick)) return fail('Actual pickup time is required')
  if (!Number.isFinite(drop)) return fail('Actual drop time is required')
  if (drop < pick) return fail('Drop time cannot be before pickup time')
  if (booking.category === 'delivery' && !str(c.deliveredToName, 100)) return fail('Enter the name of the authorised recipient who received the delivery')
  let distanceKm = null
  if (c.odometerStart != null && c.odometerEnd != null && c.odometerStart !== '' && c.odometerEnd !== '') {
    const a = Number(c.odometerStart)
    const z = Number(c.odometerEnd)
    if (!Number.isFinite(a) || !Number.isFinite(z) || z < a) return fail('Odometer end reading cannot be below the start reading')
    distanceKm = z - a
  }
  return { ok: true, distanceKm }
}

export const historyEntry = (from, to, auth, remarks = '') => ({
  from, to, by: auth.name || auth.username || auth.role, byUserId: auth.userId || null, role: auth.role,
  at: new Date().toISOString(), remarks: str(remarks, 300),
})

// ---------- permissions ----------

export function canView(auth, b) {
  if (!auth || !b) return false
  const r = auth.role
  if (r === 'admin' || r === 'management') return true
  if (r === 'facility') return !auth.storeId || b.showroom === auth.storeId
  if (r === 'brand_host') return (!!auth.userId && b.createdByUserId === auth.userId) || (!!auth.storeId && b.showroom === auth.storeId)
  return false
}

export function can(auth, action, b = null) {
  if (!auth) return false
  const r = auth.role
  const own = !!b && !!auth.userId && b.createdByUserId === auth.userId
  switch (action) {
    case 'create': return ['admin', 'brand_host', 'facility'].includes(r)
    case 'view': return b ? canView(auth, b) : ['admin', 'brand_host', 'facility', 'management'].includes(r)
    case 'edit': if (!b || !EDITABLE_STATUSES.includes(b.status)) return false
      return r === 'admin' || (r === 'facility' && canView(auth, b)) || (r === 'brand_host' && own)
    case 'confirm': return r === 'admin' || (r === 'facility' && (!b || canView(auth, b))) || (r === 'brand_host' && (!b || own))
    case 'assign': return r === 'admin' || (r === 'facility' && (!b || canView(auth, b)))
    case 'cancel': return r === 'admin' || (r === 'facility' && (!b || canView(auth, b)))
    case 'requestCancel': return r === 'brand_host' && (!b || own)
    case 'settings': return r === 'admin'
    case 'reports': return ['admin', 'facility', 'management'].includes(r)
    case 'seePhone': return r === 'admin' || r === 'facility' || (r === 'brand_host' && (!b || canView(auth, b)))
    default: return false
  }
}

// MongoDB filter for the bookings a user may list. null = no access at all.
export function scopeQuery(auth) {
  if (!auth) return null
  if (auth.role === 'admin' || auth.role === 'management') return {}
  if (auth.role === 'facility') return auth.storeId ? { showroom: auth.storeId } : {}
  if (auth.role === 'brand_host') {
    const or = []
    if (auth.userId) or.push({ createdByUserId: auth.userId })
    if (auth.storeId) or.push({ showroom: auth.storeId })
    return or.length ? { $or: or } : null
  }
  return null
}

const PHONE_FIELDS = ['customerPhone', 'employeePhone', 'requesterPhone', 'recipientPhone', 'contactPhone']
export function maskBooking(b, auth) {
  if (!b) return b
  const { _id, ...rest } = b
  if (can(auth, 'seePhone', b)) return rest
  for (const f of PHONE_FIELDS) if (rest[f]) rest[f] = maskPhone(rest[f])
  return rest
}

// ---------- booking ID ----------

// CKC/BKG/2026/0001 style, numbered per year (India time), safe when two people book at once
export async function nextBookingId(db, now = new Date()) {
  const year = new Date(now.getTime() + IST_OFFSET_MS).getUTCFullYear()
  const r = await db.collection('counters').findOneAndUpdate(
    { _id: `booking-${year}` },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' }
  )
  const seq = (r && r.value !== undefined ? r.value : r).seq
  return `CKC/BKG/${year}/${String(seq).padStart(4, '0')}`
}
