# PWA Keep-Alive Solution for Samsung Tablets

## Problem
The app was requiring a refresh when returning to it after periods of inactivity on Samsung tablets (and other mobile devices). This happens due to aggressive power management and memory optimization on mobile devices.

## Solution Overview
Implemented a comprehensive keep-alive system with multiple layers of protection:

### 1. KeepAliveManager Component (`components/pwa/keep-alive-manager.tsx`)
- **Wake Lock API**: Prevents device from sleeping while app is active
- **Heartbeat System**: Sends periodic health checks every 30 seconds
- **Visibility Detection**: Monitors when app becomes visible/hidden
- **Connection Monitoring**: Tracks connection status and attempts reconnection
- **Activity Tracking**: Monitors user activity to maintain connections
- **Automatic Reconnection**: Retries failed connections with exponential backoff

### 2. Enhanced Service Worker (`public/sw.js`)
- **Periodic Sync**: Registers periodic background sync every 30 seconds
- **Message Handling**: Communicates with main thread about app state
- **Background Health Checks**: Performs lightweight health checks in background
- **Enhanced Caching**: Better cache management for offline operation

### 3. App Visibility Handler (`components/pwa/app-visibility-handler.tsx`)
- **Data Refresh**: Automatically refreshes critical data when app becomes visible
- **Query Invalidation**: Invalidates stale React Query caches
- **Immediate Refetch**: Forces immediate refetch of critical data like kitchen orders and bookings

### 4. Enhanced PWA Provider (`components/pwa/pwa-provider.tsx`)
- **Background Sync Registration**: Registers background sync capabilities
- **Periodic Sync Registration**: Registers periodic sync for keep-alive
- **Visibility Event Handling**: Comprehensive visibility change detection
- **Service Worker Communication**: Enhanced communication with service worker
- **Online/Offline Handling**: Better network status management

### 5. Health Check API (`app/api/health/route.ts`)
- **Lightweight Endpoint**: Provides HEAD and GET endpoints for health checks
- **System Status**: Returns app health, timestamp, and uptime information

## Key Features

### Wake Lock API
- Prevents device from sleeping while app is active
- Automatically reacquires wake lock when app becomes visible
- Releases wake lock when app is hidden (with delay)

### Heartbeat System
- Sends periodic health checks to keep connections alive
- Configurable intervals (default: 30 seconds)
- Automatic reconnection on failure
- Exponential backoff for retry attempts

### Visibility Detection
- Monitors `document.hidden` state
- Tracks page focus/blur events
- User activity monitoring (mouse, keyboard, touch events)
- Automatic data refresh when app becomes visible

### Background Sync
- Periodic background sync every 30 seconds
- Background sync when coming back online
- Service worker handles sync operations
- Lightweight health checks in background

### Data Refresh Strategy
When the app becomes visible, the system automatically:
1. Invalidates critical React Query caches
2. Forces immediate refetch of kitchen orders
3. Forces immediate refetch of bookings
4. Refreshes table statistics and waitlist data
5. Updates real-time table information

## Configuration

### KeepAliveManager Config
```typescript
const config = {
  heartbeatInterval: 30000,     // 30 seconds
  visibilityCheckInterval: 5000, // 5 seconds  
  reconnectTimeout: 10000,      // 10 seconds
  maxRetries: 3                 // Max reconnection attempts
}
```

### Service Worker Features
- Periodic sync registration with 30-second intervals
- Background health checks
- Message passing between main thread and service worker
- Enhanced caching strategies

## Browser Compatibility

### Wake Lock API
- Supported in Chrome 84+, Edge 84+
- Supported in Samsung Internet 13.0+
- Fallback behavior for unsupported browsers

### Background Sync
- Supported in Chrome 49+, Edge 79+
- Supported in Samsung Internet 10.0+
- Graceful degradation for unsupported browsers

### Periodic Background Sync
- Supported in Chrome 80+, Edge 80+
- Supported in Samsung Internet 13.0+
- Fallback to regular background sync

## Testing

### Development Mode
- Connection status indicator in top-right corner
- Console logging for all keep-alive activities
- Detailed visibility change tracking

### Production Mode
- Silent operation with minimal console output
- Automatic error handling and recovery
- User-friendly toast notifications for connection issues

## Benefits

1. **No More Manual Refreshes**: App stays responsive when returning from background
2. **Better User Experience**: Seamless operation on mobile devices
3. **Automatic Recovery**: Self-healing connection issues
4. **Battery Efficient**: Smart wake lock management
5. **Offline Capable**: Enhanced offline operation with background sync
6. **Real-time Updates**: Maintains real-time connections when possible

## Troubleshooting

### If app still requires refresh:
1. Check browser console for errors
2. Verify service worker is registered
3. Check network connectivity
4. Ensure PWA is properly installed

### Common Issues:
- **Wake Lock denied**: User needs to interact with app first
- **Background sync disabled**: Check browser settings
- **Service worker not updating**: Clear browser cache and reinstall PWA

## Future Enhancements

1. **Adaptive Intervals**: Adjust heartbeat frequency based on device activity
2. **Smart Caching**: More intelligent cache invalidation strategies
3. **Connection Quality**: Monitor connection quality and adjust accordingly
4. **User Preferences**: Allow users to configure keep-alive settings
5. **Analytics**: Track keep-alive effectiveness and optimize

This solution provides a robust, multi-layered approach to keeping the PWA alive and responsive on mobile devices, particularly addressing the specific challenges with Samsung tablets and other Android devices with aggressive power management.
