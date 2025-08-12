import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// GET /api/orders/[id] - Get single order with full details
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
                         staff.permissions?.includes('orders.view')

    if (!hasPermission) {
      return NextResponse.json(
        { error: "Insufficient permissions to view orders" },
        { status: 403 }
      )
    }

    // Get order with full details
    const { data: order, error } = await supabase
      .from('orders')
      .select(`
        *,
        booking:bookings!orders_booking_id_fkey(
          id,
          guest_name,
          guest_email,
          guest_phone,
          party_size,
          booking_time,
          status,
          special_requests,
          dietary_notes,
          profiles!bookings_user_id_fkey(
            id,
            full_name,
            phone_number,
            dietary_restrictions,
            allergies
          )
        ),
        table:restaurant_tables!orders_table_id_fkey(
          id,
          table_number,
          table_type,
          capacity
        ),
        order_items(
          *,
          menu_item:menu_items!order_items_menu_item_id_fkey(
            id,
            name,
            description,
            price,
            dietary_tags,
            allergens,
            preparation_time,
            category:menu_categories!menu_items_category_id_fkey(
              id,
              name
            )
          ),
          order_modifications(*),
          kitchen_assignments(
            *,
            station:kitchen_stations!kitchen_assignments_station_id_fkey(
              id,
              name,
              station_type
            ),
            assigned_to_profile:profiles!kitchen_assignments_assigned_to_fkey(
              id,
              full_name
            )
          )
        ),
        order_status_history(
          *,
          changed_by_profile:profiles!order_status_history_changed_by_fkey(
            id,
            full_name
          ),
          station:kitchen_stations!order_status_history_station_id_fkey(
            id,
            name,
            station_type
          )
        ),
        created_by_profile:profiles!orders_created_by_fkey(
          id,
          full_name
        )
      `)
      .eq('id', resolvedParams.id)
      .eq('restaurant_id', staff.restaurant_id)
      .single()

    if (error || !order) {
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({ order })

  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// PATCH /api/orders/[id] - Update order
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
                         staff.permissions?.includes('orders.update')

    if (!hasPermission) {
      return NextResponse.json(
        { error: "Insufficient permissions to update orders" },
        { status: 403 }
      )
    }

    // Get current order
    const { data: currentOrder, error: fetchError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', resolvedParams.id)
      .eq('restaurant_id', staff.restaurant_id)
      .single()

    if (fetchError || !currentOrder) {
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404 }
      )
    }

    const body = await request.json()
    const { 
      status,
      special_instructions,
      dietary_requirements,
      priority_level,
      notes
    } = body

    // Prepare update data
    const updateData: any = {
      updated_at: new Date().toISOString()
    }

    if (special_instructions !== undefined) {
      updateData.special_instructions = special_instructions
    }

    if (dietary_requirements !== undefined) {
      updateData.dietary_requirements = dietary_requirements
    }

    if (priority_level !== undefined) {
      updateData.priority_level = priority_level
    }

    // Handle status changes with timestamps
    if (status && status !== currentOrder.status) {
      updateData.status = status

      switch (status) {
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
          // Calculate actual prep time
          if (currentOrder.started_preparing_at) {
            const prepTime = Math.round(
              (new Date().getTime() - new Date(currentOrder.started_preparing_at).getTime()) / 60000
            )
            updateData.actual_prep_time = prepTime
          }
          break
      }

      // Log status change
      await supabase
        .from('order_status_history')
        .insert({
          order_id: resolvedParams.id,
          old_status: currentOrder.status,
          new_status: status,
          changed_by: user.id,
          notes: notes || `Status changed to ${status}`
        })
    }

    // Update order
    const { data: updatedOrder, error: updateError } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', resolvedParams.id)
      .select(`
        *,
        booking:bookings!orders_booking_id_fkey(
          id,
          guest_name,
          party_size
        ),
        table:restaurant_tables!orders_table_id_fkey(
          id,
          table_number,
          table_type
        ),
        order_items(
          *,
          menu_item:menu_items!order_items_menu_item_id_fkey(
            id,
            name,
            description
          )
        )
      `)
      .single()

    if (updateError) {
      console.error('Update error:', updateError)
      return NextResponse.json(
        { error: "Failed to update order" },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      order: updatedOrder,
      message: "Order updated successfully" 
    })

  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// DELETE /api/orders/[id] - Cancel order
export async function DELETE(
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
                         staff.permissions?.includes('orders.delete')

    if (!hasPermission) {
      return NextResponse.json(
        { error: "Insufficient permissions to cancel orders" },
        { status: 403 }
      )
    }

    // Get current order
    const { data: currentOrder, error: fetchError } = await supabase
      .from('orders')
      .select('status')
      .eq('id', resolvedParams.id)
      .eq('restaurant_id', staff.restaurant_id)
      .single()

    if (fetchError || !currentOrder) {
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404 }
      )
    }

    // Check if order can be cancelled
    if (['served', 'completed'].includes(currentOrder.status)) {
      return NextResponse.json(
        { error: "Cannot cancel order that has been served or completed" },
        { status: 400 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const { reason } = body

    // Update order status to cancelled
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('id', resolvedParams.id)

    if (updateError) {
      console.error('Cancel error:', updateError)
      return NextResponse.json(
        { error: "Failed to cancel order" },
        { status: 500 }
      )
    }

    // Cancel all order items
    await supabase
      .from('order_items')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('order_id', resolvedParams.id)

    // Log cancellation
    await supabase
      .from('order_status_history')
      .insert({
        order_id: resolvedParams.id,
        old_status: currentOrder.status,
        new_status: 'cancelled',
        changed_by: user.id,
        notes: reason || 'Order cancelled'
      })

    return NextResponse.json({ 
      message: "Order cancelled successfully" 
    })

  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
