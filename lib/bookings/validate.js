// lib/bookings/validate.js
// Server-side validation and clean-up of booking input. The browser form checks
// the same things for convenience, but this file is the one that counts.

import {
  BOOKING_TYPES, partyOf, SOURCES, BOOKING_MODES, DEPARTMENTS, CUSTOMER_TYPES, TRIP_TYPES, PURPOSES, ITEM_CATEGORIES,
} from './constants.js'
import { validPoint } from './geo.js'

const IST = 'Asia/Kolkata'
export const todayIST = () => new Date().toLocaleDateString('en-CA', { timeZone: IST })
export const nowTimeIST = () =>
  new Date().toLocaleTimeString('en-GB', { timeZone: IST, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

// Trim, drop control characters, cap the length. Never returns undefined.
export const clean = (v, max = 200) => {
  if (v === null || v === undefined) return ''
  return String(v).replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max)
}
// Same, but keeps line breaks (for remarks and instructions).
export const cleanMultiline = (v, max = 500) => {
  if (v === null || v === undefined) return ''
  return String(v).replace(/\r/g, '').replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, ' ').trim().slice(0, max)
}

// One stable key per phone number, however it was typed: "+91 98450-12345", "098450 12345" and
// "9845012345" all become 9845012345.
export const normMobile = (v) => {
  let d = String(v || '').replace(/\D/g, '')
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2)
  else if (d.length === 11 && d.startsWith('0')) d = d.slice(1)
  return d
}
export const isValidMobile = (v) => /^[6-9]\d{9}$/.test(normMobile(v))

export const maskMobile = (v) => {
  const d = normMobile(v)
  return d.length >= 4 ? `XXXXXX${d.slice(-4)}` : 'XXXX'
}

