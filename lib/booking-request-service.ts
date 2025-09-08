// lib/booking-request-service.ts
import { createClient } from "@/lib/supabase/client"
import { addHours, format } from "date-fns"
import { TableAvailabilityService } from "./table-availability"
import { RestaurantAvailability } from "./restaurant-availability"

interface AcceptanceValidation {
  valid: boolean
  reason?: string
  conflicts?: any[]
  suggestedAlternatives?: {
    tables?: string[]
    times?: Array<{ time: Date; availableTables: number }>
  }
}

interface AcceptRequestResult {
  success: boolean
  booking?: any
  error?: string
  alternatives?: AcceptanceValidation['suggestedAlternatives']
  requiresConfirmation?: boolean
}

export class BookingRequestService {
  private supabase
  private tableService: TableAvailabilityService
  private availabilityService: RestaurantAvailability
  
  constructor() {
    this.supabase = createClient()
    this.tableService = new TableAvailabilityService()
    this.availabilityService = new RestaurantAvailability()
  }

  async createBookingRequest(data: {
    restaurantId: string
    userId: string
    bookingTime: Date
    partySize: number
    specialRequests?: string
    occasion?: string
    guestName?: string
    guestEmail?: string
    guestPhone?: string
    turnTimeMinutes?: number
    preApproved?: boolean
    isWalkIn?: boolean
  }) {
    try {
      // Get restaurant settings with retry logic
      const { data: restaurant, error: restaurantError } = await this.supabase
        .from("restaurants")
        .select(`
          id,
          booking_policy,
          request_expiry_hours,
          auto_decline_enabled,
          booking_window_days,
          max_party_size,
          min_party_size,
          table_turnover_minutes,
          status
        `)
        .eq("id", data.restaurantId)
        .single()

      if (restaurantError || !restaurant) {
        throw new Error("Restaurant not found or unavailable")
      }

      // Validate restaurant is active
      if (restaurant.status !== 'active') {
        throw new Error("Restaurant is currently not accepting bookings")
      }

      // Validate party size (will be used in future validation)
      // const minSize = restaurant.min_party_size || 1
      // const maxSize = restaurant.max_party_size || 20
      


      // Validate booking window
      const bookingWindowDays = restaurant.booking_window_days || 30
      const maxBookingDate = addHours(new Date(), bookingWindowDays * 24)
      
      if (data.bookingTime > maxBookingDate) {
        throw new Error(`Bookings can only be made up to ${bookingWindowDays} days in advance`)
      }

      // Validate booking is in the future (except for walk-ins)
      if (!data.isWalkIn && data.bookingTime <= new Date()) {
        throw new Error("Booking time must be in the future")
      }

      // Validate restaurant availability (operating hours, special hours, closures)
      const availability = await this.availabilityService.isRestaurantOpen(
        data.restaurantId,
        data.bookingTime,
        format(data.bookingTime, 'HH:mm')
      )
      
      if (!availability.isOpen) {
        throw new Error(availability.reason || "Restaurant is not available at this time")
      }

      // Calculate expiry time for requests
      const isRequestBooking = restaurant.booking_policy === 'request' && !data.preApproved
      const requestExpiresAt = isRequestBooking && restaurant.auto_decline_enabled
        ? addHours(new Date(), restaurant.request_expiry_hours || 24)
        : null

      // Determine initial status
      const bookingStatus = isRequestBooking ? 'pending' : 'confirmed'
      
      // Generate unique confirmation code
      const confirmationCode = await this.generateUniqueConfirmationCode(data.restaurantId)

      // Create booking
      const { data: booking, error } = await this.supabase
        .from("bookings")
        .insert({
          restaurant_id: data.restaurantId,
          user_id: data.userId,
          booking_time: data.bookingTime.toISOString(),
          party_size: data.partySize,
          status: bookingStatus,
          special_requests: data.specialRequests,
          occasion: data.occasion,
          guest_name: data.guestName,
          guest_email: data.guestEmail,
          guest_phone: data.guestPhone,
          confirmation_code: confirmationCode,
          request_expires_at: requestExpiresAt?.toISOString(),
          turn_time_minutes: data.turnTimeMinutes || restaurant.table_turnover_minutes || 120,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          source:'manual'
        })
        .select()
        .single()

      if (error) {
        console.error("Booking creation error:", error)
        throw new Error("Failed to create booking")
      }

      // Log initial status
      await this.supabase
        .from("booking_status_history")
        .insert({
          booking_id: booking.id,
          new_status: bookingStatus,
          changed_by: data.userId,
          changed_at: new Date().toISOString(),
          metadata: { 
            source: 'customer_request',
            booking_policy: restaurant.booking_policy,
            expires_at: requestExpiresAt?.toISOString(),
            pre_approved: data.preApproved || false
          }
        })

      return {
        booking,
        isRequest: isRequestBooking,
        expiresAt: requestExpiresAt,
        confirmationCode
      }
    } catch (error) {
      console.error("Create booking request error:", error)
      throw error
    }
  }

