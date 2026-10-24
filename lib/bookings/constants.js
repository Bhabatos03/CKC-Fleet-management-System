// lib/bookings/constants.js
// Shared by the server (lib/bookings/handler.js) and the browser (BookingModule.jsx).
// Keep this file free of server-only imports.

// Showrooms a Brand Host or admin can book for. Update if you add showrooms.
export const STORE_IDS = ['TS', 'TSS', 'TSW']

// Roles allowed to use the module at all. 'security' and anyone else get a 403.
export const BOOKING_ROLES = ['admin', 'store_admin', 'brand_host']

// party decides which form section is shown.
// legs is how many journeys the booking represents. Reports count a booking once;
// legs exists so a metric can count individual trip legs when it says so.
export const BOOKING_TYPES = [
  { value: 'Customer Pickup', party: 'customer', legs: 1 },
  { value: 'Customer Drop', party: 'customer', legs: 1 },
  { value: 'Customer Pickup & Drop', party: 'customer', legs: 2 },
  { value: 'Employee Pickup', party: 'employee', legs: 1 },
  { value: 'Employee Drop', party: 'employee', legs: 1 },
  { value: 'Employee Pickup & Drop', party: 'employee', legs: 2 },
  { value: 'Item Delivery', party: 'delivery', legs: 1 },
  { value: 'Other', party: 'other', legs: 1 },
]
export const partyOf = (type) => BOOKING_TYPES.find(t => t.value === type)?.party || null

export const SOURCES = ['Phone Call', 'In-Person Request', 'Internal Request', 'Other']
export const PRIORITIES = ['Normal', 'Urgent']
export const CUSTOMER_TYPES = ['New Customer', 'Existing Customer', 'Other']
export const TRIP_TYPES = ['One-Way', 'Round Trip', 'Multiple Stops']
export const PURPOSES = ['Customer Visit', 'Store Visit', 'Airport/Railway Transfer', 'Employee Transport', 'Item Delivery', 'Other']
export const ITEM_CATEGORIES = ['Jewellery', 'Documents', 'Packaging Material', 'Other']

export const STATUSES = [
  'Draft', 'Requested', 'Confirmed', 'Driver Assigned', 'Vehicle Assigned', 'Driver Notified',
  'In Progress', 'Completed', 'Cancelled', 'No-Show', 'Failed Delivery', 'Rescheduled',
]

// The full lifecycle. The server refuses any move that is not listed here.
export const TRANSITIONS = {
  'Draft': ['Requested', 'Cancelled'],
  'Requested': ['Confirmed', 'Cancelled'],
  'Confirmed': ['Driver Assigned', 'Vehicle Assigned', 'Driver Notified', 'Cancelled', 'Rescheduled'],
  'Driver Assigned': ['Vehicle Assigned', 'Driver Notified', 'Cancelled', 'Rescheduled'],
  'Vehicle Assigned': ['Driver Assigned', 'Driver Notified', 'Cancelled', 'Rescheduled'],
  'Driver Notified': ['In Progress', 'Cancelled', 'Rescheduled', 'No-Show'],
  'In Progress': ['Completed', 'No-Show', 'Failed Delivery'],
  'Completed': [],
  'Cancelled': [],
  'No-Show': [],
  'Failed Delivery': [],
  'Rescheduled': [],
}

// Phase 1 has no vehicle or driver allocation, so only these moves are switched on.
// Confirmed and everything after it arrive in Phase 2 with availability checks.
export const PHASE1_TARGETS = ['Requested', 'Cancelled']

// Bookings can be edited only while they are in one of these statuses (Phase 1).
export const EDITABLE_STATUSES = ['Draft', 'Requested']
export const CANCELLABLE_STATUSES = ['Draft', 'Requested']

export const STATUS_COLORS = {
  'Draft': 'bg-slate-500',
  'Requested': 'bg-amber-500',
  'Confirmed': 'bg-sky-600',
  'Driver Assigned': 'bg-sky-600',
  'Vehicle Assigned': 'bg-sky-600',
  'Driver Notified': 'bg-indigo-600',
  'In Progress': 'bg-violet-600',
  'Completed': 'bg-emerald-600',
  'Cancelled': 'bg-rose-600',
  'No-Show': 'bg-rose-500',
  'Failed Delivery': 'bg-rose-500',
  'Rescheduled': 'bg-slate-600',
}
