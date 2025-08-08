const CACHE_NAME = 'rbs-restaurant-v1'
const urlsToCache = [
  '/',
  '/dashboard',
  '/bookings',
  '/customers',
  '/tables',
  '/waitlist',
  '/manifest.json',
  '/icon-192x192.png',
  '/icon-512x512.png'
]

// Install event - cache resources
self.addEventListener('install', function (event) {
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
})

// Fetch event - serve from cache when offline
self.addEventListener('fetch', function (event) {
  event.respondWith(
    caches.match(event.request)
      .then(function (response) {
        // Return cached version or fetch from network
        if (response) {
          return response
        }
        return fetch(event.request)
      })
  )
})

// Activate event - clean up old caches
self.addEventListener('activate', function (event) {
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
  
  const baseUrl = 'https://rbs-restaurant.vercel.app'
  
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