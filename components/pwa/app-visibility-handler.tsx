'use client'

import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getRealtimeConnectionManager } from '@/lib/services/realtime-connection-manager'

export function AppVisibilityHandler() {
  const queryClient = useQueryClient()

  useEffect(() => {
    const connectionManager = getRealtimeConnectionManager()

    const handleAppVisible = () => {
      console.log('🔄 App became visible - refreshing critical data and checking connections')
      
      // Force reconnection check for real-time subscriptions
      connectionManager.forceReconnect()
      
      // Invalidate and refetch critical queries
      const criticalQueries = [
        'kitchen-orders',
        'all-bookings', 
        'displayed-bookings',
        'todays-bookings',
        'table-stats',
        'waitlist',
        'waitlist-stats',
        'realtime-tables',
        'customer-data',
        'restaurant-tables-with-sections',
        'shared-tables-summary'
      ]
      
      criticalQueries.forEach(queryKey => {
        queryClient.invalidateQueries({ queryKey: [queryKey] })
      })
      
      // Force refetch of the most critical data immediately
      queryClient.refetchQueries({ 
        queryKey: ['kitchen-orders'],
        type: 'active'
      })
      
      queryClient.refetchQueries({ 
        queryKey: ['all-bookings'],
        type: 'active'
      })

      queryClient.refetchQueries({ 
        queryKey: ['todays-bookings'],
        type: 'active'
      })

      // Notify service worker that app is visible
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'APP_VISIBLE',
          timestamp: Date.now()
        })
      }
    }

    // Enhanced PWA visibility handling
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('👁️ Document visible - ensuring app state is fresh')
        // Small delay to ensure the app is fully active
        setTimeout(handleAppVisible, 100)
      } else {
        console.log('👁️ Document hidden - app backgrounded')
        // Notify service worker that app is hidden
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({
            type: 'APP_HIDDEN',
            timestamp: Date.now()
          })
        }
      }
    }

    // Handle PWA app state changes
    const handleAppStateChange = (event: PageTransitionEvent) => {
      if (event.persisted) {
        console.log('📱 App restored from bfcache - refreshing state')
        setTimeout(handleAppVisible, 100)
      }
    }

    // Handle focus/blur events for better PWA support
    const handleFocus = () => {
      console.log('🎯 App focused - checking state freshness')
      setTimeout(() => {
        // Only do full refresh if app was hidden for more than 30 seconds
        const lastVisibility = localStorage.getItem('lastVisibility')
        const now = Date.now()
        
        if (!lastVisibility || (now - parseInt(lastVisibility)) > 30000) {
          handleAppVisible()
        } else {
          // Just check connections without full refresh
          connectionManager.forceReconnect()
        }
        
        localStorage.setItem('lastVisibility', now.toString())
      }, 200)
    }

    const handleBlur = () => {
      console.log('🎯 App blurred')
      localStorage.setItem('lastVisibility', Date.now().toString())
    }

    // Handle network state changes
    const handleOnline = () => {
      console.log('🌐 Network online - ensuring app is synchronized')
      setTimeout(handleAppVisible, 500)
    }

    const handleOffline = () => {
      console.log('🌐 Network offline - app will work with cached data')
    }

    // Listen for custom app visibility events
    window.addEventListener('appVisible', handleAppVisible)
    
    // Handle direct visibility changes
    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    // Handle page show/hide (for PWA bfcache)
    window.addEventListener('pageshow', handleAppStateChange as EventListener)
    
    // Handle focus/blur
    window.addEventListener('focus', handleFocus)
    window.addEventListener('blur', handleBlur)
    
    // Handle network changes
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Handle service worker updates and reconnection needs
    const handleServiceWorkerMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SW_UPDATE_AVAILABLE') {
        console.log('🔄 Service worker update available')
        // Could show update notification here
      } else if (event.data?.type === 'SW_RECONNECT_NEEDED') {
        console.log('🔄 Service worker requesting reconnection:', event.data.reason)
        // Force reconnection when service worker detects issues
        connectionManager.forceReconnect()
        
        // Also refresh critical data
        setTimeout(handleAppVisible, 1000)
      }
    }

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage)
    }

    // Initial setup
    localStorage.setItem('lastVisibility', Date.now().toString())
    
    return () => {
      window.removeEventListener('appVisible', handleAppVisible)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('pageshow', handleAppStateChange as EventListener)
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('blur', handleBlur)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage)
      }
    }
  }, [queryClient])

  return null // This component doesn't render anything
}
