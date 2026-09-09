import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import { v4 as uuidv4 } from 'uuid'

const MONGO_URL = process.env.MONGO_URL
const DB_NAME = process.env.DB_NAME || 'ckc_fleet'

let cachedClient = null
async function getDb() {
  if (!cachedClient) {
    cachedClient = new MongoClient(MONGO_URL)
    await cachedClient.connect()
  }
  return cachedClient.db(DB_NAME)
}

const json = (data, status = 200) => NextResponse.json(data, { status })

// --- Seed data ---
async function seedIfEmpty(db) {
  const vCount = await db.collection('vehicles').countDocuments()
  if (vCount > 0) return

  const now = new Date()
  const daysFromNow = (d) => new Date(now.getTime() + d * 24 * 3600 * 1000).toISOString()

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
  ].map(d => ({ id: uuidv4(), ...d, status: 'Active', createdAt: new Date().toISOString() }))

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
    assignedLocation: 'Head Office - Bangalore',
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

  // Assign drivers back to vehicles
  drivers.forEach((d, i) => { d.assignedVehicleId = vehicles[i]?.id || null })

  await db.collection('drivers').insertMany(drivers)
  await db.collection('vehicles').insertMany(vehicles)

  // Trips (past 30 days)
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

  // Fuel entries
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

const clean = (obj) => {
  if (!obj) return obj
  const { _id, ...rest } = obj
  return rest
}

