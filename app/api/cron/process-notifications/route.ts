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

    // Get pending notifications from outbox (both push and inapp)
    const { data: pendingNotifications, error: fetchError } = await supabase
      .from('notification_outbox')
      .select(`
        *,
        notification:notifications(*)
      `)
      .eq('status', 'queued')
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

    // Process each notification individually
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

        let success = false
        let errorMessage = ''

        if (notification.channel === 'push') {
          // Handle push notifications
          try {
            // Get push subscription for this specific user
            const { data: subscription } = await supabase
              .from('push_subscriptions')
              .select('endpoint, p256dh, auth')
              .eq('user_id', notification.user_id)
              .eq('restaurant_id', restaurantId)
              .eq('is_active', true)
              .single()

            if (!subscription) {
              // No subscription - skip
              await supabase
                .from('notification_outbox')
                .update({
                  status: 'skipped',
                  sent_at: new Date().toISOString(),
                  error: 'No push subscription for user'
                })
                .eq('id', notification.id)

              processed++
              console.log(`⏭️  Skipped push notification ${notification.id}: No subscription`)
              continue
            }

            // Send push notification
            const result = await notificationService.sendPushToSubscription(subscription, {
              title: notification.title || 'Notification',
              body: notification.body || '',
              type: notification.type,
              priority: notification.priority || 'normal',
              url: notification.payload?.url,
              data: notification.payload?.data || {}
            })

            success = true
            console.log(`✅ Sent push notification ${notification.id}`)
          } catch (error: any) {
            errorMessage = error.message || 'Push notification failed'
            console.error(`❌ Failed push notification ${notification.id}:`, error)
          }
        } else if (notification.channel === 'inapp') {
          // Handle in-app notifications - just mark as sent since they're stored in database
          success = true
          console.log(`✅ Processed in-app notification ${notification.id}`)
        }

        if (success) {
          // Mark as sent
          await supabase
            .from('notification_outbox')
            .update({
              status: 'sent',
              sent_at: new Date().toISOString()
            })
            .eq('id', notification.id)

          processed++
        } else {
          // Mark as failed
          const retryCount = (notification.attempts || 0) + 1
          await supabase
            .from('notification_outbox')
            .update({
              status: retryCount < 3 ? 'queued' : 'failed',
              attempts: retryCount,
              error: errorMessage
            })
            .eq('id', notification.id)

          failed++
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