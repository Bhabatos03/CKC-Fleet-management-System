// lib/ask/config.js
//
// What "Ask FleetPulse" is allowed to read. This is the ONLY place that decides it.
// A collection that is not listed here cannot be read by the chatbot, however it is asked.
// To let it see another collection, add a block below.
//
// scope says how a Store Admin is limited to their own showroom. Admins see everything.
//   { field: 'storeId' }                       the record carries the showroom id
//   { anyOf: ['assignedLocation', 'storeId'] } either field may carry it
//   { viaVehicle: true }                       the record has a vehicleId; the vehicle must belong to the showroom
//   { adminOnly: true }                        Admin only, no showroom view
// allowFields (optional) keeps everything else in that collection hidden.

export const COLLECTIONS = {
  vehicles: {
    description: 'Fleet vehicles: number, make, model, type, status, assigned showroom and driver, insurance / PUC / service due dates, odometer, mileage',
    scope: { field: 'assignedLocation' }, defaultSort: 'vehicleNumber',
  },
  drivers: {
    description: 'Drivers: name, employee id, status, licence expiry, assigned showroom',
    scope: { anyOf: ['assignedLocation', 'storeId'] }, defaultSort: 'name',
  },
  trips: {
    description: 'Vehicle trips (movements): vehicle, driver, date out/in, km, destination, status',
    scope: { viaVehicle: true }, defaultSort: 'dateOut',
  },
  fuel_entries: {
    description: 'Fuel fills: vehicle, date, litres, cost, station, odometer',
    scope: { viaVehicle: true }, defaultSort: 'date',
  },
  maintenance: {
    description: 'Service and repair records: vehicle, date, cost, workshop, next service due',
    scope: { viaVehicle: true }, defaultSort: 'serviceDate',
  },
  gatepasses: {
    description: 'Gate passes: material movement, status Open/Closed, returnable, expected return date',
    scope: { field: 'storeId' }, defaultSort: 'createdAt',
  },
  bookings: {
    description: 'Vehicle bookings: booking no, type, mode (Normal/Advance), status, travel date and time, pickup and drop, requester, vehicle and driver allocated, trip start/end and km',
    scope: { field: 'storeId' }, defaultSort: 'trip.startAt',
  },
  booking_feedback: {
    description: 'Trip feedback received: role (customer or driver), rating 1-5, comment, driver, vehicle, showroom, date',
    scope: { field: 'storeId' }, defaultSort: 'submittedAt',
  },
  users: {
    description: 'App users (names, roles, showrooms only; never passwords or contact details)',
    scope: { field: 'storeId' }, allowFields: ['id', 'username', 'name', 'role', 'storeId', 'status', 'createdAt'], defaultSort: 'name',
  },
}

// Field names that are never readable, filterable, sortable or groupable, in any collection.
// (Blocking them in filters stops guessing a secret one character at a time.)
export const DENIED_FIELD = /passw|passwd|^pass$|^pwd$|hash|salt|secret|token|api_?key|otp$|mobilekey|customerkey|clientrequestid|session/i

export const LIMITS = {
  findDefault: 25, findMax: 100, groupMax: 100, groupDefault: 50,
  maxFilters: 8, maxFields: 15, maxMetrics: 4, maxValueLength: 100, maxInList: 50,
  resultChars: 14000, queryMs: 8000,
  historyMessages: 12, historyChars: 2000, questionChars: 800, toolRounds: 8,
}
