import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useQueryClient } from '@tanstack/react-query'
import { RestaurantTable, Booking } from '@/types'
import { RealtimeChannel } from '@supabase/supabase-js'

interface UseRealtimeTablesOptions {
  restaurantId: string
  onTableUpdated?: (table: RestaurantTable) => void
  onTableOccupancyChanged?: (tableId: string, isOccupied: boolean, booking?: Booking) => void
}

interface TableStatus {
  id: string
  table_number: string
  is_occupied: boolean
  current_booking?: Booking
  next_booking?: Booking
  last_updated: Date
}

interface RealtimeTablesState {
  isConnected: boolean
  tableStatuses: Record<string, TableStatus>
  lastUpdate: Date | null
}

export function useRealtimeTables(options: UseRealtimeTablesOptions) {
  const { restaurantId, onTableUpdated, onTableOccupancyChanged } = options
  
  const supabase = createClient()
  const queryClient = useQueryClient()
  const channelRef = useRef<RealtimeChannel | null>(null)
  
  const [state, setState] = useState<RealtimeTablesState>({
    isConnected: false,
    tableStatuses: {},
    lastUpdate: null
  })

  // Helper function to determine if a table is occupied
  const isTableOccupied = async (tableId: string): Promise<{
    isOccupied: boolean
    currentBooking?: Booking
    nextBooking?: Booking
  }> => {
    const now = new Date()
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000)
    const fourHoursFromNow = new Date(now.getTime() + 4 * 60 * 60 * 1000)
    
    // Check for current and upcoming bookings for this table
    const { data: bookings } = await supabase
      .from('bookings')
      .select(`
        *,
        profiles!bookings_user_id_fkey(
          id,
          full_name,
          phone_number
        ),
        booking_tables!inner(
          table_id
        )
      `)
      .eq('booking_tables.table_id', tableId)
      .in('status', ['confirmed', 'arrived', 'seated', 'ordered', 'appetizers', 'main_course', 'dessert'])
      .gte('booking_time', twoHoursAgo.toISOString())
      .lte('booking_time', fourHoursFromNow.toISOString())
      .order('booking_time', { ascending: true })
    
    if (!bookings || bookings.length === 0) {
      return { isOccupied: false }
    }
    
    // Find current booking (should be within service window)
    const currentBooking = bookings.find(booking => {
      const bookingTime = new Date(booking.booking_time)
      const estimatedEndTime = new Date(bookingTime.getTime() + booking.turn_time_minutes * 60 * 1000)
      
      return bookingTime <= now && estimatedEndTime >= now && 
             ['arrived', 'seated', 'ordered', 'appetizers', 'main_course', 'dessert'].includes(booking.status)
    })
    
    // Find next booking
    const nextBooking = bookings.find(booking => 
      new Date(booking.booking_time) > now && booking.status === 'confirmed'
    )
    
    return {
      isOccupied: !!currentBooking,
      currentBooking,
      nextBooking
    }
  }

  // Update table status
  const updateTableStatus = async (tableId: string) => {
    try {
      const { isOccupied, currentBooking, nextBooking } = await isTableOccupied(tableId)
      
      // Get table info
      const { data: table } = await supabase
        .from('restaurant_tables')
        .select('*')
        .eq('id', tableId)
        .single()
      
      if (!table) return
      
      const newStatus: TableStatus = {
        id: tableId,
        table_number: table.table_number,
        is_occupied: isOccupied,
        current_booking: currentBooking,
        next_booking: nextBooking,
        last_updated: new Date()
      }
      
      setState(prev => {
        const wasOccupied = prev.tableStatuses[tableId]?.is_occupied || false
        
        // Trigger callback if occupancy changed
        if (wasOccupied !== isOccupied) {
          onTableOccupancyChanged?.(tableId, isOccupied, currentBooking)
        }
        
        return {
          ...prev,
          tableStatuses: {
            ...prev.tableStatuses,
            [tableId]: newStatus
          },
          lastUpdate: new Date()
        }
      })
      
      // Update React Query cache
      queryClient.setQueryData(['table-status', restaurantId], (oldData: any) => {
        if (!oldData) return { [tableId]: newStatus }
        return {
          ...oldData,
          [tableId]: newStatus
        }
      })
      
    } catch (error) {
      console.error('Error updating table status:', error)
    }
  }

  useEffect(() => {
    if (!restaurantId) return

    // Subscribe to booking changes that affect table status
    const channel = supabase
      .channel(`table-status:restaurant:${restaurantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookings',
          filter: `restaurant_id=eq.${restaurantId}`
        },
        async (payload) => {
          console.log('Booking change affecting table status:', payload)
          
          const booking = (payload.new || payload.old) as any
          if (!booking?.id) return
          
          // Get affected tables for this booking
          const { data: bookingTables } = await supabase
            .from('booking_tables')
            .select('table_id')
            .eq('booking_id', booking.id)
          
          // Update status for all affected tables
          if (bookingTables) {
            for (const bt of bookingTables) {
              await updateTableStatus(bt.table_id)
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'booking_tables',
          filter: `booking_id.in.(${[]})`  // Will be filtered by restaurant via booking
        },
        async (payload) => {
          console.log('Table assignment change:', payload)
          
          const assignment = (payload.new || payload.old) as any
          if (!assignment?.table_id) return
          
          await updateTableStatus(assignment.table_id)
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'restaurant_tables',
          filter: `restaurant_id=eq.${restaurantId}`
        },
        async (payload) => {
          console.log('Table configuration change:', payload)
          
          const table = (payload.new || payload.old) as any
          if (!table?.id) return
          
          // Call callback for table updates
          if (payload.new) {
            onTableUpdated?.(payload.new as RestaurantTable)
          }
          
          // Update table status
          await updateTableStatus(table.id)
          
          // Invalidate table queries
          queryClient.invalidateQueries({ queryKey: ['tables', restaurantId] })
        }
      )
      .subscribe((status, error) => {
        console.log('Table realtime subscription status:', status, error)
        
        setState(prev => ({
          ...prev,
          isConnected: status === 'SUBSCRIBED'
        }))
      })

    channelRef.current = channel

    // Initial load of table statuses
    const loadInitialTableStatuses = async () => {
      try {
        const { data: tables } = await supabase
          .from('restaurant_tables')
          .select('id')
          .eq('restaurant_id', restaurantId)
          .eq('is_active', true)
        
        if (tables) {
          for (const table of tables) {
            await updateTableStatus(table.id)
          }
        }
      } catch (error) {
        console.error('Error loading initial table statuses:', error)
      }
    }
    
    loadInitialTableStatuses()

    // Cleanup
    return () => {
      if (channelRef.current) {
        console.log('Unsubscribing from table realtime channel')
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
      
      setState(prev => ({
        ...prev,
        isConnected: false
      }))
    }
  }, [restaurantId, queryClient, onTableUpdated, onTableOccupancyChanged])

  // Get status for a specific table
  const getTableStatus = (tableId: string): TableStatus | null => {
    return state.tableStatuses[tableId] || null
  }

  // Get all occupied tables
  const getOccupiedTables = (): TableStatus[] => {
    return Object.values(state.tableStatuses).filter(status => status.is_occupied)
  }

  // Get available tables
  const getAvailableTables = (): TableStatus[] => {
    return Object.values(state.tableStatuses).filter(status => !status.is_occupied)
  }

  // Get tables with upcoming reservations
  const getTablesWithUpcomingBookings = (): TableStatus[] => {
    return Object.values(state.tableStatuses).filter(status => status.next_booking)
  }

  // Manual refresh of all table statuses
  const refreshAllTableStatuses = async () => {
    const { data: tables } = await supabase
      .from('restaurant_tables')
      .select('id')
      .eq('restaurant_id', restaurantId)
      .eq('is_active', true)
    
    if (tables) {
      const promises = tables.map(table => updateTableStatus(table.id))
      await Promise.all(promises)
    }
  }

  return {
    ...state,
    getTableStatus,
    getOccupiedTables,
    getAvailableTables,
    getTablesWithUpcomingBookings,
    refreshAllTableStatuses,
    totalTables: Object.keys(state.tableStatuses).length,
    occupiedCount: Object.values(state.tableStatuses).filter(s => s.is_occupied).length,
    availableCount: Object.values(state.tableStatuses).filter(s => !s.is_occupied).length
  }
}

// Simplified hook for just getting table occupancy counts
export function useTableOccupancyCount(restaurantId: string) {
  const { occupiedCount, availableCount, totalTables, isConnected } = useRealtimeTables({
    restaurantId
  })

  return {
    occupiedCount,
    availableCount, 
    totalTables,
    isConnected,
    occupancyRate: totalTables > 0 ? (occupiedCount / totalTables) * 100 : 0
  }
}