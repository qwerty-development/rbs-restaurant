import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  let payload: any = null
  try {
    payload = await request.json()
  } catch (e) {
    console.error('[StaffAI Proxy] Failed to parse request body', e)
    return NextResponse.json({ status: 'error', error: 'Invalid JSON body' }, { status: 400 })
  }

  const baseUrl = process.env.RESTOAI_BASE_URL || 'https://restoai-sigma.vercel.app'
  const url = `${baseUrl}/api/staff/chat`

  const startedAt = Date.now()

  try {
    const upstream = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      cache: 'no-store',
    })

    const durationMs = Date.now() - startedAt
    const text = await upstream.text()

    // Try to return JSON if possible; otherwise return text
    try {
      const data = JSON.parse(text)
      return NextResponse.json(data, { status: upstream.status })
    } catch {
      return new NextResponse(text, {
        status: upstream.status,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      })
    }
  } catch (error: any) {
    console.error('[StaffAI Proxy] Request failed', { name: error?.name, message: error?.message, stack: error?.stack })
    return NextResponse.json({ status: 'error', error: 'Failed to reach Staff AI' }, { status: 502 })
  }
}


