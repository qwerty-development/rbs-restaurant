// lib/table-status.ts
import { createClient } from "@/lib/supabase/client"
import { addMinutes, differenceInMinutes } from "date-fns"

export type DiningStatus = 
  | 'pending'
  | 'confirmed'
  | 'arrived'
  | 'seated'
  | 'ordered'
  | 'appetizers'
  | 'main_course'
  | 'dessert'
  | 'payment'
  | 'completed'
  | 'no_show'
  | 'cancelled_by_user'
  | 'cancelled_by_restaurant'
  | 'declined_by_restaurant'

export interface TableStatus {
  tableId: string
  tableNumber: string
  currentBooking?: {
    id: string
    status: DiningStatus
    mealProgress?: string
    seatedAt?: Date
    progress: number // 0-100
    estimatedCompletion: Date
  }
  nextBooking?: {
    id: string
    time: Date
    partySize: number
    guestName: string
  }
  isOccupied: boolean
  canAcceptWalkIn: boolean
}

export interface StatusTransition {
  from: DiningStatus
  to: DiningStatus
  label: string
  icon?: string
  color?: string
  requiresConfirmation?: boolean
}

export class TableStatusService {
  private supabase = createClient()

  // Define valid status transitions
  static STATUS_TRANSITIONS: any = [
    { from: 'pending', to: 'confirmed', label: 'Confirm', icon: '✅', color: 'green' },
    { from: 'confirmed', to: 'arrived', label: 'Guest Arrived', icon: '👋', color: 'blue' },
    { from: 'arrived', to: 'seated', label: 'Seat Guest', icon: '🪑', color: 'indigo' },
    { from: 'seated', to: 'ordered', label: 'Order Taken', icon: '📝', color: 'purple' },
    { from: 'ordered', to: 'appetizers', label: 'Appetizers Served', icon: '🥗', color: 'green' },
    { from: 'appetizers', to: 'main_course', label: 'Main Course Served', icon: '🍽️', color: 'blue' },
    { from: 'main_course', to: 'dessert', label: 'Dessert Served', icon: '🍰', color: 'pink' },
    { from: 'main_course', to: 'payment', label: 'Request Bill', icon: '💳', color: 'yellow' },
    { from: 'dessert', to: 'payment', label: 'Request Bill', icon: '💳', color: 'yellow' },
    { from: 'payment', to: 'completed', label: 'Complete', icon: '✅', color: 'green' },
    { from: 'confirmed', to: 'no_show', label: 'Mark No Show', icon: '❌', color: 'red', requiresConfirmation: true },
    { from: 'arrived', to: 'cancelled', label: 'Cancel', icon: '🚫', color: 'red', requiresConfirmation: true }
  ]

  // Get dining progress percentage
  static getDiningProgress(status: DiningStatus): number {
    const progressMap:any= {
      'pending': 0,
      'confirmed': 5,
      'arrived': 10,
      'seated': 20,
      'ordered': 30,
      'appetizers': 50,
      'main_course': 70,
      'dessert': 85,
      'payment': 95,
      'completed': 100,
      'no_show': 100,
      'cancelled': 100
    }
    return progressMap[status] || 0
  }

  // Update booking status with history tracking
  async updateBookingStatus(
    bookingId: string,
    newStatus: DiningStatus,
    userId: string,
    metadata?: Record<string, any>
  ) {
    // Get current booking status
    const { data: booking, error: fetchError } = await this.supabase
      .from('bookings')
      .select('status')
      .eq('id', bookingId)
      .single()

    if (fetchError) throw fetchError

    // Update booking
    const updates: any = { 
      status: newStatus,
      updated_at: new Date().toISOString()
    }

    // Add specific timestamps based on status
    if (newStatus === 'arrived') {
      updates.checked_in_at = new Date().toISOString()
    }

    if (metadata?.tableId && newStatus === 'seated') {
      // Store seated time in metadata
      metadata.seated_at = new Date().toISOString()
    }

    const { error: updateError } = await this.supabase
      .from('bookings')
      .update(updates)
      .eq('id', bookingId)

    if (updateError) throw updateError

    // Log status change in history
    const { error: historyError } = await this.supabase
      .from('booking_status_history')
      .insert({
        booking_id: bookingId,
        old_status: booking.status,
        new_status: newStatus,
        changed_by: userId,
        metadata: metadata || {}
      })

    if (historyError) throw historyError

    return { success: true }
  }

