// lib/bookings/availability.js
//
// Which vehicles and drivers can take a booking at a given time, and why the others cannot.
//
// Time is divided into 15-minute slots. A booking occupies every slot from its pickup until its
// end plus the turnaround buffer. The "booking_locks" collection holds one record per
// resource per occupied slot, with a unique key, so the database itself refuses a second
// booking of the same vehicle or driver in the same slot. This file only READS those records
// to show availability; lib/bookings/locks.js is what takes them.

import { ALLOCATION, BLOCK_ON, STORE_IDS, ACTIVE_STATUSES } from './constants.js'
import { toStartAt, isValidDate, isValidTime, todayIST } from './validate.js'

export const SLOT_MS = 15 * 60 * 1000
const MIN = 60 * 1000
const IST_MS = 330 * MIN

export const istDate = (ms) => new Date(ms + IST_MS).toISOString().slice(0, 10)
export const istTime = (ms) => new Date(ms + IST_MS).toISOString().slice(11, 16)
const day = (s) => String(s || '').slice(0, 10)

// The period a trip keeps its vehicle and driver busy. Uses the expected drop time when there is one;
// otherwise assumes a standard trip length. A round trip is held until the return trip is done.
export function windowOf(trip) {
  if (!trip || !isValidDate(trip.travelDate) || !isValidTime(trip.pickupTime)) return null
  const startMs = Date.parse(toStartAt(trip.travelDate, trip.pickupTime))
  const stops = (trip.stops || []).filter(s => s && s.address).length
  let endMs = startMs + (ALLOCATION.defaultTripMinutes + stops * ALLOCATION.stopMinutes) * MIN
  let assumedEnd = true
  const rl = trip.returnLeg
  if (trip.tripType === 'Round Trip' && rl && isValidDate(rl.date) && isValidTime(rl.time)) {
    const retMs = Date.parse(toStartAt(rl.date, rl.time))
    if (retMs > startMs) endMs = retMs + ALLOCATION.defaultTripMinutes * MIN
  } else if (isValidTime(trip.expectedDropTime) && trip.expectedDropTime > trip.pickupTime) {
    endMs = Date.parse(toStartAt(trip.travelDate, trip.expectedDropTime))
    assumedEnd = false
  }
  return { startMs, endMs, assumedEnd }
}

// Every slot the booking occupies, including the turnaround buffer after it
export function slotsOf(startMs, endMs) {
  const first = Math.floor(startMs / SLOT_MS)
  const last = Math.ceil((endMs + ALLOCATION.bufferMinutes * MIN) / SLOT_MS) - 1
  const out = []
  for (let s = first; s <= last; s++) out.push(s)
  return out
}

// A showroom books only its own vehicles and drivers (by their assigned location)
const inPool = (loc, storeId) => !!loc && loc === storeId

export const passengerCapacity = (v) => {
  const seats = Number(v.seatingCapacity) || 0
  return ALLOCATION.driverSeatIncluded ? Math.max(seats - 1, 0) : seats
}

