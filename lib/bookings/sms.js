// lib/bookings/sms.js
//
// Booking confirmation SMS to the customer and to the driver, through the SMS provider's HTTP API.
//
// Indian SMS rules (DLT): the text sent must match a registered template word for word, with only the {#alp#} slots filled in.
// The two registered templates are copied below exactly as they appear in the template sheet. Do NOT reword them here.
// If a template is changed in the DLT portal, change it here to match, or the provider will reject the message.
//
// The provider login is read from environment variables only. It is never written in code.
//   SMS_URL        the provider's SendSMS address (required; use https if the provider supports it)
//   SMS_USER       the provider account name
//   SMS_PASSWORD   the provider account password
//   SMS_SENDER_ID  the registered header, default CKCJEW
//   SMS_ROUTE      default 10          SMS_CHANNEL   default Trans
//   SMS_PEID       optional: principal entity (brand) DLT id, sent only if the provider asks for it
//   SMS_TEMPLATE_PARAM / SMS_PEID_PARAM   names of the provider's DLT fields, defaults DLTTemplateId / PEId
//   SMS_VAR_MAX    longest value for one {#alp#} slot, default 30
//   SMS_SEND_AS    how the details are passed: get (default: in the web address, GET: the way cannyinfotech accepts it), query (in the web address, POST), form (in the POST body)

import { normMobile, isValidMobile } from './validate.js'

export const SMS_TEMPLATES = {
  customer: {
    id: '1077332450087456350',
    name: 'Vehicle Booking- Customer',
    content: 'Dear Customer, your CKC Jewellers vehicle booking is confirmed for {#alp#}. Pickup Location is {#alp#}. Our Vehicle Details: {#alp#}, Driver Name {#alp#} Thank you for choosing C Krishniah Chetty Group of Jewellers.',
  },
  driver: {
    id: '1077496500086436766',
    name: 'Vehicle Booking-Driver',
    content: 'Dear Driver, One Booking is confirmed for {#alp#} Assigned Vehicle  {#alp#} . Customer:{#alp#} , Pickup Location: {#alp#}. Kindly report on time. From C Krishniah Chetty Group of Jewellers',
  },
}

