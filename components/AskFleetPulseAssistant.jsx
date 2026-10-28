'use client'
// components/AskFleetPulseAssistant.jsx
//
// A floating AI assistant for Ask FleetPulse: a friendly animated avatar in the bottom-right corner that says
// "Hi! How can I help you?", and opens a chat panel. Uses the same /api/ask-fleetpulse endpoint (with chat history).
// Mount it ONCE, where the signed-in app is rendered:   <AskFleetPulseAssistant user={user} />
// It shows only for Admin and Store Admin, who are the only roles the server allows.

import { useState, useRef, useEffect } from 'react'

const RED = '#E60000'
const EXAMPLES = [
  { icon: '🛡️', text: 'Which vehicles have insurance expiring in the next 30 days?' },
  { icon: '⛽', text: 'How much did we spend on fuel last month, by vehicle?' },
  { icon: '📅', text: "Show today's bookings and which still need a vehicle" },
  { icon: '⭐', text: 'Which drivers have the lowest feedback ratings?' },
]

// An original friendly robot face. Eyes blink; the antenna glows.
function Avatar({ size = 56, talking = false }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className={talking ? 'fp-talk' : ''}>
      <defs>
        <linearGradient id="fpBody" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor="#e8ecf4" /></linearGradient>
        <linearGradient id="fpFace" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1f2a44" /><stop offset="1" stopColor="#0f172a" /></linearGradient>
      </defs>
      <line x1="32" y1="6" x2="32" y2="13" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="32" cy="5" r="3.5" fill={RED} className="fp-glow" />
      <rect x="7" y="28" width="5" height="12" rx="2.5" fill="#cbd5e1" />
      <rect x="52" y="28" width="5" height="12" rx="2.5" fill="#cbd5e1" />
      <rect x="10" y="13" width="44" height="40" rx="16" fill="url(#fpBody)" stroke="#d5dbe8" strokeWidth="1.5" />
      <rect x="15" y="21" width="34" height="24" rx="11" fill="url(#fpFace)" />
      <g className="fp-blink" style={{ transformOrigin: '32px 32px' }}>
        <ellipse cx="25" cy="32" rx="3.6" ry="4.4" fill="#5eead4" />
        <ellipse cx="39" cy="32" rx="3.6" ry="4.4" fill="#5eead4" />
      </g>
      <path d="M26 39.5 Q32 44 38 39.5" stroke="#5eead4" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      <circle cx="19" cy="40" r="2" fill="#fb7185" opacity="0.55" />
      <circle cx="45" cy="40" r="2" fill="#fb7185" opacity="0.55" />
    </svg>
  )
}

const STYLES = `
@keyframes fpFloat { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-5px) } }
@keyframes fpBlink { 0%,92%,100% { transform: scaleY(1) } 95% { transform: scaleY(0.1) } }
@keyframes fpGlow { 0%,100% { opacity: 1 } 50% { opacity: .35 } }
@keyframes fpPop { 0% { opacity: 0; transform: translateY(8px) scale(.96) } 100% { opacity: 1; transform: none } }
@keyframes fpDot { 0%,80%,100% { transform: translateY(0); opacity: .4 } 40% { transform: translateY(-4px); opacity: 1 } }
@keyframes fpPulse { 0% { box-shadow: 0 0 0 0 rgba(230,0,0,.35) } 100% { box-shadow: 0 0 0 16px rgba(230,0,0,0) } }
.fp-float { animation: fpFloat 3.2s ease-in-out infinite }
.fp-blink { animation: fpBlink 4.5s infinite }
.fp-glow { animation: fpGlow 1.8s infinite }
.fp-pop { animation: fpPop .22s ease-out }
.fp-dot { display:inline-block; width:6px; height:6px; border-radius:50%; background:#64748b; margin:0 2px; animation: fpDot 1.1s infinite }
.fp-pulse { animation: fpPulse 2.4s ease-out infinite }
.fp-talk .fp-blink { animation-duration: 1.6s }
@media (prefers-reduced-motion: reduce) { .fp-float,.fp-blink,.fp-glow,.fp-pulse,.fp-pop,.fp-dot { animation: none !important } }
`

