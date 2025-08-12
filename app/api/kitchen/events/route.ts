import { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"

// GET /api/kitchen/events - Server-Sent Events for real-time kitchen updates
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response("Unauthorized", { status: 401 })
    }

    // Get staff data to verify restaurant access
    const { data: staff, error: staffError } = await supabase
      .from('restaurant_staff')
      .select('restaurant_id, role, permissions')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    if (staffError || !staff) {
      return new Response("Access denied", { status: 403 })
    }

    // Check permissions
    const hasPermission = staff.role === 'owner' || 
                         staff.role === 'manager' ||
                         staff.permissions?.includes('kitchen.view') ||
                         staff.permissions?.includes('orders.view')

    if (!hasPermission) {
      return new Response("Insufficient permissions", { status: 403 })
    }

    // Create SSE response
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      start(controller) {
        // Send initial connection message
        const data = `data: ${JSON.stringify({
          type: 'connected',
          timestamp: new Date().toISOString(),
          restaurant_id: staff.restaurant_id
        })}\n\n`
        controller.enqueue(encoder.encode(data))

        // Set up periodic updates (every 30 seconds)
        const interval = setInterval(async () => {
          try {
            // Fetch current kitchen status
            const { data: orders, error } = await supabase
              .from('orders')
              .select(`
                id,
                order_number,
                status,
                priority_level,
                created_at,
                updated_at,
                table:restaurant_tables!orders_table_id_fkey(
                  table_number
                ),
                order_items(
                  id,
                  status,
                  menu_item:menu_items!order_items_menu_item_id_fkey(
                    name
                  )
                )
              `)
              .eq('restaurant_id', staff.restaurant_id)
              .in('status', ['confirmed', 'preparing', 'ready'])
              .order('created_at')

            if (!error && orders) {
              const updateData = `data: ${JSON.stringify({
                type: 'kitchen_update',
                timestamp: new Date().toISOString(),
                orders: orders,
                summary: {
                  total: orders.length,
                  confirmed: orders.filter(o => o.status === 'confirmed').length,
                  preparing: orders.filter(o => o.status === 'preparing').length,
                  ready: orders.filter(o => o.status === 'ready').length
                }
              })}\n\n`
              controller.enqueue(encoder.encode(updateData))
            }
          } catch (error) {
            console.error('SSE update error:', error)
          }
        }, 30000) // 30 seconds

        // Clean up on close
        request.signal.addEventListener('abort', () => {
          clearInterval(interval)
          controller.close()
        })
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      }
    })

  } catch (error) {
    console.error('SSE error:', error)
    return new Response("Internal server error", { status: 500 })
  }
}
