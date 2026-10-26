'use client'
// components/booking/BookingModule.jsx
// Vehicle Booking Management, Phases 1-2: New Booking form, vehicle and driver allocation, All Bookings register.
// Rendered from page.js as <BookingModule api={api} user={user} />.

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { Plus, Search, Download, Eye, X, CheckCircle2, Trash2, FileText, ArrowLeft, Car, AlertTriangle } from 'lucide-react'
import {
  BOOKING_TYPES, partyOf, SOURCES, PRIORITIES, CUSTOMER_TYPES, TRIP_TYPES, PURPOSES,
  ITEM_CATEGORIES, STATUSES, STATUS_COLORS,
} from '@/lib/bookings/constants'

const RED = '#E60000'
const todayIST = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
const validMobile = (s) => {
  let d = String(s || '').replace(/\D/g, '')
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2)
  else if (d.length === 11 && d.startsWith('0')) d = d.slice(1)
  return /^[6-9]\d{9}$/.test(d)
}
const fmtWhen = (iso) => iso ? new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-'
const fmtDay = (d) => d ? new Date(`${d}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'

const setIn = (obj, path, val) => {
  const [k, ...rest] = path.split('.')
  return { ...obj, [k]: rest.length ? setIn(obj[k] ?? {}, rest.join('.'), val) : val }
}

const blankForm = () => ({
  bookingType: '', source: 'Phone Call', priority: 'Normal', department: '', remarks: '',
  storeId: '', brandHostUsername: '', vehicleId: '', driverId: '',
  requester: { name: '', mobile: '', crmRef: '', customerType: '', language: '', empId: '', department: '', approvingManager: '' },
  delivery: {
    sendingUnit: '', receivingUnit: '', recipientName: '', recipientMobile: '', itemCategory: '',
    referenceNo: '', itemDescription: '', handling: '', authorisationRef: '',
  },
  trip: {
    travelDate: todayIST(), pickupTime: '', expectedDropTime: '', tripType: 'One-Way',
    pickup: { address: '', landmark: '' }, drop: { address: '', landmark: '' }, stops: [],
    returnLeg: { address: '', date: '', time: '' }, passengers: '1', luggage: '', purpose: '', instructions: '',
  },
})

const fromBooking = (b) => {
  const base = blankForm()
  return {
    ...base,
    id: b.id, version: b.version, status: b.status,
    vehicleId: b.allocation?.vehicleId || '', driverId: b.allocation?.driverId || '', hadAllocation: !!b.allocation,
    bookingType: b.bookingType, source: b.source, priority: b.priority, department: b.department || '', remarks: b.remarks || '',
    storeId: b.storeId, brandHostUsername: b.brandHost?.username || '',
    requester: { ...base.requester, ...b.requester },
    delivery: { ...base.delivery, ...(b.delivery || {}) },
    trip: {
      ...base.trip, ...b.trip,
      pickup: { ...base.trip.pickup, ...b.trip.pickup },
      drop: { ...base.trip.drop, ...b.trip.drop },
      stops: (b.trip.stops || []).map(s => ({ address: s.address, landmark: s.landmark || '' })),
      returnLeg: { ...base.trip.returnLeg, ...(b.trip.returnLeg || {}) },
      passengers: b.trip.passengers ?? '',
    },
  }
}

// ---------- small building blocks ----------
const Field = ({ label, required, error, hint, className = '', children }) => (
  <div className={className}>
    <Label className="text-xs font-semibold tracking-wide text-slate-600">
      {label}{required && <span className="text-rose-600"> *</span>}
    </Label>
    <div className="mt-1">{children}</div>
    {error ? <p className="text-[11px] text-rose-600 mt-1">{error}</p> : hint ? <p className="text-[11px] text-slate-500 mt-1">{hint}</p> : null}
  </div>
)

// Native select: reliable on phones and avoids empty-value problems
const Pick = ({ value, onChange, options, placeholder = 'Select…', disabled }) => (
  <select
    value={value || ''} disabled={disabled} onChange={e => onChange(e.target.value)}
    className="h-9 w-full rounded-md border border-input bg-white px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 disabled:bg-slate-100"
  >
    <option value="">{placeholder}</option>
    {options.map(o => typeof o === 'string'
      ? <option key={o} value={o}>{o}</option>
      : <option key={o.value} value={o.value}>{o.label}</option>)}
  </select>
)

const StatusBadge = ({ status }) => <Badge className={`${STATUS_COLORS[status] || 'bg-slate-500'} text-white whitespace-nowrap`}>{status}</Badge>

const Section = ({ title, children, note }) => (
  <div className="rounded-xl border bg-white p-4 space-y-3">
    <div className="text-sm font-semibold text-slate-800" style={{ fontFamily: 'Georgia, serif' }}>{title}</div>
    {note}
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>
  </div>
)

// ================= VEHICLE & DRIVER ALLOCATION PANEL =================
// Shows who is free for the booking's time and lets the user pick. The server checks again when saving,
// so a vehicle taken in the meantime is refused with a clear message.
function AllocationPanel({ api, query, vehicleId, driverId, onPick, onSuggest, refreshKey = 0 }) {
  const [res, setRes] = useState(null)
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const [showOut, setShowOut] = useState(false)

  useEffect(() => {
    if (!query) { setRes(null); setErr(''); return }
    let live = true
    setLoading(true)
    const t = setTimeout(() => {
      api(`bookings/availability?${query}`)
        .then(r => { if (live) { setRes(r); setErr('') } })
        .catch(e => { if (live) { setRes(null); setErr(e.message) } })
        .finally(() => { if (live) setLoading(false) })
    }, 350)
    return () => { live = false; clearTimeout(t) }
  }, [query, refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // Drop a choice that is no longer available for the current time
  useEffect(() => {
    if (!res) return
    const v = res.vehicles.find(x => x.id === vehicleId)
    const d = res.drivers.find(x => x.id === driverId)
    if ((vehicleId && !(v && v.eligible)) || (driverId && !(d && d.eligible))) {
      onPick({ vehicleId: v && v.eligible ? vehicleId : '', driverId: d && d.eligible ? driverId : '' })
    }
  }, [res]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!query) return <div className="rounded-lg border bg-slate-50 p-4 text-sm text-slate-600">Enter the travel date and pickup time first, then come back to choose a vehicle.</div>
  if (err) return <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700" role="alert">{err}</div>
  if (!res) return <div className="p-4 text-sm text-slate-500">Checking availability…</div>

  const okV = res.vehicles.filter(v => v.eligible)
  const outV = res.vehicles.filter(v => !v.eligible)
  const okD = res.drivers.filter(d => d.eligible)
  const outD = res.drivers.filter(d => !d.eligible)
  const pickVehicle = (v) => {
    // Suggest the vehicle's usual driver when that driver is free
    const usual = v.defaultDriverId && okD.some(d => d.id === v.defaultDriverId) ? v.defaultDriverId : ''
    onPick({ vehicleId: v.id, driverId: driverId && okD.some(d => d.id === driverId) ? driverId : usual })
  }

  return (
    <div className="space-y-3" aria-busy={loading}>
      <div className="text-xs text-slate-500">
        Busy from {fmtWhen(res.window.startAt)} to {fmtWhen(res.window.endAt)}
        {res.window.assumedEnd ? ' (end time assumed; add an expected drop time for a closer fit)' : ''},
        plus {res.window.bufferMinutes} minutes before the vehicle can take another trip.
        {loading && ' Refreshing…'}
      </div>

      {!res.available && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <div className="font-medium flex items-center gap-1"><AlertTriangle className="w-4 h-4" /> No vehicle and driver are both free at this time.</div>
          {res.suggestions.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="text-xs">Free at:</span>
              {res.suggestions.map(s => (
                <Button key={s.pickupTime} size="sm" variant="outline" onClick={() => onSuggest(s)}>{s.pickupTime}</Button>
              ))}
            </div>
          )}
          <div className="text-xs mt-2">You can still save the booking and allocate a vehicle later.</div>
        </div>
      )}

      <div>
        <div className="text-xs font-semibold tracking-wide text-slate-600 mb-1">Vehicle</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {okV.map(v => (
            <button type="button" key={v.id} onClick={() => pickVehicle(v)} aria-pressed={vehicleId === v.id}
              className={`text-left rounded-lg border p-3 text-sm transition ${vehicleId === v.id ? 'border-red-600 ring-2 ring-red-500/30 bg-red-50' : 'bg-white hover:bg-slate-50'}`}>
              <div className="flex items-center gap-2 font-medium"><Car className="w-4 h-4" /> {v.vehicleNumber}
                {v.recommended && <Badge className="bg-emerald-600 text-white">Recommended</Badge>}</div>
              <div className="text-xs text-slate-500">{[v.make, v.model].filter(Boolean).join(' ')} · carries {v.passengerCapacity} passenger{v.passengerCapacity === 1 ? '' : 's'}{v.location ? ` · ${v.location}` : ''}</div>
              {v.cautions.map((c, i) => <div key={i} className="text-[11px] text-amber-700 mt-1">⚠ {c}</div>)}
            </button>
          ))}
          {okV.length === 0 && <div className="text-sm text-slate-500 sm:col-span-2">No vehicle is free for this booking.</div>}
        </div>
        {outV.length > 0 && (
          <div className="mt-2">
            <button type="button" className="text-xs underline text-slate-500" onClick={() => setShowOut(x => !x)}>
              {showOut ? 'Hide' : 'Show'} {outV.length} unavailable vehicle{outV.length === 1 ? '' : 's'}
            </button>
            {showOut && (
              <ul className="mt-1 text-xs text-slate-600 space-y-1">
                {outV.map(v => <li key={v.id}><b>{v.vehicleNumber}</b> — {v.reasons.join(', ')}</li>)}
                {outD.map(d => <li key={d.id}><b>{d.name}</b> (driver) — {d.reasons.join(', ')}</li>)}
              </ul>
            )}
          </div>
        )}
      </div>

      <div>
        <div className="text-xs font-semibold tracking-wide text-slate-600 mb-1">Driver</div>
        <Pick value={driverId} onChange={v => onPick({ vehicleId, driverId: v })} placeholder="Choose driver"
          options={okD.map(d => ({ value: d.id, label: `${d.name}${d.empId ? ` (${d.empId})` : ''}${d.mobile ? ` · ${d.mobile}` : ''}` }))} />
        {driverId && (res.drivers.find(d => d.id === driverId)?.cautions || []).map((c, i) => <div key={i} className="text-[11px] text-amber-700 mt-1">⚠ {c}</div>)}
        {okD.length === 0 && <p className="text-xs text-slate-500 mt-1">No driver is free at this time.</p>}
      </div>
    </div>
  )
}

// ================= NEW / EDIT BOOKING =================
function BookingForm({ api, meta, initial, onDone, onCancel }) {
  const editing = !!initial?.id
  const [f, setF] = useState(() => initial || blankForm())
  const [step, setStep] = useState(1)
  const canAlloc = !!meta.canAllocate
  const steps = [
    { key: 'details', title: 'Booking & contact details' },
    { key: 'schedule', title: 'Pickup, drop & schedule' },
    ...(canAlloc ? [{ key: 'vehicle', title: 'Vehicle & driver' }] : []),
    { key: 'review', title: 'Review & submit' },
  ]
  const key = steps[step - 1].key
  const last = step === steps.length
  const [errors, setErrors] = useState({})
  const [banner, setBanner] = useState([])
  const [busy, setBusy] = useState(false)
  const [recheck, setRecheck] = useState(0)
  const requestId = useRef(typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()))
  const isAdmin = meta.me.role === 'admin'
  const party = partyOf(f.bookingType)
  const set = (path, val) => setF(x => setIn(x, path, val))

  useEffect(() => {
    // New bookings for a showroom user are always for that showroom
    if (!editing && !isAdmin && meta.me.storeId) setF(x => ({ ...x, storeId: meta.me.storeId }))
  }, [editing, isAdmin, meta.me.storeId])

  const onType = (v) => {
    setF(x => {
      const p = partyOf(v)
      let purpose = x.trip.purpose
      if (p === 'employee') purpose = 'Employee Transport'
      else if (p === 'customer' && (!purpose || purpose === 'Employee Transport')) purpose = 'Customer Visit'
      return { ...setIn(x, 'trip.purpose', purpose), bookingType: v }
    })
  }

  const check = (s) => {
    const e = {}
    if (s === 1) {
      if (!f.bookingType) e.bookingType = 'Choose a booking type'
      if (isAdmin && !f.storeId) e.storeId = 'Choose a showroom'
      if (!f.requester.name.trim()) e['requester.name'] = 'Required'
      if (!validMobile(f.requester.mobile)) e['requester.mobile'] = 'Enter a valid 10-digit mobile number'
      if (party === 'delivery') {
        const d = f.delivery
        if (!d.sendingUnit.trim()) e['delivery.sendingUnit'] = 'Required'
        if (!d.receivingUnit.trim()) e['delivery.receivingUnit'] = 'Required'
        if (!d.recipientName.trim()) e['delivery.recipientName'] = 'Required'
        if (!validMobile(d.recipientMobile)) e['delivery.recipientMobile'] = 'Enter a valid 10-digit mobile number'
        if (!d.itemCategory) e['delivery.itemCategory'] = 'Required'
        if (!d.itemDescription.trim()) e['delivery.itemDescription'] = 'Required'
        if (d.itemCategory === 'Jewellery' && !d.authorisationRef.trim()) e['delivery.authorisationRef'] = 'Required for jewellery'
      }
    }
    if (s === 2) {
      const t = f.trip
      if (!t.travelDate) e['trip.travelDate'] = 'Required'
      else if (t.travelDate < todayIST()) e['trip.travelDate'] = 'Cannot be in the past'
      if (!t.pickupTime) e['trip.pickupTime'] = 'Required'
      if (!t.pickup.address.trim()) e['trip.pickup'] = 'Pickup location is required'
      if (!t.drop.address.trim()) e['trip.drop'] = 'Drop location is required'
      if (t.tripType === 'Multiple Stops' && !t.stops.some(x => x.address.trim())) e['trip.stops'] = 'Add at least one stop'
      if (t.tripType === 'Round Trip' && (!t.returnLeg.date || !t.returnLeg.time)) e['trip.returnLeg'] = 'Return date and time are required'
      if (party !== 'delivery') {
        const n = parseInt(t.passengers, 10)
        if (!(n >= 1 && n <= 60)) e['trip.passengers'] = '1 to 60'
        if (!t.purpose) e['trip.purpose'] = 'Required'
      }
    }
    return e
  }

  const availQuery = (() => {
    const t = f.trip
    if (!t.travelDate || !t.pickupTime) return ''
    const p = new URLSearchParams({ travelDate: t.travelDate, pickupTime: t.pickupTime, tripType: t.tripType })
    if (t.expectedDropTime) p.set('expectedDropTime', t.expectedDropTime)
    if (t.tripType === 'Round Trip' && t.returnLeg.date && t.returnLeg.time) { p.set('returnDate', t.returnLeg.date); p.set('returnTime', t.returnLeg.time) }
    const stops = t.stops.filter(x => x.address.trim()).length
    if (stops) p.set('stops', String(stops))
    if (party === 'delivery') p.set('party', 'delivery'); else if (t.passengers) p.set('passengers', String(t.passengers))
    if (isAdmin && f.storeId) p.set('storeId', f.storeId)
    if (editing) p.set('bookingId', f.id)
    return p.toString()
  })()

  const next = () => {
    const e = check(step)
    setErrors(e)
    if (Object.keys(e).length) { setBanner(Object.values(e)); return }
    setBanner([]); setStep(step + 1)
  }

  const save = async (saveAs) => {
    if (busy) return
    if (saveAs === 'Requested') {
      for (const s of [1, 2]) {
        const e = check(s)
        if (Object.keys(e).length) { setErrors(e); setBanner(Object.values(e)); setStep(s); return }
      }
    } else if (saveAs === 'Confirmed') {
      for (const s of [1, 2]) {
        const e = check(s)
        if (Object.keys(e).length) { setErrors(e); setBanner(Object.values(e)); setStep(s); return }
      }
      if (!!f.vehicleId !== !!f.driverId) { setBanner(['Choose both a vehicle and a driver, or neither']); setStep(steps.findIndex(x => x.key === 'vehicle') + 1 || step); return }
    } else if (!f.bookingType) {
      setErrors({ bookingType: 'Choose a booking type' }); setBanner(['Choose a booking type before saving a draft']); setStep(1); return
    }
    setBusy(true); setBanner([])
    try {
      const body = { ...f, saveAs, clientRequestId: requestId.current }
      // Only a confirmation, or a booking that already has a vehicle, carries a vehicle choice
      if (saveAs !== 'Confirmed' && !f.hadAllocation) { delete body.vehicleId; delete body.driverId }
      const res = editing
        ? await api(`bookings/${f.id}`, { method: 'PUT', body })
        : await api('bookings', { method: 'POST', body })
      const b = res.booking
      if (res.confirmError) toast.warning(`Booking ${b.bookingNo} saved but not confirmed: ${res.confirmError}`, { duration: 9000 })
      else toast.success(saveAs === 'Confirmed'
        ? `Booking ${b.bookingNo} ${b.allocation ? `confirmed with ${b.allocation.vehicleNumber}` : 'confirmed'}`
        : saveAs === 'Requested'
          ? `Booking ${b.bookingNo} submitted`
          : editing ? 'Changes saved' : 'Draft saved')
      onDone(b)
    } catch (e) {
      setBanner(String(e.message || 'Could not save').split('; '))
      setRecheck(n => n + 1)
      toast.error('Could not save the booking')
    } finally { setBusy(false) }
  }

  const E = (k) => errors[k]

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button>
        <h2 className="text-lg font-semibold" style={{ fontFamily: 'Georgia, serif' }}>
          {editing ? `Edit booking ${initial.bookingNo || '(draft)'}` : 'New Booking'}
        </h2>
      </div>

      <div className="flex gap-2 text-xs">
        {steps.map(({ title: t }, i) => (
          <div key={t} className={`flex-1 rounded-lg px-3 py-2 border ${step === i + 1 ? 'text-white border-transparent' : 'bg-white text-slate-500'}`}
            style={step === i + 1 ? { background: '#231F20' } : undefined}>
            <span className="font-semibold">{i + 1}.</span> <span className="hidden sm:inline">{t}</span>
          </div>
        ))}
      </div>

      {banner.length > 0 && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700" role="alert">
          <div className="font-medium mb-1">Please fix the following</div>
          <ul className="list-disc pl-5 space-y-0.5">{banner.map((m, i) => <li key={i}>{m}</li>)}</ul>
        </div>
      )}

      {key === 'details' && (
        <>
          <Section title="Booking information">
            <Field label="Booking type" required error={E('bookingType')}>
              <Pick value={f.bookingType} onChange={onType} options={BOOKING_TYPES.map(t => t.value)} placeholder="Choose type" />
            </Field>
            <Field label="Booking source">
              <Pick value={f.source} onChange={v => set('source', v)} options={SOURCES} />
            </Field>
            <Field label="Priority">
              <Pick value={f.priority} onChange={v => set('priority', v)} options={PRIORITIES} />
            </Field>
            <Field label="Requesting showroom" required={isAdmin} error={E('storeId')}>
              {isAdmin
                ? <Pick value={f.storeId} onChange={v => set('storeId', v)} options={meta.stores} placeholder="Choose showroom" disabled={editing} />
                : <Input value={f.storeId || meta.me.storeId} disabled />}
            </Field>
            <Field label="Requesting department" hint="Optional">
              <Input value={f.department} onChange={e => set('department', e.target.value)} maxLength={80} />
            </Field>
            <Field label="Brand Host" hint={meta.brandHosts.length ? undefined : 'Filled in from your login'}>
              {meta.me.role === 'brand_host'
                ? <Input value={`${meta.me.name}${meta.me.empId ? ` (${meta.me.empId})` : ''}`} disabled />
                : (
                  <Pick value={f.brandHostUsername} onChange={v => set('brandHostUsername', v)}
                    options={meta.brandHosts.map(h => ({ value: h.username, label: `${h.name} (${h.storeId})` }))}
                    placeholder={`Me (${meta.me.name})`} />
                )}
            </Field>
          </Section>

          {party && (
            <Section
              title={party === 'customer' ? 'Customer details' : party === 'employee' ? 'Employee details' : party === 'delivery' ? 'Delivery details' : 'Contact details'}
              note={party === 'delivery' && (
                <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900">
                  Do not enter jewellery weights, values or inventory details here. Use the authorisation reference (gate pass or approval number)
                  and follow the usual security procedure.
                </div>
              )}
            >
              <Field label={party === 'delivery' ? 'Requester name' : party === 'employee' ? 'Employee name' : party === 'customer' ? 'Customer name' : 'Contact name'} required error={E('requester.name')}>
                <Input value={f.requester.name} onChange={e => set('requester.name', e.target.value)} maxLength={100} />
              </Field>
              <Field label={party === 'delivery' ? 'Requester contact number' : 'Mobile number'} required error={E('requester.mobile')}>
                <Input inputMode="tel" value={f.requester.mobile} onChange={e => set('requester.mobile', e.target.value)} maxLength={20} />
              </Field>

              {party === 'customer' && (
                <>
                  <Field label="Customer ID / CRM reference" hint="Optional. Keeps repeat visits together">
                    <Input value={f.requester.crmRef} onChange={e => set('requester.crmRef', e.target.value)} maxLength={40} />
                  </Field>
                  <Field label="Customer type">
                    <Pick value={f.requester.customerType} onChange={v => set('requester.customerType', v)} options={CUSTOMER_TYPES} />
                  </Field>
                  <Field label="Preferred language" hint="Optional">
                    <Input value={f.requester.language} onChange={e => set('requester.language', e.target.value)} maxLength={30} />
                  </Field>
                </>
              )}

              {party === 'employee' && (
                <>
                  <Field label="Employee ID">
                    <Input value={f.requester.empId} onChange={e => set('requester.empId', e.target.value)} maxLength={30} />
                  </Field>
                  <Field label="Department">
                    <Input value={f.requester.department} onChange={e => set('requester.department', e.target.value)} maxLength={80} />
                  </Field>
                  <Field label="Approving manager" hint="If applicable">
                    <Input value={f.requester.approvingManager} onChange={e => set('requester.approvingManager', e.target.value)} maxLength={100} />
                  </Field>
                </>
              )}

              {party === 'delivery' && (
                <>
                  <Field label="Sending showroom / department" required error={E('delivery.sendingUnit')}>
                    <Input value={f.delivery.sendingUnit} onChange={e => set('delivery.sendingUnit', e.target.value)} maxLength={80} />
                  </Field>
                  <Field label="Receiving showroom / department" required error={E('delivery.receivingUnit')}>
                    <Input value={f.delivery.receivingUnit} onChange={e => set('delivery.receivingUnit', e.target.value)} maxLength={80} />
                  </Field>
                  <Field label="Recipient name" required error={E('delivery.recipientName')}>
                    <Input value={f.delivery.recipientName} onChange={e => set('delivery.recipientName', e.target.value)} maxLength={100} />
                  </Field>
                  <Field label="Recipient contact number" required error={E('delivery.recipientMobile')}>
                    <Input inputMode="tel" value={f.delivery.recipientMobile} onChange={e => set('delivery.recipientMobile', e.target.value)} maxLength={20} />
                  </Field>
                  <Field label="Item category" required error={E('delivery.itemCategory')}>
                    <Pick value={f.delivery.itemCategory} onChange={v => set('delivery.itemCategory', v)} options={ITEM_CATEGORIES} />
                  </Field>
                  <Field label="Authorisation reference" required={f.delivery.itemCategory === 'Jewellery'} error={E('delivery.authorisationRef')} hint="Gate pass or approval number">
                    <Input value={f.delivery.authorisationRef} onChange={e => set('delivery.authorisationRef', e.target.value)} maxLength={40} />
                  </Field>
                  <Field label="Delivery reference number" hint="Optional">
                    <Input value={f.delivery.referenceNo} onChange={e => set('delivery.referenceNo', e.target.value)} maxLength={40} />
                  </Field>
                  <Field label="Item description" required error={E('delivery.itemDescription')} hint="Keep it minimal, for example “sealed pouch” or “documents”">
                    <Input value={f.delivery.itemDescription} onChange={e => set('delivery.itemDescription', e.target.value)} maxLength={120} />
                  </Field>
                  <Field label="Special handling instructions" className="sm:col-span-2" error={E('delivery.handling')}>
                    <Input value={f.delivery.handling} onChange={e => set('delivery.handling', e.target.value)} maxLength={200} />
                  </Field>
                </>
              )}
            </Section>
          )}

          <Field label="Booking remarks" hint="Optional. No weights, values or amounts" error={E('remarks')}>
            <Textarea rows={2} value={f.remarks} onChange={e => set('remarks', e.target.value)} maxLength={500} />
          </Field>
        </>
      )}

      {key === 'schedule' && (
        <>
          <Section title="Schedule">
            <Field label="Travel date" required error={E('trip.travelDate')}>
              <Input type="date" min={todayIST()} value={f.trip.travelDate} onChange={e => set('trip.travelDate', e.target.value)} />
            </Field>
            <Field label="Pickup time" required error={E('trip.pickupTime')}>
              <Input type="time" value={f.trip.pickupTime} onChange={e => set('trip.pickupTime', e.target.value)} />
            </Field>
            <Field label="Expected drop time" hint="Optional, same day" error={E('trip.expectedDropTime')}>
              <Input type="time" value={f.trip.expectedDropTime} onChange={e => set('trip.expectedDropTime', e.target.value)} />
            </Field>
            <Field label="Trip type" required>
              <Pick value={f.trip.tripType} onChange={v => set('trip.tripType', v)} options={TRIP_TYPES} />
            </Field>
          </Section>

          <Section title="Locations" note={
            <p className="text-[11px] text-slate-500">Type the full address. Map search and route estimates are coming in a later phase.</p>
          }>
            <Field label="Pickup location" required error={E('trip.pickup')} className="sm:col-span-2">
              <Input value={f.trip.pickup.address} onChange={e => set('trip.pickup.address', e.target.value)} maxLength={300} placeholder="Building, street, locality, city" />
            </Field>
            <Field label="Pickup landmark" hint="Optional">
              <Input value={f.trip.pickup.landmark} onChange={e => set('trip.pickup.landmark', e.target.value)} maxLength={120} />
            </Field>
            <div className="hidden sm:block" />
            <Field label="Drop location" required error={E('trip.drop')} className="sm:col-span-2">
              <Input value={f.trip.drop.address} onChange={e => set('trip.drop.address', e.target.value)} maxLength={300} placeholder="Building, street, locality, city" />
            </Field>
            <Field label="Drop landmark" hint="Optional">
              <Input value={f.trip.drop.landmark} onChange={e => set('trip.drop.landmark', e.target.value)} maxLength={120} />
            </Field>
            <div className="hidden sm:block" />

            {(f.trip.tripType === 'Multiple Stops' || f.trip.stops.length > 0) && (
              <div className="sm:col-span-2 space-y-2">
                <Label className="text-xs font-semibold tracking-wide text-slate-600">Additional stops</Label>
                {f.trip.stops.map((s, i) => (
                  <div key={i} className="flex gap-2">
                    <Input value={s.address} placeholder={`Stop ${i + 1} address`} maxLength={300}
                      onChange={e => set('trip.stops', f.trip.stops.map((x, j) => j === i ? { ...x, address: e.target.value } : x))} />
                    <Button type="button" variant="outline" size="sm" aria-label={`Remove stop ${i + 1}`}
                      onClick={() => set('trip.stops', f.trip.stops.filter((_, j) => j !== i))}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                ))}
                {E('trip.stops') && <p className="text-[11px] text-rose-600">{E('trip.stops')}</p>}
                {f.trip.stops.length < 5 && (
                  <Button type="button" variant="outline" size="sm"
                    onClick={() => set('trip.stops', [...f.trip.stops, { address: '', landmark: '' }])}><Plus className="w-4 h-4 mr-1" /> Add stop</Button>
                )}
              </div>
            )}

            {f.trip.tripType === 'Round Trip' && (
              <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-lg bg-slate-50 p-3">
                <Field label="Return pickup location" hint="Leave blank to use the drop location" className="sm:col-span-3">
                  <Input value={f.trip.returnLeg.address} onChange={e => set('trip.returnLeg.address', e.target.value)} maxLength={300} />
                </Field>
                <Field label="Return date" required error={E('trip.returnLeg')}>
                  <Input type="date" min={f.trip.travelDate || todayIST()} value={f.trip.returnLeg.date} onChange={e => set('trip.returnLeg.date', e.target.value)} />
                </Field>
                <Field label="Return time" required>
                  <Input type="time" value={f.trip.returnLeg.time} onChange={e => set('trip.returnLeg.time', e.target.value)} />
                </Field>
              </div>
            )}
          </Section>

          <Section title={party === 'delivery' ? 'Delivery notes' : 'Passengers & purpose'}>
            {party !== 'delivery' && (
              <>
                <Field label="Number of passengers" required error={E('trip.passengers')}>
                  <Input type="number" min={1} max={60} value={f.trip.passengers} onChange={e => set('trip.passengers', e.target.value)} />
                </Field>
                <Field label="Booking purpose" required error={E('trip.purpose')}>
                  <Pick value={f.trip.purpose} onChange={v => set('trip.purpose', v)} options={PURPOSES.filter(p => p !== 'Item Delivery')} />
                </Field>
                <Field label="Luggage or special requirements" hint="Optional" className="sm:col-span-2">
                  <Input value={f.trip.luggage} onChange={e => set('trip.luggage', e.target.value)} maxLength={120} />
                </Field>
              </>
            )}
            <Field label="Additional instructions" hint="Optional" className="sm:col-span-2">
              <Textarea rows={2} value={f.trip.instructions} onChange={e => set('trip.instructions', e.target.value)} maxLength={400} />
            </Field>
          </Section>
        </>
      )}

      {key === 'vehicle' && (
        <div className="rounded-xl border bg-white p-4 space-y-3">
          <div className="text-sm font-semibold" style={{ fontFamily: 'Georgia, serif' }}>Vehicle & driver</div>
          <AllocationPanel api={api} query={availQuery} vehicleId={f.vehicleId} driverId={f.driverId} refreshKey={recheck}
            onPick={({ vehicleId, driverId }) => setF(x => ({ ...x, vehicleId, driverId }))}
            onSuggest={(s) => { set('trip.pickupTime', s.pickupTime) }} />
          <p className="text-[11px] text-slate-500">Optional. You can submit the request now and allocate later. A vehicle and driver are held only when the booking is confirmed.</p>
        </div>
      )}

      {key === 'review' && (
        <div className="rounded-xl border bg-white p-4 space-y-3 text-sm">
          <div className="text-sm font-semibold" style={{ fontFamily: 'Georgia, serif' }}>Booking summary</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
            <Row k="Type" v={`${f.bookingType} · ${f.priority}`} />
            <Row k="Showroom" v={f.storeId || meta.me.storeId} />
            <Row k={party === 'delivery' ? 'Requester' : party === 'employee' ? 'Employee' : 'Customer'} v={`${f.requester.name} · ${f.requester.mobile}`} />
            {party === 'delivery' && <Row k="Recipient" v={`${f.delivery.recipientName} · ${f.delivery.receivingUnit}`} />}
            {party === 'delivery' && <Row k="Item" v={`${f.delivery.itemCategory}${f.delivery.authorisationRef ? ` · Ref ${f.delivery.authorisationRef}` : ''}`} />}
            <Row k="Travel" v={`${fmtDay(f.trip.travelDate)} at ${f.trip.pickupTime}${f.trip.expectedDropTime ? ` (drop about ${f.trip.expectedDropTime})` : ''}`} />
            <Row k="Trip type" v={f.trip.tripType} />
            <Row k="Pickup" v={f.trip.pickup.address} />
            <Row k="Drop" v={f.trip.drop.address} />
            {f.trip.stops.filter(s => s.address).map((s, i) => <Row key={i} k={`Stop ${i + 1}`} v={s.address} />)}
            {f.trip.tripType === 'Round Trip' && <Row k="Return" v={`${fmtDay(f.trip.returnLeg.date)} at ${f.trip.returnLeg.time}`} />}
            {party !== 'delivery' && <Row k="Passengers" v={`${f.trip.passengers} · ${f.trip.purpose}`} />}
            {canAlloc && <Row k="Vehicle" v={f.vehicleId ? 'Chosen, checked again when you confirm' : 'Not chosen'} />}
          </div>
          <div className="rounded-lg bg-slate-50 border p-3 text-xs text-slate-600">
            {canAlloc
              ? <>Submit request keeps the booking as <b>Requested</b> so it can be confirmed later. Confirm booking checks availability once more and holds the vehicle and driver
                  {f.vehicleId ? '.' : ' (no vehicle is chosen, so it will be confirmed without one).'}</>
              : <>Submitting creates the booking and its booking number. The Facility team will confirm it and allocate a vehicle and driver.</>}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 sticky bottom-0 bg-slate-50/95 py-3">
        <div>{step > 1 && <Button variant="outline" onClick={() => { setBanner([]); setStep(step - 1) }} disabled={busy}>Back</Button>}</div>
        <div className="flex flex-wrap gap-2">
          {!last && (
            <>
              <Button variant="outline" onClick={() => save('Draft')} disabled={busy}>{editing && initial.status !== 'Draft' ? 'Save changes' : 'Save draft'}</Button>
              <Button onClick={next} style={{ background: RED }} className="text-white hover:brightness-110">Next</Button>
            </>
          )}
          {last && (
            <>
              {(!editing || initial.status === 'Draft') && <Button variant="outline" onClick={() => save('Draft')} disabled={busy}>Save draft</Button>}
              {(!editing || ['Draft', 'Requested'].includes(initial.status)) && canAlloc && (
                <Button variant="outline" onClick={() => save('Confirmed')} disabled={busy}>
                  <Car className="w-4 h-4 mr-1" /> {f.vehicleId ? 'Confirm with vehicle' : 'Confirm without vehicle'}
                </Button>
              )}
              <Button onClick={() => save('Requested')} disabled={busy} style={{ background: RED }} className="text-white hover:brightness-110">
                <CheckCircle2 className="w-4 h-4 mr-1" /> {busy ? 'Saving…' : editing && initial.status !== 'Draft' ? 'Save changes' : 'Submit request'}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

const Row = ({ k, v }) => (
  <div className="flex gap-2"><span className="text-slate-500 min-w-[84px]">{k}</span><span className="font-medium break-words">{v || '-'}</span></div>
)

// ================= DETAIL DIALOG =================
const esc = (s) => String(s ?? '-').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

function printBooking(b) {
  const rows = [
    ['Booking ID', b.bookingNo || 'Draft'], ['Status', b.status], ['Type', `${b.bookingType} (${b.priority})`], ['Showroom', b.storeId],
    ['Name', b.requester?.name], ['Contact', b.requester?.mobile], ['Brand Host', b.brandHost?.name],
    ['Travel date', fmtDay(b.trip?.travelDate)], ['Pickup time', b.trip?.pickupTime],
    ['Pickup', b.trip?.pickup?.address], ['Drop', b.trip?.drop?.address],
    ['Passengers', b.trip?.passengers ?? '-'], ['Purpose', b.trip?.purpose], ['Instructions', b.trip?.instructions],
    ['Vehicle', b.allocation ? `${b.allocation.vehicleNumber} ${b.allocation.vehicleModel || ''}` : 'Not allocated'], ['Driver', b.allocation?.driverName || '-'],
    ['Created by', `${b.createdBy?.name} on ${fmtWhen(b.createdAt)}`],
  ]
  const w = window.open('', '_blank', 'width=720,height=800')
  if (!w) { toast.error('Allow pop-ups to print'); return }
  w.document.write(`<html><head><title>${esc(b.bookingNo || 'Booking')}</title><style>
    body{font-family:Arial,sans-serif;padding:32px;color:#231F20}h1{font-size:18px;border-bottom:3px solid #E60000;padding-bottom:8px}
    td{padding:6px 10px;border-bottom:1px solid #ddd;font-size:13px;vertical-align:top}td:first-child{color:#666;width:140px}
    </style></head><body><h1>C. Krishniah Chetty · Vehicle Booking</h1><table>
    ${rows.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join('')}</table></body></html>`)
  w.document.close(); w.focus(); w.print()
}

function BookingDetail({ api, id, onClose, onEdit, onChanged }) {
  const [data, setData] = useState(null)
  const [cancelling, setCancelling] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [alloc, setAlloc] = useState(null) // { mode: 'confirm' | 'allocate', vehicleId, driverId }
  const [recheck, setRecheck] = useState(0)

  const load = () => api(`bookings/${id}`).then(setData).catch(e => { toast.error(e.message); onClose() })
  useEffect(() => { load() }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  const b = data?.booking
  const act = async (status) => {
    if (busy) return
    setBusy(true)
    try {
      await api(`bookings/${id}/status`, { method: 'POST', body: { status, reason } })
      toast.success(status === 'Cancelled' ? 'Booking cancelled' : 'Booking submitted')
      setCancelling(false); setReason('')
      await load(); onChanged()
    } catch (e) { toast.error(e.message) } finally { setBusy(false) }
  }

  const submitAlloc = async () => {
    if (busy || !alloc) return
    if (!!alloc.vehicleId !== !!alloc.driverId) { toast.error('Choose both a vehicle and a driver'); return }
    if (alloc.mode === 'allocate' && !alloc.vehicleId) { toast.error('Choose a vehicle and a driver'); return }
    setBusy(true)
    try {
      const r = await api(`bookings/${id}/${alloc.mode}`, { method: 'POST', body: { vehicleId: alloc.vehicleId, driverId: alloc.driverId } })
      toast.success(r.booking?.allocation ? `${alloc.mode === 'confirm' ? 'Confirmed' : 'Assigned'}: ${r.booking.allocation.vehicleNumber}` : 'Booking confirmed')
      setAlloc(null)
      await load(); onChanged()
    } catch (e) { toast.error(e.message); setRecheck(n => n + 1) } finally { setBusy(false) }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{b ? `${b.bookingNo || 'Draft booking'}` : 'Booking'}</DialogTitle></DialogHeader>
        {!b ? <div className="py-8 text-center text-sm text-slate-500">Loading…</div> : (
          <div className="space-y-4 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={b.status} />
              <span className="text-slate-500">{b.bookingType} · {b.priority} · {b.storeId}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
              <Row k="Name" v={b.requester?.name} />
              <Row k="Contact" v={b.requester?.mobile} />
              {b.requester?.crmRef && <Row k="CRM ref" v={b.requester.crmRef} />}
              {b.requester?.empId && <Row k="Employee ID" v={b.requester.empId} />}
              <Row k="Brand Host" v={b.brandHost?.name} />
              <Row k="Travel" v={`${fmtDay(b.trip?.travelDate)} at ${b.trip?.pickupTime}`} />
              <Row k="Pickup" v={b.trip?.pickup?.address} />
              <Row k="Drop" v={b.trip?.drop?.address} />
              {(b.trip?.stops || []).map((s, i) => <Row key={i} k={`Stop ${i + 1}`} v={s.address} />)}
              {b.trip?.returnLeg && <Row k="Return" v={`${fmtDay(b.trip.returnLeg.date)} at ${b.trip.returnLeg.time}`} />}
              {b.party !== 'delivery' && <Row k="Passengers" v={`${b.trip?.passengers ?? '-'} · ${b.trip?.purpose || '-'}`} />}
              {b.delivery && <Row k="Recipient" v={`${b.delivery.recipientName} · ${b.delivery.recipientMobile}`} />}
              {b.delivery && <Row k="Item" v={`${b.delivery.itemCategory}${b.delivery.authorisationRef ? ` · Ref ${b.delivery.authorisationRef}` : ''}`} />}
              {b.remarks && <Row k="Remarks" v={b.remarks} />}
              {b.allocation && <Row k="Vehicle" v={`${b.allocation.vehicleNumber}${b.allocation.vehicleModel ? ` · ${b.allocation.vehicleModel}` : ''}`} />}
              {b.allocation && <Row k="Driver" v={`${b.allocation.driverName}${b.allocation.driverMobile ? ` · ${b.allocation.driverMobile}` : ''}`} />}
              {(b.scheduleHistory || []).length > 0 && <Row k="Rescheduled" v={`${b.scheduleHistory.length} time${b.scheduleHistory.length === 1 ? '' : 's'}; first planned ${fmtDay(b.scheduleHistory[0].from?.travelDate)} at ${b.scheduleHistory[0].from?.pickupTime}`} />}
              {b.cancellation && <Row k="Cancelled" v={`${b.cancellation.reason} (${b.cancellation.by?.name})`} />}
            </div>
            {b.contactsMasked && <p className="text-xs text-slate-500">Contact numbers are hidden on bookings created by someone else.</p>}

            <div className="flex flex-wrap gap-2">
              {b.permissions.canEdit && <Button size="sm" variant="outline" onClick={() => onEdit(b)}>Edit</Button>}
              {b.permissions.canSubmit && <Button size="sm" disabled={busy} onClick={() => act('Requested')} style={{ background: RED }} className="text-white">Submit request</Button>}
              {b.permissions.canConfirm && !alloc && <Button size="sm" onClick={() => setAlloc({ mode: 'confirm', vehicleId: '', driverId: '' })} style={{ background: RED }} className="text-white"><Car className="w-4 h-4 mr-1" /> Confirm booking</Button>}
              {b.permissions.canAllocate && !alloc && <Button size="sm" variant="outline" onClick={() => setAlloc({ mode: 'allocate', vehicleId: '', driverId: '' })}><Car className="w-4 h-4 mr-1" /> {b.allocation ? 'Change vehicle / driver' : 'Allocate vehicle'}</Button>}
              {b.permissions.canCancel && !cancelling && <Button size="sm" variant="outline" className="text-rose-600" onClick={() => setCancelling(true)}>Cancel booking</Button>}
              <Button size="sm" variant="outline" onClick={() => printBooking(b)}><FileText className="w-4 h-4 mr-1" /> Print</Button>
            </div>

            {alloc && (
              <div className="rounded-lg border bg-slate-50 p-3 space-y-3">
                <div className="text-sm font-semibold">{alloc.mode === 'confirm' ? 'Confirm booking' : b.allocation ? 'Change vehicle and driver' : 'Allocate vehicle and driver'}</div>
                <AllocationPanel api={api} query={`bookingId=${encodeURIComponent(id)}`} vehicleId={alloc.vehicleId} driverId={alloc.driverId} refreshKey={recheck}
                  onPick={({ vehicleId, driverId }) => setAlloc(a => a && ({ ...a, vehicleId, driverId }))}
                  onSuggest={() => toast.info('To use another time, edit the booking and change the pickup time')} />
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" disabled={busy} onClick={submitAlloc} style={{ background: RED }} className="text-white">
                    {busy ? 'Saving…' : alloc.mode === 'confirm' ? (alloc.vehicleId ? 'Confirm with vehicle' : 'Confirm without vehicle') : 'Save allocation'}
                  </Button>
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => setAlloc(null)}>Close</Button>
                </div>
              </div>
            )}

            {cancelling && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 space-y-2">
                <Label className="text-xs font-semibold">Cancellation reason *</Label>
                <Textarea rows={2} value={reason} onChange={e => setReason(e.target.value)} maxLength={300} />
                <div className="flex gap-2">
                  <Button size="sm" disabled={busy || reason.trim().length < 3} onClick={() => act('Cancelled')} className="bg-rose-600 text-white">Confirm cancellation</Button>
                  <Button size="sm" variant="outline" onClick={() => { setCancelling(false); setReason('') }}>Keep booking</Button>
                </div>
              </div>
            )}

            <div className="border-t pt-3">
              <Label className="text-xs text-slate-500 uppercase tracking-wide">Status history</Label>
              <div className="text-xs text-slate-600 space-y-1 mt-1">
                {data.history.map(h => (
                  <div key={h.id}>{fmtWhen(h.at)} — <b>{h.from ? `${h.from} → ${h.to}` : `Created as ${h.to}`}</b> by {h.by?.name}{h.remarks ? ` · ${h.remarks}` : ''}</div>
                ))}
              </div>
            </div>
            {data.audit && (
              <div className="border-t pt-3">
                <Label className="text-xs text-slate-500 uppercase tracking-wide">Audit trail (admin)</Label>
                <div className="text-xs text-slate-600 space-y-1 mt-1">
                  {data.audit.map(a => (
                    <div key={a.id}>{fmtWhen(a.at)} — <b>{a.action}</b> by {a.by?.name} ({a.by?.role}){a.changedFields?.length ? ` · changed: ${a.changedFields.join(', ')}` : ''}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        <DialogFooter><Button variant="outline" onClick={onClose}>Close</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ================= ALL BOOKINGS REGISTER =================
function AllBookings({ api, meta, refreshKey, onOpen, onNew }) {
  const [f, setF] = useState({ q: '', status: '', type: '', from: '', to: '', store: '', vehicle: '', driver: '' })
  const [debounced, setDebounced] = useState(f)
  const [sort, setSort] = useState({ key: 'created', dir: 'desc' })
  const [page, setPage] = useState(1)
  const [res, setRes] = useState({ items: [], total: 0, pageSize: 25 })
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState('')

  useEffect(() => { const t = setTimeout(() => { setDebounced(f); setPage(1) }, 350); return () => clearTimeout(t) }, [f])

  const qs = (extra = {}) => {
    const p = new URLSearchParams()
    Object.entries({ ...debounced, sort: sort.key, dir: sort.dir, ...extra }).forEach(([k, v]) => { if (v) p.set(k, v) })
    return p.toString()
  }

  useEffect(() => {
    let live = true
    setLoading(true); setFailed('')
    api(`bookings?${qs({ page })}`)
      .then(r => { if (live) setRes(r) })
      .catch(e => { if (live) setFailed(e.message) })
      .finally(() => { if (live) setLoading(false) })
    return () => { live = false }
  }, [debounced, sort, page, refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const exportCsv = async () => {
    try {
      const r = await fetch(`/api/bookings?${qs({ format: 'csv' })}`, { credentials: 'same-origin' })
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Export failed')
      const url = URL.createObjectURL(await r.blob())
      const a = document.createElement('a'); a.href = url; a.download = `bookings-${todayIST()}.csv`; a.click()
      URL.revokeObjectURL(url)
    } catch (e) { toast.error(e.message) }
  }

  const sortBy = (key) => setSort(s => s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' })
  const Th = ({ k, children }) => (
    <th className="p-2 text-left whitespace-nowrap">
      {k ? <button className="font-semibold hover:underline" onClick={() => sortBy(k)}>{children}{sort.key === k ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''}</button> : children}
    </th>
  )
  const pages = Math.max(1, Math.ceil(res.total / res.pageSize))
  const set = (k, v) => setF(x => ({ ...x, [k]: v }))

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
        <div className="relative col-span-2">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-400" />
          <Input className="pl-8" placeholder="Search ID, name, full mobile, place" value={f.q} onChange={e => set('q', e.target.value)} />
        </div>
        <Pick value={f.status} onChange={v => set('status', v)} options={STATUSES} placeholder="All statuses" />
        <Pick value={f.type} onChange={v => set('type', v)} options={BOOKING_TYPES.map(t => t.value)} placeholder="All types" />
        <Input type="date" value={f.from} onChange={e => set('from', e.target.value)} aria-label="Travel date from" />
        <Input type="date" value={f.to} onChange={e => set('to', e.target.value)} aria-label="Travel date to" />
        {meta.me.role === 'admin' && <Pick value={f.store} onChange={v => set('store', v)} options={meta.stores} placeholder="All showrooms" />}
        <Pick value={f.vehicle} onChange={v => set('vehicle', v)} options={(meta.vehicles || []).map(v => ({ value: v.id, label: v.vehicleNumber }))} placeholder="All vehicles" />
        <Pick value={f.driver} onChange={v => set('driver', v)} options={(meta.drivers || []).map(d => ({ value: d.id, label: d.name }))} placeholder="All drivers" />
      </div>
      <div className="flex justify-between items-center">
        <div className="text-xs text-slate-500">{loading ? 'Loading…' : `${res.total} booking${res.total === 1 ? '' : 's'}`}</div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setF({ q: '', status: '', type: '', from: '', to: '', store: '', vehicle: '', driver: '' })}><X className="w-4 h-4 mr-1" /> Clear</Button>
          <Button variant="outline" size="sm" onClick={exportCsv}><Download className="w-4 h-4 mr-1" /> Export CSV</Button>
        </div>
      </div>

      {failed ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{failed}</div>
      ) : (
        <div className="border rounded-xl bg-white overflow-x-auto">
          <table className="w-full text-xs min-w-[1180px]">
            <thead className="bg-slate-100">
              <tr>
                <Th k="no">Booking ID</Th><Th k="travel">Travel</Th><Th>Type</Th><Th>Name</Th><Th>Contact</Th>
                <Th>Brand Host</Th><Th>Vehicle / Driver</Th><Th>Pickup → Drop</Th><Th k="status">Status</Th><Th k="updated">Updated</Th><Th />
              </tr>
            </thead>
            <tbody>
              {res.items.map(b => (
                <tr key={b.id} className="border-t hover:bg-slate-50 cursor-pointer" onClick={() => onOpen(b.id)}>
                  <td className="p-2 font-medium whitespace-nowrap">{b.bookingNo || <span className="text-slate-400">Draft</span>}</td>
                  <td className="p-2 whitespace-nowrap">{fmtDay(b.trip?.travelDate)}<div className="text-slate-500">{b.trip?.pickupTime}</div></td>
                  <td className="p-2">{b.bookingType}{b.priority === 'Urgent' && <Badge className="ml-1 bg-rose-600 text-white">Urgent</Badge>}</td>
                  <td className="p-2">{b.requester?.name}</td>
                  <td className="p-2 whitespace-nowrap">{b.requester?.mobile}</td>
                  <td className="p-2">{b.brandHost?.name}</td>
                  <td className="p-2 whitespace-nowrap">{b.allocation ? <>{b.allocation.vehicleNumber}<div className="text-slate-500">{b.allocation.driverName}</div></> : <span className="text-slate-400">Not allocated</span>}</td>
                  <td className="p-2 max-w-[260px]"><div className="truncate">{b.trip?.pickup?.address}</div><div className="truncate text-slate-500">→ {b.trip?.drop?.address}</div></td>
                  <td className="p-2"><StatusBadge status={b.status} /></td>
                  <td className="p-2 whitespace-nowrap text-slate-500">{fmtWhen(b.updatedAt)}</td>
                  <td className="p-2"><Eye className="w-4 h-4 text-slate-400" /></td>
                </tr>
              ))}
              {!loading && res.items.length === 0 && (
                <tr><td colSpan={11} className="p-8 text-center text-slate-500">
                  No bookings found. <button className="underline" onClick={onNew}>Create a booking</button>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-end gap-2 text-xs">
        <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setPage(p => p - 1)}>Previous</Button>
        <span>Page {page} of {pages}</span>
        <Button variant="outline" size="sm" disabled={page >= pages || loading} onClick={() => setPage(p => p + 1)}>Next</Button>
      </div>
    </div>
  )
}

// ================= MODULE SHELL =================
export default function BookingModule({ api, user }) {
  const [meta, setMeta] = useState(null)
  const [metaError, setMetaError] = useState('')
  const [view, setView] = useState('list') // 'list' | 'form'
  const [editing, setEditing] = useState(null)
  const [openId, setOpenId] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    api('bookings/meta').then(setMeta).catch(e => setMetaError(e.message))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (metaError) return <div className="p-6"><div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{metaError}</div></div>
  if (!meta) return <div className="p-6 text-sm text-slate-500">Loading…</div>

  const startNew = () => { setEditing(null); setView('form') }

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-6xl">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle style={{ fontFamily: 'Georgia, serif' }}>Vehicle Booking Management</CardTitle>
          {view === 'list' && (
            <Button onClick={startNew} style={{ background: RED }} className="text-white hover:brightness-110">
              <Plus className="w-4 h-4 mr-1" /> New Booking
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {view === 'list' ? (
            <AllBookings api={api} meta={meta} refreshKey={refreshKey} onOpen={setOpenId} onNew={startNew} />
          ) : (
            <BookingForm
              key={editing?.id || 'new'}
              api={api} meta={meta} initial={editing ? fromBooking(editing) : null}
              onCancel={() => { setView('list'); setEditing(null) }}
              onDone={() => { setView('list'); setEditing(null); setRefreshKey(k => k + 1) }}
            />
          )}
        </CardContent>
      </Card>

      {openId && (
        <BookingDetail
          api={api} id={openId}
          onClose={() => setOpenId(null)}
          onChanged={() => setRefreshKey(k => k + 1)}
          onEdit={(b) => { setOpenId(null); setEditing(b); setView('form') }}
        />
      )}
    </div>
  )
}
