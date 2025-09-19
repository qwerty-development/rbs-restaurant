// Service Worker v3.1 - Enhanced with aggressive keep-alive to prevent numb state
const CACHE_NAME = 'restaurant-pwa-v3.1';
const NOTIFICATION_CHECK_INTERVAL = 15000; // Check every 15 seconds (more frequent)
const HEARTBEAT_INTERVAL = 10000; // Send heartbeat every 10 seconds (more aggressive)
const SUBSCRIPTION_REFRESH_INTERVAL = 3600000; // Refresh subscription every hour
const KEEP_ALIVE_INTERVAL = 5000; // Ultra aggressive keep-alive every 5 seconds
const CRITICAL_SYNC_INTERVAL = 8000; // Critical data sync every 8 seconds

// Keep track of active intervals
let notificationCheckInterval = null;
let heartbeatInterval = null;
let subscriptionRefreshInterval = null;
let keepAliveInterval = null;
let criticalSyncInterval = null;
let lastNotificationCheck = Date.now();
let isCheckingNotifications = false;
let lastActivity = Date.now();
let isAppVisible = true;

// Install event
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker v3.1 with aggressive keep-alive...');
  self.skipWaiting(); // Force immediate activation
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker v3.1 with aggressive keep-alive...');
  event.waitUntil(
    Promise.all([
      self.clients.claim(), // Take control immediately
      startBackgroundTasks(), // Start aggressive background tasks
      checkForPendingNotifications() // Check for any pending notifications
    ])
  );
});

// Start all background tasks
async function startBackgroundTasks() {
  console.log('[SW] Starting aggressive background tasks to prevent numb state...');

  // Clear any existing intervals
  stopBackgroundTasks();

  // Start notification checking
  notificationCheckInterval = setInterval(async () => {
    if (!isCheckingNotifications) {
      await checkForPendingNotifications();
    }
  }, NOTIFICATION_CHECK_INTERVAL);

  // Start heartbeat
  heartbeatInterval = setInterval(async () => {
    await sendHeartbeat();
  }, HEARTBEAT_INTERVAL);

  // Start subscription refresh
  subscriptionRefreshInterval = setInterval(async () => {
    await refreshSubscription();
  }, SUBSCRIPTION_REFRESH_INTERVAL);

  // AGGRESSIVE KEEP-ALIVE: Ultra frequent pings to prevent service worker termination
  keepAliveInterval = setInterval(async () => {
    await keepServiceWorkerAlive();
  }, KEEP_ALIVE_INTERVAL);

  // CRITICAL DATA SYNC: Frequent syncing of essential restaurant data
  criticalSyncInterval = setInterval(async () => {
    await performCriticalDataSync();
  }, CRITICAL_SYNC_INTERVAL);

  // Initial checks
  await checkForPendingNotifications();
  await sendHeartbeat();
  await keepServiceWorkerAlive();
}

// Stop all background tasks
function stopBackgroundTasks() {
  if (notificationCheckInterval) clearInterval(notificationCheckInterval);
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  if (subscriptionRefreshInterval) clearInterval(subscriptionRefreshInterval);
  if (keepAliveInterval) clearInterval(keepAliveInterval);
  if (criticalSyncInterval) clearInterval(criticalSyncInterval);
}

// Check for pending notifications from server
async function checkForPendingNotifications() {
  if (isCheckingNotifications) return;

  isCheckingNotifications = true;
  const now = Date.now();

  // Don't check too frequently
  if (now - lastNotificationCheck < 10000) {
    isCheckingNotifications = false;
    return;
  }

  lastNotificationCheck = now;

  try {
    console.log('[SW] Checking for pending notifications...');

    // TODO: Implement notification checking endpoint when available
    // For now, just wake up the main thread to check for updates
    broadcastToClients({
      type: 'FORCE_DATA_REFRESH',
      reason: 'notification_check'
    });

  } catch (error) {
    console.error('[SW] Error checking notifications:', error);
  } finally {
    isCheckingNotifications = false;
  }
}

// Send heartbeat to keep connection alive
async function sendHeartbeat() {
  try {
    console.log('[SW] Heartbeat - keeping service worker alive');

    // Wake up main thread to ensure it's responsive
    broadcastToClients({
      type: 'SERVICE_WORKER_HEARTBEAT',
      timestamp: Date.now(),
      sw_version: '3.0'
    });

    // Force data refresh to ensure real-time connection is active
    broadcastToClients({
      type: 'FORCE_DATA_REFRESH',
      reason: 'heartbeat_keepalive'
    });

  } catch (error) {
    console.error('[SW] Heartbeat error:', error);
  }
}