  async acceptRequest(
    bookingId: string, 
    userId: string, 
    tableIds?: string[],
    options?: {
      forceAccept?: boolean
      suggestAlternatives?: boolean
      skipTableAssignment?: boolean
    }
  ): Promise<AcceptRequestResult> {
    try {
      // Fetch booking directly instead of using missing RPC
      const { data: booking, error: fetchError } = await this.supabase
        .from('bookings')
        .select('*')
        .eq('id', bookingId)
        .single()

      if (fetchError || !booking) {
        return { 
          success: false, 
          error: "Booking not found or being processed" 
        }
      }

      // Validate booking status
      if (booking.status !== 'pending') {
        return { 
          success: false, 
          error: `Booking is already ${booking.status}` 
        }
      }

      // Check expiry
      if (booking.request_expires_at && new Date(booking.request_expires_at) < new Date()) {
        // Auto-decline expired booking
        await this.updateBookingStatus(bookingId, 'auto_declined', userId, {
          reason: "Request expired before acceptance"
        })
        
        return { 
          success: false, 
          error: "This request has expired and cannot be accepted" 
        }
      }

      // Skip validation if force accepting
      if (!options?.forceAccept && !options?.skipTableAssignment) {
        // Validate table assignment if provided
        if (tableIds && tableIds.length > 0) {
          const validation = await this.validateAcceptance(booking, tableIds)
          
          if (!validation.valid) {
            // Record failed attempt
            await this.supabase
              .from("bookings")
              .update({
                acceptance_attempted_at: new Date().toISOString(),
                acceptance_failed_reason: validation.reason
              })
              .eq("id", bookingId)

            // Get alternatives if requested
            if (options?.suggestAlternatives) {
              const alternatives = await this.findAlternatives(booking)
              
              return {
                success: false,
                error: validation.reason || "Cannot accept with selected tables",
                alternatives,
                requiresConfirmation: true
              }
            }

            return {
              success: false,
              error: validation.reason || "Cannot accept booking with selected tables"
            }
          }
        } else if (!options?.skipTableAssignment) {
          // No tables selected - find available tables
          const availableTables = await this.tableService.getOptimalTableAssignment(
            booking.restaurant_id,
            new Date(booking.booking_time),
            booking.party_size,
            booking.turn_time_minutes || 120
          )

          if (!availableTables) {
            return {
              success: false,
              error: "No suitable tables available for this booking"
            }
          }

          tableIds = availableTables.tableIds
        }
      }

      // Proceed with acceptance
      const { data: updatedBooking, error: updateError } = await this.supabase
        .from("bookings")
        .update({
          status: "confirmed",
          updated_at: new Date().toISOString(),
          acceptance_attempted_at: new Date().toISOString(),
          acceptance_failed_reason: null
        })
        .eq("id", bookingId)
        .select()
        .single()

      if (updateError) {
        console.error("Update booking error:", updateError)
        throw new Error("Failed to update booking status")
      }

      if (!updatedBooking) {
        throw new Error("No booking found with this ID")
      }

      // Assign tables if provided
      if (tableIds && tableIds.length > 0 && !options?.skipTableAssignment) {
        // First, clear any existing table assignments for this booking
        const { error: deleteError } = await this.supabase
          .from("booking_tables")
          .delete()
          .eq("booking_id", bookingId)

        if (deleteError) {
          console.warn("Warning: Failed to clear existing table assignments:", deleteError)
        }

        // Then insert new table assignments
        const tableAssignments = tableIds.map(tableId => ({
          booking_id: bookingId,
          table_id: tableId
        }))

        const { error: tableError } = await this.supabase
          .from("booking_tables")
          .insert(tableAssignments)

        if (tableError) {
          console.error("Table assignment error:", tableError)
          
          // Rollback on table assignment failure
          await this.supabase
            .from("bookings")
            .update({ status: "pending" })
            .eq("id", bookingId)
            
          throw new Error(`Failed to assign tables: ${tableError.message || 'Unknown error'}`)
        }
      }

      // Log status change
      await this.supabase
        .from("booking_status_history")
        .insert({
          booking_id: bookingId,
          old_status: "pending",
          new_status: "confirmed",
          changed_by: userId,
          changed_at: new Date().toISOString(),
          metadata: { 
            action: "request_accepted",
            tables_assigned: tableIds || [],
            force_accepted: options?.forceAccept || false,
            skip_table_assignment: options?.skipTableAssignment || false
          }
        })

      return { 
        success: true, 
        booking: { ...updatedBooking, status: 'confirmed', tables: tableIds } 
      }

    } catch (error) {
      console.error("Accept request error:", error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to accept booking request"
      }
    }
  }