export async function GET(request, { params }) {
  try {
    const db = await getDb()
    const pathArr = (await params).path || []
    const path = pathArr.join('/')
    const { searchParams } = new URL(request.url)
    const role = request.headers.get('x-user-role')
    const storeId = request.headers.get('x-store-id')

   let storeVehicleIds = null
let storeDriverIds = null
if (role === 'store_admin' && storeId) {
  const storeVehicles = await db.collection('vehicles').find({ assignedLocation: storeId }).toArray()
  storeVehicleIds = storeVehicles.map(v => v.id)
  storeDriverIds = storeVehicles.map(v => v.assignedDriverId).filter(Boolean)
}

    if (path === 'health') return json({ ok: true })

        if (path === 'vehicles') {
      const query = storeVehicleIds ? { id: { $in: storeVehicleIds } } : {}
      const items = await db.collection('vehicles').find(query).toArray()
      return json(items.map(clean))
    }
    if (path === 'drivers') {
      const query = storeVehicleIds ? { assignedVehicleId: { $in: storeVehicleIds } } : {}
      const items = await db.collection('drivers').find(query).toArray()
      return json(items.map(clean))
      
    }    if (path === 'trips') {
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
    if (path === 'maintenance') {
      const query = storeVehicleIds ? { vehicleId: { $in: storeVehicleIds } } : {}
      const items = await db.collection('maintenance').find(query).sort({ serviceDate: -1 }).toArray()
      return json(items.map(clean))
    }
    if (path === 'dashboard') {
      const vehicleFilter = storeVehicleIds ? { id: { $in: storeVehicleIds } } : {}
      const activityFilter = storeVehicleIds ? { vehicleId: { $in: storeVehicleIds } } : {}
      const [vehicles, trips, fuel, drivers] = await Promise.all([
        db.collection('vehicles').find(vehicleFilter).toArray(),
        db.collection('trips').find(activityFilter).toArray(),
        db.collection('fuel_entries').find(activityFilter).toArray(),
        db.collection('drivers').find({}).toArray(),
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

      // Per-vehicle mileage (last 30 days)
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

      // Daily trips (last 7 days)
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

      // Alerts
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

    return json({ error: 'Not found', path }, 404)
  } catch (e) {
    console.error(e)
    return json({ error: e.message }, 500)
  }
}

export async function POST(request, { params }) {
  try {
    const db = await getDb()
    const pathArr = (await params).path || []
    const path = pathArr.join('/')
    const body = await request.json()
    const role = request.headers.get('x-user-role')

    if (role === 'store_admin' && path !== 'auth/login') {
      return json({ error: 'Store admins have read-only access' }, 403)
    }

    if (path === 'auth/login') {
      const users = {
        admin:    { password: 'admin123',    role: 'admin',       name: 'Administrator' },
        security: { password: 'security123', role: 'security',    name: 'Security User' },
        tss:      { password: 'tss123',      role: 'store_admin', name: 'TSS', storeId: 'TSS' },
        tsw:      { password: 'tsw123',      role: 'store_admin', name: 'TSW', storeId: 'TSW' },
        ts:       { password: 'ts123',       role: 'store_admin', name: 'TS',  storeId: 'TS' },
      }
      const u = users[body.username]
      if (u && u.password === body.password) {
        return json({ token: uuidv4(), user: { username: body.username, role: u.role, name: u.name, storeId: u.storeId || null } })
      }
      return json({ error: 'Invalid credentials' }, 401)
    }

    if (path === 'vehicles') {
      const item = { id: uuidv4(), ...body, status: body.status || 'Available', createdAt: new Date().toISOString() }
      await db.collection('vehicles').insertOne(item)
      return json(clean(item))
    }
    if (path === 'drivers') {
      const item = { id: uuidv4(), ...body, status: body.status || 'Active', createdAt: new Date().toISOString() }
      await db.collection('drivers').insertOne(item)
      return json(clean(item))
    }
    if (path === 'trips/out') {
      const vehicle = await db.collection('vehicles').findOne({ id: body.vehicleId })
      if (!vehicle) return json({ error: 'Vehicle not found' }, 404)
      if (vehicle.status === 'Outside') return json({ error: 'Vehicle is already outside' }, 400)
      
      const vehicleType = body.vehicleType || (vehicle.type === 'Two Wheeler' ? 'Two Wheeler' : 'Four Wheeler')
      
      // Validation: Two Wheeler requires employeeName
      if (vehicleType === 'Two Wheeler' && !body.employeeName) {
        return json({ error: 'Employee Name is required for two-wheelers' }, 400)
      }
      
      // Validation: Four Wheeler requires driverId
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
    if (path === 'fuel') {
      const vehicle = await db.collection('vehicles').findOne({ id: body.vehicleId })
      if (!vehicle) return json({ error: 'Vehicle not found' }, 404)
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
      // Also update vehicle master
      const update = {}
      if (entry.nextServiceKm) update.serviceDueKm = entry.nextServiceKm
      if (entry.nextServiceDate) update.serviceDueDate = entry.nextServiceDate
      if (entry.odometer) update.currentOdometer = Math.max(vehicle.currentOdometer || 0, entry.odometer)
      if (Object.keys(update).length) await db.collection('vehicles').updateOne({ id: vehicle.id }, { $set: update })
      return json(clean(entry))
    }

    return json({ error: 'Not found' }, 404)
  } catch (e) {
    console.error(e)
    return json({ error: e.message }, 500)
  }
}

export async function PUT(request, { params }) {
  try {
    const db = await getDb()
    const pathArr = (await params).path || []
    const [col, id] = pathArr
    const body = await request.json()
    const role = request.headers.get('x-user-role')

    if (role === 'store_admin') {
      return json({ error: 'Store admins have read-only access' }, 403)
    }

    const map = { vehicles: 'vehicles', drivers: 'drivers', maintenance: 'maintenance' }
    if (!map[col]) return json({ error: 'Not found' }, 404)
    delete body._id; delete body.id
    await db.collection(map[col]).updateOne({ id }, { $set: body })
    return json({ ok: true })
  } catch (e) {
    return json({ error: e.message }, 500)
  }
}

export async function DELETE(request, { params }) {
  try {
    const db = await getDb()
    const pathArr = (await params).path || []
    const [col, id] = pathArr
    const role = request.headers.get('x-user-role')

    if (role === 'store_admin') {
      return json({ error: 'Store admins have read-only access' }, 403)
    }

    const map = { vehicles: 'vehicles', drivers: 'drivers', maintenance: 'maintenance' }
    if (!map[col]) return json({ error: 'Not found' }, 404)
    await db.collection(map[col]).deleteOne({ id })
    return json({ ok: true })
  } catch (e) {
    return json({ error: e.message }, 500)
  }
}