// Refresh push subscription
async function refreshSubscription() {
  try {
    console.log('[SW] Refreshing push subscription...');

    const subscription = await self.registration.pushManager.getSubscription();

    if (subscription) {
      console.log('[SW] Current subscription exists, notifying main thread');

      // Notify main thread about subscription status
      broadcastToClients({
        type: 'PUSH_SUBSCRIPTION_STATUS',
        hasSubscription: true,
        timestamp: Date.now()
      });

      // TODO: Implement subscription refresh endpoint when available
      // For now, just ensure the subscription is active
      console.log('[SW] Subscription appears active');
    } else {
      console.log('[SW] No active subscription found');

      // Notify main thread that subscription is missing
      broadcastToClients({
        type: 'PUSH_SUBSCRIPTION_STATUS',
        hasSubscription: false,
        timestamp: Date.now()
      });
    }
  } catch (error) {
    console.error('[SW] Failed to refresh subscription:', error);
  }
}

// AGGRESSIVE KEEP-ALIVE: Prevent service worker termination
async function keepServiceWorkerAlive() {
  try {
    lastActivity = Date.now();

    // Ultra-aggressive approach: multiple methods to stay alive

    // 1. Broadcast to all clients to ensure bidirectional communication
    broadcastToClients({
      type: 'SERVICE_WORKER_KEEP_ALIVE',
      timestamp: lastActivity,
      sw_version: '3.1'
    });

    // 2. Force main thread to respond (ping-pong mechanism)
    broadcastToClients({
      type: 'PING_RESPONSE_REQUIRED',
      timestamp: lastActivity
    });

    // 3. Dummy fetch to keep network stack active (prevents iOS killing)
    try {
      await fetch('/favicon.ico', {
        method: 'HEAD',
        cache: 'no-cache',
        signal: AbortSignal.timeout(2000)
      });
    } catch (e) {
      // Ignore fetch errors, this is just to keep network active
    }

    // 4. Console activity to show service worker is alive
    console.log(`[SW] KEEP-ALIVE: ${new Date().toISOString()} - SW Active`);

  } catch (error) {
    console.error('[SW] Keep-alive error:', error);
  }
}

// CRITICAL DATA SYNC: Essential restaurant operations data
async function performCriticalDataSync() {
  try {
    const now = Date.now();

    // Only sync if we have restaurant data
    if (!connectionHealthData.restaurantId) {
      console.log('[SW] No restaurant ID for critical sync');
      return;
    }

    console.log('[SW] CRITICAL SYNC: Checking for urgent updates...');

    // Force main thread to refresh critical data
    broadcastToClients({
      type: 'CRITICAL_DATA_SYNC',
      timestamp: now,
      reason: 'prevent_numb_state',
      priority: 'HIGH'
    });

    // If connection has been unhealthy, trigger booking sync
    if (connectionHealthData.unhealthyMinutes >= 1) {
      await syncBookingsData(connectionHealthData.restaurantId);
    }

    // Update activity timestamp
    lastActivity = now;

  } catch (error) {
    console.error('[SW] Critical sync error:', error);
  }
}

// Show notification helper
async function showNotification(data) {
  try {
    const options = {
      body: data.body || 'You have a new notification',
      icon: data.icon || '/icon-192x192.png',
      badge: '/icon-192x192.png',
      vibrate: [200, 100, 200],
      data: {
        dateOfArrival: Date.now(),
        url: data.url || '/dashboard',
        notification_id: data.notification_id,
        booking_id: data.booking_id,
        ...data.data
      },
      actions: [
        { action: 'view', title: 'View' },
        { action: 'dismiss', title: 'Dismiss' }
      ],
      tag: data.tag || `notification-${Date.now()}`,
      renotify: true,
      requireInteraction: true, // Force interaction
      silent: false,
      timestamp: Date.now()
    };
    
    await self.registration.showNotification(
      data.title || 'New Notification',
      options
    );

    // TODO: Implement mark-delivered endpoint when available
    console.log('[SW] Notification shown:', data.title || 'New Notification');
  } catch (error) {
    console.error('[SW] Error showing notification:', error);
  }
}

