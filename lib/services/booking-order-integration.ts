// lib/services/booking-order-integration.ts
"use client"

import { createClient } from "@/lib/supabase/client"

export interface BookingOrderStatus {
  booking_id: string
  current_status: string
  order_count: number
  orders_by_status: {
    pending: number
    confirmed: number
    preparing: number
    ready: number
    served: number
    completed: number
    cancelled: number
  }
  next_suggested_status?: string
  can_advance: boolean
}

export class BookingOrderIntegrationService {
  private supabase = createClient()

  // Booking status progression with order integration
  private readonly BOOKING_STATUS_FLOW = {
    pending: 'confirmed',
    confirmed: 'arrived',
    arrived: 'seated',
    seated: 'ordered',      // First order created
    ordered: 'appetizers',  // Appetizer course started
    appetizers: 'main_course', // Main course started
    main_course: 'dessert', // Dessert course started
    dessert: 'payment',     // All orders completed
    payment: 'completed'    // Payment processed
  }

  // Get comprehensive booking status with order information
  async getBookingOrderStatus(bookingId: string): Promise<BookingOrderStatus | null> {
    try {
      // Get booking details
      const { data: booking, error: bookingError } = await this.supabase
        .from('bookings')
        .select('id, status, booking_time, party_size')
        .eq('id', bookingId)
        .single()

      if (bookingError || !booking) {
        return null
      }

      // Get all orders for this booking
      const { data: orders, error: ordersError } = await this.supabase
        .from('orders')
        .select('id, status, course_type, created_at, updated_at')
        .eq('booking_id', bookingId)

      if (ordersError) {
        console.error('Error fetching orders:', ordersError)
        return null
      }

      // Count orders by status
      const ordersByStatus = {
        pending: 0,
        confirmed: 0,
        preparing: 0,
        ready: 0,
        served: 0,
        completed: 0,
        cancelled: 0
      }

      orders?.forEach(order => {
        if (order.status in ordersByStatus) {
          ordersByStatus[order.status as keyof typeof ordersByStatus]++
        }
      })

      // Determine next suggested status
      const nextStatus = this.determineNextBookingStatus(booking.status, ordersByStatus)
      const canAdvance = this.canAdvanceBookingStatus(booking.status, ordersByStatus)

      return {
        booking_id: bookingId,
        current_status: booking.status,
        order_count: orders?.length || 0,
        orders_by_status: ordersByStatus,
        next_suggested_status: nextStatus,
        can_advance: canAdvance
      }

    } catch (error) {
      console.error('Error getting booking order status:', error)
      return null
    }
  }

  // Determine the next appropriate booking status based on order states
  private determineNextBookingStatus(
    currentStatus: string, 
    ordersByStatus: any
  ): string | undefined {
    const totalOrders = (Object.values(ordersByStatus) as number[]).reduce((sum: number, count: number) => sum + count, 0) - (ordersByStatus as any).cancelled

    switch (currentStatus) {
      case 'seated':
        // Can advance to 'ordered' if there are any confirmed/preparing/ready/served orders
        if (ordersByStatus.confirmed > 0 || ordersByStatus.preparing > 0 || 
            ordersByStatus.ready > 0 || ordersByStatus.served > 0) {
          return 'ordered'
        }
        break

      case 'ordered':
        // Check if we can advance to specific course phases
        if (ordersByStatus.preparing > 0 || ordersByStatus.ready > 0 || ordersByStatus.served > 0) {
          // Determine which course is being prepared/served
          // This would require checking course_type in orders
          return 'appetizers' // Simplified for now
        }
        break

      case 'appetizers':
        // Can advance to main_course if appetizers are mostly served
        if (ordersByStatus.served > 0 && ordersByStatus.preparing === 0) {
          return 'main_course'
        }
        break

      case 'main_course':
        // Can advance to dessert if main courses are served
        if (ordersByStatus.served > 0 && ordersByStatus.preparing === 0) {
          return 'dessert'
        }
        break

      case 'dessert':
        // Can advance to payment if all orders are completed
        if (totalOrders > 0 && ordersByStatus.completed === totalOrders) {
          return 'payment'
        }
        break

      case 'payment':
        // Can advance to completed after payment processing
        return 'completed'

      default:
        // For other statuses, follow normal flow
        return this.BOOKING_STATUS_FLOW[currentStatus as keyof typeof this.BOOKING_STATUS_FLOW]
    }

    return undefined
  }

  // Check if booking status can be advanced
  private canAdvanceBookingStatus(
    currentStatus: string, 
    ordersByStatus: any
  ): boolean {
    const nextStatus = this.determineNextBookingStatus(currentStatus, ordersByStatus)
    return nextStatus !== undefined
  }

  // Auto-advance booking status based on order changes
  async autoAdvanceBookingStatus(bookingId: string): Promise<boolean> {
    try {
      const statusInfo = await this.getBookingOrderStatus(bookingId)
      
      if (!statusInfo || !statusInfo.can_advance || !statusInfo.next_suggested_status) {
        return false
      }

      // Update booking status
      const { error } = await this.supabase
        .from('bookings')
        .update({
          status: statusInfo.next_suggested_status,
          updated_at: new Date().toISOString()
        })
        .eq('id', bookingId)

      if (error) {
        console.error('Error auto-advancing booking status:', error)
        return false
      }

      console.log(`Booking ${bookingId} status advanced from ${statusInfo.current_status} to ${statusInfo.next_suggested_status}`)
      return true

    } catch (error) {
      console.error('Error in auto-advance booking status:', error)
      return false
    }
  }

