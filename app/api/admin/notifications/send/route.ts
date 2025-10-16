import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface NotificationRequest {
  title: string
  body: string
  channels: string[]
  priority: 'high' | 'normal' | 'low'
  target: {
    type: 'all_users' | 'restaurant_users' | 'specific_users'
    restaurant_ids?: string[]
    user_ids?: string[]
  }
  scheduling?: {
    send_at: string
    timezone: string
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: NotificationRequest = await request.json()
    
    // Validate required fields
    if (!body.title || !body.body) {
      return NextResponse.json({ error: 'Title and body are required' }, { status: 400 })
    }

    if (!body.channels || body.channels.length === 0) {
      return NextResponse.json({ error: 'At least one channel is required' }, { status: 400 })
    }

    // Admin authentication check
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: admin } = await supabase
      .from('rbs_admins')
      .select('id')
      .eq('user_id', user.id)
      .single()
    
    if (!admin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Get target users based on criteria
    let targetUserIds: string[] = []

    if (body.target.type === 'all_users') {
      const { data: allUsers, error } = await supabase
        .from('profiles')
        .select('id')
      
      if (error) throw error
      targetUserIds = allUsers?.map((u: any) => u.id) || []

    } else if (body.target.type === 'restaurant_users') {
      if (!body.target.restaurant_ids || body.target.restaurant_ids.length === 0) {
        return NextResponse.json({ error: 'Restaurant IDs are required for restaurant targeting' }, { status: 400 })
      }

      // Get users who have bookings or interactions with selected restaurants
      const { data: restaurantUsers, error } = await supabase
        .from('bookings')
        .select('user_id')
        .in('restaurant_id', body.target.restaurant_ids)
        .neq('user_id', null)
      
      if (error) throw error
      targetUserIds = [...new Set(restaurantUsers?.map((b: any) => b.user_id as string) || [])]

    } else if (body.target.type === 'specific_users') {
      if (!body.target.user_ids || body.target.user_ids.length === 0) {
        return NextResponse.json({ error: 'User IDs are required for specific targeting' }, { status: 400 })
      }
      targetUserIds = body.target.user_ids
    }

    if (targetUserIds.length === 0) {
      return NextResponse.json({ error: 'No target users found' }, { status: 400 })
    }

    // Determine when to send
    const scheduledFor = body.scheduling?.send_at 
      ? new Date(body.scheduling.send_at).toISOString()
      : new Date().toISOString()

    // Get first restaurant ID for context (needed for push subscriptions)
    let restaurantId: string | null = null
    if (body.target.type === 'restaurant_users' && body.target.restaurant_ids && body.target.restaurant_ids.length > 0) {
      restaurantId = body.target.restaurant_ids[0]
    } else if (targetUserIds.length > 0) {
      // Try to get restaurant from first user's staff record
      const { data: staffRecord } = await supabase
        .from('restaurant_staff')
        .select('restaurant_id')
        .eq('user_id', targetUserIds[0])
        .eq('is_active', true)
        .limit(1)
        .single()
      
      restaurantId = staffRecord?.restaurant_id || null
    }

    // Create notification outbox records directly
    const outboxRecords = []
    
    for (const userId of targetUserIds) {
      for (const channel of body.channels) {
        outboxRecords.push({
          user_id: userId,
          channel: channel,
          title: body.title,
          body: body.body, // CRITICAL: Explicitly set body field
          payload: {
            restaurant_id: restaurantId,
            title: body.title,
            body: body.body,
            message: body.body, // Also include as message for compatibility
            type: 'admin_message',
            sent_by_admin: true
          },
          status: 'queued',
          priority: body.priority,
          type: 'general', // Use 'general' type which is allowed by the check constraint
          scheduled_for: scheduledFor,
          attempts: 0,
          retry_count: 0
        })
      }
    }

    // Insert all records
    const { data: insertedRecords, error: insertError } = await supabase
      .from('notification_outbox')
      .insert(outboxRecords)
      .select('id')

    if (insertError) {
      console.error('Failed to create notification records:', insertError)
      throw insertError
    }

    return NextResponse.json({ 
      success: true, 
      recipients: targetUserIds.length,
      notifications: 0, // Not creating notification records, only outbox
      queue_items: insertedRecords?.length || 0,
      scheduled: !!body.scheduling?.send_at
    })

  } catch (error) {
    console.error('Send notification error:', error)
    return NextResponse.json({ 
      error: 'Failed to send notification' 
    }, { status: 500 })
  }
}