  async declineRequest(
    bookingId: string, 
    userId: string, 
    reason?: string,
    suggestAlternatives?: boolean
  ): Promise<{
    success: boolean
    error?: string
    alternatives?: AcceptanceValidation['suggestedAlternatives']
  }> {
    try {
      const { data: booking, error: fetchError } = await this.supabase
        .from("bookings")
        .select("*")
        .eq("id", bookingId)
        .eq("status", "pending")
        .single()

      if (fetchError || !booking) {
        return { 
          success: false, 
          error: "Booking not found or already processed" 
        }
      }

      // Find alternatives before declining if requested
      let alternatives: AcceptanceValidation['suggestedAlternatives'] | undefined
      if (suggestAlternatives) {
        alternatives = await this.findAlternatives(booking)
      }

      // Update booking status
      const { error } = await this.supabase
        .from("bookings")
        .update({
          status: "declined_by_restaurant",
          updated_at: new Date().toISOString(),
          suggested_alternative_time: alternatives?.times?.[0]?.time.toISOString(),
          suggested_alternative_tables: alternatives?.tables
        })
        .eq("id", bookingId)

      if (error) {
        throw new Error("Failed to decline request")
      }

      // Log status change
      await this.supabase
        .from("booking_status_history")
        .insert({
          booking_id: bookingId,
          old_status: "pending",
          new_status: "declined_by_restaurant",
          changed_by: userId,
          changed_at: new Date().toISOString(),
          reason: reason,
          metadata: { 
            action: "request_declined",
            alternatives_suggested: !!alternatives,
            alternative_times: alternatives?.times?.length || 0
          }
        })

      return { 
        success: true, 
        alternatives 
      }
    } catch (error) {
      console.error("Decline request error:", error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to decline request"
      }
    }
  }

