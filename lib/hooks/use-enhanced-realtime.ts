// lib/hooks/use-enhanced-realtime.ts
"use client"

import { useEffect, useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getRealtimeConnectionManager, type ConnectionStats } from '@/lib/services/realtime-connection-manager'
import { toast } from 'react-hot-toast'

// Re-export the ConnectionStats type
export type { ConnectionStats }

export interface UseEnhancedRealtimeOptions {
  restaurantId: string
  enableToasts?: boolean
  onConnectionChange?: (stats: ConnectionStats) => void
}

// Enhanced real-time hook for orders
export function useEnhancedRealtimeOrders(options: UseEnhancedRealtimeOptions) {
  const { restaurantId, enableToasts = true } = options
  const queryClient = useQueryClient()
  const connectionManager = getRealtimeConnectionManager()

  useEffect(() => {
    if (!restaurantId) return

    console.log('🔄 Setting up enhanced real-time orders subscription')

    try {
      const unsubscribeOrders = connectionManager.subscribe(
        `orders-${restaurantId}`,
        restaurantId,
        'orders',
        '*',
        (payload) => {
          try {
            console.log('📦 Enhanced order update received:', payload)
            
            // Invalidate all order-related queries
            queryClient.invalidateQueries({ queryKey: ['orders'] })
            queryClient.invalidateQueries({ queryKey: ['kitchen-orders'] })
            
            // Show notifications for new orders
            if (enableToasts && payload.eventType === 'INSERT') {
              toast.success('📦 New order received!')
            }
            
            // Update specific order if available
            if (payload.new && 'id' in payload.new && payload.new.id) {
              queryClient.invalidateQueries({ queryKey: ['order', payload.new.id] })
            }
          } catch (error) {
            console.error('❌ Error processing order real-time update:', error)
            if (enableToasts) {
              toast.error('Failed to process order update')
            }
          }
        },
        `restaurant_id=eq.${restaurantId}`
      )

      const unsubscribeOrderItems = connectionManager.subscribe(
        `order-items-${restaurantId}`,
        restaurantId,
        'order_items',
        '*',
        (payload) => {
          try {
            console.log('🍽️ Enhanced order items update:', payload)
            
            // Invalidate orders when items change
            queryClient.invalidateQueries({ queryKey: ['orders'] })
            queryClient.invalidateQueries({ queryKey: ['kitchen-orders'] })
            
            if (payload.new && 'order_id' in payload.new && payload.new.order_id) {
              queryClient.invalidateQueries({ queryKey: ['order', payload.new.order_id] })
            }
          } catch (error) {
            console.error('❌ Error processing order items update:', error)
            if (enableToasts) {
              toast.error('Failed to process menu update')
            }
          }
        }
      )

      return () => {
        console.log('🔌 Cleaning up enhanced orders subscription')
        unsubscribeOrders()
        unsubscribeOrderItems()
      }
    } catch (error) {
      console.error('❌ Error setting up orders subscription:', error)
      if (enableToasts) {
        toast.error('Failed to connect to real-time orders')
      }
      return () => {} // Return empty cleanup function
    }
  }, [restaurantId, queryClient, enableToasts, connectionManager])

  return { connectionManager }
}

// Enhanced real-time hook for bookings
export function useEnhancedRealtimeBookings(options: UseEnhancedRealtimeOptions) {
  const { restaurantId, enableToasts = true, onConnectionChange } = options
  const queryClient = useQueryClient()
  const connectionManager = getRealtimeConnectionManager()
  const [connectionStats, setConnectionStats] = useState<ConnectionStats | null>(null)

  // Listen for connection changes
  useEffect(() => {
    const unsubscribeConnectionStats = connectionManager.onConnectionChange((stats) => {
      setConnectionStats(stats)
      onConnectionChange?.(stats)
    })

    return unsubscribeConnectionStats
  }, [connectionManager, onConnectionChange])

  useEffect(() => {
    if (!restaurantId) return

    console.log('🔄 Setting up enhanced real-time bookings subscription')

    const unsubscribeBookings = connectionManager.subscribe(
      `bookings-${restaurantId}`,
      restaurantId,
      'bookings',
      '*',
      (payload) => {
        console.log('📅 Enhanced booking update received:', payload)
        
        // Invalidate booking queries
        queryClient.invalidateQueries({ queryKey: ['bookings'] })
        queryClient.invalidateQueries({ queryKey: ['all-bookings'] })
        queryClient.invalidateQueries({ queryKey: ['displayed-bookings'] })
        queryClient.invalidateQueries({ queryKey: ['todays-bookings'] })
        
        // Show notifications for booking changes
        if (enableToasts) {
          if (payload.eventType === 'INSERT') {
            toast.success('📅 New booking received!')
          } else if (payload.eventType === 'UPDATE' && payload.new?.status) {
            const status = payload.new.status
            if (status === 'confirmed') {
              toast.success('✅ Booking confirmed')
            } else if (status === 'arrived') {
              toast('👋 Guest has arrived', { icon: '👋' })
            }
          }
        }
        
        if (payload.new && 'id' in payload.new && payload.new.id) {
          queryClient.invalidateQueries({ queryKey: ['booking', payload.new.id] })
        }
      },
      `restaurant_id=eq.${restaurantId}`
    )

    const unsubscribeBookingStatusHistory = connectionManager.subscribe(
      `booking-status-history-${restaurantId}`,
      restaurantId,
      'booking_status_history',
      '*',
      (payload) => {
        console.log('📋 Enhanced booking status history update:', payload)
        
        queryClient.invalidateQueries({ queryKey: ['bookings'] })
        queryClient.invalidateQueries({ queryKey: ['all-bookings'] })
        queryClient.invalidateQueries({ queryKey: ['todays-bookings'] })
        
        if (payload.new && 'booking_id' in payload.new && payload.new.booking_id) {
          queryClient.invalidateQueries({ queryKey: ['booking', payload.new.booking_id] })
        }
      }
    )

    return () => {
      console.log('🔌 Cleaning up enhanced bookings subscription')
      unsubscribeBookings()
      unsubscribeBookingStatusHistory()
    }
  }, [restaurantId, queryClient, enableToasts, connectionManager])

  return { connectionManager, connectionStats }
}

