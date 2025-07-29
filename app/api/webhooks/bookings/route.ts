// app/api/webhooks/bookings/route.ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Webhook secret for verification (store in env variables)
const WEBHOOK_SECRET = process.env.BOOKING_WEBHOOK_SECRET

export async function POST(request: NextRequest) {
  try {
    // Verify webhook signature
    const signature = request.headers.get('x-webhook-signature')
    if (!signature || signature !== WEBHOOK_SECRET) {
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { event, data } = body

    const supabase = createClient()

    switch (event) {
      case 'booking.created':
        await handleBookingCreated(supabase, data)
        break
        
      case 'booking.confirmed':
        await handleBookingConfirmed(supabase, data)
        break
        
      case 'booking.cancelled':
        await handleBookingCancelled(supabase, data)
        break
        
      case 'booking.completed':
        await handleBookingCompleted(supabase, data)
        break
        
      case 'booking.no_show':
        await handleBookingNoShow(supabase, data)
        break
        
      default:
        return NextResponse.json(
          { error: 'Unknown event type' },
          { status: 400 }
        )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function handleBookingCreated(supabase: any, data: any) {
  const { booking_id, restaurant_id, user_id } = data

  // Send notification to restaurant
  await supabase.from('notifications').insert({
    restaurant_id,
    type: 'new_booking',
    title: 'New Booking Received',
    message: `A new booking has been made for ${data.party_size} guests`,
    data: { booking_id },
  })

  // Update restaurant stats
  await supabase.rpc('increment_restaurant_stat', {
    restaurant_id,
    stat_name: 'total_bookings',
    increment_by: 1,
  })

  // Send confirmation email (integrate with email service)
  // await sendBookingConfirmationEmail(data)
}

async function handleBookingConfirmed(supabase: any, data: any) {
  const { booking_id, user_id } = data

  // Send confirmation notification to user
  if (user_id) {
    await supabase.from('user_notifications').insert({
      user_id,
      type: 'booking_confirmed',
      title: 'Booking Confirmed',
      message: 'Your booking has been confirmed by the restaurant',
      data: { booking_id },
    })
  }

  // Send confirmation SMS (integrate with SMS service)
  // await sendConfirmationSMS(data)
}

async function handleBookingCancelled(supabase: any, data: any) {
  const { booking_id, restaurant_id, user_id, cancelled_by } = data

  // Release tables
  await supabase
    .from('booking_tables')
    .delete()
    .eq('booking_id', booking_id)

  // Send cancellation notification
  const notificationType = cancelled_by === 'user' ? 'booking_cancelled_by_user' : 'booking_cancelled_by_restaurant'
  
  if (cancelled_by === 'user' && restaurant_id) {
    await supabase.from('notifications').insert({
      restaurant_id,
      type: notificationType,
      title: 'Booking Cancelled',
      message: 'A customer has cancelled their booking',
      data: { booking_id },
    })
  } else if (cancelled_by === 'restaurant' && user_id) {
    await supabase.from('user_notifications').insert({
      user_id,
      type: notificationType,
      title: 'Booking Cancelled',
      message: 'Your booking has been cancelled by the restaurant',
      data: { booking_id },
    })
  }

  // Update stats
  await supabase.rpc('decrement_restaurant_stat', {
    restaurant_id,
    stat_name: 'pending_bookings',
    decrement_by: 1,
  })
}

async function handleBookingCompleted(supabase: any, data: any) {
  const { booking_id, restaurant_id, user_id, party_size } = data

  // Award loyalty points
  if (user_id) {
    const pointsToAward = await calculateLoyaltyPoints(supabase, {
      restaurant_id,
      party_size,
      booking_time: data.booking_time,
    })

    if (pointsToAward > 0) {
      await supabase.from('loyalty_transactions').insert({
        user_id,
        restaurant_id,
        booking_id,
        points: pointsToAward,
        transaction_type: 'earned',
        description: 'Points earned from completed booking',
      })

      // Update user's loyalty points
      await supabase.rpc('increment_user_loyalty_points', {
        user_id,
        restaurant_id,
        points: pointsToAward,
      })
    }

    // Request review after some delay
    await scheduleReviewRequest(booking_id, user_id, restaurant_id)
  }

  // Update restaurant stats
  await supabase.rpc('increment_restaurant_stat', {
    restaurant_id,
    stat_name: 'completed_bookings',
    increment_by: 1,
  })
}

async function handleBookingNoShow(supabase: any, data: any) {
  const { booking_id, restaurant_id, user_id } = data

  // Update user's no-show count
  if (user_id) {
    await supabase.rpc('increment_user_no_shows', {
      user_id,
      restaurant_id,
    })

    // Check if user should be flagged
    const { data: userStats } = await supabase
      .from('user_restaurant_stats')
      .select('no_show_count')
      .eq('user_id', user_id)
      .eq('restaurant_id', restaurant_id)
      .single()

    if (userStats?.no_show_count >= 3) {
      // Flag user for review
      await supabase.from('flagged_users').insert({
        user_id,
        restaurant_id,
        reason: 'excessive_no_shows',
        flag_count: userStats.no_show_count,
      })
    }
  }

  // Release tables
  await supabase
    .from('booking_tables')
    .delete()
    .eq('booking_id', booking_id)
}

async function calculateLoyaltyPoints(supabase: any, params: any) {
  const { restaurant_id, party_size, booking_time } = params

  // Get active loyalty rules
  const { data: rules } = await supabase
    .from('restaurant_loyalty_rules')
    .select('*')
    .eq('restaurant_id', restaurant_id)
    .eq('is_active', true)
    .gte('valid_from', new Date().toISOString())
    .or(`valid_until.is.null,valid_until.gte.${new Date().toISOString()}`)

  if (!rules || rules.length === 0) return 0

  // Calculate points based on applicable rules
  let totalPoints = 0
  const bookingDate = new Date(booking_time)
  const dayOfWeek = bookingDate.getDay()
  const bookingHour = bookingDate.getHours()
  const bookingMinutes = bookingHour * 60 + bookingDate.getMinutes()

  for (const rule of rules) {
    // Check if rule applies
    if (
      rule.applicable_days.includes(dayOfWeek) &&
      party_size >= rule.minimum_party_size &&
      (!rule.maximum_party_size || party_size <= rule.maximum_party_size) &&
      (!rule.start_time_minutes || bookingMinutes >= rule.start_time_minutes) &&
      (!rule.end_time_minutes || bookingMinutes <= rule.end_time_minutes)
    ) {
      totalPoints += rule.points_to_award
    }
  }

  return totalPoints
}

async function scheduleReviewRequest(booking_id: string, user_id: string, restaurant_id: string) {
  // Schedule a review request for 24 hours after the booking
  // This would typically integrate with a job queue service
  
  // For now, just create a scheduled task record
  const supabase = createClient()
  await supabase.from('scheduled_tasks').insert({
    task_type: 'review_request',
    scheduled_for: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    data: { booking_id, user_id, restaurant_id },
    status: 'pending',
  })
}