import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

// POST /api/bookings/[id]/check-in - Check in booking
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const supabase = await createClient()
    
    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Get staff data to verify restaurant access
    const { data: staff, error: staffError } = await supabase
      .from('restaurant_staff')
      .select('restaurant_id, role, permissions')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    if (staffError || !staff) {
      return NextResponse.json(
        { error: "Access denied. Staff member not found." },
        { status: 403 }
      )
    }

    // Check permissions
    const hasPermission = staff.role === 'owner' || 
                         staff.role === 'manager' ||
                         staff.permissions?.includes('bookings.checkin')

    if (!hasPermission) {
      return NextResponse.json(
        { error: "Insufficient permissions to check in bookings" },
        { status: 403 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const { notes, actual_party_size } = body

    // Get current booking
    const { data: booking, error: fetchError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', resolvedParams.id)
      .eq('restaurant_id', staff.restaurant_id)
      .single()

    if (fetchError || !booking) {
      return NextResponse.json(
        { error: "Booking not found" },
        { status: 404 }
      )
    }

    // Check if booking can be checked in
    const validStatuses = ['confirmed', 'arrived']
    if (!validStatuses.includes(booking.status)) {
      return NextResponse.json(
        { error: "Only confirmed or arrived bookings can be checked in" },
        { status: 400 }
      )
    }

    // Check if booking is not too early (allow check-in up to 30 minutes early)
    const bookingTime = new Date(booking.booking_time)
    const now = new Date()
    const thirtyMinutesEarly = new Date(bookingTime.getTime() - 30 * 60 * 1000)
    
    if (now < thirtyMinutesEarly) {
      return NextResponse.json(
        { error: "Check-in is too early. Guests can check in up to 30 minutes before their booking time." },
        { status: 400 }
      )
    }

    // Update booking status and check-in time
    const updateData: any = {
      status: 'arrived',
      checked_in_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    // Update party size if provided
    if (actual_party_size && actual_party_size !== booking.party_size) {
      updateData.party_size = actual_party_size
    }

    const { data: updatedBooking, error: updateError } = await supabase
      .from('bookings')
      .update(updateData)
      .eq('id', resolvedParams.id)
      .select(`
        *,
        profiles!bookings_user_id_fkey(
          id,
          full_name,
          phone_number,
          avatar_url
        ),
        restaurant:restaurants!bookings_restaurant_id_fkey(
          id,
          name,
          address
        ),
        booking_tables(
          table:restaurant_tables(*)
        )
      `)
      .single()

    if (updateError) {
      console.error('Update error:', updateError)
      return NextResponse.json(
        { error: "Failed to check in booking" },
        { status: 500 }
      )
    }

    // Log status change
    await supabase
      .from('booking_status_history')
      .insert({
        booking_id: resolvedParams.id,
        old_status: booking.status,
        new_status: 'arrived',
        changed_by: user.id,
        reason: notes || 'Guest checked in by staff',
        metadata: actual_party_size ? { actual_party_size } : {}
      })

    // Update customer visit statistics if this is a registered user
    if (booking.user_id) {
      // Get or create customer record
      const { data: customer, error: customerError } = await supabase
        .from('restaurant_customers')
        .select('*')
        .eq('restaurant_id', staff.restaurant_id)
        .eq('user_id', booking.user_id)
        .single()

      if (!customerError && customer) {
        // Update last visit and total bookings
        await supabase
          .from('restaurant_customers')
          .update({
            last_visit: new Date().toISOString(),
            total_bookings: customer.total_bookings + 1,
            updated_at: new Date().toISOString()
          })
          .eq('id', customer.id)
      } else {
        // Create new customer record
        await supabase
          .from('restaurant_customers')
          .insert({
            restaurant_id: staff.restaurant_id,
            user_id: booking.user_id,
            first_visit: new Date().toISOString(),
            last_visit: new Date().toISOString(),
            total_bookings: 1
          })
      }
    }

    return NextResponse.json({ 
      booking: updatedBooking,
      message: "Booking checked in successfully" 
    })

  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}