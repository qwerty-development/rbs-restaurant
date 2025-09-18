import { NextResponse } from 'next/server'
import { NotificationService } from '@/lib/services/notification-service'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const { title, body } = await request.json()
    if (!title || !body) {
      return NextResponse.json({ error: 'Missing title/body' }, { status: 400 })
    }

    // Admin-only: verify user is an admin
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { data: admin } = await supabase
      .from('rbs_admins')
      .select('id')
      .eq('user_id', user.id)
      .single()
    if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    // Send to all active subscriptions across all restaurants
    const service = new NotificationService()

    // Fetch all active subscriptions
    const { data: subs, error } = await (service as any).supabase
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth, user_id, restaurant_id, is_active')
      .eq('is_active', true)
    if (error) throw error

    if (!subs || subs.length === 0) {
      return NextResponse.json({ success: true, sent: 0, failed: 0 })
    }

    // Send in parallel
    const payload = { title, body, type: 'general', priority: 'high' as const }
    const results = await Promise.allSettled(
      subs.map((s: any) => (service as any).sendPushNotification(s, payload))
    )

    let sent = 0
    let failed = 0
    results.forEach((r) => { if (r.status === 'fulfilled') sent++; else failed++; })

    return NextResponse.json({ success: true, sent, failed })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Broadcast failed' }, { status: 500 })
  }
}


