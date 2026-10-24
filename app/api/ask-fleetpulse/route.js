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

const clean = (obj) => { const { _id, ...rest } = obj; return rest }

const TOOLS = [
  {
    name: 'get_vehicles',
    description: 'Get all vehicles with status, insurance/PUC/service due dates, odometer, expected mileage. Use for any question about vehicle status, compliance dates (insurance, PUC, service), or fleet composition.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_gate_passes',
    description: 'Get all gate passes with status (Open/Closed), returnable flag, expected return date, whether returned. Use for any question about gate passes, material movement, or overdue returns.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_drivers',
    description: 'Get all drivers with licence expiry and assigned store. Use for questions about driver licences or driver assignments.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_trips_summary',
    description: 'Get trip records (vehicle movements) from the last N days, including km run, destination, status. Use for questions about vehicle usage, trips, or distance travelled.',
    input_schema: {
      type: 'object',
      properties: { days: { type: 'number', description: 'How many days back to look, default 30' } },
    },
  },
  {
    name: 'get_fuel_summary',
    description: 'Get fuel entries from the last N days, including quantity, cost, station. Use for questions about fuel consumption or fuel spend.',
    input_schema: {
      type: 'object',
      properties: { days: { type: 'number', description: 'How many days back to look, default 30' } },
    },
  },
  {
    name: 'get_maintenance',
    description: 'Get maintenance/service records including cost, workshop, next service due. Use for questions about repairs, service history, or maintenance cost.',
    input_schema: { type: 'object', properties: {} },
  },
]

// Data is limited to the signed-in user's store HERE, in the database queries,
// so another store's records never reach the model at all.
async function runTool(db, name, input, scope) {
  const rawDays = Number(input?.days)
  const days = Number.isFinite(rawDays) ? Math.min(Math.max(rawDays, 1), 365) : 30
  const since = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString()
  const storeId = scope.storeId // null for admin = all stores

  let vehicleIds = null
  if (storeId) {
    const vs = await db.collection('vehicles').find({ assignedLocation: storeId }).toArray()
    vehicleIds = vs.map(v => v.id)
  }
  const byVehicle = vehicleIds ? { vehicleId: { $in: vehicleIds } } : {}

  if (name === 'get_vehicles') {
    const q = storeId ? { assignedLocation: storeId } : {}
    return (await db.collection('vehicles').find(q).toArray()).map(clean)
  }
  if (name === 'get_gate_passes') {
    const q = storeId ? { storeId } : {}
    return (await db.collection('gatepasses').find(q).sort({ createdAt: -1 }).limit(200).toArray()).map(clean)
  }
  if (name === 'get_drivers') {
    const q = storeId ? { $or: [{ assignedLocation: storeId }, { storeId }] } : {}
    return (await db.collection('drivers').find(q).toArray()).map(clean)
  }
  if (name === 'get_trips_summary') {
    return (await db.collection('trips').find({ dateOut: { $gte: since }, ...byVehicle }).sort({ dateOut: -1 }).limit(300).toArray()).map(clean)
  }
  if (name === 'get_fuel_summary') {
    return (await db.collection('fuel_entries').find({ date: { $gte: since }, ...byVehicle }).sort({ date: -1 }).limit(300).toArray()).map(clean)
  }
  if (name === 'get_maintenance') {
    return (await db.collection('maintenance').find({ ...byVehicle }).sort({ serviceDate: -1 }).limit(200).toArray()).map(clean)
  }
  return { error: 'Unknown tool' }
}

export async function POST(request) {
  try {
    const db = await getDb()

    // 1. Must be a real signed-in session from our own site
    if (!sameOrigin(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const auth = await getAuth(db, request)
    if (!auth || auth.via !== 'session') return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

    // 2. Role and store come from the session, never from the request body
    const role = auth.role
    const storeId = auth.storeId || null
    if (!['admin', 'store_admin'].includes(role)) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }
    if (role === 'store_admin' && !storeId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    // 3. Limit each user to 20 questions per minute (this call costs money)
    const col = db.collection('rate_limits')
    await col.createIndex({ expireAt: 1 }, { expireAfterSeconds: 0 }).catch(() => {})
    const key = `ask|${auth.username}`
    const now = Date.now()
    const rec = await col.findOne({ _id: key })
    if (rec && now - rec.first < 60000) {
      if (rec.count >= 20) return NextResponse.json({ error: 'Too many questions. Please wait a minute.' }, { status: 429 })
      await col.updateOne({ _id: key }, { $inc: { count: 1 } })
    } else {
      await col.replaceOne({ _id: key }, { _id: key, count: 1, first: now, expireAt: new Date(now + 60000) }, { upsert: true })
    }

    const body = await request.json()
    const question = typeof body.question === 'string' ? body.question.trim() : ''
    if (!question) return NextResponse.json({ error: 'No question provided' }, { status: 400 })
    if (question.length > 500) return NextResponse.json({ error: 'Question is too long. Please keep it short.' }, { status: 400 })

    const scope = { storeId: role === 'store_admin' ? storeId : null }
    const today = new Date().toLocaleDateString('en-CA')

    const scopeNote = role === 'store_admin'
      ? `The user is a Store Admin. All data you can fetch already belongs to their store, so answer from it as if that is the only data that exists. Never mention other stores.`
      : `The user is an Administrator and can see data across all stores (TS, TSS, TSW).`

    const messages = [
      { role: 'user', content: `Today's date is ${today}. ${scopeNote}\n\nQuestion: ${question}` },
    ]

    let finalText = null
    for (let i = 0; i < 5; i++) {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: `You are FleetPulse Assistant for C. Krishniah Chetty jewellery showrooms' fleet management system in Bengaluru. Answer concisely and factually using the tools provided to fetch real data — never guess or make up numbers. Use plain, friendly language. Format dates as DD Mon YYYY. Use short bullet lists when listing multiple items. Keep answers brief and focused.

If the user's message is a closing remark, a dismissal, or indicates they don't need anything else — such as "no", "nothing", "ok", "thanks", "done", "bye", or similar — respond with ONLY a short one-line acknowledgment (e.g. "Sure thing! 👋" or "No problem, have a good day!"). Do NOT list your capabilities, do NOT suggest topics, and do NOT ask "What would you like to know?" in this case. Only show the full capability list on the very first message of a conversation, never repeatedly.`,
        tools: TOOLS,
        messages,
      })

      const toolUses = response.content.filter(b => b.type === 'tool_use')
      if (toolUses.length === 0) {
        finalText = response.content.filter(b => b.type === 'text').map(b => b.text).join('\n')
        break
      }

      messages.push({ role: 'assistant', content: response.content })
      const toolResults = []
      for (const tu of toolUses) {
        const result = await runTool(db, tu.name, tu.input, scope)
        toolResults.push({ type: 'tool_result', tool_use_id: tu.id, content: JSON.stringify(result).slice(0, 15000) })
      }
      messages.push({ role: 'user', content: toolResults })
    }

    return NextResponse.json({ answer: finalText || "Sorry, I couldn't work that out — try rephrasing your question." })
  } catch (e) {
    console.error('Ask FleetPulse error:', e)
    return NextResponse.json({ error: 'Something went wrong answering that question.' }, { status: 500 })
  }
}
