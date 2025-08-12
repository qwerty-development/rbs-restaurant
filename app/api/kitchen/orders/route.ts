import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getOptimizedKitchenService } from "@/lib/services/optimized-kitchen-service"

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
    const status = searchParams.get('status') || 'active'
    const stationId = searchParams.get('station_id')
    const courseType = searchParams.get('course_type')
    const priority = searchParams.get('priority')
    const useCache = searchParams.get('no_cache') !== 'true' // Allow cache bypass for debugging

    // Use optimized kitchen service
    const kitchenService = getOptimizedKitchenService()

    try {
      const result = await kitchenService.getKitchenOrders(staff.restaurant_id, {
        status,
        courseType: courseType || undefined,
        priority: priority || undefined,
        stationId: stationId || undefined,
        useCache
      })

      return NextResponse.json(result)
    } catch (error) {
      console.error('Kitchen service error:', error)
      return NextResponse.json(
        { error: "Failed to fetch kitchen orders" },
        { status: 500 }
      )
    }



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
