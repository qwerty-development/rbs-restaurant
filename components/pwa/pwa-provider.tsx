'use client'

import { useEffect } from 'react'
import { toast } from 'sonner'

export function PWAProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Temporarily disable service worker to debug CSP issues
    if ('serviceWorker' in navigator) {
      // Unregister any existing service workers
      navigator.serviceWorker.getRegistrations().then(function(registrations) {
        for(let registration of registrations) {
          registration.unregister()
          console.log('Unregistered service worker:', registration)
        }
      })
      
      // Don't register service worker for now
      /*
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('SW registered: ', registration)
          
          // Handle service worker updates
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed') {
                  if (navigator.serviceWorker.controller) {
                    // New update available
                    toast.info('App update available! Refresh to update.', {
                      duration: 10000,
                      action: {
                        label: 'Refresh',
                        onClick: () => window.location.reload()
                      }
                    })
                  }
                }
              })
            }
          })
        })
        .catch((registrationError) => {
          console.log('SW registration failed: ', registrationError)
        })
        */

      // Handle service worker messages
      /*
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'CACHE_UPDATED') {
          toast.success('App updated successfully!')
        }
      })
      */
    }

    // Handle app installation
    window.addEventListener('appinstalled', () => {
      toast.success('App installed successfully!')
      console.log('PWA was installed')
    })

    // Handle online/offline status
    const handleOnline = () => {
      toast.success('Back online!')
    }

    const handleOffline = () => {
      toast.error('You are offline. Some features may be limited.')
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Cleanup
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return <>{children}</>
}