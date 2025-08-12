import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getBookingOrderIntegrationService } from "@/lib/services/booking-order-integration"

// GET /api/bookings/[id]/orders - Get booking with order status
export async function GET(
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
                         staff.permissions?.includes('bookings.view') ||
                         staff.permissions?.includes('orders.view')

    if (!hasPermission) {
      return NextResponse.json(
        { error: "Insufficient permissions to view booking orders" },
        { status: 403 }
      )
    }

    // Verify booking belongs to restaurant
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id, restaurant_id')
      .eq('id', resolvedParams.id)
      .eq('restaurant_id', staff.restaurant_id)
      .single()

    if (bookingError || !booking) {
      return NextResponse.json(
        { error: "Booking not found or access denied" },
        { status: 404 }
      )
    }

    // Get booking order status using integration service
    const integrationService = getBookingOrderIntegrationService()
    const bookingOrderStatus = await integrationService.getBookingOrderStatus(resolvedParams.id)
    
    if (!bookingOrderStatus) {
      return NextResponse.json(
        { error: "Failed to get booking order status" },
        { status: 500 }
      )
    }

    // Get orders grouped by course
    const ordersByCourse = await integrationService.getBookingOrdersByCourse(resolvedParams.id)
    
    // Get booking timeline
    const timeline = await integrationService.getBookingTimeline(resolvedParams.id)

    return NextResponse.json({
      booking_order_status: bookingOrderStatus,
      orders_by_course: ordersByCourse,
      timeline: timeline
    })

  } catch (error) {
    console.error('Booking orders API error:', error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// POST /api/bookings/[id]/orders - Check if can add order to booking
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
                         staff.permissions?.includes('orders.create')

    if (!hasPermission) {
      return NextResponse.json(
        { error: "Insufficient permissions to create orders" },
        { status: 403 }
      )
    }

    // Verify booking belongs to restaurant
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id, restaurant_id')
      .eq('id', resolvedParams.id)
      .eq('restaurant_id', staff.restaurant_id)
      .single()

    if (bookingError || !booking) {
      return NextResponse.json(
        { error: "Booking not found or access denied" },
        { status: 404 }
      )
    }

    // Check if can add order to booking
    const integrationService = getBookingOrderIntegrationService()
    const canAddResult = await integrationService.canAddOrderToBooking(resolvedParams.id)

    return NextResponse.json(canAddResult)

  } catch (error) {
    console.error('Can add order check error:', error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
