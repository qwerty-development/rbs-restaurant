'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { Bell, BellOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { SubscriptionWatchdog } from './subscription-watchdog'

// Convert VAPID key
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

interface EnhancedPWAProviderProps {
  children: React.ReactNode
  restaurantId?: string
}

export function EnhancedPWAProvider({ 
  children, 
  restaurantId 
}: EnhancedPWAProviderProps) {
  const router = useRouter()
  const supabase = createClient()
  const [isOnline, setIsOnline] = useState(true)
  const [swRegistration, setSwRegistration] = useState<ServiceWorkerRegistration | null>(null)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isSupported, setIsSupported] = useState(false)
  const [showPermissionBanner, setShowPermissionBanner] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const subscriptionRefreshInProgress = useRef(false)

  // CRITICAL: Force resubscribe to push notifications
  const forceResubscribe = useCallback(async () => {
    if (!swRegistration || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
      console.log('[PWA] Cannot resubscribe - SW or VAPID key missing')
      return
    }

    if (subscriptionRefreshInProgress.current) {
      console.log('[PWA] Subscription refresh already in progress')
      return
    }

    subscriptionRefreshInProgress.current = true
    console.log('[PWA] 🔄 Force resubscribing to push notifications...')

    try {
      // First, unsubscribe from existing subscription if any
      const existingSubscription = await swRegistration.pushManager.getSubscription()
      if (existingSubscription) {
        console.log('[PWA] Unsubscribing from old subscription')
        await existingSubscription.unsubscribe()
      }

      // Create fresh subscription
      const newSubscription = await swRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
        ) as any
      })

      console.log('[PWA] ✅ New subscription created')

      // Subscribe via API
      const response = await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          subscription: newSubscription.toJSON(),
          deviceInfo: {
            browser: detectBrowser(),
            device: detectDevice()
          }
        })
      })

      const result = await response.json()

      if (response.ok && result.success) {
        setIsSubscribed(true)
        console.log('[PWA] ✅ Force resubscribe successful')
        
        // Notify service worker
        if (navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({
            type: 'SUBSCRIPTION_REFRESHED',
            timestamp: Date.now()
          })
        }
        
        toast.success('🔔 Notifications reconnected!')
      } else {
        throw new Error(result.error || 'Failed to subscribe')
      }
    } catch (error: any) {
      console.error('[PWA] Force resubscribe failed:', error)
      toast.error('Failed to reconnect notifications')
    } finally {
      subscriptionRefreshInProgress.current = false
    }
  }, [swRegistration])

  // Handle subscription issues from watchdog
  const handleSubscriptionStale = useCallback(() => {
    console.log('[PWA] 🚨 Subscription is stale - forcing resubscribe')
    forceResubscribe()
  }, [forceResubscribe])

  const handleSubscriptionMissing = useCallback(() => {
    console.log('[PWA] 🚨 Subscription is missing - forcing resubscribe')
    forceResubscribe()
  }, [forceResubscribe])

  // Check if notifications are supported and permission status
  const checkNotificationSupport = useCallback(async () => {
    if ('Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window) {
      setIsSupported(true)
      
      if (swRegistration) {
        const subscription = await swRegistration.pushManager.getSubscription()
        setIsSubscribed(!!subscription)
        
        // Show banner if notifications are supported but not subscribed
        if (!subscription && Notification.permission === 'default') {
          setShowPermissionBanner(true)
        }
      }
    }
  }, [swRegistration])

  // Request notification permission and subscribe
  const requestNotificationPermission = useCallback(async () => {
    if (!swRegistration || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
      toast.error('Notification system not ready')
      return
    }

    setIsLoading(true)
    try {
      const permission = await Notification.requestPermission()
      
      if (permission === 'granted') {
        const subscription = await swRegistration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(
            process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
          ) as any
        })

        // Subscribe via API
        const response = await fetch('/api/notifications/subscribe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            subscription: subscription.toJSON(),
            deviceInfo: {
              browser: detectBrowser(),
              device: detectDevice()
            }
          })
        })

        const result = await response.json()

        if (response.ok && result.success) {
          setIsSubscribed(true)
          setShowPermissionBanner(false)
          toast.success('🔔 Notifications enabled! You\'ll now receive important updates.')
          
          // Play notification sound if available
          if (audioRef.current) {
            audioRef.current.play().catch(() => {})
          }
        } else {
          throw new Error(result.error || 'Failed to subscribe')
        }
      } else if (permission === 'denied') {
        toast.error('Notifications blocked. Enable them in browser settings.')
        setShowPermissionBanner(false)
      }
    } catch (error: any) {
      console.error('Notification subscription failed:', error)
      toast.error(error.message || 'Failed to enable notifications')
    } finally {
      setIsLoading(false)
    }
  }, [swRegistration])

  // Test notification
  const testNotification = useCallback(async () => {
    if (!isSubscribed) {
      toast.error('Subscribe to notifications first')
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch('/api/notifications/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const result = await response.json()

      if (response.ok) {
        toast.success(`Test notification sent! (${result.sent} delivered, ${result.failed} failed)`)
      } else {
        throw new Error(result.error || 'Failed to send test notification')
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to send test notification')
    } finally {
      setIsLoading(false)
    }
  }, [isSubscribed])

  // Initialize service worker
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js', {
          scope: '/',
          updateViaCache: 'none'
        })
        .then((registration) => {
          console.log('📱 Service Worker registered:', registration)
          setSwRegistration(registration)

          // Handle service worker updates
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed') {
                  if (navigator.serviceWorker.controller) {
                    toast.info('App update available!', {
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

          // Listen for messages from service worker
          navigator.serviceWorker.addEventListener('message', (event) => {
            const { type, data } = event.data || {}
            
            switch (type) {
              case 'NAVIGATE_TO':
                router.push(event.data.url)
                break
                
              case 'PUSH_SUBSCRIPTION_MISSING':
              case 'PUSH_SUBSCRIPTION_STALE':
              case 'PUSH_CONNECTION_DEAD':
                console.log(`[PWA] 🚨 Service worker reports: ${type}`)
                forceResubscribe()
                break
                
              case 'VALIDATE_PUSH_SUBSCRIPTION':
              case 'REFRESH_SUBSCRIPTION_ON_SERVER':
                console.log('[PWA] Service worker requesting subscription validation')
                // Watchdog will handle this
                break
            }
          })

          // Register background sync if supported
          if ('sync' in ServiceWorkerRegistration.prototype) {
            ;(registration as any).sync?.register('sync-notifications').catch((error: any) => {
              console.log('Background sync registration failed:', error)
            })
          }

          // Register periodic sync if supported (Chrome only)
          if ('periodicSync' in ServiceWorkerRegistration.prototype) {
            ;(registration as any).periodicSync?.register('check-notifications', {
              minInterval: 60000 // 1 minute
            }).catch((error: any) => {
              console.log('Periodic sync registration failed:', error)
            })
          }
        })
        .catch((error) => {
          console.error('Service Worker registration failed:', error)
        })
    }
  }, [router])

  // Check notification support when SW is ready
  useEffect(() => {
    if (swRegistration) {
      checkNotificationSupport()
    }
  }, [swRegistration, checkNotificationSupport])

  // Handle online/offline
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      toast.success('🟢 Back online!')
      
      // Trigger background sync when back online
      if (swRegistration) {
        ;(swRegistration as any).sync?.register('sync-notifications').catch(console.error)
      }
    }

    const handleOffline = () => {
      setIsOnline(false)
      toast.error('🔴 You\'re offline. Some features may not work.')
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    
    // Check initial online status
    setIsOnline(navigator.onLine)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [swRegistration])

  // Real-time subscription for notifications
  useEffect(() => {
    if (!restaurantId) return

    const channel = supabase
      .channel(`notifications:${restaurantId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `data->restaurant_id=eq.${restaurantId}`
      }, (payload) => {
        console.log('Real-time notification:', payload.new)
        
        // Show in-app toast for real-time notifications
        toast.info((payload.new as any).title, {
          description: (payload.new as any).message,
          duration: 5000
        })
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [restaurantId, supabase])

  // Helper functions
  const detectBrowser = (): string => {
    if (typeof window === 'undefined') return 'unknown'
    const userAgent = navigator.userAgent
    if (userAgent.includes('Chrome')) return 'Chrome'
    if (userAgent.includes('Firefox')) return 'Firefox'
    if (userAgent.includes('Safari')) return 'Safari'
    if (userAgent.includes('Edge')) return 'Edge'
    return 'Other'
  }

  const detectDevice = (): string => {
    if (typeof window === 'undefined') return 'unknown'
    const userAgent = navigator.userAgent
    if (/Android/i.test(userAgent)) return 'Android'
    if (/iPhone|iPad|iPod/i.test(userAgent)) return 'iOS'
    if (/Windows/i.test(userAgent)) return 'Windows'
    if (/Mac/i.test(userAgent)) return 'macOS'
    return 'Other'
  }

  // Permission Banner Component
  const PermissionBanner = () => {
    if (!isSupported || !showPermissionBanner || isSubscribed) return null

    return (
      <div className="fixed top-0 left-0 right-0 bg-blue-600 text-white p-2 z-50 shadow-lg">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            <span className="text-sm font-medium">Enable notifications</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowPermissionBanner(false)}
              className="bg-white/20 hover:bg-white/30 text-white h-6 px-2 text-xs"
            >
              Later
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={requestNotificationPermission}
              disabled={isLoading}
              className="bg-white text-blue-600 hover:bg-gray-100 h-6 px-2 text-xs"
            >
              {isLoading ? 'Enabling...' : 'Enable'}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // Status indicator - compact floating button
  const StatusIndicator = () => {
    if (!isSupported) return null

    return (
      <div className="fixed bottom-4 right-4 z-40">
        <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-2 min-w-[200px]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isSubscribed ? (
                <Bell className="h-3 w-3 text-green-600" />
              ) : (
                <BellOff className="h-3 w-3 text-gray-500" />
              )}
              <span className="text-xs font-medium">
                {isSubscribed ? 'Notifications On' : 'Notifications Off'}
              </span>
              <div className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`} />
            </div>
            {!isSubscribed ? (
              <Button
                size="sm"
                onClick={requestNotificationPermission}
                disabled={isLoading}
                className="h-6 px-2 text-xs"
              >
                {isLoading ? 'Enabling...' : 'Enable'}
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={testNotification}
                disabled={isLoading}
                className="h-6 px-2 text-xs"
              >
                Test
              </Button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <PermissionBanner />
      {/* CRITICAL: Subscription Watchdog to prevent numb state */}
      <SubscriptionWatchdog
        enabled={isSubscribed}
        onSubscriptionStale={handleSubscriptionStale}
        onSubscriptionMissing={handleSubscriptionMissing}
      />
      {children}
      {process.env.NODE_ENV === 'development' && <StatusIndicator />}
      
      {/* Audio element for notification sounds */}
      <audio
        ref={audioRef}
        src="/notification-sound.mp3"
        preload="auto"
        style={{ display: 'none' }}
      />
    </>
  )
}