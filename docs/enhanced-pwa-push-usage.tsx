// Example: Using Enhanced PWA Push Notification System
// Add to dashboard component or main layout

import { useRealtimePushBridge } from '@/lib/services/realtime-push-bridge'
import { useRestaurantContext } from '@/lib/contexts/restaurant-context'

export function ExampleDashboardWithPushBridge() {
  const { currentRestaurant } = useRestaurantContext()
  
  // Initialize the real-time push bridge
  const { isInitialized, status } = useRealtimePushBridge({
    restaurantId: currentRestaurant?.restaurant.id || '',
    enableBookingNotifications: true,
    enableOrderNotifications: true,
    enableSystemNotifications: true
  })

  return (
    <div className="dashboard">
      {/* Your dashboard content */}
      
      {isInitialized && (
        <div className="push-bridge-status">
          <h4>Real-time Push Notifications</h4>
          <p>Status: {status?.pushStatus?.canSendNotifications ? '✅ Active' : '❌ Inactive'}</p>
          <p>Connection: {status?.connectionStatus?.isConnected ? '🟢 Online' : '🔴 Offline'}</p>
          <p>Active Subscriptions: {status?.activeSubscriptions?.join(', ')}</p>
        </div>
      )}
    </div>
  )
}

/*
USAGE PATTERN:

1. The bridge automatically listens for real-time events on:
   - bookings table (new bookings, status changes)
   - orders table (new orders, status changes)  
   - restaurant_staff table (staff changes)

2. When events occur, it automatically sends push notifications:
   - "📅 New Booking Request" for new bookings
   - "🍽️ New Order" for new orders
   - "✅ Booking Confirmed" for status changes
   - And more...

3. Push notifications are enhanced with connection awareness:
   - Offline notifications show "[Offline]" prefix
   - Include sync status information
   - Adapt behavior based on connection state

4. Everything is coordinated with our enhanced real-time system:
   - Uses same connection manager
   - Shares connection stats
   - Handles reconnection automatically
   - PWA lifecycle aware

BENEFITS:
✅ Staff get immediate notifications for important events
✅ Works offline with enhanced messaging  
✅ Automatic reconnection and sync
✅ No duplicate subscriptions or conflicts
✅ Integrated with existing PWA system
✅ Connection status visibility
*/