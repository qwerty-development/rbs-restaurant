"use client"

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Bell, BellOff, X } from 'lucide-react'
import { useNotifications } from '@/lib/contexts/notification-context'
import { pushNotificationManager } from '@/lib/push-notifications'
import { cn } from '@/lib/utils'

export function PushNotificationPermission() {
  const notificationContext = useNotifications()
  const { requestPushPermission, isPushEnabled } = notificationContext || {}
  const [showPrompt, setShowPrompt] = useState(false)
  const [isRequesting, setIsRequesting] = useState(false)

  // Debug logging
  console.log('🔔 PushNotificationPermission: Context methods:', Object.keys(notificationContext || {}))
  console.log('🔔 PushNotificationPermission: requestPushPermission type:', typeof requestPushPermission)

  useEffect(() => {
    // Check current permission status
    const currentPermission = pushNotificationManager.getCurrentPermission()
    console.log('🔔 PushNotificationPermission: Current permission:', currentPermission)
    
    // Show prompt if push notifications are not enabled
    if (!isPushEnabled) {
      const hasShownPrompt = localStorage.getItem('push-notification-prompt-shown')
      if (!hasShownPrompt || currentPermission === 'denied') {
        setShowPrompt(true)
      }
    }
  }, [isPushEnabled])

  const handleRequestPermission = async () => {
    if (!requestPushPermission) {
      console.error('requestPushPermission is not available')
      return
    }
    
    setIsRequesting(true)
    try {
      const granted = await requestPushPermission()
      if (granted) {
        setShowPrompt(false)
        localStorage.setItem('push-notification-prompt-shown', 'true')
      }
    } catch (error) {
      console.error('Failed to request push permission:', error)
    } finally {
      setIsRequesting(false)
    }
  }

  const handleDismiss = () => {
    setShowPrompt(false)
    localStorage.setItem('push-notification-prompt-shown', 'true')
  }

  if (!showPrompt || !requestPushPermission) return null

  return (
    <Alert className={cn(
      "border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800",
      "animate-in slide-in-from-top-2 duration-300"
    )}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          {isPushEnabled ? (
            <Bell className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          ) : (
            <BellOff className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          )}
        </div>
        
        <div className="flex-1">
          <AlertDescription className="text-blue-800 dark:text-blue-200">
            <div className="font-medium mb-1">Enable Push Notifications</div>
            <div className="text-sm">
              Get notified about new bookings even when the app is closed or in the background.
            </div>
            <div className="text-xs mt-1 text-blue-600 dark:text-blue-300">
              Current status: {pushNotificationManager.getCurrentPermission()}
            </div>
          </AlertDescription>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            onClick={handleRequestPermission}
            disabled={isRequesting}
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isRequesting ? 'Enabling...' : 'Enable'}
          </Button>
          
          <Button
            onClick={handleDismiss}
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 hover:bg-blue-100 dark:hover:bg-blue-800"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Alert>
  )
}
