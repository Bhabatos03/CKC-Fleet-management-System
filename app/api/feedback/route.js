// app/api/feedback/route.js
//
// Public endpoint behind the one-time feedback link. There is no sign-in: the long random token IS the permission,
// it works once, and it expires. It returns and accepts nothing about the booking itself.
// The token is sent in a header (GET) or the body (POST), never in the URL, so it stays out of server logs.
// Next.js matches this folder before the catch-all app/api/[[...path]]/route.js, so that file needs no change.

import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import { getForm, submitFeedback, FeedbackError } from '../../../lib/bookings/feedback.js'

let cachedClient = null
async function getDb() {
  if (!cachedClient) cachedClient = new MongoClient(process.env.MONGO_URL)
  await cachedClient.connect()
  return cachedClient.db(process.env.DB_NAME || 'ckc_fleet')
}

const ipOf = (req) => (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown'
const noStore = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' }
const fail = (e) => {
  if (e instanceof FeedbackError) return NextResponse.json({ error: e.message, ...(e.fields ? { fields: e.fields } : {}) }, { status: e.status, headers: noStore })
  console.error('Feedback error:', e?.name)
  return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500, headers: noStore })
}

export async function GET(req) {
  try {
    return NextResponse.json(await getForm(await getDb(), req.headers.get('x-feedback-token'), ipOf(req)), { headers: noStore })
  } catch (e) { return fail(e) }
}

export async function POST(req) {
  try {
    let body = {}
    try { body = await req.json() } catch { /* an empty body is rejected below */ }
    return NextResponse.json(await submitFeedback(await getDb(), body?.token, body, ipOf(req)), { headers: noStore })
  } catch (e) { return fail(e) }
}