// Push event - handle incoming push notifications
self.addEventListener('push', async (event) => {
  console.log('[SW] Push notification received');
  
  // Reset background tasks on push
  startBackgroundTasks();
  
  let data = {};
  
  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (e) {
    console.error('[SW] Failed to parse push data:', e);
    data = {
      title: 'New Notification',
      body: event.data ? event.data.text() : 'You have a new notification'
    };
  }
  
  event.waitUntil(
    showNotification(data)
  );
  
  // Also check for any other pending notifications
  event.waitUntil(
    checkForPendingNotifications()
  );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.action);
  
  event.notification.close();
  
  if (event.action === 'dismiss') {
    return;
  }
  
  const urlToOpen = event.notification.data?.url || '/dashboard';
  
  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.postMessage({
            type: 'NAVIGATE_TO',
            url: urlToOpen
          });
          return client.focus();
        }
      }
      
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Background sync event
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync triggered:', event.tag);
  
  if (event.tag === 'check-notifications') {
    event.waitUntil(checkForPendingNotifications());
  }
});

// Periodic background sync
self.addEventListener('periodicsync', (event) => {
  console.log('[SW] Periodic sync triggered:', event.tag);
  
  if (event.tag === 'check-notifications') {
    event.waitUntil(checkForPendingNotifications());
  }
});

// Message event for client communication - removed duplicate, using enhanced version below

// Fetch event - keep service worker alive
self.addEventListener('fetch', (event) => {
  // Keep alive by handling fetch
  if (event.request.url.includes('/api/notifications/')) {
    // Reset timers on notification-related requests
    lastNotificationCheck = Date.now() - NOTIFICATION_CHECK_INTERVAL + 5000;
  }
});

// Helper function to convert VAPID key
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  
  const rawData = self.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Connection Health Tracking
let connectionHealthData = {};
let lastHealthUpdate = 0;
let connectionRecoveryInterval = null;

// Handle connection health updates from main thread
function handleConnectionHealthUpdate(data) {
  connectionHealthData = data;
  lastHealthUpdate = Date.now();

  console.log('[SW] Connection health update:', {
    healthy: data.healthStatus?.isHealthy,
    unhealthyMinutes: data.unhealthyMinutes,
    restaurantId: data.restaurantId
  });

  // If connection is unhealthy for more than 3 minutes, start aggressive background sync
  if (data.unhealthyMinutes >= 3) {
    startConnectionRecovery(data.restaurantId);
  } else {
    stopConnectionRecovery();
  }
}

