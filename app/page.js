'use client'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import {
  LayoutDashboard, Car, Users, LogOut, Fuel, Truck, ArrowRightCircle,
  ArrowLeftCircle, AlertTriangle, ClipboardList, Search,
  Download, Gauge, ShieldAlert, Building2, ArrowLeft
} from 'lucide-react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend
} from 'recharts'

const api = async (path, opts = {}) => {
  const res = await fetch(`/api/${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Error')
  return data
}

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'
const fmtDT = (d) => d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-'
const fmtINR = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`

function Login({ onLogin }) {
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('admin123')
  const [loading, setLoading] = useState(false)
  const submit = async (e) => {
    e.preventDefault(); setLoading(true)
    try {
      const data = await api('auth/login', { method: 'POST', body: { username, password } })
      localStorage.setItem('ckc_user', JSON.stringify(data.user))
      onLogin(data.user); toast.success(`Welcome, ${data.user.name}`)
    } catch (e) { toast.error(e.message) } finally { setLoading(false) }
  }
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <Card className="w-full max-w-md shadow-2xl border-0">
        <CardHeader className="text-center space-y-2 pt-8">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold text-slate-900">CKC Fleet Management</CardTitle>
          <CardDescription className="text-slate-500">
            C Krishniah Chetty Jewellers Pvt. Ltd.<br />
            <span className="text-xs">Security Department Portal</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2"><Label>Username</Label><Input value={username} onChange={e => setUsername(e.target.value)} required /></div>
            <div className="space-y-2"><Label>Password</Label><Input type="password" value={password} onChange={e => setPassword(e.target.value)} required /></div>
            <Button type="submit" className="w-full bg-slate-900 hover:bg-slate-800" disabled={loading}>{loading ? 'Signing in...' : 'Sign In'}</Button>
            <div className="text-xs text-slate-500 bg-slate-50 p-3 rounded-md space-y-1">
              <div><b>Admin:</b> admin / admin123</div>
              <div><b>Security:</b> security / security123</div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

function AdminShell({ user, onLogout, children, active, setActive }) {
  const nav = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'vehicles', label: 'Vehicles', icon: Car },
    { id: 'drivers', label: 'Drivers', icon: Users },
    { id: 'trips', label: 'Trip Register', icon: ClipboardList },
    { id: 'fuel', label: 'Fuel Register', icon: Fuel },
    { id: 'mileage', label: 'Mileage', icon: Gauge },
    { id: 'reports', label: 'Reports', icon: Download },
  ]
  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="w-64 bg-slate-900 text-slate-100 flex-shrink-0 hidden md:flex flex-col">
        <div className="p-5 border-b border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div><div className="font-bold">CKC Fleet</div><div className="text-xs text-slate-400">Admin Panel</div></div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {nav.map(n => {
            const Icon = n.icon
            return (
              <button key={n.id} onClick={() => setActive(n.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition ${active === n.id ? 'bg-amber-500 text-white font-semibold' : 'hover:bg-slate-800 text-slate-300'}`}>
                <Icon className="w-4 h-4" /> {n.label}
              </button>
            )
          })}
        </nav>
        <div className="p-3 border-t border-slate-800">
          <div className="px-3 py-2 text-xs text-slate-400">Signed in as</div>
          <div className="px-3 pb-2 text-sm font-medium">{user.name}</div>
          <Button variant="outline" size="sm" onClick={onLogout} className="w-full bg-transparent border-slate-700 text-slate-200 hover:bg-slate-800 hover:text-white">
            <LogOut className="w-4 h-4 mr-2" /> Sign Out
          </Button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <header className="md:hidden bg-slate-900 text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-2"><Building2 className="w-5 h-5 text-amber-400" /><span className="font-bold">CKC Fleet</span></div>
          <Button variant="ghost" size="sm" onClick={onLogout} className="text-white"><LogOut className="w-4 h-4" /></Button>
        </header>
        {children}
      </main>
    </div>
  )
}

function Dashboard() {
  const [data, setData] = useState(null)
  useEffect(() => { api('dashboard').then(setData).catch(e => toast.error(e.message)) }, [])
  if (!data) return <div className="p-8">Loading...</div>
  const kpis = [
    { label: 'Total Vehicles', value: data.fleet.total, icon: Car, color: 'bg-blue-500' },
    { label: 'Available', value: data.fleet.available, icon: Truck, color: 'bg-emerald-500' },
    { label: 'Outside', value: data.fleet.outside, icon: ArrowRightCircle, color: 'bg-amber-500' },
    { label: 'Maintenance', value: data.fleet.maintenance, icon: AlertTriangle, color: 'bg-rose-500' },
  ]
  const today = [
    { label: "Today's Trips", value: data.today.trips },
    { label: 'KM Travelled', value: `${data.today.km} km` },
    { label: 'Fuel Filled', value: `${data.today.fuelLit.toFixed(1)} L` },
    { label: 'Fuel Cost', value: fmtINR(data.today.fuelCost) },
  ]
  const month = [
    { label: 'Monthly KM', value: `${data.month.km} km` },
    { label: 'Fuel (L)', value: data.month.fuelLit.toFixed(0) },
    { label: 'Fuel Cost', value: fmtINR(data.month.fuelCost) },
    { label: 'Avg Mileage', value: `${data.month.avgMileage} km/L` },
    { label: 'Low Mileage Vehicles', value: data.month.lowMileageCount, warn: true },
  ]
  const statusPie = [
    { name: 'Available', value: data.fleet.available, color: '#10b981' },
    { name: 'Outside', value: data.fleet.outside, color: '#f59e0b' },
    { name: 'Maintenance', value: data.fleet.maintenance, color: '#ef4444' },
    { name: 'Inactive', value: data.fleet.inactive, color: '#94a3b8' },
  ].filter(s => s.value > 0)
  return (
    <div className="p-6 space-y-6">
      <div><h1 className="text-3xl font-bold text-slate-900">Fleet Dashboard</h1><p className="text-slate-500">Real-time overview of fleet operations</p></div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map(k => {
          const Icon = k.icon
          return (
            <Card key={k.label}><CardContent className="p-5 flex items-center gap-4">
              <div className={`${k.color} w-12 h-12 rounded-lg flex items-center justify-center text-white`}><Icon className="w-6 h-6" /></div>
              <div><div className="text-2xl font-bold">{k.value}</div><div className="text-xs text-slate-500">{k.label}</div></div>
            </CardContent></Card>
          )
        })}
      </div>
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Today's Summary</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            {today.map(t => (<div key={t.label} className="p-4 bg-slate-50 rounded-lg"><div className="text-xs text-slate-500">{t.label}</div><div className="text-xl font-bold">{t.value}</div></div>))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>This Month</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            {month.map(t => (<div key={t.label} className={`p-4 rounded-lg ${t.warn && t.value > 0 ? 'bg-rose-50 border border-rose-200' : 'bg-slate-50'}`}><div className="text-xs text-slate-500">{t.label}</div><div className={`text-xl font-bold ${t.warn && t.value > 0 ? 'text-rose-600' : ''}`}>{t.value}</div></div>))}
          </CardContent>
        </Card>
      </div>
      <div className="grid md:grid-cols-3 gap-6">
        <Card className="md:col-span-2">
          <CardHeader><CardTitle>Daily Trips & Fuel Cost (7 days)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.daily}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="date" fontSize={12} /><YAxis yAxisId="l" fontSize={12} /><YAxis yAxisId="r" orientation="right" fontSize={12} />
                <Tooltip /><Legend />
                <Bar yAxisId="l" dataKey="trips" fill="#0f172a" name="Trips" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="r" dataKey="fuelCost" fill="#f59e0b" name="Fuel ₹" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Fleet Status</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={statusPie} dataKey="value" nameKey="name" outerRadius={80} label>
                  {statusPie.map((s, i) => <Cell key={i} fill={s.color} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-rose-600"><ShieldAlert className="w-5 h-5" /> Low Mileage Alerts</CardTitle></CardHeader>
          <CardContent>
            {data.alerts.lowMileage.length === 0 ? <p className="text-sm text-slate-500">All vehicles operating within expected mileage.</p> : (
              <div className="space-y-2">
                {data.alerts.lowMileage.map(v => (
                  <div key={v.id} className="flex items-center justify-between p-3 bg-rose-50 border border-rose-200 rounded-lg">
                    <div><div className="font-semibold">{v.vehicleNumber}</div><div className="text-xs text-slate-600">Expected: {v.expectedMileage} km/L · Threshold: {v.threshold} km/L</div></div>
                    <div className="text-right"><div className="text-lg font-bold text-rose-600">{v.actualMileage.toFixed(1)} km/L</div><div className="text-xs text-slate-500">Actual (30d)</div></div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-amber-600"><AlertTriangle className="w-5 h-5" /> Compliance Alerts</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <AlertGroup title="Insurance Expiring" items={data.alerts.insuranceExpiry} />
            <AlertGroup title="PUC Expiring" items={data.alerts.pucExpiry} />
            <AlertGroup title="Service Due" items={data.alerts.serviceDue} />
            <AlertGroup title="Licence Expiring" items={data.alerts.licenceExpiry} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
function AlertGroup({ title, items }) {
  if (!items || items.length === 0) return null
  return (
    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
      <div className="font-semibold text-sm mb-1 text-amber-800">{title} ({items.length})</div>
      <div className="text-xs text-slate-700 space-y-0.5">
        {items.slice(0, 3).map((it, i) => (<div key={i} className="flex justify-between"><span>{it.vehicleNumber || it.name}</span><span className="text-slate-500">{fmtDate(it.date)}</span></div>))}
        {items.length > 3 && <div className="text-slate-500 italic">+{items.length - 3} more</div>}
      </div>
    </div>
  )
}

function Vehicles() {
  const [items, setItems] = useState([])
  const [drivers, setDrivers] = useState([])
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const load = () => Promise.all([api('vehicles'), api('drivers')]).then(([v, d]) => { setItems(v); setDrivers(d) })
  useEffect(() => { load() }, [])
  const filtered = items.filter(v => !search || v.vehicleNumber.toLowerCase().includes(search.toLowerCase()) || (v.make || '').toLowerCase().includes(search.toLowerCase()))
  const driverName = (id) => drivers.find(d => d.id === id)?.name || '-'
  const submit = async (data) => {
    try {
      if (editing) { await api(`vehicles/${editing.id}`, { method: 'PUT', body: data }); toast.success('Updated') }
      else { await api('vehicles', { method: 'POST', body: data }); toast.success('Added') }
      setOpen(false); setEditing(null); load()
    } catch (e) { toast.error(e.message) }
  }
  const remove = async (id) => { if (confirm('Delete?')) { await api(`vehicles/${id}`, { method: 'DELETE' }); toast.success('Deleted'); load() } }
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-3xl font-bold text-slate-900">Vehicle Master</h1><p className="text-slate-500">Manage fleet vehicles</p></div>
        <Button onClick={() => { setEditing(null); setOpen(true) }} className="bg-slate-900 hover:bg-slate-800">+ Add Vehicle</Button>
      </div>
      <Card><CardContent className="p-4">
        <div className="mb-4 relative max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <Input placeholder="Search vehicle..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="overflow-x-auto"><Table>
          <TableHeader><TableRow>
            <TableHead>Vehicle No.</TableHead><TableHead>Type</TableHead><TableHead>Make/Model</TableHead>
            <TableHead>Fuel</TableHead><TableHead>Driver</TableHead><TableHead>Odometer</TableHead>
            <TableHead>Exp. Mileage</TableHead><TableHead>Status</TableHead><TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {filtered.map(v => (
              <TableRow key={v.id}>
                <TableCell className="font-semibold">{v.vehicleNumber}</TableCell>
                <TableCell>{v.type}</TableCell>
                <TableCell>{v.make} {v.model}</TableCell>
                <TableCell>{v.fuelType}</TableCell>
                <TableCell>{driverName(v.assignedDriverId)}</TableCell>
                <TableCell>{v.currentOdometer?.toLocaleString()} km</TableCell>
                <TableCell>{v.expectedMileage} km/L</TableCell>
                <TableCell><Badge variant={v.status === 'Available' ? 'default' : v.status === 'Outside' ? 'secondary' : 'destructive'}>{v.status}</Badge></TableCell>
                <TableCell className="text-right space-x-2">
                  <Button size="sm" variant="outline" onClick={() => { setEditing(v); setOpen(true) }}>Edit</Button>
                  <Button size="sm" variant="destructive" onClick={() => remove(v.id)}>Delete</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table></div>
      </CardContent></Card>
      <VehicleDialog open={open} onOpenChange={setOpen} onSubmit={submit} initial={editing} drivers={drivers} />
    </div>
  )
}

function VehicleDialog({ open, onOpenChange, onSubmit, initial, drivers }) {
  const [f, setF] = useState({})
  useEffect(() => {
    setF(initial || { vehicleNumber: '', type: 'Car', make: '', model: '', fuelType: 'Petrol', seatingCapacity: 5, expectedMileage: 15, lowMileageThreshold: 12, currentOdometer: 0, status: 'Available', insuranceExpiry: '', pucExpiry: '', serviceDueDate: '', serviceDueKm: 0, assignedLocation: 'Head Office', remarks: '', assignedDriverId: '' })
  }, [initial, open])
  const set = (k, v) => setF(x => ({ ...x, [k]: v }))
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{initial ? 'Edit Vehicle' : 'Add Vehicle'}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Vehicle Number</Label><Input value={f.vehicleNumber || ''} onChange={e => set('vehicleNumber', e.target.value)} /></div>
          <div><Label>Type</Label>
            <Select value={f.type} onValueChange={v => set('type', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{['Car', 'SUV', 'Sedan', 'Van', 'Bus', 'Pickup', 'Truck', 'Two Wheeler', 'Other'].map(x => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Make</Label><Input value={f.make || ''} onChange={e => set('make', e.target.value)} /></div>
          <div><Label>Model</Label><Input value={f.model || ''} onChange={e => set('model', e.target.value)} /></div>
          <div><Label>Fuel Type</Label>
            <Select value={f.fuelType} onValueChange={v => set('fuelType', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{['Petrol', 'Diesel', 'CNG', 'Electric', 'Hybrid'].map(x => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Seating Capacity</Label><Input type="number" value={f.seatingCapacity || ''} onChange={e => set('seatingCapacity', +e.target.value)} /></div>
          <div><Label>Assigned Driver</Label>
            <Select value={f.assignedDriverId || 'none'} onValueChange={v => set('assignedDriverId', v === 'none' ? null : v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— None —</SelectItem>
                {drivers.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Status</Label>
            <Select value={f.status} onValueChange={v => set('status', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{['Available', 'Outside', 'Maintenance', 'Inactive'].map(x => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Expected Mileage (km/L)</Label><Input type="number" value={f.expectedMileage || ''} onChange={e => set('expectedMileage', +e.target.value)} /></div>
          <div><Label>Low Mileage Threshold</Label><Input type="number" value={f.lowMileageThreshold || ''} onChange={e => set('lowMileageThreshold', +e.target.value)} /></div>
          <div><Label>Current Odometer</Label><Input type="number" value={f.currentOdometer || ''} onChange={e => set('currentOdometer', +e.target.value)} /></div>
          <div><Label>Service Due KM</Label><Input type="number" value={f.serviceDueKm || ''} onChange={e => set('serviceDueKm', +e.target.value)} /></div>
          <div><Label>Insurance Expiry</Label><Input type="date" value={f.insuranceExpiry?.slice(0, 10) || ''} onChange={e => set('insuranceExpiry', e.target.value)} /></div>
          <div><Label>PUC Expiry</Label><Input type="date" value={f.pucExpiry?.slice(0, 10) || ''} onChange={e => set('pucExpiry', e.target.value)} /></div>
          <div><Label>Service Due Date</Label><Input type="date" value={f.serviceDueDate?.slice(0, 10) || ''} onChange={e => set('serviceDueDate', e.target.value)} /></div>
          <div><Label>Assigned Location</Label><Input value={f.assignedLocation || ''} onChange={e => set('assignedLocation', e.target.value)} /></div>
          <div className="col-span-2"><Label>Remarks</Label><Textarea value={f.remarks || ''} onChange={e => set('remarks', e.target.value)} /></div>
        </div>
        <DialogFooter><Button onClick={() => onSubmit(f)}>Save</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Drivers() {
  const [items, setItems] = useState([])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const load = () => api('drivers').then(setItems)
  useEffect(() => { load() }, [])
  const submit = async (data) => {
    try {
      if (editing) { await api(`drivers/${editing.id}`, { method: 'PUT', body: data }); toast.success('Updated') }
      else { await api('drivers', { method: 'POST', body: data }); toast.success('Added') }
      setOpen(false); setEditing(null); load()
    } catch (e) { toast.error(e.message) }
  }
  const remove = async (id) => { if (confirm('Delete?')) { await api(`drivers/${id}`, { method: 'DELETE' }); load() } }
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-3xl font-bold text-slate-900">Driver Master</h1><p className="text-slate-500">Manage drivers</p></div>
        <Button onClick={() => { setEditing(null); setOpen(true) }} className="bg-slate-900 hover:bg-slate-800">+ Add Driver</Button>
      </div>
      <Card><CardContent className="p-4"><div className="overflow-x-auto"><Table>
        <TableHeader><TableRow>
          <TableHead>Name</TableHead><TableHead>Emp ID</TableHead><TableHead>Mobile</TableHead>
          <TableHead>Licence</TableHead><TableHead>Licence Expiry</TableHead><TableHead>Status</TableHead><TableHead></TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {items.map(d => {
            const expiring = new Date(d.licenceExpiry) < new Date(Date.now() + 30 * 24 * 3600 * 1000)
            return (
              <TableRow key={d.id}>
                <TableCell className="font-semibold">{d.name}</TableCell>
                <TableCell>{d.empId}</TableCell><TableCell>{d.mobile}</TableCell><TableCell>{d.licence}</TableCell>
                <TableCell className={expiring ? 'text-rose-600 font-semibold' : ''}>{fmtDate(d.licenceExpiry)}</TableCell>
                <TableCell><Badge>{d.status}</Badge></TableCell>
                <TableCell className="text-right space-x-2">
                  <Button size="sm" variant="outline" onClick={() => { setEditing(d); setOpen(true) }}>Edit</Button>
                  <Button size="sm" variant="destructive" onClick={() => remove(d.id)}>Delete</Button>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table></div></CardContent></Card>
      <DriverDialog open={open} onOpenChange={setOpen} onSubmit={submit} initial={editing} />
    </div>
  )
}

function DriverDialog({ open, onOpenChange, onSubmit, initial }) {
  const [f, setF] = useState({})
  useEffect(() => { setF(initial || { name: '', empId: '', mobile: '', licence: '', licenceExpiry: '', status: 'Active', remarks: '' }) }, [initial, open])
  const set = (k, v) => setF(x => ({ ...x, [k]: v }))
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{initial ? 'Edit Driver' : 'Add Driver'}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><Label>Name</Label><Input value={f.name || ''} onChange={e => set('name', e.target.value)} /></div>
          <div><Label>Employee ID</Label><Input value={f.empId || ''} onChange={e => set('empId', e.target.value)} /></div>
          <div><Label>Mobile</Label><Input value={f.mobile || ''} onChange={e => set('mobile', e.target.value)} /></div>
          <div><Label>Licence Number</Label><Input value={f.licence || ''} onChange={e => set('licence', e.target.value)} /></div>
          <div><Label>Licence Expiry</Label><Input type="date" value={f.licenceExpiry?.slice(0, 10) || ''} onChange={e => set('licenceExpiry', e.target.value)} /></div>
          <div><Label>Status</Label>
            <Select value={f.status} onValueChange={v => set('status', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{['Active', 'Inactive', 'On Leave'].map(x => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="col-span-2"><Label>Remarks</Label><Textarea value={f.remarks || ''} onChange={e => set('remarks', e.target.value)} /></div>
        </div>
        <DialogFooter><Button onClick={() => onSubmit(f)}>Save</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Trips() {
  const [items, setItems] = useState([])
  const [search, setSearch] = useState('')
  useEffect(() => { api('trips').then(setItems) }, [])
  const filtered = items.filter(t => !search ||
    t.vehicleNumber?.toLowerCase().includes(search.toLowerCase()) ||
    t.driverName?.toLowerCase().includes(search.toLowerCase()) ||
    t.destination?.toLowerCase().includes(search.toLowerCase()))
  const exportCsv = () => {
    const headers = ['Trip ID', 'Date', 'Vehicle', 'Driver', 'Time Out', 'Time In', 'Odo Out', 'Odo In', 'KM Run', 'Destination', 'Status']
    const rows = filtered.map(t => [t.tripId, fmtDate(t.dateOut), t.vehicleNumber, t.driverName, fmtDT(t.dateOut), fmtDT(t.timeIn), t.odometerOut, t.odometerIn, t.kmRun, t.destination, t.status])
    const csv = [headers, ...rows].map(r => r.map(c => `"${c ?? ''}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `trips-${Date.now()}.csv`; a.click()
  }
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-3xl font-bold text-slate-900">Trip Register</h1><p className="text-slate-500">Vehicle movement history</p></div>
        <Button onClick={exportCsv} variant="outline"><Download className="w-4 h-4 mr-2" /> Export CSV</Button>
      </div>
      <Card><CardContent className="p-4">
        <div className="mb-4 relative max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="overflow-x-auto"><Table>
          <TableHeader><TableRow>
            <TableHead>Trip ID</TableHead><TableHead>Vehicle</TableHead><TableHead>Driver</TableHead>
            <TableHead>Out</TableHead><TableHead>In</TableHead><TableHead>KM</TableHead>
            <TableHead>Destination</TableHead><TableHead>Status</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {filtered.slice(0, 100).map(t => (
              <TableRow key={t.id}>
                <TableCell className="font-mono text-xs">{t.tripId}</TableCell>
                <TableCell className="font-semibold">{t.vehicleNumber}</TableCell>
                <TableCell>{t.driverName}</TableCell>
                <TableCell className="text-xs">{fmtDT(t.dateOut)}</TableCell>
                <TableCell className="text-xs">{fmtDT(t.timeIn)}</TableCell>
                <TableCell className="font-semibold">{t.kmRun || '-'}</TableCell>
                <TableCell className="text-xs">{t.destination}</TableCell>
                <TableCell><Badge variant={t.status === 'Outside' ? 'secondary' : 'default'}>{t.status}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table></div>
      </CardContent></Card>
    </div>
  )
}

function FuelRegister() {
  const [items, setItems] = useState([])
  useEffect(() => { api('fuel').then(setItems) }, [])
  const exportCsv = () => {
    const headers = ['Date', 'Vehicle', 'Odometer', 'Quantity(L)', 'Rate', 'Amount', 'Station', 'Receipt']
    const rows = items.map(t => [fmtDate(t.date), t.vehicleNumber, t.odometer, t.quantity, t.rate, t.amount, t.station, t.receiptNumber])
    const csv = [headers, ...rows].map(r => r.map(c => `"${c ?? ''}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `fuel-${Date.now()}.csv`; a.click()
  }
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-3xl font-bold text-slate-900">Fuel Register</h1><p className="text-slate-500">All fuel filling entries</p></div>
        <Button onClick={exportCsv} variant="outline"><Download className="w-4 h-4 mr-2" /> Export CSV</Button>
      </div>
      <Card><CardContent className="p-4"><div className="overflow-x-auto"><Table>
        <TableHeader><TableRow>
          <TableHead>Date</TableHead><TableHead>Vehicle</TableHead><TableHead>Odometer</TableHead>
          <TableHead>Qty (L)</TableHead><TableHead>Rate</TableHead><TableHead>Amount</TableHead>
          <TableHead>Station</TableHead><TableHead>Receipt</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {items.slice(0, 100).map(t => (
            <TableRow key={t.id}>
              <TableCell className="text-xs">{fmtDate(t.date)}</TableCell>
              <TableCell className="font-semibold">{t.vehicleNumber}</TableCell>
              <TableCell>{t.odometer?.toLocaleString()}</TableCell>
              <TableCell>{t.quantity}</TableCell>
              <TableCell>₹{t.rate}</TableCell>
              <TableCell className="font-semibold">{fmtINR(t.amount)}</TableCell>
              <TableCell className="text-xs">{t.station}</TableCell>
              <TableCell className="text-xs">{t.receiptNumber}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table></div></CardContent></Card>
    </div>
  )
}

function Mileage() {
  const [data, setData] = useState(null)
  useEffect(() => { api('dashboard').then(setData) }, [])
  if (!data) return <div className="p-8">Loading...</div>
  return (
    <div className="p-6 space-y-4">
      <div><h1 className="text-3xl font-bold text-slate-900">Mileage Analytics</h1><p className="text-slate-500">Per-vehicle 30-day mileage</p></div>
      <Card><CardContent className="p-4"><Table>
        <TableHeader><TableRow>
          <TableHead>Vehicle</TableHead><TableHead>KM (30d)</TableHead><TableHead>Litres</TableHead>
          <TableHead>Actual km/L</TableHead><TableHead>Expected</TableHead><TableHead>Variance</TableHead><TableHead>Status</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {data.perVehicle.map(v => {
            const variance = v.actualMileage ? ((v.actualMileage - v.expectedMileage) / v.expectedMileage * 100) : null
            return (
              <TableRow key={v.id}>
                <TableCell className="font-semibold">{v.vehicleNumber}</TableCell>
                <TableCell>{v.km}</TableCell>
                <TableCell>{v.litres.toFixed(1)}</TableCell>
                <TableCell className={v.lowMileage ? 'text-rose-600 font-bold' : 'font-semibold'}>{v.actualMileage ? v.actualMileage.toFixed(2) : 'Insufficient Data'}</TableCell>
                <TableCell>{v.expectedMileage}</TableCell>
                <TableCell className={variance < 0 ? 'text-rose-600' : 'text-emerald-600'}>{variance !== null ? `${variance.toFixed(1)}%` : '-'}</TableCell>
                <TableCell>{v.lowMileage ? <Badge variant="destructive">Low Mileage</Badge> : v.actualMileage ? <Badge className="bg-emerald-500">OK</Badge> : <Badge variant="secondary">N/A</Badge>}</TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table></CardContent></Card>
    </div>
  )
}

function Reports() {
  const [data, setData] = useState(null)
  useEffect(() => { api('dashboard').then(setData) }, [])
  if (!data) return <div className="p-8">Loading...</div>
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-3xl font-bold text-slate-900">Reports</h1>
      <p className="text-slate-500">Quick monthly summaries. Use Trip/Fuel registers for CSV exports.</p>
      <div className="grid md:grid-cols-3 gap-4">
        {[
          { title: 'Monthly KM Run', value: `${data.month.km} km` },
          { title: 'Fuel Consumed', value: `${data.month.fuelLit.toFixed(0)} L` },
          { title: 'Fuel Cost', value: fmtINR(data.month.fuelCost) },
          { title: 'Avg Fleet Mileage', value: `${data.month.avgMileage} km/L` },
          { title: "Today's Trips", value: data.today.trips },
          { title: 'Low Mileage Vehicles', value: data.month.lowMileageCount },
        ].map(c => (
          <Card key={c.title}><CardContent className="p-6"><div className="text-sm text-slate-500">{c.title}</div><div className="text-3xl font-bold mt-2">{c.value}</div></CardContent></Card>
        ))}
      </div>
    </div>
  )
}

function SecurityHome({ user, onLogout }) {
  const [screen, setScreen] = useState('home')
  const buttons = [
    { id: 'out', label: 'Vehicle OUT', icon: ArrowRightCircle, color: 'from-emerald-500 to-emerald-600' },
    { id: 'in', label: 'Vehicle IN', icon: ArrowLeftCircle, color: 'from-blue-500 to-blue-600' },
    { id: 'fuel', label: 'Fuel Entry', icon: Fuel, color: 'from-amber-500 to-amber-600' },
    { id: 'outside', label: 'Currently Outside', icon: Truck, color: 'from-slate-600 to-slate-700' },
  ]
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-700 text-white">
      <header className="p-4 flex items-center justify-between border-b border-slate-700">
        <div className="flex items-center gap-2">
          {screen !== 'home' && <Button variant="ghost" size="sm" onClick={() => setScreen('home')} className="text-white"><ArrowLeft className="w-4 h-4" /></Button>}
          <Building2 className="w-5 h-5 text-amber-400" /><span className="font-bold">CKC Fleet Security</span>
        </div>
        <Button variant="ghost" size="sm" onClick={onLogout} className="text-white"><LogOut className="w-4 h-4" /></Button>
      </header>
      {screen === 'home' && (
        <div className="p-6 max-w-md mx-auto">
          <div className="text-center mb-6"><div className="text-sm text-slate-300">Welcome</div><div className="text-xl font-bold">{user.name}</div></div>
          <div className="grid grid-cols-2 gap-4">
            {buttons.map(b => {
              const Icon = b.icon
              return (
                <button key={b.id} onClick={() => setScreen(b.id)} className={`bg-gradient-to-br ${b.color} rounded-2xl p-6 aspect-square flex flex-col items-center justify-center gap-3 shadow-xl active:scale-95 transition`}>
                  <Icon className="w-12 h-12" /><div className="font-semibold text-center">{b.label}</div>
                </button>
              )
            })}
          </div>
        </div>
      )}
      {screen === 'out' && <VehicleOut onDone={() => setScreen('home')} />}
      {screen === 'in' && <VehicleIn onDone={() => setScreen('home')} />}
      {screen === 'fuel' && <FuelEntry onDone={() => setScreen('home')} />}
      {screen === 'outside' && <CurrentlyOutside />}
    </div>
  )
}

function VehicleOut({ onDone }) {
  const [vehicles, setVehicles] = useState([])
  const [drivers, setDrivers] = useState([])
  const [f, setF] = useState({ vehicleId: '', driverId: '', odometerOut: '', destination: '', purpose: '', passengerCount: 1, remarks: '' })
  useEffect(() => {
    api('vehicles').then(vs => setVehicles(vs.filter(v => v.status === 'Available')))
    api('drivers').then(setDrivers)
  }, [])
  const selectedVehicle = vehicles.find(v => v.id === f.vehicleId)
  useEffect(() => {
    if (selectedVehicle) setF(x => ({ ...x, odometerOut: selectedVehicle.currentOdometer, driverId: selectedVehicle.assignedDriverId || x.driverId }))
  }, [f.vehicleId, selectedVehicle])
  const set = (k, v) => setF(x => ({ ...x, [k]: v }))
  const submit = async () => {
    if (!f.vehicleId || !f.odometerOut || !f.destination) return toast.error('Fill required fields')
    try { await api('trips/out', { method: 'POST', body: f }); toast.success('Vehicle OUT recorded'); onDone() }
    catch (e) { toast.error(e.message) }
  }
  return (
    <div className="p-4 max-w-md mx-auto space-y-3 text-slate-900">
      <div className="bg-white rounded-xl p-4 space-y-3">
        <h2 className="text-lg font-bold text-emerald-600">Vehicle OUT Entry</h2>
        <div><Label>Vehicle *</Label>
          <Select value={f.vehicleId} onValueChange={v => set('vehicleId', v)}>
            <SelectTrigger><SelectValue placeholder="Select vehicle" /></SelectTrigger>
            <SelectContent>{vehicles.map(v => <SelectItem key={v.id} value={v.id}>{v.vehicleNumber} - {v.make} {v.model}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Driver</Label>
          <Select value={f.driverId} onValueChange={v => set('driverId', v)}>
            <SelectTrigger><SelectValue placeholder="Select driver" /></SelectTrigger>
            <SelectContent>{drivers.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Odometer OUT *</Label><Input type="number" value={f.odometerOut} onChange={e => set('odometerOut', e.target.value)} /></div>
        <div><Label>Destination *</Label><Input value={f.destination} onChange={e => set('destination', e.target.value)} /></div>
        <div><Label>Purpose</Label><Input value={f.purpose} onChange={e => set('purpose', e.target.value)} /></div>
        <div><Label>Passenger Count</Label><Input type="number" value={f.passengerCount} onChange={e => set('passengerCount', e.target.value)} /></div>
        <div><Label>Remarks</Label><Textarea value={f.remarks} onChange={e => set('remarks', e.target.value)} /></div>
        <Button onClick={submit} className="w-full bg-emerald-600 hover:bg-emerald-700 h-12 text-lg">Record OUT</Button>
      </div>
    </div>
  )
}

function VehicleIn({ onDone }) {
  const [trips, setTrips] = useState([])
  const [selected, setSelected] = useState(null)
  const [odoIn, setOdoIn] = useState('')
  const [remarks, setRemarks] = useState('')
  useEffect(() => { api('trips/outside').then(setTrips) }, [])
  const submit = async () => {
    if (!selected || !odoIn) return toast.error('Enter odometer')
    if (Number(odoIn) < selected.odometerOut) return toast.error('Odometer IN must be greater than OUT')
    try { const r = await api('trips/in', { method: 'POST', body: { tripId: selected.id, odometerIn: odoIn, remarks } }); toast.success(`Vehicle IN. KM Run: ${r.kmRun}`); onDone() }
    catch (e) { toast.error(e.message) }
  }
  return (
    <div className="p-4 max-w-md mx-auto space-y-3 text-slate-900">
      <div className="bg-white rounded-xl p-4 space-y-3">
        <h2 className="text-lg font-bold text-blue-600">Vehicle IN Entry</h2>
        {!selected ? (
          <>
            <div className="text-sm text-slate-600">Select outside vehicle:</div>
            {trips.length === 0 && <div className="p-4 bg-slate-100 rounded text-center text-slate-500">No vehicles currently outside</div>}
            {trips.map(t => (
              <button key={t.id} onClick={() => setSelected(t)} className="w-full text-left p-3 bg-slate-50 rounded-lg hover:bg-slate-100 border">
                <div className="font-bold">{t.vehicleNumber}</div>
                <div className="text-xs text-slate-600">{t.driverName} · {t.destination}</div>
                <div className="text-xs text-slate-500">Out: {fmtDT(t.dateOut)} · Odo: {t.odometerOut}</div>
              </button>
            ))}
          </>
        ) : (
          <>
            <div className="p-3 bg-slate-50 rounded">
              <div className="font-bold">{selected.vehicleNumber}</div>
              <div className="text-sm">{selected.driverName} · {selected.destination}</div>
              <div className="text-xs text-slate-500">Odometer OUT: {selected.odometerOut}</div>
            </div>
            <div><Label>Odometer IN *</Label><Input type="number" value={odoIn} onChange={e => setOdoIn(e.target.value)} /></div>
            {odoIn && <div className="text-sm bg-blue-50 p-3 rounded"><b>KM Run:</b> {Number(odoIn) - selected.odometerOut} km</div>}
            <div><Label>Remarks</Label><Textarea value={remarks} onChange={e => setRemarks(e.target.value)} /></div>
            <Button onClick={submit} className="w-full bg-blue-600 hover:bg-blue-700 h-12 text-lg">Record IN</Button>
            <Button variant="outline" onClick={() => setSelected(null)} className="w-full">Change Vehicle</Button>
          </>
        )}
      </div>
    </div>
  )
}

function FuelEntry({ onDone }) {
  const [vehicles, setVehicles] = useState([])
  const [f, setF] = useState({ vehicleId: '', odometer: '', quantity: '', rate: '', station: '', receiptNumber: '', remarks: '' })
  useEffect(() => { api('vehicles').then(setVehicles) }, [])
  const selectedVehicle = vehicles.find(v => v.id === f.vehicleId)
  useEffect(() => { if (selectedVehicle) setF(x => ({ ...x, odometer: selectedVehicle.currentOdometer })) }, [f.vehicleId, selectedVehicle])
  const set = (k, v) => setF(x => ({ ...x, [k]: v }))
  const amount = (Number(f.quantity) || 0) * (Number(f.rate) || 0)
  const submit = async () => {
    if (!f.vehicleId || !f.quantity || !f.rate) return toast.error('Fill required fields')
    try { await api('fuel', { method: 'POST', body: f }); toast.success(`Fuel entry saved. Amount: ${fmtINR(amount)}`); onDone() }
    catch (e) { toast.error(e.message) }
  }
  return (
    <div className="p-4 max-w-md mx-auto space-y-3 text-slate-900">
      <div className="bg-white rounded-xl p-4 space-y-3">
        <h2 className="text-lg font-bold text-amber-600">Fuel Entry</h2>
        <div><Label>Vehicle *</Label>
          <Select value={f.vehicleId} onValueChange={v => set('vehicleId', v)}>
            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>{vehicles.map(v => <SelectItem key={v.id} value={v.id}>{v.vehicleNumber} ({v.fuelType})</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Odometer</Label><Input type="number" value={f.odometer} onChange={e => set('odometer', e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-2">
          <div><Label>Quantity (L) *</Label><Input type="number" step="0.01" value={f.quantity} onChange={e => set('quantity', e.target.value)} /></div>
          <div><Label>Rate (₹/L) *</Label><Input type="number" step="0.01" value={f.rate} onChange={e => set('rate', e.target.value)} /></div>
        </div>
        <div className="p-3 bg-amber-50 rounded text-center"><div className="text-xs">Total Amount</div><div className="text-2xl font-bold">{fmtINR(amount)}</div></div>
        <div><Label>Fuel Station</Label><Input value={f.station} onChange={e => set('station', e.target.value)} /></div>
        <div><Label>Receipt Number</Label><Input value={f.receiptNumber} onChange={e => set('receiptNumber', e.target.value)} /></div>
        <div><Label>Remarks</Label><Textarea value={f.remarks} onChange={e => set('remarks', e.target.value)} /></div>
        <Button onClick={submit} className="w-full bg-amber-600 hover:bg-amber-700 h-12 text-lg">Save Fuel Entry</Button>
      </div>
    </div>
  )
}

function CurrentlyOutside() {
  const [trips, setTrips] = useState([])
  useEffect(() => { api('trips/outside').then(setTrips) }, [])
  return (
    <div className="p-4 max-w-md mx-auto space-y-3 text-slate-900">
      <div className="bg-white rounded-xl p-4">
        <h2 className="text-lg font-bold mb-3">Currently Outside ({trips.length})</h2>
        {trips.length === 0 && <div className="p-6 text-center text-slate-500">No vehicles currently outside</div>}
        <div className="space-y-2">
          {trips.map(t => {
            const hrs = (Date.now() - new Date(t.dateOut).getTime()) / 3600000
            const overdue = hrs > 8
            return (
              <div key={t.id} className={`p-3 rounded-lg border ${overdue ? 'bg-rose-50 border-rose-300' : 'bg-slate-50'}`}>
                <div className="flex justify-between items-start"><div className="font-bold">{t.vehicleNumber}</div>{overdue && <Badge variant="destructive">OVERDUE</Badge>}</div>
                <div className="text-sm">{t.driverName}</div>
                <div className="text-xs text-slate-600">{t.destination}</div>
                <div className="text-xs text-slate-500">Out {hrs.toFixed(1)}h ago · {fmtDT(t.dateOut)}</div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function App() {
  const [user, setUser] = useState(null)
  const [active, setActive] = useState('dashboard')
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    const u = localStorage.getItem('ckc_user')
    if (u) setUser(JSON.parse(u))
    setLoaded(true)
  }, [])
  const logout = () => { localStorage.removeItem('ckc_user'); setUser(null) }
  if (!loaded) return null
  if (!user) return <Login onLogin={setUser} />
  if (user.role === 'security') return <SecurityHome user={user} onLogout={logout} />
  return (
    <AdminShell user={user} onLogout={logout} active={active} setActive={setActive}>
      {active === 'dashboard' && <Dashboard />}
      {active === 'vehicles' && <Vehicles />}
      {active === 'drivers' && <Drivers />}
      {active === 'trips' && <Trips />}
      {active === 'fuel' && <FuelRegister />}
      {active === 'mileage' && <Mileage />}
      {active === 'reports' && <Reports />}
    </AdminShell>
  )
}

export default App
