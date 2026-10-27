'use client'
// app/feedback/page.js
// The page behind a one-time feedback link, https://<site>/feedback#<token>. No sign-in, and it never shows any booking details.
// The token sits after the # so browsers never send it to the server in the page address.
import { useEffect, useState } from 'react'

export default function FeedbackPage() {
  const [token, setToken] = useState('')
  const [form, setForm] = useState(null)      // { role, issues }
  const [error, setError] = useState('')
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [issues, setIssues] = useState([])
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    const t = decodeURIComponent((window.location.hash || '').replace(/^#\/?/, ''))
    setToken(t)
    if (!t) { setError('This link is not valid or has already been used'); return }
    fetch('/api/feedback', { cache: 'no-store', headers: { 'x-feedback-token': t } })
      .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error || 'This link is not valid'); setForm(d) })
      .catch(e => setError(e.message))
  }, [])

  const submit = async () => {
    if (!rating) { setError('Please choose a rating'); return }
    setBusy(true); setError('')
    try {
      const r = await fetch('/api/feedback', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, rating, comment, issues }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Could not send your feedback')
      setDone(true)
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  const isDriver = form?.role === 'driver'
  const box = { maxWidth: 480, margin: '0 auto', padding: '24px 16px', fontFamily: 'system-ui, sans-serif', color: '#1f2937' }
  const card = { border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, background: '#fff' }

  return (
    <div style={{ background: '#f9fafb', minHeight: '100vh' }}>
      <div style={box}>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 4px' }}>C. Krishniah Chetty Jewellers</h1>
        <p style={{ color: '#6b7280', margin: '0 0 16px', fontSize: 14 }}>Trip feedback</p>
        <div style={card}>
          {done ? (
            <p style={{ margin: 0 }}>Thank you. Your feedback has been received, and it helps us improve.</p>
          ) : !form ? (
            <p style={{ margin: 0, color: error ? '#b91c1c' : '#6b7280' }}>{error || 'Loading...'}</p>
          ) : (
            <>
              <p style={{ margin: '0 0 12px', fontWeight: 600 }}>{isDriver ? 'How was this trip for you?' : 'How was your ride with us?'}</p>
              <div role="radiogroup" aria-label="Rating" style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                {[1, 2, 3, 4, 5].map(n => (
                  <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} star${n > 1 ? 's' : ''}`} onClick={() => setRating(n)}
                    style={{ fontSize: 34, lineHeight: 1, background: 'none', border: 'none', cursor: 'pointer', color: n <= rating ? '#f59e0b' : '#d1d5db', padding: 4 }}>★</button>
                ))}
              </div>
              <p style={{ margin: '0 0 16px', fontSize: 12, color: '#6b7280' }}>1 = poor, 5 = excellent. This is optional, and you can close this page.</p>
              {isDriver && (
                <div style={{ marginBottom: 16 }}>
                  <p style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 600 }}>Anything to report? (optional)</p>
                  {form.issues.map(i => (
                    <label key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14, padding: '4px 0' }}>
                      <input type="checkbox" checked={issues.includes(i)} onChange={e => setIssues(e.target.checked ? [...issues, i] : issues.filter(x => x !== i))} />{i}
                    </label>
                  ))}
                </div>
              )}
              <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 6 }}>{isDriver ? 'Vehicle or trip notes (optional)' : 'Comments (optional)'}</label>
              <textarea value={comment} maxLength={500} rows={4} onChange={e => setComment(e.target.value)}
                style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #d1d5db', borderRadius: 8, padding: 8, font: 'inherit' }} />
              {error && <p style={{ color: '#b91c1c', fontSize: 14, margin: '8px 0 0' }}>{error}</p>}
              <button type="button" onClick={submit} disabled={busy}
                style={{ marginTop: 16, width: '100%', padding: '12px 0', borderRadius: 8, border: 'none', background: '#111827', color: '#fff', fontSize: 16, cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>
                {busy ? 'Sending...' : 'Send feedback'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