const validDate = (s) => {
  if (!DATE_RE.test(s)) return false
  const d = new Date(`${s}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
}

export const isValidDate = validDate
export const isValidTime = (s) => TIME_RE.test(String(s || ''))

export const toStartAt = (date, time) => new Date(`${date}T${time}:00+05:30`).toISOString()

// Free-text fields must not become a place to record jewellery weights, values or
// customer finances. Use the authorised reference number instead.
const SENSITIVE_RE = /(₹|\brs\.?\s*\d|\binr\b|\b\d+(\.\d+)?\s*(gm|gms|gram|grams|kg|ct|carat|carats|tola)\b|\bvalue[ds]?\b|\bworth\b|\bprice[ds]?\b|\binvoice\s*(amount|value)\b)/i
export const looksSensitive = (s) => SENSITIVE_RE.test(String(s || ''))

const pickEnum = (v, list, fallback = '') => (list.includes(v) ? v : fallback)

// A place is typed text, or text chosen from the map search (which also carries coordinates inside India).
const cleanPlace = (p) => {
  const address = clean(p?.address, 300)
  const base = { address, landmark: clean(p?.landmark, 120) }
  const pt = validPoint(p)
  if (!pt || !address || p?.manual === true) return { ...base, manual: true }
  return { ...base, lat: pt.lat, lng: pt.lng, ref: clean(p?.ref, 24), manual: false }
}

// Turns whatever the browser sent into the shape we store, and lists every problem found.
// submit = true applies the full rules; submit = false (saving a draft) only needs a booking type.
// firstSubmit = the booking is being submitted for the first time (adds the Advance-date rule).
// stored = re-checking a booking already saved (does not insist on the newer department list).
export function normalizeBooking(input, { submit, firstSubmit = false, stored = false }) {
  const errors = {}
  const err = (field, msg) => { if (!errors[field]) errors[field] = msg }
  const i = input || {}

  const bookingType = clean(i.bookingType, 40)
  const party = partyOf(bookingType)
  if (!party) err('bookingType', 'Please choose a booking type')

  const v = {
    bookingType,
    party,
    source: pickEnum(i.source, SOURCES, 'Phone Call'),
    priority: pickEnum(i.priority, BOOKING_MODES, 'Normal'), // an old "Urgent" booking reads as Normal
    department: clean(i.department, 80),
    remarks: cleanMultiline(i.remarks, 500),
    requester: null,
    delivery: null,
    trip: null,
  }
  if (looksSensitive(v.remarks)) err('remarks', 'Remarks must not contain weights, values or amounts. Use the authorised reference number instead')

  // ---- Who is travelling / sending ----
  const r = i.requester || {}
  const requester = {
    name: clean(r.name, 100),
    mobile: clean(r.mobile, 20),
    mobileKey: normMobile(r.mobile),
    crmRef: clean(r.crmRef, 40),
    customerType: pickEnum(r.customerType, CUSTOMER_TYPES, ''),
    language: clean(r.language, 30),
    empId: clean(r.empId, 30),
    department: clean(r.department, 80),
    approvingManager: clean(r.approvingManager, 100),
    // Only true when the customer or employee has agreed to receive booking messages on WhatsApp
    whatsappConsent: r.whatsappConsent === true || r.whatsappConsent === 'true',
  }
  v.requester = requester

  // An employee trip always belongs to a department, chosen from the list
  if (party === 'employee') {
    if (!requester.department) { if (submit && !stored) err('requester.department', 'Choose the employee\u2019s department') }
    else if (!DEPARTMENTS.includes(requester.department) && !stored) err('requester.department', 'Choose a department from the list')
    v.department = requester.department
  }

  const nameLabel = party === 'delivery' ? 'Requester name' : party === 'employee' ? 'Employee name' : party === 'customer' ? 'Customer name' : 'Contact name'
  if (submit || requester.name) {
    if (!requester.name) err('requester.name', `${nameLabel} is required`)
  }
  if (submit || requester.mobile) {
    if (!requester.mobile) err('requester.mobile', 'Mobile number is required')
    else if (!isValidMobile(requester.mobile)) err('requester.mobile', 'Enter a valid 10-digit mobile number')
  }

  // ---- Item delivery ----
  if (party === 'delivery') {
    const d = i.delivery || {}
    const delivery = {
      sendingUnit: clean(d.sendingUnit, 80),
      receivingUnit: clean(d.receivingUnit, 80),
      recipientName: clean(d.recipientName, 100),
      recipientMobile: clean(d.recipientMobile, 20),
      recipientMobileKey: normMobile(d.recipientMobile),
      itemCategory: pickEnum(d.itemCategory, ITEM_CATEGORIES, ''),
      referenceNo: clean(d.referenceNo, 40),
      itemDescription: clean(d.itemDescription, 120),
      handling: clean(d.handling, 200),
      authorisationRef: clean(d.authorisationRef, 40),
    }
    v.delivery = delivery
    if (submit) {
      if (!delivery.sendingUnit) err('delivery.sendingUnit', 'Sending showroom or department is required')
      if (!delivery.receivingUnit) err('delivery.receivingUnit', 'Receiving showroom or department is required')
      if (!delivery.recipientName) err('delivery.recipientName', 'Recipient name is required')
      if (!delivery.recipientMobile) err('delivery.recipientMobile', 'Recipient mobile number is required')
      if (!delivery.itemCategory) err('delivery.itemCategory', 'Please choose an item category')
      if (!delivery.itemDescription) err('delivery.itemDescription', 'A short item description is required')
      if (delivery.itemCategory === 'Jewellery' && !delivery.authorisationRef) {
        err('delivery.authorisationRef', 'Jewellery needs an authorisation reference (gate pass or approval number)')
      }
    }
    if (delivery.recipientMobile && !isValidMobile(delivery.recipientMobile)) {
      err('delivery.recipientMobile', 'Enter a valid 10-digit mobile number')
    }
    for (const k of ['itemDescription', 'handling']) {
      if (looksSensitive(delivery[k])) {
        err(`delivery.${k}`, 'Do not enter weights, values or amounts here. Use the authorisation reference number instead')
      }
    }
  }

  // ---- Trip ----
  const t = i.trip || {}
  const tripType = pickEnum(t.tripType, TRIP_TYPES, 'One-Way')
  const trip = {
    travelDate: clean(t.travelDate, 10),
    pickupTime: clean(t.pickupTime, 5),
    expectedDropTime: clean(t.expectedDropTime, 5),
    tripType,
    pickup: cleanPlace(t.pickup),
    drop: cleanPlace(t.drop),
    stops: (Array.isArray(t.stops) ? t.stops : []).slice(0, 5).map(cleanPlace),
    returnLeg: null,
    passengers: null,
    luggage: clean(t.luggage, 120),
    purpose: party === 'delivery' ? 'Item Delivery' : pickEnum(t.purpose, PURPOSES, ''),
    instructions: cleanMultiline(t.instructions, 400),
    startAt: null,
  }
  v.trip = trip

  if (party !== 'delivery') {
    const n = parseInt(t.passengers, 10)
    trip.passengers = Number.isFinite(n) ? n : null
    if (submit && (trip.passengers === null || trip.passengers < 1 || trip.passengers > 60)) {
      err('trip.passengers', 'Number of passengers must be between 1 and 60')
    }
    if (submit && !trip.purpose) err('trip.purpose', 'Please choose the booking purpose')
  }

  if (tripType === 'Round Trip') {
    const rl = t.returnLeg || {}
    trip.returnLeg = {
      address: clean(rl.address, 300),
      date: clean(rl.date, 10),
      time: clean(rl.time, 5),
      manual: true,
    }
  }

  // Dates and times
  if (submit || trip.travelDate) {
    if (!validDate(trip.travelDate)) err('trip.travelDate', 'Travel date is required')
  }
  if (submit || trip.pickupTime) {
    if (!TIME_RE.test(trip.pickupTime)) err('trip.pickupTime', 'Pickup time is required (HH:MM)')
  }
  if (trip.expectedDropTime && !TIME_RE.test(trip.expectedDropTime)) err('trip.expectedDropTime', 'Expected drop time must be HH:MM')

  if (validDate(trip.travelDate) && TIME_RE.test(trip.pickupTime)) {
    trip.startAt = toStartAt(trip.travelDate, trip.pickupTime)
    if (submit) {
      const today = todayIST()
      if (trip.travelDate < today) err('trip.travelDate', 'Travel date cannot be in the past')
      else if (firstSubmit && v.priority === 'Advance' && trip.travelDate <= today) err('trip.travelDate', 'An Advance booking must be for a later date. Choose Normal for a trip today')
      else if (trip.travelDate === today && trip.pickupTime < nowTimeIST()) err('trip.pickupTime', 'Pickup time has already passed')
    }
    if (TIME_RE.test(trip.expectedDropTime) && trip.expectedDropTime <= trip.pickupTime) {
      err('trip.expectedDropTime', 'Expected drop time must be after the pickup time on the same day')
    }
  }

  // Places
  if (submit) {
    if (!trip.pickup.address) err('trip.pickup', 'Pickup location is required')
    if (!trip.drop.address) err('trip.drop', 'Drop location is required')
    if (tripType === 'Multiple Stops' && trip.stops.length === 0) err('trip.stops', 'Add at least one additional stop')
  }
  if (trip.stops.some(s => submit && !s.address)) err('trip.stops', 'Every additional stop needs an address')
  trip.stops = trip.stops.filter(s => s.address)

  if (tripType === 'Round Trip' && submit) {
    const rl = trip.returnLeg
    if (!validDate(rl.date)) err('trip.returnLeg', 'Return date is required for a round trip')
    else if (!TIME_RE.test(rl.time)) err('trip.returnLeg', 'Return time is required for a round trip')
    else if (trip.startAt && toStartAt(rl.date, rl.time) <= trip.startAt) err('trip.returnLeg', 'Return must be after the pickup time')
  }

  const list = Object.entries(errors).map(([field, message]) => ({ field, message }))
  return { value: v, errors: list }
}

export const errorSummary = (list) => list.map(e => e.message).join('; ')
export const BOOKING_TYPE_VALUES = BOOKING_TYPES.map(t => t.value)