  private async validateAcceptance(
    booking: any, 
    tableIds: string[]
  ): Promise<AcceptanceValidation> {
    try {
      // Direct validation instead of missing RPC function
      // 1. Check that booking is pending
      if (booking.status !== 'pending') {
        return {
          valid: false,
          reason: `Booking is already ${booking.status}`
        }
      }

      // 2. Check that all tables belong to the restaurant and are active
      const { data: tables, error: tablesError } = await this.supabase
        .from('restaurant_tables')
        .select('id, is_active, restaurant_id')
        .in('id', tableIds)

      if (tablesError || !tables || tables.length !== tableIds.length) {
        return {
          valid: false,
          reason: "One or more tables not found"
        }
      }

      // Check all tables belong to the same restaurant as the booking
      const invalidTables = tables.filter(table => 
        table.restaurant_id !== booking.restaurant_id || !table.is_active
      )

      if (invalidTables.length > 0) {
        return {
          valid: false,
          reason: "One or more tables are not available or don't belong to this restaurant"
        }
      }

      // 3. Check for time conflicts with other confirmed bookings
      const bookingStart = new Date(booking.booking_time)
      const bookingEnd = new Date(bookingStart.getTime() + (booking.turn_time_minutes || 120) * 60000)

      const { data: conflicts } = await this.supabase
        .from('bookings')
        .select(`
          id,
          booking_time,
          turn_time_minutes,
          booking_tables!inner(table_id)
        `)
        .in('booking_tables.table_id', tableIds)
        .in('status', ['confirmed', 'seated', 'ordering', 'appetizers', 'main_course', 'dessert'])
        .neq('id', booking.id)

      if (conflicts && conflicts.length > 0) {
        // Check each conflict for actual time overlap
        const hasConflict = conflicts.some(conflict => {
          const conflictStart = new Date(conflict.booking_time)
          const conflictEnd = new Date(conflictStart.getTime() + (conflict.turn_time_minutes || 120) * 60000)
          
          return (bookingStart < conflictEnd && bookingEnd > conflictStart)
        })

        if (hasConflict) {
          return {
            valid: false,
            reason: "Time conflict with existing bookings on selected tables"
          }
        }
      }

      // Additional client-side validation
      const availability = await this.tableService.checkTableAvailability(
        booking.restaurant_id,
        tableIds,
        new Date(booking.booking_time),
        booking.turn_time_minutes || 120,
        booking.id
      )

      if (!availability.available) {
        return {
          valid: false,
          reason: "Selected tables have scheduling conflicts",
          conflicts: availability.conflicts
        }
      }

      // Validate total capacity
      const { data: capacityTables } = await this.supabase
        .from("restaurant_tables")
        .select("id, capacity, table_number")
        .in("id", tableIds)

      if (!capacityTables || capacityTables.length !== tableIds.length) {
        return {
          valid: false,
          reason: "One or more selected tables not found"
        }
      }

      const totalCapacity = capacityTables.reduce((sum, t) => sum + t.capacity, 0)
      
      if (totalCapacity < booking.party_size) {
        return {
          valid: false,
          reason: `Insufficient capacity: ${totalCapacity} seats available but ${booking.party_size} guests in party`
        }
      }

      return { valid: true }
    } catch (error) {
      console.error("Validation error:", error)
      return {
        valid: false,
        reason: "Validation failed due to system error"
      }
    }
  }

  private async findAlternatives(booking: any): Promise<AcceptanceValidation['suggestedAlternatives']> {
    const alternatives: AcceptanceValidation['suggestedAlternatives'] = {
      tables: [],
      times: []
    }

    try {
      // Find alternative tables for the same time
      const optimalTables = await this.tableService.getOptimalTableAssignment(
        booking.restaurant_id,
        new Date(booking.booking_time),
        booking.party_size,
        booking.turn_time_minutes || 120
      )

      if (optimalTables) {
        alternatives.tables = optimalTables.tableIds
      }

      // Find alternative time slots using database function
      const { data: altSlots, error } = await this.supabase
        .rpc('find_alternative_slots', {
          p_restaurant_id: booking.restaurant_id,
          p_original_time: booking.booking_time,
          p_party_size: booking.party_size,
          p_duration_minutes: booking.turn_time_minutes || 120
        })

      if (!error && altSlots) {
        alternatives.times = altSlots.map((slot: any) => ({
          time: new Date(slot.suggested_time),
          availableTables: slot.available_tables
        }))
      }

    } catch (error) {
      console.error("Error finding alternatives:", error)
    }

    return alternatives
  }


  private async generateUniqueConfirmationCode(restaurantId: string): Promise<string> {
    let attempts = 0
    const maxAttempts = 10
    
    while (attempts < maxAttempts) {
      const code = `${restaurantId.slice(0, 4).toUpperCase()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`
      
      const { data: existing } = await this.supabase
        .from("bookings")
        .select("id")
        .eq("confirmation_code", code)
        .single()
      
      if (!existing) {
        return code
      }
      
      attempts++
    }
    
    // Fallback with timestamp
    return `${restaurantId.slice(0, 4).toUpperCase()}${Date.now().toString(36).toUpperCase()}`
  }

  private async updateBookingStatus(
    bookingId: string,
    status: string,
    userId: string,
    metadata?: any
  ): Promise<void> {
    await this.supabase
      .from("bookings")
      .update({
        status,
        updated_at: new Date().toISOString()
      })
      .eq("id", bookingId)

    await this.supabase
      .from("booking_status_history")
      .insert({
        booking_id: bookingId,
        new_status: status,
        changed_by: userId,
        changed_at: new Date().toISOString(),
        metadata
      })
  }

