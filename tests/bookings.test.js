// Run with:  node tests/bookings.test.js
// Uses a tiny in-memory stand-in for MongoDB, so no database is needed.
import assert from 'node:assert/strict'
import { handleBookings } from '../lib/bookings/handler.js'
import { todayIST } from '../lib/bookings/validate.js'

// ---------- minimal fake MongoDB ----------
const get = (o, p) => p.split('.').reduce((a, k) => (a == null ? undefined : a[k]), o)
const setPath = (o, p, v) => { const ks = p.split('.'); let c = o; ks.slice(0, -1).forEach(k => { c[k] = c[k] ?? {}; c = c[k] }); c[ks.at(-1)] = v }
function matches(d, q) {
  return Object.entries(q).every(([k, c]) => {
    if (k === '$and') return c.every(x => matches(d, x))
    if (k === '$or') return c.some(x => matches(d, x))
    const v = get(d, k)
    if (c instanceof RegExp) return typeof v === 'string' && c.test(v)
    if (c && typeof c === 'object' && !Array.isArray(c)) {
      if ('$gte' in c && !(v >= c.$gte)) return false
      if ('$lte' in c && !(v <= c.$lte)) return false
      if ('$in' in c && !c.$in.includes(v)) return false
      if ('$type' in c) return typeof v === 'string'
      return true
    }
    return v === c
  })
}
class Col {
  constructor() { this.docs = [] }
  async createIndex() {}
  async insertOne(d) { this.docs.push(structuredClone(d)); return { acknowledged: true } }
  async findOne(q) { const d = this.docs.find(x => matches(x, q)); return d ? structuredClone(d) : null }
  find(q = {}) {
    let rows = this.docs.filter(x => matches(x, q)).map(x => structuredClone(x))
    const cur = {
      sort(s) { const [[k, dir]] = Object.entries(s); rows.sort((a, b) => ((get(a, k) ?? '') > (get(b, k) ?? '') ? 1 : -1) * dir); return cur },
      skip(n) { rows = rows.slice(n); return cur },
      limit(n) { rows = rows.slice(0, n); return cur },
      async toArray() { return rows },
    }
    return cur
  }
  async countDocuments(q) { return this.docs.filter(x => matches(x, q)).length }
  async updateOne(q, u) {
    const d = this.docs.find(x => matches(x, q)); if (!d) return { matchedCount: 0 }
    for (const [k, v] of Object.entries(u.$set || {})) setPath(d, k, structuredClone(v))
    for (const [k, v] of Object.entries(u.$inc || {})) setPath(d, k, (get(d, k) || 0) + v)
    return { matchedCount: 1 }
  }
  async replaceOne(q, doc) { const i = this.docs.findIndex(x => matches(x, q)); if (i >= 0) this.docs[i] = structuredClone(doc); else this.docs.push(structuredClone(doc)); return {} }
  async findOneAndUpdate(q, u, o) {
    let d = this.docs.find(x => matches(x, q))
    if (!d) { if (!o?.upsert) return null; d = { _id: q._id }; this.docs.push(d) }
    for (const [k, v] of Object.entries(u.$inc || {})) setPath(d, k, (get(d, k) || 0) + v)
    return structuredClone(d)
  }
}
const makeDb = () => { const cols = {}; return { collection: (n) => (cols[n] ??= new Col()), cols } }

// ---------- helpers ----------
const json = (data, status = 200) => ({ status, data })
const db = makeDb()
const users = db.collection('users')
await users.insertOne({ id: 'u-bh1', username: 'bh1', name: 'Asha', empId: 'E101', mobile: '9900000001', role: 'brand_host', storeId: 'TS', status: 'Active' })
await users.insertOne({ id: 'u-bh2', username: 'bh2', name: 'Ravi', empId: 'E102', mobile: '9900000002', role: 'brand_host', storeId: 'TS', status: 'Active' })
await users.insertOne({ id: 'u-bh3', username: 'bh3', name: 'Meena', role: 'brand_host', storeId: 'TSS', status: 'Active' })

