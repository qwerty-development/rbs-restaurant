import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// GET /api/kitchen/stations - List kitchen stations
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
                         staff.permissions?.includes('kitchen.view')

    if (!hasPermission) {
      return NextResponse.json(
        { error: "Insufficient permissions to view kitchen stations" },
        { status: 403 }
      )
    }

    // Get kitchen stations with current assignments
    const { data: stations, error } = await supabase
      .from('kitchen_stations')
      .select(`
        *,
        kitchen_assignments(
          *,
          order_item:order_items!kitchen_assignments_order_item_id_fkey(
            *,
            order:orders!order_items_order_id_fkey(
              id,
              order_number,
              status,
              table:restaurant_tables!orders_table_id_fkey(
                table_number
              )
            ),
            menu_item:menu_items!order_items_menu_item_id_fkey(
              name,
              preparation_time
            )
          ),
          assigned_to_profile:profiles!kitchen_assignments_assigned_to_fkey(
            full_name
          )
        ),
        menu_item_stations(
          menu_item:menu_items!menu_item_stations_menu_item_id_fkey(
            id,
            name,
            preparation_time
          )
        )
      `)
      .eq('restaurant_id', staff.restaurant_id)
      .eq('is_active', true)
      .order('display_order')

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: "Failed to fetch kitchen stations" },
        { status: 500 }
      )
    }

    // Calculate station workload and status
    const stationsWithStatus = stations.map(station => {
      const activeAssignments = station.kitchen_assignments.filter((assignment: any) => 
        !assignment.completed_at && 
        assignment.order_item.order.status !== 'completed' &&
        assignment.order_item.order.status !== 'cancelled'
      )

      const totalItems = activeAssignments.length
      const preparingItems = activeAssignments.filter((assignment: any) => 
        assignment.started_at && !assignment.completed_at
      ).length

      const averagePrepTime = station.menu_item_stations.length > 0 
        ? station.menu_item_stations.reduce((sum: number, mis: any) => 
            sum + (mis.menu_item.preparation_time || 0), 0
          ) / station.menu_item_stations.length
        : 0

      return {
        ...station,
        workload: {
          total_items: totalItems,
          preparing_items: preparingItems,
          pending_items: totalItems - preparingItems,
          average_prep_time: Math.round(averagePrepTime)
        },
        status: totalItems === 0 ? 'idle' : 
                preparingItems > 0 ? 'busy' : 'pending'
      }
    })

    return NextResponse.json({ stations: stationsWithStatus })

  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// POST /api/kitchen/stations - Create kitchen station
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
                         staff.permissions?.includes('kitchen.manage')

    if (!hasPermission) {
      return NextResponse.json(
        { error: "Insufficient permissions to create kitchen stations" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { name, description, station_type, display_order } = body

    // Validate required fields
    if (!name || !station_type) {
      return NextResponse.json(
        { error: "Missing required fields: name, station_type" },
        { status: 400 }
      )
    }

    // Validate station_type
    const validTypes = ['cold', 'hot', 'grill', 'fryer', 'pastry', 'beverage', 'expo']
    if (!validTypes.includes(station_type)) {
      return NextResponse.json(
        { error: "Invalid station_type. Must be one of: " + validTypes.join(', ') },
        { status: 400 }
      )
    }

    // Create station
    const stationData = {
      restaurant_id: staff.restaurant_id,
      name,
      description: description || null,
      station_type,
      display_order: display_order || 0
    }

    const { data: station, error: insertError } = await supabase
      .from('kitchen_stations')
      .insert(stationData)
      .select()
      .single()

    if (insertError) {
      console.error('Insert error:', insertError)
      return NextResponse.json(
        { error: "Failed to create kitchen station" },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      station,
      message: "Kitchen station created successfully" 
    }, { status: 201 })

  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
