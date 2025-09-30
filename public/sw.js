// Service Worker v4.0 - ANTI-NUMB: Aggressive subscription validation and auto-refresh
const CACHE_NAME = 'restaurant-pwa-v4.0';
const NOTIFICATION_CHECK_INTERVAL = 15000; // Check every 15 seconds (more frequent)
const HEARTBEAT_INTERVAL = 10000; // Send heartbeat every 10 seconds (more aggressive)
const SUBSCRIPTION_REFRESH_INTERVAL = 120000; // Validate subscription every 2 minutes (CRITICAL!)
const SUBSCRIPTION_HEALTH_CHECK_INTERVAL = 60000; // Deep health check every 1 minute
const KEEP_ALIVE_INTERVAL = 5000; // Ultra aggressive keep-alive every 5 seconds
const CRITICAL_SYNC_INTERVAL = 8000; // Critical data sync every 8 seconds
const SUBSCRIPTION_TIMEOUT = 30000; // 30 seconds to validate subscription is alive

// Keep track of active intervals
let notificationCheckInterval = null;
let heartbeatInterval = null;
let subscriptionRefreshInterval = null;
let subscriptionHealthCheckInterval = null;
let keepAliveInterval = null;
let criticalSyncInterval = null;
let lastNotificationCheck = Date.now();
let isCheckingNotifications = false;
let lastActivity = Date.now();
let isAppVisible = true;
let lastSubscriptionValidation = 0;
let subscriptionValidationInProgress = false;
let pushTestTimeout = null;

