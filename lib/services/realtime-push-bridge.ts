// lib/services/realtime-push-bridge.ts
"use client"

import { pushNotificationManager } from '@/lib/push-notifications'
import { getRealtimeConnectionManager } from '@/lib/services/realtime-connection-manager'

export interface RealtimePushBridgeConfig {
  restaurantId: string
  enableBookingNotifications?: boolean
  enableOrderNotifications?: boolean
  enableSystemNotifications?: boolean
}

// RealtimePushBridge class - Bridge between real-time events and push notifications
class RealtimePushBridge {
  private connectionManager: any
  private pushNotificationManager: any
  private subscriptions: string[] = []
  private isDestroyed = false

  constructor(private config: RealtimePushBridgeConfig) {
    this.connectionManager = getRealtimeConnectionManager()
    this.pushNotificationManager = pushNotificationManager
    this.initialize()
  }

  private async initialize() {
    // Real-time event subscriptions - Set up event listeners for bookings and orders
    this.setupBookingSubscriptions()
    this.setupOrderSubscriptions()
  }

  private setupBookingSubscriptions() {
    if (!this.config.enableBookingNotifications) return
    
    // Subscribe to booking events and trigger push notifications
    const subscriptionId = this.connectionManager.subscribe({
      restaurantId: this.config.restaurantId,
      table: 'bookings',
      event: '*',
      callback: this.handleBookingRealtimeEvent.bind(this)
    })
    
    this.subscriptions.push(subscriptionId)
  }

  private setupOrderSubscriptions() {
    if (!this.config.enableOrderNotifications) return
    
    // Subscribe to order events and trigger push notifications  
    const subscriptionId = this.connectionManager.subscribe({
      restaurantId: this.config.restaurantId,
      table: 'orders',
      event: '*',
      callback: this.handleOrderRealtimeEvent.bind(this)
    })
    
    this.subscriptions.push(subscriptionId)
  }

  private handleBookingRealtimeEvent(payload: any) {
    // Push notification triggers - Convert booking events to push notifications
    if (payload.eventType === 'INSERT') {
      this.pushNotificationManager.sendNotification({
        title: 'New Booking',
        body: `New booking for ${payload.new.party_size} guests`,
        data: { type: 'booking', bookingId: payload.new.id }
      })
    } else if (payload.eventType === 'UPDATE') {
      const status = payload.new.status
      if (status === 'confirmed') {
        this.pushNotificationManager.sendNotification({
          title: 'Booking Confirmed',
          body: `Booking has been confirmed`,
          data: { type: 'booking', bookingId: payload.new.id }
        })
      }
    }
  }

  private handleOrderRealtimeEvent(payload: any) {
    // Push notification triggers - Convert order events to push notifications
    if (payload.eventType === 'INSERT') {
      this.pushNotificationManager.sendNotification({
        title: 'New Order',
        body: `New order received`,
        data: { type: 'order', orderId: payload.new.id }
      })
    } else if (payload.eventType === 'UPDATE') {
      const status = payload.new.status
      if (status === 'ready') {
        this.pushNotificationManager.sendNotification({
          title: 'Order Ready',
          body: `Order is ready for pickup`,
          data: { type: 'order', orderId: payload.new.id }
        })
      }
    }
  }

  getStatus() {
    return {
      isInitialized: !this.isDestroyed,
      subscriptionsCount: this.subscriptions.length,
      config: this.config
    }
  }

  destroy() {
    this.subscriptions.forEach(subscriptionId => {
      this.connectionManager.unsubscribe(subscriptionId)
    })
    this.subscriptions = []
    this.isDestroyed = true
  }
}

// Singleton instance
let realtimePushBridge: RealtimePushBridge | null = null

export function getRealtimePushBridge(config?: RealtimePushBridgeConfig): RealtimePushBridge {
  if (!realtimePushBridge && config) {
    realtimePushBridge = new RealtimePushBridge(config)
  }
  return realtimePushBridge!
}

// Hook for easy usage in React components - useRealtimePushBridge hook
import { useEffect, useState } from 'react'

export function useRealtimePushBridge(config?: RealtimePushBridgeConfig) {
  const [isInitialized, setIsInitialized] = useState(false)
  const [status, setStatus] = useState<any>(null)

  useEffect(() => {
    if (!config) return

    const bridge = getRealtimePushBridge(config)
    setIsInitialized(true)
    setStatus(bridge.getStatus())

    // Update status periodically
    const interval = setInterval(() => {
      setStatus(bridge.getStatus())
    }, 5000)

    return () => {
      clearInterval(interval)
      // Note: Don't destroy bridge here as other components might be using it
      // Bridge cleanup should be handled at app level
    }
  }, [config?.restaurantId, config?.enableBookingNotifications, config?.enableOrderNotifications, config?.enableSystemNotifications])

  return { isInitialized, status, bridge: config ? getRealtimePushBridge(config) : null }
}