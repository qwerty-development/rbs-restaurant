// lib/table-availability.ts
import { createClient } from "@/lib/supabase/client"
import { addMinutes, format, parse } from "date-fns"

export interface TableAvailability {
  tableId: string
  tableNumber: string
  capacity: number
  minCapacity: number
  maxCapacity: number
  isAvailable: boolean
  conflictingBookings?: {
    id: string
    time: string
    partySize: number
  }[]
}

export interface TableCombination {
  tables: string[]
  totalCapacity: number
  totalMinCapacity: number
  isValid: boolean
}

export class TableAvailabilityService {
  private supabase = createClient()

  /**
   * Check if tables are available for a specific time slot
   */
  async checkTableAvailability(
    restaurantId: string,
    tableIds: string[],
    bookingTime: Date,
    turnTimeMinutes: number = 120,
    excludeBookingId?: string
  ): Promise<{
    available: boolean
    conflicts: any[]
    tables: TableAvailability[]
  }> {
    const endTime = addMinutes(bookingTime, turnTimeMinutes)

    // Get table details
    const { data: tables, error: tablesError } = await this.supabase
      .from("restaurant_tables")
      .select("*")
      .in("id", tableIds)
      .eq("restaurant_id", restaurantId)
      .eq("is_active", true)

    if (tablesError || !tables) {
      throw new Error("Failed to fetch table details")
    }

    // Check for booking conflicts using the existing RPC function
    const { data: conflictingBookingId, error: conflictError } = await this.supabase
      .rpc("check_booking_overlap", {
        p_table_ids: tableIds,
        p_start_time: bookingTime.toISOString(),
        p_end_time: endTime.toISOString(),
        p_exclude_booking_id: excludeBookingId || null
      })

    if (conflictError) {
      console.error("Error checking conflicts:", conflictError)
      throw conflictError
    }

    // Get detailed conflict information if there are conflicts
    let conflicts: any[] = []
    const hasConflict = conflictingBookingId !== null

    if (hasConflict) {
      // Get all conflicting bookings (not just the first one)
      const { data: conflictingBookings } = await this.supabase
        .from("bookings")
        .select(`
          *,
          profiles!bookings_user_id_fkey(full_name),
          booking_tables!inner(table_id)
        `)
        .in("booking_tables.table_id", tableIds)
        .in("status", ["confirmed", "pending"])
        .neq("id", excludeBookingId || "00000000-0000-0000-0000-000000000000")

      if (conflictingBookings) {
        // Filter to only actual overlapping bookings
        conflicts = conflictingBookings
          .filter(booking => {
            const bookingStart = new Date(booking.booking_time)
            const bookingEnd = addMinutes(bookingStart, booking.turn_time_minutes || 120)
            
            // Check for time overlap
            return (bookingTime < bookingEnd && endTime > bookingStart)
          })
          .map(booking => ({
            id: booking.id,
            booking_time: booking.booking_time,
            turn_time_minutes: booking.turn_time_minutes,
            party_size: booking.party_size,
            status: booking.status,
            guestName: booking.profiles?.full_name || booking.guest_name || "Guest",
            tableIds: booking.booking_tables?.map((bt: any) => bt.table_id) || []
          }))
      }
    }

    // Build availability info for each table
    const tableAvailability: TableAvailability[] = tables.map(table => {
      const tableConflicts = conflicts.filter(conflict => 
        conflict.tableIds.includes(table.id)
      )

      return {
        tableId: table.id,
        tableNumber: table.table_number,
        capacity: table.capacity,
        minCapacity: table.min_capacity || 1,
        maxCapacity: table.max_capacity || table.capacity,
        isAvailable: !tableConflicts.length,
        conflictingBookings: tableConflicts.map(conflict => ({
          id: conflict.id,
          time: format(new Date(conflict.booking_time), "h:mm a"),
          partySize: conflict.party_size
        }))
      }
    })

    return {
      available: !hasConflict,
      conflicts,
      tables: tableAvailability
    }
  }

  /**
   * Get available tables for a time slot
   */
  async getAvailableTablesForSlot(
    restaurantId: string,
    bookingTime: Date,
    partySize: number,
    turnTimeMinutes: number = 120
  ): Promise<{
    singleTables: any[]
    combinations: TableCombination[]
  }> {
    const endTime = addMinutes(bookingTime, turnTimeMinutes)

    // Get all active tables for the restaurant
    const { data: allTables, error: tablesError } = await this.supabase
      .from("restaurant_tables")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .eq("is_active", true)
      .order("priority_score", { ascending: false })
      .order("capacity", { ascending: true })

    if (tablesError || !allTables) {
      throw new Error("Failed to fetch tables")
    }

    // Check each table for availability
    const availableTables: any[] = []
    const availableForCombination: any[] = []

    for (const table of allTables) {
      const { data: conflictId } = await this.supabase
        .rpc("check_booking_overlap", {
          p_table_ids: [table.id],
          p_start_time: bookingTime.toISOString(),
          p_end_time: endTime.toISOString()
        })

      if (conflictId === null) {
        // Table is available
        if (table.capacity >= partySize && (table.min_capacity || 1) <= partySize) {
          availableTables.push(table)
        }
        if (table.is_combinable) {
          availableForCombination.push(table)
        }
      }
    }

    // Generate valid combinations
    const combinations = this.generateTableCombinations(
      availableForCombination,
      partySize,
      2, // Max 2 tables for now
    )

    return {
      singleTables: availableTables,
      combinations
    }
  }

