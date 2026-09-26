import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import { v4 as uuidv4 } from 'uuid'
import crypto from 'crypto'


const gpVisible = (gp, role, storeId) => {
  if (role === 'admin') return true
  if (!storeId) return role === 'security'
  return gp.storeId === storeId
}

async function seedUtilitySettingsIfEmpty(db) {
  const existing = await db.collection('utility_settings').findOne({ id: 'default' })
  if (existing) return
  await db.collection('utility_settings').insertOne({
    id: 'default',
    ebUnitRate: 5.95,
    kvaDemandRate: 370,
    ebTaxPercent: 9,
    fuelSurchargePerUnit: 0.60,
    dgUnitRate: 38,
    dgTaxPerUnit: 0.20,
    updatedAt: new Date().toISOString(),
  })
}
async function nextGatePassNumber(db) {
  const year = new Date().getFullYear()
  const r = await db.collection('counters').findOneAndUpdate(
    { _id: `gatepass-${year}` },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' }
  )
  const seq = (r?.value ?? r).seq
  return `CKC/FAC/${year}/${String(seq).padStart(4, '0')}`
}

const MONGO_URL = process.env.MONGO_URL
const DB_NAME = process.env.DB_NAME || 'ckc_fleet'

let cachedClient = null
let seedChecked = false
async function getDb() {
  if (!cachedClient) {
    cachedClient = new MongoClient(MONGO_URL)
    await cachedClient.connect()
  }
  return cachedClient.db(DB_NAME)
}

const json = (data, status = 200) => NextResponse.json(data, { status })
const clean = (obj) => {
  if (!obj) return obj
  const { _id, ...rest } = obj
  return rest
}
// Same as clean(), but also strips the password hash before anything
// touches the network. Always use this for /users responses.
const cleanUser = (obj) => {
  if (!obj) return obj
  const { _id, password, ...rest } = obj
  return rest
}

// --- Password hashing (Node's built-in crypto, no external dependency) ---
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

function verifyPassword(password, stored) {
  if (!stored || typeof stored !== 'string' || !stored.includes(':')) return false
  const [salt, hash] = stored.split(':')
  const hashBuffer = Buffer.from(hash, 'hex')
  const suppliedBuffer = crypto.scryptSync(password, salt, 64)
  if (hashBuffer.length !== suppliedBuffer.length) return false
  return crypto.timingSafeEqual(hashBuffer, suppliedBuffer)
}

// --- Seed the users collection the first time the app runs ---
// This replaces the old hardcoded `users` object in auth/login with real,
// hashed-password documents in Mongo, using the same credentials so nobody
// gets locked out on cutover. Change these passwords via User Management
// once you've confirmed login works.
async function seedUsersIfEmpty(db) {
  const count = await db.collection('users').countDocuments()
  if (count > 0) return

  const seedUsers = [
    { username: 'admin', password: 'admin123', role: 'admin', name: 'Administrator' },
    { username: 'security', password: 'security123', role: 'security', name: 'Security User' },
    { username: 'tss', password: 'tss123', role: 'store_admin', name: 'TSS', storeId: 'TSS' },
    { username: 'tsw', password: 'tsw123', role: 'store_admin', name: 'TSW', storeId: 'TSW' },
    { username: 'ts', password: 'ts123', role: 'store_admin', name: 'TS', storeId: 'TS' },
  ]

  const now = new Date().toISOString()
  const docs = seedUsers.map((u) => ({
    id: uuidv4(),
    name: u.name,
    empId: u.empId || '',
    mobile: u.mobile || '',
    username: u.username,
    password: hashPassword(u.password),
    role: u.role,
    storeId: u.storeId || null,
    status: 'Active',
    createdAt: now,
  }))

  await db.collection('users').insertMany(docs)
}

