'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { Bell, BellOff, Send, Wifi, WifiOff } from 'lucide-react'
import { subscribeUser, unsubscribeUser, sendNotification } from '@/app/actions'
import { ConnectionStatus } from '@/components/dashboard/connection-status'
import { useEnhancedRealtimeAll, type ConnectionStats } from '@/lib/hooks/use-enhanced-realtime'

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')

  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export function PushNotificationManager({ restaurantId }: { restaurantId?: string }) {
  const [isSupported, setIsSupported] = useState(false)
  const [subscription, setSubscription] = useState<PushSubscription | null>(null)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [testMessage, setTestMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const { connectionStats } = useEnhancedRealtimeAll({
    restaurantId: restaurantId || '',
    enableToasts: false,
    disabled: !restaurantId,
  })

  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      setIsSupported(true)
      // Use existing service worker registration instead of creating new one
      registerWithExistingServiceWorker()
    }
  }, [])

  async function registerWithExistingServiceWorker() {
    try {
      // Wait for our enhanced service worker to be ready
      const registration = await navigator.serviceWorker.ready
      
      const sub = await registration.pushManager.getSubscription()
      setSubscription(sub)
      setIsSubscribed(!!sub)
      
      console.log('Push notification manager integrated with enhanced service worker')
    } catch (error) {
      console.error('Failed to integrate with service worker:', error)
    }
  }

  async function subscribeToPush() {
    if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
      toast.error('VAPID public key not configured')
      return
    }

    // Check connection status before attempting subscription
    if (connectionStats && !connectionStats.isConnected) {
      toast.error('Cannot subscribe while offline. Please check your connection.')
      return
    }

    setIsLoading(true)
    try {
      const registration = await navigator.serviceWorker.ready
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
        ),
      })
      
      setSubscription(sub)
      setIsSubscribed(true)
      
      const serializedSub = JSON.parse(JSON.stringify(sub))
      const result = await subscribeUser(serializedSub)
      
      if (result.success) {
        toast.success('Successfully subscribed to push notifications!')
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      console.error('Failed to subscribe to push notifications:', error)
      toast.error('Failed to subscribe to push notifications')
      setIsSubscribed(false)
    } finally {
      setIsLoading(false)
    }
  }

  async function unsubscribeFromPush() {
    // Connection awareness in subscribe/unsubscribe - Check connection before unsubscribing
    if (connectionStats && !connectionStats.isConnected) {
      toast.error('Cannot unsubscribe while offline. Please check your connection.')
      return
    }

    setIsLoading(true)
    try {
      if (subscription) {
        await subscription.unsubscribe()
        await unsubscribeUser(subscription.endpoint)
      }
      
      setSubscription(null)
      setIsSubscribed(false)
      toast.success('Successfully unsubscribed from push notifications')
    } catch (error) {
      console.error('Failed to unsubscribe from push notifications:', error)
      toast.error('Failed to unsubscribe from push notifications')
    } finally {
      setIsLoading(false)
    }
  }

  async function sendTestNotification() {
    if (!testMessage.trim()) {
      toast.error('Please enter a test message')
      return
    }

    // Check connection status before sending
    if (connectionStats && !connectionStats.isConnected) {
      toast.error('Cannot send notification while offline. Please check your connection.')
      return
    }

    setIsLoading(true)
    try {
      const result = await sendNotification({
        title: 'Plate Management Test',
        body: testMessage,
        url: '/dashboard'
      })
      
      if (result.success) {
        toast.success(`Test notification sent! ${result.message}`)
        setTestMessage('')
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      console.error('Failed to send test notification:', error)
      toast.error('Failed to send test notification')
    } finally {
      setIsLoading(false)
    }
  }

  if (!isSupported) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BellOff className="h-5 w-5" />
            Push Notifications
          </CardTitle>
          <CardDescription>
            Push notifications are not supported in this browser
            {/* Offline state handling - Browser compatibility check */}
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  // Offline state handling - Enhanced offline detection and UI adaptation
  const isOffline = connectionStats && !connectionStats.isConnected
  const offlineMessage = isOffline ? 'Currently offline - Limited functionality' : null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Push Notifications
          {connectionStats && (
            <div className="flex items-center gap-1 text-sm">
              {connectionStats.isConnected ? (
                <Wifi className="h-4 w-4 text-green-500" />
              ) : (
                <WifiOff className="h-4 w-4 text-red-500" />
              )}
            </div>
          )}
        </CardTitle>
        <CardDescription>
          Manage push notification settings for restaurant updates
          {connectionStats && !connectionStats.isConnected && (
            <span className="text-amber-600 block mt-1">
              ⚠️ Offline - Some features may be limited
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Show connection status if available */}
        {connectionStats && restaurantId && (
          <div className="mb-4 text-sm">
            <ConnectionStatus 
              isConnected={connectionStats.isConnected}
              connectionStats={connectionStats}
              onReconnect={() => {}}
            />
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="notification-toggle">Enable Notifications</Label>
            <div className="text-sm text-muted-foreground">
              {isSubscribed 
                ? 'You will receive push notifications for important updates'
                : 'Turn on to receive push notifications'
              }
            </div>
          </div>
          <Switch
            id="notification-toggle"
            checked={isSubscribed}
            onCheckedChange={isSubscribed ? unsubscribeFromPush : subscribeToPush}
            disabled={isLoading || (connectionStats ? !connectionStats.isConnected : false)}
          />
        </div>

        {isSubscribed && (
          <div className="space-y-3 pt-4 border-t">
            <Label htmlFor="test-message">Send Test Notification</Label>
            <div className="flex gap-2">
              <Input
                id="test-message"
                placeholder="Enter test message..."
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendTestNotification()}
                disabled={connectionStats ? !connectionStats.isConnected : false}
              />
              <Button 
                onClick={sendTestNotification}
                disabled={isLoading || !testMessage.trim() || (connectionStats ? !connectionStats.isConnected : false)}
                size="icon"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