  /**
   * Generate valid table combinations
   */
  private generateTableCombinations(
    tables: any[],
    requiredCapacity: number,
    maxTables: number = 2
  ): TableCombination[] {
    const combinations: TableCombination[] = []

    // Generate combinations of 2 tables
    for (let i = 0; i < tables.length; i++) {
      for (let j = i + 1; j < tables.length; j++) {
        const table1 = tables[i]
        const table2 = tables[j]

        // Check if tables can be combined
        const canCombine = 
          table1.is_combinable && 
          table2.is_combinable &&
          (
            table1.combinable_with.length === 0 ||
            table1.combinable_with.includes(table2.id)
          ) &&
          (
            table2.combinable_with.length === 0 ||
            table2.combinable_with.includes(table1.id)
          )

        if (canCombine) {
          const totalCapacity = table1.capacity + table2.capacity
          const totalMinCapacity = (table1.min_capacity || 1) + (table2.min_capacity || 1)

          if (totalCapacity >= requiredCapacity && totalMinCapacity <= requiredCapacity) {
            combinations.push({
              tables: [table1.id, table2.id],
              totalCapacity,
              totalMinCapacity,
              isValid: true
            })
          }
        }
      }
    }

    // Sort combinations by total capacity (prefer smaller combinations)
    combinations.sort((a, b) => a.totalCapacity - b.totalCapacity)

    return combinations
  }

  /**
   * Validate if a party size fits within table capacity constraints
   */
  validateCapacity(
    tables: any[],
    partySize: number
  ): {
    valid: boolean
    totalCapacity: number
    totalMinCapacity: number
    message?: string
  } {
    const totalCapacity = tables.reduce((sum, t) => sum + t.capacity, 0)
    const totalMinCapacity = tables.reduce((sum, t) => sum + (t.min_capacity || 1), 0)

    if (partySize > totalCapacity) {
      return {
        valid: false,
        totalCapacity,
        totalMinCapacity,
        message: `Selected tables can only accommodate up to ${totalCapacity} guests`
      }
    }

    if (partySize < totalMinCapacity) {
      return {
        valid: false,
        totalCapacity,
        totalMinCapacity,
        message: `Selected tables require a minimum of ${totalMinCapacity} guests`
      }
    }

    return {
      valid: true,
      totalCapacity,
      totalMinCapacity
    }
  }

  /**
   * Get optimal table assignment for a party
   */
  async getOptimalTableAssignment(
    restaurantId: string,
    bookingTime: Date,
    partySize: number,
    turnTimeMinutes: number = 120
  ): Promise<{
    tableIds: string[]
    requiresCombination: boolean
    totalCapacity: number
  } | null> {
    const { singleTables, combinations } = await this.getAvailableTablesForSlot(
      restaurantId,
      bookingTime,
      partySize,
      turnTimeMinutes
    )

    // First, try to find a single table
    const optimalSingleTable = singleTables
      .filter(t => t.capacity >= partySize && (t.min_capacity || 1) <= partySize)
      .sort((a, b) => {
        // Prefer tables closer to party size
        const aDiff = Math.abs(a.capacity - partySize)
        const bDiff = Math.abs(b.capacity - partySize)
        if (aDiff !== bDiff) return aDiff - bDiff
        // Then by priority score
        return (b.priority_score || 0) - (a.priority_score || 0)
      })[0]

    if (optimalSingleTable) {
      return {
        tableIds: [optimalSingleTable.id],
        requiresCombination: false,
        totalCapacity: optimalSingleTable.capacity
      }
    }

    // If no single table, try combinations
    const optimalCombination = combinations[0] // Already sorted by capacity

    if (optimalCombination) {
      return {
        tableIds: optimalCombination.tables,
        requiresCombination: true,
        totalCapacity: optimalCombination.totalCapacity
      }
    }

    return null
  }

  /**
   * Quick check if specific tables are available (using the RPC function)
   */
  async quickAvailabilityCheck(
    tableIds: string[],
    bookingTime: Date,
    turnTimeMinutes: number = 120,
    excludeBookingId?: string
  ): Promise<boolean> {
    const endTime = addMinutes(bookingTime, turnTimeMinutes)
    
    const { data: conflictingBookingId, error } = await this.supabase
      .rpc("check_booking_overlap", {
        p_table_ids: tableIds,
        p_start_time: bookingTime.toISOString(),
        p_end_time: endTime.toISOString(),
        p_exclude_booking_id: excludeBookingId || null
      })

    if (error) {
      console.error("Error checking availability:", error)
      return false
    }

    // If conflictingBookingId is null, tables are available
    return conflictingBookingId === null
  }
}