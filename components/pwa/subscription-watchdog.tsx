'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

interface SubscriptionWatchdogProps {
  onSubscriptionStale?: () => void
  onSubscriptionMissing?: () => void
  enabled?: boolean
}

/**
 * CRITICAL COMPONENT: Monitors push subscription health and forces refresh
 * when app wakes up from background/screen-off state.
 * 
 * This is the KEY to preventing the "numb state" where notifications stop
 * being received after 15-20 minutes of screen-off time.
 */
export function SubscriptionWatchdog({
  onSubscriptionStale,
  onSubscriptionMissing,
  enabled = true
}: SubscriptionWatchdogProps) {
  const [subscriptionHealth, setSubscriptionHealth] = useState<'healthy' | 'stale' | 'missing'>('healthy')
  const [lastCheck, setLastCheck] = useState<number>(Date.now())
  const [isValidating, setIsValidating] = useState(false)
  
  const validationIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const visibilityCheckRef = useRef<NodeJS.Timeout | null>(null)
  const lastActivityRef = useRef<number>(Date.now())
  const backgroundTimeRef = useRef<number>(0)
  const lastVisibilityChangeRef = useRef<number>(Date.now())

  // CRITICAL: Validate subscription health
  const validateSubscription = async (reason: string) => {
    if (!enabled || isValidating) return
    
    setIsValidating(true)
    const now = Date.now()
    
    try {
      console.log(`[Watchdog] 🔍 Validating subscription (reason: ${reason})`)
      
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.log('[Watchdog] Push not supported')
        setSubscriptionHealth('missing')
        setIsValidating(false)
        return
      }
      
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      
      if (!subscription) {
        console.log('[Watchdog] ⚠️ No subscription found')
        setSubscriptionHealth('missing')
        onSubscriptionMissing?.()
        setIsValidating(false)
        return
      }
      
      // Check if subscription is stale
      const isStale = subscription.expirationTime && subscription.expirationTime < now
      
      if (isStale) {
        console.log('[Watchdog] ⚠️ Subscription is STALE')
        setSubscriptionHealth('stale')
        onSubscriptionStale?.()
        
        // Unsubscribe and force fresh subscription
        await subscription.unsubscribe()
        onSubscriptionMissing?.()
        setIsValidating(false)
        return
      }
      
      // Subscription exists and not expired, refresh it on server
      console.log('[Watchdog] ✅ Subscription appears healthy, refreshing on server')
      
      try {
        const response = await fetch('/api/notifications/refresh-subscription', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscription: subscription.toJSON() })
        })
        
        if (response.ok) {
          console.log('[Watchdog] Server subscription refreshed successfully')
          setSubscriptionHealth('healthy')
          setLastCheck(now)
          
          // Notify service worker that subscription was refreshed
          if (navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({
              type: 'SUBSCRIPTION_REFRESHED',
              timestamp: now
            })
          }
        } else {
          throw new Error('Server refresh failed')
        }
      } catch (error) {
        console.error('[Watchdog] Failed to refresh subscription on server:', error)
        // Don't fail completely, subscription might still work
        setSubscriptionHealth('healthy')
        setLastCheck(now)
      }
      
      lastActivityRef.current = now
      
    } catch (error) {
      console.error('[Watchdog] Subscription validation error:', error)
      setSubscriptionHealth('missing')
      onSubscriptionMissing?.()
    } finally {
      setIsValidating(false)
    }
  }

  // Handle visibility change - CRITICAL for wake-up detection
  const handleVisibilityChange = async () => {
    const isVisible = !document.hidden
    const now = Date.now()
    const timeSinceLastChange = now - lastVisibilityChangeRef.current
    
    lastVisibilityChangeRef.current = now
    
    if (isVisible) {
      // Calculate how long app was in background
      backgroundTimeRef.current = timeSinceLastChange
      
      console.log(`[Watchdog] 🎯 App became VISIBLE (was hidden for ${Math.round(timeSinceLastChange / 1000)}s)`)
      
      // If app was hidden for more than 30 seconds, aggressively validate subscription
      if (timeSinceLastChange > 30000) {
        console.log('[Watchdog] 🚨 App was hidden for 30+ seconds - FORCING subscription validation')
        
        // Wait a bit for service worker to wake up
        setTimeout(() => {
          validateSubscription('visibility_change_after_long_background')
        }, 500)
      } else {
        // Quick validation even for short background periods
        validateSubscription('visibility_change')
      }
      
      // Notify service worker
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'APP_VISIBILITY_CHANGE',
          data: { isVisible: true, backgroundTime: timeSinceLastChange }
        })
      }
    } else {
      console.log('[Watchdog] App became HIDDEN')
      
      // Notify service worker
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'APP_VISIBILITY_CHANGE',
          data: { isVisible: false }
        })
      }
    }
  }

  // Handle focus event
  const handleFocus = () => {
    const now = Date.now()
    const timeSinceLastActivity = now - lastActivityRef.current
    
    console.log(`[Watchdog] 🎯 Window FOCUSED (${Math.round(timeSinceLastActivity / 1000)}s since last activity)`)
    
    lastActivityRef.current = now
    
    // If no activity for more than 1 minute, validate subscription
    if (timeSinceLastActivity > 60000) {
      console.log('[Watchdog] No activity for 60+ seconds - validating subscription')
      validateSubscription('focus_after_inactivity')
    }
  }

  // Handle user interaction (as backup wake-up trigger)
  const handleUserInteraction = () => {
    const now = Date.now()
    const timeSinceLastActivity = now - lastActivityRef.current
    
    lastActivityRef.current = now
    
    // If no activity for more than 5 minutes, validate
    if (timeSinceLastActivity > 300000) {
      console.log('[Watchdog] First interaction after 5+ minutes - validating subscription')
      validateSubscription('user_interaction_after_long_inactivity')
    }
  }

  // Listen for service worker messages
  const handleServiceWorkerMessage = (event: MessageEvent) => {
    const { type, data } = event.data || {}
    
    switch (type) {
      case 'PUSH_SUBSCRIPTION_MISSING':
      case 'PUSH_SUBSCRIPTION_STALE':
      case 'PUSH_CONNECTION_DEAD':
        console.log(`[Watchdog] 🚨 Service worker reports: ${type}`)
        setSubscriptionHealth('missing')
        onSubscriptionMissing?.()
        break
        
      case 'VALIDATE_PUSH_SUBSCRIPTION':
      case 'REFRESH_SUBSCRIPTION_ON_SERVER':
        console.log('[Watchdog] Service worker requesting subscription validation')
        validateSubscription('service_worker_request')
        break
        
      case 'SUBSCRIPTION_HEALTH_PING':
        // Respond with validation
        validateSubscription('health_ping')
        break
        
      case 'REQUEST_PUSH_TEST':
        console.log('[Watchdog] Service worker requesting push test')
        // Client can't send push test, but we can validate subscription exists
        validateSubscription('push_test_request')
        break
    }
  }

  // Setup periodic validation and event listeners
  useEffect(() => {
    if (!enabled) return
    
    console.log('[Watchdog] 🚀 Subscription Watchdog initialized')
    
    // Initial validation
    setTimeout(() => {
      validateSubscription('initial_check')
    }, 2000)
    
    // Periodic validation every 2 minutes
    validationIntervalRef.current = setInterval(() => {
      validateSubscription('periodic_check')
    }, 120000)
    
    // Add event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)
    window.addEventListener('click', handleUserInteraction, { passive: true })
    window.addEventListener('touchstart', handleUserInteraction, { passive: true })
    
    // Service worker message listener
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage)
    }
    
    // Cleanup
    return () => {
      if (validationIntervalRef.current) {
        clearInterval(validationIntervalRef.current)
      }
      if (visibilityCheckRef.current) {
        clearInterval(visibilityCheckRef.current)
      }
      
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('click', handleUserInteraction)
      window.removeEventListener('touchstart', handleUserInteraction)
      
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage)
      }
    }
  }, [enabled])

  // Don't render anything, this is a background component
  return null
}
