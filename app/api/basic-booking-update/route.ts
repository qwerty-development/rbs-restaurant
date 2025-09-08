// app/api/basic-booking-update/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const { bookingId, status } = await request.json()
    
    // Validate that status is only confirmed or declined_by_restaurant
    if (!['confirmed', 'declined_by_restaurant'].includes(status)) {
      return NextResponse.json({ 
        error: 'Invalid status. Basic tier can only set status to confirmed or declined_by_restaurant' 
      }, { status: 400 })
    }

    const supabase = await createClient()
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Get user's restaurant and verify it's Basic tier
    const { data: staffData, error: staffError } = await supabase
      .from('restaurant_staff')
      .select(`
        restaurant_id,
        restaurant:restaurants(
          id,
          tier
        )
      `)
      .eq('user_id', user.id)
      .single()

    if (staffError || !staffData) {
      return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 })
    }

    // Handle both array and object formats from Supabase
    const restaurant = Array.isArray(staffData.restaurant) 
      ? staffData.restaurant[0] 
      : staffData.restaurant

    // Verify this is a Basic tier restaurant
    if (restaurant?.tier !== 'basic') {
      return NextResponse.json({ 
        error: 'This endpoint is only for Basic tier restaurants' 
      }, { status: 403 })
    }

    // Get the current booking to verify it belongs to this restaurant and is pending
    const { data: currentBooking, error: bookingError } = await supabase
      .from('bookings')
      .select('id, status, restaurant_id')
      .eq('id', bookingId)
      .single()

    if (bookingError || !currentBooking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    // Verify booking belongs to this restaurant
    if (currentBooking.restaurant_id !== staffData.restaurant_id) {
      return NextResponse.json({ error: 'Booking does not belong to your restaurant' }, { status: 403 })
    }

    // Verify booking is currently pending (Basic tier can only update pending bookings)
    if (currentBooking.status !== 'pending') {
      return NextResponse.json({ 
        error: `Cannot update booking. Current status is '${currentBooking.status}', but Basic tier can only update 'pending' bookings.` 
      }, { status: 400 })
    }

    // Update the booking status
    const { error: updateError } = await supabase
      .from('bookings')
      .update({ 
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', bookingId)

    if (updateError) {
      console.error('Error updating booking:', updateError)
      return NextResponse.json({ error: 'Failed to update booking' }, { status: 500 })
    }

    // Add to status history
    const { error: historyError } = await supabase
      .from('booking_status_history')
      .insert({
        booking_id: bookingId,
        old_status: 'pending',
        new_status: status,
        changed_by: user.id,
        reason: `${status === 'confirmed' ? 'Accepted' : 'Declined'} via Basic Dashboard`,
        metadata: {
          tier: 'basic',
          endpoint: 'basic-booking-update'
        }
      })

    if (historyError) {
      console.error('Error creating status history:', historyError)
      // Don't fail the request if history creation fails
    }

    return NextResponse.json({ 
      success: true, 
      message: `Booking ${status === 'confirmed' ? 'accepted' : 'declined'} successfully`,
      booking: {
        id: bookingId,
        status,
        updated_at: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('Error in basic booking update:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
