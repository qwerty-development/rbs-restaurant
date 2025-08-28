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

  // Validate required fields
  if (!payload.message || typeof payload.message !== 'string' || payload.message.trim() === '') {
    return NextResponse.json({ 
      status: 'error', 
      error: 'Message is required' 
    }, { status: 400 })
  }

  const baseUrl = process.env.RESTOAI_BASE_URL || 'https://ai-agent-two-theta.vercel.app'
  const url = `${baseUrl}/api/staff/chat`

  const startedAt = Date.now()

  try {
    const upstream = await fetch(url, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
    })

    const durationMs = Date.now() - startedAt
    const text = await upstream.text()

    console.log('[StaffAI Proxy] Response received', {
      status: upstream.status,
      ok: upstream.ok,
      durationMs,
      hasBody: !!text
    })

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
    console.error('[StaffAI Proxy] Request failed', { 
      url,
      name: error?.name, 
      message: error?.message, 
      stack: error?.stack 
    })
    return NextResponse.json({ 
      status: 'error', 
      error: 'Failed to reach Staff AI service. Please try again later.' 
    }, { status: 502 })
  }
}


