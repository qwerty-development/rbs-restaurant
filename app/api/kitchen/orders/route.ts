import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// GET /api/kitchen/orders - Get orders for kitchen display
export async function GET(request: NextRequest) {
  try {
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
                         staff.permissions?.includes('kitchen.view') ||
                         staff.permissions?.includes('orders.view')

    if (!hasPermission) {
      return NextResponse.json(
        { error: "Insufficient permissions to view kitchen orders" },
        { status: 403 }
      )
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status') || 'active' // active, all, specific status
    const stationId = searchParams.get('station_id')
    const courseType = searchParams.get('course_type')
    const priority = searchParams.get('priority')

    // Build base query for active kitchen orders
    let query = supabase
      .from('orders')
      .select(`
        *,
        booking:bookings!orders_booking_id_fkey(
          id,
          guest_name,
          party_size,
          booking_time,
          profiles!bookings_user_id_fkey(
            id,
            full_name
          )
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
            description,
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
        )
      `)
      .eq('restaurant_id', staff.restaurant_id)
      .order('priority_level', { ascending: false })
      .order('created_at', { ascending: true })

    // Apply status filter
    if (status === 'active') {
      query = query.in('status', ['confirmed', 'preparing', 'ready'])
    } else if (status !== 'all') {
      query = query.eq('status', status)
    }

    // Apply course type filter
    if (courseType) {
      query = query.eq('course_type', courseType)
    }

    // Apply priority filter
    if (priority) {
      query = query.eq('priority_level', parseInt(priority))
    }

    const { data: orders, error } = await query

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: "Failed to fetch kitchen orders" },
        { status: 500 }
      )
    }

    // Filter by station if specified
    let filteredOrders = orders
    if (stationId) {
      filteredOrders = orders.filter(order => 
        order.order_items.some((item: any) => 
          item.kitchen_assignments.some((assignment: any) => 
            assignment.station_id === stationId
          )
        )
      )
    }

    // Calculate timing information
    const ordersWithTiming = filteredOrders.map(order => {
      const now = new Date()
      const createdAt = new Date(order.created_at)
      const elapsedMinutes = Math.floor((now.getTime() - createdAt.getTime()) / 60000)
      
      // Calculate estimated completion time
      const maxPrepTime = Math.max(
        ...order.order_items.map((item: any) => item.estimated_prep_time || 0)
      )
      
      const estimatedCompletion = new Date(createdAt.getTime() + maxPrepTime * 60000)
      const isOverdue = now > estimatedCompletion && order.status !== 'ready'

      return {
        ...order,
        timing: {
          elapsed_minutes: elapsedMinutes,
          estimated_completion: estimatedCompletion,
          is_overdue: isOverdue,
          max_prep_time: maxPrepTime
        }
      }
    })

    return NextResponse.json({ 
      orders: ordersWithTiming,
      summary: {
        total: filteredOrders.length,
        confirmed: filteredOrders.filter(o => o.status === 'confirmed').length,
        preparing: filteredOrders.filter(o => o.status === 'preparing').length,
        ready: filteredOrders.filter(o => o.status === 'ready').length,
        overdue: ordersWithTiming.filter(o => o.timing.is_overdue).length
      }
    })

  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// POST /api/kitchen/orders - Bulk update order statuses
export async function POST(request: NextRequest) {
  try {
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

    const body = await request.json()
    const { updates } = body

    if (!updates || !Array.isArray(updates)) {
      return NextResponse.json(
        { error: "Invalid updates format. Expected array of updates." },
        { status: 400 }
      )
    }

    const results = []
    const errors = []

    // Process each update
    for (const update of updates) {
      const { order_id, order_item_id, status, station_id, notes } = update

      try {
        if (order_item_id) {
          // Update individual order item
          const updateData: any = {
            status,
            updated_at: new Date().toISOString()
          }

          // Add timing based on status
          switch (status) {
            case 'preparing':
              updateData.started_preparing_at = new Date().toISOString()
              break
            case 'ready':
              updateData.ready_at = new Date().toISOString()
              break
            case 'served':
              updateData.served_at = new Date().toISOString()
              break
          }

          const { error: itemError } = await supabase
            .from('order_items')
            .update(updateData)
            .eq('id', order_item_id)

          if (itemError) throw itemError

          // Log item status change
          await supabase
            .from('order_status_history')
            .insert({
              order_id,
              order_item_id,
              old_status: null, // We'd need to fetch this for accuracy
              new_status: status,
              changed_by: user.id,
              station_id,
              notes
            })

        } else if (order_id) {
          // Update entire order
          const updateData: any = {
            status,
            updated_at: new Date().toISOString()
          }

          // Add timing based on status
          switch (status) {
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

          const { error: orderError } = await supabase
            .from('orders')
            .update(updateData)
            .eq('id', order_id)
            .eq('restaurant_id', staff.restaurant_id)

          if (orderError) throw orderError

          // Log order status change
          await supabase
            .from('order_status_history')
            .insert({
              order_id,
              old_status: null, // We'd need to fetch this for accuracy
              new_status: status,
              changed_by: user.id,
              station_id,
              notes
            })
        }

        results.push({ 
          success: true, 
          order_id, 
          order_item_id, 
          status 
        })

      } catch (error) {
        console.error('Update error:', error)
        errors.push({ 
          order_id, 
          order_item_id, 
          error: 'Failed to update status' 
        })
      }
    }

    return NextResponse.json({
      message: "Bulk update completed",
      results,
      errors,
      summary: {
        total: updates.length,
        successful: results.length,
        failed: errors.length
      }
    })

  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
