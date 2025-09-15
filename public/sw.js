const CACHE_NAME = 'rbs-restaurant-v10'
const urlsToCache = [
  '/',
  '/app',
  '/manifest.webmanifest',
  '/icon-192x192.png',
  '/icon-384x384.png',
  '/icon-512x512.png',
  '/apple-touch-icon.png',
  '/notification-sound.mp3'
]

// Install event - cache resources and register periodic sync
self.addEventListener('install', function (event) {
  console.log('Service Worker installing...')
  event.waitUntil(
    Promise.all([
      caches.open(CACHE_NAME)
        .then(function (cache) {
          console.log('Opened cache')
          return cache.addAll(urlsToCache)
        })
        .catch(function (error) {
          console.log('Cache install failed:', error)
        }),
      // Register periodic sync for keep-alive (if supported)
      self.registration.periodicSync && self.registration.periodicSync.register('keep-alive', {
        minInterval: 30000 // 30 seconds
      }).catch(function (error) {
        console.log('Periodic sync registration failed:', error)
      })
    ])
  )
  // Force the waiting service worker to become the active service worker
  self.skipWaiting()
})

// Fetch event - serve from cache when offline
self.addEventListener('fetch', function (event) {
  const requestUrl = new URL(event.request.url)

  // Skip service worker entirely for:
  // 1. External APIs (Supabase, etc.)
  // 2. API routes that need authentication  
  // 3. Non-GET requests
  // 4. All dashboard/auth routes (let middleware handle authentication)
  // 5. Root path to avoid redirect issues
  if (requestUrl.hostname.includes('supabase.co') ||
      requestUrl.pathname.startsWith('/api/') ||
      requestUrl.pathname.startsWith('/dashboard') ||
      requestUrl.pathname.startsWith('/login') ||
      requestUrl.pathname.startsWith('/register') ||
      requestUrl.pathname.startsWith('/forgot-password') ||
      requestUrl.pathname.startsWith('/reset-password') ||
      requestUrl.pathname === '/' ||
      event.request.method !== 'GET' ||
      requestUrl.protocol === 'chrome-extension:') {
    // Let the request go directly to the network, don't intercept
    return
  }

  // Only handle static assets (images, CSS, JS) for caching
  if (requestUrl.origin === self.location.origin && 
      (requestUrl.pathname.startsWith('/_next/') ||
       requestUrl.pathname.startsWith('/icon-') ||
       requestUrl.pathname.endsWith('.png') ||
       requestUrl.pathname.endsWith('.ico') ||
       requestUrl.pathname.endsWith('.webmanifest'))) {
    event.respondWith(
      caches.match(event.request)
        .then(function (response) {
          // Return from cache if available
          if (response) {
            return response
          }

          // Otherwise fetch from network
          return fetch(event.request)
            .then(function (response) {
              // Cache successful responses
              if (response.status === 200) {
                const responseToCache = response.clone()
                caches.open(CACHE_NAME)
                  .then(function (cache) {
                    cache.put(event.request, responseToCache)
                  })
              }
              return response
            })
        })
    )
  }
})

// Activate event - clean up old caches
self.addEventListener('activate', function (event) {
  console.log('Service Worker activating...')
  event.waitUntil(
    caches.keys().then(function (cacheNames) {
      return Promise.all(
        cacheNames.map(function (cacheName) {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName)
            return caches.delete(cacheName)
          }
        })
      )
    }).then(() => {
      // Take control of all pages immediately
      return self.clients.claim()
    })
  )
})

// Push event - handle push notifications
self.addEventListener('push', function (event) {
  console.log('[SW] Push notification received')
  
  if (!event.data) {
    console.log('[SW] No data in push notification')
    return
  }

  let data
  try {
    data = event.data.json()
  } catch (e) {
    console.error('[SW] Failed to parse push data:', e)
    data = {
      title: 'New Notification',
      body: event.data.text()
    }
  }

  const options = {
    body: data.body || 'You have a new notification',
    icon: data.icon || '/icon-192x192.png',
    badge: '/icon-192x192.png',
    vibrate: [200, 100, 200],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: data.data?.notification_id || Date.now(),
      url: data.data?.url || '/dashboard',
      type: data.data?.type || 'general',
      notification_id: data.data?.notification_id,
      booking_id: data.data?.booking_id,
      restaurant_id: data.data?.restaurant_id,
      ...data.data
    },
    actions: [
      { action: 'view', title: 'View Booking', icon: '/icon-192x192.png' },
      { action: 'dismiss', title: 'Dismiss', icon: '/icon-192x192.png' }
    ],
    // Use booking_id for unique tags to prevent spam and allow updates
    tag: data.data?.booking_id ? `booking-${data.data.booking_id}` : `notification-${data.data?.notification_id || Date.now()}`,
    renotify: false, // Don't renotify for same booking
    requireInteraction: data.priority === 'high',
    silent: false,
    timestamp: Date.now()
  }

  event.waitUntil(
    self.registration.showNotification(
      data.title || 'Restaurant Notification',
      options
    ).then(() => {
      // Track notification delivery
      return fetch('/api/notifications/track-delivery', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: 'delivered',
          notificationId: data.data?.notification_id,
          timestamp: Date.now()
        })
      }).catch(error => {
        console.log('[SW] Failed to track delivery:', error)
      })
    })
  )
})