  // Check in a booking and assign table
  async checkInBooking(
    bookingId: string,
    tableIds: string[],
    userId: string
  ) {
    // Start transaction-like operation
    try {
      // Update status to arrived
      await this.updateBookingStatus(bookingId, 'arrived', userId)

      // Assign tables if not already assigned
      const { data: existingTables } = await this.supabase
        .from('booking_tables')
        .select('table_id')
        .eq('booking_id', bookingId)

      if (!existingTables || existingTables.length === 0) {
        const tableAssignments = tableIds.map(tableId => ({
          booking_id: bookingId,
          table_id: tableId
        }))

        const { error: tableError } = await this.supabase
          .from('booking_tables')
          .insert(tableAssignments)

        if (tableError) throw tableError
      }

      // Auto-progress to seated after a moment
      setTimeout(() => {
        this.updateBookingStatus(bookingId, 'seated', userId, { 
          table_ids: tableIds 
        })
      }, 1000)

      return { success: true }
    } catch (error) {
      console.error('Check-in error:', error)
      throw error
    }
  }

  // Switch tables for a booking
  async switchTables(
    bookingId: string,
    newTableIds: string[],
    userId: string,
    reason?: string
  ) {
    try {
      // Delete existing table assignments
      await this.supabase
        .from('booking_tables')
        .delete()
        .eq('booking_id', bookingId)

      // Add new table assignments
      const tableAssignments = newTableIds.map(tableId => ({
        booking_id: bookingId,
        table_id: tableId
      }))

      const { error } = await this.supabase
        .from('booking_tables')
        .insert(tableAssignments)

      if (error) throw error

      // Log the change
      await this.supabase
        .from('booking_status_history')
        .insert({
          booking_id: bookingId,
          old_status: 'table_switch',
          new_status: 'table_switch',
          changed_by: userId,
          reason,
          metadata: { new_table_ids: newTableIds }
        })

      return { success: true }
    } catch (error) {
      console.error('Table switch error:', error)
      throw error
    }
  }

  // Get table status with current and next bookings
  async getTableStatuses(
    restaurantId: string,
    currentTime: Date
  ): Promise<Map<string, TableStatus>> {
    // Fetch all tables
    const { data: tables } = await this.supabase
      .from('restaurant_tables')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('is_active', true)

    if (!tables) return new Map()

    // Fetch today's bookings with table assignments
    const startOfToday = new Date(currentTime)
    startOfToday.setHours(0, 0, 0, 0)
    const endOfToday = new Date(currentTime)
    endOfToday.setHours(23, 59, 59, 999)

    const { data: bookings } = await this.supabase
      .from('bookings')
      .select(`
        *,
        profiles!bookings_user_id_fkey(full_name),
        booking_tables(table_id),
        booking_status_history(
          new_status,
          changed_at,
          metadata
        )
      `)
      .eq('restaurant_id', restaurantId)
      .gte('booking_time', startOfToday.toISOString())
      .lte('booking_time', endOfToday.toISOString())
      .in('status', ['confirmed', 'arrived', 'seated', 'ordered', 'appetizers', 'main_course', 'dessert', 'payment'])
      .order('booking_time')

    const tableStatusMap = new Map<string, TableStatus>()

    // Initialize all tables
    tables.forEach(table => {
      tableStatusMap.set(table.id, {
        tableId: table.id,
        tableNumber: table.table_number,
        isOccupied: false,
        canAcceptWalkIn: true
      })
    })

    // Process bookings
    if (bookings) {
      bookings.forEach(booking => {
        const bookingTables = booking.booking_tables || []
        const bookingStart = new Date(booking.booking_time)
        const bookingEnd = addMinutes(bookingStart, booking.turn_time_minutes || 120)

        bookingTables.forEach(({ table_id }: { table_id: string }) => {
          const tableStatus = tableStatusMap.get(table_id)
          if (!tableStatus) return

          // Check if currently occupied
          // If customer is checked in (arrived, seated, etc.), table is occupied regardless of time
          const physicallyPresent = ['arrived', 'seated', 'ordered', 'appetizers', 'main_course', 'dessert', 'payment'].includes(booking.status)
          const withinTimeWindow = currentTime >= bookingStart && currentTime <= bookingEnd
          
          if (physicallyPresent || withinTimeWindow) {
            const seatedHistory = booking.booking_status_history?.find(
              (h: any) => h.new_status === 'seated'
            )

            tableStatus.isOccupied = true
            tableStatus.canAcceptWalkIn = false
            tableStatus.currentBooking = {
              id: booking.id,
              status: booking.status as DiningStatus,
              seatedAt: seatedHistory?.changed_at ? new Date(seatedHistory.changed_at) : undefined,
              progress: TableStatusService.getDiningProgress(booking.status as DiningStatus),
              estimatedCompletion: bookingEnd,
              mealProgress: booking.status
            }
          } 
          // Check for next booking
          else if (bookingStart > currentTime && !tableStatus.nextBooking) {
            tableStatus.nextBooking = {
              id: booking.id,
              time: bookingStart,
              partySize: booking.party_size,
              guestName: booking.profiles?.full_name || booking.guest_name || 'Guest'
            }

            // Check if we can accept walk-ins before next booking
            const minutesUntilNext = differenceInMinutes(bookingStart, currentTime)
            tableStatus.canAcceptWalkIn = minutesUntilNext > 90 // 1.5 hours buffer
          }
        })
      })
    }

    return tableStatusMap
  }