// Enhanced real-time hook for tables
export function useEnhancedRealtimeTables(options: UseEnhancedRealtimeOptions) {
  const { restaurantId, enableToasts = false } = options
  const queryClient = useQueryClient()
  const connectionManager = getRealtimeConnectionManager()

  useEffect(() => {
    if (!restaurantId) return

    console.log('🔄 Setting up enhanced real-time tables subscription')

    const unsubscribeTables = connectionManager.subscribe(
      `tables-${restaurantId}`,
      restaurantId,
      'restaurant_tables',
      '*',
      (payload) => {
        console.log('🪑 Enhanced table update received:', payload)
        
        // Invalidate table-related queries
        queryClient.invalidateQueries({ queryKey: ['tables'] })
        queryClient.invalidateQueries({ queryKey: ['restaurant-tables-with-sections'] })
        queryClient.invalidateQueries({ queryKey: ['table-statuses'] })
        queryClient.invalidateQueries({ queryKey: ['realtime-tables'] })
      },
      `restaurant_id=eq.${restaurantId}`
    )

    const unsubscribeBookingTables = connectionManager.subscribe(
      `booking-tables-${restaurantId}`,
      restaurantId,
      'booking_tables',
      '*',
      (payload) => {
        console.log('🔗 Enhanced table assignment update:', payload)
        
        queryClient.invalidateQueries({ queryKey: ['tables'] })
        queryClient.invalidateQueries({ queryKey: ['table-statuses'] })
        queryClient.invalidateQueries({ queryKey: ['bookings'] })
        queryClient.invalidateQueries({ queryKey: ['all-bookings'] })
        queryClient.invalidateQueries({ queryKey: ['todays-bookings'] })
        queryClient.invalidateQueries({ queryKey: ['shared-tables-summary'] })
        queryClient.invalidateQueries({ queryKey: ['shared-table-availability'] })
      }
    )

    return () => {
      console.log('🔌 Cleaning up enhanced tables subscription')
      unsubscribeTables()
      unsubscribeBookingTables()
    }
  }, [restaurantId, queryClient, enableToasts, connectionManager])

  return { connectionManager }
}

// Enhanced real-time hook for waitlist
export function useEnhancedRealtimeWaitlist(options: UseEnhancedRealtimeOptions) {
  const { restaurantId, enableToasts = true } = options
  const queryClient = useQueryClient()
  const connectionManager = getRealtimeConnectionManager()

  useEffect(() => {
    if (!restaurantId) return

    console.log('🔄 Setting up enhanced real-time waitlist subscription')

    const unsubscribeWaitlist = connectionManager.subscribe(
      `waitlist-${restaurantId}`,
      restaurantId,
      'waitlist',
      '*',
      (payload) => {
        console.log('⏳ Enhanced waitlist update received:', payload)
        
        // Invalidate waitlist queries
        queryClient.invalidateQueries({ queryKey: ['waitlist'] })
        queryClient.invalidateQueries({ queryKey: ['waitlist-stats'] })
        
        // Show notifications for waitlist changes
        if (enableToasts) {
          if (payload.eventType === 'INSERT') {
            toast.success('⏳ New waitlist entry!')
          } else if (payload.eventType === 'UPDATE' && payload.new?.status === 'seated') {
            toast.success('✅ Waitlist guest seated!')
          }
        }
      },
      `restaurant_id=eq.${restaurantId}`
    )

    return () => {
      console.log('🔌 Cleaning up enhanced waitlist subscription')
      unsubscribeWaitlist()
    }
  }, [restaurantId, queryClient, enableToasts, connectionManager])

  return { connectionManager }
}

// Combined hook for all real-time subscriptions
export function useEnhancedRealtimeAll(options: UseEnhancedRealtimeOptions) {
  const { restaurantId, enableToasts = true, onConnectionChange } = options
  const [connectionStats, setConnectionStats] = useState<ConnectionStats | null>(null)
  
  // Set up all subscriptions
  const { connectionManager: ordersManager } = useEnhancedRealtimeOrders({ restaurantId, enableToasts })
  const { connectionManager: bookingsManager, connectionStats: bookingsStats } = useEnhancedRealtimeBookings({ 
    restaurantId, 
    enableToasts,
    onConnectionChange: (stats) => {
      setConnectionStats(stats)
      onConnectionChange?.(stats)
    }
  })
  const { connectionManager: tablesManager } = useEnhancedRealtimeTables({ restaurantId, enableToasts: false })
  const { connectionManager: waitlistManager } = useEnhancedRealtimeWaitlist({ restaurantId, enableToasts })

  // Manual reconnection function
  const forceReconnect = useCallback(() => {
    console.log('🔄 Forcing reconnection of all enhanced subscriptions')
    ordersManager.forceReconnect()
  }, [ordersManager])

  return {
    connectionManager: ordersManager, // All managers are the same singleton instance
    connectionStats: connectionStats || bookingsStats,
    forceReconnect
  }
}