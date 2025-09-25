import { useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { TableAvailabilityService } from "@/lib/table-availability"
import { BookingRequestService } from "@/lib/booking-request-service"
import { toast } from "react-hot-toast"
import { useMemo } from "react"
import type { Booking } from "@/types"

interface UseBookingsActionsProps {
  restaurantId: string
  userId: string
}

export function useBookingsActions({ restaurantId, userId }: UseBookingsActionsProps) {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const tableService = useMemo(() => new TableAvailabilityService(), [])
  const requestService = useMemo(() => new BookingRequestService(), [])

  // Update single booking status
  const updateBookingMutation = useMutation({
    mutationFn: async ({ bookingId, updates }: { bookingId: string; updates: Partial<Booking> }) => {
      // Handle cancellation/decline with offer cleanup
      if (updates.status === 'cancelled_by_restaurant' || updates.status === 'declined_by_restaurant') {
        const { data: booking } = await supabase
          .from('bookings')
          .select('applied_offer_id')
          .eq('id', bookingId)
          .single()

        const { error } = await supabase
          .from("bookings")
          .update({
            ...updates,
            updated_at: new Date().toISOString()
          })
          .eq("id", bookingId)

        if (error) throw error

        // Clean up user offers if applicable
        if (booking?.applied_offer_id) {
          await supabase
            .from('user_offers')
            .delete()
            .eq('booking_id', bookingId)
            .eq('offer_id', booking.applied_offer_id)

          await supabase
            .from('bookings')
            .update({ applied_offer_id: null })
            .eq('id', bookingId)
        }
      } else {
        const { error } = await supabase
          .from("bookings")
          .update({
            ...updates,
            updated_at: new Date().toISOString()
          })
          .eq("id", bookingId)

        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-bookings"] })
      queryClient.invalidateQueries({ queryKey: ["displayed-bookings"] })
      toast.success("Booking updated successfully")
    },
    onError: (error) => {
      console.error("Update error:", error)
      toast.error("Failed to update booking")
    },
  })

  // Bulk update bookings
  const bulkUpdateMutation = useMutation({
    mutationFn: async ({ bookingIds, updates }: { bookingIds: string[]; updates: Partial<Booking> }) => {
      if (updates.status === 'cancelled_by_restaurant' || updates.status === 'declined_by_restaurant') {
        // Handle each booking individually for offer cleanup
        const promises = bookingIds.map(async (id) => {
          const { data: booking } = await supabase
            .from('bookings')
            .select('applied_offer_id')
            .eq('id', id)
            .single()

          const updateResult = await supabase
            .from("bookings")
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq("id", id)

          if (booking?.applied_offer_id) {
            await supabase
              .from('user_offers')
              .delete()
              .eq('booking_id', id)
              .eq('offer_id', booking.applied_offer_id)

            await supabase
              .from('bookings')
              .update({ applied_offer_id: null })
              .eq('id', id)
          }

          return updateResult
        })

        const results = await Promise.all(promises)
        const errors = results.filter(r => r.error)

        if (errors.length > 0) {
          throw new Error(`Failed to update ${errors.length} booking(s)`)
        }
      } else {
        const promises = bookingIds.map(id =>
          supabase
            .from("bookings")
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq("id", id)
        )

        const results = await Promise.all(promises)
        const errors = results.filter(r => r.error)

        if (errors.length > 0) {
          throw new Error(`Failed to update ${errors.length} booking(s)`)
        }
      }
    },
    onSuccess: (_, { bookingIds }) => {
      queryClient.invalidateQueries({ queryKey: ["all-bookings"] })
      queryClient.invalidateQueries({ queryKey: ["displayed-bookings"] })
      toast.success(`Updated ${bookingIds.length} booking(s) successfully`)
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update bookings")
    },
  })

  // Quick confirm booking
  const quickConfirmMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      const { error } = await supabase
        .from("bookings")
        .update({
          status: "confirmed",
          updated_at: new Date().toISOString()
        })
        .eq("id", bookingId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-bookings"] })
      queryClient.invalidateQueries({ queryKey: ["displayed-bookings"] })
      toast.success("Booking confirmed")
    },
    onError: () => {
      toast.error("Failed to confirm booking")
    },
  })

  // Assign tables to booking
  const assignTablesMutation = useMutation({
    mutationFn: async ({ bookingId, tableIds }: { bookingId: string; tableIds: string[] }) => {
      // Remove existing assignments
      await supabase
        .from("booking_tables")
        .delete()
        .eq("booking_id", bookingId)

      // Add new assignments if any
      if (tableIds.length > 0) {
        const assignments = tableIds.map(tableId => ({
          booking_id: bookingId,
          table_id: tableId
        }))

        const { error } = await supabase
          .from("booking_tables")
          .insert(assignments)

        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-bookings"] })
      queryClient.invalidateQueries({ queryKey: ["displayed-bookings"] })
      queryClient.invalidateQueries({ queryKey: ["table-stats"] })
      toast.success("Table assignment updated successfully")
    },
    onError: (error) => {
      console.error("Table assignment error:", error)
      toast.error("Failed to update table assignment")
    }
  })

  // Switch table for booking
  const switchTableMutation = useMutation({
    mutationFn: async ({ bookingId, fromTableId, toTableId }: {
      bookingId: string;
      fromTableId: string;
      toTableId: string
    }) => {
      // Update the table assignment
      const { error } = await supabase
        .from("booking_tables")
        .update({ table_id: toTableId })
        .eq("booking_id", bookingId)
        .eq("table_id", fromTableId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-bookings"] })
      queryClient.invalidateQueries({ queryKey: ["displayed-bookings"] })
      queryClient.invalidateQueries({ queryKey: ["table-stats"] })
      toast.success("Table switched successfully")
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to switch table")
    }
  })

  // Remove table assignment
  const removeTableAssignmentMutation = useMutation({
    mutationFn: async ({ bookingId, tableId }: { bookingId: string; tableId?: string }) => {
      let query = supabase
        .from("booking_tables")
        .delete()
        .eq("booking_id", bookingId)

      if (tableId) {
        query = query.eq("table_id", tableId)
      }

      const { error } = await query
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-bookings"] })
      queryClient.invalidateQueries({ queryKey: ["displayed-bookings"] })
      queryClient.invalidateQueries({ queryKey: ["table-stats"] })
      toast.success("Table assignment removed")
    },
    onError: () => {
      toast.error("Failed to remove table assignment")
    }
  })

  // Create manual booking
  const createManualBookingMutation = useMutation({
    mutationFn: async (bookingData: any) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Must be logged in to create bookings")

      // Validate table availability if tables selected
      if (bookingData.table_ids && bookingData.table_ids.length > 0) {
        const availability = await tableService.checkTableAvailability(
          restaurantId,
          bookingData.table_ids,
          new Date(bookingData.booking_time),
          bookingData.turn_time_minutes || 120
        )

        if (!availability.available) {
          throw new Error("Selected tables are no longer available")
        }
      }

      // Generate confirmation code
      const confirmationCode = `${restaurantId.slice(0, 4).toUpperCase()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`

      // Create booking
      const { data: booking, error } = await supabase
        .from("bookings")
        .insert({
          restaurant_id: restaurantId,
          user_id: bookingData.user_id || user.id,
          guest_name: bookingData.guest_name,
          guest_email: bookingData.guest_email,
          guest_phone: bookingData.guest_phone,
          booking_time: bookingData.booking_time,
          party_size: bookingData.party_size,
          turn_time_minutes: bookingData.turn_time_minutes || 120,
          status: bookingData.status || "confirmed",
          special_requests: bookingData.special_requests,
          occasion: bookingData.occasion,
          confirmation_code: confirmationCode,
          source: 'manual'
        })
        .select()
        .single()

      if (error) throw error

      // Assign tables if provided
      if (bookingData.table_ids && bookingData.table_ids.length > 0) {
        const tableAssignments = bookingData.table_ids.map((tableId: string) => ({
          booking_id: booking.id,
          table_id: tableId,
        }))

        const { error: tableError } = await supabase
          .from("booking_tables")
          .insert(tableAssignments)

        if (tableError) {
          // Rollback booking if table assignment fails
          await supabase.from("bookings").delete().eq("id", booking.id)
          throw tableError
        }
      }

      return booking
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-bookings"] })
      queryClient.invalidateQueries({ queryKey: ["displayed-bookings"] })
      toast.success("Booking created successfully")
    },
    onError: (error: any) => {
      console.error("Create booking error:", error)
      toast.error(error.message || "Failed to create booking")
    },
  })

  // Auto-decline expired requests
  const handleExpiredRequests = async () => {
    if (!restaurantId || !userId) return

    try {
      const result = await requestService.autoDeclineExpiredRequests(restaurantId, userId)

      if (result.declinedCount > 0) {
        toast.success(`${result.declinedCount} expired requests automatically declined`, {
          duration: 3000,
          icon: '⏰'
        })
        queryClient.invalidateQueries({ queryKey: ["all-bookings"] })
        queryClient.invalidateQueries({ queryKey: ["displayed-bookings"] })
      }

      if (result.errors.length > 0) {
        console.warn("Some expired requests couldn't be auto-declined:", result.errors)
      }
    } catch (error) {
      console.error("Failed to auto-decline expired requests:", error)
    }
  }

  // Manual refresh
  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["all-bookings"] })
    queryClient.invalidateQueries({ queryKey: ["displayed-bookings"] })
    queryClient.invalidateQueries({ queryKey: ["table-stats"] })
    queryClient.invalidateQueries({ queryKey: ["tables"] })
    toast.success("Data refreshed")
  }

  return {
    // Mutations
    updateBookingMutation,
    bulkUpdateMutation,
    quickConfirmMutation,
    assignTablesMutation,
    switchTableMutation,
    removeTableAssignmentMutation,
    createManualBookingMutation,

    // Actions
    handleExpiredRequests,
    handleRefresh,

    // Loading states
    isUpdating: updateBookingMutation.isPending || bulkUpdateMutation.isPending,
    isCreating: createManualBookingMutation.isPending,
    isAssigningTables: assignTablesMutation.isPending,
  }
}