const A = (username, role, storeId, userId, via = 'session') => ({ username, role, storeId, userId, name: username, via })
const bh1 = A('bh1', 'brand_host', 'TS', 'u-bh1')
const bh2 = A('bh2', 'brand_host', 'TS', 'u-bh2')
const bh3 = A('bh3', 'brand_host', 'TSS', 'u-bh3')
const sa = A('sa', 'store_admin', 'TS', 'u-sa')
const admin = A('root', 'admin', '', 'u-admin')

const call = (auth, method, path, body, query = '') =>
  handleBookings({ db, request: { method, url: `http://x/api/${path}${query}`, headers: new Headers() }, path, auth, body, json })

const d = new Date(`${todayIST()}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)
const tomorrow = d.toISOString().slice(0, 10)

const customerBooking = (over = {}) => ({
  bookingType: 'Customer Pickup', source: 'Phone Call', priority: 'Normal',
  requester: { name: 'Priya Rao', mobile: '+91 98450-12345', crmRef: '', customerType: 'Existing Customer' },
  trip: {
    travelDate: tomorrow, pickupTime: '10:30', tripType: 'One-Way', passengers: 2, purpose: 'Customer Visit',
    pickup: { address: 'Indiranagar, Bengaluru' }, drop: { address: 'The Touchstone, Cubbon Road' },
  },
  saveAs: 'Requested', clientRequestId: crypto.randomUUID(), ...over,
})

let passed = 0
const test = async (name, fn) => { try { await fn(); passed++; console.log('  ok  ', name) } catch (e) { console.log('  FAIL', name, '\n      ', e.message); process.exitCode = 1 } }

// ---------- tests ----------
await test('access: security role and legacy-header callers are refused', async () => {
  assert.equal((await call(A('s', 'security', 'TS', 'u-s'), 'GET', 'bookings')).status, 403)
  assert.equal((await call(A('x', 'admin', '', null, 'legacy-header'), 'GET', 'bookings')).status, 401)
  assert.equal((await call(null, 'GET', 'bookings')).status, 401)
  assert.equal((await call(A('bhx', 'brand_host', '', 'u-x'), 'GET', 'bookings')).status, 403) // brand host with no showroom
})

let first
await test('1. customer pickup booking is created and numbered', async () => {
  const r = await call(bh1, 'POST', 'bookings', customerBooking())
  assert.equal(r.status, 200, JSON.stringify(r.data))
  first = r.data.booking
  assert.equal(first.status, 'Requested')
  assert.match(first.bookingNo, /^CKC\/VB\/\d{4}\/0001$/)
  assert.equal(first.storeId, 'TS')
  assert.equal(first.brandHost.empId, 'E101')
  assert.equal(first.legs, 1)
})

await test('draft keeps no booking number and needs only a type', async () => {
  const r = await call(bh1, 'POST', 'bookings', { bookingType: 'Customer Drop', saveAs: 'Draft' })
  assert.equal(r.status, 200, JSON.stringify(r.data))
  assert.equal(r.data.booking.status, 'Draft')
  assert.equal(r.data.booking.bookingNo, null)
})

await test('submitting an incomplete booking is rejected with reasons', async () => {
  const r = await call(bh1, 'POST', 'bookings', { bookingType: 'Customer Drop', saveAs: 'Requested' })
  assert.equal(r.status, 400)
  assert.ok(r.data.fields['requester.name'] && r.data.fields['trip.pickup'] && r.data.fields['trip.travelDate'])
})

await test('double click (same clientRequestId) does not create a second booking', async () => {
  const body = customerBooking()
  const a = await call(bh1, 'POST', 'bookings', body)
  const b = await call(bh1, 'POST', 'bookings', body)
  assert.equal(b.data.duplicate, true)
  assert.equal(a.data.booking.id, b.data.booking.id)
})

await test('2. customer drop, 3. round trip (return leg required and checked)', async () => {
  const rt = customerBooking({ bookingType: 'Customer Pickup & Drop' })
  rt.trip.tripType = 'Round Trip'
  const bad = await call(bh1, 'POST', 'bookings', rt)
  assert.equal(bad.status, 400)
  assert.ok(bad.data.fields['trip.returnLeg'])
  rt.trip.returnLeg = { address: 'Cubbon Road', date: tomorrow, time: '09:00' } // before pickup
  assert.equal((await call(bh1, 'POST', 'bookings', rt)).status, 400)
  rt.trip.returnLeg = { address: 'Cubbon Road', date: tomorrow, time: '14:00' }
  rt.clientRequestId = crypto.randomUUID()
  const ok = await call(bh1, 'POST', 'bookings', rt)
  assert.equal(ok.status, 200, JSON.stringify(ok.data))
  assert.equal(ok.data.booking.legs, 2) // one booking, two legs: reports count it once
})

await test('4. employee transport booking', async () => {
  const r = await call(bh1, 'POST', 'bookings', customerBooking({
    bookingType: 'Employee Pickup', requester: { name: 'Karthik', mobile: '9845099999', empId: 'E500', department: 'Accounts' },
    clientRequestId: crypto.randomUUID(),
  }))
  assert.equal(r.status, 200, JSON.stringify(r.data))
  assert.equal(r.data.booking.party, 'employee')
})

await test('5. item delivery: authorisation, no values or weights, no passengers', async () => {
  const delivery = { sendingUnit: 'TS', receivingUnit: 'TSS', recipientName: 'Mahesh', recipientMobile: '9845011111',
    itemCategory: 'Jewellery', itemDescription: 'Sealed pouch', authorisationRef: '' }
  const base = () => ({
    bookingType: 'Item Delivery', saveAs: 'Requested', clientRequestId: crypto.randomUUID(),
    requester: { name: 'Asha', mobile: '9900000001' }, delivery: { ...delivery },
    trip: { travelDate: tomorrow, pickupTime: '11:00', tripType: 'One-Way', pickup: { address: 'TS' }, drop: { address: 'TSS' } },
  })
  const noRef = await call(bh1, 'POST', 'bookings', base())
  assert.equal(noRef.status, 400); assert.ok(noRef.data.fields['delivery.authorisationRef'])
  const weights = base(); weights.delivery.authorisationRef = 'GP/2026/12'; weights.delivery.itemDescription = 'Gold chain 25 gm'
  const w = await call(bh1, 'POST', 'bookings', weights)
  assert.equal(w.status, 400); assert.ok(w.data.fields['delivery.itemDescription'])
  const good = base(); good.delivery.authorisationRef = 'GP/2026/12'
  const ok = await call(bh1, 'POST', 'bookings', good)
  assert.equal(ok.status, 200, JSON.stringify(ok.data))
  assert.equal(ok.data.booking.trip.passengers, null)
  assert.equal(ok.data.booking.trip.purpose, 'Item Delivery')
})

await test('past dates are refused', async () => {
  const r = customerBooking(); r.trip.travelDate = '2020-01-01'
  assert.equal((await call(bh1, 'POST', 'bookings', r)).status, 400)
})

await test('same customer, different phone formats, one customer key', async () => {
  const keys = db.collection('bookings').docs.filter(b => b.party === 'customer' && b.requester.name === 'Priya Rao').map(b => b.customerKey)
  assert.ok(keys.length >= 2 && new Set(keys).size === 1 && keys[0] === 'mob:9845012345')
  const second = customerBooking({ requester: { name: 'Priya R', mobile: '098450 12345' }, clientRequestId: crypto.randomUUID() })
  await call(bh1, 'POST', 'bookings', second)
  const all = db.collection('bookings').docs.filter(b => b.customerKey === 'mob:9845012345')
  assert.ok(all.length >= 3)
})

await test('16. showroom isolation: other showroom cannot list, read or change', async () => {
  const list = await call(bh3, 'GET', 'bookings')
  assert.equal(list.data.total, 0)
  assert.equal((await call(bh3, 'GET', `bookings/${first.id}`)).status, 404)
  assert.equal((await call(bh3, 'PUT', `bookings/${first.id}`, { ...first, version: first.version })).status, 404)
  assert.equal((await call(bh3, 'POST', `bookings/${first.id}/status`, { status: 'Cancelled', reason: 'x y z' })).status, 404)
  assert.equal((await call(sa, 'GET', `bookings/${first.id}`)).status, 200)
})

await test('contacts are masked for colleagues, shown to creator, staff and in CSV', async () => {
  const other = await call(bh2, 'GET', `bookings/${first.id}`)
  assert.equal(other.status, 200)
  assert.equal(other.data.booking.requester.mobile, 'XXXXXX2345')
  assert.equal(other.data.booking.contactsMasked, true)
  assert.equal(other.data.booking.permissions.canEdit, false)
  assert.equal((await call(bh1, 'GET', `bookings/${first.id}`)).data.booking.requester.mobile, '+91 98450-12345')
  assert.equal((await call(sa, 'GET', `bookings/${first.id}`)).data.booking.requester.mobile, '+91 98450-12345')
  assert.ok(!JSON.stringify(other.data).includes('mobileKey'))
  assert.ok(!JSON.stringify(other.data).includes('9845012345'))
  const csv = await call(bh2, 'GET', 'bookings', null, '?format=csv')
  assert.ok(csv instanceof Response)
  const text = await csv.text()
  assert.ok(text.includes('XXXXXX2345') && !text.includes('98450-12345'))
})

await test('a colleague cannot edit or cancel a booking they did not create', async () => {
  assert.equal((await call(bh2, 'PUT', `bookings/${first.id}`, { ...first, version: first.version })).status, 403)
  assert.equal((await call(bh2, 'POST', `bookings/${first.id}/status`, { status: 'Cancelled', reason: 'no reason' })).status, 403)
})

await test('search by full phone works, partial digits do not expose contacts', async () => {
  assert.ok((await call(bh1, 'GET', 'bookings', null, '?q=9845012345')).data.total >= 1)
  assert.equal((await call(bh1, 'GET', 'bookings', null, '?q=98450123')).data.total, 0)
})

await test('11. editing works, and a stale version is refused', async () => {
  const edit = JSON.parse(JSON.stringify(first)); edit.trip.drop.address = 'Whitefield, Bengaluru'; edit.version = first.version
  const ok = await call(bh1, 'PUT', `bookings/${first.id}`, edit)
  assert.equal(ok.status, 200, JSON.stringify(ok.data))
  assert.equal(ok.data.booking.version, first.version + 1)
  const stale = await call(bh1, 'PUT', `bookings/${first.id}`, edit)
  assert.equal(stale.status, 409)
  const audit = db.collection('booking_audit').docs.filter(a => a.bookingId === first.id)
  assert.ok(audit.some(a => a.changedFields?.includes('trip')))
  assert.ok(!JSON.stringify(audit).includes('Whitefield'), 'audit must list field names only, never values')
})

await test('12. cancel needs a reason, and cancelled bookings are kept', async () => {
  const id = (await call(bh1, 'POST', 'bookings', customerBooking())).data.booking.id
  const none = await call(bh1, 'POST', `bookings/${id}/status`, { status: 'Cancelled', reason: '' })
  assert.equal(none.status, 400)
  const ok = await call(bh1, 'POST', `bookings/${id}/status`, { status: 'Cancelled', reason: 'Customer changed plans' })
  assert.equal(ok.status, 200)
  assert.equal(ok.data.booking.status, 'Cancelled')
  assert.equal(ok.data.booking.cancellation.reason, 'Customer changed plans')
  assert.equal((await call(bh1, 'POST', `bookings/${id}/status`, { status: 'Cancelled', reason: 'again please' })).status, 409)
  assert.equal((await call(bh1, 'PUT', `bookings/${id}`, { ...ok.data.booking, version: ok.data.booking.version })).status, 409)
  assert.ok((await call(bh1, 'GET', 'bookings', null, '?status=Cancelled')).data.items.some(b => b.id === id))
  const hist = (await call(bh1, 'GET', `bookings/${id}`)).data.history
  assert.deepEqual(hist.map(h => h.to), ['Requested', 'Cancelled'])
  assert.equal((await call(bh1, 'DELETE', `bookings/${id}`)).status, 405)
})

await test('status workflow: draft submit, blocked jumps, Phase 2 targets switched off', async () => {
  const draft = (await call(bh1, 'POST', 'bookings', customerBooking({ saveAs: 'Draft' }))).data.booking
  assert.equal(draft.bookingNo, null)
  assert.equal((await call(bh1, 'POST', `bookings/${draft.id}/status`, { status: 'Completed' })).status, 409)
  assert.equal((await call(bh1, 'POST', `bookings/${draft.id}/status`, { status: 'Bogus' })).status, 400)
  const sub = await call(bh1, 'POST', `bookings/${draft.id}/status`, { status: 'Requested' })
  assert.equal(sub.status, 200, JSON.stringify(sub.data))
  assert.match(sub.data.booking.bookingNo, /^CKC\/VB\//)
  const conf = await call(sa, 'POST', `bookings/${draft.id}/status`, { status: 'Confirmed' })
  assert.equal(conf.status, 400) // valid in the table but not enabled until Phase 2
  const incomplete = (await call(bh1, 'POST', 'bookings', { bookingType: 'Customer Drop', saveAs: 'Draft' })).data.booking
  const bad = await call(bh1, 'POST', `bookings/${incomplete.id}/status`, { status: 'Requested' })
  assert.equal(bad.status, 400)
})

await test('admin must pick a showroom; store admin is forced to their own', async () => {
  assert.equal((await call(admin, 'POST', 'bookings', customerBooking({ clientRequestId: crypto.randomUUID() }))).status, 400)
  const ok = await call(admin, 'POST', 'bookings', customerBooking({ storeId: 'TSW', clientRequestId: crypto.randomUUID() }))
  assert.equal(ok.status, 200, JSON.stringify(ok.data)); assert.equal(ok.data.booking.storeId, 'TSW')
  const forced = await call(sa, 'POST', 'bookings', customerBooking({ storeId: 'TSW', clientRequestId: crypto.randomUUID() }))
  assert.equal(forced.data.booking.storeId, 'TS')
  assert.equal((await call(sa, 'GET', `bookings/${ok.data.booking.id}`)).status, 404)
})

await test('brand host override: only an active Brand Host of the same showroom', async () => {
  const ok = await call(sa, 'POST', 'bookings', customerBooking({ brandHostUsername: 'bh2', clientRequestId: crypto.randomUUID() }))
  assert.equal(ok.data.booking.brandHost.name, 'Ravi')
  assert.equal((await call(sa, 'POST', 'bookings', customerBooking({ brandHostUsername: 'bh3', clientRequestId: crypto.randomUUID() }))).status, 400)
  const own = await call(bh1, 'POST', 'bookings', customerBooking({ brandHostUsername: 'bh2', clientRequestId: crypto.randomUUID() }))
  assert.equal(own.data.booking.brandHost.name, 'Asha') // a Brand Host cannot book in someone else's name
})

await test('CSV export stops spreadsheet formulas', async () => {
  const evil = customerBooking({ requester: { name: '=HYPERLINK("http://evil")', mobile: '9845012345' }, clientRequestId: crypto.randomUUID() })
  await call(bh1, 'POST', 'bookings', evil)
  const text = await (await call(sa, 'GET', 'bookings', null, '?format=csv')).text()
  assert.ok(!text.includes(',=HYPERLINK') && text.includes("'=HYPERLINK"))
})

await test('list: filters, sorting and pagination', async () => {
  const page = await call(bh1, 'GET', 'bookings', null, '?pageSize=2&page=1&sort=no&dir=asc&status=Requested')
  assert.equal(page.data.items.length, 2)
  assert.ok(page.data.total > 2)
  assert.equal((await call(bh1, 'GET', 'bookings', null, `?from=${tomorrow}&to=${tomorrow}`)).data.items.every(b => b.trip.travelDate === tomorrow), true)
  assert.equal((await call(bh1, 'GET', 'bookings', null, '?q=zzzz-nothing')).data.total, 0)
})

await test('rate limit: a burst of creates is stopped', async () => {
  const u = A('burst', 'brand_host', 'TS', 'u-burst')
  let last
  for (let n = 0; n < 32; n++) last = await call(u, 'POST', 'bookings', { bookingType: 'Other', saveAs: 'Draft' })
  assert.equal(last.status, 429)
})

console.log(`\n${passed} checks passed${process.exitCode ? ', some FAILED' : ''}`)
