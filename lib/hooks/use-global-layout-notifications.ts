"use client"

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useQueryClient } from '@tanstack/react-query'
import { useNotifications } from '@/lib/contexts/notification-context'
import { RealtimeChannel } from '@supabase/supabase-js'
import { Booking } from '@/types'
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

  const getDisplayGuestName = (booking: Booking): string => {
    const candidate = (booking as any)?.guest_name || (booking as any)?.profiles?.full_name || (booking as any)?.guest_phone
    return candidate && String(candidate).trim().length > 0 ? String(candidate) : 'Guest'
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
        (payload) => {
          const newBooking = payload.new as Booking
          if (!newBooking || newBooking.restaurant_id !== restaurantId) return
          
          // Update query cache
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
          
          // Add global notification with sound
          addNotification({
            type: 'booking',
            title: 'New Booking',
            message: `New booking request from ${getDisplayGuestName(newBooking)} for ${newBooking.party_size} guests`,
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
        (payload) => {
          const updatedBooking = payload.new as Booking
          const previousBooking = payload.old as Booking
          
          // Update query cache
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
          
          // Add global notification for status changes
          if (previousBooking.status !== updatedBooking.status) {
            const guestName = getDisplayGuestName(updatedBooking)
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
                data: updatedBooking
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
