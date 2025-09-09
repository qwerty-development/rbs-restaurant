"use client"

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'

export interface Notification {
  id: string
  type: 'booking' | 'order' | 'general'
  title: string
  message: string
  timestamp: Date
  data?: any
}

interface NotificationContextType {
  notifications: Notification[]
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => void
  removeNotification: (id: string) => void
  clearAllNotifications: () => void
  playNotificationSound: (type: 'booking' | 'order' | 'general') => void
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([])

  const playNotificationSound = useCallback((type: 'booking' | 'order' | 'general') => {
    try {
      const audio = new Audio()
      let soundPath = ''
      switch (type) {
        case 'booking':
          soundPath = '/sounds/booking-notification.wav'
          break
        case 'order':
          soundPath = '/sounds/notification-update.mp3'
          break
        case 'general':
          soundPath = '/sounds/notification-new.mp3'
          break
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
    
    setNotifications(prev => [newNotification, ...prev])
    
    // Play sound for booking notifications
    if (notification.type === 'booking') {
      playNotificationSound('booking')
    }
  }, [playNotificationSound])

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
        playNotificationSound
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
  return context
}