// --- Seed data ---
async function seedIfEmpty(db) {
  const vCount = await db.collection('vehicles').countDocuments()
  if (vCount > 0) return

  const now = new Date()
  const daysFromNow = (d) => new Date(now.getTime() + d * 24 * 3600 * 1000).toISOString()
  const STORES = ['TSS', 'TS', 'TSW']

  const drivers = [
    { name: 'Ramesh Kumar', empId: 'DRV001', mobile: '9880012345', licence: 'KA0120220001', licenceExpiry: daysFromNow(200) },
    { name: 'Suresh Reddy', empId: 'DRV002', mobile: '9880012346', licence: 'KA0120220002', licenceExpiry: daysFromNow(25) },
    { name: 'Ganesh Naik', empId: 'DRV003', mobile: '9880012347', licence: 'KA0120220003', licenceExpiry: daysFromNow(400) },
    { name: 'Manjunath H', empId: 'DRV004', mobile: '9880012348', licence: 'KA0120220004', licenceExpiry: daysFromNow(180) },
    { name: 'Prakash Rao', empId: 'DRV005', mobile: '9880012349', licence: 'KA0120220005', licenceExpiry: daysFromNow(-5) },
    { name: 'Vinod Shetty', empId: 'DRV006', mobile: '9880012350', licence: 'KA0120220006', licenceExpiry: daysFromNow(90) },
    { name: 'Anil Gowda', empId: 'DRV007', mobile: '9880012351', licence: 'KA0120220007', licenceExpiry: daysFromNow(300) },
    { name: 'Ravi Shankar', empId: 'DRV008', mobile: '9880012352', licence: 'KA0120220008', licenceExpiry: daysFromNow(60) },
    { name: 'Kiran Patel', empId: 'DRV009', mobile: '9880012353', licence: 'KA0120220009', licenceExpiry: daysFromNow(500) },
    { name: 'Mohan Das', empId: 'DRV010', mobile: '9880012354', licence: 'KA0120220010', licenceExpiry: daysFromNow(15) },
  ].map((d, i) => ({
    id: uuidv4(),
    ...d,
    status: 'Active',
    assignedLocation: STORES[i % STORES.length], // NEW: real store field
    remarks: '',
    createdAt: new Date().toISOString(),
  }))

  const vehicleData = [
    { number: 'KA01AB1234', type: 'Sedan', make: 'Honda', model: 'City', fuelType: 'Petrol', capacity: 5, expectedMileage: 15, threshold: 12, odometer: 45200 },
    { number: 'KA01AB1235', type: 'SUV', make: 'Toyota', model: 'Fortuner', fuelType: 'Diesel', capacity: 7, expectedMileage: 12, threshold: 10, odometer: 62100 },
    { number: 'KA01AB1236', type: 'Car', make: 'Maruti', model: 'Swift', fuelType: 'Petrol', capacity: 5, expectedMileage: 18, threshold: 15, odometer: 32000 },
    { number: 'KA01AB1237', type: 'Van', make: 'Force', model: 'Traveller', fuelType: 'Diesel', capacity: 12, expectedMileage: 10, threshold: 8, odometer: 78300 },
    { number: 'KA01AB1238', type: 'Sedan', make: 'Hyundai', model: 'Verna', fuelType: 'Petrol', capacity: 5, expectedMileage: 16, threshold: 13, odometer: 28900 },
    { number: 'KA01AB1239', type: 'SUV', make: 'Mahindra', model: 'XUV700', fuelType: 'Diesel', capacity: 7, expectedMileage: 13, threshold: 11, odometer: 15600 },
    { number: 'KA01AB1240', type: 'Bus', make: 'Tata', model: 'Starbus', fuelType: 'Diesel', capacity: 30, expectedMileage: 6, threshold: 4, odometer: 92400 },
    { number: 'KA01AB1241', type: 'Pickup', make: 'Tata', model: 'Ace', fuelType: 'Diesel', capacity: 2, expectedMileage: 20, threshold: 16, odometer: 41500 },
    { number: 'KA01AB1242', type: 'Two Wheeler', make: 'Honda', model: 'Activa', fuelType: 'Petrol', capacity: 2, expectedMileage: 45, threshold: 38, odometer: 12300 },
    { number: 'KA01AB1243', type: 'Car', make: 'Kia', model: 'Sonet', fuelType: 'Petrol', capacity: 5, expectedMileage: 17, threshold: 14, odometer: 8500 },
  ]

  const vehicles = vehicleData.map((v, i) => ({
    id: uuidv4(),
    vehicleNumber: v.number,
    type: v.type, make: v.make, model: v.model, fuelType: v.fuelType,
    seatingCapacity: v.capacity,
    assignedDriverId: drivers[i]?.id || null,
    assignedLocation: STORES[i % STORES.length], // NEW: real store code, not address string
    expectedMileage: v.expectedMileage,
    lowMileageThreshold: v.threshold,
    currentOdometer: v.odometer,
    insuranceExpiry: daysFromNow([200, 15, 300, 5, 100, 400, -10, 60, 25, 180][i]),
    pucExpiry: daysFromNow([90, 20, 150, 3, 200, 60, 45, 100, 8, 250][i]),
    serviceDueKm: v.odometer + [500, 200, 800, -100, 1500, 2000, 300, 1000, 400, 3000][i],
    serviceDueDate: daysFromNow([30, 5, 45, -3, 60, 90, 20, 40, 10, 120][i]),
    status: 'Available',
    remarks: '',
    createdAt: new Date().toISOString(),
  }))

  drivers.forEach((d, i) => { d.assignedVehicleId = vehicles[i]?.id || null })

  await db.collection('drivers').insertMany(drivers)
  await db.collection('vehicles').insertMany(vehicles)

  const destinations = ['Client Site - Whitefield', 'Airport Pickup', 'Bank - MG Road', 'Warehouse - Peenya', 'Showroom - Jayanagar', 'Vendor - Electronic City', 'Courier - Marathahalli']
  const purposes = ['Delivery', 'Client Meeting', 'Pickup', 'Documentation', 'Inventory Transfer']
  const trips = []
  const fuelEntries = []

  for (let i = 0; i < 60; i++) {
    const vIdx = i % vehicles.length
    const v = vehicles[vIdx]
    const d = drivers[vIdx]
    const daysAgo = Math.floor(Math.random() * 30)
    const outTime = new Date(now.getTime() - daysAgo * 24 * 3600 * 1000 - Math.random() * 8 * 3600 * 1000)
    const durationHrs = 1 + Math.random() * 6
    const inTime = new Date(outTime.getTime() + durationHrs * 3600 * 1000)
    const kmRun = Math.floor(20 + Math.random() * 150)
    const odoOut = v.currentOdometer - Math.floor(Math.random() * 5000) - kmRun
    trips.push({
      id: uuidv4(),
      tripId: `TRP${String(1000 + i)}`,
      vehicleId: v.id, vehicleNumber: v.vehicleNumber,
      vehicleType: v.type === 'Two Wheeler' ? 'Two Wheeler' : 'Four Wheeler',
      driverId: d.id, driverName: d.name,
      employeeName: null,
      dateOut: outTime.toISOString(),
      timeIn: inTime.toISOString(),
      odometerOut: odoOut,
      odometerIn: odoOut + kmRun,
      kmRun,
      destination: destinations[i % destinations.length],
      purpose: purposes[i % purposes.length],
      passengerCount: 1 + Math.floor(Math.random() * 4),
      passengers: [],
      remarks: '',
      status: 'Returned',
      securityUser: 'security',
      createdAt: outTime.toISOString(),
    })
  }

  const stations = ['Indian Oil - Silk Board', 'HP - Koramangala', 'Bharat Petroleum - MG Road', 'Shell - Whitefield']
  for (let i = 0; i < 40; i++) {
    const vIdx = i % vehicles.length
    const v = vehicles[vIdx]
    const daysAgo = Math.floor(Math.random() * 30)
    const date = new Date(now.getTime() - daysAgo * 24 * 3600 * 1000)
    const qty = 10 + Math.floor(Math.random() * 40)
    const rate = v.fuelType === 'Diesel' ? 92 + Math.random() * 4 : 102 + Math.random() * 5
    fuelEntries.push({
      id: uuidv4(),
      vehicleId: v.id, vehicleNumber: v.vehicleNumber,
      date: date.toISOString(),
      odometer: v.currentOdometer - Math.floor(Math.random() * 3000),
      fuelType: v.fuelType,
      quantity: qty,
      rate: Number(rate.toFixed(2)),
      amount: Number((qty * rate).toFixed(2)),
      station: stations[i % stations.length],
      receiptNumber: `RCP${10000 + i}`,
      remarks: '',
      createdAt: date.toISOString(),
    })
  }

  await db.collection('trips').insertMany(trips)
  await db.collection('fuel_entries').insertMany(fuelEntries)

  await db.collection('settings').insertOne({
    id: 'default',
    maxTripDurationHours: 8,
    companyName: 'C Krishniah Chetty Jewellers Pvt. Ltd.',
    createdAt: new Date().toISOString(),
  })
}

