# Global Notification System

This document describes the global notification system implemented for booking notifications.

## Overview

The notification system provides app-wide notifications with sound alerts for booking events. It consists of:

1. **Notification Context** (`lib/contexts/notification-context.tsx`) - Global state management
2. **Notification Components** (`components/notifications/`) - UI components for displaying notifications
3. **Global Booking Hook** (`lib/hooks/use-global-booking-notifications.ts`) - Real-time booking event handling

## Features

- **App-wide notifications**: Works on any page in the app
- **Sound alerts**: Plays `booking-notification.wav` for new bookings
- **Banner notifications**: Slide-in notifications from the right side
- **Auto-dismiss**: Notifications automatically disappear after 10 seconds
- **Real-time updates**: Uses Supabase real-time subscriptions

## How It Works

### 1. Global Context
The `NotificationProvider` wraps the entire app in `app/layout.tsx` and provides:
- `addNotification()` - Add new notifications
- `removeNotification()` - Dismiss notifications
- `playNotificationSound()` - Play sound alerts

### 2. Real-time Subscriptions
The `useGlobalBookingNotifications` hook:
- Subscribes to booking table changes via Supabase real-time
- Automatically creates notifications for new bookings and status updates
- Updates React Query cache for data consistency

### 3. Notification Display
The `NotificationContainer` component:
- Renders all active notifications
- Positions them in the top-right corner
- Handles animations and stacking

## Usage

### Adding Notifications Programmatically
```tsx
import { useNotifications } from '@/lib/contexts/notification-context'

function MyComponent() {
  const { addNotification } = useNotifications()
  
  const handleBooking = () => {
    addNotification({
      type: 'booking',
      title: 'New Booking',
      message: 'John Doe booked a table for 4 guests',
      data: { bookingId: '123' }
    })
  }
}
```

### Automatic Notifications
The system automatically creates notifications for:
- New booking requests (INSERT events)
- Booking status changes (UPDATE events)
- Guest check-ins, cancellations, completions, etc.

## Sound Files

The system uses the following sound files in `/public/sounds/`:
- `booking-notification.wav` - For new bookings and booking updates
- `notification-new.mp3` - For general new notifications
- `notification-update.mp3` - For general updates

## Configuration

### Enable/Disable Notifications
```tsx
// In dashboard layout
useGlobalBookingNotifications({ 
  restaurantId: restaurantId, 
  enabled: true // Set to false to disable
})
```

### Notification Types
- `booking` - Booking-related notifications (plays booking-notification.wav)
- `order` - Order-related notifications
- `general` - General notifications

## Testing

Use the `NotificationTest` component to test notifications:
```tsx
import { NotificationTest } from '@/components/notifications/notification-test'

// Add to any page for testing
<NotificationTest />
```

## Browser Compatibility

- Requires modern browsers with Web Audio API support
- Gracefully degrades if audio fails to play
- Uses CSS animations for smooth transitions

## Troubleshooting

### No Sound Playing
1. Check browser audio permissions
2. Verify sound files exist in `/public/sounds/`
3. Check browser console for audio errors

### Notifications Not Appearing
1. Verify `NotificationProvider` wraps the app
2. Check real-time connection status
3. Verify restaurant ID is valid

### Performance
- Notifications auto-remove after 10 seconds
- Maximum of 5 notifications shown at once
- Real-time subscriptions are cleaned up on unmount
