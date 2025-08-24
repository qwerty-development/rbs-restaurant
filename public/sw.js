const CACHE_NAME = 'rbs-restaurant-v7'
const urlsToCache = [
  '/',
  '/app',
  '/manifest.webmanifest',
  '/icon-192x192.png',
  '/icon-384x384.png',
  '/icon-512x512.png',
  '/apple-touch-icon.png'
]

// Install event - cache resources
self.addEventListener('install', function (event) {
  console.log('Service Worker installing...')
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function (cache) {
        console.log('Opened cache')
        return cache.addAll(urlsToCache)
      })
      .catch(function (error) {
        console.log('Cache install failed:', error)
      })
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
      self.registration.showNotification(data.title || 'RBS Restaurant', options)
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
      // Perform background sync operations
      console.log('Background sync triggered')
    )
  }
})