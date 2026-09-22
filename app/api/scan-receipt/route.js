import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request) {
  try {
    const { image } = await request.json()
    if (!image) return NextResponse.json({ error: 'No image provided' }, { status: 400 })

    const match = image.match(/^data:(image\/\w+);base64,(.+)$/)
    if (!match) return NextResponse.json({ error: 'Invalid image format' }, { status: 400 })
    const [, mediaType, base64Data] = match

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