// --- GET ---
export async function GET(request, { params }) {
  try {
    const db = await getDb()
    if (!seedChecked) {
      await seedIfEmpty(db)
      await seedUsersIfEmpty(db)
      await seedUtilitySettingsIfEmpty(db)
      seedChecked = true
    }

    const pathArr = (await params).path || []
    const path = pathArr.join('/')
    const role = request.headers.get('x-user-role')
    const storeId = request.headers.get('x-store-id')
    const isStoreScoped = (role === 'store_admin' || role === 'security') && !!storeId

    // Vehicles for this store, used by trips/fuel/dashboard which key off vehicleId
    let storeVehicleIds = null
    if (isStoreScoped) {
      const storeVehicles = await db.collection('vehicles').find({ assignedLocation: storeId }).toArray()
      storeVehicleIds = storeVehicles.map(v => v.id)
    }

    if (path === 'health') return json({ ok: true })

    if (path === 'users') {
      if (role !== 'admin') return json({ error: 'Admin access required' }, 403)
      const items = await db.collection('users').find({}).toArray()
      return json(items.map(cleanUser))
    }

    if (path === 'vehicles') {
      const query = isStoreScoped ? { assignedLocation: storeId } : {}
      const items = await db.collection('vehicles').find(query).toArray()
      return json(items.map(clean))
    }

    if (path === 'drivers') {
      const query = isStoreScoped ? { assignedLocation: storeId } : {}
      const items = await db.collection('drivers').find(query).toArray()
      return json(items.map(clean))
    }

    if (path === 'trips') {
      const query = storeVehicleIds ? { vehicleId: { $in: storeVehicleIds } } : {}
      const items = await db.collection('trips').find(query).sort({ createdAt: -1 }).limit(500).toArray()
      return json(items.map(clean))
    }

    if (path === 'trips/outside') {
      const query = { status: 'Outside', ...(storeVehicleIds ? { vehicleId: { $in: storeVehicleIds } } : {}) }
      const items = await db.collection('trips').find(query).toArray()
      return json(items.map(clean))
    }

    if (path === 'fuel') {
      const query = storeVehicleIds ? { vehicleId: { $in: storeVehicleIds } } : {}
      const items = await db.collection('fuel_entries').find(query).sort({ date: -1 }).limit(500).toArray()
      return json(items.map(clean))
    }
       if (path === 'utilities/electricity-meters') {
      const items = await db.collection('electricity_meters').find({}).sort({ createdAt: -1 }).toArray()
      return json(items.map(clean))
    }
    if (path === 'utilities/dg-units') {
  const items = await db.collection('dg_units').find({}).sort({ createdAt: -1 }).toArray()
  return json(items.map(clean))
}

if (path === 'utilities/dg-logs') {
  const items = await db.collection('dg_logs').find({}).sort({ date: -1 }).limit(500).toArray()
  return json(items.map(clean))
}
    if (path === 'utilities/amc') {
  const items = await db.collection('utility_amc').find({}).sort({ amcEndDate: 1 }).toArray()
  return json(items.map(clean))
}

    if (path === 'utilities/electricity-readings') {
      const items = await db.collection('electricity_readings').find({}).sort({ readingDate: -1 }).limit(500).toArray()
      return json(items.map(clean))
    }
    if (path === 'utilities/maintenance') {
  const items = await db.collection('utility_maintenance').find({}).sort({ nextDueDate: 1 }).toArray()
  return json(items.map(clean))
}

    if (path === 'utilities/dashboard') {
      const now = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      const readings = await db.collection('electricity_readings').find({}).toArray()
      const monthReadings = readings.filter(r => new Date(r.readingDate) >= monthStart)
      return json({
        electricity: {
          totalUnitsAllTime: readings.reduce((s, r) => s + (r.unitsConsumed || 0), 0),
          monthUnits: monthReadings.reduce((s, r) => s + (r.unitsConsumed || 0), 0),
          monthCost: monthReadings.reduce((s, r) => s + (r.billAmount || 0), 0),
        },
      })
    }
        if (path === 'maintenance') {
      const query = storeVehicleIds ? { vehicleId: { $in: storeVehicleIds } } : {}
      const items = await db.collection('maintenance').find(query).sort({ serviceDate: -1 }).toArray()
      return json(items.map(clean))
    }

       if (path === 'gatepasses') {
      if (!['admin', 'store_admin', 'security'].includes(role)) return json({ error: 'Not authorized' }, 403)
      if (role === 'store_admin' && !storeId) return json({ error: 'No store assigned to this user' }, 403)
      const query = (role === 'admin' || (role === 'security' && !storeId)) ? {} : { storeId }
      const items = await db.collection('gatepasses').find(query).sort({ createdAt: -1 }).toArray()
      return json(items.map(clean))
    }

    if (path === 'dashboard') {
      const vehicleFilter = isStoreScoped ? { assignedLocation: storeId } : {}
      const activityFilter = storeVehicleIds ? { vehicleId: { $in: storeVehicleIds } } : {}
      const driverFilter = isStoreScoped ? { assignedLocation: storeId } : {}

      const [vehicles, trips, fuel, drivers] = await Promise.all([
        db.collection('vehicles').find(vehicleFilter).toArray(),
        db.collection('trips').find(activityFilter).toArray(),
        db.collection('fuel_entries').find(activityFilter).toArray(),
        db.collection('drivers').find(driverFilter).toArray(),
      ])

      const now = new Date()
      const todayStr = now.toISOString().slice(0, 10)
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

      const tripsToday = trips.filter(t => t.dateOut?.slice(0, 10) === todayStr)
      const kmToday = tripsToday.reduce((s, t) => s + (t.kmRun || 0), 0)
      const fuelToday = fuel.filter(f => f.date?.slice(0, 10) === todayStr)
      const fuelTodayLit = fuelToday.reduce((s, f) => s + f.quantity, 0)
      const fuelTodayCost = fuelToday.reduce((s, f) => s + f.amount, 0)

      const tripsMonth = trips.filter(t => new Date(t.dateOut) >= monthStart)
      const kmMonth = tripsMonth.reduce((s, t) => s + (t.kmRun || 0), 0)
      const fuelMonth = fuel.filter(f => new Date(f.date) >= monthStart)
      const fuelMonthLit = fuelMonth.reduce((s, f) => s + f.quantity, 0)
      const fuelMonthCost = fuelMonth.reduce((s, f) => s + f.amount, 0)
      const avgMileage = fuelMonthLit > 0 ? kmMonth / fuelMonthLit : 0

      const perVehicle = vehicles.map(v => {
        const vTrips = trips.filter(t => t.vehicleId === v.id && t.kmRun && new Date(t.dateOut) >= monthStart)
        const vFuel = fuel.filter(f => f.vehicleId === v.id && new Date(f.date) >= monthStart)
        const km = vTrips.reduce((s, t) => s + t.kmRun, 0)
        const lit = vFuel.reduce((s, f) => s + f.quantity, 0)
        const mileage = lit > 0 ? km / lit : null
        const cost = vFuel.reduce((s, f) => s + f.amount, 0)
        return {
          id: v.id, vehicleNumber: v.vehicleNumber, expectedMileage: v.expectedMileage,
          threshold: v.lowMileageThreshold, actualMileage: mileage,
          km, litres: lit, cost,
          lowMileage: mileage !== null && mileage < v.lowMileageThreshold,
        }
      })

      const daily = []
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 24 * 3600 * 1000)
        const ds = d.toISOString().slice(0, 10)
        const dayTrips = trips.filter(t => t.dateOut?.slice(0, 10) === ds)
        const dayFuel = fuel.filter(f => f.date?.slice(0, 10) === ds)
        daily.push({
          date: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
          trips: dayTrips.length,
          km: dayTrips.reduce((s, t) => s + (t.kmRun || 0), 0),
          fuelCost: dayFuel.reduce((s, f) => s + f.amount, 0),
        })
      }

      const in30 = new Date(now.getTime() + 30 * 24 * 3600 * 1000)
      const alerts = {
        insuranceExpiry: vehicles.filter(v => new Date(v.insuranceExpiry) < in30).map(v => ({ vehicleNumber: v.vehicleNumber, date: v.insuranceExpiry })),
        pucExpiry: vehicles.filter(v => new Date(v.pucExpiry) < in30).map(v => ({ vehicleNumber: v.vehicleNumber, date: v.pucExpiry })),
        serviceDue: vehicles.filter(v => new Date(v.serviceDueDate) < in30 || v.currentOdometer >= v.serviceDueKm - 500).map(v => ({ vehicleNumber: v.vehicleNumber, date: v.serviceDueDate })),
        licenceExpiry: drivers.filter(d => new Date(d.licenceExpiry) < in30).map(d => ({ name: d.name, date: d.licenceExpiry })),
        lowMileage: perVehicle.filter(p => p.lowMileage),
      }

      return json({
        fleet: {
          total: vehicles.length,
          available: vehicles.filter(v => v.status === 'Available').length,
          outside: vehicles.filter(v => v.status === 'Outside').length,
          maintenance: vehicles.filter(v => v.status === 'Maintenance').length,
          inactive: vehicles.filter(v => v.status === 'Inactive').length,
        },
        today: {
          trips: tripsToday.length,
          out: tripsToday.length,
          returned: tripsToday.filter(t => t.status === 'Returned').length,
          outside: trips.filter(t => t.status === 'Outside').length,
          km: kmToday,
          fuelLit: fuelTodayLit,
          fuelCost: fuelTodayCost,
        },
        month: {
          km: kmMonth, fuelLit: fuelMonthLit, fuelCost: fuelMonthCost,
          avgMileage: Number(avgMileage.toFixed(2)),
          lowMileageCount: perVehicle.filter(p => p.lowMileage).length,
        },
        daily,
        perVehicle,
        alerts,
      })
    }
    if (path === 'meters') {
  if (!['admin', 'store_admin'].includes(role)) return json({ error: 'Not authorized' }, 403)
  const query = (role === 'store_admin' && storeId) ? { store: storeId } : {}
  const items = await db.collection('meters').find(query).sort({ store: 1, name: 1 }).toArray()
  return json(items.map(clean))
}

