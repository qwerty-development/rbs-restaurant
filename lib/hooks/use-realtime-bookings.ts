import { useEffect, useRef, useState, useCallback } from 'react'
import { toast } from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import { useQueryClient } from '@tanstack/react-query'
import { Booking } from '@/types'
import { RealtimeChannel } from '@supabase/supabase-js'
 

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
    enableToasts = false,
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
          
          // Call callback
          onBookingCreated?.(newBooking)
          
          // Notifications are handled globally in layout hook
          
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
          table: 'bookings'
        },
        (payload) => {
          const updatedBooking = payload.new as Booking
          if (!updatedBooking || updatedBooking.restaurant_id !== restaurantId) return
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
          
          // Notifications are handled globally in layout hook
          
          
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
          table: 'bookings'
        },
        (payload) => {
          const deleted = payload.old as Booking
          if (!deleted || deleted.restaurant_id !== restaurantId) return
          const deletedBookingId = deleted.id as string
          
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
      .subscribe((status) => {
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
        }
      })

    channelRef.current = channel

    // Cleanup function
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
      
      setState(prev => ({
        ...prev,
        isConnected: false
      }))
    }
  }, [restaurantId, queryClient, onBookingCreated, onBookingUpdated, onBookingDeleted, state.connectionErrors, supabase])

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