export async function computeAvailability(db, opts) {
  const { storeId, trip, isDelivery, excludeBookingId, showDriverMobile } = opts
  const now = opts.now || Date.now()
  const win = windowOf(trip)
  if (!win) return { error: 'Enter the travel date and pickup time to check availability' }
  if (win.endMs - win.startMs > ALLOCATION.maxWindowHours * 3600000) {
    return { error: `Bookings longer than ${ALLOCATION.maxWindowHours} hours need to be split into separate bookings` }
  }
  const passengers = isDelivery ? null : (parseInt(opts.passengers, 10) || null)
  const date = istDate(win.startMs)

  const [vehicleDocs, driverDocs] = await Promise.all([
    db.collection('vehicles').find({}).toArray(),
    db.collection('drivers').find({}).toArray(),
  ])
  const vehicles = vehicleDocs.filter(v => inPool(v.assignedLocation, storeId))
  const drivers = driverDocs.filter(d => inPool(d.assignedLocation, storeId))

  // One read of every lock near this time, reused for the requested time and for alternatives
  const firstSlot = Math.floor(win.startMs / SLOT_MS) - 12
  const lastSlot = Math.ceil((win.endMs + ALLOCATION.bufferMinutes * MIN) / SLOT_MS) + 24
  const locks = await db.collection('booking_locks').find({ slot: { $gte: firstSlot, $lte: lastSlot } }).toArray()
  const idx = { vehicle: new Map(), driver: new Map() } // resourceId -> Map(slot -> bookingId)
  for (const l of locks) {
    if (excludeBookingId && l.bookingId === excludeBookingId) continue
    const m = idx[l.resourceType]
    if (!m) continue
    if (!m.has(l.resourceId)) m.set(l.resourceId, new Map())
    m.get(l.resourceId).set(l.slot, l.bookingId)
  }

  // Hours each driver already has on that day
  const duty = new Map()
  if (drivers.length) {
    const rows = await db.collection('bookings').find({
      'allocation.driverId': { $in: drivers.map(d => d.id) }, 'trip.travelDate': date, status: { $in: ACTIVE_STATUSES },
    }).toArray()
    for (const b of rows) {
      if (b.id === excludeBookingId || !b.schedule) continue
      const h = (Date.parse(b.schedule.endAt) - Date.parse(b.schedule.startAt)) / 3600000
      duty.set(b.allocation.driverId, (duty.get(b.allocation.driverId) || 0) + h)
    }
  }

  const evaluate = (startMs, endMs) => {
    const slots = slotsOf(startMs, endMs)
    const d0 = istDate(startMs)
    const dN = istDate(endMs)
    const hours = (endMs - startMs) / 3600000
    const busyOf = (type, id) => {
      const m = idx[type].get(id)
      if (!m) return []
      const ids = new Set()
      for (const s of slots) if (m.has(s)) ids.add(m.get(s))
      return [...ids]
    }

    const vs = vehicles.map(v => {
      const reasons = []
      const cautions = []
      if (v.status === 'Maintenance') reasons.push('Under maintenance')
      else if (v.status === 'Inactive') reasons.push('Inactive')
      if (v.type === 'Two Wheeler') reasons.push('Two-wheelers cannot be booked here yet')
      const cap = passengerCapacity(v)
      if (passengers && cap < passengers) reasons.push(`Carries ${cap} passenger${cap === 1 ? '' : 's'}, ${passengers} needed`)
      const ins = day(v.insuranceExpiry)
      if (ins && ins < dN) (BLOCK_ON.insuranceExpired ? reasons : cautions).push(`Insurance expired on ${ins}`)
      const puc = day(v.pucExpiry)
      if (puc && puc < dN) (BLOCK_ON.pucExpired ? reasons : cautions).push(`PUC expired on ${puc}`)
      const svc = day(v.serviceDueDate)
      if (svc && svc < d0) (BLOCK_ON.serviceOverdue ? reasons : cautions).push(`Service was due on ${svc}`)
      if (v.status === 'Outside' && d0 === todayIST()) cautions.push('Currently out on a recorded trip')
      const busy = busyOf('vehicle', v.id)
      if (busy.length) reasons.push('BUSY')
      return { v, reasons, cautions, busy, eligible: reasons.length === 0 }
    })

    const ds = drivers.map(d => {
      const reasons = []
      const cautions = []
      if (d.status && d.status !== 'Active') reasons.push(`Driver is ${d.status}`)
      const lic = day(d.licenceExpiry)
      if (!lic) cautions.push('Licence expiry is not recorded')
      else if (lic < dN) reasons.push(`Licence expires ${lic}`)
      else if (lic < istDate(startMs + 30 * 24 * 3600000)) cautions.push(`Licence expires ${lic}`)
      if (d0 === dN) {
        const already = duty.get(d.id) || 0
        if (already + hours > ALLOCATION.maxDutyHoursPerDay) {
          reasons.push(`Would pass ${ALLOCATION.maxDutyHoursPerDay} duty hours (${already.toFixed(1)} h already booked)`)
        }
      } else cautions.push('Multi-day trip: duty hours are not checked')
      const busy = busyOf('driver', d.id)
      if (busy.length) reasons.push('BUSY')
      return { d, reasons, cautions, busy, eligible: reasons.length === 0 }
    })
    return { vs, ds }
  }

  const main = evaluate(win.startMs, win.endMs)

  // Say WHEN a busy vehicle or driver is taken, using the booking that holds it
  const busyIds = new Set()
  for (const r of [...main.vs, ...main.ds]) r.busy.forEach(id => busyIds.add(id))
  const when = new Map()
  if (busyIds.size) {
    const rows = await db.collection('bookings').find({ id: { $in: [...busyIds] } }).toArray()
    for (const b of rows) {
      if (b.schedule) when.set(b.id, `${istTime(Date.parse(b.schedule.startAt))}–${istTime(Date.parse(b.schedule.endAt))}`)
    }
  }
  const busyText = (r) => `Booked ${r.busy.map(id => when.get(id) || 'at this time').join(', ')}`
  for (const r of [...main.vs, ...main.ds]) r.reasons = r.reasons.map(x => (x === 'BUSY' ? busyText(r) : x))

  const driverOk = new Map(main.ds.map(r => [r.d.id, r.eligible]))
  const spare = (v) => (passengers ? passengerCapacity(v) - passengers : 0)
  const score = (r) => (driverOk.get(r.v.assignedDriverId) ? 0 : 1000) + (r.v.assignedLocation === storeId ? 0 : 100) + Math.max(spare(r.v), 0)

  const ranked = main.vs.filter(r => r.eligible).sort((a, b) => score(a) - score(b) || String(a.v.vehicleNumber).localeCompare(String(b.v.vehicleNumber)))
  const bestId = ranked[0]?.v.id
  const order = [...ranked, ...main.vs.filter(r => !r.eligible)]

  const vehicleView = order.map(r => ({
    id: r.v.id, vehicleNumber: r.v.vehicleNumber, make: r.v.make || '', model: r.v.model || '', type: r.v.type || '',
    seatingCapacity: Number(r.v.seatingCapacity) || 0, passengerCapacity: passengerCapacity(r.v),
    status: r.v.status || '', location: r.v.assignedLocation || '', defaultDriverId: r.v.assignedDriverId || null,
    eligible: r.eligible, reasons: r.reasons, cautions: r.cautions, recommended: r.v.id === bestId,
  }))
  const driverView = [...main.ds].sort((a, b) => Number(b.eligible) - Number(a.eligible) || String(a.d.name).localeCompare(String(b.d.name))).map(r => ({
    id: r.d.id, name: r.d.name, empId: r.d.empId || '', location: r.d.assignedLocation || '',
    ...(showDriverMobile ? { mobile: r.d.mobile || '' } : {}),
    eligible: r.eligible, reasons: r.reasons, cautions: r.cautions,
  }))

  // When nothing fits, look for nearby start times on the same day that do
  const hasPair = (r) => r.vs.some(x => x.eligible) && r.ds.some(x => x.eligible)
  const suggestions = []
  if (!hasPair(main)) {
    for (const off of [30, -30, 60, -60, 90, -90, 120, -120, 180, -180, 240, 300, 360]) {
      const s = win.startMs + off * MIN
      if (s < now || istDate(s) !== date) continue
      const r = evaluate(s, win.endMs + off * MIN)
      if (hasPair(r)) suggestions.push({ date: istDate(s), pickupTime: istTime(s), vehicles: r.vs.filter(x => x.eligible).length })
      if (suggestions.length >= 3) break
    }
  }

  return {
    window: {
      startAt: new Date(win.startMs).toISOString(), endAt: new Date(win.endMs).toISOString(),
      assumedEnd: win.assumedEnd, bufferMinutes: ALLOCATION.bufferMinutes,
    },
    vehicles: vehicleView,
    drivers: driverView,
    available: hasPair(main),
    suggestions,
  }
}
