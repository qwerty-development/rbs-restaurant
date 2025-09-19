import { createClient } from '@/lib/supabase/client'
import { RealtimeChannel } from '@supabase/supabase-js'

export interface RealtimeSubscriptionConfig {
  table: string
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*'
  filter?: string
  schema?: string
}

export interface ManagedSubscription {
  channel: RealtimeChannel
  config: RealtimeSubscriptionConfig
  callbacks: Array<(payload: any) => void>
  name: string
  isActive: boolean
}

export class RealtimeRecoveryManager {
  private subscriptions = new Map<string, ManagedSubscription>()
  private supabase = createClient()
  private isReconnecting = false

  /**
   * Create a managed subscription that can be automatically recovered
   */
  createManagedSubscription(
    name: string,
    config: RealtimeSubscriptionConfig,
    callback: (payload: any) => void
  ): RealtimeChannel {
    // Remove existing subscription if it exists
    this.removeManagedSubscription(name)

    const channelName = `${config.table}-${name}-${Date.now()}`
    const channel = this.supabase.channel(channelName)

    const subscription: ManagedSubscription = {
      channel,
      config,
      callbacks: [callback],
      name,
      isActive: false
    }

    // Set up the subscription
    const subscriptionConfig: any = {
      event: config.event || '*',
      schema: config.schema || 'public',
      table: config.table
    }

    if (config.filter) {
      subscriptionConfig.filter = config.filter
    }

    channel.on('postgres_changes', subscriptionConfig, (payload) => {
      subscription.callbacks.forEach(cb => {
        try {
          cb(payload)
        } catch (error) {
          console.error(`Error in callback for subscription ${name}:`, error)
        }
      })
    })

    // Subscribe and track status
    channel.subscribe((status) => {
      subscription.isActive = status === 'SUBSCRIBED'
      console.log(`📡 Subscription ${name} status:`, status)

      if (status === 'CLOSED' && !this.isReconnecting) {
        console.warn(`⚠️ Subscription ${name} closed unexpectedly`)
      }
    })

    this.subscriptions.set(name, subscription)
    console.log(`✅ Created managed subscription: ${name}`)

    return channel
  }

  /**
   * Add additional callback to existing subscription
   */
  addCallback(name: string, callback: (payload: any) => void): boolean {
    const subscription = this.subscriptions.get(name)
    if (subscription) {
      subscription.callbacks.push(callback)
      return true
    }
    return false
  }

  /**
   * Remove a managed subscription
   */
  async removeManagedSubscription(name: string): Promise<void> {
    const subscription = this.subscriptions.get(name)
    if (subscription) {
      try {
        await this.supabase.removeChannel(subscription.channel)
      } catch (error) {
        console.warn(`Error removing subscription ${name}:`, error)
      }
      this.subscriptions.delete(name)
      console.log(`🗑️ Removed managed subscription: ${name}`)
    }
  }

  /**
   * Reconnect all managed subscriptions
   */
  async reconnectAll(): Promise<void> {
    if (this.isReconnecting) {
      console.log('🔄 Reconnection already in progress, skipping...')
      return
    }

    this.isReconnecting = true
    console.log('🔄 Reconnecting all managed subscriptions...')

    const subscriptionsToReconnect = Array.from(this.subscriptions.entries())

    try {
      // First, close all existing channels
      await Promise.all(
        subscriptionsToReconnect.map(async ([name, subscription]) => {
          try {
            await this.supabase.removeChannel(subscription.channel)
          } catch (error) {
            console.warn(`Error removing channel for ${name}:`, error)
          }
        })
      )

      // Clear all subscriptions
      this.subscriptions.clear()

      // Recreate all subscriptions
      for (const [name, oldSubscription] of subscriptionsToReconnect) {
        try {
          // Recreate with first callback, then add additional callbacks
          const firstCallback = oldSubscription.callbacks[0]
          if (firstCallback) {
            this.createManagedSubscription(name, oldSubscription.config, firstCallback)

            // Add remaining callbacks
            for (let i = 1; i < oldSubscription.callbacks.length; i++) {
              this.addCallback(name, oldSubscription.callbacks[i])
            }
          }
        } catch (error) {
          console.error(`Error recreating subscription ${name}:`, error)
        }
      }

      console.log(`✅ Reconnected ${subscriptionsToReconnect.length} subscriptions`)
    } catch (error) {
      console.error('❌ Error during reconnection:', error)
    } finally {
      this.isReconnecting = false
    }
  }

  /**
   * Get status of all subscriptions
   */
  getSubscriptionStatus(): Record<string, { isActive: boolean; callbackCount: number }> {
    const status: Record<string, { isActive: boolean; callbackCount: number }> = {}

    for (const [name, subscription] of this.subscriptions) {
      status[name] = {
        isActive: subscription.isActive,
        callbackCount: subscription.callbacks.length
      }
    }

    return status
  }

  /**
   * Check if any subscriptions are inactive
   */
  hasInactiveSubscriptions(): boolean {
    return Array.from(this.subscriptions.values()).some(sub => !sub.isActive)
  }

  /**
   * Get count of active subscriptions
   */
  getActiveSubscriptionCount(): number {
    return Array.from(this.subscriptions.values()).filter(sub => sub.isActive).length
  }

  /**
   * Get total subscription count
   */
  getTotalSubscriptionCount(): number {
    return this.subscriptions.size
  }

  /**
   * Cleanup all subscriptions
   */
  async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up all managed subscriptions...')

    const subscriptionNames = Array.from(this.subscriptions.keys())
    await Promise.all(
      subscriptionNames.map(name => this.removeManagedSubscription(name))
    )

    console.log('✅ All managed subscriptions cleaned up')
  }
}

// Singleton instance for global use
export const realtimeRecoveryManager = new RealtimeRecoveryManager()

// Utility functions for common subscription patterns
export function createBookingSubscription(
  restaurantId: string,
  callback: (payload: any) => void,
  name = 'bookings'
): RealtimeChannel {
  return realtimeRecoveryManager.createManagedSubscription(
    name,
    {
      table: 'bookings',
      event: '*',
      filter: `restaurant_id=eq.${restaurantId}`
    },
    callback
  )
}

export function createWaitlistSubscription(
  restaurantId: string,
  callback: (payload: any) => void,
  name = 'waitlist'
): RealtimeChannel {
  return realtimeRecoveryManager.createManagedSubscription(
    name,
    {
      table: 'waitlist',
      event: '*',
      filter: `restaurant_id=eq.${restaurantId}`
    },
    callback
  )
}

export function createTableSubscription(
  restaurantId: string,
  callback: (payload: any) => void,
  name = 'tables'
): RealtimeChannel {
  return realtimeRecoveryManager.createManagedSubscription(
    name,
    {
      table: 'restaurant_tables',
      event: '*',
      filter: `restaurant_id=eq.${restaurantId}`
    },
    callback
  )
}

// PWA-specific recovery functions
export function handlePWABackgroundSync() {
  // This can be called from service worker or when app regains focus
  console.log('🔄 PWA background sync triggered')
  return realtimeRecoveryManager.reconnectAll()
}

export function handlePWAConnectionRecovery() {
  // This can be called when PWA detects network recovery
  console.log('📶 PWA connection recovery triggered')
  return realtimeRecoveryManager.reconnectAll()
}