export function smsConfig(env = process.env) {
  // Pasted values often carry a stray space or line break, which the provider would read as a different (or blank) login
  const v = (k) => String(env[k] ?? '').trim()
  const cfg = {
    url: v('SMS_URL'), user: v('SMS_USER'), password: v('SMS_PASSWORD'),
    sender: v('SMS_SENDER_ID') || 'CKCJEW', route: v('SMS_ROUTE') || '10', channel: v('SMS_CHANNEL') || 'Trans',
    peid: v('SMS_PEID'), templateParam: v('SMS_TEMPLATE_PARAM') || 'DLTTemplateId', peidParam: v('SMS_PEID_PARAM') || 'PEId',
    sendAs: ['get', 'query', 'form'].includes(v('SMS_SEND_AS').toLowerCase()) ? v('SMS_SEND_AS').toLowerCase() : 'get',
    varMax: Math.min(Math.max(parseInt(env.SMS_VAR_MAX, 10) || 30, 10), 100),
  }
  // Names only, never values: lets the booking page say which setting is missing
  cfg.missing = [['SMS_URL', cfg.url], ['SMS_USER', cfg.user], ['SMS_PASSWORD', cfg.password]].filter(([, v]) => !v).map(([k]) => k)
  cfg.enabled = cfg.missing.length === 0
  return cfg
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// A value for one {#alp#} slot: plain letters, digits and a little punctuation, on one line, no longer than the slot allows
export function slot(value, max = 30) {
  let t = String(value ?? '').replace(/[\r\n\t]+/g, ' ').replace(/[{}#<>\\|^~`"]/g, ' ').replace(/\s+/g, ' ').trim()
  if (t.length > max) {
    const cut = t.slice(0, max)
    const sp = cut.lastIndexOf(' ')
    t = (sp >= Math.floor(max * 0.6) ? cut.slice(0, sp) : cut).replace(/[ ,.-]+$/, '')
  }
  return t
}

// Addresses are long and a slot is short: use the part before the first comma, adding the next part if the first is very short
export function shortPlace(address, max = 30) {
  const parts = String(address || '').split(',').map(p => p.trim()).filter(Boolean)
  if (!parts.length) return ''
  let t = parts[0]
  if (t.length < 8 && parts[1]) t = `${t}, ${parts[1]}`
  return slot(t, max)
}

const whenText = (trip) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trip?.travelDate || '')
  return m ? `${m[3]} ${MONTHS[Number(m[2]) - 1]} ${m[1]} ${trip.pickupTime || ''}`.trim() : ''
}

const fill = (template, values) => { let i = 0; return template.replace(/\{#alp#\}/g, () => values[i++] ?? '') }

// What to send to whom for a booking, or { skip: reason }
export function buildSms(kind, b, cfg = smsConfig({})) {
  const t = b.trip || {}
  const a = b.allocation
  const max = cfg.varMax
  if (!a) return { skip: 'No vehicle and driver assigned yet' }
  const tpl = SMS_TEMPLATES[kind]
  const when = slot(whenText(t), max)
  const pickup = shortPlace(t.pickup?.address, max)
  const vehicle = slot(a.vehicleNumber, max)
  if (kind === 'customer') {
    if (b.party === 'delivery') return { skip: 'Delivery bookings have no customer message template' }
    const number = normMobile(b.requester?.mobile)
    if (!isValidMobile(number)) return { skip: 'No valid customer mobile number' }
    const details = slot(`${a.vehicleNumber}${a.vehicleModel ? ` ${a.vehicleModel}` : ''}`, max)
    const vars = [when, pickup, details, slot(a.driverName, max)]
    return { number, templateId: tpl.id, vars, text: fill(tpl.content, vars) }
  }
  const number = normMobile(a.driverMobile)
  if (!isValidMobile(number)) return { skip: 'No valid driver mobile number' }
  const customer = slot(b.party === 'delivery' ? b.delivery?.recipientName : b.requester?.name, max)
  const vars = [when, vehicle, customer, pickup]
  return { number, templateId: tpl.id, vars, text: fill(tpl.content, vars) }
}

// Sends one SMS. Returns { ok, ref } or { ok:false, error }. The provider answer is trusted only if it says so clearly:
// an answer we cannot read counts as NOT accepted. Nothing sensitive (password, number, text) is ever put in the error.
export async function sendSms({ cfg, number, text, templateId, fetchFn = globalThis.fetch, timeoutMs = 8000 }) {
  if (!cfg.enabled) return { ok: false, error: 'SMS is not set up' }
  const body = new URLSearchParams({
    user: cfg.user, password: cfg.password, senderid: cfg.sender, channel: cfg.channel, DCS: '0', flashsms: '0',
    number: `91${number}`, text, route: cfg.route,
  })
  if (templateId) body.set(cfg.templateParam, templateId)
  if (cfg.peid) body.set(cfg.peidParam, cfg.peid)
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), timeoutMs)
  try {
    // A redirect would turn the POST into a GET and drop the login. So redirects are followed here by hand: the same POST is sent again,
    // and only to the same website (never to another host).
    let target = cfg.url
    let res
    for (let hop = 0; hop < 3; hop++) {
      const u = new URL(target)
      if (cfg.sendAs !== 'form') for (const [k, v] of body) u.searchParams.set(k, v)   // details in the web address
      const post = cfg.sendAs !== 'get'
      res = await fetchFn(u.toString(), {
        method: post ? 'POST' : 'GET',
        ...(post ? { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: cfg.sendAs === 'form' ? body.toString() : '' } : {}),
        signal: ctl.signal, redirect: 'manual',
      })
      const loc = res.status >= 300 && res.status < 400 ? res.headers?.get?.('location') : null
      if (!loc) break
      let next
      try { next = new URL(loc, target) } catch { return { ok: false, error: 'The SMS provider sent an address this app cannot follow' } }
      if (next.hostname !== new URL(target).hostname || !/^https?:$/.test(next.protocol)) return { ok: false, error: 'The SMS provider redirected to a different website, so the request was not repeated' }
      next.search = ''   // our details are added again on the next round
      target = next.toString()
    }
    const raw = await res.text()
    let data = null
    try { data = JSON.parse(raw) } catch { /* not JSON */ }
    if (!res.ok) return { ok: false, error: `The SMS provider answered with an error (${res.status})` }
    if (!data || typeof data !== 'object') return { ok: false, error: 'The SMS provider gave an answer this app cannot read' }
    const code = String(data.ErrorCode ?? '')
    if (code === '000' || code === '0') {
      return { ok: true, ref: String(data.JobId ?? data.MessageData?.[0]?.MessageId ?? '').slice(0, 60) }
    }
    // The provider's own words are shown, but never anything that looks like our login
    const said = String(data.ErrorMessage || `code ${code || 'unknown'}`).split(cfg.password).join('***').split(cfg.user).join('***')
    return { ok: false, error: `The SMS provider refused it: ${said.replace(/[^\w .,:;()/*-]/g, '').slice(0, 100)}` }
  } catch (e) {
    return { ok: false, error: e?.name === 'AbortError' ? 'The SMS provider did not answer in time' : 'Could not reach the SMS provider' }
  } finally { clearTimeout(timer) }
}
