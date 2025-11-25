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
      // Fetch ALL users in batches (Supabase default limit is 1000)
      let allUsers: any[] = []
      let from = 0
      const batchSize = 1000
      let hasMore = true

      while (hasMore) {
        const { data: batch, error } = await supabase
          .from('profiles')
          .select('id')
          .range(from, from + batchSize - 1)
        
        if (error) throw error
        
        if (batch && batch.length > 0) {
          allUsers = allUsers.concat(batch)
          from += batchSize
          hasMore = batch.length === batchSize
        } else {
          hasMore = false
        }
      }
      
      targetUserIds = allUsers.map((u: any) => u.id)
      console.log(`[Admin Notifications] Targeting ${targetUserIds.length} users (all users)`)

    } else if (body.target.type === 'restaurant_users') {
      if (!body.target.restaurant_ids || body.target.restaurant_ids.length === 0) {
        return NextResponse.json({ error: 'Restaurant IDs are required for restaurant targeting' }, { status: 400 })
      }

      // Get ALL users who have bookings or interactions with selected restaurants
      let restaurantUsers: any[] = []
      let from = 0
      const batchSize = 1000
      let hasMore = true

      while (hasMore) {
        const { data: batch, error } = await supabase
          .from('bookings')
          .select('user_id')
          .in('restaurant_id', body.target.restaurant_ids)
          .neq('user_id', null)
          .range(from, from + batchSize - 1)
        
        if (error) throw error
        
        if (batch && batch.length > 0) {
          restaurantUsers = restaurantUsers.concat(batch)
          from += batchSize
          hasMore = batch.length === batchSize
        } else {
          hasMore = false
        }
      }
      
      targetUserIds = [...new Set(restaurantUsers.map((b: any) => b.user_id as string))]
      console.log(`[Admin Notifications] Targeting ${targetUserIds.length} users from ${body.target.restaurant_ids.length} restaurant(s)`)

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
    // Create notification outbox records in chunks
    const CHUNK_SIZE = 1000
    let processedCount = 0
    
    // Process users in chunks to avoid memory issues and payload limits
    for (let i = 0; i < targetUserIds.length; i += CHUNK_SIZE) {
      const userChunk = targetUserIds.slice(i, i + CHUNK_SIZE)
      const outboxRecords = []
      
      for (const userId of userChunk) {
        for (const channel of body.channels) {
          outboxRecords.push({
            user_id: userId,
            channel: channel,
            title: body.title,
            body: body.body,
            payload: {
              restaurant_id: restaurantId,
              title: body.title,
              body: body.body,
              message: body.body,
              type: 'admin_message',
              sent_by_admin: true
            },
            status: 'queued',
            priority: body.priority,
            type: 'general',
            scheduled_for: scheduledFor,
            attempts: 0,
            retry_count: 0
          })
        }
      }

      // Insert chunk
      if (outboxRecords.length > 0) {
        const { error: insertError } = await supabase
          .from('notification_outbox')
          .insert(outboxRecords)
        
        if (insertError) {
          console.error(`Failed to insert notification chunk ${i / CHUNK_SIZE + 1}:`, insertError)
          // Continue with other chunks but log error
        } else {
          processedCount += outboxRecords.length
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      recipients: targetUserIds.length,
      notifications: 0, // Not creating notification records, only outbox
      queue_items: processedCount,
      scheduled: !!body.scheduling?.send_at
    })

  } catch (error) {
    console.error('Send notification error:', error)
    return NextResponse.json({ 
      error: 'Failed to send notification' 
    }, { status: 500 })
  }
}