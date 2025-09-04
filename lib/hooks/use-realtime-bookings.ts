import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useQueryClient } from '@tanstack/react-query'
import { Booking } from '@/types'
import { RealtimeChannel } from '@supabase/supabase-js'
import toast from 'react-hot-toast'

interface UseRealtimeBookingsOptions {
  restaurantId: string
  onBookingCreated?: (booking: Booking) => void
  onBookingUpdated?: (booking: Booking, previousBooking?: Booking) => void
  onBookingDeleted?: (bookingId: string) => void
  enableToasts?: boolean
  enableSound?: boolean
}

interface RealtimeBookingsState {
  isConnected: boolean
  lastUpdate: Date | null
  connectionErrors: number
}

export function useRealtimeBookings(options: UseRealtimeBookingsOptions) {
  const {
    restaurantId,
    onBookingCreated,
    onBookingUpdated,
    onBookingDeleted,
    enableToasts = true,
    enableSound = false
  } = options

  const supabase = createClient()
  const queryClient = useQueryClient()
  const channelRef = useRef<RealtimeChannel | null>(null)
  
  const [state, setState] = useState<RealtimeBookingsState>({
    isConnected: false,
    lastUpdate: null,
    connectionErrors: 0
  })

  // Sound notification function
  const playNotificationSound = useCallback((type: 'new' | 'update' | 'urgent') => {
    if (!enableSound) return
    
    try {
      const audio = new Audio()
      switch (type) {
        case 'new':
          audio.src = '/sounds/notification-new.mp3'
          break
        case 'update':
          audio.src = '/sounds/notification-update.mp3'
          break
        case 'urgent':
          audio.src = '/sounds/notification-urgent.mp3'
          break
      }
      audio.play().catch(error => {
        console.warn('Failed to play notification sound:', error)
      })
    } catch (error) {
      console.warn('Notification sound error:', error)
    }
  }, [enableSound])

  useEffect(() => {
    if (!restaurantId) return

    // Create realtime channel for bookings
    const channel = supabase
      .channel(`bookings:restaurant:${restaurantId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'bookings',
          filter: `restaurant_id=eq.${restaurantId}`
        },
        (payload) => {
          console.log('New booking:', payload)
          
          const newBooking = payload.new as Booking
          
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
          
          // Call callback
          onBookingCreated?.(newBooking)
          
          // Show toast notification
          if (enableToasts) {
            toast.success(
              `New booking request from ${newBooking.guest_name}`,
              {
                duration: 5000,
                position: 'top-right'
              }
            )
          }
          
          // Play sound
          playNotificationSound('new')
          
          // Update state
          setState(prev => ({
            ...prev,
            lastUpdate: new Date()
          }))
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
          console.log('Updated booking:', payload)
          
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
          
          // Call callback
          onBookingUpdated?.(updatedBooking, previousBooking)
          
          // Show toast notification for status changes
          if (enableToasts && previousBooking.status !== updatedBooking.status) {
            const statusMessages = {
              confirmed: `Booking for ${updatedBooking.guest_name} confirmed`,
              declined_by_restaurant: `Booking for ${updatedBooking.guest_name} declined`,
              cancelled_by_user: `Booking for ${updatedBooking.guest_name} cancelled by user`,
              arrived: `${updatedBooking.guest_name} has checked in`,
              seated: `${updatedBooking.guest_name} has been seated`,
              completed: `${updatedBooking.guest_name}'s booking completed`,
              no_show: `${updatedBooking.guest_name} marked as no-show`
            }
            
            const message = statusMessages[updatedBooking.status as keyof typeof statusMessages]
            if (message) {
              toast(message, {
                duration: 4000,
                position: 'top-right',
                icon: updatedBooking.status === 'arrived' ? '👋' : 
                      updatedBooking.status === 'completed' ? '✅' : 
                      updatedBooking.status === 'no_show' ? '❌' : '📝'
              })
            }
          }
          
          // Play sound for urgent updates
          const urgentStatuses = ['arrived', 'no_show', 'cancelled_by_user']
          if (urgentStatuses.includes(updatedBooking.status)) {
            playNotificationSound('urgent')
          } else {
            playNotificationSound('update')
          }
          
          // Update state
          setState(prev => ({
            ...prev,
            lastUpdate: new Date()
          }))
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'bookings',
          filter: `restaurant_id=eq.${restaurantId}`
        },
        (payload) => {
          console.log('Deleted booking:', payload)
          
          const deletedBookingId = payload.old.id as string
          
          // Update query cache
          queryClient.setQueryData(
            ['bookings', restaurantId],
            (oldData: { bookings: Booking[] } | undefined) => {
              if (!oldData) return { bookings: [] }
              return {
                ...oldData,
                bookings: oldData.bookings.filter(booking => booking.id !== deletedBookingId)
              }
            }
          )
          
          // Call callback
          onBookingDeleted?.(deletedBookingId)
          
          // Show toast notification
          if (enableToasts) {
            toast.error('Booking deleted', {
              duration: 3000,
              position: 'top-right'
            })
          }
          
          // Update state
          setState(prev => ({
            ...prev,
            lastUpdate: new Date()
          }))
        }
      )
      .subscribe((status, error) => {
        console.log('Realtime subscription status:', status, error)
        
        if (status === 'SUBSCRIBED') {
          setState(prev => ({
            ...prev,
            isConnected: true,
            connectionErrors: 0
          }))
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setState(prev => ({
            ...prev,
            isConnected: false,
            connectionErrors: prev.connectionErrors + 1
          }))
          
          if (enableToasts && state.connectionErrors > 2) {
            toast.error('Realtime connection issues. Some updates may be delayed.', {
              duration: 5000,
              position: 'bottom-center'
            })
          }
        }
      })

    channelRef.current = channel

    // Cleanup function
    return () => {
      if (channelRef.current) {
        console.log('Unsubscribing from realtime channel')
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
      
      setState(prev => ({
        ...prev,
        isConnected: false
      }))
    }
  }, [restaurantId, queryClient, onBookingCreated, onBookingUpdated, onBookingDeleted, enableToasts, enableSound, state.connectionErrors, supabase, playNotificationSound])

  // Method to manually reconnect
  const reconnect = () => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }
    
    setState(prev => ({
      ...prev,
      connectionErrors: 0
    }))
  }

  // Method to check connection status
  const getConnectionStatus = () => ({
    ...state,
    channelState: channelRef.current?.state || 'closed'
  })

  return {
    ...state,
    reconnect,
    getConnectionStatus
  }
}

