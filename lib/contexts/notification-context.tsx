"use client"

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { pushNotificationManager, PushNotificationData } from '@/lib/push-notifications'
import { getRealtimeConnectionManager } from '@/lib/services/realtime-connection-manager'

export interface Notification {
  id: string
  type: 'booking' | 'order' | 'general'
  title: string
  message: string
  timestamp: Date
  data?: any
  variant?: 'success' | 'error' | 'info' | 'warning'
}

interface NotificationContextType {
  notifications: Notification[]
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => void
  removeNotification: (id: string) => void
  clearAllNotifications: () => void
  playNotificationSound: (type: 'booking' | 'order' | 'general', variant?: 'success' | 'error' | 'info' | 'warning') => void
  requestPushPermission: () => Promise<boolean>
  isPushEnabled: boolean
  connectionStatus: { isConnected: boolean; connectionStats?: any }
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isPushEnabled, setIsPushEnabled] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<{ isConnected: boolean; connectionStats?: any }>({ 
    isConnected: true 
  })
  
  const connectionManager = getRealtimeConnectionManager()

  // Initialize push notifications and connection monitoring
  useEffect(() => {
    const initPush = async () => {
      const initialized = await pushNotificationManager.initialize()
      if (initialized) {
        const hasPermission = await pushNotificationManager.isPermissionGranted()
        setIsPushEnabled(hasPermission)
      }
    }
    
    // connectionStatus tracking - Monitor connection status continuously
    const updateConnectionStatus = () => {
      const stats = connectionManager.getConnectionStats()
      setConnectionStatus({
        isConnected: stats.isConnected,
        connectionStats: stats
      })
    }
    
    initPush()
    updateConnectionStatus()
    
    // Update connection status periodically
    const interval = setInterval(updateConnectionStatus, 2000)
    return () => clearInterval(interval)
  }, [])

  const requestPushPermission = useCallback(async (): Promise<boolean> => {
    const permission = await pushNotificationManager.requestPermission()
    const granted = permission === 'granted'
    setIsPushEnabled(granted)
    return granted
  }, [])

  const playNotificationSound = useCallback((type: 'booking' | 'order' | 'general', variant?: 'success' | 'error' | 'info' | 'warning') => {
    try {
      const audio = new Audio()
      let soundPath = ''
      
      // Use different sounds based on type and variant
      if (type === 'booking') {
        if (variant === 'error') {
          // Cancelled/declined bookings
          soundPath = '/sounds/cancel-notification.mp3'
        } else if (variant === 'success') {
          // Confirmed/accepted bookings
          soundPath = '/sounds/accept-notification.mp3'
        } else {
          // New bookings (no variant) and other booking notifications
          soundPath = '/sounds/booking-notification.mp3'
        }
      } else {
        switch (type) {
          case 'order':
            soundPath = '/sounds/notification-update.mp3'
            break
          case 'general':
            soundPath = '/sounds/notification-new.mp3'
            break
        }
      }
      
      audio.src = soundPath
      audio.volume = 0.8 // Set volume to 80%
      audio.play().catch(() => {})
    } catch (error) {
      
    }
  }, [])

  const addNotification = useCallback((notification: Omit<Notification, 'id' | 'timestamp'>) => {
    console.log('🔔 NotificationContext: Adding notification:', notification)
    const newNotification: Notification = {
      ...notification,
      id: Math.random().toString(36).substring(2, 11),
      timestamp: new Date()
    }
    
    setNotifications(prev => {
      const updated = [newNotification, ...prev]
      console.log('🔔 NotificationContext: Updated notifications array:', updated.length, 'notifications')
      return updated
    })
    
    // Play sound for booking notifications
    if (notification.type === 'booking') {
      console.log('🔔 NotificationContext: Playing sound for booking notification')
      playNotificationSound('booking', notification.variant)
    }

    // Send push notification if enabled - enhanced with connection awareness
    // Connection-aware notifications - Enhanced notification behavior based on connection status
    if (isPushEnabled) {
      console.log('🔔 NotificationContext: Sending push notification', {
        isConnected: connectionStatus.isConnected,
        type: notification.type
      })
      
      let pushTitle = notification.title
      let pushBody = notification.message
      
      // Enhanced addNotification - Enhance notification based on connection status
      if (!connectionStatus.isConnected) {
        pushTitle = `[Offline] ${notification.title}`
        pushBody = `${notification.message}\n(Will sync when online)`
      }
      
      const pushData: PushNotificationData = {
        title: pushTitle,
        body: pushBody,
        icon: '/icon-192x192.png',
        url: '/dashboard',
        data: {
          ...notification.data,
          notificationType: notification.type,
          variant: notification.variant,
          connectionStatus: connectionStatus.isConnected ? 'online' : 'offline'
        }
      }
      
      pushNotificationManager.sendNotification(pushData).catch(error => {
        console.error('Failed to send push notification:', error)
      })
    }
  }, [playNotificationSound, isPushEnabled])

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }, [])

  const clearAllNotifications = useCallback(() => {
    setNotifications([])
  }, [])

  // Auto-remove notifications after 10 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setNotifications(prev => {
        const now = new Date()
        return prev.filter(n => {
          const diff = now.getTime() - n.timestamp.getTime()
          return diff < 10000 // Keep notifications for 10 seconds
        })
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        addNotification,
        removeNotification,
        clearAllNotifications,
        playNotificationSound,
        requestPushPermission,
        isPushEnabled,
        connectionStatus
      }}
    >
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const context = useContext(NotificationContext)
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider')
  }
  
  // Debug logging
  console.log('🔔 useNotifications: Available methods:', Object.keys(context))
  
  return context
}
