// lib/services/realtime-connection-manager.ts
import { createClient } from '@/lib/supabase/client'
import type { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js'
import { toast } from 'react-hot-toast'

export interface RealtimeSubscription {
  id: string
  channel: RealtimeChannel
  restaurantId: string
  table: string
  event: string
  filter?: string
  callback: (payload: any) => void
  isActive: boolean
  reconnectAttempts: number
  lastConnected: Date | null
}

export interface ConnectionStats {
  isConnected: boolean
  activeSubscriptions: number
  totalSubscriptions: number
  reconnectAttempts: number
  lastConnected: Date | null
  lastError: string | null
  networkStatus: 'online' | 'offline'
}

class RealtimeConnectionManager {
  private client: SupabaseClient<any, 'public', any>
  private subscriptions: Map<string, RealtimeSubscription> = new Map()
  private connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error' = 'disconnected'
  private reconnectAttempts = 0
  private maxReconnectAttempts = 10
  private reconnectDelay = 1000
  private maxReconnectDelay = 30000
  private heartbeatInterval: NodeJS.Timeout | null = null
  private connectionCheckInterval: NodeJS.Timeout | null = null
  private listeners: Set<(stats: ConnectionStats) => void> = new Set()
  private lastError: string | null = null
  private isRetrying = false

  constructor() {
    this.client = createClient()
    this.startConnectionMonitoring()
    this.setupEventListeners()
  }

  private setupEventListeners() {
    // Network status changes
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleOnline.bind(this))
      window.addEventListener('offline', this.handleOffline.bind(this))
      
      // PWA visibility changes
      document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this))
      
      // Focus/blur events
      window.addEventListener('focus', this.handleFocus.bind(this))
      window.addEventListener('blur', this.handleBlur.bind(this))
      
      // Service Worker messages
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.addEventListener('message', this.handleServiceWorkerMessage.bind(this))
      }
    }
  }

  private handleOnline() {
    console.log('🌐 Network online - reconnecting all subscriptions')
    this.reconnectAll()
  }

  private handleOffline() {
    console.log('🌐 Network offline - pausing all subscriptions')
    this.connectionStatus = 'disconnected'
    this.notifyListeners()
  }

  private handleVisibilityChange() {
    if (!document.hidden) {
      console.log('👁️ App visible - checking connection health')
      setTimeout(() => this.checkAndReconnect(), 1000)
    }
  }

  private handleFocus() {
    console.log('🎯 App focused - ensuring connections are healthy')
    setTimeout(() => this.checkAndReconnect(), 500)
  }

  private handleBlur() {
    console.log('🎯 App blurred - reducing activity')
    // Optional: Reduce heartbeat frequency when app is not focused
  }

  private handleServiceWorkerMessage(event: MessageEvent) {
    if (event.data?.type === 'SW_APP_VISIBLE') {
      console.log('📱 Service worker reports app visible')
      setTimeout(() => this.checkAndReconnect(), 1000)
    }
  }

  private startConnectionMonitoring() {
    // Heartbeat every 30 seconds
    this.heartbeatInterval = setInterval(() => {
      this.performHeartbeat()
    }, 30000)

    // Connection health check every 10 seconds
    this.connectionCheckInterval = setInterval(() => {
      this.checkConnectionHealth()
    }, 10000)
  }

  private async performHeartbeat() {
    if (this.connectionStatus === 'connected' && this.subscriptions.size > 0) {
      try {
        // Simple query to test connection
        const { error } = await this.client.from('restaurants').select('count').limit(1)
        if (error) {
          console.warn('❤️ Heartbeat failed:', error.message)
          this.handleConnectionError(error.message)
        } else {
          console.log('❤️ Heartbeat successful')
        }
      } catch (error) {
        console.warn('❤️ Heartbeat error:', error)
        this.handleConnectionError('Heartbeat failed')
      }
    }
  }

  private checkConnectionHealth() {
    const activeSubscriptions = Array.from(this.subscriptions.values()).filter(sub => sub.isActive)
    
    if (activeSubscriptions.length > 0) {
      // Check if any subscriptions haven't been active recently
      const now = new Date()
      const staleThreshold = 2 * 60 * 1000 // 2 minutes
      
      const staleSubscriptions = activeSubscriptions.filter(sub => 
        !sub.lastConnected || (now.getTime() - sub.lastConnected.getTime()) > staleThreshold
      )

      if (staleSubscriptions.length > 0) {
        console.warn(`⚠️ Found ${staleSubscriptions.length} stale subscriptions, reconnecting...`)
        this.reconnectStaleSubscriptions(staleSubscriptions)
      }
    }
  }

  private async reconnectStaleSubscriptions(staleSubscriptions: RealtimeSubscription[]) {
    for (const subscription of staleSubscriptions) {
      console.log(`🔄 Reconnecting stale subscription: ${subscription.id}`)
      await this.reconnectSubscription(subscription.id)
    }
  }

  subscribe(
    id: string, 
    restaurantId: string,
    table: string,
    event: string,
    callback: (payload: any) => void,
    filter?: string
  ): () => void {
    console.log(`🔗 Creating subscription: ${id} for table: ${table}`)
    
    // Remove existing subscription if it exists
    this.unsubscribe(id)

    const channelName = `${table}:${restaurantId}:${id}`
    const channel = this.client.channel(channelName)

    // Configure the subscription
    channel.on(
      'postgres_changes' as any,
      {
        event: event as any,
        schema: 'public',
        table: table,
        ...(filter && { filter })
      },
      (payload) => {
        // Update last activity
        const subscription = this.subscriptions.get(id)
        if (subscription) {
          subscription.lastConnected = new Date()
        }
        
        console.log(`📡 Real-time event received for ${id}:`, payload)
        callback(payload)
      }
    )

    // Handle subscription status
    channel.subscribe((status, error) => {
      const subscription = this.subscriptions.get(id)
      if (!subscription) return

      console.log(`🔗 Subscription ${id} status:`, status, error)

      if (status === 'SUBSCRIBED') {
        subscription.isActive = true
        subscription.lastConnected = new Date()
        subscription.reconnectAttempts = 0
        this.updateConnectionStatus()
        
        // Show success toast only for first connection or after errors
        if (subscription.reconnectAttempts > 0 || this.reconnectAttempts > 0) {
          toast.success(`🔄 ${table} real-time connected`)
        }
        
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        subscription.isActive = false
        this.handleSubscriptionError(id, error?.message || `Connection ${status}`)
      }
    })

    // Store subscription
    const subscription: RealtimeSubscription = {
      id,
      channel,
      restaurantId,
      table,
      event,
      filter,
      callback,
      isActive: false,
      reconnectAttempts: 0,
      lastConnected: null
    }

    this.subscriptions.set(id, subscription)
    this.notifyListeners()

    // Return unsubscribe function
    return () => this.unsubscribe(id)
  }

  private handleSubscriptionError(subscriptionId: string, errorMessage: string) {
    const subscription = this.subscriptions.get(subscriptionId)
    if (!subscription) return

    console.error(`❌ Subscription error for ${subscriptionId}:`, errorMessage)
    
    subscription.reconnectAttempts++
    this.lastError = errorMessage

    // Auto-retry with exponential backoff
    if (subscription.reconnectAttempts <= this.maxReconnectAttempts) {
      const delay = Math.min(
        this.reconnectDelay * Math.pow(2, subscription.reconnectAttempts - 1),
        this.maxReconnectDelay
      )
      
      console.log(`🔄 Retrying subscription ${subscriptionId} in ${delay}ms (attempt ${subscription.reconnectAttempts})`)
      
      setTimeout(() => {
        this.reconnectSubscription(subscriptionId)
      }, delay)
    } else {
      console.error(`💥 Max reconnect attempts reached for ${subscriptionId}`)
      toast.error(`Real-time connection failed for ${subscription.table}`)
    }

    this.updateConnectionStatus()
    this.notifyListeners()
  }

  private handleConnectionError(errorMessage: string) {
    this.lastError = errorMessage
    this.connectionStatus = 'error'
    this.reconnectAttempts++

    if (!this.isRetrying && this.reconnectAttempts <= this.maxReconnectAttempts) {
      const delay = Math.min(
        this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
        this.maxReconnectDelay
      )
      
      console.log(`🔄 Global reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`)
      this.isRetrying = true
      
      setTimeout(() => {
        this.reconnectAll()
        this.isRetrying = false
      }, delay)
    }

    this.notifyListeners()
  }

  private async reconnectSubscription(subscriptionId: string) {
    const subscription = this.subscriptions.get(subscriptionId)
    if (!subscription) return

    console.log(`🔄 Reconnecting subscription: ${subscriptionId}`)

    try {
      // Unsubscribe old channel
      this.client.removeChannel(subscription.channel)

      // Create new subscription with same parameters
      this.subscribe(
        subscription.id,
        subscription.restaurantId,
        subscription.table,
        subscription.event,
        subscription.callback,
        subscription.filter
      )
    } catch (error) {
      console.error(`Failed to reconnect subscription ${subscriptionId}:`, error)
      this.handleSubscriptionError(subscriptionId, `Reconnection failed: ${error}`)
    }
  }

  private async reconnectAll() {
    console.log('🔄 Reconnecting all subscriptions')
    
    for (const [id, subscription] of this.subscriptions) {
      if (!subscription.isActive) {
        await this.reconnectSubscription(id)
        // Small delay between reconnections to avoid overwhelming
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }
    
    this.updateConnectionStatus()
  }

  private async checkAndReconnect() {
    const inactiveSubscriptions = Array.from(this.subscriptions.values())
      .filter(sub => !sub.isActive)

    if (inactiveSubscriptions.length > 0) {
      console.log(`🔍 Found ${inactiveSubscriptions.length} inactive subscriptions, reconnecting...`)
      for (const subscription of inactiveSubscriptions) {
        await this.reconnectSubscription(subscription.id)
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }
  }

  unsubscribe(id: string) {
    const subscription = this.subscriptions.get(id)
    if (!subscription) return

    console.log(`🔌 Unsubscribing: ${id}`)
    
    try {
      this.client.removeChannel(subscription.channel)
    } catch (error) {
      console.warn(`Warning: Failed to cleanly remove channel for ${id}:`, error)
    }
    
    this.subscriptions.delete(id)
    this.updateConnectionStatus()
    this.notifyListeners()
  }

  private updateConnectionStatus() {
    const activeCount = Array.from(this.subscriptions.values()).filter(sub => sub.isActive).length
    const totalCount = this.subscriptions.size
    
    if (totalCount === 0) {
      this.connectionStatus = 'disconnected'
    } else if (activeCount === totalCount) {
      this.connectionStatus = 'connected'
      this.reconnectAttempts = 0 // Reset global counter on full connection
    } else if (activeCount > 0) {
      this.connectionStatus = 'connecting'
    } else {
      this.connectionStatus = 'disconnected'
    }
  }

  // Public methods
  getConnectionStats(): ConnectionStats {
    const activeCount = Array.from(this.subscriptions.values()).filter(sub => sub.isActive).length
    
    return {
      isConnected: this.connectionStatus === 'connected',
      activeSubscriptions: activeCount,
      totalSubscriptions: this.subscriptions.size,
      reconnectAttempts: this.reconnectAttempts,
      lastConnected: this.getLastConnectedTime(),
      lastError: this.lastError,
      networkStatus: navigator.onLine ? 'online' : 'offline'
    }
  }

  private getLastConnectedTime(): Date | null {
    const activeTimes = Array.from(this.subscriptions.values())
      .map(sub => sub.lastConnected)
      .filter(time => time !== null)
    
    if (activeTimes.length === 0) return null
    return new Date(Math.max(...activeTimes.map(time => time!.getTime())))
  }

  onConnectionChange(callback: (stats: ConnectionStats) => void): () => void {
    this.listeners.add(callback)
    // Immediately call with current stats
    callback(this.getConnectionStats())
    
    return () => {
      this.listeners.delete(callback)
    }
  }

  private notifyListeners() {
    const stats = this.getConnectionStats()
    this.listeners.forEach(listener => {
      try {
        listener(stats)
      } catch (error) {
        console.error('Error in connection stats listener:', error)
      }
    })
  }

  // Manual reconnection
  async forceReconnect() {
    console.log('🔄 Forcing reconnection of all subscriptions')
    this.reconnectAttempts = 0
    this.lastError = null
    await this.reconnectAll()
  }

  // Cleanup
  destroy() {
    console.log('🧹 Destroying realtime connection manager')
    
    // Clear intervals
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
    
    if (this.connectionCheckInterval) {
      clearInterval(this.connectionCheckInterval)
      this.connectionCheckInterval = null
    }
    
    // Unsubscribe all
    for (const id of this.subscriptions.keys()) {
      this.unsubscribe(id)
    }
    
    // Clear listeners
    this.listeners.clear()
    
    // Remove event listeners
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleOnline.bind(this))
      window.removeEventListener('offline', this.handleOffline.bind(this))
      document.removeEventListener('visibilitychange', this.handleVisibilityChange.bind(this))
      window.removeEventListener('focus', this.handleFocus.bind(this))
      window.removeEventListener('blur', this.handleBlur.bind(this))
    }
  }
}

// Singleton instance
let connectionManagerInstance: RealtimeConnectionManager | null = null

export const getRealtimeConnectionManager = (): RealtimeConnectionManager => {
  if (!connectionManagerInstance) {
    connectionManagerInstance = new RealtimeConnectionManager()
  }
  return connectionManagerInstance
}

export const resetRealtimeConnectionManager = () => {
  if (connectionManagerInstance) {
    connectionManagerInstance.destroy()
    connectionManagerInstance = null
  }
}