export default function AskFleetPulseAssistant({ user }) {
  const allowed = user && (user.role === 'admin' || user.role === 'store_admin')
  const [open, setOpen] = useState(false)
  const [greet, setGreet] = useState(false)
  const [messages, setMessages] = useState([]) // { role: 'user' | 'assistant', content, error? }
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const end = useRef(null)
  const inputRef = useRef(null)

  // The greeting bubble appears once per browser session, then fades away on its own
  useEffect(() => {
    if (!allowed) return
    let seen = false
    try { seen = sessionStorage.getItem('fp-greeted') === '1' } catch { /* storage may be blocked */ }
    if (seen) return
    const a = setTimeout(() => setGreet(true), 1500)
    const b = setTimeout(() => { setGreet(false); try { sessionStorage.setItem('fp-greeted', '1') } catch { /* ignore */ } }, 12000)
    return () => { clearTimeout(a); clearTimeout(b) }
  }, [allowed])

  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [messages, busy, open])
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 150) }, [open])
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (!allowed) return null

  const firstName = String(user.name || user.username || '').split(' ')[0]

  const ask = async (q) => {
    const question = (q ?? text).trim()
    if (!question || busy) return
    const history = messages.filter(m => !m.error).slice(-12).map(m => ({ role: m.role, content: m.content }))
    setMessages(m => [...m, { role: 'user', content: question }])
    setText(''); setBusy(true)
    try {
      const r = await fetch('/api/ask-fleetpulse', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question, history }) })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Something went wrong')
      setMessages(m => [...m, { role: 'assistant', content: d.answer }])
    } catch (e) {
      setMessages(m => [...m, { role: 'assistant', content: e.message || 'Something went wrong', error: true }])
    } finally { setBusy(false) }
  }

  return (
    <>
      <style>{STYLES}</style>

      {/* Chat panel */}
      {open && (
        <div role="dialog" aria-label="Ask FleetPulse assistant" className="fp-pop"
          style={{ position: 'fixed', right: 16, bottom: 16, zIndex: 60, width: 'min(400px, calc(100vw - 32px))', height: 'min(620px, calc(100vh - 32px))', display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: 20, overflow: 'hidden', boxShadow: '0 20px 60px rgba(15,23,42,.28)', border: '1px solid #e2e8f0' }}>
          <div style={{ background: 'linear-gradient(135deg,#E60000,#9b0000)', color: '#fff', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ background: '#fff', borderRadius: '50%', width: 48, height: 48, display: 'grid', placeItems: 'center', flex: 'none' }}><Avatar size={42} talking={busy} /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 16, fontFamily: 'Georgia, serif' }}>FleetPulse Assistant</div>
              <div style={{ fontSize: 12, opacity: .9, display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ade80', display: 'inline-block' }} />Online · asks your live data</div>
            </div>
            {messages.length > 0 && <button type="button" onClick={() => setMessages([])} title="Start a new chat" aria-label="Start a new chat" style={{ background: 'rgba(255,255,255,.18)', border: 'none', color: '#fff', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontSize: 12 }}>New chat</button>}
            <button type="button" onClick={() => setOpen(false)} aria-label="Close" style={{ background: 'rgba(255,255,255,.18)', border: 'none', color: '#fff', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: 14, background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {messages.length === 0 && (
              <div className="fp-pop">
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginBottom: 14 }}>
                  <div style={{ flex: 'none' }}><Avatar size={40} /></div>
                  <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px 16px 16px 4px', padding: '10px 14px', fontSize: 14, color: '#0f172a' }}>
                    Hi{firstName ? ` ${firstName}` : ''}! 👋 How can I help you today? Ask me anything about your vehicles, drivers, trips, fuel, bookings, gate passes or feedback.
                  </div>
                </div>
                <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: .6, margin: '0 0 8px 4px' }}>Try asking</div>
                <div style={{ display: 'grid', gap: 8 }}>
                  {EXAMPLES.map(e => (
                    <button key={e.text} type="button" onClick={() => ask(e.text)}
                      style={{ textAlign: 'left', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '10px 12px', fontSize: 13, cursor: 'pointer', color: '#0f172a', display: 'flex', gap: 10, alignItems: 'center' }}>
                      <span style={{ fontSize: 18 }}>{e.icon}</span><span>{e.text}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className="fp-pop" style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', gap: 8, alignItems: 'flex-end' }}>
                {m.role === 'assistant' && <div style={{ flex: 'none' }}><Avatar size={30} /></div>}
                <div style={{ maxWidth: '82%', whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 14, lineHeight: 1.45, padding: '9px 13px',
                  ...(m.role === 'user'
                    ? { background: RED, color: '#fff', borderRadius: '16px 16px 4px 16px' }
                    : m.error ? { background: '#fff1f2', color: '#be123c', border: '1px solid #fecdd3', borderRadius: '16px 16px 16px 4px' }
                      : { background: '#fff', color: '#0f172a', border: '1px solid #e2e8f0', borderRadius: '16px 16px 16px 4px' }) }}>{m.content}</div>
              </div>
            ))}
            {busy && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                <div style={{ flex: 'none' }}><Avatar size={30} talking /></div>
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px 16px 16px 4px', padding: '12px 14px' }} aria-label="Looking that up">
                  <span className="fp-dot" /><span className="fp-dot" style={{ animationDelay: '.15s' }} /><span className="fp-dot" style={{ animationDelay: '.3s' }} />
                </div>
              </div>
            )}
            <div ref={end} />
          </div>

          <form onSubmit={e => { e.preventDefault(); ask() }} style={{ display: 'flex', gap: 8, padding: 12, borderTop: '1px solid #e2e8f0', background: '#fff' }}>
            <input ref={inputRef} value={text} onChange={e => setText(e.target.value)} maxLength={800} disabled={busy} placeholder="Type your question…"
              style={{ flex: 1, border: '1px solid #cbd5e1', borderRadius: 999, padding: '10px 16px', fontSize: 14, outline: 'none' }} />
            <button type="submit" disabled={busy || !text.trim()} aria-label="Send"
              style={{ width: 42, height: 42, borderRadius: '50%', border: 'none', background: RED, color: '#fff', cursor: busy || !text.trim() ? 'default' : 'pointer', opacity: busy || !text.trim() ? .5 : 1, fontSize: 18 }}>➤</button>
          </form>
        </div>
      )}

      {/* Floating button + greeting bubble */}
      {!open && (
        <div style={{ position: 'fixed', right: 16, bottom: 16, zIndex: 60, display: 'flex', alignItems: 'flex-end', gap: 10 }}>
          {greet && (
            <div className="fp-pop" role="status" style={{ position: 'relative', background: '#fff', border: '1px solid #e2e8f0', boxShadow: '0 8px 24px rgba(15,23,42,.18)', borderRadius: '16px 16px 4px 16px', padding: '10px 28px 10px 14px', maxWidth: 230, fontSize: 14, color: '#0f172a' }}>
              <b>Hi{firstName ? ` ${firstName}` : ''}! 👋</b><br />How can I help you?
              <button type="button" onClick={() => setGreet(false)} aria-label="Dismiss" style={{ position: 'absolute', top: 4, right: 6, border: 'none', background: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 16 }}>×</button>
            </div>
          )}
          <button type="button" onClick={() => { setOpen(true); setGreet(false) }} aria-label="Open the FleetPulse assistant"
            className="fp-pulse" style={{ border: '2px solid #fff', background: 'linear-gradient(135deg,#fff,#eef1f8)', borderRadius: '50%', width: 68, height: 68, display: 'grid', placeItems: 'center', cursor: 'pointer', boxShadow: '0 8px 24px rgba(15,23,42,.3)', padding: 0 }}>
            <span className="fp-float" style={{ display: 'grid', placeItems: 'center' }}><Avatar size={56} /></span>
          </button>
        </div>
      )}
    </>
  )
}
