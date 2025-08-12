import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// GET /api/orders - List orders with filters
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
                         staff.permissions?.includes('orders.view')

    if (!hasPermission) {
      return NextResponse.json(
        { error: "Insufficient permissions to view orders" },
        { status: 403 }
      )
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const date = searchParams.get('date')
    const status = searchParams.get('status')
    const tableId = searchParams.get('table_id')
    const bookingId = searchParams.get('booking_id')
    const courseType = searchParams.get('course_type')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Build query
    let query = supabase
      .from('orders')
      .select(`
        *,
        booking:bookings!orders_booking_id_fkey(
          id,
          guest_name,
          party_size,
          booking_time,
          status,
          profiles!bookings_user_id_fkey(
            id,
            full_name,
            phone_number
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
            price,
            dietary_tags,
            allergens,
            preparation_time
          ),
          order_modifications(*)
        ),
        created_by_profile:profiles!orders_created_by_fkey(
          id,
          full_name
        )
      `)
      .eq('restaurant_id', staff.restaurant_id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Apply filters
    if (date) {
      const startDate = new Date(date)
      const endDate = new Date(date)
      endDate.setDate(endDate.getDate() + 1)
      
      query = query
        .gte('created_at', startDate.toISOString())
        .lt('created_at', endDate.toISOString())
    }

    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    if (tableId) {
      query = query.eq('table_id', tableId)
    }

    if (bookingId) {
      query = query.eq('booking_id', bookingId)
    }

    if (courseType) {
      query = query.eq('course_type', courseType)
    }

    const { data: orders, error } = await query

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: "Failed to fetch orders" },
        { status: 500 }
      )
    }

    return NextResponse.json({ orders })

  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// POST /api/orders - Create new order
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
                         staff.permissions?.includes('orders.create')

    if (!hasPermission) {
      return NextResponse.json(
        { error: "Insufficient permissions to create orders" },
        { status: 403 }
      )
    }

    const body = await request.json()
    
    // Validate required fields
    const { 
      booking_id, 
      table_id,
      order_type = 'dine_in',
      course_type,
      special_instructions,
      dietary_requirements = [],
      priority_level = 1,
      items = []
    } = body

    if (!booking_id || !items.length) {
      return NextResponse.json(
        { error: "Missing required fields: booking_id and items" },
        { status: 400 }
      )
    }

    // Verify booking belongs to restaurant
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id, restaurant_id, status')
      .eq('id', booking_id)
      .eq('restaurant_id', staff.restaurant_id)
      .single()

    if (bookingError || !booking) {
      return NextResponse.json(
        { error: "Booking not found or access denied" },
        { status: 404 }
      )
    }

    // Generate order number
    const { data: orderNumber, error: orderNumberError } = await supabase
      .rpc('generate_order_number', { restaurant_id: staff.restaurant_id })

    if (orderNumberError) {
      console.error('Order number generation error:', orderNumberError)
      return NextResponse.json(
        { error: "Failed to generate order number" },
        { status: 500 }
      )
    }

    // Calculate totals from items
    let subtotal = 0
    const validatedItems = []

    for (const item of items) {
      // Verify menu item exists and get current price
      const { data: menuItem, error: menuError } = await supabase
        .from('menu_items')
        .select('id, name, price, preparation_time, dietary_tags, allergens')
        .eq('id', item.menu_item_id)
        .eq('restaurant_id', staff.restaurant_id)
        .eq('is_available', true)
        .single()

      if (menuError || !menuItem) {
        return NextResponse.json(
          { error: `Menu item ${item.menu_item_id} not found or unavailable` },
          { status: 400 }
        )
      }

      const itemTotal = menuItem.price * item.quantity
      subtotal += itemTotal

      validatedItems.push({
        menu_item_id: item.menu_item_id,
        quantity: item.quantity,
        unit_price: menuItem.price,
        total_price: itemTotal,
        special_instructions: item.special_instructions || null,
        dietary_modifications: item.dietary_modifications || [],
        estimated_prep_time: menuItem.preparation_time
      })
    }

    // Calculate tax (assuming 10% - this should be configurable)
    const taxRate = 0.10
    const taxAmount = subtotal * taxRate
    const totalAmount = subtotal + taxAmount

    // Create order
    const orderData = {
      booking_id,
      restaurant_id: staff.restaurant_id,
      table_id: table_id || null,
      order_number: orderNumber,
      order_type,
      course_type: course_type || null,
      subtotal,
      tax_amount: taxAmount,
      total_amount: totalAmount,
      special_instructions: special_instructions || null,
      dietary_requirements,
      priority_level,
      created_by: user.id,
      status: 'pending'
    }

    const { data: order, error: insertError } = await supabase
      .from('orders')
      .insert(orderData)
      .select(`
        *,
        booking:bookings!orders_booking_id_fkey(
          id,
          guest_name,
          party_size,
          booking_time
        ),
        table:restaurant_tables!orders_table_id_fkey(
          id,
          table_number,
          table_type
        )
      `)
      .single()

    if (insertError) {
      console.error('Order insert error:', insertError)
      return NextResponse.json(
        { error: "Failed to create order" },
        { status: 500 }
      )
    }

    // Create order items
    const orderItemsData = validatedItems.map(item => ({
      ...item,
      order_id: order.id
    }))

    const { data: orderItems, error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItemsData)
      .select(`
        *,
        menu_item:menu_items!order_items_menu_item_id_fkey(
          id,
          name,
          description,
          dietary_tags,
          allergens
        )
      `)

    if (itemsError) {
      console.error('Order items insert error:', itemsError)
      // Rollback order creation
      await supabase.from('orders').delete().eq('id', order.id)
      return NextResponse.json(
        { error: "Failed to create order items" },
        { status: 500 }
      )
    }

    // Log order creation
    await supabase
      .from('order_status_history')
      .insert({
        order_id: order.id,
        old_status: null,
        new_status: 'pending',
        changed_by: user.id,
        notes: 'Order created'
      })

    // Update booking status to 'ordered' if not already
    if (booking.status === 'seated') {
      await supabase
        .from('bookings')
        .update({ status: 'ordered', updated_at: new Date().toISOString() })
        .eq('id', booking_id)
    }

    return NextResponse.json({ 
      order: { ...order, order_items: orderItems },
      message: "Order created successfully" 
    }, { status: 201 })

  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