// Start aggressive connection recovery
function startConnectionRecovery(restaurantId) {
  if (connectionRecoveryInterval) return; // Already running

  console.log('[SW] Starting connection recovery mode');

  connectionRecoveryInterval = setInterval(async () => {
    console.log('[SW] Attempting background data sync...');

    try {
      // Fetch critical booking data directly
      const response = await fetch(`/api/background-sync/bookings?restaurantId=${restaurantId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (response.ok) {
        const data = await response.json();

        // Notify main thread of new data
        broadcastToClients({
          type: 'BACKGROUND_SYNC_COMPLETE',
          data: {
            bookings: data.bookings,
            timestamp: Date.now()
          }
        });

        console.log('[SW] Background sync successful');
      }
    } catch (error) {
      console.error('[SW] Background sync failed:', error);
    }

    // Force main thread to attempt reconnection
    broadcastToClients({
      type: 'FORCE_DATA_REFRESH',
      reason: 'connection_recovery'
    });

  }, 10000); // Every 10 seconds in recovery mode
}

// Stop connection recovery
function stopConnectionRecovery() {
  if (connectionRecoveryInterval) {
    clearInterval(connectionRecoveryInterval);
    connectionRecoveryInterval = null;
    console.log('[SW] Stopped connection recovery mode');
  }
}

// Broadcast message to all clients
async function broadcastToClients(message) {
  try {
    const clients = await self.clients.matchAll({
      includeUncontrolled: true,
      type: 'window'
    });

    for (const client of clients) {
      client.postMessage(message);
    }
  } catch (error) {
    console.error('[SW] Error broadcasting to clients:', error);
  }
}

// Enhanced background sync for bookings
async function syncBookingsData(restaurantId) {
  try {
    console.log('[SW] Syncing bookings data for restaurant:', restaurantId);

    const response = await fetch(`/api/background-sync/bookings?restaurantId=${restaurantId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (response.ok) {
      const data = await response.json();

      // Check for new bookings since last sync
      if (data.newBookingsCount > 0) {
        console.log(`[SW] Found ${data.newBookingsCount} new bookings`);

        // Show notification for new bookings
        await showNotification({
          title: 'New Booking Request',
          body: `${data.newBookingsCount} new booking${data.newBookingsCount > 1 ? 's' : ''} require your attention`,
          tag: 'new-bookings',
          data: { bookings: data.newBookings },
          requireInteraction: true
        });
      }

      // Notify main thread
      broadcastToClients({
        type: 'BACKGROUND_SYNC_COMPLETE',
        data: {
          bookings: data.bookings,
          newBookingsCount: data.newBookingsCount,
          timestamp: Date.now()
        }
      });

      return true;
    }
  } catch (error) {
    console.error('[SW] Error syncing bookings:', error);
  }

  return false;
}

// Enhanced message handling
self.addEventListener('message', async (event) => {
  console.log('[SW] Message received:', event.data?.type);

  const { type, data } = event.data || {};

  switch (type) {
    case 'CHECK_NOTIFICATIONS':
      await checkForPendingNotifications();
      break;

    case 'START_BACKGROUND_TASKS':
      await startBackgroundTasks();
      break;

    case 'REFRESH_SUBSCRIPTION':
      await refreshSubscription();
      break;

    case 'CONNECTION_HEALTH_UPDATE':
      handleConnectionHealthUpdate(data);
      break;

    case 'FORCE_BACKGROUND_SYNC':
      if (data?.restaurantId) {
        await syncBookingsData(data.restaurantId);
      }
      break;

    case 'STOP_CONNECTION_RECOVERY':
      stopConnectionRecovery();
      break;

    // ANTI-NUMB MECHANISMS
    case 'PING_REQUEST':
      // Respond to ping to prove service worker is alive
      broadcastToClients({
        type: 'PONG_RESPONSE',
        timestamp: Date.now(),
        originalPing: data?.timestamp
      });
      lastActivity = Date.now();
      break;

    case 'APP_VISIBILITY_CHANGE':
      // Track app visibility to adjust sync frequency
      isAppVisible = data?.isVisible || false;
      console.log('[SW] App visibility changed:', isAppVisible ? 'visible' : 'hidden');

      if (isAppVisible) {
        // App became visible - restart all tasks aggressively
        await startBackgroundTasks();
        await keepServiceWorkerAlive();
        await performCriticalDataSync();
      }
      break;

    case 'EMERGENCY_WAKE_UP':
      // Emergency wake-up call from main thread
      console.log('[SW] EMERGENCY WAKE-UP received');
      lastActivity = Date.now();
      await startBackgroundTasks();
      await keepServiceWorkerAlive();
      break;

    default:
      console.log('[SW] Unknown message type:', type);
  }
});

// Enhanced background sync event
self.addEventListener('sync', async (event) => {
  console.log('[SW] Background sync triggered:', event.tag);

  if (event.tag === 'check-notifications') {
    event.waitUntil(checkForPendingNotifications());
  } else if (event.tag.startsWith('sync-bookings-')) {
    const restaurantId = event.tag.replace('sync-bookings-', '');
    event.waitUntil(syncBookingsData(restaurantId));
  }
});

// Periodic check for stale connections
setInterval(() => {
  const now = Date.now();
  const timeSinceLastUpdate = now - lastHealthUpdate;

  // If no health updates for 2 minutes and we have connection data
  if (timeSinceLastUpdate > 120000 && connectionHealthData.restaurantId) {
    console.log('[SW] No health updates for 2 minutes, forcing recovery');
    startConnectionRecovery(connectionHealthData.restaurantId);

    // Wake up main thread
    broadcastToClients({
      type: 'FORCE_DATA_REFRESH',
      reason: 'stale_connection_check'
    });
  }
}, 60000); // Check every minute

// Start background tasks immediately
startBackgroundTasks();

// FINAL SAFETY NET: Ultra-aggressive fallback interval that cannot be stopped
// This is the last line of defense against the service worker going numb
setInterval(async () => {
  try {
    const now = Date.now();
    const timeSinceLastActivity = now - lastActivity;

    // If no activity for 30 seconds, trigger emergency procedures
    if (timeSinceLastActivity > 30000) {
      console.log('[SW] EMERGENCY: No activity for 30s, triggering revival procedures');

      // Force all intervals to restart
      await startBackgroundTasks();

      // Emergency wake-up call to main thread
      broadcastToClients({
        type: 'SERVICE_WORKER_EMERGENCY_REVIVAL',
        timeSinceLastActivity,
        timestamp: now,
        message: 'Service worker was dormant for 30+ seconds'
      });

      // Force data refresh
      broadcastToClients({
        type: 'EMERGENCY_DATA_REFRESH',
        reason: 'service_worker_revival'
      });

      lastActivity = now;
    }

    // Always keep some activity going
    await keepServiceWorkerAlive();

  } catch (error) {
    console.error('[SW] Emergency interval error:', error);
  }
}, 15000); // Every 15 seconds - emergency fallback

console.log('[SW] Service Worker v3.1 fully loaded with aggressive anti-numb protection');