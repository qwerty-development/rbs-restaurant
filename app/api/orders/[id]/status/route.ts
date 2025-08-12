import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// PATCH /api/orders/[id]/status - Update order status with workflow validation
export async function PATCH(
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
                         staff.permissions?.includes('orders.update_status') ||
                         staff.permissions?.includes('kitchen.manage')

    if (!hasPermission) {
      return NextResponse.json(
        { error: "Insufficient permissions to update order status" },
        { status: 403 }
      )
    }

    // Verify order belongs to restaurant
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, status, restaurant_id')
      .eq('id', resolvedParams.id)
      .eq('restaurant_id', staff.restaurant_id)
      .single()

    if (orderError || !order) {
      return NextResponse.json(
        { error: "Order not found or access denied" },
        { status: 404 }
      )
    }

    const body = await request.json()
    const { status: newStatus, notes, station_id } = body

    if (!newStatus) {
      return NextResponse.json(
        { error: "Missing required field: status" },
        { status: 400 }
      )
    }

    // Validate status transition
    const validStatuses = ['pending', 'confirmed', 'preparing', 'ready', 'served', 'completed', 'cancelled']
    if (!validStatuses.includes(newStatus)) {
      return NextResponse.json(
        { error: "Invalid status" },
        { status: 400 }
      )
    }

    // Update order status
    const updateData: any = {
      status: newStatus,
      updated_at: new Date().toISOString()
    }

    // Set timestamp fields based on status
    switch (newStatus) {
      case 'confirmed':
        updateData.confirmed_at = new Date().toISOString()
        break
      case 'preparing':
        updateData.started_preparing_at = new Date().toISOString()
        break
      case 'ready':
        updateData.ready_at = new Date().toISOString()
        break
      case 'served':
        updateData.served_at = new Date().toISOString()
        break
      case 'completed':
        updateData.completed_at = new Date().toISOString()
        break
    }

    const { data: updatedOrder, error: updateError } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', resolvedParams.id)
      .select()
      .single()

    if (updateError) {
      console.error('Order update error:', updateError)
      return NextResponse.json(
        { error: "Failed to update order status" },
        { status: 500 }
      )
    }

    // Log status change in history
    const { error: historyError } = await supabase
      .from('order_status_history')
      .insert({
        order_id: resolvedParams.id,
        old_status: order.status,
        new_status: newStatus,
        changed_by: user.id,
        changed_at: new Date().toISOString(),
        notes: notes || null,
        station_id: station_id || null
      })

    if (historyError) {
      console.error('Status history error:', historyError)
      // Don't fail the request for history logging errors
    }

    return NextResponse.json({
      message: "Order status updated successfully",
      order: updatedOrder
    })

  } catch (error) {
    console.error('Order status update error:', error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// GET /api/orders/[id]/status - Get order workflow summary
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
                         staff.permissions?.includes('orders.view') ||
                         staff.permissions?.includes('kitchen.view')

    if (!hasPermission) {
      return NextResponse.json(
        { error: "Insufficient permissions to view order status" },
        { status: 403 }
      )
    }

    // Verify order belongs to restaurant
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, restaurant_id')
      .eq('id', resolvedParams.id)
      .eq('restaurant_id', staff.restaurant_id)
      .single()

    if (orderError || !order) {
      return NextResponse.json(
        { error: "Order not found or access denied" },
        { status: 404 }
      )
    }

    // Get order with detailed information
    const { data: orderDetails, error: detailsError } = await supabase
      .from('orders')
      .select(`
        *,
        booking:bookings!orders_booking_id_fkey(
          id,
          guest_name,
          party_size
        ),
        order_items(
          *,
          menu_item:menu_items!order_items_menu_item_id_fkey(
            name,
            description,
            price,
            preparation_time
          )
        ),
        order_status_history(
          *,
          changed_by_profile:profiles!order_status_history_changed_by_fkey(
            full_name
          )
        )
      `)
      .eq('id', resolvedParams.id)
      .single()

    if (detailsError || !orderDetails) {
      return NextResponse.json(
        { error: "Failed to get order details" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      order: orderDetails
    })

  } catch (error) {
    console.error('Order workflow summary error:', error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