// Install event
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker v3.1 with aggressive keep-alive...');
  self.skipWaiting(); // Force immediate activation
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker v4.0 with subscription validation...');
  event.waitUntil(
    Promise.all([
      self.clients.claim(), // Take control immediately
      validatePushSubscriptionOnActivate(), // CRITICAL: Validate subscription on activation
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

  // CRITICAL: Subscription validation every 2 minutes
  subscriptionRefreshInterval = setInterval(async () => {
    await validateAndRefreshSubscription();
  }, SUBSCRIPTION_REFRESH_INTERVAL);

  // DEEP subscription health check every minute
  subscriptionHealthCheckInterval = setInterval(async () => {
    await performSubscriptionHealthCheck();
  }, SUBSCRIPTION_HEALTH_CHECK_INTERVAL);

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
  await validateAndRefreshSubscription(); // CRITICAL: Validate subscription immediately
  await keepServiceWorkerAlive();
}

// Stop all background tasks
function stopBackgroundTasks() {
  if (notificationCheckInterval) clearInterval(notificationCheckInterval);
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  if (subscriptionRefreshInterval) clearInterval(subscriptionRefreshInterval);
  if (subscriptionHealthCheckInterval) clearInterval(subscriptionHealthCheckInterval);
  if (keepAliveInterval) clearInterval(keepAliveInterval);
  if (criticalSyncInterval) clearInterval(criticalSyncInterval);
  if (pushTestTimeout) clearTimeout(pushTestTimeout);
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

// CRITICAL: Validate push subscription on service worker activation
async function validatePushSubscriptionOnActivate() {
  try {
    console.log('[SW] Validating push subscription on activation...');
    
    const subscription = await self.registration.pushManager.getSubscription();
    
    if (subscription) {
      console.log('[SW] Push subscription exists, validating connection...');
      
      // Notify client that we have a subscription and need to validate it
      broadcastToClients({
        type: 'VALIDATE_PUSH_SUBSCRIPTION',
        subscription: subscription.toJSON(),
        timestamp: Date.now()
      });
      
      // Set up a test to ensure subscription is actually working
      await testPushSubscriptionConnection();
    } else {
      console.log('[SW] No push subscription found on activation');
      
      // Notify client to create new subscription
      broadcastToClients({
        type: 'PUSH_SUBSCRIPTION_MISSING',
        reason: 'sw_activation',
        timestamp: Date.now()
      });
    }
  } catch (error) {
    console.error('[SW] Error validating subscription on activate:', error);
  }
}

// CRITICAL: Validate and refresh subscription
async function validateAndRefreshSubscription() {
  if (subscriptionValidationInProgress) return;
  
  subscriptionValidationInProgress = true;
  const now = Date.now();
  
  try {
    console.log('[SW] Validating push subscription...');
    
    const subscription = await self.registration.pushManager.getSubscription();
    
    if (!subscription) {
      console.log('[SW] ⚠️ No subscription found - notifying client to resubscribe');
      
      broadcastToClients({
        type: 'PUSH_SUBSCRIPTION_MISSING',
        reason: 'validation_check',
        timestamp: now
      });
      
      lastSubscriptionValidation = now;
      subscriptionValidationInProgress = false;
      return;
    }
    
    // Check if subscription appears stale (older than 24 hours or expirationTime passed)
    const isStale = subscription.expirationTime && subscription.expirationTime < now;
    
    if (isStale) {
      console.log('[SW] ⚠️ Subscription is STALE - forcing refresh');
      
      // Unsubscribe the old one
      await subscription.unsubscribe();
      
      // Notify client to create fresh subscription
      broadcastToClients({
        type: 'PUSH_SUBSCRIPTION_STALE',
        reason: 'expiration_time_passed',
        timestamp: now
      });
    } else {
      // Subscription exists and appears valid, but let's test the connection
      console.log('[SW] Subscription appears valid, testing connection...');
      
      await testPushSubscriptionConnection();
      
      // Also notify client to refresh subscription data on server
      broadcastToClients({
        type: 'REFRESH_SUBSCRIPTION_ON_SERVER',
        subscription: subscription.toJSON(),
        timestamp: now
      });
    }
    
    lastSubscriptionValidation = now;
    
  } catch (error) {
    console.error('[SW] Error validating subscription:', error);
    
    // On error, force client to resubscribe
    broadcastToClients({
      type: 'PUSH_SUBSCRIPTION_ERROR',
      error: error.message,
      timestamp: now
    });
  } finally {
    subscriptionValidationInProgress = false;
  }
}

// Test if push subscription connection is actually alive
async function testPushSubscriptionConnection() {
  try {
    console.log('[SW] Testing push subscription connection...');
    
    // Clear any existing test timeout
    if (pushTestTimeout) clearTimeout(pushTestTimeout);
    
    // Request client to send a test push
    broadcastToClients({
      type: 'REQUEST_PUSH_TEST',
      timestamp: Date.now()
    });
    
    // Set timeout to check if test push is received
    // If not received within 30 seconds, subscription is dead
    pushTestTimeout = setTimeout(() => {
      console.log('[SW] ⚠️ Push test timeout - connection may be dead');
      
      broadcastToClients({
        type: 'PUSH_CONNECTION_DEAD',
        reason: 'test_push_timeout',
        timestamp: Date.now()
      });
    }, SUBSCRIPTION_TIMEOUT);
    
  } catch (error) {
    console.error('[SW] Error testing push connection:', error);
  }
}

// DEEP subscription health check
async function performSubscriptionHealthCheck() {
  try {
    const now = Date.now();
    const timeSinceLastValidation = now - lastSubscriptionValidation;
    
    // If no validation in last 5 minutes, force one
    if (timeSinceLastValidation > 300000) {
      console.log('[SW] HEALTH CHECK: No subscription validation in 5 minutes - forcing check');
      await validateAndRefreshSubscription();
      return;
    }
    
    const subscription = await self.registration.pushManager.getSubscription();
    
    if (!subscription) {
      console.log('[SW] HEALTH CHECK: No subscription - alerting client');
      
      broadcastToClients({
        type: 'PUSH_SUBSCRIPTION_MISSING',
        reason: 'health_check',
        timestamp: now
      });
    } else {
      console.log('[SW] HEALTH CHECK: Subscription exists, connection status unknown');
      
      // Ping client to ensure it's aware of subscription status
      broadcastToClients({
        type: 'SUBSCRIPTION_HEALTH_PING',
        hasSubscription: true,
        timestamp: now
      });
    }
  } catch (error) {
    console.error('[SW] Subscription health check error:', error);
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
      sw_version: '4.0'
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

// Refresh push subscription (DEPRECATED - use validateAndRefreshSubscription instead)
async function refreshSubscription() {
  await validateAndRefreshSubscription();
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
  console.log('[SW] Push notification received - CONNECTION IS ALIVE! ✅');
  
  // CRITICAL: Clear the push test timeout - we know connection is alive!
  if (pushTestTimeout) {
    clearTimeout(pushTestTimeout);
    pushTestTimeout = null;
    console.log('[SW] Push connection validated - test timeout cleared');
  }
  
  // Update last activity
  lastActivity = Date.now();
  lastSubscriptionValidation = Date.now();
  
  // Reset background tasks on push to ensure we stay alive
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
  
  // Notify client that push was received
  broadcastToClients({
    type: 'PUSH_RECEIVED',
    timestamp: Date.now(),
    data: data
  });
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

// Fetch event - keep service worker alive and validate subscription
self.addEventListener('fetch', (event) => {
  // Keep alive by handling fetch
  lastActivity = Date.now();
  
  if (event.request.url.includes('/api/notifications/')) {
    // Reset timers on notification-related requests
    lastNotificationCheck = Date.now() - NOTIFICATION_CHECK_INTERVAL + 5000;
    
    // Also validate subscription on notification API calls
    validateAndRefreshSubscription().catch(err => {
      console.error('[SW] Subscription validation on fetch failed:', err);
    });
  }
  
  // On any fetch, if it's been more than 5 minutes since last subscription check, validate
  const timeSinceLastValidation = Date.now() - lastSubscriptionValidation;
  if (timeSinceLastValidation > 300000) {
    console.log('[SW] Fetch event - overdue subscription validation');
    validateAndRefreshSubscription().catch(err => {
      console.error('[SW] Fetch-triggered validation failed:', err);
    });
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
      await validateAndRefreshSubscription();
      break;

    case 'VALIDATE_SUBSCRIPTION':
      // Force immediate subscription validation
      await validateAndRefreshSubscription();
      break;

    case 'SUBSCRIPTION_REFRESHED':
      // Client has refreshed subscription, clear any pending timeouts
      if (pushTestTimeout) {
        clearTimeout(pushTestTimeout);
        pushTestTimeout = null;
      }
      lastSubscriptionValidation = Date.now();
      console.log('[SW] Client confirmed subscription refresh');
      break;

    case 'PUSH_TEST_SUCCESSFUL':
      // Client received test push, clear timeout
      if (pushTestTimeout) {
        clearTimeout(pushTestTimeout);
        pushTestTimeout = null;
      }
      lastSubscriptionValidation = Date.now();
      console.log('[SW] Push test successful - connection validated ✅');
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
        originalPing: data?.timestamp,
        subscriptionValid: lastSubscriptionValidation > 0
      });
      lastActivity = Date.now();
      break;

    case 'APP_VISIBILITY_CHANGE':
      // Track app visibility to adjust sync frequency
      isAppVisible = data?.isVisible || false;
      console.log('[SW] App visibility changed:', isAppVisible ? 'visible' : 'hidden');

      if (isAppVisible) {
        // App became visible - CRITICAL: validate subscription immediately!
        console.log('[SW] 🎯 App became VISIBLE - validating subscription NOW');
        await startBackgroundTasks();
        await validateAndRefreshSubscription(); // CRITICAL!
        await keepServiceWorkerAlive();
        await performCriticalDataSync();
      }
      break;

    case 'EMERGENCY_WAKE_UP':
      // Emergency wake-up call from main thread
      console.log('[SW] 🚨 EMERGENCY WAKE-UP received');
      lastActivity = Date.now();
      await startBackgroundTasks();
      await validateAndRefreshSubscription(); // CRITICAL: Check subscription!
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
    const timeSinceLastValidation = now - lastSubscriptionValidation;

    // If no activity for 30 seconds, trigger emergency procedures
    if (timeSinceLastActivity > 30000) {
      console.log('[SW] 🚨 EMERGENCY: No activity for 30s, triggering revival procedures');

      // Force all intervals to restart
      await startBackgroundTasks();

      // CRITICAL: Validate subscription
      await validateAndRefreshSubscription();

      // Emergency wake-up call to main thread
      broadcastToClients({
        type: 'SERVICE_WORKER_EMERGENCY_REVIVAL',
        timeSinceLastActivity,
        timeSinceLastValidation,
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

    // If no subscription validation for 3 minutes, force validation
    if (timeSinceLastValidation > 180000 || lastSubscriptionValidation === 0) {
      console.log('[SW] ⚠️ No subscription validation in 3+ minutes - forcing check');
      await validateAndRefreshSubscription();
    }

    // Always keep some activity going
    await keepServiceWorkerAlive();

  } catch (error) {
    console.error('[SW] Emergency interval error:', error);
  }
}, 15000); // Every 15 seconds - emergency fallback

console.log('[SW] Service Worker v4.0 fully loaded with aggressive anti-numb + subscription validation');