// Helper hook for booking status changes specifically
export function useBookingStatusUpdates(
  restaurantId: string,
  onStatusChange?: (booking: Booking, previousStatus: string) => void
) {
  return useRealtimeBookings({
    restaurantId,
    onBookingUpdated: (updatedBooking, previousBooking) => {
      if (previousBooking && previousBooking.status !== updatedBooking.status) {
        onStatusChange?.(updatedBooking, previousBooking.status)
      }
    },
    enableToasts: false // Let the parent component handle toasts
  })
}

// Helper hook for urgent booking notifications
export function useUrgentBookingNotifications(
  restaurantId: string,
  urgentStatuses: string[] = ['pending', 'arrived', 'no_show']
) {
  const [urgentCount, setUrgentCount] = useState(0)
  
  const { isConnected } = useRealtimeBookings({
    restaurantId,
    onBookingCreated: (booking) => {
      if (urgentStatuses.includes(booking.status)) {
        setUrgentCount(prev => prev + 1)
      }
    },
    onBookingUpdated: (updatedBooking, previousBooking) => {
      const wasUrgent = previousBooking && urgentStatuses.includes(previousBooking.status)
      const isUrgent = urgentStatuses.includes(updatedBooking.status)
      
      if (isUrgent && !wasUrgent) {
        setUrgentCount(prev => prev + 1)
      } else if (!isUrgent && wasUrgent) {
        setUrgentCount(prev => Math.max(0, prev - 1))
      }
    },
    enableToasts: true,
    enableSound: true
  })

  const clearUrgentCount = () => setUrgentCount(0)

  return {
    urgentCount,
    isConnected,
    clearUrgentCount
  }
}