  // Get orders grouped by course for a booking
  async getBookingOrdersByCourse(bookingId: string): Promise<any> {
    try {
      const { data: orders, error } = await this.supabase
        .from('orders')
        .select(`
          *,
          order_items(
            *,
            menu_item:menu_items!order_items_menu_item_id_fkey(
              id,
              name,
              description,
              preparation_time
            )
          )
        `)
        .eq('booking_id', bookingId)
        .order('created_at')

      if (error) {
        console.error('Error fetching booking orders:', error)
        return null
      }

      // Group orders by course type
      const ordersByCourse:any = {
        appetizer: [],
        main_course: [],
        dessert: [],
        beverage: [],
        all_courses: []
      }

      orders?.forEach((order:any) => {
        const courseType:any = order.course_type || 'all_courses'
        if (courseType in ordersByCourse) {
          ordersByCourse[courseType as keyof typeof ordersByCourse].push(order)
        }
      })

      return ordersByCourse

    } catch (error) {
      console.error('Error getting orders by course:', error)
      return null
    }
  }

  // Check if booking can have new orders added
  async canAddOrderToBooking(bookingId: string): Promise<{ canAdd: boolean; reason?: string }> {
    try {
      const { data: booking, error } = await this.supabase
        .from('bookings')
        .select('status')
        .eq('id', bookingId)
        .single()

      if (error || !booking) {
        return { canAdd: false, reason: 'Booking not found' }
      }

      // Check if booking is in a state where orders can be added
      const allowedStatuses = ['seated', 'ordered', 'appetizers', 'main_course', 'dessert']
      
      if (!allowedStatuses.includes(booking.status)) {
        return { 
          canAdd: false, 
          reason: `Cannot add orders to booking with status: ${booking.status}` 
        }
      }

      return { canAdd: true }

    } catch (error) {
      console.error('Error checking if can add order:', error)
      return { canAdd: false, reason: 'Error checking booking status' }
    }
  }

  // Get booking timeline with order events
  async getBookingTimeline(bookingId: string): Promise<any[]> {
    try {
      const timeline = []

      // Get booking events
      const { data: booking, error: bookingError } = await this.supabase
        .from('bookings')
        .select('*')
        .eq('id', bookingId)
        .single()

      if (bookingError || !booking) {
        return []
      }

      // Add booking milestones
      if (booking.created_at) {
        timeline.push({
          type: 'booking',
          event: 'Booking Created',
          timestamp: booking.created_at,
          status: 'pending'
        })
      }

      if (booking.confirmed_at) {
        timeline.push({
          type: 'booking',
          event: 'Booking Confirmed',
          timestamp: booking.confirmed_at,
          status: 'confirmed'
        })
      }

      if (booking.arrived_at) {
        timeline.push({
          type: 'booking',
          event: 'Guest Arrived',
          timestamp: booking.arrived_at,
          status: 'arrived'
        })
      }

      if (booking.seated_at) {
        timeline.push({
          type: 'booking',
          event: 'Guest Seated',
          timestamp: booking.seated_at,
          status: 'seated'
        })
      }

      // Get order events
      const { data: orders, error: ordersError } = await this.supabase
        .from('orders')
        .select(`
          *,
          order_status_history(
            *,
            changed_by_profile:profiles!order_status_history_changed_by_fkey(
              full_name
            )
          )
        `)
        .eq('booking_id', bookingId)

      if (!ordersError && orders) {
        orders.forEach(order => {
          // Add order creation
          timeline.push({
            type: 'order',
            event: `Order ${order.order_number} Created`,
            timestamp: order.created_at,
            status: 'created',
            order_id: order.id,
            course_type: order.course_type
          })

          // Add order status changes
          order.order_status_history?.forEach((history: any) => {
            timeline.push({
              type: 'order_status',
              event: `Order ${order.order_number} ${history.new_status}`,
              timestamp: history.changed_at,
              status: history.new_status,
              order_id: order.id,
              changed_by: history.changed_by_profile?.full_name,
              notes: history.notes
            })
          })
        })
      }

      // Sort timeline by timestamp
      timeline.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

      return timeline

    } catch (error) {
      console.error('Error getting booking timeline:', error)
      return []
    }
  }

  // Update table status based on booking and order states
  async updateTableStatus(tableId: string): Promise<void> {
    try {
      // Get current bookings for this table
      const { data: bookings, error } = await this.supabase
        .from('bookings')
        .select('id, status')
        .eq('table_id', tableId)
        .in('status', ['seated', 'ordered', 'appetizers', 'main_course', 'dessert', 'payment'])

      if (error) {
        console.error('Error fetching table bookings:', error)
        return
      }

      // Determine table status
      let tableStatus = 'available'
      
      if (bookings && bookings.length > 0) {
        // Table is occupied if there are active bookings
        tableStatus = 'occupied'
        
        // Check if any booking is in payment phase
        const hasPaymentBooking = bookings.some(b => b.status === 'payment')
        if (hasPaymentBooking) {
          tableStatus = 'needs_cleaning' // Ready for turnover
        }
      }

      // Update table status
      await this.supabase
        .from('restaurant_tables')
        .update({
          status: tableStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', tableId)

    } catch (error) {
      console.error('Error updating table status:', error)
    }
  }
}

// Singleton instance
let integrationServiceInstance: BookingOrderIntegrationService | null = null

export function getBookingOrderIntegrationService(): BookingOrderIntegrationService {
  if (!integrationServiceInstance) {
    integrationServiceInstance = new BookingOrderIntegrationService()
  }
  return integrationServiceInstance
}
