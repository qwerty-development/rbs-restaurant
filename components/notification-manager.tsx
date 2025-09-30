'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { useRestaurantContext } from '@/lib/contexts/restaurant-context'
import type { RealtimeChannel } from '@supabase/supabase-js'

const CHECK_INTERVAL = 30000 // 30 seconds
const SUBSCRIPTION_REFRESH_INTERVAL = 3600000 // 1 hour
const PING_INTERVAL = 10000 // 10 seconds - ping service worker
const SUBSCRIPTION_VALIDATION_INTERVAL = 60000 // 1 minute - check subscription validity
const EMERGENCY_RECOVERY_DELAY = 2000 // 2 seconds after visibility change

export function NotificationManager() {
  const { currentRestaurant } = useRestaurantContext()
  const supabase = createClient()
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [lastCheck, setLastCheck] = useState(Date.now())
  const [realtimeConnected, setRealtimeConnected] = useState(false)
  const [lastPongTime, setLastPongTime] = useState(Date.now())
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const validationIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const swRegistrationRef = useRef<ServiceWorkerRegistration | null>(null)
  const realtimeChannelRef = useRef<RealtimeChannel | null>(null)
  const isRecoveringRef = useRef(false)
  const lastVisibleTimeRef = useRef(Date.now())
  const subscriptionValidRef = useRef(true)

  // Initialize service worker and notifications
  const initialize = useCallback(async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('Push notifications not supported')
      return
    }

    try {
      // Register service worker
      const registration = await navigator.serviceWorker.register('/sw.js', {
        updateViaCache: 'none'
      })
      
      swRegistrationRef.current = registration
      console.log('Service worker registered')

      // Check for updates immediately
      await registration.update()

      // Send message to start background tasks
      if (registration.active) {
        registration.active.postMessage({
          type: 'START_BACKGROUND_TASKS'
        })
      }

      // Listen for messages from service worker
      navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage)

      // Check notification permission
      if (Notification.permission === 'granted') {
        await ensureSubscription()
      } else if (Notification.permission === 'default') {
        // Request permission after a delay
        setTimeout(() => requestPermission(), 3000)
      }

      // Start all monitoring tasks
      startNotificationChecking()
      startSubscriptionRefresh()
      startSubscriptionValidation()
      startPingInterval()
      setupRealtimeConnection()

    } catch (error) {
      console.error('Failed to initialize notifications:', error)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Ensure push subscription exists
  const ensureSubscription = useCallback(async () => {
    if (!swRegistrationRef.current || !currentRestaurant?.restaurant?.id) return

    try {
      let subscription = await swRegistrationRef.current.pushManager.getSubscription()

      if (!subscription) {
        const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
        if (!vapidPublicKey) {
          console.warn('VAPID public key not configured; skipping push subscription')
          return
        }
        // Create new subscription
        subscription = await swRegistrationRef.current.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource
        })
      }

      // Save to database
      const response = await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
          restaurantId: currentRestaurant.restaurant.id
        })
      })

      if (response.ok) {
        setIsSubscribed(true)
        console.log('Push subscription saved')
      }

    } catch (error) {
      console.error('Failed to ensure subscription:', error)
    }
  }, [currentRestaurant?.restaurant?.id])

  // Request notification permission
  const requestPermission = useCallback(async () => {
    try {
      const permission = await Notification.requestPermission()
      
      if (permission === 'granted') {
        await ensureSubscription()
        toast.success('Notifications enabled!')
      }
    } catch (error) {
      console.error('Failed to request permission:', error)
    }
  }, [ensureSubscription])

  // Check for pending notifications
  const checkNotifications = useCallback(async () => {
    if (!isSubscribed) return

    try {
      const response = await fetch('/api/notifications/check-pending', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timestamp: Date.now(),
          source: 'frontend'
        })
      })

      if (response.ok) {
        const data = await response.json()
        
        if (data.notifications && data.notifications.length > 0) {
          console.log(`Found ${data.notifications.length} pending notifications`)
          
          // Send to service worker to display
          if (swRegistrationRef.current?.active) {
            swRegistrationRef.current.active.postMessage({
              type: 'DISPLAY_NOTIFICATIONS',
              notifications: data.notifications
            })
          }
        }
      }
    } catch (error) {
      console.error('Failed to check notifications:', error)
    }

    setLastCheck(Date.now())
  }, [isSubscribed])

  // Start periodic notification checking
  const startNotificationChecking = useCallback(() => {
    // Clear existing interval
    if (checkIntervalRef.current) {
      clearInterval(checkIntervalRef.current)
    }

    // Check immediately
    checkNotifications()

    // Set up interval
    checkIntervalRef.current = setInterval(() => {
      checkNotifications()
    }, CHECK_INTERVAL)
  }, [checkNotifications])

  // Start periodic subscription refresh
  const startSubscriptionRefresh = useCallback(() => {
    // Clear existing interval
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current)
    }

    // Set up interval
    refreshIntervalRef.current = setInterval(() => {
      ensureSubscription()
    }, SUBSCRIPTION_REFRESH_INTERVAL)
  }, [ensureSubscription])

  // Validate subscription is still active
  const validateSubscription = useCallback(async () => {
    if (!swRegistrationRef.current) return

    try {
      const subscription = await swRegistrationRef.current.pushManager.getSubscription()
      
      if (!subscription) {
        console.warn('⚠️ Push subscription lost - recreating')
        subscriptionValidRef.current = false
        setIsSubscribed(false)
        await ensureSubscription()
      } else {
        subscriptionValidRef.current = true
        setIsSubscribed(true)
      }
    } catch (error) {
      console.error('Failed to validate subscription:', error)
      subscriptionValidRef.current = false
    }
  }, [ensureSubscription])

  // Start periodic subscription validation
  const startSubscriptionValidation = useCallback(() => {
    if (validationIntervalRef.current) {
      clearInterval(validationIntervalRef.current)
    }

    validationIntervalRef.current = setInterval(() => {
      validateSubscription()
    }, SUBSCRIPTION_VALIDATION_INTERVAL)
  }, [validateSubscription])

  // Setup Supabase realtime connection with health monitoring
  const setupRealtimeConnection = useCallback(() => {
    if (!currentRestaurant?.restaurant?.id) return

    // Clean up existing channel
    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current)
      realtimeChannelRef.current = null
    }

    const channel = supabase
      .channel(`notifications:${currentRestaurant.restaurant.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `data->restaurant_id=eq.${currentRestaurant.restaurant.id}`
      }, (payload) => {
        console.log('Real-time notification:', payload.new)
        setRealtimeConnected(true)
        
        // Show in-app toast
        toast.info((payload.new as any).title, {
          description: (payload.new as any).message,
          duration: 5000
        })
      })
      .subscribe((status) => {
        console.log('Realtime subscription status:', status)
        setRealtimeConnected(status === 'SUBSCRIBED')
        
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('Realtime connection issue - will retry')
          // Retry connection after delay
          setTimeout(() => setupRealtimeConnection(), 5000)
        }
      })

    realtimeChannelRef.current = channel
  }, [currentRestaurant?.restaurant?.id, supabase])

  // Ping service worker and expect pong
  const pingServiceWorker = useCallback(() => {
    if (!swRegistrationRef.current?.active) return

    const now = Date.now()
    
    // Check if we've received a pong recently
    if (now - lastPongTime > 30000) { // No pong for 30 seconds
      console.warn('⚠️ Service worker not responding to pings - may be dead')
      
      // Send emergency wake-up
      swRegistrationRef.current.active.postMessage({
        type: 'EMERGENCY_WAKE_UP'
      })
    }

    // Send ping
    swRegistrationRef.current.active.postMessage({
      type: 'PING_REQUEST',
      timestamp: now
    })

    // Broadcast connection health to service worker
    swRegistrationRef.current.active.postMessage({
      type: 'CONNECTION_HEALTH_UPDATE',
      data: {
        realtimeConnected,
        subscriptionValid: subscriptionValidRef.current,
        lastCheck: lastCheck,
        restaurantId: currentRestaurant?.restaurant?.id
      }
    })
  }, [lastPongTime, realtimeConnected, lastCheck, currentRestaurant?.restaurant?.id])

  // Start ping-pong with service worker
  const startPingInterval = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current)
    }

    pingIntervalRef.current = setInterval(() => {
      pingServiceWorker()
    }, PING_INTERVAL)
  }, [pingServiceWorker])

  // Handle messages from service worker
  const handleServiceWorkerMessage = useCallback((event: MessageEvent) => {
    const { type, timestamp, silentDuration } = event.data || {}

    switch (type) {
      case 'PONG_RESPONSE':
        setLastPongTime(Date.now())
        break

      case 'SERVICE_WORKER_EMERGENCY_REVIVAL':
        console.warn('Service worker reported emergency revival - checking health')
        validateSubscription()
        setupRealtimeConnection()
        break

      case 'EMERGENCY_DATA_REFRESH':
        console.warn('Service worker requested emergency data refresh')
        checkNotifications()
        break

      case 'FORCE_DATA_REFRESH':
        checkNotifications()
        break

      case 'SERVICE_WORKER_WAKE_UP_CALL':
        console.error(`🚨 Service worker says main app was silent for ${Math.round(silentDuration / 1000)}s`)
        // Trigger full recovery
        setTimeout(() => performEmergencyRecovery(), 500)
        break

      case 'FORCE_REINITIALIZE':
        console.error('🚨 Service worker forcing reinitialization:', event.data.reason)
        // Trigger full recovery
        setTimeout(() => performEmergencyRecovery(), 500)
        break

      case 'PING_RESPONSE_REQUIRED':
        // Service worker wants confirmation we're alive - send ping
        if (swRegistrationRef.current?.active) {
          swRegistrationRef.current.active.postMessage({
            type: 'PING_REQUEST',
            timestamp: Date.now()
          })
        }
        break
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [validateSubscription, setupRealtimeConnection, checkNotifications])

  // Emergency recovery procedure
  const performEmergencyRecovery = useCallback(async () => {
    if (isRecoveringRef.current) {
      console.log('Recovery already in progress')
      return
    }

    isRecoveringRef.current = true
    console.log('🚨 EMERGENCY RECOVERY INITIATED')

    try {
      // Step 1: Re-register service worker
      console.log('Step 1: Re-registering service worker')
      const registration = await navigator.serviceWorker.register('/sw.js', {
        updateViaCache: 'none'
      })
      await registration.update()
      swRegistrationRef.current = registration

      // Step 2: Validate and refresh push subscription
      console.log('Step 2: Validating push subscription')
      await validateSubscription()
      await ensureSubscription()

      // Step 3: Reconnect Supabase realtime
      console.log('Step 3: Reconnecting Supabase realtime')
      setupRealtimeConnection()

      // Step 4: Start background tasks in service worker
      console.log('Step 4: Starting service worker background tasks')
      if (registration.active) {
        registration.active.postMessage({
          type: 'START_BACKGROUND_TASKS'
        })
        
        registration.active.postMessage({
          type: 'EMERGENCY_WAKE_UP'
        })
      }

      // Step 5: Check for pending notifications
      console.log('Step 5: Checking for pending notifications')
      await checkNotifications()

      // Step 6: Restart all intervals
      console.log('Step 6: Restarting monitoring intervals')
      startNotificationChecking()
      startSubscriptionRefresh()
      startSubscriptionValidation()
      startPingInterval()

      console.log('✅ EMERGENCY RECOVERY COMPLETE')
      toast.success('Connection restored!')

    } catch (error) {
      console.error('Emergency recovery failed:', error)
      toast.error('Failed to restore connection. Please refresh the page.')
    } finally {
      isRecoveringRef.current = false
    }
  }, [
    validateSubscription,
    ensureSubscription,
    setupRealtimeConnection,
    checkNotifications,
    startNotificationChecking,
    startSubscriptionValidation,
    startPingInterval
  ])

  // Initialize on mount
  useEffect(() => {
    initialize()

    // Cleanup
    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current)
      }
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current)
      }
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current)
      }
      if (validationIntervalRef.current) {
        clearInterval(validationIntervalRef.current)
      }
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current)
      }
      // Remove service worker message listener
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Re-initialize when restaurant changes
  useEffect(() => {
    if (currentRestaurant?.restaurant?.id) {
      ensureSubscription()
      setupRealtimeConnection()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentRestaurant?.restaurant?.id])

  // Listen for visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        const hiddenDuration = Date.now() - lastVisibleTimeRef.current
        console.log(`App became visible after ${Math.round(hiddenDuration / 1000)}s`)
        
        // If hidden for more than 5 minutes, trigger emergency recovery
        if (hiddenDuration > 300000) { // 5 minutes
          console.warn('⚠️ App was hidden for >5 minutes - triggering emergency recovery')
          setTimeout(() => performEmergencyRecovery(), EMERGENCY_RECOVERY_DELAY)
        } else {
          // Standard recovery for shorter periods
          checkNotifications()
          validateSubscription()
        }
        
        // Update service worker
        if (swRegistrationRef.current?.active) {
          swRegistrationRef.current.active.postMessage({
            type: 'APP_VISIBILITY_CHANGE',
            isVisible: true
          })
        }
      } else {
        lastVisibleTimeRef.current = Date.now()
        console.log('App became hidden')
        
        // Notify service worker
        if (swRegistrationRef.current?.active) {
          swRegistrationRef.current.active.postMessage({
            type: 'APP_VISIBILITY_CHANGE',
            isVisible: false
          })
        }
      }
    }

    // Page Lifecycle API - detect freeze/resume
    const handleFreeze = () => {
      console.warn('🧊 Page frozen - will need recovery on resume')
      lastVisibleTimeRef.current = Date.now()
    }

    const handleResume = () => {
      const frozenDuration = Date.now() - lastVisibleTimeRef.current
      console.warn(`🔥 Page resumed after ${Math.round(frozenDuration / 1000)}s frozen`)
      
      // Always trigger emergency recovery after freeze
      setTimeout(() => performEmergencyRecovery(), EMERGENCY_RECOVERY_DELAY)
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    document.addEventListener('freeze', handleFreeze)
    document.addEventListener('resume', handleResume)
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      document.removeEventListener('freeze', handleFreeze)
      document.removeEventListener('resume', handleResume)
    }
  }, [checkNotifications])

  // Listen for online/offline
  useEffect(() => {
    const handleOnline = () => {
      console.log('Back online - checking notifications')
      checkNotifications()
      ensureSubscription()
    }

    window.addEventListener('online', handleOnline)
    
    return () => {
      window.removeEventListener('online', handleOnline)
    }
  }, [checkNotifications, ensureSubscription])

  return null // This is a background component
}

// Helper function
function urlBase64ToUint8Array(base64String?: string): Uint8Array {
  if (!base64String || typeof base64String !== 'string') {
    return new Uint8Array()
  }
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/')
  
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}