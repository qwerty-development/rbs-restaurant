"use client"

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useQueryClient } from '@tanstack/react-query'
import { useNotifications } from '@/lib/contexts/notification-context'
import { RealtimeChannel } from '@supabase/supabase-js'
import { Booking } from '@/types'
import { getBookingDisplayName } from '@/lib/utils'
import { usePathname, useSearchParams } from 'next/navigation'

export function useGlobalLayoutNotifications() {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const { addNotification } = useNotifications()
  const channelRef = useRef<RealtimeChannel | null>(null)
  const pathname = usePathname()
  const searchParams = useSearchParams()
 

  // Extract restaurant ID from URL or search params
  const getRestaurantId = () => {
    
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

  useEffect(() => {
    const restaurantId = getRestaurantId()
    
    if (!restaurantId) return

    // Create realtime channel for bookings
    const channel = supabase
      .channel(`global-layout-bookings:restaurant:${restaurantId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'bookings'
        },
        async (payload) => {
          const newBooking = payload.new as Booking
          if (!newBooking || newBooking.restaurant_id !== restaurantId) return
          
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

          // Update displayed bookings for current date (if it matches)
          const today = new Date()
          const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate())
          const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
          
          queryClient.setQueryData(
            ['displayed-bookings', restaurantId, today, 'all', 'all', 'today', 'upcoming'],
            (oldData: Booking[] | undefined) => {
              if (!oldData) return [newBooking]
              const exists = oldData.some(b => b.id === newBooking.id)
              if (exists) return oldData
              return [...oldData, newBooking].sort((a, b) => new Date(a.booking_time).getTime() - new Date(b.booking_time).getTime())
            }
          )

          // Invalidate/refresh dashboard today's bookings to sync red banner immediately
          queryClient.invalidateQueries({ queryKey: ["todays-bookings"] })
          
          // Add global notification with sound
          const guestName = await resolveGuestName(newBooking)
          addNotification({
            type: 'booking',
            title: 'New Booking',
            message: `New booking request from ${guestName} for ${newBooking.party_size} guests`,
            data: newBooking
          })
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'bookings',
          filter: `restaurant_id=eq.${restaurantId}`
        },
        async (payload) => {
          const updatedBooking = payload.new as Booking
          const previousBooking = payload.old as Booking
          
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

          // Also update main dashboard queries
          queryClient.setQueryData(
            ['all-bookings', restaurantId],
            (oldData: Booking[] | undefined) => {
              if (!oldData) return [updatedBooking]
              return oldData.map(booking =>
                booking.id === updatedBooking.id ? updatedBooking : booking
              ).sort((a, b) => new Date(a.booking_time).getTime() - new Date(b.booking_time).getTime())
            }
          )

          // Update displayed bookings for all possible filter combinations
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

          // Invalidate/refresh dashboard today's bookings to sync red banner immediately
          queryClient.invalidateQueries({ queryKey: ["todays-bookings"] })
          
          // Add global notification for status changes
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
      )
      .subscribe()

    channelRef.current = channel

    // Cleanup function
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [pathname, searchParams, queryClient, addNotification, supabase])

  return {
    isConnected: channelRef.current?.state === 'joined'
  }
}
