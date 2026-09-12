        doc.text('C. Krishniah Chetty (TM) Group of Jewellers  ·  FleetPulse  ·  Confidential', 30, pageH - 20)'use client'
import { useState, useEffect, useRef } from 'react'
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
  Download, Gauge, ShieldAlert, Building2, ArrowLeft, Menu, X,
  Camera, FileText, Image as ImageIcon, FileSpreadsheet, WifiOff, Wifi,
  Wrench, Plus, Trash2, Eye, EyeOff, UserCog, KeyRound, MapPin, QrCode
} from 'lucide-react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend
} from 'recharts'

// Get the currently logged-in user from localStorage
const getUser = () => { try { return JSON.parse(localStorage.getItem('ckc_user') || '{}') } catch { return {} } }

const api = async (path, opts = {}) => {
  const user = getUser()
  const res = await fetch(`/api/${path}`, {
    headers: {
      'Content-Type': 'application/json',
      'x-user-role': user.role || '',
      'x-store-id': user.storeId || '',
    },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Error')
  return data
}

// Offline write queue — queues POSTs when offline & flushes when back online
const OFFLINE_KEY = 'ckc_offline_queue'
const getQueue = () => { try { return JSON.parse(localStorage.getItem(OFFLINE_KEY) || '[]') } catch { return [] } }
const setQueue = (q) => localStorage.setItem(OFFLINE_KEY, JSON.stringify(q))

const apiOffline = async (path, body) => {
  if (!navigator.onLine) {
    const q = getQueue()
    q.push({ path, body, ts: Date.now() })
    setQueue(q)
    toast.info('Saved offline — will sync when online')
    return { queued: true }
  }
  return api(path, { method: 'POST', body })
}

const flushQueue = async () => {
  const q = getQueue()
  if (q.length === 0) return
  const remaining = []
  for (const item of q) {
    try { await api(item.path, { method: 'POST', body: item.body }) }
    catch { remaining.push(item) }
  }
  setQueue(remaining)
  if (remaining.length === 0 && q.length > 0) toast.success(`Synced ${q.length} offline entries`)
  return q.length - remaining.length
}
const PAIRING_PREFIX = 'CKCFLEET'
const pairingPayload = (driverId) => `${PAIRING_PREFIX}:${driverId}`
const qrImageUrl = (text, size = 240) =>
  `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}`

// Excel export helper
const exportXlsx = async (filename, sheets) => {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()
  for (const s of sheets) {
    const ws = XLSX.utils.aoa_to_sheet([s.headers, ...s.rows])
    // Simple column width auto-fit
    const cols = s.headers.map((h, i) => ({ wch: Math.max(h.length, ...s.rows.map(r => String(r[i] ?? '').length)) + 2 }))
    ws['!cols'] = cols
    XLSX.utils.book_append_sheet(wb, ws, s.name)
  }
  XLSX.writeFile(wb, filename)
}

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'
const fmtDT = (d) => d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-'
const fmtINR = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`

function Login({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setTick(x => (x + 1) % 3), 3500)
    return () => clearInterval(t)
  }, [])
  const submit = async (e) => {
    e.preventDefault(); setLoading(true)
    try {
      const data = await api('auth/login', { method: 'POST', body: { username, password } })
      localStorage.setItem('ckc_user', JSON.stringify(data.user))
      onLogin(data.user); toast.success(`Welcome, ${data.user.name}`)
    } catch (e) { toast.error(e.message) } finally { setLoading(false) }
  }
  const rotating = [
    { icon: Truck, label: 'Vehicles Tracked', value: '250+' },
    { icon: Fuel, label: 'Fuel Efficiency', value: '18.4 km/L' },
    { icon: Gauge, label: 'Trips This Month', value: '1,240' },
  ]
  const Rot = rotating[tick].icon
  return (
    <div className="min-h-screen flex flex-col lg:flex-row relative overflow-hidden" style={{background: 'radial-gradient(1200px 800px at 15% 20%, #5c0a0a 0%, #3a0606 45%, #1a0303 100%)'}}>
      {/* Ambient gradients */}
      <div className="absolute -top-40 -left-40 w-[520px] h-[520px] rounded-full bg-red-700/20 blur-3xl pointer-events-none animate-pulse" style={{animationDuration: '5s'}} />
      <div className="absolute -bottom-60 -right-40 w-[700px] h-[700px] rounded-full bg-amber-600/10 blur-3xl pointer-events-none animate-pulse" style={{animationDuration: '7s'}} />
      <div className="absolute top-1/3 left-1/2 w-[320px] h-[320px] rounded-full bg-red-950/50 blur-3xl pointer-events-none" />

      {/* Fine noise/grid texture */}
      <div className="absolute inset-0 opacity-[0.035] pointer-events-none" style={{
        backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
        backgroundSize: '52px 52px'
      }} />

      {/* Vignette */}
      <div className="absolute inset-0 pointer-events-none" style={{boxShadow: 'inset 0 0 260px 60px rgba(0,0,0,0.55)'}} />

      {/* Moving truck strip */}
      <div className="hidden lg:block absolute bottom-24 left-0 right-0 pointer-events-none overflow-hidden opacity-30">
        <div className="flex gap-40 animate-marquee whitespace-nowrap">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 text-amber-200/40">
              <Truck className="w-6 h-6" />
              <div className="h-px w-40 bg-gradient-to-r from-amber-300/40 to-transparent" />
            </div>
          ))}
        </div>
      </div>

      {/* LEFT: Brand & Value Prop */}
      <div className="relative flex-1 flex flex-col justify-between p-8 lg:p-16 text-white z-10">
        {/* Top: Elegant wordmark */}
        <div className="space-y-8">
          <div className="flex items-center gap-4">
            <img src="/ckc-logo.png" alt="CKC" className="w-20 h-20 object-contain drop-shadow-2xl" />
            <div className="border-l border-amber-300/20 pl-4">
              <div className="text-[10px] tracking-[0.3em] text-amber-200/90 font-semibold">EST. 1869</div>
              <div className="text-[10px] tracking-[0.2em] text-amber-100/50 mt-1">HERITAGE JEWELLERS</div>
            </div>
          </div>

          <div className="space-y-3">
                       <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-400/25 text-amber-200 text-[10px] tracking-[0.3em] font-semibold uppercase backdrop-blur-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399] animate-pulse" /> FleetPulse · Live
            </div>
            <h1 className="text-3xl lg:text-4xl xl:text-5xl font-semibold leading-tight tracking-wide whitespace-nowrap text-white" style={{fontFamily: '"Times New Roman", Georgia, serif'}}>
              C. Krishniah Chetty
              <span className="text-base lg:text-lg text-white/70 align-super ml-1">™</span>
            </h1>
            <div className="flex items-center gap-3">
              <div className="h-px w-8 bg-amber-400/60" />
              <div className="text-[11px] lg:text-xs tracking-[0.4em] text-amber-100/70 font-medium">GROUP OF JEWELLERS</div>
            </div>
          </div>
        </div>

        {/* Middle: Fleet-focused tagline */}
        <div className="hidden lg:block space-y-8 my-10">
          <div>
            <div className="w-16 h-[2px] bg-gradient-to-r from-amber-400 to-transparent mb-5" />
            <h2 className="text-3xl xl:text-5xl font-light leading-tight text-white/95" style={{fontFamily: 'Georgia, serif'}}>
              Every kilometre.<br />
              Every litre. <span className="text-amber-300 italic">Accounted for.</span>
            </h2>
            <p className="text-base xl:text-lg text-white/70 leading-relaxed max-w-md font-light mt-5">
              An enterprise-grade fleet operations platform — real-time vehicle movement, fuel analytics, and mileage intelligence for the CKC fleet.
            </p>
          </div>

          {/* Live rotating stat card */}
          <div className="max-w-sm">
            <div className="relative overflow-hidden rounded-xl bg-white/5 backdrop-blur-sm border border-amber-400/20 p-4">
              <div className="absolute top-0 left-0 h-full w-1 bg-gradient-to-b from-amber-300 to-amber-600" />
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-300">
                  <Rot className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="text-[10px] tracking-[0.25em] text-amber-200/70 font-semibold uppercase">{rotating[tick].label}</div>
                  <div className="text-2xl font-bold text-white transition-all" key={tick}>{rotating[tick].value}</div>
                </div>
                <div className="flex gap-1">
                  {rotating.map((_, i) => (
                    <div key={i} className={`h-1 rounded-full transition-all ${i === tick ? 'w-4 bg-amber-400' : 'w-1.5 bg-white/20'}`} />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Feature chips */}
          <div className="grid grid-cols-2 gap-3 max-w-lg">
            {[
              { icon: Car, label: 'Vehicle Master' },
              { icon: Gauge, label: 'Live Mileage' },
              { icon: Fuel, label: 'Fuel Analytics' },
              { icon: ShieldAlert, label: 'Compliance Alerts' },
            ].map((f, i) => {
              const I = f.icon
              return (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition">
                  <div className="w-8 h-8 rounded-md bg-amber-500/20 flex items-center justify-center text-amber-300"><I className="w-4 h-4" /></div>
                  <span className="text-sm text-white/80 font-medium">{f.label}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Bottom: Footer */}
        <div className="hidden lg:flex items-center justify-between text-[10px] text-amber-100/40 font-medium tracking-[0.2em]">
          <div>© 2026 C KRISHNIAH CHETTY JEWELLERS PVT. LTD.</div>
          <div className="flex items-center gap-2">
            <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
            FLEETPULSE · v1.0
          </div>
        </div>
      </div>

      {/* RIGHT: Login Card */}
      <div className="relative w-full lg:w-[500px] flex items-center justify-center p-6 lg:p-12 z-10">
        <div className="w-full max-w-sm">
          <div className="relative">
            {/* Halo */}
            <div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-amber-400/30 via-red-500/10 to-amber-400/30 blur-2xl animate-pulse" style={{animationDuration: '4s'}} />

            <div className="relative bg-white/98 backdrop-blur-xl rounded-2xl shadow-2xl overflow-hidden border border-amber-200/50">
              {/* Ribbon */}
              <div className="bg-gradient-to-r from-[#5c0a0a] via-[#7a0d0d] to-[#5c0a0a] px-6 py-3 flex items-center gap-2">
                <Truck className="w-3.5 h-3.5 text-amber-300" />
                               <span className="text-[10px] tracking-[0.3em] text-amber-100 font-bold">FLEETPULSE</span>
                <div className="ml-auto flex items-center gap-1.5 text-[9px] tracking-widest text-emerald-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> LIVE
                </div>
              </div>

              <div className="p-8 space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-[#2d0505]" style={{fontFamily: 'Georgia, serif'}}>Welcome Back</h2>
                  <p className="text-sm text-slate-500 mt-1">Sign in to access the fleet control centre.</p>
                </div>

                <form onSubmit={submit} className="space-y-5">
                  <div className="space-y-1.5">
                    <Label className="text-xs tracking-[0.15em] text-slate-600 font-semibold uppercase">Username</Label>
                    <div className="relative">
                      <Input
                        value={username}
                        onChange={e => setUsername(e.target.value)}
                        required
                        placeholder=""
                        className="h-11 pl-10 border-slate-200 focus:border-red-800 focus:ring-red-800/20 rounded-lg"
                      />
                      <Users className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                    </div>
                  </div>
                                   <div className="space-y-1.5">
                    <Label className="text-xs tracking-[0.15em] text-slate-600 font-semibold uppercase">Password</Label>
                    <div className="relative">
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        required
                        placeholder="Enter your password"
                        className="h-11 pl-10 pr-10 border-slate-200 focus:border-red-800 focus:ring-red-800/20 rounded-lg"
                      />
                      <ShieldAlert className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                      <button
                        type="button"
                        onClick={() => setShowPassword(x => !x)}
                        className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full h-12 bg-gradient-to-r from-[#7a0d0d] via-[#a01414] to-[#7a0d0d] hover:brightness-110 text-white font-semibold tracking-[0.15em] shadow-lg shadow-red-900/40 transition-all group"
                  >
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                        SIGNING IN...
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-2">
                        LOG IN
                        <ArrowRightCircle className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                      </span>
                    )}
                  </Button>
                </form>
              </div>
            </div>
          </div>

          <div className="lg:hidden text-center mt-6 text-[10px] tracking-[0.2em] text-amber-100/50">
            © 2026 CKC JEWELLERS · FLEET OPS
          </div>
        </div>
      </div>
    </div>
  )
}

function AdminShell({ user, onLogout, children, active, setActive }) {
  const [drawerOpen, setDrawerOpen] = useState(false)
    const fullNav = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'vehicles', label: 'Vehicles', icon: Car },
  { id: 'drivers', label: 'Drivers', icon: Users },
  { id: 'trips', label: 'Trip Register', icon: ClipboardList },
  { id: 'fuel', label: 'Fuel Register', icon: Fuel },
  { id: 'maintenance', label: 'Maintenance', icon: Wrench },
  { id: 'mileage', label: 'Mileage', icon: Gauge },
  { id: 'reports', label: 'Reports', icon: Download },
  { id: 'tracking', label: 'Track Vehicle', icon: MapPin },
  { id: 'users', label: 'User Management', icon: UserCog },
]
  const nav = user.role === 'store_admin'
  ? fullNav.filter(n => ['dashboard', 'vehicles', 'trips', 'maintenance', 'tracking'].includes(n.id))
  : fullNav
  const pick = (id) => { setActive(id); setDrawerOpen(false) }
  const SidebarContent = () => (
    <>
      <div className="p-5 border-b border-slate-800 flex items-center gap-3">
        <img src="/ckc-logo.png" alt="CKC" className="w-11 h-11 object-contain" />
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm leading-tight truncate text-white" style={{fontFamily: '"Times New Roman", Georgia, serif'}}>C. Krishniah Chetty</div>
                   <div className="text-[10px] text-amber-200/60 tracking-[0.2em] mt-0.5">
            FLEETPULSE · {user.role === 'store_admin' ? (user.name || 'STORE') : 'ADMIN'}
          </div>
        </div>
        <button onClick={() => setDrawerOpen(false)} className="md:hidden text-slate-300 hover:text-white p-1"><X className="w-5 h-5" /></button>
      </div>
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {nav.map(n => {
          const Icon = n.icon
          return (
            <button key={n.id} onClick={() => pick(n.id)}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm transition ${active === n.id ? 'bg-amber-500 text-white font-semibold' : 'hover:bg-slate-800 text-slate-300'}`}>
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
    </>
  )
  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Desktop sidebar */}
      <aside className="w-64 bg-slate-900 text-slate-100 flex-shrink-0 hidden md:flex flex-col">
        <SidebarContent />
      </aside>
      {/* Mobile drawer */}
      {drawerOpen && (
        <>
          <div onClick={() => setDrawerOpen(false)} className="fixed inset-0 bg-black/60 z-40 md:hidden" />
          <aside className="fixed left-0 top-0 bottom-0 w-72 bg-slate-900 text-slate-100 z-50 flex flex-col md:hidden animate-in slide-in-from-left duration-200">
            <SidebarContent />
          </aside>
        </>
      )}
      <main className="flex-1 overflow-auto min-w-0">
        <header className="md:hidden bg-gradient-to-r from-[#5c0a0a] via-[#7a0d0d] to-[#5c0a0a] text-white p-3 flex items-center justify-between sticky top-0 z-30 shadow-lg">
          <button onClick={() => setDrawerOpen(true)} className="p-1"><Menu className="w-6 h-6" /></button>
          <div className="flex items-center gap-2">
            <img src="/ckc-logo.png" alt="CKC" className="w-8 h-8 object-contain" />
            <span className="font-semibold text-sm text-white" style={{fontFamily: '"Times New Roman", Georgia, serif'}}>C. Krishniah Chetty</span>
          </div>
          <Button variant="ghost" size="sm" onClick={onLogout} className="text-white p-2 hover:bg-white/10"><LogOut className="w-4 h-4" /></Button>
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
    { label: 'Total Vehicles', value: data.fleet.total, icon: Car, color: 'bg-gradient-to-br from-[#7a0d0d] to-[#a01414]' },
    { label: 'Available', value: data.fleet.available, icon: Truck, color: 'bg-gradient-to-br from-emerald-600 to-emerald-700' },
    { label: 'Outside', value: data.fleet.outside, icon: ArrowRightCircle, color: 'bg-gradient-to-br from-amber-500 to-amber-600' },
    { label: 'Maintenance', value: data.fleet.maintenance, icon: AlertTriangle, color: 'bg-gradient-to-br from-[#4a0808] to-[#7a0d0d]' },
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
    { name: 'Outside', value: data.fleet.outside, color: '#d97706' },
    { name: 'Maintenance', value: data.fleet.maintenance, color: '#7a0d0d' },
    { name: 'Inactive', value: data.fleet.inactive, color: '#94a3b8' },
  ].filter(s => s.value > 0)
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 relative inline-block">Fleet Dashboard
          <span className="absolute -bottom-1 left-0 w-16 h-1 bg-gradient-to-r from-[#7a0d0d] to-amber-500 rounded-full" />
        </h1>
        <p className="text-slate-500 mt-2">Real-time overview of fleet operations</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map(k => {
          const Icon = k.icon
          return (
            <Card key={k.label} className="border-t-4 border-t-[#7a0d0d] hover:shadow-lg transition-shadow"><CardContent className="p-5 flex items-center gap-4">
              <div className={`${k.color} w-12 h-12 rounded-lg flex items-center justify-center text-white shadow-md`}><Icon className="w-6 h-6" /></div>
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
                <Bar yAxisId="l" dataKey="trips" fill="#7a0d0d" name="Trips" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="r" dataKey="fuelCost" fill="#d97706" name="Fuel ₹" radius={[4, 4, 0, 0]} />
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
  const user = getUser()
  const canEdit = user.role !== 'store_admin'
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
        <div><h1 className="text-3xl font-bold text-slate-900 relative inline-block">Vehicle Master<span className="absolute -bottom-1 left-0 w-16 h-1 bg-gradient-to-r from-[#7a0d0d] to-amber-500 rounded-full" /></h1><p className="text-slate-500 mt-2">Manage fleet vehicles</p></div>
        {canEdit && (
          <Button onClick={() => { setEditing(null); setOpen(true) }} className="bg-gradient-to-r from-[#7a0d0d] to-[#a01414] hover:brightness-110 text-white shadow-md">+ Add Vehicle</Button>
        )}
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
                    <TableCell><Badge variant={v.status === 'Available' ? 'default' : v.status === 'Outside' ? 'secondary' : 'destructive'} className={v.status === 'Available' ? 'bg-[#7a0d0d] hover:bg-[#5c0a0a]' : ''}>{v.status}</Badge></TableCell>
                <TableCell className="text-right space-x-2">
                  {canEdit && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => { setEditing(v); setOpen(true) }}>Edit</Button>
                      <Button size="sm" variant="destructive" onClick={() => remove(v.id)}>Delete</Button>
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table></div>
      </CardContent></Card>
      {canEdit && (
        <VehicleDialog open={open} onOpenChange={setOpen} onSubmit={submit} initial={editing} drivers={drivers} />
      )}
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
        <DialogFooter><Button onClick={() => onSubmit(f)} className="bg-gradient-to-r from-[#7a0d0d] to-[#a01414] hover:brightness-110 text-white">Save</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Drivers() {
  const user = getUser()
  const canEdit = user.role !== 'store_admin'
  const [items, setItems] = useState([])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [pairingDriver, setPairingDriver] = useState(null)
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
        <div><h1 className="text-3xl font-bold text-slate-900 relative inline-block">Driver Master<span className="absolute -bottom-1 left-0 w-16 h-1 bg-gradient-to-r from-[#7a0d0d] to-amber-500 rounded-full" /></h1><p className="text-slate-500 mt-2">Manage drivers</p></div>
        {canEdit && (
          <Button onClick={() => { setEditing(null); setOpen(true) }} className="bg-gradient-to-r from-[#7a0d0d] to-[#a01414] hover:brightness-110 text-white shadow-md">+ Add Driver</Button>
        )}
      </div>
      <Card><CardContent className="p-4"><div className="overflow-x-auto"><Table>
        <TableHeader><TableRow>
  <TableHead>Name</TableHead><TableHead>Emp ID</TableHead><TableHead>Mobile</TableHead>
  <TableHead>Licence</TableHead><TableHead>Licence Expiry</TableHead><TableHead>Assigned Store</TableHead><TableHead>Status</TableHead><TableHead>Pairing</TableHead><TableHead></TableHead>
</TableRow></TableHeader>
       <TableBody>
  {items.map(d => {
    const expiring = new Date(d.licenceExpiry) < new Date(Date.now() + 30 * 24 * 3600 * 1000)
    return (
      <TableRow key={d.id}>
        <TableCell className="font-semibold">{d.name}</TableCell>
        <TableCell>{d.empId}</TableCell><TableCell>{d.mobile}</TableCell><TableCell>{d.licence}</TableCell>
        <TableCell className={expiring ? 'text-rose-600 font-semibold' : ''}>{fmtDate(d.licenceExpiry)}</TableCell>
        <TableCell>{d.assignedLocation || '-'}</TableCell>
        <TableCell><Badge className="bg-[#7a0d0d] hover:bg-[#5c0a0a]">{d.status}</Badge></TableCell>
        <TableCell>
          <Button size="sm" variant="outline" onClick={() => setPairingDriver(d)}>
            <QrCode className="w-3 h-3 mr-1" /> Get Code
          </Button>
        </TableCell>
        <TableCell className="text-right space-x-2">
          {canEdit && (
            <>
              <Button size="sm" variant="outline" onClick={() => { setEditing(d); setOpen(true) }}>Edit</Button>
              <Button size="sm" variant="destructive" onClick={() => remove(d.id)}>Delete</Button>
            </>
          )}
        </TableCell>
      </TableRow>
    )
  })}
</TableBody>
      </Table></div></CardContent></Card>
      {canEdit && (
  <DriverDialog open={open} onOpenChange={setOpen} onSubmit={submit} initial={editing} />
)}
<PairingCodeDialog driver={pairingDriver} onClose={() => setPairingDriver(null)} />
    
    </div>
  )
}
const STORES = ['TS', 'TSS', 'TSW']
function DriverDialog({ open, onOpenChange, onSubmit, initial }) {
  const [f, setF] = useState({})
     useEffect(() => { setF(initial || { name: '', empId: '', mobile: '', licence: '', licenceExpiry: '', status: 'Active', assignedLocation: '', remarks: '' }) }, [initial, open])
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
          <div><Label>Assigned Store</Label>
          <Select value={f.assignedLocation || ''} onValueChange={v => set('assignedLocation', v)}>
            <SelectTrigger><SelectValue placeholder="Select store" /></SelectTrigger>
            <SelectContent>{STORES.map(x => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
          </Select>
        </div>
          <div className="col-span-2"><Label>Remarks</Label><Textarea value={f.remarks || ''} onChange={e => set('remarks', e.target.value)} /></div>
        </div>
        <DialogFooter><Button onClick={() => onSubmit(f)} className="bg-gradient-to-r from-[#7a0d0d] to-[#a01414] hover:brightness-110 text-white">Save</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
function PairingCodeDialog({ driver, onClose }) {
  const [copied, setCopied] = useState(false)
  if (!driver) return null
  const code = pairingPayload(driver.id)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { toast.error('Could not copy') }
  }

  return (
    <Dialog open={!!driver} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Pairing Code — {driver.name}</DialogTitle></DialogHeader>
        <div className="flex flex-col items-center gap-4 py-2">
          <img src={qrImageUrl(code)} alt="Pairing QR" className="rounded-lg border" width={220} height={220} />
          <div className="w-full">
            <Label className="text-xs text-slate-500">Manual code (if QR scan fails)</Label>
            <div className="flex gap-2 mt-1">
              <Input readOnly value={code} className="font-mono text-xs" />
              <Button size="sm" variant="outline" onClick={copy}>{copied ? 'Copied' : 'Copy'}</Button>
            </div>
          </div>
          <p className="text-xs text-slate-500 text-center leading-relaxed">
            Open the CKC Fleet driver app on {driver.name}'s phone and scan this code once during setup.
            The phone will remember this driver — no login needed afterward.
          </p>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Close</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Trips() {
  const [items, setItems] = useState([])
  const [vehicles, setVehicles] = useState([])
  const [search, setSearch] = useState('')
  const [vehicleFilter, setVehicleFilter] = useState('all')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [submitted, setSubmitted] = useState(null)
  const [generating, setGenerating] = useState(false)
  useEffect(() => { api('trips').then(setItems); api('vehicles').then(setVehicles) }, [])

  const generate = () => {
    if (!fromDate || !toDate) { toast.error('Please select both From and To dates'); return }
    if (fromDate > toDate) { toast.error('From date must be before To date'); return }
    setSubmitted({ fromDate, toDate, vehicleFilter })
  }

  const filtered = submitted ? items.filter(t => {
    const d = t.dateOut?.slice(0, 10)
    if (d < submitted.fromDate || d > submitted.toDate) return false
    if (submitted.vehicleFilter !== 'all' && t.vehicleId !== submitted.vehicleFilter) return false
    if (search) {
      const s = search.toLowerCase()
      if (!(t.vehicleNumber?.toLowerCase().includes(s) || t.driverName?.toLowerCase().includes(s) || t.destination?.toLowerCase().includes(s))) return false
    }
    return true
  }) : []

  const headers = ['Trip ID', 'Date', 'Vehicle Type', 'Vehicle', 'Driver/Employee', 'Time Out', 'Time In', 'Odo Out', 'Odo In', 'KM Run', 'Destination', 'Status']
  const rows = () => filtered.map(t => [t.tripId, fmtDate(t.dateOut), t.vehicleType || '-', t.vehicleNumber, t.driverName || t.employeeName || '-', fmtDT(t.dateOut), fmtDT(t.timeIn), t.odometerOut, t.odometerIn, t.kmRun, t.destination, t.status])
  const exportCsv = () => {
    const csv = [headers, ...rows()].map(r => r.map(c => `"${c ?? ''}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `trips-${submitted.fromDate}_to_${submitted.toDate}.csv`; a.click()
  }
  const exportExcel = async () => {
    await exportXlsx(`CKC-Trips-${submitted.fromDate}_to_${submitted.toDate}.xlsx`, [{ name: 'Trips', headers, rows: rows() }])
    toast.success('Excel downloaded')
  }
    const totalKm = filtered.reduce((s, t) => s + (t.kmRun || 0), 0)
  const selectedVehicle = vehicles.find(v => v.id === submitted?.vehicleFilter)

  const generatePDF = async () => {
    setGenerating(true)
    try {
      const { jsPDF } = await import('jspdf')
      const autoTable = (await import('jspdf-autotable')).default
      const doc = new jsPDF({ unit: 'pt', format: 'a4' })
      const pageW = doc.internal.pageSize.getWidth()
      const now = new Date()
      const rangeStr = submitted.fromDate === submitted.toDate
        ? new Date(submitted.fromDate).toLocaleDateString('en-IN')
        : `${new Date(submitted.fromDate).toLocaleDateString('en-IN')} — ${new Date(submitted.toDate).toLocaleDateString('en-IN')}`

      let logoDataUrl = null
      try {
        const res = await fetch('/ckc-logo-pdf.png')
        const blob = await res.blob()
        logoDataUrl = await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob) })
      } catch {}

      doc.setFillColor(58, 6, 6); doc.rect(0, 0, pageW, 110, 'F')
      doc.setDrawColor(217, 119, 6); doc.setLineWidth(1.5); doc.line(0, 108, pageW, 108)
      if (logoDataUrl) {
        doc.setFillColor(255, 255, 255); doc.circle(60, 55, 32, 'F')
        doc.addImage(logoDataUrl, 'PNG', 32, 27, 56, 56)
      }
      const brandX = 108
      doc.setTextColor(255, 255, 255); doc.setFont('times', 'bold'); doc.setFontSize(22)
      doc.text('C. Krishniah Chetty', brandX, 46)
      const w1 = doc.getTextWidth('C. Krishniah Chetty')
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8)
      doc.text('TM', brandX + w1 + 3, 34)
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(252, 211, 77)
      doc.text('G R O U P    O F    J E W E L L E R S', brandX, 62)
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(255, 255, 255)
      doc.text('FleetPulse — Trip Register', brandX, 86)
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(252, 211, 77)
      doc.text(`Period:  ${rangeStr}`, pageW - 30, 36, { align: 'right' })
      doc.text(`Vehicle: ${selectedVehicle ? selectedVehicle.vehicleNumber : 'All Vehicles'}`, pageW - 30, 50, { align: 'right' })
      doc.text(`Generated: ${now.toLocaleString('en-IN')}`, pageW - 30, 64, { align: 'right' })
      doc.setTextColor(255, 255, 255); doc.setFontSize(7)
      doc.text('EST. 1869  ·  HERITAGE JEWELLERS', pageW - 30, 86, { align: 'right' })

      doc.setTextColor(15, 23, 42)
      let y = 135

      doc.setFontSize(13); doc.setFont('helvetica', 'bold')
      doc.text('Summary', 30, y); y += 8
      doc.setDrawColor(217, 119, 6); doc.setLineWidth(2); doc.line(30, y, 90, y); y += 15
      autoTable(doc, {
        startY: y,
        head: [['Metric', 'Value']],
        body: [
          ['Total Trips', filtered.length],
          ['Total KM Travelled', totalKm.toLocaleString('en-IN') + ' km'],
        ],
        theme: 'grid', headStyles: { fillColor: [139, 20, 20], textColor: 255 },
        styles: { fontSize: 10 }, margin: { left: 30, right: 30 },
      })
      y = doc.lastAutoTable.finalY + 20

      if (y > 650) { doc.addPage(); y = 40 }
      doc.setFontSize(13); doc.setFont('helvetica', 'bold')
      doc.text('Trip Details', 30, y); y += 12
      autoTable(doc, {
        startY: y,
        head: [['Trip ID', 'Type', 'Vehicle', 'Driver/Employee', 'Out', 'In', 'KM', 'Destination', 'Status']],
        body: filtered.slice(0, 300).map(t => [
          t.tripId, t.vehicleType || '-', t.vehicleNumber, t.driverName || t.employeeName || '-',
          new Date(t.dateOut).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }),
          t.timeIn ? new Date(t.timeIn).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-',
          t.kmRun || '-', t.destination || '-', t.status || '-',
        ]),
        theme: 'striped', headStyles: { fillColor: [139, 20, 20] },
        styles: { fontSize: 8 }, margin: { left: 30, right: 30 },
      })

      const pageCount = doc.internal.getNumberOfPages()
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        const pageH = doc.internal.pageSize.getHeight()
        doc.setDrawColor(217, 119, 6); doc.setLineWidth(0.5); doc.line(30, pageH - 32, pageW - 30, pageH - 32)
        doc.setFontSize(8); doc.setTextColor(120); doc.setFont('helvetica', 'normal')
        doc.text('C. Krishniah Chetty (TM) Group of Jewellers  ·  FleetPulse  ·  Confidential', 30, pageH - 20)
        doc.text(`Page ${i} of ${pageCount}`, pageW - 30, pageH - 20, { align: 'right' })
      }
      doc.save(`CKC-Trip-Register-${submitted.fromDate}_to_${submitted.toDate}.pdf`)
      toast.success('PDF generated')
    } catch (e) { console.error(e); toast.error('PDF failed: ' + e.message) }
    finally { setGenerating(false) }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="text-3xl font-bold text-slate-900 relative inline-block">Trip Register<span className="absolute -bottom-1 left-0 w-16 h-1 bg-gradient-to-r from-[#7a0d0d] to-amber-500 rounded-full" /></h1><p className="text-slate-500 mt-2">Select a date range and generate the trip register.</p></div>
                {submitted && (
          <div className="flex gap-2">
            <Button onClick={exportCsv} variant="outline"><Download className="w-4 h-4 mr-2" /> CSV</Button>
            <Button onClick={generatePDF} disabled={generating} className="bg-gradient-to-r from-[#7a0d0d] to-[#a01414] hover:brightness-110 text-white"><FileText className="w-4 h-4 mr-2" /> {generating ? '...' : 'PDF'}</Button>
            <Button onClick={exportExcel} variant="outline" className="border-emerald-600 text-emerald-700 hover:bg-emerald-50"><FileSpreadsheet className="w-4 h-4 mr-2" /> Excel</Button>
          </div>
        )}
      </div>
      <Card><CardContent className="p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div>
            <Label className="text-xs text-slate-500">From Date *</Label>
            <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} max={toDate || undefined} />
          </div>
          <div>
            <Label className="text-xs text-slate-500">To Date *</Label>
            <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} min={fromDate || undefined} />
          </div>
          <div>
            <Label className="text-xs text-slate-500">Vehicle</Label>
            <Select value={vehicleFilter} onValueChange={setVehicleFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Vehicles</SelectItem>
                {vehicles.map(v => <SelectItem key={v.id} value={v.id}>{v.vehicleNumber}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={generate} className="bg-gradient-to-r from-[#7a0d0d] to-[#a01414] hover:brightness-110 text-white h-10">
            <ClipboardList className="w-4 h-4 mr-2" /> Generate
          </Button>
        </div>

        {submitted && (
          <>
            <div className="relative max-w-sm">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <Input placeholder="Search within results..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            <div className="flex gap-4 text-sm bg-slate-50 rounded-lg p-3">
              <div><span className="text-slate-500">Trips: </span><b>{filtered.length}</b></div>
              <div><span className="text-slate-500">Total KM: </span><b>{totalKm.toLocaleString()}</b></div>
            </div>
            <div className="overflow-x-auto"><Table>
              <TableHeader><TableRow>
                <TableHead>Trip ID</TableHead><TableHead>Type</TableHead><TableHead>Vehicle</TableHead><TableHead>Driver/Employee</TableHead>
                <TableHead>Out</TableHead><TableHead>In</TableHead><TableHead>KM</TableHead>
                <TableHead>Destination</TableHead><TableHead>Status</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {filtered.slice(0, 200).map(t => (
                  <TableRow key={t.id}>
                    <TableCell className="font-mono text-xs">{t.tripId}</TableCell>
                    <TableCell className="text-xs">{t.vehicleType || '-'}</TableCell>
                    <TableCell className="font-semibold">{t.vehicleNumber}</TableCell>
                    <TableCell>{t.driverName || t.employeeName || '-'}</TableCell>
                    <TableCell className="text-xs">{fmtDT(t.dateOut)}</TableCell>
                    <TableCell className="text-xs">{fmtDT(t.timeIn)}</TableCell>
                    <TableCell className="font-semibold">{t.kmRun || '-'}</TableCell>
                    <TableCell className="text-xs">{t.destination}</TableCell>
                    <TableCell><Badge variant={t.status === 'Outside' ? 'secondary' : 'default'} className={t.status === 'Returned' ? 'bg-[#7a0d0d] hover:bg-[#5c0a0a]' : ''}>{t.status}</Badge></TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={9} className="text-center text-slate-500 py-8">No trips found for this range.</TableCell></TableRow>
                )}
              </TableBody>
            </Table></div>
          </>
        )}
        {!submitted && (
          <div className="text-center text-slate-400 py-10">Select a date range and click Generate to view trips.</div>
        )}
      </CardContent></Card>
    </div>
  )
}
          
function FuelRegister() {
  const [items, setItems] = useState([])
  const [vehicles, setVehicles] = useState([])
  const [viewImg, setViewImg] = useState(null)
  const [vehicleFilter, setVehicleFilter] = useState('all')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
    const [submitted, setSubmitted] = useState(null)
  const [generating, setGenerating] = useState(false)

  useEffect(() => { api('fuel').then(setItems); api('vehicles').then(setVehicles) }, [])

  const generate = () => {
    if (!fromDate || !toDate) { toast.error('Please select both From and To dates'); return }
    if (fromDate > toDate) { toast.error('From date must be before To date'); return }
    setSubmitted({ fromDate, toDate, vehicleFilter })
  }

  const filtered = submitted ? items.filter(t => {
    const d = t.date?.slice(0, 10)
    if (d < submitted.fromDate || d > submitted.toDate) return false
    if (submitted.vehicleFilter !== 'all' && t.vehicleId !== submitted.vehicleFilter) return false
    return true
  }) : []

  const totalLit = filtered.reduce((s, f) => s + f.quantity, 0)
  const totalCost = filtered.reduce((s, f) => s + f.amount, 0)
  const headers = ['Date', 'Vehicle', 'Odometer', 'Quantity(L)', 'Rate', 'Amount', 'Station', 'Receipt']
  const rows = () => filtered.map(t => [fmtDate(t.date), t.vehicleNumber, t.odometer, t.quantity, t.rate, t.amount, t.station, t.receiptNumber])
  const exportCsv = () => {
    const csv = [headers, ...rows()].map(r => r.map(c => `"${c ?? ''}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `fuel-${submitted.fromDate}_to_${submitted.toDate}.csv`; a.click()
  }
    const exportExcel = async () => {
    await exportXlsx(`CKC-Fuel-${submitted.fromDate}_to_${submitted.toDate}.xlsx`, [{ name: 'Fuel', headers, rows: rows() }])
    toast.success('Excel downloaded')
  }
  const selectedVehicle = vehicles.find(v => v.id === submitted?.vehicleFilter)

  const generatePDF = async () => {
    setGenerating(true)
    try {
      const { jsPDF } = await import('jspdf')
      const autoTable = (await import('jspdf-autotable')).default
      const doc = new jsPDF({ unit: 'pt', format: 'a4' })
      const pageW = doc.internal.pageSize.getWidth()
      const now = new Date()
      const rangeStr = submitted.fromDate === submitted.toDate
        ? new Date(submitted.fromDate).toLocaleDateString('en-IN')
        : `${new Date(submitted.fromDate).toLocaleDateString('en-IN')} — ${new Date(submitted.toDate).toLocaleDateString('en-IN')}`

      let logoDataUrl = null
      try {
        const res = await fetch('/ckc-logo-pdf.png')
        const blob = await res.blob()
        logoDataUrl = await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob) })
      } catch {}

      doc.setFillColor(58, 6, 6); doc.rect(0, 0, pageW, 110, 'F')
      doc.setDrawColor(217, 119, 6); doc.setLineWidth(1.5); doc.line(0, 108, pageW, 108)
      if (logoDataUrl) {
        doc.setFillColor(255, 255, 255); doc.circle(60, 55, 32, 'F')
        doc.addImage(logoDataUrl, 'PNG', 32, 27, 56, 56)
      }
      const brandX = 108
      doc.setTextColor(255, 255, 255); doc.setFont('times', 'bold'); doc.setFontSize(22)
      doc.text('C. Krishniah Chetty', brandX, 46)
      const w1 = doc.getTextWidth('C. Krishniah Chetty')
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8)
      doc.text('TM', brandX + w1 + 3, 34)
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(252, 211, 77)
      doc.text('G R O U P    O F    J E W E L L E R S', brandX, 62)
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(255, 255, 255)
            doc.text('FleetPulse — Fuel Register', brandX, 86)
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(252, 211, 77)
      doc.text(`Period:  ${rangeStr}`, pageW - 30, 36, { align: 'right' })
      doc.text(`Vehicle: ${selectedVehicle ? selectedVehicle.vehicleNumber : 'All Vehicles'}`, pageW - 30, 50, { align: 'right' })
      doc.text(`Generated: ${now.toLocaleString('en-IN')}`, pageW - 30, 64, { align: 'right' })
      doc.setTextColor(255, 255, 255); doc.setFontSize(7)
      doc.text('EST. 1869  ·  HERITAGE JEWELLERS', pageW - 30, 86, { align: 'right' })

      doc.setTextColor(15, 23, 42)
      let y = 135

      doc.setFontSize(13); doc.setFont('helvetica', 'bold')
      doc.text('Summary', 30, y); y += 8
      doc.setDrawColor(217, 119, 6); doc.setLineWidth(2); doc.line(30, y, 90, y); y += 15
      autoTable(doc, {
        startY: y,
        head: [['Metric', 'Value']],
        body: [
          ['Total Entries', filtered.length],
          ['Total Litres', totalLit.toFixed(2) + ' L'],
          ['Total Cost', 'Rs. ' + totalCost.toLocaleString('en-IN')],
        ],
        theme: 'grid', headStyles: { fillColor: [217, 119, 6], textColor: 255 },
        styles: { fontSize: 10 }, margin: { left: 30, right: 30 },
      })
      y = doc.lastAutoTable.finalY + 20

      if (y > 650) { doc.addPage(); y = 40 }
      doc.setFontSize(13); doc.setFont('helvetica', 'bold')
      doc.text('Fuel Entries', 30, y); y += 12
      autoTable(doc, {
        startY: y,
        head: [['Date', 'Vehicle', 'Odometer', 'Qty (L)', 'Rate', 'Amount', 'Station', 'Receipt']],
        body: filtered.slice(0, 300).map(f => [
          new Date(f.date).toLocaleDateString('en-IN'),
          f.vehicleNumber, f.odometer?.toLocaleString() || '-',
          f.quantity, 'Rs. ' + f.rate,
          'Rs. ' + f.amount.toLocaleString('en-IN'),
          f.station || '-', f.receiptNumber || '-',
        ]),
        theme: 'striped', headStyles: { fillColor: [217, 119, 6] },
        styles: { fontSize: 8 }, margin: { left: 30, right: 30 },
      })

      const pageCount = doc.internal.getNumberOfPages()
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        const pageH = doc.internal.pageSize.getHeight()
        doc.setDrawColor(217, 119, 6); doc.setLineWidth(0.5); doc.line(30, pageH - 32, pageW - 30, pageH - 32)
        doc.setFontSize(8); doc.setTextColor(120); doc.setFont('helvetica', 'normal')
        doc.text('C. Krishniah Chetty (TM) Group of Jewellers  ·  Fleet Management System  ·  Confidential', 30, pageH - 20)
        doc.text(`Page ${i} of ${pageCount}`, pageW - 30, pageH - 20, { align: 'right' })
      }
      doc.save(`CKC-Fuel-Register-${submitted.fromDate}_to_${submitted.toDate}.pdf`)
      toast.success('PDF generated')
    } catch (e) { console.error(e); toast.error('PDF failed: ' + e.message) }
    finally { setGenerating(false) }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="text-3xl font-bold text-slate-900 relative inline-block">Fuel Register<span className="absolute -bottom-1 left-0 w-16 h-1 bg-gradient-to-r from-[#7a0d0d] to-amber-500 rounded-full" /></h1><p className="text-slate-500 mt-2">Select a date range and generate the fuel register.</p></div>
                {submitted && (
          <div className="flex gap-2">
            <Button onClick={exportCsv} variant="outline"><Download className="w-4 h-4 mr-2" /> CSV</Button>
            <Button onClick={generatePDF} disabled={generating} className="bg-gradient-to-r from-[#7a0d0d] to-[#a01414] hover:brightness-110 text-white"><FileText className="w-4 h-4 mr-2" /> {generating ? '...' : 'PDF'}</Button>
            <Button onClick={exportExcel} variant="outline" className="border-emerald-600 text-emerald-700 hover:bg-emerald-50"><FileSpreadsheet className="w-4 h-4 mr-2" /> Excel</Button>
          </div>
        )}
      </div>
      <Card><CardContent className="p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div>
            <Label className="text-xs text-slate-500">From Date *</Label>
            <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} max={toDate || undefined} />
          </div>
          <div>
            <Label className="text-xs text-slate-500">To Date *</Label>
            <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} min={fromDate || undefined} />
          </div>
          <div>
            <Label className="text-xs text-slate-500">Vehicle</Label>
            <Select value={vehicleFilter} onValueChange={setVehicleFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Vehicles</SelectItem>
                {vehicles.map(v => <SelectItem key={v.id} value={v.id}>{v.vehicleNumber}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={generate} className="bg-gradient-to-r from-[#7a0d0d] to-[#a01414] hover:brightness-110 text-white h-10">
            <Fuel className="w-4 h-4 mr-2" /> Generate
          </Button>
        </div>

        {submitted && (
          <>
            <div className="flex flex-wrap gap-4 text-sm bg-slate-50 rounded-lg p-3">
              <div><span className="text-slate-500">Entries: </span><b>{filtered.length}</b></div>
              <div><span className="text-slate-500">Total Litres: </span><b>{totalLit.toFixed(1)} L</b></div>
              <div><span className="text-slate-500">Total Cost: </span><b>{fmtINR(totalCost)}</b></div>
            </div>
            <div className="overflow-x-auto"><Table>
              <TableHeader><TableRow>
                <TableHead>Date</TableHead><TableHead>Vehicle</TableHead><TableHead>Odometer</TableHead>
                <TableHead>Qty (L)</TableHead><TableHead>Rate</TableHead><TableHead>Amount</TableHead>
                <TableHead>Station</TableHead><TableHead>Receipt</TableHead><TableHead>Photo</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {filtered.slice(0, 200).map(t => (
                  <TableRow key={t.id}>
                    <TableCell className="text-xs">{fmtDate(t.date)}</TableCell>
                    <TableCell className="font-semibold">{t.vehicleNumber}</TableCell>
                    <TableCell>{t.odometer?.toLocaleString()}</TableCell>
                    <TableCell>{t.quantity}</TableCell>
                    <TableCell>₹{t.rate}</TableCell>
                    <TableCell className="font-semibold">{fmtINR(t.amount)}</TableCell>
                    <TableCell className="text-xs">{t.station}</TableCell>
                    <TableCell className="text-xs">{t.receiptNumber}</TableCell>
                    <TableCell>
                      {t.receiptImage ? (
                        <button onClick={() => setViewImg(t.receiptImage)} className="w-10 h-10 rounded border overflow-hidden hover:ring-2 hover:ring-amber-500">
                          <img src={t.receiptImage} alt="" className="w-full h-full object-cover" />
                        </button>
                      ) : <span className="text-slate-300 text-xs">—</span>}
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={9} className="text-center text-slate-500 py-8">No fuel entries found for this range.</TableCell></TableRow>
                )}
              </TableBody>
            </Table></div>
          </>
        )}
        {!submitted && (
          <div className="text-center text-slate-400 py-10">Select a date range and click Generate to view fuel entries.</div>
        )}
      </CardContent></Card>
      <Dialog open={!!viewImg} onOpenChange={(v) => !v && setViewImg(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>Receipt Photo</DialogTitle></DialogHeader>
          {viewImg && <img src={viewImg} alt="Receipt" className="w-full rounded" />}
        </DialogContent>
      </Dialog>
    </div>
  )
}
function Maintenance() {
  const user = getUser()
  const canEdit = user.role !== 'store_admin'
  const [items, setItems] = useState([])
  const [vehicles, setVehicles] = useState([])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [vehicleFilter, setVehicleFilter] = useState('all')
  const load = () => Promise.all([api('maintenance'), api('vehicles')]).then(([m, v]) => { setItems(m); setVehicles(v) })
  useEffect(() => { load() }, [])

  const filtered = items.filter(m => vehicleFilter === 'all' || m.vehicleId === vehicleFilter)
  const totalCost = filtered.reduce((s, m) => s + (m.totalCost || 0), 0)

  const submit = async (data) => {
    try {
      if (editing) {
        await api(`maintenance/${editing.id}`, { method: 'PUT', body: data })
        toast.success('Service record updated')
      } else {
        await api('maintenance', { method: 'POST', body: data })
        toast.success('Service record added')
      }
      setOpen(false); setEditing(null); load()
    } catch (e) { toast.error(e.message) }
  }
  const remove = async (id) => {
    if (!confirm('Delete this service record?')) return
    await api(`maintenance/${id}`, { method: 'DELETE' })
    toast.success('Deleted'); load()
  }

  const in30 = new Date(Date.now() + 30 * 864e5)
  const upcoming = vehicles.filter(v => {
    const dueDate = v.serviceDueDate ? new Date(v.serviceDueDate) : null
    const kmSoon = v.serviceDueKm && v.currentOdometer >= v.serviceDueKm - 500
    return (dueDate && dueDate < in30) || kmSoon
  })

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="text-3xl font-bold text-slate-900 relative inline-block">Maintenance<span className="absolute -bottom-1 left-0 w-16 h-1 bg-gradient-to-r from-[#7a0d0d] to-amber-500 rounded-full" /></h1><p className="text-slate-500 mt-2">Service history · parts · workshops · next-service reminders</p></div>
        {canEdit && (
          <Button onClick={() => { setEditing(null); setOpen(true) }} className="bg-gradient-to-r from-[#7a0d0d] to-[#a01414] text-white"><Plus className="w-4 h-4 mr-1" /> Add Service Record</Button>
        )}
      </div>

      {upcoming.length > 0 && (
        <Card className="border-2 border-amber-300 bg-amber-50/40">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-amber-800"><AlertTriangle className="w-5 h-5" /> Upcoming Service Reminders ({upcoming.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
              {upcoming.map(v => {
                const daysLeft = v.serviceDueDate ? Math.floor((new Date(v.serviceDueDate) - Date.now()) / 864e5) : null
                const kmLeft = v.serviceDueKm ? v.serviceDueKm - (v.currentOdometer || 0) : null
                const overdue = (daysLeft !== null && daysLeft < 0) || (kmLeft !== null && kmLeft <= 0)
                return (
                  <div key={v.id} className={`p-3 rounded-lg border ${overdue ? 'bg-rose-50 border-rose-300' : 'bg-white border-amber-200'}`}>
                    <div className="flex justify-between items-start">
                      <div className="font-bold">{v.vehicleNumber}</div>
                      {overdue && <Badge variant="destructive">OVERDUE</Badge>}
                    </div>
                    <div className="text-xs text-slate-600 mt-1">{v.make} {v.model}</div>
                    {daysLeft !== null && (
                      <div className="text-xs mt-1">
                        <span className="text-slate-500">Next service: </span>
                        <b className={daysLeft < 7 ? 'text-rose-600' : 'text-slate-800'}>{daysLeft < 0 ? `${-daysLeft} days ago` : `${daysLeft} days`}</b>
                      </div>
                    )}
                    {kmLeft !== null && (
                      <div className="text-xs">
                        <span className="text-slate-500">Distance: </span>
                        <b className={kmLeft < 500 ? 'text-rose-600' : 'text-slate-800'}>{kmLeft > 0 ? `${kmLeft.toLocaleString()} km left` : `${(-kmLeft).toLocaleString()} km overdue`}</b>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs text-slate-500">Filter by Vehicle</Label>
              <Select value={vehicleFilter} onValueChange={setVehicleFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Vehicles</SelectItem>
                  {vehicles.map(v => <SelectItem key={v.id} value={v.id}>{v.vehicleNumber}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2 flex items-end gap-4 text-sm bg-slate-50 rounded-lg p-3">
              <div><span className="text-slate-500">Records: </span><b>{filtered.length}</b></div>
              <div><span className="text-slate-500">Total Cost: </span><b>{fmtINR(totalCost)}</b></div>
            </div>
          </div>
          <div className="overflow-x-auto"><Table>
            <TableHeader><TableRow>
              <TableHead>Date</TableHead><TableHead>Vehicle</TableHead><TableHead>Type</TableHead>
              <TableHead>Workshop</TableHead><TableHead>Odo</TableHead><TableHead>Parts</TableHead>
              <TableHead>Cost</TableHead><TableHead>Next Service</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {filtered.map(m => (
                <TableRow key={m.id}>
                  <TableCell className="text-xs">{fmtDate(m.serviceDate)}</TableCell>
                  <TableCell className="font-semibold">{m.vehicleNumber}</TableCell>
                  <TableCell><Badge variant="outline">{m.serviceType}</Badge></TableCell>
                  <TableCell className="text-xs">{m.workshop || '-'}</TableCell>
                  <TableCell className="text-xs">{m.odometer?.toLocaleString() || '-'}</TableCell>
                  <TableCell className="text-xs max-w-[200px] truncate">{(m.parts || []).map(p => typeof p === 'string' ? p : p.name).join(', ') || '-'}</TableCell>
                  <TableCell className="font-semibold">{fmtINR(m.totalCost || m.cost)}</TableCell>
                  <TableCell className="text-xs">
                    {m.nextServiceDate && <div>{fmtDate(m.nextServiceDate)}</div>}
                    {m.nextServiceKm ? <div className="text-slate-500">@ {m.nextServiceKm.toLocaleString()} km</div> : null}
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    {canEdit && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => { setEditing(m); setOpen(true) }}>Edit</Button>
                        <Button size="sm" variant="destructive" onClick={() => remove(m.id)}><Trash2 className="w-3 h-3" /></Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={9} className="text-center text-slate-500 py-8">No service records yet. Click "Add Service Record" to log the first one.</TableCell></TableRow>
              )}
            </TableBody>
          </Table></div>
        </CardContent>
      </Card>

      {canEdit && (
        <MaintenanceDialog open={open} onOpenChange={setOpen} onSubmit={submit} initial={editing} vehicles={vehicles} />
      )}
    </div>
  )
}

function MaintenanceDialog({ open, onOpenChange, onSubmit, initial, vehicles }) {
  const [f, setF] = useState({})
  const [partInput, setPartInput] = useState({ name: '', qty: 1, cost: 0 })

  useEffect(() => {
    setF(initial || {
      vehicleId: '', serviceDate: new Date().toISOString().slice(0, 10),
      odometer: 0, workshop: '', serviceType: 'General Service',
      description: '', parts: [], cost: 0, laborCost: 0,
      nextServiceKm: 0, nextServiceDate: '', invoiceNumber: '', remarks: ''
    })
    setPartInput({ name: '', qty: 1, cost: 0 })
  }, [initial, open])

  const set = (k, v) => setF(x => ({ ...x, [k]: v }))
  const selectedVehicle = vehicles.find(v => v.id === f.vehicleId)

  const addPart = () => {
    if (!partInput.name) return
    setF(x => ({
      ...x,
      parts: [...(x.parts || []), { ...partInput }],
      cost: (Number(x.cost) || 0) + (Number(partInput.qty) * Number(partInput.cost) || 0)
    }))
    setPartInput({ name: '', qty: 1, cost: 0 })
  }
  const removePart = (i) => {
    setF(x => {
      const p = x.parts[i]
      const dec = (Number(p.qty) * Number(p.cost)) || 0
      return { ...x, parts: x.parts.filter((_, idx) => idx !== i), cost: Math.max(0, (Number(x.cost) || 0) - dec) }
    })
  }

  const partsTotal = (f.parts || []).reduce((s, p) => s + (Number(p.qty) * Number(p.cost) || 0), 0)
  const grandTotal = Number(f.cost || 0) + Number(f.laborCost || 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? 'Edit Service Record' : 'Add Service Record'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 md:col-span-1">
              <Label>Vehicle *</Label>
              <Select value={f.vehicleId} onValueChange={v => set('vehicleId', v)}>
                <SelectTrigger><SelectValue placeholder="Select vehicle" /></SelectTrigger>
                <SelectContent>{vehicles.map(v => <SelectItem key={v.id} value={v.id}>{v.vehicleNumber} — {v.make} {v.model}</SelectItem>)}</SelectContent>
              </Select>
              {selectedVehicle && <div className="text-xs text-slate-500 mt-1">Current odo: {selectedVehicle.currentOdometer?.toLocaleString()} km</div>}
            </div>
            <div>
              <Label>Service Type</Label>
              <Select value={f.serviceType} onValueChange={v => set('serviceType', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['General Service', 'Oil Change', 'Tyre Change', 'Brake Service', 'Battery', 'Body Repair', 'Engine Repair', 'AC Service', 'Electrical', 'Other'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Service Date *</Label>
              <Input type="date" value={f.serviceDate?.slice(0, 10) || ''} onChange={e => set('serviceDate', e.target.value)} />
            </div>
            <div>
              <Label>Odometer (km)</Label>
              <Input type="number" value={f.odometer || ''} onChange={e => set('odometer', +e.target.value)} />
            </div>
            <div>
              <Label>Workshop / Garage</Label>
              <Input value={f.workshop || ''} onChange={e => set('workshop', e.target.value)} placeholder="e.g. Authorized Toyota Service" />
            </div>
            <div>
              <Label>Invoice Number</Label>
              <Input value={f.invoiceNumber || ''} onChange={e => set('invoiceNumber', e.target.value)} />
            </div>
          </div>

          <div>
            <Label>Service Description</Label>
            <Textarea value={f.description || ''} onChange={e => set('description', e.target.value)} placeholder="What was done in this service..." rows={2} />
          </div>

          <div className="border rounded-lg p-3 bg-slate-50">
            <Label className="font-semibold mb-2 block">Parts Changed</Label>
            <div className="grid grid-cols-12 gap-2 items-end">
              <div className="col-span-6"><Label className="text-xs">Part Name</Label><Input value={partInput.name} onChange={e => setPartInput({ ...partInput, name: e.target.value })} placeholder="e.g. Brake Pad" /></div>
              <div className="col-span-2"><Label className="text-xs">Qty</Label><Input type="number" value={partInput.qty} onChange={e => setPartInput({ ...partInput, qty: +e.target.value })} /></div>
              <div className="col-span-3"><Label className="text-xs">Cost/unit</Label><Input type="number" value={partInput.cost} onChange={e => setPartInput({ ...partInput, cost: +e.target.value })} /></div>
              <div className="col-span-1"><Button type="button" onClick={addPart} size="sm" className="w-full"><Plus className="w-4 h-4" /></Button></div>
            </div>
            {(f.parts || []).length > 0 && (
              <div className="mt-3 space-y-1">
                {f.parts.map((p, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm bg-white p-2 rounded border">
                    <div className="flex-1"><b>{p.name}</b> <span className="text-slate-500">× {p.qty}</span></div>
                    <div className="text-slate-700">{fmtINR((p.qty || 1) * (p.cost || 0))}</div>
                    <button onClick={() => removePart(i)} className="text-rose-500 hover:text-rose-700"><X className="w-4 h-4" /></button>
                  </div>
                ))}
                <div className="text-xs text-slate-500 pt-1">Parts subtotal: <b>{fmtINR(partsTotal)}</b></div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <Label>Parts Cost (₹)</Label>
              <Input type="number" value={f.cost || 0} onChange={e => set('cost', +e.target.value)} />
            </div>
            <div>
              <Label>Labor Cost (₹)</Label>
              <Input type="number" value={f.laborCost || 0} onChange={e => set('laborCost', +e.target.value)} />
            </div>
            <div className="bg-red-50 border border-red-100 rounded-lg p-3">
              <Label className="text-xs">Total Cost</Label>
              <div className="text-xl font-bold text-[#7a0d0d]">{fmtINR(grandTotal)}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 border-t pt-4">
            <div>
              <Label>Next Service KM</Label>
              <Input type="number" value={f.nextServiceKm || ''} onChange={e => set('nextServiceKm', +e.target.value)} placeholder="e.g. 50000" />
              {selectedVehicle && f.nextServiceKm > 0 && (
                <div className="text-xs text-slate-500 mt-1">{(f.nextServiceKm - selectedVehicle.currentOdometer).toLocaleString()} km from now</div>
              )}
            </div>
            <div>
              <Label>Next Service Date</Label>
              <Input type="date" value={f.nextServiceDate?.slice(0, 10) || ''} onChange={e => set('nextServiceDate', e.target.value)} />
            </div>
          </div>

          <div>
            <Label>Remarks</Label>
            <Textarea value={f.remarks || ''} onChange={e => set('remarks', e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => onSubmit(f)} className="bg-[#7a0d0d] hover:bg-[#5c0a0a]" disabled={!f.vehicleId || !f.serviceDate}>
            {initial ? 'Update Record' : 'Save Service Record'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
const ROLES = [
  { value: 'admin', label: 'Administrator' },
  { value: 'store_admin', label: 'Store Admin' },
  { value: 'security', label: 'Security' },
]

function UserManagement() {
  const currentUser = getUser()
  const [items, setItems] = useState([])
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [pwdUser, setPwdUser] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const load = () => api('users').then(setItems).catch(e => toast.error(e.message))
  useEffect(() => { load() }, [])

  if (currentUser.role !== 'admin') {
    return (
      <div className="p-6">
        <Card><CardContent className="p-10 text-center text-slate-500">
          You don't have permission to view this page.
        </CardContent></Card>
      </div>
    )
  }

  const filtered = items.filter(u =>
    !search ||
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.username?.toLowerCase().includes(search.toLowerCase()) ||
    u.empId?.toLowerCase().includes(search.toLowerCase())
  )

  const roleLabel = (r) => ROLES.find(x => x.value === r)?.label || r

  const submit = async (data) => {
    try {
      if (editing) {
        const { password, ...rest } = data
        await api(`users/${editing.id}`, { method: 'PUT', body: rest })
        toast.success('User updated')
      } else {
        await api('users', { method: 'POST', body: data })
        toast.success('User created')
      }
      setOpen(false); setEditing(null); load()
    } catch (e) { toast.error(e.message) }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    try {
      await api(`users/${deleteTarget.id}`, { method: 'DELETE' })
      toast.success('User deleted')
      setDeleteTarget(null); load()
    } catch (e) { toast.error(e.message) }
  }

  const submitPassword = async (newPassword) => {
    try {
      await api(`users/${pwdUser.id}/password`, { method: 'PUT', body: { password: newPassword } })
      toast.success(`Password updated for ${pwdUser.name}`)
      setPwdUser(null)
    } catch (e) { toast.error(e.message) }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 relative inline-block">User Management<span className="absolute -bottom-1 left-0 w-16 h-1 bg-gradient-to-r from-[#7a0d0d] to-amber-500 rounded-full" /></h1>
          <p className="text-slate-500 mt-2">Manage administrator, store admin, and security accounts</p>
        </div>
        <Button onClick={() => { setEditing(null); setOpen(true) }} className="bg-gradient-to-r from-[#7a0d0d] to-[#a01414] hover:brightness-110 text-white shadow-md">
          <Plus className="w-4 h-4 mr-1" /> Add User
        </Button>
      </div>

      <Card><CardContent className="p-4">
        <div className="mb-4 relative max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <Input placeholder="Search name, username, emp ID..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="overflow-x-auto"><Table>
          <TableHeader><TableRow>
            <TableHead>Name</TableHead><TableHead>Emp ID</TableHead><TableHead>Mobile</TableHead>
            <TableHead>Username</TableHead><TableHead>Role</TableHead><TableHead>Status</TableHead><TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {filtered.map(u => (
              <TableRow key={u.id}>
                <TableCell className="font-semibold">{u.name}</TableCell>
                <TableCell>{u.empId || '-'}</TableCell>
                <TableCell>{u.mobile || '-'}</TableCell>
                <TableCell className="font-mono text-xs">{u.username}</TableCell>
                <TableCell><Badge variant="outline">{roleLabel(u.role)}</Badge></TableCell>
                <TableCell>
                  <Badge className={u.status === 'Active' ? 'bg-[#7a0d0d] hover:bg-[#5c0a0a]' : ''} variant={u.status === 'Active' ? 'default' : 'secondary'}>
                    {u.status || 'Active'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right space-x-2 whitespace-nowrap">
                  <Button size="sm" variant="outline" onClick={() => { setEditing(u); setOpen(true) }}>Edit</Button>
                  <Button size="sm" variant="outline" onClick={() => setPwdUser(u)}><KeyRound className="w-3 h-3 mr-1" /> Password</Button>
                  <Button size="sm" variant="destructive" onClick={() => setDeleteTarget(u)}>Delete</Button>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-slate-500 py-8">No users found.</TableCell></TableRow>
            )}
          </TableBody>
        </Table></div>
      </CardContent></Card>

      <UserDialog open={open} onOpenChange={setOpen} onSubmit={submit} initial={editing} />

      <ChangePasswordDialog user={pwdUser} onClose={() => setPwdUser(null)} onSubmit={submitPassword} />

      <Dialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete User</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-600">
            Are you sure you want to delete <b>{deleteTarget?.name}</b> ({deleteTarget?.username})? This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete}>Delete User</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function UserDialog({ open, onOpenChange, onSubmit, initial }) {
  const [f, setF] = useState({})
  useEffect(() => {
    setF(initial || { name: '', empId: '', mobile: '', username: '', password: '', role: 'security', status: 'Active', storeId: '' })
  }, [initial, open])
  const set = (k, v) => setF(x => ({ ...x, [k]: v }))

  const showStore = f.role === 'store_admin' || f.role === 'security'
  const requiresStore = f.role === 'store_admin' // security's store is optional — a security user with no store stays global/unrestricted
  const canSave = f.name && f.username && (initial || f.password) && f.role && (!requiresStore || f.storeId)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{initial ? 'Edit User' : 'Add User'}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><Label>Name *</Label><Input value={f.name || ''} onChange={e => set('name', e.target.value)} /></div>
          <div><Label>Employee ID</Label><Input value={f.empId || ''} onChange={e => set('empId', e.target.value)} /></div>
          <div><Label>Mobile Number</Label><Input value={f.mobile || ''} onChange={e => set('mobile', e.target.value)} /></div>
          <div><Label>Username *</Label><Input value={f.username || ''} onChange={e => set('username', e.target.value)} disabled={!!initial} /></div>
          {!initial && (
            <div><Label>Password *</Label><Input type="password" value={f.password || ''} onChange={e => set('password', e.target.value)} placeholder="Set initial password" /></div>
          )}
          <div>
            <Label>Role *</Label>
            <Select value={f.role} onValueChange={v => set('role', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Status</Label>
            <Select value={f.status} onValueChange={v => set('status', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {showStore && (
            <div className="col-span-2">
              <Label>Store{requiresStore ? ' *' : ' (optional)'}</Label>
              <Select value={f.storeId || 'none'} onValueChange={v => set('storeId', v === 'none' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Select store" /></SelectTrigger>
                <SelectContent>
                  {!requiresStore && <SelectItem value="none">— No store (sees all locations) —</SelectItem>}
                  {STORES.map(x => <SelectItem key={x} value={x}>{x}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500 mt-1">
                {requiresStore
                  ? 'Store admins only see data for their assigned store.'
                  : 'If set, this security user can only view and process vehicles/drivers/trips for this store. Leave unset for a global security account.'}
              </p>
            </div>
          )}
        </div>
        {initial && <p className="text-xs text-slate-500">Username can't be changed. Use "Password" from the table to reset the login password.</p>}
        <DialogFooter>
          <Button onClick={() => onSubmit(f)} disabled={!canSave} className="bg-gradient-to-r from-[#7a0d0d] to-[#a01414] hover:brightness-110 text-white">
            {initial ? 'Save Changes' : 'Create User'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}


function ChangePasswordDialog({ user, onClose, onSubmit }) {
  const [pwd, setPwd] = useState('')
  const [confirm, setConfirm] = useState('')
  useEffect(() => { setPwd(''); setConfirm('') }, [user])

  const canSave = pwd.length >= 6 && pwd === confirm

  return (
    <Dialog open={!!user} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Change Password — {user?.name}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>New Password</Label><Input type="password" value={pwd} onChange={e => setPwd(e.target.value)} placeholder="Minimum 6 characters" /></div>
          <div><Label>Confirm Password</Label><Input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} /></div>
          {pwd && confirm && pwd !== confirm && <p className="text-xs text-rose-600">Passwords do not match.</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSubmit(pwd)} disabled={!canSave} className="bg-gradient-to-r from-[#7a0d0d] to-[#a01414] hover:brightness-110 text-white">
            Update Password
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Mileage() {
  const [trips, setTrips] = useState([])
  const [fuel, setFuel] = useState([])
  const [vehicles, setVehicles] = useState([])
  const [loading, setLoading] = useState(true)
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [vehicleFilter, setVehicleFilter] = useState('all')
  const [submitted, setSubmitted] = useState(null)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    Promise.all([api('trips'), api('fuel'), api('vehicles')]).then(([t, f, v]) => {
      setTrips(t); setFuel(f); setVehicles(v); setLoading(false)
    })
  }, [])

  if (loading) return <div className="p-8">Loading...</div>

  const generate = () => {
    if (!fromDate || !toDate) { toast.error('Please select both From and To dates'); return }
    if (fromDate > toDate) { toast.error('From date must be before To date'); return }
    setSubmitted({ fromDate, toDate, vehicleFilter })
  }

  const inRange = (dstr) => submitted && dstr >= submitted.fromDate && dstr <= submitted.toDate

  const perVehicle = submitted ? vehicles
    .filter(v => submitted.vehicleFilter === 'all' || v.id === submitted.vehicleFilter)
    .map(v => {
      const vTrips = trips.filter(t => t.vehicleId === v.id && t.kmRun && inRange(t.dateOut?.slice(0, 10)))
      const vFuel = fuel.filter(f => f.vehicleId === v.id && inRange(f.date?.slice(0, 10)))
      const km = vTrips.reduce((s, t) => s + t.kmRun, 0)
      const lit = vFuel.reduce((s, f) => s + f.quantity, 0)
      const cost = vFuel.reduce((s, f) => s + f.amount, 0)
      const mileage = lit > 0 ? km / lit : null
      const variance = mileage !== null ? ((mileage - v.expectedMileage) / v.expectedMileage * 100) : null
      return {
        id: v.id, vehicleNumber: v.vehicleNumber, make: v.make, model: v.model,
        expectedMileage: v.expectedMileage, threshold: v.lowMileageThreshold,
        km, litres: lit, cost, mileage, variance,
        lowMileage: mileage !== null && mileage < v.lowMileageThreshold,
        trips: vTrips.length, refuels: vFuel.length,
      }
    }) : []

  const totalKm = perVehicle.reduce((s, p) => s + p.km, 0)
  const totalLit = perVehicle.reduce((s, p) => s + p.litres, 0)
  const totalCost = perVehicle.reduce((s, p) => s + p.cost, 0)
  const avgMileage = totalLit > 0 ? (totalKm / totalLit).toFixed(2) : 'N/A'
  const lowCount = perVehicle.filter(p => p.lowMileage).length

  const exportExcel = async () => {
    const summaryRows = [
      ['Period', `${submitted.fromDate} to ${submitted.toDate}`],
      ['Vehicle Filter', submitted.vehicleFilter === 'all' ? 'All Vehicles' : vehicles.find(v => v.id === submitted.vehicleFilter)?.vehicleNumber],
      ['Total KM', totalKm],
      ['Total Fuel (L)', totalLit.toFixed(2)],
      ['Total Fuel Cost', totalCost.toFixed(2)],
      ['Avg Fleet Mileage (km/L)', avgMileage],
      ['Low Mileage Vehicles', lowCount],
    ]
    const detailHeaders = ['Vehicle', 'Make/Model', 'Trips', 'KM Run', 'Refuels', 'Litres', 'Fuel Cost', 'Actual km/L', 'Expected km/L', 'Threshold', 'Variance %', 'Status']
    const detailRows = perVehicle.map(p => [
      p.vehicleNumber, `${p.make || ''} ${p.model || ''}`.trim(),
      p.trips, p.km, p.refuels, p.litres.toFixed(2), p.cost.toFixed(2),
      p.mileage !== null ? p.mileage.toFixed(2) : 'Insufficient Data',
      p.expectedMileage, p.threshold,
      p.variance !== null ? p.variance.toFixed(1) + '%' : '-',
      p.lowMileage ? 'LOW MILEAGE' : (p.mileage !== null ? 'OK' : 'N/A'),
    ])
    await exportXlsx(`CKC-Mileage-Report-${submitted.fromDate}_to_${submitted.toDate}.xlsx`, [
      { name: 'Summary', headers: ['Metric', 'Value'], rows: summaryRows },
      { name: 'Per-Vehicle Mileage', headers: detailHeaders, rows: detailRows },
    ])
    toast.success('Excel downloaded')
  }

  const generatePDF = async () => {
    setGenerating(true)
    try {
      const { jsPDF } = await import('jspdf')
      const autoTable = (await import('jspdf-autotable')).default
      const doc = new jsPDF({ unit: 'pt', format: 'a4' })
      const pageW = doc.internal.pageSize.getWidth()
      const now = new Date()
      const rangeStr = submitted.fromDate === submitted.toDate ? new Date(submitted.fromDate).toLocaleDateString('en-IN') : `${new Date(submitted.fromDate).toLocaleDateString('en-IN')} — ${new Date(submitted.toDate).toLocaleDateString('en-IN')}`
      const vehLabel = submitted.vehicleFilter === 'all' ? 'All Vehicles' : vehicles.find(v => v.id === submitted.vehicleFilter)?.vehicleNumber

      let logoDataUrl = null
      try {
        const res = await fetch('/ckc-logo-pdf.png')
        const blob = await res.blob()
        logoDataUrl = await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob) })
      } catch {}

      doc.setFillColor(58, 6, 6); doc.rect(0, 0, pageW, 110, 'F')
      doc.setDrawColor(217, 119, 6); doc.setLineWidth(1.5); doc.line(0, 108, pageW, 108)
      if (logoDataUrl) {
        doc.setFillColor(255, 255, 255); doc.circle(60, 55, 32, 'F')
        doc.addImage(logoDataUrl, 'PNG', 32, 27, 56, 56)
      }
      const brandX = 108
      doc.setTextColor(255, 255, 255); doc.setFont('times', 'bold'); doc.setFontSize(22)
      doc.text('C. Krishniah Chetty', brandX, 46)
      const w1 = doc.getTextWidth('C. Krishniah Chetty')
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8)
      doc.text('TM', brandX + w1 + 3, 34)
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(252, 211, 77)
      doc.text('G R O U P    O F    J E W E L L E R S', brandX, 62)
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(255, 255, 255)
      doc.text('FleetPulse — Mileage Report', brandX, 86)
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(252, 211, 77)
      doc.text(`Period:  ${rangeStr}`, pageW - 30, 36, { align: 'right' })
      doc.text(`Vehicle: ${vehLabel}`, pageW - 30, 50, { align: 'right' })
      doc.text(`Generated: ${now.toLocaleString('en-IN')}`, pageW - 30, 64, { align: 'right' })
      doc.setTextColor(255, 255, 255); doc.setFontSize(7)
      doc.text('EST. 1869  ·  HERITAGE JEWELLERS', pageW - 30, 86, { align: 'right' })

      doc.setTextColor(15, 23, 42)
      let y = 135

      doc.setFontSize(13); doc.setFont('helvetica', 'bold')
      doc.text('Fleet Mileage Summary', 30, y); y += 8
      doc.setDrawColor(217, 119, 6); doc.setLineWidth(2); doc.line(30, y, 130, y); y += 15
      autoTable(doc, {
        startY: y,
        head: [['Metric', 'Value']],
        body: [
          ['Total KM Travelled', totalKm.toLocaleString('en-IN') + ' km'],
          ['Total Fuel Consumed', totalLit.toFixed(2) + ' L'],
          ['Total Fuel Cost', 'Rs. ' + totalCost.toLocaleString('en-IN')],
          ['Average Fleet Mileage', avgMileage + ' km/L'],
          ['Vehicles Below Threshold', lowCount],
        ],
        theme: 'grid', headStyles: { fillColor: [139, 20, 20], textColor: 255 },
        styles: { fontSize: 10 }, margin: { left: 30, right: 30 },
      })
      y = doc.lastAutoTable.finalY + 20

      if (y > 620) { doc.addPage(); y = 40 }
      doc.setFontSize(13); doc.setFont('helvetica', 'bold')
      doc.text('Per-Vehicle Mileage', 30, y); y += 12

      autoTable(doc, {
        startY: y,
        head: [['Vehicle', 'Trips', 'KM', 'Litres', 'Actual', 'Expected', 'Variance', 'Status']],
        body: perVehicle.map(p => [
          p.vehicleNumber, p.trips, p.km, p.litres.toFixed(1),
          p.mileage !== null ? p.mileage.toFixed(2) : 'N/A',
          p.expectedMileage,
          p.variance !== null ? p.variance.toFixed(1) + '%' : '-',
          p.lowMileage ? 'LOW' : (p.mileage !== null ? 'OK' : 'N/A'),
        ]),
        theme: 'striped', headStyles: { fillColor: [139, 20, 20] },
        styles: { fontSize: 9 }, margin: { left: 30, right: 30 },
        didParseCell: (h) => {
          if (h.section === 'body' && h.column.index === 7 && h.cell.raw === 'LOW') {
            h.cell.styles.textColor = [220, 38, 38]; h.cell.styles.fontStyle = 'bold'
          }
        },
      })
      y = doc.lastAutoTable.finalY + 20

      const lowVehicles = perVehicle.filter(p => p.lowMileage)
      if (lowVehicles.length > 0) {
        if (y > 680) { doc.addPage(); y = 40 }
        doc.setFontSize(13); doc.setFont('helvetica', 'bold'); doc.setTextColor(220, 38, 38)
        doc.text('Low Mileage Investigation Required', 30, y); y += 12
        doc.setTextColor(15, 23, 42)
        autoTable(doc, {
          startY: y,
          head: [['Vehicle', 'Expected km/L', 'Threshold', 'Actual km/L', 'Variance', 'Fuel Wastage Est.']],
          body: lowVehicles.map(p => {
            const wastedLit = p.mileage ? (p.km / p.threshold) - p.litres : 0
            return [
              p.vehicleNumber, p.expectedMileage, p.threshold,
              p.mileage.toFixed(2),
              p.variance.toFixed(1) + '%',
              wastedLit > 0 ? wastedLit.toFixed(1) + ' L extra' : '-',
            ]
          }),
          theme: 'grid', headStyles: { fillColor: [220, 38, 38] },
          styles: { fontSize: 9 }, margin: { left: 30, right: 30 },
        })
      }

      const pageCount = doc.internal.getNumberOfPages()
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        const pageH = doc.internal.pageSize.getHeight()
        doc.setDrawColor(217, 119, 6); doc.setLineWidth(0.5); doc.line(30, pageH - 32, pageW - 30, pageH - 32)
        doc.setFontSize(8); doc.setTextColor(120); doc.setFont('helvetica', 'normal')
        doc.text('C. Krishniah Chetty (TM) Group of Jewellers  ·  Fleet Management System  ·  Confidential', 30, pageH - 20)
        doc.text(`Page ${i} of ${pageCount}`, pageW - 30, pageH - 20, { align: 'right' })
      }

      doc.save(`CKC-Mileage-Report-${submitted.fromDate}_to_${submitted.toDate}.pdf`)
      toast.success('PDF generated')
    } catch (e) { console.error(e); toast.error('PDF failed: ' + e.message) }
    finally { setGenerating(false) }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="text-3xl font-bold text-slate-900 relative inline-block">Mileage Analytics<span className="absolute -bottom-1 left-0 w-16 h-1 bg-gradient-to-r from-[#7a0d0d] to-amber-500 rounded-full" /></h1><p className="text-slate-500 mt-2">Select a date range and generate the mileage analysis.</p></div>
      </div>

      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <div>
              <Label className="text-xs text-slate-500 tracking-wider uppercase">From Date *</Label>
              <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} max={toDate || undefined} />
            </div>
            <div>
              <Label className="text-xs text-slate-500 tracking-wider uppercase">To Date *</Label>
              <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} min={fromDate || undefined} />
            </div>
            <div>
              <Label className="text-xs text-slate-500 tracking-wider uppercase">Vehicle</Label>
              <Select value={vehicleFilter} onValueChange={setVehicleFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Vehicles</SelectItem>
                  {vehicles.map(v => <SelectItem key={v.id} value={v.id}>{v.vehicleNumber}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={generate} className="h-10 bg-gradient-to-r from-[#7a0d0d] to-[#a01414] hover:brightness-110 text-white">
              <Gauge className="w-4 h-4 mr-2" /> Generate
            </Button>
          </div>

          {submitted && (
            <>
              <div className="flex gap-2">
                <Button onClick={generatePDF} disabled={generating} className="h-10 bg-gradient-to-r from-[#7a0d0d] to-[#a01414] hover:brightness-110 text-white">
                  <FileText className="w-4 h-4 mr-1" /> {generating ? '...' : 'PDF'}
                </Button>
                <Button onClick={exportExcel} className="h-10 bg-emerald-600 hover:bg-emerald-700 text-white">
                  <FileSpreadsheet className="w-4 h-4 mr-1" /> Excel
                </Button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-3 border-t">
                <div className="p-3 bg-red-50 border border-red-100 rounded-lg"><div className="text-xs text-slate-500">Total KM</div><div className="text-xl font-bold text-[#7a0d0d]">{totalKm.toLocaleString()}</div></div>
                <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg"><div className="text-xs text-slate-500">Fuel (L)</div><div className="text-xl font-bold text-amber-700">{totalLit.toFixed(1)}</div></div>
                <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg"><div className="text-xs text-slate-500">Fuel Cost</div><div className="text-xl font-bold text-amber-700">{fmtINR(totalCost)}</div></div>
                <div className="p-3 bg-slate-50 rounded-lg"><div className="text-xs text-slate-500">Avg Mileage</div><div className="text-xl font-bold">{avgMileage}<span className="text-sm text-slate-500 ml-1">km/L</span></div></div>
                <div className={`p-3 rounded-lg border ${lowCount > 0 ? 'bg-rose-50 border-rose-200' : 'bg-slate-50 border-slate-100'}`}><div className="text-xs text-slate-500">Low Mileage</div><div className={`text-xl font-bold ${lowCount > 0 ? 'text-rose-600' : ''}`}>{lowCount}</div></div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {submitted && (
        <Card><CardContent className="p-4"><div className="overflow-x-auto"><Table>
          <TableHeader><TableRow>
            <TableHead>Vehicle</TableHead><TableHead>Trips</TableHead><TableHead>KM</TableHead>
            <TableHead>Litres</TableHead><TableHead>Fuel Cost</TableHead>
            <TableHead>Actual km/L</TableHead><TableHead>Expected</TableHead><TableHead>Variance</TableHead>
            <TableHead>Status</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {perVehicle.map(v => (
              <TableRow key={v.id}>
                <TableCell className="font-semibold">{v.vehicleNumber}</TableCell>
                <TableCell>{v.trips}</TableCell>
                <TableCell>{v.km.toLocaleString()}</TableCell>
                <TableCell>{v.litres.toFixed(1)}</TableCell>
                <TableCell>{fmtINR(v.cost)}</TableCell>
                <TableCell className={v.lowMileage ? 'text-rose-600 font-bold' : 'font-semibold'}>
                  {v.mileage !== null ? v.mileage.toFixed(2) : <span className="text-slate-400 text-xs italic">Insufficient Data</span>}
                </TableCell>
                <TableCell>{v.expectedMileage}</TableCell>
                <TableCell className={v.variance !== null ? (v.variance < 0 ? 'text-rose-600' : 'text-emerald-600') : ''}>
                  {v.variance !== null ? `${v.variance.toFixed(1)}%` : '-'}
                </TableCell>
                <TableCell>
                  {v.lowMileage ? <Badge variant="destructive">Low Mileage</Badge> :
                    v.mileage !== null ? <Badge className="bg-emerald-500 hover:bg-emerald-600">OK</Badge> :
                    <Badge variant="secondary">N/A</Badge>}
                </TableCell>
              </TableRow>
            ))}
            {perVehicle.length === 0 && (
              <TableRow><TableCell colSpan={9} className="text-center text-slate-500 py-8">No data for selected filters.</TableCell></TableRow>
            )}
          </TableBody>
        </Table></div></CardContent></Card>
      )}
      {!submitted && (
        <Card><CardContent className="p-10 text-center text-slate-400">Select a date range and click Generate to view mileage analytics.</CardContent></Card>
      )}
    </div>
  )
}

function Reports() {
  const [data, setData] = useState(null)
  const [trips, setTrips] = useState([])
  const [fuel, setFuel] = useState([])
  const [vehicles, setVehicles] = useState([])
  const [generating, setGenerating] = useState(false)
  const today = new Date().toISOString().slice(0, 10)
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [preset, setPreset] = useState('')
  const [vehicleFilter, setVehicleFilter] = useState('all')
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    api('dashboard').then(setData)
    api('trips').then(setTrips)
    api('fuel').then(setFuel)
    api('vehicles').then(setVehicles)
  }, [])
  if (!data) return <div className="p-8">Loading...</div>

  const applyPreset = (p) => {
    setPreset(p)
    setSubmitted(false)
    const now = new Date()
    if (p === 'daily') { setFromDate(today); setToDate(today) }
    else if (p === 'weekly') { setFromDate(new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10)); setToDate(today) }
    else if (p === 'monthly') { setFromDate(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)); setToDate(today) }
    else if (p === 'annually') { setFromDate(new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10)); setToDate(today) }
  }

  const handleFromDate = (v) => { setFromDate(v); setPreset('custom'); setSubmitted(false) }
  const handleToDate = (v) => { setToDate(v); setPreset('custom'); setSubmitted(false) }
  const handleVehicleFilter = (v) => { setVehicleFilter(v); setSubmitted(false) }

  const handleGenerate = () => {
    if (!fromDate || !toDate) return toast.error('Please select both From Date and To Date')
    if (fromDate > toDate) return toast.error('From Date cannot be after To Date')
    setSubmitted(true)
  }

  const filteredTrips = !submitted ? [] : trips.filter(t => {
    const d = t.dateOut?.slice(0, 10)
    if (d < fromDate || d > toDate) return false
    if (vehicleFilter !== 'all' && t.vehicleId !== vehicleFilter) return false
    return true
  })
  const filteredFuel = !submitted ? [] : fuel.filter(f => {
    const d = f.date?.slice(0, 10)
    if (d < fromDate || d > toDate) return false
    if (vehicleFilter !== 'all' && f.vehicleId !== vehicleFilter) return false
    return true
  })
  const kmTotal = filteredTrips.reduce((s, t) => s + (t.kmRun || 0), 0)
  const litTotal = filteredFuel.reduce((s, f) => s + f.quantity, 0)
  const costTotal = filteredFuel.reduce((s, f) => s + f.amount, 0)
  const avgMileage = litTotal > 0 ? (kmTotal / litTotal).toFixed(2) : 'N/A'
  const selectedVehicle = vehicles.find(v => v.id === vehicleFilter)

  // Build daily series for chart embedding
  const dailySeries = () => {
    const from = new Date(fromDate), to = new Date(toDate)
    const days = Math.min(31, Math.ceil((to - from) / 864e5) + 1)
    const start = days === 31 ? new Date(to.getTime() - 30 * 864e5) : from
    const arr = []
    for (let i = 0; i < days; i++) {
      const d = new Date(start.getTime() + i * 864e5)
      const ds = d.toISOString().slice(0, 10)
      const dt = filteredTrips.filter(t => t.dateOut?.slice(0, 10) === ds)
      const df = filteredFuel.filter(f => f.date?.slice(0, 10) === ds)
      arr.push({
        label: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
        trips: dt.length,
        km: dt.reduce((s, t) => s + (t.kmRun || 0), 0),
        cost: df.reduce((s, f) => s + f.amount, 0),
      })
    }
    return arr
  }

  const exportExcel = async () => {
    const tripHeaders = ['Trip ID', 'Date', 'Vehicle Type', 'Vehicle', 'Driver/Employee', 'Time Out', 'Time In', 'Odo Out', 'Odo In', 'KM Run', 'Destination', 'Status']
    const tripRows = filteredTrips.map(t => [t.tripId, fmtDate(t.dateOut), t.vehicleType || '-', t.vehicleNumber, t.driverName || t.employeeName || '-', fmtDT(t.dateOut), fmtDT(t.timeIn), t.odometerOut, t.odometerIn, t.kmRun, t.destination, t.status])
    const fuelHeaders = ['Date', 'Vehicle', 'Odometer', 'Quantity(L)', 'Rate', 'Amount', 'Station', 'Receipt']
    const fuelRows = filteredFuel.map(t => [fmtDate(t.date), t.vehicleNumber, t.odometer, t.quantity, t.rate, t.amount, t.station, t.receiptNumber])
    const summaryHeaders = ['Metric', 'Value']
    const summaryRows = [
      ['Period', `${fromDate} to ${toDate}`],
      ['Vehicle Filter', selectedVehicle ? selectedVehicle.vehicleNumber : 'All Vehicles'],
      ['Total Trips', filteredTrips.length],
      ['KM Travelled', kmTotal],
      ['Fuel Consumed (L)', litTotal.toFixed(2)],
      ['Fuel Cost (Rs.)', costTotal.toFixed(2)],
      ['Avg Mileage (km/L)', avgMileage],
    ]
    await exportXlsx(`CKC-Report-${fromDate}_to_${toDate}.xlsx`, [
      { name: 'Summary', headers: summaryHeaders, rows: summaryRows },
      { name: 'Trips', headers: tripHeaders, rows: tripRows },
      { name: 'Fuel', headers: fuelHeaders, rows: fuelRows },
    ])
    toast.success('Excel downloaded')
  }

  const drawChart = (doc, x, y, w, h, series) => {
    doc.setDrawColor(220); doc.setLineWidth(0.5)
    doc.rect(x, y, w, h)
    if (series.length === 0) {
      doc.setFontSize(10); doc.setTextColor(150)
      doc.text('No data in selected range', x + w / 2, y + h / 2, { align: 'center' })
      return
    }
    const pad = { l: 40, r: 40, t: 15, b: 25 }
    const cw = w - pad.l - pad.r, ch = h - pad.t - pad.b
    const maxTrips = Math.max(...series.map(d => d.trips), 1)
    const maxCost = Math.max(...series.map(d => d.cost), 1)
    doc.setDrawColor(240)
    for (let i = 1; i <= 4; i++) {
      const yy = y + pad.t + (ch * i) / 5
      doc.line(x + pad.l, yy, x + pad.l + cw, yy)
    }
    const barW = cw / series.length * 0.35
    series.forEach((d, i) => {
      const groupX = x + pad.l + (cw / series.length) * i + (cw / series.length) * 0.15
      const th = (d.trips / maxTrips) * ch
      doc.setFillColor(139, 20, 20)
      doc.rect(groupX, y + pad.t + ch - th, barW, th, 'F')
      const fh = (d.cost / maxCost) * ch
      doc.setFillColor(217, 119, 6)
      doc.rect(groupX + barW + 2, y + pad.t + ch - fh, barW, fh, 'F')
    })
    doc.setFontSize(6); doc.setTextColor(80)
    const step = Math.max(1, Math.ceil(series.length / 10))
    series.forEach((d, i) => {
      if (i % step === 0) {
        const gx = x + pad.l + (cw / series.length) * i + (cw / series.length) * 0.5
        doc.text(d.label, gx, y + h - 12, { align: 'center' })
      }
    })
    doc.setFontSize(7); doc.setTextColor(139, 20, 20)
    doc.text(`Max Trips: ${maxTrips}`, x + 4, y + pad.t + 8)
    doc.setTextColor(217, 119, 6)
    doc.text(`Max Cost: Rs.${Math.round(maxCost).toLocaleString('en-IN')}`, x + w - 4, y + pad.t + 8, { align: 'right' })
    doc.setFillColor(139, 20, 20); doc.rect(x + pad.l, y + h - 6, 8, 4, 'F')
    doc.setFontSize(7); doc.setTextColor(60); doc.text('Trips', x + pad.l + 12, y + h - 3)
    doc.setFillColor(217, 119, 6); doc.rect(x + pad.l + 42, y + h - 6, 8, 4, 'F')
    doc.text('Fuel Cost', x + pad.l + 54, y + h - 3)
  }

  const generatePDF = async () => {
    setGenerating(true)
    try {
      const { jsPDF } = await import('jspdf')
      const autoTable = (await import('jspdf-autotable')).default
      const doc = new jsPDF({ unit: 'pt', format: 'a4' })
      const pageW = doc.internal.pageSize.getWidth()
      const now = new Date()
      const titleMap = { daily: 'Daily Report', weekly: 'Weekly Report', monthly: 'Monthly Report', annually: 'Annual Report', custom: 'Custom Report' }
      const title = titleMap[preset] || 'Custom Report'
      const rangeStr = fromDate === toDate ? new Date(fromDate).toLocaleDateString('en-IN') : `${new Date(fromDate).toLocaleDateString('en-IN')} — ${new Date(toDate).toLocaleDateString('en-IN')}`

      let logoDataUrl = null
      try {
        const res = await fetch('/ckc-logo-pdf.png')
        const blob = await res.blob()
        logoDataUrl = await new Promise((resolve) => { const fr = new FileReader(); fr.onload = () => resolve(fr.result); fr.readAsDataURL(blob) })
      } catch {}

      doc.setFillColor(58, 6, 6); doc.rect(0, 0, pageW, 110, 'F')
      doc.setDrawColor(217, 119, 6); doc.setLineWidth(1.5); doc.line(0, 108, pageW, 108)
      if (logoDataUrl) {
        doc.setFillColor(255, 255, 255); doc.circle(60, 55, 32, 'F')
        doc.addImage(logoDataUrl, 'PNG', 32, 27, 56, 56)
      }
      const brandX = 108
      doc.setTextColor(255, 255, 255); doc.setFont('times', 'bold'); doc.setFontSize(22)
      doc.text('C. Krishniah Chetty', brandX, 46)
      const w1 = doc.getTextWidth('C. Krishniah Chetty')
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8)
      doc.text('TM', brandX + w1 + 3, 34)
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(252, 211, 77)
      doc.text('G R O U P    O F    J E W E L L E R S', brandX, 62)
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(255, 255, 255)
      doc.text('FleetPulse — ' + title, brandX, 86)
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(252, 211, 77)
      doc.text(`Period:  ${rangeStr}`, pageW - 30, 36, { align: 'right' })
      doc.text(`Vehicle: ${selectedVehicle ? selectedVehicle.vehicleNumber : 'All Vehicles'}`, pageW - 30, 50, { align: 'right' })
      doc.text(`Generated: ${now.toLocaleString('en-IN')}`, pageW - 30, 64, { align: 'right' })
      doc.setTextColor(255, 255, 255); doc.setFontSize(7)
      doc.text('EST. 1869  ·  HERITAGE JEWELLERS', pageW - 30, 86, { align: 'right' })

      doc.setTextColor(15, 23, 42)
      let y = 135

      doc.setFontSize(13); doc.setFont('helvetica', 'bold')
      doc.text('Summary', 30, y); y += 8
      doc.setDrawColor(217, 119, 6); doc.setLineWidth(2); doc.line(30, y, 90, y); y += 15
      autoTable(doc, {
        startY: y,
        head: [['Metric', 'Value']],
        body: [
          ['Total Trips', filteredTrips.length],
          ['KM Travelled', kmTotal.toLocaleString('en-IN') + ' km'],
          ['Fuel Consumed', litTotal.toFixed(2) + ' L'],
          ['Fuel Cost', 'Rs. ' + costTotal.toLocaleString('en-IN')],
          ['Avg Mileage', avgMileage + ' km/L'],
        ],
        theme: 'grid', headStyles: { fillColor: [139, 20, 20], textColor: 255 },
        styles: { fontSize: 10 }, margin: { left: 30, right: 30 },
      })
      y = doc.lastAutoTable.finalY + 20

      if (y > 550) { doc.addPage(); y = 40 }
      doc.setFontSize(13); doc.setFont('helvetica', 'bold')
      doc.text('Daily Activity Chart', 30, y); y += 8
      doc.setDrawColor(217, 119, 6); doc.line(30, y, 130, y); y += 8
      drawChart(doc, 30, y, pageW - 60, 180, dailySeries())
      y += 190

      if (filteredTrips.length) {
        if (y > 700) { doc.addPage(); y = 40 }
        doc.setFontSize(13); doc.setFont('helvetica', 'bold'); doc.setTextColor(15, 23, 42)
        doc.text('Vehicle Movements', 30, y); y += 12
        autoTable(doc, {
          startY: y,
          head: [['Trip ID', 'Type', 'Vehicle', 'Driver/Employee', 'Out', 'In', 'KM', 'Destination']],
          body: filteredTrips.slice(0, 200).map(t => [
            t.tripId, t.vehicleType || '-', t.vehicleNumber, t.driverName || t.employeeName || '-',
            new Date(t.dateOut).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }),
            t.timeIn ? new Date(t.timeIn).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-',
            t.kmRun || '-', t.destination || '-',
          ]),
          theme: 'striped', headStyles: { fillColor: [139, 20, 20] },
          styles: { fontSize: 8 }, margin: { left: 30, right: 30 },
        })
        y = doc.lastAutoTable.finalY + 25
      }

      if (filteredFuel.length) {
        if (y > 700) { doc.addPage(); y = 40 }
        doc.setFontSize(13); doc.setFont('helvetica', 'bold')
        doc.text('Fuel Entries', 30, y); y += 12
        autoTable(doc, {
          startY: y,
          head: [['Date', 'Vehicle', 'Odometer', 'Qty (L)', 'Rate', 'Amount', 'Station']],
          body: filteredFuel.slice(0, 200).map(f => [
            new Date(f.date).toLocaleDateString('en-IN'),
            f.vehicleNumber, f.odometer?.toLocaleString() || '-',
            f.quantity, 'Rs. ' + f.rate,
            'Rs. ' + f.amount.toLocaleString('en-IN'),
            f.station || '-',
          ]),
          theme: 'striped', headStyles: { fillColor: [217, 119, 6] },
          styles: { fontSize: 8 }, margin: { left: 30, right: 30 },
        })
        y = doc.lastAutoTable.finalY + 25
      }

      if ((preset === 'monthly' || preset === 'annually') && data.alerts.lowMileage.length) {
        if (y > 680) { doc.addPage(); y = 40 }
        doc.setFontSize(13); doc.setFont('helvetica', 'bold'); doc.setTextColor(220, 38, 38)
        doc.text('Low Mileage Alerts', 30, y); y += 12
        doc.setTextColor(15, 23, 42)
        autoTable(doc, {
          startY: y,
          head: [['Vehicle', 'Expected km/L', 'Threshold', 'Actual km/L', 'Variance']],
          body: data.alerts.lowMileage.map(v => [
            v.vehicleNumber, v.expectedMileage, v.threshold,
            v.actualMileage.toFixed(2),
            ((v.actualMileage - v.expectedMileage) / v.expectedMileage * 100).toFixed(1) + '%',
          ]),
          theme: 'grid', headStyles: { fillColor: [220, 38, 38] },
          styles: { fontSize: 9 }, margin: { left: 30, right: 30 },
        })
      }

      const pageCount = doc.internal.getNumberOfPages()
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        const pageH = doc.internal.pageSize.getHeight()
        doc.setDrawColor(217, 119, 6); doc.setLineWidth(0.5)
        doc.line(30, pageH - 32, pageW - 30, pageH - 32)
        doc.setFontSize(8); doc.setTextColor(120); doc.setFont('helvetica', 'normal')
        doc.text('C. Krishniah Chetty (TM) Group of Jewellers  ·  Fleet Management System  ·  Confidential', 30, pageH - 20)
        doc.text(`Page ${i} of ${pageCount}`, pageW - 30, pageH - 20, { align: 'right' })
      }
      doc.save(`CKC-${title.replace(/\s+/g, '-')}-${fromDate}_to_${toDate}.pdf`)
      toast.success('PDF generated')
    } catch (e) { console.error(e); toast.error('PDF failed: ' + e.message) }
    finally { setGenerating(false) }
  }

  const presets = [
    { id: 'daily', label: 'Daily' }, { id: 'weekly', label: 'Weekly' },
    { id: 'monthly', label: 'Monthly' }, { id: 'annually', label: 'Annually' },
  ]

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 relative inline-block">Reports<span className="absolute -bottom-1 left-0 w-16 h-1 bg-gradient-to-r from-[#7a0d0d] to-amber-500 rounded-full" /></h1>
        <p className="text-slate-500 mt-2">Select a date range and generate branded PDF & Excel reports.</p>
      </div>
      <Card>
        <CardContent className="p-6 space-y-5">
          <div className="flex flex-wrap gap-2">
            {presets.map(p => (
              <button key={p.id} onClick={() => applyPreset(p.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition border ${preset === p.id ? 'bg-[#7a0d0d] text-white border-[#7a0d0d]' : 'bg-white text-slate-700 border-slate-200 hover:border-red-300'}`}>
                {p.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label className="text-xs text-slate-500 tracking-wider uppercase">From Date *</Label>
              <Input type="date" value={fromDate} onChange={e => handleFromDate(e.target.value)} max={toDate || today} />
            </div>
            <div>
              <Label className="text-xs text-slate-500 tracking-wider uppercase">To Date *</Label>
              <Input type="date" value={toDate} onChange={e => handleToDate(e.target.value)} min={fromDate} max={today} />
            </div>
            <div>
              <Label className="text-xs text-slate-500 tracking-wider uppercase">Vehicle</Label>
              <Select value={vehicleFilter} onValueChange={handleVehicleFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Vehicles</SelectItem>
                  {vehicles.map(v => <SelectItem key={v.id} value={v.id}>{v.vehicleNumber}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={handleGenerate} className="w-full h-10 bg-gradient-to-r from-[#7a0d0d] to-[#a01414] hover:brightness-110 text-white">
                <ClipboardList className="w-4 h-4 mr-1" /> Generate Report
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {submitted && (
        <Card className="border-2 border-amber-300/60">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Report — {fromDate === toDate ? fmtDate(fromDate) : `${fmtDate(fromDate)} to ${fmtDate(toDate)}`}</span>
              <span className="text-sm font-normal text-slate-500">{selectedVehicle ? selectedVehicle.vehicleNumber : 'All Vehicles'}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="p-3 bg-red-50 border border-red-100 rounded-lg"><div className="text-xs text-slate-500">Trips</div><div className="text-xl font-bold text-[#7a0d0d]">{filteredTrips.length}</div></div>
              <div className="p-3 bg-red-50 border border-red-100 rounded-lg"><div className="text-xs text-slate-500">KM Travelled</div><div className="text-xl font-bold text-[#7a0d0d]">{kmTotal.toLocaleString()}</div></div>
              <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg"><div className="text-xs text-slate-500">Fuel (L)</div><div className="text-xl font-bold text-amber-700">{litTotal.toFixed(1)}</div></div>
              <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg"><div className="text-xs text-slate-500">Fuel Cost</div><div className="text-xl font-bold text-amber-700">{fmtINR(costTotal)}</div></div>
              <div className="p-3 bg-slate-50 rounded-lg"><div className="text-xs text-slate-500">Avg Mileage</div><div className="text-xl font-bold">{avgMileage}<span className="text-sm text-slate-500 ml-1">km/L</span></div></div>
            </div>

            {filteredTrips.length === 0 && filteredFuel.length === 0 && (
              <div className="text-sm text-slate-500 text-center py-4">No trips or fuel entries found for this range.</div>
            )}

            <div className="flex gap-2">
              <Button onClick={generatePDF} disabled={generating} className="flex-1 h-10 bg-gradient-to-r from-[#7a0d0d] to-[#a01414] hover:brightness-110 text-white">
                <FileText className="w-4 h-4 mr-1" /> {generating ? 'Generating...' : 'Download PDF'}
              </Button>
              <Button onClick={exportExcel} className="flex-1 h-10 bg-emerald-600 hover:bg-emerald-700 text-white">
                <FileSpreadsheet className="w-4 h-4 mr-1" /> Download Excel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
function LiveTracking() {
  const [trips, setTrips] = useState([])
  const [selectedTrip, setSelectedTrip] = useState(null)
  const mapRef = useRef(null)
  const leafletMapRef = useRef(null)
  const markersRef = useRef({})

  const load = () => api('trips/outside').then(setTrips).catch(() => {})

  useEffect(() => {
    load()
    const iv = setInterval(load, 12000)
    return () => clearInterval(iv)
  }, [])

  const initMap = () => {
    if (leafletMapRef.current || !mapRef.current || !window.L) return
    const L = window.L
    const map = L.map(mapRef.current).setView([12.9716, 77.5946], 11)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map)
    leafletMapRef.current = map
  }

  useEffect(() => {
    if (window.L) { initMap(); return }
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
    document.head.appendChild(link)
    const script = document.createElement('script')
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
    script.onload = initMap
    document.body.appendChild(script)
    return () => { leafletMapRef.current?.remove(); leafletMapRef.current = null }
  }, [])

  useEffect(() => {
    if (!leafletMapRef.current || !window.L) return
    const L = window.L
    const map = leafletMapRef.current
    const tracked = trips.filter(t => t.lastLat && t.lastLng)

    Object.keys(markersRef.current).forEach(id => {
      if (!tracked.find(t => t.id === id)) {
        map.removeLayer(markersRef.current[id])
        delete markersRef.current[id]
      }
    })

    tracked.forEach(t => {
      const pos = [t.lastLat, t.lastLng]
      if (markersRef.current[t.id]) {
        markersRef.current[t.id].setLatLng(pos)
      } else {
        const icon = L.divIcon({
          className: '',
          html: `<div style="background:#7a0d0d;color:white;padding:4px 8px;border-radius:6px;font-size:11px;font-weight:600;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.3)">${t.vehicleNumber}</div>`,
          iconSize: [0, 0],
        })
        markersRef.current[t.id] = L.marker(pos, { icon }).addTo(map)
          .on('click', () => setSelectedTrip(t))
      }
    })

    if (tracked.length > 0) {
      const bounds = L.latLngBounds(tracked.map(t => [t.lastLat, t.lastLng]))
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 })
    }
  }, [trips])

  const trackedCount = trips.filter(t => t.lastLat && t.lastLng).length

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 relative inline-block">Track Vehicle
          <span className="absolute -bottom-1 left-0 w-16 h-1 bg-gradient-to-r from-[#7a0d0d] to-amber-500 rounded-full" />
        </h1>
        <p className="text-slate-500 mt-2">Vehicles currently outside, sharing location from the security app.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card><CardContent className="p-4"><div className="text-xs text-slate-500">Outside Now</div><div className="text-2xl font-bold text-[#7a0d0d]">{trips.length}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-slate-500">Sharing Location</div><div className="text-2xl font-bold text-emerald-600">{trackedCount}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-slate-500">Not Sharing</div><div className="text-2xl font-bold text-slate-400">{trips.length - trackedCount}</div></CardContent></Card>
      </div>

      <Card><CardContent className="p-0 overflow-hidden rounded-lg">
        <div ref={mapRef} style={{ height: '480px', width: '100%' }} />
      </CardContent></Card>

      <Card>
        <CardHeader><CardTitle>Outside Vehicles</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto"><Table>
            <TableHeader><TableRow>
              <TableHead>Vehicle</TableHead><TableHead>Driver</TableHead><TableHead>Destination</TableHead>
              <TableHead>Out Since</TableHead><TableHead>Location Status</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {trips.map(t => (
                <TableRow key={t.id} className={selectedTrip?.id === t.id ? 'bg-amber-50' : ''}>
                  <TableCell className="font-semibold">{t.vehicleNumber}</TableCell>
                  <TableCell>{t.driverName || t.employeeName || '-'}</TableCell>
                  <TableCell>{t.destination}</TableCell>
                  <TableCell className="text-xs">{fmtDT(t.dateOut)}</TableCell>
                  <TableCell>
                    {t.lastLat ? (
                      <Badge className="bg-emerald-500 hover:bg-emerald-600">
                        Live · {t.lastLocationAt ? new Date(t.lastLocationAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : ''}
                      </Badge>
                    ) : <Badge variant="secondary">Not sharing</Badge>}
                  </TableCell>
                  <TableCell className="text-right">
                    {t.lastLat && (
                      <Button size="sm" variant="outline" onClick={() => {
                        setSelectedTrip(t)
                        leafletMapRef.current?.setView([t.lastLat, t.lastLng], 15)
                      }}>Locate</Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {trips.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-slate-500 py-8">No vehicles currently outside.</TableCell></TableRow>
              )}
            </TableBody>
          </Table></div>
        </CardContent>
      </Card>
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
    <div className="min-h-screen bg-gradient-to-br from-[#3d0808] via-[#5c0a0a] to-[#2d0505] text-white">
      <header className="p-4 flex items-center justify-between border-b border-red-900/50 bg-black/20 backdrop-blur">
        <div className="flex items-center gap-2">
          {screen !== 'home' && <Button variant="ghost" size="sm" onClick={() => setScreen('home')} className="text-white hover:bg-white/10"><ArrowLeft className="w-4 h-4" /></Button>}
          <img src="/ckc-logo.png" alt="CKC" className="w-9 h-9 object-contain" />
          <div>
            <div className="font-semibold text-sm leading-none whitespace-nowrap text-white" style={{fontFamily: '"Times New Roman", Georgia, serif'}}>C. Krishniah Chetty</div>
            <div className="text-[9px] tracking-[0.25em] text-amber-200/60 mt-0.5">FLEETPULSE · SECURITY</div>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onLogout} className="text-white hover:bg-white/10"><LogOut className="w-4 h-4" /></Button>
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
  const [f, setF] = useState({ vehicleType: 'Four Wheeler', vehicleId: '', driverId: '', employeeName: '', odometerOut: '', destination: '', purpose: '', passengerCount: 1, remarks: '' })
  useEffect(() => {
    api('vehicles').then(vs => setVehicles(vs.filter(v => v.status === 'Available')))
    api('drivers').then(setDrivers)
  }, [])

  const filteredVehicles = vehicles.filter(v =>
    f.vehicleType === 'Two Wheeler' ? v.type === 'Two Wheeler' : v.type !== 'Two Wheeler'
  )

  const selectedVehicle = vehicles.find(v => v.id === f.vehicleId)
  useEffect(() => {
    if (selectedVehicle) setF(x => ({ ...x, odometerOut: selectedVehicle.currentOdometer, driverId: selectedVehicle.assignedDriverId || x.driverId }))
  }, [f.vehicleId, selectedVehicle])

  const setVehicleType = (type) => {
    setF(x => ({ ...x, vehicleType: type, vehicleId: '', driverId: '', employeeName: '' }))
  }

  const set = (k, v) => setF(x => ({ ...x, [k]: v }))

  const submit = async () => {
    if (!f.vehicleId || !f.odometerOut || !f.destination) return toast.error('Fill required fields')
    if (f.vehicleType === 'Two Wheeler' && !f.employeeName) return toast.error('Employee Name is required for two-wheelers')
    if (f.vehicleType === 'Four Wheeler' && !f.driverId) return toast.error('Driver is required for four-wheelers')
    try {
      const r = await apiOffline('trips/out', f)
      toast.success(r.queued ? 'Saved offline — will sync' : 'Vehicle OUT recorded')
      onDone()
    } catch (e) { toast.error(e.message) }
  }

  return (
    <div className="p-4 max-w-md mx-auto space-y-3 text-slate-900">
      <div className="bg-white rounded-xl p-4 space-y-3">
        <h2 className="text-lg font-bold text-emerald-600">Vehicle OUT Entry</h2>

        <div><Label>Vehicle Type *</Label>
          <Select value={f.vehicleType} onValueChange={setVehicleType}>
            <SelectTrigger><SelectValue placeholder="Select vehicle type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Two Wheeler">Two Wheeler</SelectItem>
              <SelectItem value="Four Wheeler">Four Wheeler</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div><Label>Vehicle *</Label>
          <Select value={f.vehicleId} onValueChange={v => set('vehicleId', v)}>
            <SelectTrigger><SelectValue placeholder="Select vehicle" /></SelectTrigger>
            <SelectContent>{filteredVehicles.map(v => <SelectItem key={v.id} value={v.id}>{v.vehicleNumber} - {v.make} {v.model}</SelectItem>)}</SelectContent>
          </Select>
        </div>

        {f.vehicleType === 'Four Wheeler' && (
          <div><Label>Driver *</Label>
            <Select value={f.driverId} onValueChange={v => set('driverId', v)}>
              <SelectTrigger><SelectValue placeholder="Select driver" /></SelectTrigger>
              <SelectContent>{drivers.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        )}

        {f.vehicleType === 'Two Wheeler' && (
          <div><Label>Employee Name *</Label>
            <Input value={f.employeeName} onChange={e => set('employeeName', e.target.value)} placeholder="Enter Employee Name" />
          </div>
        )}

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
    try {
      const r = await apiOffline('trips/in', { tripId: selected.id, odometerIn: odoIn, remarks })
      toast.success(r.queued ? 'Saved offline — will sync' : `Vehicle IN. KM Run: ${r.kmRun}`)
      onDone()
    } catch (e) { toast.error(e.message) }
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
  const [f, setF] = useState({ vehicleId: '', odometer: '', quantity: '', rate: '', station: '', receiptNumber: '', remarks: '', receiptImage: null })
  const [uploading, setUploading] = useState(false)
  useEffect(() => { api('vehicles').then(setVehicles) }, [])
  const selectedVehicle = vehicles.find(v => v.id === f.vehicleId)
  useEffect(() => { if (selectedVehicle) setF(x => ({ ...x, odometer: selectedVehicle.currentOdometer })) }, [f.vehicleId, selectedVehicle])
  const set = (k, v) => setF(x => ({ ...x, [k]: v }))
  const amount = (Number(f.quantity) || 0) * (Number(f.rate) || 0)

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      // Resize to max 1024px width to keep base64 small
      const img = await new Promise((res, rej) => {
        const i = new Image()
        i.onload = () => res(i)
        i.onerror = rej
        i.src = URL.createObjectURL(file)
      })
      const maxW = 1024
      const scale = Math.min(1, maxW / img.width)
      const canvas = document.createElement('canvas')
      canvas.width = img.width * scale
      canvas.height = img.height * scale
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.75)
      set('receiptImage', dataUrl)
      toast.success('Receipt attached')
    } catch (err) { toast.error('Failed to load image') }
    finally { setUploading(false) }
  }

  const submit = async () => {
    if (!f.vehicleId || !f.quantity || !f.rate) return toast.error('Fill required fields')
    try {
      const r = await apiOffline('fuel', f)
      toast.success(r.queued ? 'Saved offline — will sync' : `Fuel entry saved. Amount: ${fmtINR(amount)}`)
      onDone()
    } catch (e) { toast.error(e.message) }
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
        <div>
          <Label>Receipt Photo</Label>
          {f.receiptImage ? (
            <div className="relative mt-1">
              <img src={f.receiptImage} alt="Receipt" className="w-full rounded-lg border" />
              <button onClick={() => set('receiptImage', null)} className="absolute top-2 right-2 bg-rose-600 text-white rounded-full w-8 h-8 flex items-center justify-center shadow-lg">
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="mt-1 grid grid-cols-2 gap-2">
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-lg p-4 cursor-pointer hover:bg-slate-50 active:bg-slate-100">
                <Camera className="w-7 h-7 text-slate-400 mb-1" />
                <div className="text-xs font-medium text-slate-700 text-center">{uploading ? 'Loading...' : 'Take Photo'}</div>
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />
              </label>
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-lg p-4 cursor-pointer hover:bg-slate-50 active:bg-slate-100">
                <ImageIcon className="w-7 h-7 text-slate-400 mb-1" />
                <div className="text-xs font-medium text-slate-700 text-center">{uploading ? 'Loading...' : 'Choose from Gallery'}</div>
                <input type="file" accept="image/*" className="hidden" onChange={handleFile} />
              </label>
            </div>
          )}
        </div>
        <div><Label>Remarks</Label><Textarea value={f.remarks} onChange={e => set('remarks', e.target.value)} /></div>
        <Button onClick={submit} className="w-full bg-amber-600 hover:bg-amber-700 h-12 text-lg">Save Fuel Entry</Button>
      </div>
    </div>
  )
}

function CurrentlyOutside() {
  const [trips, setTrips] = useState([])
  const [trackingId, setTrackingId] = useState(null)
  const [watchId, setWatchId] = useState(null)

  useEffect(() => { api('trips/outside').then(setTrips) }, [])

  const startTracking = (tripId) => {
    if (!navigator.geolocation) return toast.error('Location not supported on this device')
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        api('trips/location', { method: 'POST', body: { tripId, lat: pos.coords.latitude, lng: pos.coords.longitude } }).catch(() => {})
      },
      (err) => toast.error('Location error: ' + err.message),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
    )
    setWatchId(id)
    setTrackingId(tripId)
    toast.success('Sharing location — keep this screen open')
  }

  const stopTracking = () => {
    if (watchId !== null) navigator.geolocation.clearWatch(watchId)
    setWatchId(null)
    setTrackingId(null)
  }

  useEffect(() => {
    return () => { if (watchId !== null) navigator.geolocation.clearWatch(watchId) }
  }, [watchId])

  return (
    <div className="p-4 max-w-md mx-auto space-y-3 text-slate-900">
      <div className="bg-white rounded-xl p-4">
        <h2 className="text-lg font-bold mb-3">Currently Outside ({trips.length})</h2>
        {trips.length === 0 && <div className="p-6 text-center text-slate-500">No vehicles currently outside</div>}
        <div className="space-y-2">
          {trips.map(t => {
            const hrs = (Date.now() - new Date(t.dateOut).getTime()) / 3600000
            const overdue = hrs > 8
            const isTracking = trackingId === t.id
            return (
              <div key={t.id} className={`p-3 rounded-lg border ${overdue ? 'bg-rose-50 border-rose-300' : 'bg-slate-50'}`}>
                <div className="flex justify-between items-start"><div className="font-bold">{t.vehicleNumber}</div>{overdue && <Badge variant="destructive">OVERDUE</Badge>}</div>
                <div className="text-sm">{t.driverName}</div>
                <div className="text-xs text-slate-600">{t.destination}</div>
                <div className="text-xs text-slate-500">Out {hrs.toFixed(1)}h ago · {fmtDT(t.dateOut)}</div>
                <Button
                  size="sm"
                  onClick={() => isTracking ? stopTracking() : startTracking(t.id)}
                  className={`w-full mt-2 ${isTracking ? 'bg-rose-600 hover:bg-rose-700' : 'bg-blue-600 hover:bg-blue-700'} text-white`}
                >
                  {isTracking ? 'Stop Sharing Location' : 'Share My Location'}
                </Button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function OfflineBanner() {
  const [online, setOnline] = useState(true)
  const [pending, setPending] = useState(0)
  useEffect(() => {
    setOnline(navigator.onLine)
    setPending(getQueue().length)
    const on = () => { setOnline(true); flushQueue().then(() => setPending(getQueue().length)) }
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    const iv = setInterval(() => setPending(getQueue().length), 3000)
    if (navigator.onLine) flushQueue().then(() => setPending(getQueue().length))
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); clearInterval(iv) }
  }, [])
  if (online && pending === 0) return null
  return (
    <div className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] px-4 py-2 rounded-full shadow-lg flex items-center gap-2 text-sm font-medium ${online ? 'bg-amber-500 text-white' : 'bg-rose-600 text-white'}`}>
      {online ? <><Wifi className="w-4 h-4" /> Syncing {pending} offline entries…</> : <><WifiOff className="w-4 h-4" /> Offline · entries will sync when back online</>}
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
  if (!user) return <><Login onLogin={setUser} /><OfflineBanner /></>
  if (user.role === 'security') return <><SecurityHome user={user} onLogout={logout} /><OfflineBanner /></>

  // Store admins get the same shell, but only a subset of pages/tabs
  const allowedForStoreAdmin = ['dashboard', 'vehicles', 'trips', 'maintenance', 'tracking']
  const effectiveActive = user.role === 'store_admin' && !allowedForStoreAdmin.includes(active) ? 'dashboard' : active

  return (
    <>
    <AdminShell user={user} onLogout={logout} active={effectiveActive} setActive={setActive}>
      {effectiveActive === 'dashboard' && <Dashboard />}
      {effectiveActive === 'vehicles' && <Vehicles />}
      {effectiveActive === 'tracking' && <LiveTracking />}
      {effectiveActive === 'drivers' && <Drivers />}
      {effectiveActive === 'trips' && <Trips />}
      {effectiveActive === 'fuel' && <FuelRegister />}
      {effectiveActive === 'maintenance' && <Maintenance />}
      {effectiveActive === 'mileage' && <Mileage />}
           {effectiveActive === 'reports' && <Reports />}
      {effectiveActive === 'users' && <UserManagement />}
    </AdminShell>
    <OfflineBanner />
    </>
  )
}

export default App
