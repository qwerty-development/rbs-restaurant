// Service Worker v3.0 - Enhanced with keep-alive and recovery mechanisms
const CACHE_NAME = 'restaurant-pwa-v3';
const NOTIFICATION_CHECK_INTERVAL = 30000; // Check every 30 seconds
const HEARTBEAT_INTERVAL = 25000; // Send heartbeat every 25 seconds
const SUBSCRIPTION_REFRESH_INTERVAL = 3600000; // Refresh subscription every hour

// Keep track of active intervals
let notificationCheckInterval = null;
let heartbeatInterval = null;
let subscriptionRefreshInterval = null;
let lastNotificationCheck = Date.now();
let isCheckingNotifications = false;

// Install event
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker v3.0...');
  self.skipWaiting(); // Force immediate activation
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker v3.0...');
  event.waitUntil(
    Promise.all([
      self.clients.claim(), // Take control immediately
      startBackgroundTasks(), // Start background tasks
      checkForPendingNotifications() // Check for any pending notifications
    ])
  );
});

// Start all background tasks
async function startBackgroundTasks() {
  console.log('[SW] Starting background tasks...');
  
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
  
  // Initial checks
  await checkForPendingNotifications();
  await sendHeartbeat();
}

// Stop all background tasks
function stopBackgroundTasks() {
  if (notificationCheckInterval) clearInterval(notificationCheckInterval);
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  if (subscriptionRefreshInterval) clearInterval(subscriptionRefreshInterval);
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
    
    const response = await fetch('/api/notifications/check-pending', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        timestamp: now,
        source: 'service-worker'
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      
      if (data.notifications && data.notifications.length > 0) {
        console.log(`[SW] Found ${data.notifications.length} pending notifications`);
        
        // Display each notification
        for (const notif of data.notifications) {
          await showNotification(notif);
        }
      }
    }
  } catch (error) {
    console.error('[SW] Error checking notifications:', error);
  } finally {
    isCheckingNotifications = false;
  }
}

// Send heartbeat to keep connection alive
async function sendHeartbeat() {
  try {
    const response = await fetch('/api/notifications/heartbeat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        timestamp: Date.now(),
        sw_version: '3.0'
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      
      // Process any commands from server
      if (data.command === 'check_notifications') {
        await checkForPendingNotifications();
      } else if (data.command === 'refresh_subscription') {
        await refreshSubscription();
      }
    }
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
      // Unsubscribe and resubscribe to refresh
      await subscription.unsubscribe();
      
      // Wait a bit before resubscribing
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Resubscribe
      const newSubscription = await self.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          'BKxvEr8wqJRJCN0mKfOCiT4VkCEo4VVmeATKUUGMEQ0E4H0ciBvRiWtMsJHxFmwVIdqy6ii9kwNgC7y7eoQXLzw'
        )
      });
      
      // Send to server
      await fetch('/api/notifications/refresh-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscription: newSubscription.toJSON(),
          timestamp: Date.now()
        })
      });
      
      console.log('[SW] Subscription refreshed successfully');
    }
  } catch (error) {
    console.error('[SW] Failed to refresh subscription:', error);
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
    
    // Mark as delivered
    await fetch('/api/notifications/mark-delivered', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        notification_id: data.notification_id
      })
    });
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

// Message event for client communication
self.addEventListener('message', async (event) => {
  console.log('[SW] Message received:', event.data);
  
  if (event.data?.type === 'CHECK_NOTIFICATIONS') {
    await checkForPendingNotifications();
  } else if (event.data?.type === 'START_BACKGROUND_TASKS') {
    await startBackgroundTasks();
  } else if (event.data?.type === 'REFRESH_SUBSCRIPTION') {
    await refreshSubscription();
  }
});

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
  
  const rawData = window.atob(base64);
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