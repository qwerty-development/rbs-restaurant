import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { notificationService } from '@/lib/services/notification-service'

export async function POST(request: NextRequest) {
  try {
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer rbs-restaurant-cron-2025-secure-key-x7n9m4p8q2L`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Create service role client for cron job
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Get pending notifications from outbox
    const { data: pendingNotifications, error: fetchError } = await supabase
      .from('notification_outbox')
      .select(`
        *,
        notification:notifications(*)
      `)
      .eq('status', 'queued')
      .eq('channel', 'push')
      .lte('scheduled_for', new Date().toISOString())
      .limit(50) // Process in batches

    if (fetchError) {
      console.error('Failed to fetch pending notifications:', fetchError)
      return NextResponse.json(
        { error: 'Failed to fetch notifications' },
        { status: 500 }
      )
    }

    if (!pendingNotifications || pendingNotifications.length === 0) {
      return NextResponse.json({
        success: true,
        processed: 0,
        message: 'No pending notifications'
      })
    }

    let processed = 0
    let failed = 0

    // Process each notification
    for (const notification of pendingNotifications) {
      try {
        // Get restaurant_id from the notification data
        const restaurantId = notification.payload?.restaurant_id
        if (!restaurantId) {
          console.warn('No restaurant_id in notification payload:', notification.id)
          // Mark as failed - missing restaurant_id
          await supabase
            .from('notification_outbox')
            .update({
              status: 'failed',
              error: 'Missing restaurant_id in payload'
            })
            .eq('id', notification.id)
          failed++
          continue
        }

        // Send the notification
        const result = await notificationService.sendToRestaurant(
          restaurantId,
          {
            title: notification.title || notification.payload?.title || 'Notification',
            body: notification.body || notification.payload?.body || notification.payload?.message || '',
            type: notification.type,
            priority: notification.priority || 'normal',
            url: notification.payload?.url,
            data: notification.payload?.data || {}
          }
        )

        if (result.success && result.sent > 0) {
          // Successfully sent to at least one device
          await supabase
            .from('notification_outbox')
            .update({
              status: 'sent',
              sent_at: new Date().toISOString()
            })
            .eq('id', notification.id)

          processed++
          console.log(`✅ Sent notification ${notification.id} to ${result.sent} devices`)
        } else if (result.success && result.sent === 0) {
          // No active subscriptions - skip this notification
          await supabase
            .from('notification_outbox')
            .update({
              status: 'skipped',
              sent_at: new Date().toISOString(),
              error: result.error || 'No active subscriptions'
            })
            .eq('id', notification.id)

          processed++
          console.log(`⏭️  Skipped notification ${notification.id}: ${result.error}`)
        } else {
          // Failed to send
          const retryCount = (notification.attempts || 0) + 1
          await supabase
            .from('notification_outbox')
            .update({
              status: retryCount < 3 ? 'queued' : 'failed',
              attempts: retryCount,
              error: result.error
            })
            .eq('id', notification.id)

          failed++
          console.log(`❌ Failed notification ${notification.id}: ${result.error}`)
        }
      } catch (error: any) {
        console.error(`Failed to process notification ${notification.id}:`, error)

        // Mark as failed
        const retryCount = (notification.attempts || 0) + 1
        await supabase
          .from('notification_outbox')
          .update({
            status: retryCount < 3 ? 'queued' : 'failed',
            attempts: retryCount,
            error: error.message
          })
          .eq('id', notification.id)

        failed++
      }
    }

    return NextResponse.json({
      success: true,
      processed,
      failed,
      total: pendingNotifications.length
    })
  } catch (error: any) {
    console.error('Cron job error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}