'use server'

import webpush from 'web-push'

// Configure VAPID details
webpush.setVapidDetails(
  'mailto:your-restaurant@example.com',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

// In-memory storage for demo purposes
// In production, you would store subscriptions in your database
let subscriptions: PushSubscription[] = []

export interface NotificationPayload {
  title: string
  body: string
  icon?: string
  url?: string
  id?: string
}

export async function subscribeUser(subscription: PushSubscription) {
  try {
    // Check if subscription already exists
    const existingIndex = subscriptions.findIndex(
      sub => sub.endpoint === subscription.endpoint
    )
    
    if (existingIndex >= 0) {
      // Update existing subscription
      subscriptions[existingIndex] = subscription
    } else {
      // Add new subscription
      subscriptions.push(subscription)
    }
    
    console.log('User subscribed to push notifications:', subscription.endpoint)
    
    // In production, you would save this to your database:
    // await db.pushSubscriptions.upsert({
    //   where: { endpoint: subscription.endpoint },
    //   update: { subscription },
    //   create: { subscription, userId: currentUser.id }
    // })
    
    return { success: true }
  } catch (error) {
    console.error('Error subscribing user:', error)
    return { success: false, error: 'Failed to subscribe user' }
  }
}

export async function unsubscribeUser(endpoint?: string) {
  try {
    if (endpoint) {
      // Remove specific subscription
      subscriptions = subscriptions.filter(sub => sub.endpoint !== endpoint)
    } else {
      // Clear all subscriptions (for demo purposes)
      subscriptions = []
    }
    
    console.log('User unsubscribed from push notifications')
    
    // In production, you would remove from database:
    // await db.pushSubscriptions.delete({
    //   where: { endpoint }
    // })
    
    return { success: true }
  } catch (error) {
    console.error('Error unsubscribing user:', error)
    return { success: false, error: 'Failed to unsubscribe user' }
  }
}

export async function sendNotification(payload: NotificationPayload) {
  try {
    if (subscriptions.length === 0) {
      return { success: false, error: 'No subscriptions available' }
    }

    const notificationPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      icon: payload.icon || '/icon-192x192.png',
      url: payload.url || '/dashboard',
      id: payload.id || Date.now().toString()
    })

    // Send notification to all subscribed users
    const results = await Promise.allSettled(
      subscriptions.map(subscription =>
        webpush.sendNotification(subscription as any, notificationPayload)
      )
    )

    const successful = results.filter(result => result.status === 'fulfilled').length
    const failed = results.filter(result => result.status === 'rejected').length

    console.log(`Notifications sent: ${successful} successful, ${failed} failed`)

    // Remove failed subscriptions (they're probably expired)
    const validSubscriptions: PushSubscription[] = []
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        validSubscriptions.push(subscriptions[index])
      }
    })
    subscriptions = validSubscriptions

    return { 
      success: true, 
      sent: successful, 
      failed,
      message: `Sent to ${successful} devices${failed > 0 ? `, ${failed} failed` : ''}` 
    }
  } catch (error) {
    console.error('Error sending push notification:', error)
    return { success: false, error: 'Failed to send notification' }
  }
}

// Utility function to send booking-related notifications
export async function sendBookingNotification(
  type: 'new_booking' | 'booking_reminder' | 'booking_cancelled',
  bookingDetails: {
    customerName: string
    date: string
    time: string
    partySize: number
    tableNumber?: string
  }
) {
  let title: string
  let body: string
  let url = '/bookings'

  switch (type) {
    case 'new_booking':
      title = '🍽️ New Booking Received'
      body = `${bookingDetails.customerName} - ${bookingDetails.partySize} guests on ${bookingDetails.date} at ${bookingDetails.time}`
      break
    case 'booking_reminder':
      title = '⏰ Booking Reminder'
      body = `${bookingDetails.customerName} - ${bookingDetails.partySize} guests arriving soon${bookingDetails.tableNumber ? ` at Table ${bookingDetails.tableNumber}` : ''}`
      url = '/dashboard'
      break
    case 'booking_cancelled':
      title = '❌ Booking Cancelled'
      body = `${bookingDetails.customerName} - ${bookingDetails.partySize} guests on ${bookingDetails.date} at ${bookingDetails.time}`
      break
  }

  return await sendNotification({
    title,
    body,
    url,
    id: `booking_${type}_${Date.now()}`
  })
}

// Utility function to send waitlist notifications
export async function sendWaitlistNotification(
  customerName: string,
  estimatedWaitTime?: number
) {
  const title = '📋 Waitlist Update'
  const body = estimatedWaitTime
    ? `${customerName} - estimated wait time: ${estimatedWaitTime} minutes`
    : `${customerName} has joined the waitlist`

  return await sendNotification({
    title,
    body,
    url: '/waitlist',
    id: `waitlist_${Date.now()}`
  })
}