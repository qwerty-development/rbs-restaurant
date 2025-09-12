// lib/push-notifications.ts
"use client"

import { getRealtimeConnectionManager } from '@/lib/services/realtime-connection-manager'

export interface PushNotificationData {
  title: string
  body: string
  icon?: string
  badge?: string
  url?: string
  data?: any
}

class PushNotificationManager {
  private registration: ServiceWorkerRegistration | null = null
  private isSupported = false
  private connectionManager = getRealtimeConnectionManager()

  constructor() {
    this.isSupported = 'serviceWorker' in navigator && 'PushManager' in window
  }

  async initialize(): Promise<boolean> {
    if (!this.isSupported) {
      console.log('Push notifications not supported')
      return false
    }

    try {
      // Wait for our enhanced service worker to be ready
      this.registration = await navigator.serviceWorker.ready
      console.log('Push notification manager initialized with enhanced service worker')
      
      // Listen to PWA lifecycle events from our connection manager
      this.setupPWALifecycleIntegration()
      
      return true
    } catch (error) {
      console.error('Failed to initialize push notifications:', error)
      return false
    }
  }

  private setupPWALifecycleIntegration() {
    // Listen to visibility changes to coordinate with our enhanced system
    if (typeof window !== 'undefined') {
      document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this))
      window.addEventListener('online', this.handleOnlineStatus.bind(this))
      window.addEventListener('offline', this.handleOfflineStatus.bind(this))
    }
  }

  private handleVisibilityChange() {
    if (document.visibilityState === 'visible') {
      console.log('🔔 Push Manager: App became visible - coordinating with connection manager')
      // The connection manager will handle reconnection
    } else {
      console.log('🔔 Push Manager: App backgrounded - notifications still active')
    }
  }

  private handleOnlineStatus() {
    console.log('🔔 Push Manager: Online - notifications fully operational')
  }

  private handleOfflineStatus() {
    console.log('🔔 Push Manager: Offline - local notifications only')
  }

  async requestPermission(): Promise<NotificationPermission> {
    if (!this.isSupported) {
      console.log('Push notifications not supported in this browser')
      return 'denied'
    }

    // Check if we're on HTTPS or localhost
    if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
      console.error('Push notifications require HTTPS or localhost')
      alert('Push notifications require HTTPS. Please access the site via HTTPS.')
      return 'denied'
    }

    // Check connection status before requesting permission
    // Connection status checks - Verify connection before permission request
    const connectionStats = this.connectionManager.getConnectionStats()
    if (!connectionStats.isConnected) {
      console.log('⚠️ Push Manager: Requesting permission while offline - may have limited functionality')
    }

    try {
      console.log('Requesting notification permission...')
      const permission = await Notification.requestPermission()
      console.log('Push notification permission result:', permission)
      
      if (permission === 'granted') {
        console.log('✅ Notification permission granted!')
      } else if (permission === 'denied') {
        console.log('❌ Notification permission denied by user')
        alert('Notification permission was denied. You can enable it in your browser settings.')
      } else {
        console.log('⏳ Notification permission request was dismissed')
      }
      
      return permission
    } catch (error) {
      console.error('Failed to request notification permission:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      alert('Failed to request notification permission: ' + errorMessage)
      return 'denied'
    }
  }

  async isPermissionGranted(): Promise<boolean> {
    if (!this.isSupported) {
      return false
    }

    const permission = Notification.permission
    console.log('Current notification permission:', permission)
    return permission === 'granted'
  }

  getCurrentPermission(): NotificationPermission {
    if (!this.isSupported) {
      return 'denied'
    }
    return Notification.permission
  }

  async sendNotification(data: PushNotificationData): Promise<void> {
    if (!this.registration || !await this.isPermissionGranted()) {
      console.log('Cannot send push notification - no permission or registration')
      return
    }

    // Enhanced sendNotification - Check connection status and adapt behavior
    const connectionStats = this.connectionManager.getConnectionStats()
    let notificationData = { ...data }
    
    if (!connectionStats.isConnected) {
      // Enhance notification for offline mode
      notificationData.title = `[Offline] ${data.title}`
      notificationData.body = `${data.body}\n(Device offline - syncing when online)`
    }

    try {
      await this.registration.showNotification(notificationData.title, {
        body: notificationData.body,
        icon: notificationData.icon || '/icon-192x192.png',
        badge: notificationData.badge || '/icon-192x192.png',
        data: {
          dateOfArrival: Date.now(),
          primaryKey: notificationData.data?.id || '1',
          url: notificationData.url || '/dashboard',
          connectionStatus: connectionStats.isConnected ? 'online' : 'offline',
          ...notificationData.data
        },
        actions: [
          {
            action: 'view',
            title: 'View Details',
            icon: '/icon-192x192.png'
          },
          {
            action: 'dismiss',
            title: 'Dismiss',
            icon: '/icon-192x192.png'
          }
        ],
        tag: 'restaurant-notification', // Prevent duplicate notifications
        renotify: true, // Show even if similar notification exists
        requireInteraction: connectionStats.isConnected ? false : true // Keep visible when offline
      } as NotificationOptions)
      
      console.log('🔔 Push notification sent successfully', {
        title: notificationData.title,
        online: connectionStats.isConnected
      })
    } catch (error) {
      console.error('Failed to send push notification:', error)
    }
  }

  async subscribeToPush(): Promise<PushSubscription | null> {
    if (!this.registration || !await this.isPermissionGranted()) {
      return null
    }

    try {
      const subscription = await this.registration.pushManager.getSubscription()
      if (subscription) {
        console.log('Already subscribed to push notifications')
        return subscription
      }

      // Check connection before subscribing
      const connectionStats = this.connectionManager.getConnectionStats()
      if (!connectionStats.isConnected) {
        console.log('⚠️ Push Manager: Subscribing while offline - subscription will sync when online')
      }

      // For now, we'll use a simple approach without a push service
      // In production, you'd want to use a service like Firebase Cloud Messaging
      console.log('Push subscription would be created here (enhanced with connection awareness)')
      return null
    } catch (error) {
      console.error('Failed to subscribe to push notifications:', error)
      return null
    }
  }

  // New method to get connection-aware status
  getEnhancedStatus() {
    const connectionStats = this.connectionManager.getConnectionStats()
    return {
      isSupported: this.isSupported,
      hasPermission: this.getCurrentPermission() === 'granted',
      isConnected: connectionStats.isConnected,
      connectionStats,
      canSendNotifications: this.isSupported && 
                           this.getCurrentPermission() === 'granted' && 
                           !!this.registration
    }
  }

  // Method to cleanup listeners
  destroy() {
    if (typeof window !== 'undefined') {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange.bind(this))
      window.removeEventListener('online', this.handleOnlineStatus.bind(this))
      window.removeEventListener('offline', this.handleOfflineStatus.bind(this))
    }
  }
}

export const pushNotificationManager = new PushNotificationManager()
