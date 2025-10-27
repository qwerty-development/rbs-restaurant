// components/basic/manual-booking-dialog.tsx
"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { BasicManualBookingForm } from "@/components/basic/basic-manual-booking-form"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "react-hot-toast"
import { format } from "date-fns"

interface ManualBookingDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  restaurantId: string
  currentBookings?: any[]
}

export function ManualBookingDialog({
  open,
  onOpenChange,
  restaurantId,
  currentBookings = [],
}: ManualBookingDialogProps) {
  const supabase = createClient()
  const queryClient = useQueryClient()

  // Generate unique confirmation code
  const generateConfirmationCode = async () => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let code = ''
    for (let i = 0; i < 6; i++) {
      code += characters.charAt(Math.floor(Math.random() * characters.length))
    }

    // Check if code already exists
    const { data: existing } = await supabase
      .from('bookings')
      .select('id')
      .eq('confirmation_code', code)
      .eq('restaurant_id', restaurantId)
      .single()

    // If exists, recursively generate new one
    if (existing) {
      return generateConfirmationCode()
    }

    return code
  }

  // Create booking mutation
  const createBookingMutation = useMutation({
    mutationFn: async (data: any) => {
      console.log('🔄 Creating basic manual booking:', data)

      // Generate confirmation code
      const confirmationCode = await generateConfirmationCode()

      // Prepare booking data for basic tier (no tables, no customer tracking)
      const bookingData = {
        restaurant_id: restaurantId,
        user_id: null, // Basic tier doesn't link to user accounts
        booking_time: data.booking_time,
        party_size: data.party_size,
        status: data.status || 'confirmed',
        special_requests: data.special_requests || null,
        occasion: data.occasion || null,
        assigned_table: data.assigned_table || null,
        preferred_section: data.preferred_section || null,
        dietary_notes: data.dietary_notes ? [data.dietary_notes] : null, // Convert string to array
        guest_name: data.guest_name,
        guest_email: data.guest_email || null,
        guest_phone: data.guest_phone || null,
        confirmation_code: confirmationCode,
        turn_time_minutes: data.turn_time_minutes || 120,
        is_event_booking: data.is_event_booking || false,
        event_occurrence_id: data.event_occurrence_id || null,
        source: 'manual',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      console.log('📝 Basic booking data:', bookingData)

      // Create booking
      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .insert(bookingData)
        .select(`
          id,
          booking_time,
          party_size,
          status,
          special_requests,
          preferred_section,
          occasion,
          assigned_table,
          dietary_notes,
          guest_name,
          guest_email,
          guest_phone,
          created_at,
          confirmation_code,
          turn_time_minutes,
          is_event_booking,
          event_occurrence_id
        `)
        .single()

      if (bookingError) {
        console.error('❌ Error creating booking:', bookingError)
        throw new Error(bookingError.message || 'Failed to create booking')
      }

      console.log('✅ Basic booking created:', booking)

      // Update event occurrence booking count if this is an event booking
      if (booking.is_event_booking && booking.event_occurrence_id) {
        const { error: eventError } = await supabase.rpc('increment_event_bookings', {
          occurrence_id: booking.event_occurrence_id,
          increment_by: booking.party_size
        })

        if (eventError) {
          console.warn('⚠️ Could not update event booking count:', eventError)
        }
      }

      // Log booking status history
      try {
        await supabase
          .from('booking_status_history')
          .insert({
            booking_id: booking.id,
            new_status: booking.status,
            changed_at: new Date().toISOString(),
            reason: 'Manual booking created by staff (Basic tier)',
            metadata: {
              source: 'manual',
              created_via: 'basic_dashboard',
              tier: 'basic',
            },
          })
      } catch (err) {
        console.warn('⚠️ Could not log status history:', err)
      }

      return booking
    },
    onSuccess: (booking) => {
      console.log('✅ Booking created successfully:', booking)

      // Show success message
      toast.success(
        `Booking created successfully! Confirmation code: ${booking.confirmation_code}`,
        { duration: 5000 }
      )

      // Invalidate queries to refetch bookings
      queryClient.invalidateQueries({ queryKey: ['basic-bookings'] })
      queryClient.invalidateQueries({ queryKey: ['basic-analytics'] })

      // Close dialog
      onOpenChange(false)
    },
    onError: (error: any) => {
      console.error('❌ Error creating booking:', error)
      toast.error(`Failed to create booking: ${error.message}`)
    },
  })

  const handleSubmit = async (data: any) => {
    await createBookingMutation.mutateAsync(data)
  }

  const handleCancel = () => {
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="text-2xl font-bold">Create Manual Booking</DialogTitle>
          <DialogDescription>
            Create a new booking manually. All fields marked with * are required.
          </DialogDescription>
        </DialogHeader>
        <div className="px-6">
          <BasicManualBookingForm
            restaurantId={restaurantId}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            isLoading={createBookingMutation.isPending}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
