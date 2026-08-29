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
  Download, Gauge, ShieldAlert, Building2, ArrowLeft, Menu, X,
  Camera, FileText, Image as ImageIcon
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
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399] animate-pulse" /> Fleet Management System · Live
            </div>
            <h1 className="text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-normal leading-none tracking-wide whitespace-nowrap" style={{fontFamily: '"Times New Roman", Georgia, serif', fontVariant: 'small-caps'}}>
              C. Krishniah <span className="text-amber-300 italic font-medium">Chetty</span>
              <span className="text-base lg:text-lg text-amber-200/70 align-super ml-1" style={{fontVariant: 'normal'}}>™</span>
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
            FLEET OPS · v1.0
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
                <span className="text-[10px] tracking-[0.3em] text-amber-100 font-bold">FLEET MANAGEMENT SYSTEM</span>
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
                        placeholder="e.g. admin"
                        className="h-11 pl-10 border-slate-200 focus:border-red-800 focus:ring-red-800/20 rounded-lg"
                      />
                      <Users className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs tracking-[0.15em] text-slate-600 font-semibold uppercase">Password</Label>
                    <div className="relative">
                      <Input
                        type="password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        required
                        placeholder="Enter your password"
                        className="h-11 pl-10 border-slate-200 focus:border-red-800 focus:ring-red-800/20 rounded-lg"
                      />
                      <ShieldAlert className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
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

                {/* Quick-select roles */}
                <div className="pt-4 border-t border-slate-100">
                  <div className="text-[10px] tracking-[0.25em] text-slate-400 font-semibold uppercase mb-2.5">Quick Access</div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => { setUsername('admin'); setPassword('admin123') }}
                      className="p-2.5 rounded-lg bg-slate-50 hover:bg-red-50 border border-slate-200 hover:border-red-300 text-left transition group"
                    >
                      <div className="flex items-center gap-1.5">
                        <LayoutDashboard className="w-3 h-3 text-red-700" />
                        <div className="font-semibold text-slate-700 text-[11px]">Administrator</div>
                      </div>
                      <div className="text-slate-500 text-[10px] mt-0.5 font-mono">admin / admin123</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => { setUsername('security'); setPassword('security123') }}
                      className="p-2.5 rounded-lg bg-slate-50 hover:bg-red-50 border border-slate-200 hover:border-red-300 text-left transition group"
                    >
                      <div className="flex items-center gap-1.5">
                        <ShieldAlert className="w-3 h-3 text-red-700" />
                        <div className="font-semibold text-slate-700 text-[11px]">Security</div>
                      </div>
                      <div className="text-slate-500 text-[10px] mt-0.5 font-mono">security / security123</div>
                    </button>
                  </div>
                </div>
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
  const nav = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'vehicles', label: 'Vehicles', icon: Car },
    { id: 'drivers', label: 'Drivers', icon: Users },
    { id: 'trips', label: 'Trip Register', icon: ClipboardList },
    { id: 'fuel', label: 'Fuel Register', icon: Fuel },
    { id: 'mileage', label: 'Mileage', icon: Gauge },
    { id: 'reports', label: 'Reports', icon: Download },
  ]
  const pick = (id) => { setActive(id); setDrawerOpen(false) }
  const SidebarContent = () => (
    <>
      <div className="p-5 border-b border-slate-800 flex items-center gap-3">
        <img src="/ckc-logo.png" alt="CKC" className="w-11 h-11 object-contain" />
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm leading-tight truncate" style={{fontFamily: '"Times New Roman", Georgia, serif', fontVariant: 'small-caps'}}>C. Krishniah <span className="text-amber-300 italic">Chetty</span></div>
          <div className="text-[10px] text-amber-200/60 tracking-[0.2em] mt-0.5">FLEET · ADMIN</div>
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
            <span className="font-semibold text-sm" style={{fontFamily: 'Georgia, serif', fontVariant: 'small-caps'}}>C. Krishniah <span className="text-amber-300 italic">Chetty</span></span>
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
  const [viewImg, setViewImg] = useState(null)
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
          <TableHead>Station</TableHead><TableHead>Receipt</TableHead><TableHead>Photo</TableHead>
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
              <TableCell>
                {t.receiptImage ? (
                  <button onClick={() => setViewImg(t.receiptImage)} className="w-10 h-10 rounded border overflow-hidden hover:ring-2 hover:ring-amber-500">
                    <img src={t.receiptImage} alt="" className="w-full h-full object-cover" />
                  </button>
                ) : <span className="text-slate-300 text-xs">—</span>}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table></div></CardContent></Card>
      <Dialog open={!!viewImg} onOpenChange={(v) => !v && setViewImg(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>Receipt Photo</DialogTitle></DialogHeader>
          {viewImg && <img src={viewImg} alt="Receipt" className="w-full rounded" />}
        </DialogContent>
      </Dialog>
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
  const [trips, setTrips] = useState([])
  const [fuel, setFuel] = useState([])
  const [vehicles, setVehicles] = useState([])
  const [generating, setGenerating] = useState(false)
  useEffect(() => {
    api('dashboard').then(setData)
    api('trips').then(setTrips)
    api('fuel').then(setFuel)
    api('vehicles').then(setVehicles)
  }, [])
  if (!data) return <div className="p-8">Loading...</div>

  const generatePDF = async (type) => {
    setGenerating(true)
    try {
      const { jsPDF } = await import('jspdf')
      const autoTable = (await import('jspdf-autotable')).default
      const doc = new jsPDF({ unit: 'pt', format: 'a4' })
      const pageW = doc.internal.pageSize.getWidth()
      const now = new Date()
      const isDaily = type === 'daily'
      const todayStr = now.toISOString().slice(0, 10)
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

      const filterFn = (dateStr) => {
        const d = new Date(dateStr)
        return isDaily ? dateStr?.slice(0, 10) === todayStr : d >= monthStart
      }
      const tripsFiltered = trips.filter(t => filterFn(t.dateOut))
      const fuelFiltered = fuel.filter(f => filterFn(f.date))

      // Header - branded
      doc.setFillColor(15, 23, 42)
      doc.rect(0, 0, pageW, 90, 'F')
      // Gold logo tile
      doc.setFillColor(251, 191, 36)
      doc.roundedRect(30, 22, 46, 46, 8, 8, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(9)
      doc.text('CKC', 53, 50, { align: 'center' })
      doc.setFontSize(18)
      doc.setFont('helvetica', 'bold')
      doc.text('C Krishniah Chetty Jewellers Pvt. Ltd.', 90, 42)
      doc.setFontSize(11)
      doc.setFont('helvetica', 'normal')
      doc.text('Fleet Management — ' + (isDaily ? 'Daily Report' : 'Monthly Report'), 90, 60)
      doc.setFontSize(9)
      doc.text(`Generated: ${now.toLocaleString('en-IN')}`, 90, 76)

      // Reset text
      doc.setTextColor(15, 23, 42)
      let y = 115

      // Summary section
      doc.setFontSize(13); doc.setFont('helvetica', 'bold')
      doc.text(isDaily ? "Today's Summary" : "Monthly Summary", 30, y); y += 10
      doc.setDrawColor(251, 191, 36); doc.setLineWidth(2)
      doc.line(30, y, 90, y); y += 15

      const kmTotal = tripsFiltered.reduce((s, t) => s + (t.kmRun || 0), 0)
      const fuelLit = fuelFiltered.reduce((s, f) => s + f.quantity, 0)
      const fuelCost = fuelFiltered.reduce((s, f) => s + f.amount, 0)
      const avgMileage = fuelLit > 0 ? (kmTotal / fuelLit).toFixed(2) : 'N/A'

      const summaryRows = [
        ['Total Trips', tripsFiltered.length],
        ['KM Travelled', kmTotal + ' km'],
        ['Fuel Consumed', fuelLit.toFixed(2) + ' L'],
        ['Fuel Cost', '₹' + fuelCost.toLocaleString('en-IN')],
        ['Avg Mileage', avgMileage + ' km/L'],
      ]
      autoTable(doc, {
        startY: y,
        head: [['Metric', 'Value']],
        body: summaryRows,
        theme: 'grid',
        headStyles: { fillColor: [15, 23, 42], textColor: 255 },
        styles: { fontSize: 10 },
        margin: { left: 30, right: 30 },
      })
      y = doc.lastAutoTable.finalY + 20

      // Trips table
      if (tripsFiltered.length) {
        doc.setFontSize(13); doc.setFont('helvetica', 'bold')
        doc.text('Vehicle Movements', 30, y); y += 5
        doc.line(30, y + 3, 130, y + 3); y += 12
        autoTable(doc, {
          startY: y,
          head: [['Trip ID', 'Vehicle', 'Driver', 'Out', 'In', 'KM', 'Destination']],
          body: tripsFiltered.slice(0, 50).map(t => [
            t.tripId, t.vehicleNumber, t.driverName || '-',
            new Date(t.dateOut).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }),
            t.timeIn ? new Date(t.timeIn).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-',
            t.kmRun || '-', t.destination || '-',
          ]),
          theme: 'striped', headStyles: { fillColor: [15, 23, 42] },
          styles: { fontSize: 8 }, margin: { left: 30, right: 30 },
        })
        y = doc.lastAutoTable.finalY + 20
      }

      // Fuel table
      if (fuelFiltered.length) {
        if (y > 700) { doc.addPage(); y = 40 }
        doc.setFontSize(13); doc.setFont('helvetica', 'bold')
        doc.text('Fuel Entries', 30, y); y += 5
        doc.line(30, y + 3, 100, y + 3); y += 12
        autoTable(doc, {
          startY: y,
          head: [['Date', 'Vehicle', 'Odometer', 'Qty (L)', 'Rate', 'Amount', 'Station']],
          body: fuelFiltered.slice(0, 50).map(f => [
            new Date(f.date).toLocaleDateString('en-IN'),
            f.vehicleNumber, f.odometer?.toLocaleString() || '-',
            f.quantity, '₹' + f.rate,
            '₹' + f.amount.toLocaleString('en-IN'),
            f.station || '-',
          ]),
          theme: 'striped', headStyles: { fillColor: [217, 119, 6] },
          styles: { fontSize: 8 }, margin: { left: 30, right: 30 },
        })
        y = doc.lastAutoTable.finalY + 20
      }

      // Low mileage section (monthly only)
      if (!isDaily && data.alerts.lowMileage.length) {
        if (y > 680) { doc.addPage(); y = 40 }
        doc.setFontSize(13); doc.setFont('helvetica', 'bold')
        doc.setTextColor(220, 38, 38)
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

      // Footer on all pages
      const pageCount = doc.internal.getNumberOfPages()
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        doc.setFontSize(8); doc.setTextColor(120)
        doc.text('CKC Fleet Management System · Confidential', 30, doc.internal.pageSize.getHeight() - 20)
        doc.text(`Page ${i} of ${pageCount}`, pageW - 30, doc.internal.pageSize.getHeight() - 20, { align: 'right' })
      }

      const fileName = `CKC-${isDaily ? 'Daily' : 'Monthly'}-Report-${now.toISOString().slice(0, 10)}.pdf`
      doc.save(fileName)
      toast.success('PDF generated')
    } catch (e) {
      console.error(e); toast.error('PDF generation failed: ' + e.message)
    } finally { setGenerating(false) }
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-3xl font-bold text-slate-900">Reports</h1>
      <p className="text-slate-500">Generate branded PDF reports and view summary KPIs.</p>

      <div className="grid md:grid-cols-2 gap-4">
        <Card className="border-2 border-slate-900">
          <CardContent className="p-6 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-slate-900 text-white flex items-center justify-center"><FileText className="w-6 h-6" /></div>
              <div>
                <div className="font-bold text-lg">Daily Report</div>
                <div className="text-xs text-slate-500">Today's trips, fuel & KPIs</div>
              </div>
            </div>
            <Button onClick={() => generatePDF('daily')} disabled={generating} className="w-full bg-slate-900 hover:bg-slate-800">
              <Download className="w-4 h-4 mr-2" /> Generate Daily PDF
            </Button>
          </CardContent>
        </Card>
        <Card className="border-2 border-amber-500">
          <CardContent className="p-6 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-amber-500 text-white flex items-center justify-center"><FileText className="w-6 h-6" /></div>
              <div>
                <div className="font-bold text-lg">Monthly Report</div>
                <div className="text-xs text-slate-500">Full month + low-mileage analysis</div>
              </div>
            </div>
            <Button onClick={() => generatePDF('monthly')} disabled={generating} className="w-full bg-amber-500 hover:bg-amber-600">
              <Download className="w-4 h-4 mr-2" /> Generate Monthly PDF
            </Button>
          </CardContent>
        </Card>
      </div>

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
    <div className="min-h-screen bg-gradient-to-br from-[#3d0808] via-[#5c0a0a] to-[#2d0505] text-white">
      <header className="p-4 flex items-center justify-between border-b border-red-900/50 bg-black/20 backdrop-blur">
        <div className="flex items-center gap-2">
          {screen !== 'home' && <Button variant="ghost" size="sm" onClick={() => setScreen('home')} className="text-white hover:bg-white/10"><ArrowLeft className="w-4 h-4" /></Button>}
          <img src="/ckc-logo.png" alt="CKC" className="w-9 h-9 object-contain" />
          <div>
            <div className="font-semibold text-sm leading-none whitespace-nowrap" style={{fontFamily: 'Georgia, serif', fontVariant: 'small-caps'}}>C. Krishniah <span className="text-amber-300 italic">Chetty</span></div>
            <div className="text-[9px] tracking-[0.25em] text-amber-200/60 mt-0.5">FLEET · SECURITY</div>
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
            <label className="mt-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-lg p-6 cursor-pointer hover:bg-slate-50 active:bg-slate-100">
              <Camera className="w-8 h-8 text-slate-400 mb-2" />
              <div className="text-sm font-medium text-slate-700">{uploading ? 'Loading...' : 'Take Photo / Choose File'}</div>
              <div className="text-xs text-slate-500">Attach fuel receipt</div>
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />
            </label>
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