if (path === 'meter-readings') {
  if (!['admin', 'store_admin'].includes(role)) return json({ error: 'Not authorized' }, 403)
  const month = new URL(request.url).searchParams.get('month')
  if (!month) return json({ error: 'month query param required' }, 400)
  const meterQuery = (role === 'store_admin' && storeId) ? { store: storeId } : {}
  const meters = await db.collection('meters').find(meterQuery).sort({ store: 1, name: 1 }).toArray()
  const meterIds = meters.map(m => m.id)

  const readings = await db.collection('meter_readings').find({ month, meterId: { $in: meterIds } }).toArray()
  const readingMap = {}
  readings.forEach(r => { readingMap[r.meterId] = r })

  const [y, m] = month.split('-').map(Number)
  const prevDate = new Date(y, m - 2, 1)
  const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`
  const prevReadings = await db.collection('meter_readings').find({ month: prevMonth, meterId: { $in: meterIds } }).toArray()
  const prevMap = {}
  prevReadings.forEach(r => { prevMap[r.meterId] = r })

  const combined = meters.map(m => {
    const r = readingMap[m.id]
    const prev = prevMap[m.id]
    return {
      meterId: m.id, meterName: m.name, meterType: m.type, store: m.store,
      opening: r ? r.opening : (prev ? prev.closing : null),
      closing: r ? r.closing : null,
      unitsConsumed: r ? r.unitsConsumed : null,
      dieselLitres: r ? r.dieselLitres : null,
      manualOverride: r ? r.manualOverride : false,
      enteredBy: r ? r.enteredBy : null,
      enteredAt: r ? r.enteredAt : null,
    }
  })
  return json({ month, readings: combined })
}

if (path === 'utility-settings') {
  const s = await db.collection('utility_settings').findOne({ id: 'default' })
  return json(clean(s) || {})
}
    if (path === 'tenants') {
  if (!['admin', 'store_admin'].includes(role)) return json({ error: 'Not authorized' }, 403)
  const query = (role === 'store_admin' && storeId) ? { store: storeId } : {}
  const items = await db.collection('tenants').find(query).sort({ store: 1, name: 1 }).toArray()
  return json(items.map(clean))
}

if (path === 'tenant-bills') {
  if (!['admin', 'store_admin'].includes(role)) return json({ error: 'Not authorized' }, 403)
  const month = new URL(request.url).searchParams.get('month')
  const query = month ? { month } : {}
  if (role === 'store_admin' && storeId) query.store = storeId
  const items = await db.collection('tenant_bills').find(query).sort({ createdAt: -1 }).toArray()
  return json(items.map(clean))
}

    return json({ error: 'Not found', path }, 404)
  } catch (e) {
    console.error(e)
    return json({ error: e.message }, 500)
  }
}

// --- POST ---
export async function POST(request, { params }) {
  try {
    const db = await getDb()
    if (!seedChecked) {
      await seedUsersIfEmpty(db)
      await seedUtilitySettingsIfEmpty(db)
      seedChecked = true
    }

    const pathArr = (await params).path || []
    const path = pathArr.join('/')
    const body = await request.json()
    const role = request.headers.get('x-user-role')
    const storeId = request.headers.get('x-store-id')
    // Security users with a storeId are scoped to that location's vehicles only;
    // a security user with no storeId (e.g. the original global "Security" account)
    // stays unrestricted, same as before.
    const isStoreScopedSecurity = role === 'security' && !!storeId

    if (path === 'auth/login') {
      const u = await db.collection('users').findOne({ username: body.username })
      if (u && u.status === 'Active' && verifyPassword(body.password, u.password)) {
        return json({ token: uuidv4(), user: { username: u.username, role: u.role, name: u.name, storeId: u.storeId || null } })
      }
      return json({ error: 'Incorrect username or password. Please try again' }, 401)
    }

    if (path === 'users') {
      if (role !== 'admin') return json({ error: 'Admin access required' }, 403)
      if (!body.name || !body.username || !body.password || !body.role) {
        return json({ error: 'Name, username, password, and role are required' }, 400)
      }
      const existing = await db.collection('users').findOne({ username: body.username })
      if (existing) return json({ error: 'Username already exists' }, 409)
      if (body.role === 'store_admin' && !body.storeId) {
        return json({ error: 'Store admins must be assigned a storeId' }, 400)
      }

      const item = {
        id: uuidv4(),
        name: body.name,
        empId: body.empId || '',
        mobile: body.mobile || '',
        username: body.username,
        password: hashPassword(body.password),
        role: body.role,
        storeId: body.storeId || null,
        status: body.status || 'Active',
        createdAt: new Date().toISOString(),
      }
      await db.collection('users').insertOne(item)
      return json(cleanUser(item))
    }

      if (path === 'gatepass') {
      if (!['admin', 'store_admin'].includes(role)) return json({ error: 'Not allowed to create gate passes' }, 403)
      if (role === 'store_admin' && !storeId) return json({ error: 'No store assigned to this user' }, 403)
      if (!body.purposeOfMovement || !Array.isArray(body.items) || body.items.length === 0) {
        return json({ error: 'Purpose of movement and at least one item are required' }, 400)
      }
      const returnable = body.returnable || 'Non-Returnable'
      if (returnable === 'Returnable') {
        if (!body.expectedReturnDate) return json({ error: 'Expected return date is required for returnable items' }, 400)
        const passDate = body.date || new Date().toISOString().slice(0, 10)
        if (body.expectedReturnDate < passDate) return json({ error: 'Expected return date cannot be before the pass date' }, 400)
      }

      const now = new Date().toISOString()
      const entry = {
        id: uuidv4(),
        gatePassNo: await nextGatePassNumber(db),
        storeId: role === 'store_admin' ? storeId : (body.storeId || null),
        type: body.type || 'Outward',
        returnable,
        expectedReturnDate: returnable === 'Returnable' ? body.expectedReturnDate : null,
        returnedAt: null,
        returnedBy: null,
        returnRemarks: '',
        vendorName: body.vendorName || '',
        contactNo: body.contactNo || '',
        address: body.address || '',
        vehicleNo: body.vehicleNo || '',
        department: body.department || '',
        purposeOfMovement: body.purposeOfMovement,
        items: body.items,
        requestedBy: body.requestedBy || '',
        date: body.date || now.slice(0, 10),
        time: body.time || now.slice(11, 16),
        status: 'Open',
        signedCopyImage: null,
        auditLog: [{ action: 'Created (Open)', by: body.requestedBy || role, role, at: now }],
        createdAt: now,
      }
      await db.collection('gatepasses').insertOne(entry)
      return json(clean(entry))
    }

    if (path === 'gatepass/close') {
      const gp = await db.collection('gatepasses').findOne({ id: body.id })
      if (!gp) return json({ error: 'Gate pass not found' }, 404)
      if (!gpVisible(gp, role, storeId)) return json({ error: 'Not your store' }, 403)
      if (role !== 'security') return json({ error: 'Only Security can close a gate pass' }, 403)
      if (gp.status !== 'Open') return json({ error: `Cannot close a gate pass with status ${gp.status}` }, 409)
      if (!body.signedCopyImage) return json({ error: 'Signed copy photo is required to close the gate pass' }, 400)

      const now = new Date().toISOString()
      await db.collection('gatepasses').updateOne({ id: gp.id }, {
        $set: { status: 'Closed', signedCopyImage: body.signedCopyImage },
        $push: { auditLog: { action: 'Closed (verified, sealed & signed copy uploaded)', by: body.by || role, role, at: now } },
      })
      return json({ ok: true })
    }

    if (path === 'gatepass/return') {
      if (!['admin', 'store_admin', 'security'].includes(role)) return json({ error: 'Not allowed' }, 403)
      const gp = await db.collection('gatepasses').findOne({ id: body.id })
      if (!gp) return json({ error: 'Gate pass not found' }, 404)
      if (!gpVisible(gp, role, storeId)) return json({ error: 'Not your store' }, 403)
      if (gp.returnable !== 'Returnable') return json({ error: 'This gate pass is not returnable' }, 400)
      if (gp.status !== 'Closed') return json({ error: 'Close the gate pass before marking items returned' }, 409)
      if (gp.returnedAt) return json({ error: 'Already marked as returned' }, 409)

      const now = new Date().toISOString()
      await db.collection('gatepasses').updateOne({ id: gp.id }, {
        $set: { returnedAt: now, returnedBy: body.by || role, returnRemarks: body.remarks || '' },
        $push: { auditLog: { action: 'Marked Returned', by: body.by || role, role, at: now } },
      })
      return json({ ok: true })
    }
    if (path === 'utilities/electricity-meters') {
  const items = await db.collection('electricity_meters').find({}).sort({ createdAt: -1 }).toArray()
  return json(items.map(clean))
}

if (path === 'utilities/electricity-readings') {
  const items = await db.collection('electricity_readings').find({}).sort({ readingDate: -1 }).limit(500).toArray()
  return json(items.map(clean))
}
    if (path === 'utilities/dg-units') {
  if (!body.dgId || !body.location) {
    return json({ error: 'DG ID and Location are required' }, 400)
  }
  const existing = await db.collection('dg_units').findOne({ dgId: body.dgId })
  if (existing) return json({ error: 'A DG with this ID already exists' }, 409)
  const item = {
    id: uuidv4(),
    dgId: body.dgId,
    location: body.location,
    capacityKva: Number(body.capacityKva || 0),
    make: body.make || '',
    model: body.model || '',
    serialNumber: body.serialNumber || '',
    installationDate: body.installationDate || null,
    fuelType: body.fuelType || 'Diesel',
    vendor: body.vendor || '',
    amcStatus: body.amcStatus || '',
    status: body.status || 'Active',
    remarks: body.remarks || '',
    createdAt: new Date().toISOString(),
  }
  await db.collection('dg_units').insertOne(item)
  return json(clean(item))
}

if (path === 'utilities/dg-logs') {
  if (!body.dgId || body.closingHourMeter === undefined) {
    return json({ error: 'DG and closing hour meter are required' }, 400)
  }
  const openingHour = Number(body.openingHourMeter || 0)
  const closingHour = Number(body.closingHourMeter)
  const runningHours = closingHour - openingHour
  if (runningHours < 0) {
    return json({ error: 'Closing hour meter cannot be less than opening hour meter' }, 400)
  }
  const dieselOpening = Number(body.dieselOpeningBalance || 0)
  const dieselAdded = Number(body.dieselAdded || 0)
  const dieselConsumed = Number(body.dieselConsumed || 0)
  const dieselClosing = dieselOpening + dieselAdded - dieselConsumed
  if (dieselClosing < 0) {
    return json({ error: 'Diesel closing balance cannot be negative — check opening, added and consumed values' }, 400)
  }
  const item = {
    id: uuidv4(),
    date: body.date || new Date().toISOString(),
    location: body.location || '',
    dgId: body.dgId,
    openingHourMeter: openingHour,
    closingHourMeter: closingHour,
    runningHours,
    dieselOpeningBalance: dieselOpening,
    dieselAdded,
    dieselConsumed,
    dieselClosingBalance: dieselClosing,
    reasonForRunning: body.reasonForRunning || '',
    operator: body.operator || '',
    remarks: body.remarks || '',
    createdAt: new Date().toISOString(),
  }
  await db.collection('dg_logs').insertOne(item)
  return json(clean(item))
}

    if (path === 'utilities/maintenance') {
  if (!body.asset || !body.location || !body.category) {
    return json({ error: 'Asset, location and category are required' }, 400)
  }
  const item = {
    id: uuidv4(),
    location: body.location,
    asset: body.asset,
    category: body.category,
    maintenanceType: body.maintenanceType || '',
    frequency: body.frequency || 'Monthly',
    lastMaintenanceDate: body.lastMaintenanceDate || null,
    nextDueDate: body.nextDueDate || null,
    vendor: body.vendor || '',
    responsiblePerson: body.responsiblePerson || '',
    estimatedCost: Number(body.estimatedCost || 0),
    actualCost: Number(body.actualCost || 0),
    status: body.status || 'Upcoming',
    serviceReport: body.serviceReport || null,
    remarks: body.remarks || '',
    createdAt: new Date().toISOString(),
  }
  await db.collection('utility_maintenance').insertOne(item)
  return json(clean(item))
}
    if (path === 'utilities/amc') {
  if (!body.equipment || !body.location || !body.amcEndDate) {
    return json({ error: 'Equipment, location and AMC end date are required' }, 400)
  }
  if (body.amcStartDate && body.amcEndDate < body.amcStartDate) {
    return json({ error: 'AMC end date cannot be before start date' }, 400)
  }
  const amcValue = Number(body.amcValue || 0)
  const gst = Number(body.gst || 0)
  const item = {
    id: uuidv4(),
    location: body.location,
    equipment: body.equipment,
    assetId: body.assetId || '',
    category: body.category || '',
    vendor: body.vendor || '',
    amcStartDate: body.amcStartDate || null,
    amcEndDate: body.amcEndDate,
    amcValue,
    gst,
    totalValue: amcValue + (amcValue * gst / 100),
    serviceFrequency: body.serviceFrequency || 'Quarterly',
    visitsPlanned: Number(body.visitsPlanned || 0),
    visitsCompleted: Number(body.visitsCompleted || 0),
    nextServiceDate: body.nextServiceDate || null,
    sla: body.sla || '',
    contactPerson: body.contactPerson || '',
    contactNumber: body.contactNumber || '',
    contractDocument: body.contractDocument || null,
    status: body.status || 'Active',
    remarks: body.remarks || '',
    createdAt: new Date().toISOString(),
  }
  await db.collection('utility_amc').insertOne(item)
  return json(clean(item))
}

    if (path === 'meters') {
  if (role !== 'admin') return json({ error: 'Only Admin can add meters' }, 403)
  if (!body.name || !body.type || !body.store) return json({ error: 'Name, type and store are required' }, 400)
  const item = { id: uuidv4(), name: body.name, type: body.type, store: body.store, tracksDiesel: !!body.tracksDiesel, createdAt: new Date().toISOString() }
  await db.collection('meters').insertOne(item)
  return json(clean(item))
}

if (path === 'meter-readings') {
  if (!['admin', 'store_admin'].includes(role)) return json({ error: 'Not authorized' }, 403)
  const meter = await db.collection('meters').findOne({ id: body.meterId })
  if (!meter) return json({ error: 'Meter not found' }, 404)
  if (role === 'store_admin' && meter.store !== storeId) return json({ error: 'Not your store' }, 403)
  if (body.closing === undefined || body.closing === null || body.closing === '') return json({ error: 'Closing reading is required' }, 400)

  const opening = Number(body.opening ?? 0)
  const closing = Number(body.closing)
  const unitsConsumed = body.manualOverride ? Number(body.unitsConsumed) : (closing - opening)
  const now = new Date().toISOString()

  await db.collection('meter_readings').updateOne(
    { meterId: body.meterId, month: body.month },
    {
      $set: {
        meterId: body.meterId, month: body.month, opening, closing, unitsConsumed,
        dieselLitres: body.dieselLitres != null && body.dieselLitres !== '' ? Number(body.dieselLitres) : null,
        manualOverride: !!body.manualOverride,
        enteredBy: body.enteredBy || role, enteredAt: now,
      },
      $setOnInsert: { id: uuidv4() },
    },
    { upsert: true }
  )
  return json({ ok: true })
}

if (path === 'utility-settings') {
  if (role !== 'admin') return json({ error: 'Only Admin can edit utility settings' }, 403)
  const settings = {
    id: 'default',
    ebUnitRate: Number(body.ebUnitRate),
    kvaDemandRate: Number(body.kvaDemandRate),
    ebTaxPercent: Number(body.ebTaxPercent),
    fuelSurchargePerUnit: Number(body.fuelSurchargePerUnit),
    dgUnitRate: Number(body.dgUnitRate),
    dgTaxPerUnit: Number(body.dgTaxPerUnit),
    updatedAt: new Date().toISOString(),
  }
  await db.collection('utility_settings').updateOne({ id: 'default' }, { $set: settings }, { upsert: true })
  return json(clean(settings))
}

    if (path === 'tenants') {
  if (role !== 'admin') return json({ error: 'Only Admin can add tenants' }, 403)
  if (!body.name || !body.store) return json({ error: 'Name and store are required' }, 400)
  const item = {
    id: uuidv4(),
    name: body.name,
    store: body.store,
    kva: Number(body.kva || 0),
    recipientName: body.recipientName || '',
    recipientAddress: body.recipientAddress || '',
    subject: body.subject || '',
    meterIds: body.meterIds || [],
    createdAt: new Date().toISOString(),
  }
  await db.collection('tenants').insertOne(item)
  return json(clean(item))
}

if (path === 'tenant-bill/generate') {
  if (!['admin', 'store_admin'].includes(role)) return json({ error: 'Not authorized' }, 403)
  const tenant = await db.collection('tenants').findOne({ id: body.tenantId })
  if (!tenant) return json({ error: 'Tenant not found' }, 404)
  if (role === 'store_admin' && tenant.store !== storeId) return json({ error: 'Not your store' }, 403)
  if (!body.month) return json({ error: 'month is required' }, 400)

  const meters = await db.collection('meters').find({ id: { $in: tenant.meterIds } }).toArray()
  const readings = await db.collection('meter_readings').find({ month: body.month, meterId: { $in: tenant.meterIds } }).toArray()
  const readingMap = {}
  readings.forEach(r => { readingMap[r.meterId] = r })

  const ebMeters = meters.filter(m => m.type === 'EB' || m.type === 'HT')
  const dgMeters = meters.filter(m => m.type === 'DG')

  const missing = meters.filter(m => !readingMap[m.id]).map(m => m.name)
  if (missing.length > 0) {
    return json({ error: `Readings missing for: ${missing.join(', ')}. Enter them in Monthly Readings first.` }, 400)
  }

  const ebUnits = ebMeters.reduce((s, m) => s + (readingMap[m.id]?.unitsConsumed || 0), 0)
  const dgUnits = dgMeters.reduce((s, m) => s + (readingMap[m.id]?.unitsConsumed || 0), 0)
  const dgDiesel = dgMeters.reduce((s, m) => s + (readingMap[m.id]?.dieselLitres || 0), 0)

  const settings = await db.collection('utility_settings').findOne({ id: 'default' })

  const ebAmount = ebUnits * settings.ebUnitRate
  const kvaAmount = tenant.kva * settings.kvaDemandRate
  const subtotal = ebAmount + kvaAmount
  const tax = subtotal * (settings.ebTaxPercent / 100)
  const fuelSurcharge = ebUnits * settings.fuelSurchargePerUnit
  const totalEB = subtotal + tax + fuelSurcharge

  const dgAmount = dgUnits * settings.dgUnitRate
  const dgTax = dgUnits * settings.dgTaxPerUnit
  const totalDG = dgAmount + dgTax

  const grandTotal = totalEB + totalDG

  const bill = {
    id: uuidv4(),
    tenantId: tenant.id, tenantName: tenant.name, store: tenant.store,
    recipientName: tenant.recipientName, recipientAddress: tenant.recipientAddress, subject: tenant.subject,
    month: body.month,
    kva: tenant.kva,
    ebMeterDetails: ebMeters.map(m => ({ name: m.name, opening: readingMap[m.id].opening, closing: readingMap[m.id].closing, units: readingMap[m.id].unitsConsumed })),
    dgMeterDetails: dgMeters.map(m => ({ name: m.name, opening: readingMap[m.id].opening, closing: readingMap[m.id].closing, units: readingMap[m.id].unitsConsumed })),
    ebUnits, ebUnitRate: settings.ebUnitRate, ebAmount,
    kvaDemandRate: settings.kvaDemandRate, kvaAmount,
    subtotal, ebTaxPercent: settings.ebTaxPercent, tax,
    fuelSurchargePerUnit: settings.fuelSurchargePerUnit, fuelSurcharge,
    totalEB,
    dgUnits, dgUnitRate: settings.dgUnitRate, dgAmount,
    dgTaxPerUnit: settings.dgTaxPerUnit, dgTax, totalDG,
    dgDiesel,
    grandTotal,
    generatedBy: body.by || role,
    createdAt: new Date().toISOString(),
  }

  await db.collection('tenant_bills').updateOne(
    { tenantId: tenant.id, month: body.month },
    { $set: bill },
    { upsert: true }
  )
  return json(bill)
}
    // Everything below here requires write access
    if (role === 'store_admin') {
      return json({ error: 'Store admins have read-only access' }, 403)
    }

    if (path === 'vehicles') {
      const item = { id: uuidv4(), ...body, status: body.status || 'Available', createdAt: new Date().toISOString() }
      await db.collection('vehicles').insertOne(item)
      return json(clean(item))
    }

    if (path === 'drivers') {
      const item = {
        id: uuidv4(),
        name: body.name,
        empId: body.empId,
        mobile: body.mobile,
        licence: body.licence,
        licenceExpiry: body.licenceExpiry,
        status: body.status || 'Active',
        assignedLocation: body.assignedLocation || '',
        assignedVehicleId: body.assignedVehicleId || null,
        remarks: body.remarks || '',
        createdAt: new Date().toISOString(),
      }
      await db.collection('drivers').insertOne(item)
      return json(clean(item))
    }

    if (path === 'trips/out') {
      const vehicle = await db.collection('vehicles').findOne({ id: body.vehicleId })
      if (!vehicle) return json({ error: 'Vehicle not found' }, 404)
      if (isStoreScopedSecurity && vehicle.assignedLocation !== storeId) {
        return json({ error: 'This vehicle is not assigned to your location' }, 403)
      }
      if (vehicle.status === 'Outside') return json({ error: 'Vehicle is already outside' }, 400)

      const vehicleType = body.vehicleType || (vehicle.type === 'Two Wheeler' ? 'Two Wheeler' : 'Four Wheeler')

      if (vehicleType === 'Two Wheeler' && !body.employeeName) {
        return json({ error: 'Employee Name is required for two-wheelers' }, 400)
      }
      if (vehicleType === 'Four Wheeler' && !body.driverId) {
        return json({ error: 'Driver is required for four-wheelers' }, 400)
      }

      const driver = body.driverId ? await db.collection('drivers').findOne({ id: body.driverId }) : null
      const trip = {
        id: uuidv4(),
        tripId: `TRP${Date.now()}`,
        vehicleId: vehicle.id, vehicleNumber: vehicle.vehicleNumber,
        vehicleType: vehicleType,
        driverId: driver?.id || null, driverName: driver?.name || body.driverName || null,
        employeeName: body.employeeName || null,
        dateOut: new Date().toISOString(),
        odometerOut: Number(body.odometerOut),
        destination: body.destination,
        purpose: body.purpose,
        passengerCount: Number(body.passengerCount || 0),
        passengers: body.passengers || [],
        remarks: body.remarks || '',
        status: 'Outside',
        securityUser: body.securityUser || 'security',
        createdAt: new Date().toISOString(),
      }
      await db.collection('trips').insertOne(trip)
      await db.collection('vehicles').updateOne({ id: vehicle.id }, { $set: { status: 'Outside' } })
      return json(clean(trip))
    }

    if (path === 'trips/in') {
      const trip = await db.collection('trips').findOne({ id: body.tripId })
      if (!trip) return json({ error: 'Trip not found' }, 404)
      if (isStoreScopedSecurity) {
        const tripVehicle = await db.collection('vehicles').findOne({ id: trip.vehicleId })
        if (tripVehicle && tripVehicle.assignedLocation !== storeId) {
          return json({ error: 'This vehicle is not assigned to your location' }, 403)
        }
      }
      const odoIn = Number(body.odometerIn)
      const kmRun = odoIn - trip.odometerOut
      const timeIn = new Date().toISOString()
      await db.collection('trips').updateOne({ id: trip.id }, {
        $set: { odometerIn: odoIn, kmRun, timeIn, status: 'Returned', remarksIn: body.remarks || '' }
      })
      await db.collection('vehicles').updateOne({ id: trip.vehicleId }, {
        $set: { status: 'Available', currentOdometer: odoIn }
      })
      return json({ ok: true, kmRun })
    }
        if (path === 'trips/location') {
      const trip = await db.collection('trips').findOne({ id: body.tripId })
      if (!trip) return json({ error: 'Trip not found' }, 404)
      await db.collection('trips').updateOne({ id: body.tripId }, {
        $set: { lastLat: Number(body.lat), lastLng: Number(body.lng), lastLocationAt: new Date().toISOString() }
      })
      return json({ ok: true })
    }
    if (path === 'drivers/location') {
  const trip = await db.collection('trips').findOne(
    { driverId: body.driverId, status: 'Outside' },
    { sort: { dateOut: -1 } }
  )
  if (!trip) return json({ ok: true, ignored: true }) // driver not on an active trip right now
  await db.collection('trips').updateOne({ id: trip.id }, {
    $set: { lastLat: Number(body.lat), lastLng: Number(body.lng), lastLocationAt: new Date().toISOString() }
  })
  return json({ ok: true })
}

    if (path === 'fuel') {
      const vehicle = await db.collection('vehicles').findOne({ id: body.vehicleId })
      if (!vehicle) return json({ error: 'Vehicle not found' }, 404)
      if (isStoreScopedSecurity && vehicle.assignedLocation !== storeId) {
        return json({ error: 'This vehicle is not assigned to your location' }, 403)
      }
      const quantity = Number(body.quantity)
      const rate = Number(body.rate)
      const entry = {
        id: uuidv4(),
        vehicleId: vehicle.id, vehicleNumber: vehicle.vehicleNumber,
        date: new Date().toISOString(),
        odometer: Number(body.odometer),
        fuelType: body.fuelType || vehicle.fuelType,
        quantity, rate,
        amount: Number((quantity * rate).toFixed(2)),
        station: body.station,
        receiptNumber: body.receiptNumber || '',
        receiptImage: body.receiptImage || null,
        remarks: body.remarks || '',
        createdAt: new Date().toISOString(),
      }
      await db.collection('fuel_entries').insertOne(entry)
      return json(clean(entry))
    }

    if (path === 'maintenance') {
      const vehicle = await db.collection('vehicles').findOne({ id: body.vehicleId })
      if (!vehicle) return json({ error: 'Vehicle not found' }, 404)
      const entry = {
        id: uuidv4(),
        vehicleId: vehicle.id, vehicleNumber: vehicle.vehicleNumber,
        serviceDate: body.serviceDate || new Date().toISOString(),
        odometer: Number(body.odometer || 0),
        workshop: body.workshop || '',
        serviceType: body.serviceType || 'General Service',
        description: body.description || '',
        parts: body.parts || [],
        cost: Number(body.cost || 0),
        laborCost: Number(body.laborCost || 0),
        totalCost: Number(body.cost || 0) + Number(body.laborCost || 0),
        nextServiceKm: Number(body.nextServiceKm || 0),
        nextServiceDate: body.nextServiceDate || null,
        invoiceNumber: body.invoiceNumber || '',
        invoiceImage: body.invoiceImage || null,
        remarks: body.remarks || '',
        createdAt: new Date().toISOString(),
      }
      await db.collection('maintenance').insertOne(entry)
      const update = {}
      if (entry.nextServiceKm) update.serviceDueKm = entry.nextServiceKm
      if (entry.nextServiceDate) update.serviceDueDate = entry.nextServiceDate
      if (entry.odometer) update.currentOdometer = Math.max(vehicle.currentOdometer || 0, entry.odometer)
           if (Object.keys(update).length) await db.collection('vehicles').updateOne({ id: vehicle.id }, { $set: update })
      return json(clean(entry))
    }

   if (path === 'gatepasses') {
  if (!['admin', 'store_admin', 'security'].includes(role)) return json({ error: 'Not authorized' }, 403)
  if (role === 'store_admin' && !storeId) return json({ error: 'No store assigned to this user' }, 403)
  const query = (role === 'admin' || (role === 'security' && !storeId)) ? {} : { storeId }
  const items = await db.collection('gatepasses').find(query).sort({ createdAt: -1 }).toArray()
  return json(items.map(clean))
}
       if (path === 'gatepass/status') {
      const gp = await db.collection('gatepasses').findOne({ id: body.id })
      if (!gp) return json({ error: 'Gate pass not found' }, 404)
      const allowed = ['Printed', 'Awaiting Signatures', 'Verified by Security']
      if (!allowed.includes(body.status)) return json({ error: 'Invalid status' }, 400)
      await db.collection('gatepasses').updateOne({ id: body.id }, {
        $set: { status: body.status },
        $push: { auditLog: { action: body.status, by: body.by || role, role, at: new Date().toISOString() } }
      })
      return json({ ok: true })
    }

    if (path === 'gatepass/upload') {
      const gp = await db.collection('gatepasses').findOne({ id: body.id })
      if (!gp) return json({ error: 'Gate pass not found' }, 404)
      if (!body.signedCopyImage) return json({ error: 'Signed copy image is required' }, 400)
      await db.collection('gatepasses').updateOne({ id: body.id }, {
        $set: { signedCopyImage: body.signedCopyImage, status: 'Uploaded' },
        $push: { auditLog: { action: 'Uploaded signed copy', by: body.by || role, role, at: new Date().toISOString() } }
      })
      return json({ ok: true })
    }

    if (path === 'gatepass/complete') {
      const gp = await db.collection('gatepasses').findOne({ id: body.id })
      if (!gp) return json({ error: 'Gate pass not found' }, 404)
      await db.collection('gatepasses').updateOne({ id: body.id }, {
        $set: { status: 'Completed' },
        $push: { auditLog: { action: 'Marked Completed', by: body.by || role, role, at: new Date().toISOString() } }
      })
      return json({ ok: true })
    }

    return json({ error: 'Not found' }, 404)
  } catch (e) {
    console.error(e)
    return json({ error: e.message }, 500)
  }
}

// --- PUT ---
export async function PUT(request, { params }) {
  try {
    const db = await getDb()
    const pathArr = (await params).path || []
    const [col, id] = pathArr
    const body = await request.json()
    const role = request.headers.get('x-user-role')

    if (col === 'users') {
      if (role !== 'admin') return json({ error: 'Admin access required' }, 403)

      // PUT /users/:id/password — dedicated password-reset endpoint
      if (pathArr[2] === 'password') {
        if (!body.password || body.password.length < 6) {
          return json({ error: 'Password must be at least 6 characters' }, 400)
        }
        const result = await db.collection('users').updateOne({ id }, { $set: { password: hashPassword(body.password) } })
        if (result.matchedCount === 0) return json({ error: 'User not found' }, 404)
        return json({ ok: true })
      }

      delete body._id
      delete body.id
      delete body.password // password changes go through /users/:id/password only
      if (body.username) {
        const existing = await db.collection('users').findOne({ username: body.username, id: { $ne: id } })
        if (existing) return json({ error: 'Username already exists' }, 409)
      }
      if (body.role === 'store_admin' && !body.storeId) {
        return json({ error: 'Store admins must be assigned a storeId' }, 400)
      }
      await db.collection('users').updateOne({ id }, { $set: body })
      const updated = await db.collection('users').findOne({ id })
      return json(cleanUser(updated))
    }

    if (role === 'store_admin') {
      return json({ error: 'Store admins have read-only access' }, 403)
    }

   const map = { vehicles: 'vehicles', drivers: 'drivers', maintenance: 'maintenance', electricity_meters: 'electricity_meters', electricity_readings: 'electricity_readings', dg_units: 'dg_units', dg_logs: 'dg_logs', utility_maintenance: 'utility_maintenance', utility_amc: 'utility_amc' }
if (!map[col]) return json({ error: 'Not found' }, 404)
    delete body._id
    delete body.id
    await db.collection(map[col]).updateOne({ id }, { $set: body })
    return json({ ok: true })
  } catch (e) {
    return json({ error: e.message }, 500)
  }
}

// --- DELETE ---
export async function DELETE(request, { params }) {
  try {
    const db = await getDb()
    const pathArr = (await params).path || []
    const [col, id] = pathArr
    const role = request.headers.get('x-user-role')

    if (col === 'users') {
      if (role !== 'admin') return json({ error: 'Admin access required' }, 403)
      await db.collection('users').deleteOne({ id })
      return json({ ok: true })
    }

    if (role === 'store_admin') {
      return json({ error: 'Store admins have read-only access' }, 403)
    }

    const map = { vehicles: 'vehicles', drivers: 'drivers', maintenance: 'maintenance', electricity_meters: 'electricity_meters', electricity_readings: 'electricity_readings', dg_units: 'dg_units', dg_logs: 'dg_logs', utility_maintenance: 'utility_maintenance' utility_amc: 'utility_amc'  }
    if (!map[col]) return json({ error: 'Not found' }, 404)
    await db.collection(map[col]).deleteOne({ id })
    return json({ ok: true })
  } catch (e) {
    return json({ error: e.message }, 500)
  }
}
