"use client"

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { pushNotificationManager, PushNotificationData } from '@/lib/push-notifications'

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
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isPushEnabled, setIsPushEnabled] = useState(false)

  // Initialize push notifications
  useEffect(() => {
    const initPush = async () => {
      const initialized = await pushNotificationManager.initialize()
      if (initialized) {
        const hasPermission = await pushNotificationManager.isPermissionGranted()
        setIsPushEnabled(hasPermission)
      }
    }
    initPush()
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

    const newNotification: Notification = {
      ...notification,
      id: Math.random().toString(36).substring(2, 11),
      timestamp: new Date()
    }
    
    setNotifications(prev => {
      const updated = [newNotification, ...prev]
 
      return updated
    })
    
    // Play sound for booking notifications
    if (notification.type === 'booking') {
    
      playNotificationSound('booking', notification.variant)
    }

    // Send push notification if enabled (fire and forget)
    if (isPushEnabled) {
     
      const pushData: PushNotificationData = {
        title: notification.title,
        body: notification.message,
        icon: '/icon-192x192.png',
        url: '/dashboard',
        data: notification.data
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
        isPushEnabled
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
 
  
  return context
}
