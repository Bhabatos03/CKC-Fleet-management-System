import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import Anthropic from '@anthropic-ai/sdk'

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
async function seedUtilitySettingsIfEmpty(db) {
  const existing = await db.collection('utility_settings').findOne({ id: 'default' })
  if (existing) return
  await db.collection('utility_settings').insertOne({
    id: 'default',
    ebUnitRate: 5.95,
    kvaDemandRate: 370,
    ebTaxPercent: 9,
    fuelSurchargePerUnit: 0.60,
    dgUnitRate: 38,
    dgTaxPerUnit: 0.20,
    updatedAt: new Date().toISOString(),
  })
}
async function runTool(db, name, input) {
  const days = input?.days || 30
  const since = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString()

  if (name === 'get_vehicles') {
    return (await db.collection('vehicles').find({}).toArray()).map(clean)
  }
  if (name === 'get_gate_passes') {
    return (await db.collection('gatepasses').find({}).sort({ createdAt: -1 }).limit(200).toArray()).map(clean)
  }
  if (name === 'get_drivers') {
    return (await db.collection('drivers').find({}).toArray()).map(clean)
  }
  if (name === 'get_trips_summary') {
    return (await db.collection('trips').find({ dateOut: { $gte: since } }).sort({ dateOut: -1 }).limit(300).toArray()).map(clean)
  }
  if (name === 'get_fuel_summary') {
    return (await db.collection('fuel_entries').find({ date: { $gte: since } }).sort({ date: -1 }).limit(300).toArray()).map(clean)
  }
  if (name === 'get_maintenance') {
    return (await db.collection('maintenance').find({}).sort({ serviceDate: -1 }).limit(200).toArray()).map(clean)
  }
  return { error: 'Unknown tool' }
}

export async function POST(request) {
  try {
    const { question, role, storeId } = await request.json()
    if (!question) return NextResponse.json({ error: 'No question provided' }, { status: 400 })
    if (!['admin', 'store_admin'].includes(role)) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    const db = await getDb()
    const today = new Date().toLocaleDateString('en-CA')

    const scopeNote = role === 'store_admin'
      ? `The user is a Store Admin for store "${storeId}". Only consider vehicles/drivers/gate passes/trips/fuel belonging to store "${storeId}" (match on assignedLocation or storeId fields) — ignore data from other stores. Don't mention the scoping explicitly, just answer as if that's the only data that exists.`
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
        const result = await runTool(db, tu.name, tu.input)
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
