import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import Anthropic from '@anthropic-ai/sdk'
import { getAuth, sameOrigin } from '../../../lib/session'

const MONGO_URL = process.env.MONGO_URL
const DB_NAME = process.env.DB_NAME || 'ckc_fleet'
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

let cachedClient = null
async function getDb() {
  if (!cachedClient) {
    cachedClient = new MongoClient(MONGO_URL)
    await cachedClient.connect()
  }
  return cachedClient.db(DB_NAME)
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

export async function POST(request) {
  try {
    const db = await getDb()

    // Must be a real signed-in session from our own site
    if (!sameOrigin(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const auth = await getAuth(db, request)
    if (!auth || auth.via !== 'session') return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

    // Limit each user to 20 scans per minute (this call costs money)
    const col = db.collection('rate_limits')
    await col.createIndex({ expireAt: 1 }, { expireAfterSeconds: 0 }).catch(() => {})
    const key = `scan|${auth.username}`
    const now = Date.now()
    const rec = await col.findOne({ _id: key })
    if (rec && now - rec.first < 60000) {
      if (rec.count >= 20) return NextResponse.json({ error: 'Too many scans. Please wait a minute.' }, { status: 429 })
      await col.updateOne({ _id: key }, { $inc: { count: 1 } })
    } else {
      await col.replaceOne({ _id: key }, { _id: key, count: 1, first: now, expireAt: new Date(now + 60000) }, { upsert: true })
    }

    const { image } = await request.json()
    if (!image || typeof image !== 'string') return NextResponse.json({ error: 'No image provided' }, { status: 400 })
    if (image.length > 6_000_000) return NextResponse.json({ error: 'Image too large' }, { status: 413 })

    const match = image.match(/^data:(image\/\w+);base64,(.+)$/)
    if (!match) return NextResponse.json({ error: 'Invalid image format' }, { status: 400 })
    const [, mediaType, base64Data] = match
    if (!ALLOWED_TYPES.includes(mediaType)) return NextResponse.json({ error: 'Invalid image format' }, { status: 400 })

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Data } },
          {
            type: 'text',
            text: `This is a photo of a fuel receipt from India. Extract the following fields and respond with ONLY a JSON object, no other text, no markdown formatting:
{
  "quantity": <number, litres filled, or null if not readable>,
  "rate": <number, price per litre in INR, or null if not readable>,
  "amount": <number, total amount in INR, or null if not readable>,
  "station": <string, fuel station name/brand, or null if not readable>,
  "receiptNumber": <string, receipt/bill/invoice number, or null if not readable>,
  "date": <string in YYYY-MM-DD format if a date is visible, or null>,
  "confidence": <"high" | "medium" | "low", your confidence in the overall reading>
}
If a field genuinely isn't visible or legible, use null for it rather than guessing.`
          }
        ]
      }]
    })

    const text = response.content[0].text.trim()
    const cleaned = text.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(cleaned)

    return NextResponse.json(parsed)
  } catch (e) {
    console.error('Receipt scan error:', e)
    return NextResponse.json({ error: 'Could not read the receipt. Please enter details manually.' }, { status: 500 })
  }
}
