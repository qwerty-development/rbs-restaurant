// Service Worker v4.1 - Production Tablet Optimized - BULLETPROOF Persistent Notifications
const CACHE_NAME = 'restaurant-pwa-v4.1';
const NOTIFICATION_CHECK_INTERVAL = 15000; // Check every 15 seconds (more frequent)
const HEARTBEAT_INTERVAL = 10000; // Send heartbeat every 10 seconds (more aggressive)
const SUBSCRIPTION_REFRESH_INTERVAL = 3600000; // Refresh subscription every hour
const KEEP_ALIVE_INTERVAL = 5000; // Ultra aggressive keep-alive every 5 seconds
const CRITICAL_SYNC_INTERVAL = 8000; // Critical data sync every 8 seconds

// Persistent Notification Settings - PRODUCTION TABLET OPTIMIZED
// NOTE: Tablets are always plugged in - NO battery checks needed!
const PERSISTENT_NOTIFICATION_CONFIG = {
  enabled: true, // Always enabled for production
  initialPingDelay: 15000, // Start re-pinging after 15 seconds (FASTER!)
  maxPings: 20, // Maximum 20 re-pings (INCREASED for bulletproof delivery)
  // AGGRESSIVE intervals optimized for dedicated tablets (no battery concerns)
  // Total window: ~83 minutes of persistent pinging
  pingIntervals: [
    15000,   // 15s - First re-ping (FAST!)
    30000,   // 30s
    45000,   // 45s
    60000,   // 1m
    90000,   // 1.5m
    120000,  // 2m
    180000,  // 3m
    240000,  // 4m
    300000,  // 5m
    360000,  // 6m
    420000,  // 7m
    480000,  // 8m
    600000,  // 10m
    720000,  // 12m
    900000,  // 15m
    1200000, // 20m
    1500000, // 25m
    1800000, // 30m
    2400000, // 40m
    3000000  // 50m (final)
  ],
  vibrationPattern: [300, 150, 300, 150, 300, 150, 300], // More intense vibration
  requireInteraction: true, // Always force user interaction
  playSound: true, // Enable notification sound for attention
};

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

// Track pending notifications that need re-pinging
let persistentNotificationTimers = new Map(); // notificationId -> timerId

// Install event
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker v4.1 - PRODUCTION TABLET OPTIMIZED...');
  event.waitUntil(
    Promise.all([
      initPersistentNotificationDB(),
      self.skipWaiting() // Force immediate activation
    ])
  );
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker v4.1 - BULLETPROOF PERSISTENT NOTIFICATIONS...');
  event.waitUntil(
    Promise.all([
      self.clients.claim(), // Take control immediately
      startBackgroundTasks(), // Start aggressive background tasks
      checkForPendingNotifications(), // Check for any pending notifications
      restorePersistentNotifications() // Restore any unacknowledged notifications
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

// ==================== PERSISTENT NOTIFICATION SYSTEM ====================

// Initialize IndexedDB for persistent notifications
async function initPersistentNotificationDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('PersistentNotifications', 1);
    
    request.onerror = () => {
      console.error('[SW] Failed to open IndexedDB:', request.error);
      reject(request.error);
    };
    
    request.onsuccess = () => {
      console.log('[SW] IndexedDB initialized successfully');
      resolve(request.result);
    };
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      if (!db.objectStoreNames.contains('notifications')) {
        const store = db.createObjectStore('notifications', { keyPath: 'id' });
        store.createIndex('acknowledged', 'acknowledged', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        console.log('[SW] Created notifications object store');
      }
    };
  });
}

// Get IndexedDB instance
async function getDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('PersistentNotifications', 1);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Store notification for persistent tracking
async function storePersistentNotification(notificationData) {
  try {
    const db = await getDB();
    const transaction = db.transaction(['notifications'], 'readwrite');
    const store = transaction.objectStore('notifications');
    
    const notification = {
      id: notificationData.id || `notif_${Date.now()}`,
      type: notificationData.type || 'general',
      title: notificationData.title,
      body: notificationData.body,
      data: notificationData,
      timestamp: Date.now(),
      pingCount: 0,
      lastPingTime: Date.now(),
      acknowledged: false,
      maxPings: PERSISTENT_NOTIFICATION_CONFIG.maxPings,
      tag: notificationData.tag || `notification-${Date.now()}`
    };
    
    await store.put(notification);
    console.log('[SW] Stored persistent notification:', notification.id);
    
    return notification;
  } catch (error) {
    console.error('[SW] Failed to store notification:', error);
    return null;
  }
}

// Mark notification as acknowledged
async function markNotificationAcknowledged(notificationId) {
  try {
    const db = await getDB();
    const transaction = db.transaction(['notifications'], 'readwrite');
    const store = transaction.objectStore('notifications');
    
    const notification = await store.get(notificationId);
    
    if (notification) {
      notification.acknowledged = true;
      notification.acknowledgedAt = Date.now();
      await store.put(notification);
      
      // Clear the ping timer
      if (persistentNotificationTimers.has(notificationId)) {
        clearTimeout(persistentNotificationTimers.get(notificationId));
        persistentNotificationTimers.delete(notificationId);
      }
      
      console.log('[SW] Marked notification as acknowledged:', notificationId);
      return true;
    }
  } catch (error) {
    console.error('[SW] Failed to mark notification acknowledged:', error);
  }
  
  return false;
}

