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

// The plain "change status" endpoint only handles these two. Confirming and allocating go through
// their own endpoints, because they must check availability and take the vehicle/driver locks.
export const DIRECT_STATUS_TARGETS = ['Requested', 'Cancelled']

// Bookings can be edited, and cancelled, while they are in one of these statuses.
// ('Driver Assigned' is a momentary step during allocation, so a booking never rests there.)
export const EDITABLE_STATUSES = ['Draft', 'Requested', 'Confirmed', 'Vehicle Assigned']
export const CANCELLABLE_STATUSES = ['Draft', 'Requested', 'Confirmed', 'Vehicle Assigned']
// Statuses in which a booking can be given, or can change, its vehicle and driver
export const ALLOCATABLE_STATUSES = ['Confirmed', 'Vehicle Assigned']
// Statuses in which a booking counts towards a driver's duty hours
export const ACTIVE_STATUSES = ['Confirmed', 'Driver Assigned', 'Vehicle Assigned', 'Driver Notified', 'In Progress']

// ---- Vehicle and driver allocation rules (change here, no other file needs editing) ----
export const ALLOCATION = {
  bufferMinutes: 30,        // turnaround gap kept after every booking, for the same vehicle and driver
  defaultTripMinutes: 90,   // trip length assumed when no expected drop time is entered
  stopMinutes: 15,          // extra time assumed for each additional stop
  maxWindowHours: 48,       // longer bookings must be split
  maxDutyHoursPerDay: 10,   // a driver is not offered if this booking would push them past this
  driverSeatIncluded: true, // vehicle seatingCapacity counts the driver's seat, so passengers = seats - 1
}
// Who may choose a vehicle and driver. Remove 'brand_host' if only the facility team should allocate.
export const ALLOCATE_ROLES = ['admin', 'store_admin', 'brand_host']
// true = the vehicle cannot be booked; false = it is only shown with a warning
export const BLOCK_ON = { insuranceExpired: false, pucExpired: false, serviceOverdue: false }

// Stable order of the status steps, used to record the history when allocation moves a booking along
export const ALLOCATION_CHAIN = ['Requested', 'Confirmed', 'Driver Assigned', 'Vehicle Assigned']

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