  // Get valid status transitions for a booking
  getValidTransitions(currentStatus: DiningStatus): StatusTransition[] {
    return TableStatusService.STATUS_TRANSITIONS.filter((t: { from: string }) => t.from === currentStatus)
  }

  // Get all available statuses for flexibility (restaurants can jump to any status)
  getAllAvailableStatuses(currentStatus: DiningStatus): StatusTransition[] {
    // Define all possible status options with logical restrictions
    const allStatuses: StatusTransition[] = [
      { from: currentStatus, to: 'pending', label: 'Mark as Pending', icon: '⏳', color: 'gray' },
      { from: currentStatus, to: 'confirmed', label: 'Confirm Booking', icon: '✅', color: 'green' },
      { from: currentStatus, to: 'arrived', label: 'Mark as Arrived', icon: '👋', color: 'blue' },
      { from: currentStatus, to: 'seated', label: 'Mark as Seated', icon: '🪑', color: 'indigo' },
      { from: currentStatus, to: 'ordered', label: 'Mark as Ordered', icon: '📝', color: 'purple' },
      { from: currentStatus, to: 'appetizers', label: 'Appetizers Served', icon: '🥗', color: 'green' },
      { from: currentStatus, to: 'main_course', label: 'Main Course Served', icon: '🍽️', color: 'blue' },
      { from: currentStatus, to: 'dessert', label: 'Dessert Served', icon: '🍰', color: 'pink' },
      { from: currentStatus, to: 'payment', label: 'Payment/Bill', icon: '💳', color: 'yellow' },
      { from: currentStatus, to: 'completed', label: 'Complete Service', icon: '✅', color: 'green' },
      { from: currentStatus, to: 'no_show', label: 'Mark as No Show', icon: '❌', color: 'red', requiresConfirmation: true },
      { from: currentStatus, to: 'cancelled_by_restaurant', label: 'Cancel Booking', icon: '🚫', color: 'red', requiresConfirmation: true }
    ]

    // Filter out the current status to avoid showing "change to same status"
    const availableStatuses = allStatuses.filter(status => status.to !== currentStatus)

    // Apply logical restrictions based on current status
    if (currentStatus === 'completed' || currentStatus === 'no_show' || 
        currentStatus === 'cancelled_by_user' || currentStatus === 'cancelled_by_restaurant') {
      // For final states, only allow reverting to previous states or re-opening
      return availableStatuses.filter(status => 
        ['pending', 'confirmed', 'arrived', 'seated'].includes(status.to)
      )
    }

    return availableStatuses
  }

  // Estimate remaining dining time
  estimateRemainingTime(status: DiningStatus, turnTimeMinutes: number): number {
    const progress = TableStatusService.getDiningProgress(status)
    const elapsed = (progress / 100) * turnTimeMinutes
    return Math.max(0, turnTimeMinutes - elapsed)
  }
}