// Get all unacknowledged notifications
async function getUnacknowledgedNotifications() {
  try {
    const db = await getDB();
    const transaction = db.transaction(['notifications'], 'readonly');
    const store = transaction.objectStore('notifications');
    const index = store.index('acknowledged');
    
    return new Promise((resolve, reject) => {
      const request = index.getAll(false);
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('[SW] Failed to get unacknowledged notifications:', error);
    return [];
  }
}

// Re-ping notification (show again with vibration/sound) - PRODUCTION OPTIMIZED
async function repingNotification(notification) {
  try {
    // NO BATTERY CHECKS - Tablets are always plugged in!
    
    // Check if max pings reached
    if (notification.pingCount >= notification.maxPings) {
      console.log('[SW] Max pings reached for notification:', notification.id);
      await markNotificationAcknowledged(notification.id);
      return;
    }
    
    // Update ping count
    const db = await getDB();
    const transaction = db.transaction(['notifications'], 'readwrite');
    const store = transaction.objectStore('notifications');
    
    notification.pingCount++;
    notification.lastPingTime = Date.now();
    await store.put(notification);
    
    // Show notification with MAXIMUM URGENCY for production tablets
    const options = {
      body: `⚠️ [${notification.pingCount}/${notification.maxPings}] ${notification.body}`,
      icon: notification.data.icon || '/icon-192x192.png',
      badge: '/icon-192x192.png',
      vibrate: PERSISTENT_NOTIFICATION_CONFIG.vibrationPattern, // Intense vibration
      data: {
        ...notification.data,
        persistentId: notification.id,
        pingCount: notification.pingCount,
        urgent: true
      },
      actions: [
        { action: 'view', title: '👁️ View Now', icon: '/icon-192x192.png' },
        { action: 'dismiss', title: '✓ Acknowledge', icon: '/icon-192x192.png' }
      ],
      tag: notification.tag,
      renotify: true, // Force re-notification even with same tag
      requireInteraction: true, // ALWAYS require interaction
      silent: false, // NEVER silent
      timestamp: Date.now(),
      // Additional urgency indicators
      priority: 'high',
      urgency: 'high'
    };
    
    await self.registration.showNotification(
      `� URGENT: ${notification.title}`,
      options
    );
    
    console.log(`[SW] 🔔 URGENT RE-PING ${notification.id} (${notification.pingCount}/${notification.maxPings})`);
    
    // Schedule next ping
    scheduleNextPing(notification);
    
  } catch (error) {
    console.error('[SW] Failed to re-ping notification:', error);
  }
}

// Schedule next ping for a notification
function scheduleNextPing(notification) {
  // Clear existing timer
  if (persistentNotificationTimers.has(notification.id)) {
    clearTimeout(persistentNotificationTimers.get(notification.id));
  }
  
  // Check if we should continue pinging
  if (notification.pingCount >= notification.maxPings) {
    return;
  }
  
  // Get next interval (use increasing backoff)
  const nextInterval = PERSISTENT_NOTIFICATION_CONFIG.pingIntervals[notification.pingCount] || 
                       PERSISTENT_NOTIFICATION_CONFIG.pingIntervals[PERSISTENT_NOTIFICATION_CONFIG.pingIntervals.length - 1];
  
  // Schedule next ping
  const timerId = setTimeout(async () => {
    const unacknowledged = await getUnacknowledgedNotifications();
    const current = unacknowledged.find(n => n.id === notification.id);
    
    if (current && !current.acknowledged) {
      await repingNotification(current);
    }
  }, nextInterval);
  
  persistentNotificationTimers.set(notification.id, timerId);
  
  console.log(`[SW] Scheduled next ping for ${notification.id} in ${nextInterval}ms`);
}

// Restore persistent notifications on service worker activation
async function restorePersistentNotifications() {
  if (!PERSISTENT_NOTIFICATION_CONFIG.enabled) {
    console.log('[SW] Persistent notifications disabled');
    return;
  }
  
  try {
    const unacknowledged = await getUnacknowledgedNotifications();
    
    console.log(`[SW] Restoring ${unacknowledged.length} unacknowledged notifications`);
    
    for (const notification of unacknowledged) {
      // Check if notification is not too old (48 hours - EXTENDED for production tablets)
      const age = Date.now() - notification.timestamp;
      if (age > 172800000) { // 48 hours in milliseconds
        // Mark as acknowledged if older than 48 hours
        await markNotificationAcknowledged(notification.id);
        console.log(`[SW] Auto-acknowledged old notification (>48h): ${notification.id}`);
        continue;
      }
      
      // Schedule next ping
      scheduleNextPing(notification);
    }
  } catch (error) {
    console.error('[SW] Failed to restore persistent notifications:', error);
  }
}

// Clean up old acknowledged notifications
async function cleanupOldNotifications() {
  try {
    const db = await getDB();
    const transaction = db.transaction(['notifications'], 'readwrite');
    const store = transaction.objectStore('notifications');
    
    const allNotifications = await store.getAll();
    const now = Date.now();
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
    
    for (const notification of allNotifications) {
      if (notification.acknowledged && (now - notification.timestamp) > maxAge) {
        await store.delete(notification.id);
        console.log('[SW] Cleaned up old notification:', notification.id);
      }
    }
  } catch (error) {
    console.error('[SW] Failed to cleanup old notifications:', error);
  }
}

// ==================== END PERSISTENT NOTIFICATION SYSTEM ====================

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

// Show notification helper - PRODUCTION TABLET OPTIMIZED
async function showNotification(data) {
  try {
    // Generate notification ID if not provided
    const notificationId = data.id || `notif_${Date.now()}`;
    
    const options = {
      body: `⚠️ ${data.body || 'You have a new notification'}`,
      icon: data.icon || '/icon-192x192.png',
      badge: '/icon-192x192.png',
      vibrate: PERSISTENT_NOTIFICATION_CONFIG.vibrationPattern, // Use intense vibration pattern
      data: {
        dateOfArrival: Date.now(),
        url: data.url || '/dashboard',
        notification_id: data.notification_id,
        booking_id: data.booking_id,
        persistentId: notificationId,
        requiresAcknowledgment: data.requiresAcknowledgment !== false, // Default true
        urgent: true, // Mark as urgent
        ...data.data
      },
      actions: [
        { action: 'view', title: '👁️ View Now', icon: '/icon-192x192.png' },
        { action: 'dismiss', title: '✓ Acknowledge', icon: '/icon-192x192.png' }
      ],
      tag: data.tag || `notification-${Date.now()}`,
      renotify: true,
      requireInteraction: true, // ALWAYS require interaction
      silent: false, // NEVER silent
      timestamp: Date.now(),
      // Additional urgency for production
      priority: 'high',
      urgency: 'high'
    };
    
    await self.registration.showNotification(
      `🚨 ${data.title || 'New Notification'}`,
      options
    );

    // Store for persistent tracking if enabled and requires acknowledgment
    if (PERSISTENT_NOTIFICATION_CONFIG.enabled && options.data.requiresAcknowledgment) {
      const storedNotification = await storePersistentNotification({
        id: notificationId,
        type: data.type,
        title: data.title,
        body: data.body,
        icon: options.icon,
        tag: options.tag,
        url: options.data.url,
        data: options.data
      });
      
      if (storedNotification) {
        // Schedule first re-ping (STARTS IN 15 SECONDS!)
        scheduleNextPing(storedNotification);
      }
    }

    console.log('[SW] 🚨 URGENT NOTIFICATION shown:', data.title || 'New Notification');
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
self.addEventListener('notificationclick', async (event) => {
  console.log('[SW] Notification clicked:', event.action);
  
  // Mark as acknowledged
  const persistentId = event.notification.data?.persistentId;
  if (persistentId) {
    await markNotificationAcknowledged(persistentId);
    console.log('[SW] Notification acknowledged via click:', persistentId);
  }
  
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

// Notification close event - NEW: Track when user dismisses notification
self.addEventListener('notificationclose', async (event) => {
  console.log('[SW] Notification closed/dismissed');
  
  // Mark as acknowledged when user dismisses
  const persistentId = event.notification.data?.persistentId;
  if (persistentId) {
    await markNotificationAcknowledged(persistentId);
    console.log('[SW] Notification acknowledged via close:', persistentId);
  }
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

    // PERSISTENT NOTIFICATION CONTROLS
    case 'GET_UNACKNOWLEDGED_NOTIFICATIONS':
      const unacknowledged = await getUnacknowledgedNotifications();
      event.ports[0]?.postMessage({
        type: 'UNACKNOWLEDGED_NOTIFICATIONS',
        notifications: unacknowledged
      });
      break;

    case 'ACKNOWLEDGE_NOTIFICATION':
      if (data?.notificationId) {
        await markNotificationAcknowledged(data.notificationId);
      }
      break;

    case 'ACKNOWLEDGE_ALL_NOTIFICATIONS':
      const all = await getUnacknowledgedNotifications();
      for (const notification of all) {
        await markNotificationAcknowledged(notification.id);
      }
      console.log('[SW] Acknowledged all notifications');
      break;

    case 'TOGGLE_PERSISTENT_NOTIFICATIONS':
      PERSISTENT_NOTIFICATION_CONFIG.enabled = data?.enabled !== false;
      console.log('[SW] Persistent notifications:', PERSISTENT_NOTIFICATION_CONFIG.enabled ? 'enabled' : 'disabled');
      break;

    case 'CLEANUP_OLD_NOTIFICATIONS':
      await cleanupOldNotifications();
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

// Periodic cleanup of old acknowledged notifications (every hour)
setInterval(async () => {
  console.log('[SW] Running periodic notification cleanup...');
  await cleanupOldNotifications();
}, 3600000); // Every hour

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

console.log('[SW] 🚨 Service Worker v4.1 PRODUCTION TABLET OPTIMIZED - Bulletproof Persistent Notifications ACTIVE');