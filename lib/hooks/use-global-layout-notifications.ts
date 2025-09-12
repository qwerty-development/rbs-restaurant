"use client"

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useQueryClient } from '@tanstack/react-query'
import { useNotifications } from '@/lib/contexts/notification-context'
import { Booking } from '@/types'
import { getBookingDisplayName } from '@/lib/utils'
import { usePathname, useSearchParams } from 'next/navigation'
import { useRobustRealtime } from './use-robust-realtime'

export function useGlobalLayoutNotifications() {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const { addNotification } = useNotifications()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [restaurantId, setRestaurantId] = useState<string | null>(null)

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
      
      // For basic dashboard, try to get from database
      if (pathname.startsWith('/basic-dashboard')) {
        try {
          const { data: { user } } = await supabase.auth.getUser()
          if (user) {
            const { data: staffData } = await supabase
              .from("restaurant_staff")
              .select("restaurant_id")
              .eq("user_id", user.id)
              .single()
            
            if (staffData) {
              console.log('🔔 GlobalLayoutNotifications: Found restaurant ID from database:', staffData.restaurant_id)
              return staffData.restaurant_id
            }
          }
        } catch (error) {
          console.log('🔔 GlobalLayoutNotifications: Error getting restaurant ID from database:', error)
        }
      }
    }
    
    // Try to get restaurant ID from localStorage regardless of page
    if (typeof window !== 'undefined') {
      const storedRestaurantId = localStorage.getItem('selected-restaurant-id')
      if (storedRestaurantId) return storedRestaurantId
    }
    
    return null
  }

  const getDisplayGuestName = (booking: Booking): string => getBookingDisplayName(booking)

  // Prefer guest_name, else fetch profile full_name by user_id as needed
  const resolveGuestName = async (booking: Booking): Promise<string> => {
    const local = getDisplayGuestName(booking)
    if (local && local !== 'Guest') return local
    const userId = (booking as any)?.user_id
    if (userId) {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('full_name, phone_number')
          .eq('id', userId)
          .single()
        const name = getBookingDisplayName({ user: data })
        return name || 'Guest'
      } catch {
        return 'Guest'
      }
    }
    return 'Guest'
  }

  // Handle realtime events
  const handleRealtimeEvent = async (payload: any, subscription: any) => {
    if (!restaurantId) return

    const { eventType, new: newRecord, old: oldRecord } = payload

    if (subscription.table === 'bookings') {
      if (eventType === 'INSERT') {
        await handleBookingInsert(newRecord as Booking)
      } else if (eventType === 'UPDATE') {
        await handleBookingUpdate(newRecord as Booking, oldRecord as Booking)
      }
    }
  }

  const handleBookingInsert = async (newBooking: Booking) => {
    if (!restaurantId || newBooking.restaurant_id !== restaurantId) return
    
    console.log('🔔 GlobalLayoutNotifications: Received INSERT event:', newBooking)

    // Update query cache for global bookings
    queryClient.setQueryData(
      ['bookings', restaurantId],
      (oldData: { bookings: Booking[] } | undefined) => {
        if (!oldData) return { bookings: [newBooking] }
        return {
          ...oldData,
          bookings: [newBooking, ...oldData.bookings]
        }
      }
    )

    // Also update main dashboard queries
    queryClient.setQueryData(
      ['all-bookings', restaurantId],
      (oldData: Booking[] | undefined) => {
        if (!oldData) return [newBooking]
        const exists = oldData.some(b => b.id === newBooking.id)
        if (exists) return oldData
        return [...oldData, newBooking].sort((a, b) => new Date(a.booking_time).getTime() - new Date(b.booking_time).getTime())
      }
    )

    // Update displayed bookings for current date
    const today = new Date()
    queryClient.setQueryData(
      ['displayed-bookings', restaurantId, today, 'all', 'all', 'today', 'upcoming'],
      (oldData: Booking[] | undefined) => {
        if (!oldData) return [newBooking]
        const exists = oldData.some(b => b.id === newBooking.id)
        if (exists) return oldData
        return [...oldData, newBooking].sort((a, b) => new Date(a.booking_time).getTime() - new Date(b.booking_time).getTime())
      }
    )

    // Invalidate today's bookings
    queryClient.invalidateQueries({ queryKey: ["todays-bookings"] })
    
    // Add notification
    const guestName = await resolveGuestName(newBooking)
    console.log('🔔 Adding notification for new booking:', { guestName, partySize: newBooking.party_size, bookingId: newBooking.id })
    addNotification({
      type: 'booking',
      title: 'New Booking',
      message: `New booking request from ${guestName} for ${newBooking.party_size} guests`,
      data: newBooking
    })
  }

  const handleBookingUpdate = async (updatedBooking: Booking, previousBooking: Booking) => {
    if (!restaurantId || updatedBooking.restaurant_id !== restaurantId) return

    // Update query cache for global bookings
    queryClient.setQueryData(
      ['bookings', restaurantId],
      (oldData: { bookings: Booking[] } | undefined) => {
        if (!oldData) return { bookings: [updatedBooking] }
        return {
          ...oldData,
          bookings: oldData.bookings.map(booking =>
            booking.id === updatedBooking.id ? updatedBooking : booking
          )
        }
      }
    )

    // Update main dashboard queries
    queryClient.setQueryData(
      ['all-bookings', restaurantId],
      (oldData: Booking[] | undefined) => {
        if (!oldData) return [updatedBooking]
        return oldData.map(booking =>
          booking.id === updatedBooking.id ? updatedBooking : booking
        ).sort((a, b) => new Date(a.booking_time).getTime() - new Date(b.booking_time).getTime())
      }
    )

    // Update displayed bookings for various filters
    const today = new Date()
    const commonFilters = [
      [restaurantId, today, 'all', 'all', 'today', 'upcoming'],
      [restaurantId, today, 'pending', 'all', 'today', 'upcoming'],
      [restaurantId, today, 'confirmed', 'all', 'today', 'upcoming'],
      [restaurantId, today, 'cancelled_by_user', 'all', 'today', 'upcoming'],
      [restaurantId, today, 'declined_by_restaurant', 'all', 'today', 'upcoming']
    ]

    commonFilters.forEach(filterKey => {
      queryClient.setQueryData(
        ['displayed-bookings', ...filterKey],
        (oldData: Booking[] | undefined) => {
          if (!oldData) return [updatedBooking]
          return oldData.map(booking =>
            booking.id === updatedBooking.id ? updatedBooking : booking
          ).sort((a, b) => new Date(a.booking_time).getTime() - new Date(b.booking_time).getTime())
        }
      )
    })

    // Invalidate today's bookings
    queryClient.invalidateQueries({ queryKey: ["todays-bookings"] })
    
    // Add notification for status changes
    if (previousBooking.status !== updatedBooking.status) {
      const guestName = await resolveGuestName(updatedBooking)
      const statusMap: Record<string, { title: string; message: string }> = {
        confirmed: { title: 'Booking Confirmed', message: `Booking for ${guestName} confirmed` },
        declined_by_restaurant: { title: 'Booking Declined', message: `Booking for ${guestName} declined by restaurant` },
        cancelled_by_user: { title: 'Booking Cancelled', message: `Booking for ${guestName} cancelled by customer` },
        cancelled_by_restaurant: { title: 'Booking Cancelled', message: `Booking for ${guestName} cancelled by restaurant` },
        arrived: { title: 'Guest Arrived', message: `${guestName} has checked in` },
        seated: { title: 'Guest Seated', message: `${guestName} has been seated` },
        completed: { title: 'Booking Completed', message: `${guestName}'s booking completed` },
        no_show: { title: 'No-show', message: `${guestName} marked as no-show` }
      }

      const statusInfo = statusMap[updatedBooking.status as string]
      if (statusInfo) {
        addNotification({
          type: 'booking',
          title: statusInfo.title,
          message: statusInfo.message,
          data: updatedBooking,
          variant: ['cancelled_by_user', 'cancelled_by_restaurant', 'declined_by_restaurant'].includes(updatedBooking.status as string)
            ? 'error'
            : updatedBooking.status === 'confirmed'
            ? 'success'
            : undefined
        })
      }
    }
  }

  // Get restaurant ID effect
  useEffect(() => {
    const fetchRestaurantId = async () => {
      // Skip global notifications on basic dashboard - it has its own notification system
      if (pathname.startsWith('/basic-dashboard')) {
        console.log('🔔 GlobalLayoutNotifications: Skipping setup on basic dashboard - using local notifications')
        return
      }
      
      const id = await getRestaurantId()
      console.log('🔔 GlobalLayoutNotifications: Found restaurantId:', id)
      setRestaurantId(id)
    }
    
    fetchRestaurantId()
  }, [pathname, searchParams, supabase])

  // Robust realtime subscription
  const realtimeState = useRobustRealtime({
    channelName: `global-layout-bookings:restaurant:${restaurantId}`,
    subscriptions: restaurantId ? [
      {
        table: 'bookings',
        event: 'INSERT',
        filter: `restaurant_id=eq.${restaurantId}`
      },
      {
        table: 'bookings',
        event: 'UPDATE', 
        filter: `restaurant_id=eq.${restaurantId}`
      }
    ] : [],
    onEvent: handleRealtimeEvent,
    enableRetry: true,
    maxRetries: 5,
    retryDelay: 1000,
    healthCheckInterval: 30000,
    enableLogging: true
  })

  return {
    isConnected: realtimeState.isConnected,
    connectionErrors: realtimeState.connectionErrors,
    retryCount: realtimeState.retryCount,
    lastEventTime: realtimeState.lastEventTime,
    channelState: realtimeState.channelState,
    isHealthy: realtimeState.isHealthy,
    reconnect: realtimeState.reconnect
  }
}