  async getTimeUntilExpiry(booking: any): Promise<{ 
    hours: number
    minutes: number
    expired: boolean
    percentage: number 
  }> {
    if (!booking.request_expires_at) {
      return { hours: 0, minutes: 0, expired: false, percentage: 100 }
    }

    const now = new Date()
    const expiresAt = new Date(booking.request_expires_at)
    const createdAt = new Date(booking.created_at)
    
    const totalMs = expiresAt.getTime() - createdAt.getTime()
    const remainingMs = expiresAt.getTime() - now.getTime()

    if (remainingMs <= 0) {
      return { hours: 0, minutes: 0, expired: true, percentage: 0 }
    }

    const hours = Math.floor(remainingMs / (1000 * 60 * 60))
    const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60))
    const percentage = Math.max(0, Math.min(100, Math.round((remainingMs / totalMs) * 100)))

    return { hours, minutes, expired: false, percentage }
  }

  async autoDeclineExpiredRequests(restaurantId: string, userId: string): Promise<{
    declinedCount: number
    declinedBookings: any[]
    errors: any[]
  }> {
    const result = {
      declinedCount: 0,
      declinedBookings: [] as any[],
      errors: [] as any[]
    }

    try {
      // Find expired pending requests for this restaurant
      const { data: expiredRequests, error: fetchError } = await this.supabase
        .from("bookings")
        .select(`
          *,
          user:profiles!bookings_user_id_fkey(*),
          restaurant:restaurants(*)
        `)
        .eq("restaurant_id", restaurantId)
        .eq("status", "pending")
        .not("request_expires_at", "is", null)
        .lt("request_expires_at", new Date().toISOString())

      if (fetchError) {
        console.error("Error fetching expired requests:", fetchError)
        result.errors.push({ type: "fetch", error: fetchError })
        return result
      }

      if (!expiredRequests || expiredRequests.length === 0) {
        return result // No expired requests found
      }

      // Process each expired request
      for (const booking of expiredRequests) {
        try {
          // Update booking status to auto_declined
          const { error: updateError } = await this.supabase
            .from("bookings")
            .update({
              status: "auto_declined",
              updated_at: new Date().toISOString(),
              decline_reason: "Request expired automatically"
            })
            .eq("id", booking.id)

          if (updateError) {
            console.error(`Failed to auto-decline booking ${booking.id}:`, updateError)
            result.errors.push({ bookingId: booking.id, error: updateError })
            continue
          }

          // Log status change in history
          await this.supabase
            .from("booking_status_history")
            .insert({
              booking_id: booking.id,
              old_status: "pending",
              new_status: "auto_declined",
              changed_by: userId || "system",
              changed_at: new Date().toISOString(),
              reason: "Request expired automatically",
              metadata: { 
                action: "auto_decline_expired",
                expired_at: booking.request_expires_at,
                auto_processed: true
              }
            })

          result.declinedCount++
          result.declinedBookings.push(booking)
          
          console.log(`Auto-declined expired booking request: ${booking.id}`)
        } catch (error) {
          console.error(`Error processing expired booking ${booking.id}:`, error)
          result.errors.push({ bookingId: booking.id, error })
        }
      }

      return result
    } catch (error) {
      console.error("Error in autoDeclineExpiredRequests:", error)
      result.errors.push({ type: "general", error })
      return result
    }
  }

  async findExpiredRequests(restaurantId: string): Promise<any[]> {
    try {
      const { data: expiredRequests, error } = await this.supabase
        .from("bookings")
        .select(`
          id,
          guest_name,
          booking_time,
          party_size,
          request_expires_at,
          created_at,
          user:profiles!bookings_user_id_fkey(full_name)
        `)
        .eq("restaurant_id", restaurantId)
        .eq("status", "pending")
        .not("request_expires_at", "is", null)
        .lt("request_expires_at", new Date().toISOString())
        .order("request_expires_at", { ascending: true })

      if (error) {
        console.error("Error finding expired requests:", error)
        return []
      }

      return expiredRequests || []
    } catch (error) {
      console.error("Error in findExpiredRequests:", error)
      return []
    }
  }
}