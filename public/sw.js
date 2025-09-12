const VERSION = 'v10'
const CACHE_NAME = `rbs-restaurant-${VERSION}`
const urlsToCache = [
  '/',
  '/app',
  '/manifest.webmanifest',
  '/icon-192x192.png',
  '/icon-384x384.png',
  '/icon-512x512.png',
  '/apple-touch-icon.png'
]

// Keep track of app visibility and connection state
let appState = {
  isVisible: true,
  lastVisibleTime: Date.now(),
  connectionCheckInterval: null,
  keepAliveInterval: null
}

// Install event - cache resources and setup background processes
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

// Activate event - clean up old caches and start monitoring
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
    }).then(() => {
      // Start connection monitoring
      startConnectionMonitoring()
    })
  )
})

// Start connection monitoring for real-time subscriptions
function startConnectionMonitoring() {
  console.log('🔄 Starting connection monitoring')
  
  // Clear any existing intervals
  if (appState.connectionCheckInterval) {
    clearInterval(appState.connectionCheckInterval)
  }
  if (appState.keepAliveInterval) {
    clearInterval(appState.keepAliveInterval)
  }
  
  // Connection health check every 60 seconds
  appState.connectionCheckInterval = setInterval(() => {
    checkConnectionHealth()
  }, 60000)
  
  // Keep alive ping every 2 minutes when app is visible
  appState.keepAliveInterval = setInterval(() => {
    if (appState.isVisible) {
      sendKeepAlive()
    }
  }, 120000)
}

// Check connection health and notify clients if needed
function checkConnectionHealth() {
  const timeSinceVisible = Date.now() - appState.lastVisibleTime
  const fiveMinutes = 5 * 60 * 1000
  
  // If app has been hidden for more than 5 minutes, notify clients to reconnect
  if (!appState.isVisible && timeSinceVisible > fiveMinutes) {
    console.log('⚠️ App has been hidden for >5 minutes, suggesting reconnection')
    notifyClientsToReconnect('long_background')
  }
}

// Send keep alive to maintain connection
function sendKeepAlive() {
  // Lightweight request to keep connections alive
  fetch('/api/health', { 
    method: 'HEAD',
    cache: 'no-cache'
  }).then(() => {
    console.log('❤️ Keep alive successful')
  }).catch((error) => {
    console.warn('❤️ Keep alive failed:', error)
    notifyClientsToReconnect('keep_alive_failed')
  })
}

// Notify all clients to check/reconnect real-time subscriptions
function notifyClientsToReconnect(reason) {
  self.clients.matchAll().then(function (clients) {
    clients.forEach(function (client) {
      client.postMessage({
        type: 'SW_RECONNECT_NEEDED',
        reason: reason,
        timestamp: Date.now()
      })
    })
  })
}

// Push event - handle push notifications
self.addEventListener('push', function (event) {
  if (event.data) {
    const data = event.data.json()
    const options = {
      body: data.body,
      icon: data.icon || '/icon-192x192.png',
      badge: '/icon-192x192.png',
      vibrate: [100, 50, 100],
      data: {
        dateOfArrival: Date.now(),
        primaryKey: data.id || '1',
        url: data.url || '/dashboard'
      },
      actions: [
        {
          action: 'view',
          title: 'View Details',
          icon: '/icon-192x192.png'
        },
        {
          action: 'dismiss',
          title: 'Dismiss',
          icon: '/icon-192x192.png'
        }
      ]
    }
    event.waitUntil(
      self.registration.showNotification(data.title || 'Plate Management', options)
    )
  }
})

// Notification click event
self.addEventListener('notificationclick', function (event) {
  console.log('Notification click received.')
  
  event.notification.close()
  
  const baseUrl = self.location.origin

  if (event.action === 'view') {
    const url = event.notification.data.url || '/dashboard'
    const fullUrl = url.startsWith('http') ? url : baseUrl + url
    event.waitUntil(clients.openWindow(fullUrl))
  } else if (event.action === 'dismiss') {
    // Just close the notification
    return
  } else {
    // Default action - open the app
    event.waitUntil(clients.openWindow(baseUrl + '/dashboard'))
  }
})

// Background sync event (for when connection is restored)
self.addEventListener('sync', function (event) {
  if (event.tag === 'background-sync') {
    event.waitUntil(
      // Perform background sync operations and notify for reconnection
      console.log('Background sync triggered - notifying clients')
    )
    // Notify clients that network is back
    notifyClientsToReconnect('background_sync')
  }
})

// Enhanced message handling from the main thread
self.addEventListener('message', function (event) {
  if (event.data && event.data.type === 'APP_VISIBLE') {
    console.log('📱 App became visible - service worker notified')
    appState.isVisible = true
    appState.lastVisibleTime = event.data.timestamp || Date.now()
    
    // Notify all clients that the app is visible
    self.clients.matchAll().then(function (clients) {
      clients.forEach(function (client) {
        client.postMessage({
          type: 'SW_APP_VISIBLE',
          timestamp: event.data.timestamp
        })
      })
    })
  } else if (event.data && event.data.type === 'APP_HIDDEN') {
    console.log('📱 App became hidden - service worker notified')
    appState.isVisible = false
    appState.lastVisibleTime = event.data.timestamp || Date.now()
  } else if (event.data && event.data.type === 'FORCE_RECONNECT') {
    console.log('🔄 Force reconnect requested')
    notifyClientsToReconnect('manual_request')
  }
})

// Periodic sync for keeping the app alive and checking connection health
self.addEventListener('periodicsync', function (event) {
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
          // Notify clients that periodic sync failed
          notifyClientsToReconnect('periodic_sync_failed')
        })
    )
  }
})