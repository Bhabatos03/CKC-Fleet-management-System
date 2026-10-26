// lib/bookings/locks.js
//
// The hard guarantee against double booking.
//
// Each 15-minute slot a vehicle or driver is held for becomes one record in "booking_locks",
// and the record's _id is "<type>:<resourceId>:<slot>". MongoDB never stores two records with the
// same _id, so if two people confirm the same vehicle for overlapping times at the same moment,
// exactly one of them gets the records and the other is refused by the database itself.
// The availability screen is only a convenience; this is what actually prevents overlaps.

const isDup = (e) =>
  e?.code === 11000 || (Array.isArray(e?.writeErrors) && e.writeErrors.some(w => w.code === 11000)) || /E11000/.test(e?.message || '')

export const lockId = (type, resourceId, slot) => `${type}:${resourceId}:${slot}`

// Take the slots for a vehicle and driver. Slots this booking already holds are kept, so moving a
// booking slightly never conflicts with itself. Returns { ok:false } if anyone else holds a slot.
// On success, call finishLocks() after the booking is saved. On any failure, call rollbackLocks().
export async function acquireLocks(db, { bookingId, token, vehicleId, driverId, slots }) {
  const col = db.collection('booking_locks')
  const wanted = []
  for (const s of slots) {
    wanted.push(['vehicle', vehicleId, s])
    wanted.push(['driver', driverId, s])
  }
  const ids = wanted.map(w => lockId(w[0], w[1], w[2]))
  const own = new Set((await col.find({ bookingId }).toArray()).map(l => l._id))
  const docs = wanted
    .map((w, i) => ({ _id: ids[i], resourceType: w[0], resourceId: w[1], slot: w[2], bookingId, token }))
    .filter(d => !own.has(d._id))
  if (docs.length) {
    try {
      await col.insertMany(docs) // ordered: stops at the first slot someone else holds
    } catch (e) {
      await col.deleteMany({ token }).catch(() => {})
      if (isDup(e)) return { ok: false }
      throw e
    }
  }
  return { ok: true, keep: ids }
}

// The booking was saved with its new vehicle/driver/time: drop the slots it no longer needs
export const finishLocks = (db, bookingId, keep) =>
  db.collection('booking_locks').deleteMany({ bookingId, _id: { $nin: keep } })

// The booking could not be saved: give back only what this attempt took
export const rollbackLocks = (db, token) => db.collection('booking_locks').deleteMany({ token })

// Cancelled, or otherwise no longer using a vehicle or driver
export const releaseBooking = (db, bookingId) => db.collection('booking_locks').deleteMany({ bookingId })
