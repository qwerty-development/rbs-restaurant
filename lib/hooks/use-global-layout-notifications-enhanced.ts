"use client"

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useQueryClient } from '@tanstack/react-query'
import { useNotifications } from '@/lib/contexts/notification-context'
import { getRealtimeConnectionManager } from '@/lib/services/realtime-connection-manager'
import { Booking } from '@/types'
import { getBookingDisplayName } from '@/lib/utils'
import { usePathname, useSearchParams } from 'next/navigation'

export function useGlobalLayoutNotifications() {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const { addNotification } = useNotifications()
  const connectionManager = getRealtimeConnectionManager()
  const unsubscribeFunctionsRef = useRef<Array<() => void>>([])
  const pathname = usePathname()
  const searchParams = useSearchParams()
 
  // Extract restaurant ID from URL or search params
  const getRestaurantId = async () => {
    
    // Check if we're on a dashboard page with restaurant param
    if (pathname.startsWith('/dashboard') || pathname.startsWith('/basic-dashboard')) {
      const restaurantId = searchParams.get('restaurant')
      if (restaurantId) {
        return restaurantId
      }
    }
    
    // Check if we're on a specific restaurant page
    const pathParts = pathname.split('/')
    if (pathParts.includes('dashboard') || pathParts.includes('basic-dashboard')) {
      // Try to get from localStorage or other sources
      if (typeof window !== 'undefined') {
        const storedRestaurantId = localStorage.getItem('selected-restaurant-id')
        if (storedRestaurantId) return storedRestaurantId
      }
      
      // Get active restaurant from user's staff record
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: staffData } = await supabase
            .from('restaurant_staff')
            .select(`
              restaurant_id,
              restaurant:restaurants(
                id,
                name
              )
            `)
            .eq('user_id', user.id)
            .eq('is_active', true)
            .limit(1)
            .single()

          if (staffData?.restaurant_id) {
            return staffData.restaurant_id
          }
        }
      } catch (error) {
        console.error('Error getting restaurant ID from staff record:', error)
      }
    }

    return null
  }

  useEffect(() => {
    let mounted = true

    const setupNotifications = async () => {
      if (!mounted) return
      
      const restaurantId = await getRestaurantId()
      if (!restaurantId || !mounted) return

      console.log('🔔 Setting up enhanced global layout notifications for restaurant:', restaurantId)

      // Clear any existing subscriptions
      unsubscribeFunctionsRef.current.forEach(unsubscribe => unsubscribe())
      unsubscribeFunctionsRef.current = []

      try {
        // Subscribe to booking events using enhanced connection manager
        const unsubscribeBookings = connectionManager.subscribe(
          `global-layout-bookings:${restaurantId}`,
          restaurantId,
          'bookings',
          '*',
          async (payload: any) => {
            if (!mounted) return

            console.log('📥 Global layout booking notification:', payload)
            
            const booking = payload.new as Booking
            if (!booking) return

            // Handle different booking events
            if (payload.eventType === 'INSERT') {
              const guestName = getBookingDisplayName(booking)
              addNotification({
                type: 'booking',
                title: 'New Booking Request',
                message: `${guestName} requested a table for ${booking.party_size}`,
                data: booking
              })

              // Invalidate relevant queries
              queryClient.invalidateQueries({ queryKey: ['bookings'] })
              queryClient.invalidateQueries({ queryKey: ['basic-bookings'] })
              queryClient.invalidateQueries({ queryKey: ['todays-bookings'] })
            }

            if (payload.eventType === 'UPDATE') {
              const previousBooking = payload.old as Booking
              if (previousBooking?.status !== booking.status) {
                const guestName = getBookingDisplayName(booking)
                
                const statusMessages: Record<string, { title: string; message: string; variant?: 'success' | 'error' }> = {
                  confirmed: { title: 'Booking Confirmed', message: `${guestName}'s booking confirmed`, variant: 'success' },
                  declined_by_restaurant: { title: 'Booking Declined', message: `${guestName}'s booking declined`, variant: 'error' },
                  cancelled_by_user: { title: 'Booking Cancelled', message: `${guestName} cancelled their booking` },
                  arrived: { title: 'Guest Arrived', message: `${guestName} has arrived` },
                  seated: { title: 'Guest Seated', message: `${guestName} has been seated` },
                  completed: { title: 'Booking Complete', message: `${guestName}'s visit completed` },
                  no_show: { title: 'No-Show', message: `${guestName} marked as no-show` }
                }

                const statusInfo = statusMessages[booking.status as string]
                if (statusInfo) {
                  addNotification({
                    type: 'booking',
                    title: statusInfo.title,
                    message: statusInfo.message,
                    data: booking,
                    variant: statusInfo.variant
                  })
                }
              }

              // Invalidate relevant queries
              queryClient.invalidateQueries({ queryKey: ['bookings'] })
              queryClient.invalidateQueries({ queryKey: ['basic-bookings'] })
              queryClient.invalidateQueries({ queryKey: ['todays-bookings'] })
            }
          }
        )

        unsubscribeFunctionsRef.current.push(unsubscribeBookings)

      } catch (error) {
        console.error('❌ Error setting up global layout notifications:', error)
      }
    }

    setupNotifications()

    return () => {
      mounted = false
      console.log('🔌 Cleaning up global layout notifications')
      unsubscribeFunctionsRef.current.forEach(unsubscribe => unsubscribe())
      unsubscribeFunctionsRef.current = []
    }
  }, [pathname, searchParams, queryClient, addNotification, connectionManager])

  return {
    isConnected: connectionManager.getConnectionStats()?.isConnected ?? false
  }
}