// Notification click event
self.addEventListener('notificationclick', function (event) {
  console.log('[SW] Notification clicked:', event.action)
  
  event.notification.close()

  // Track notification click
  if (event.action !== 'dismiss') {
    fetch('/api/notifications/track-delivery', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        type: 'clicked',
        notificationId: event.notification.data?.notification_id,
        action: event.action || 'default',
        timestamp: Date.now()
      })
    }).catch(error => {
      console.log('[SW] Failed to track click:', error)
    })
  }

  if (event.action === 'dismiss') {
    return
  }

  const urlToOpen = event.notification.data?.url || '/dashboard'
  const baseUrl = self.location.origin
  const fullUrl = urlToOpen.startsWith('http') ? urlToOpen : baseUrl + urlToOpen

  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then((clientList) => {
      // Check if there's already a window/tab open
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i]
        if (client.url.includes('/dashboard') && 'focus' in client) {
          // Focus existing window and navigate to specific URL
          client.postMessage({
            type: 'NAVIGATE_TO',
            url: urlToOpen
          })
          return client.focus()
        }
      }
      
      // If no window/tab is already open, open a new one
      if (clients.openWindow) {
        return clients.openWindow(fullUrl)
      }
    })
  )
})

// Background sync event (for when connection is restored)
self.addEventListener('sync', function (event) {
  console.log('[SW] Background sync triggered:', event.tag)
  
  if (event.tag === 'sync-notifications') {
    event.waitUntil(syncNotifications())
  } else if (event.tag === 'background-sync') {
    event.waitUntil(
      console.log('Background sync triggered')
    )
  }
})

// Handle messages from the main thread
self.addEventListener('message', function (event) {
  console.log('[SW] Message received:', event.data)
  
  if (event.data && event.data.type === 'APP_VISIBLE') {
    console.log('📱 App became visible - service worker notified')
    
    // Notify all clients that the app is visible
    self.clients.matchAll().then(function (clients) {
      clients.forEach(function (client) {
        client.postMessage({
          type: 'SW_APP_VISIBLE',
          timestamp: event.data.timestamp
        })
      })
    })
  }
  
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
  
  if (event.data?.type === 'CHECK_NOTIFICATIONS') {
    checkForNewNotifications()
  }
  
  if (event.data?.type === 'CLEAR_CACHE') {
    caches.delete(CACHE_NAME).then(() => {
      console.log('[SW] Cache cleared')
    })
  }
})

// Periodic sync for keeping the app alive and checking notifications
self.addEventListener('periodicsync', function (event) {
  console.log('[SW] Periodic sync triggered:', event.tag)
  
  if (event.tag === 'keep-alive') {
    event.waitUntil(
      // Perform lightweight sync to keep the app active
      fetch('/api/health', { method: 'HEAD' })
        .then(response => {
          console.log('Periodic sync: App is healthy')
          return response
        })
        .catch(error => {
          console.warn('Periodic sync failed:', error)
        })
    )
  }
  
  if (event.tag === 'check-notifications') {
    event.waitUntil(checkForNewNotifications())
  }
})

// Helper functions for background sync
async function syncNotifications() {
  try {
    const response = await fetch('/api/notifications/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        timestamp: Date.now()
      })
    })
    
    if (response.ok) {
      const data = await response.json()
      console.log('[SW] Notifications synced:', data)
      
      // Show any queued notifications
      if (data.notifications && data.notifications.length > 0) {
        for (const notification of data.notifications) {
          await self.registration.showNotification(
            notification.title,
            {
              body: notification.body,
              icon: '/icon-192x192.png',
              badge: '/icon-192x192.png',
              data: notification.data || {}
            }
          )
        }
      }
    }
  } catch (error) {
    console.error('[SW] Failed to sync notifications:', error)
    throw error // Retry sync later
  }
}

async function checkForNewNotifications() {
  try {
    const response = await fetch('/api/notifications/check', {
      headers: {
        'Content-Type': 'application/json'
      }
    })
    
    if (response.ok) {
      const data = await response.json()
      console.log('[SW] Checked for notifications:', data)
      
      // Show any new notifications
      if (data.newNotifications && data.newNotifications.length > 0) {
        for (const notification of data.newNotifications) {
          await self.registration.showNotification(
            notification.title,
            {
              body: notification.body,
              icon: '/icon-192x192.png',
              badge: '/icon-192x192.png',
              data: notification.data || {}
            }
          )
        }
      }
    }
  } catch (error) {
    console.error('[SW] Failed to check notifications:', error)
  }
}
