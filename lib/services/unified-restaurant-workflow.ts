// lib/services/unified-restaurant-workflow.ts
// Unified workflow service that connects all restaurant components

import { createClient } from '@/lib/supabase/client'
import { getRestaurantOrchestrator } from './restaurant-orchestrator'
import { getWorkflowAutomationService } from './workflow-automation'
import { getPrintService } from './print-service'
import { getRealTimeService } from './real-time-service'

export interface WorkflowAction {
  type: 'complete_booking' | 'seat_guests' | 'add_order' | 'complete_order' | 'print_receipt' | 'clean_table'
  entityId: string
  data?: any
  triggeredBy?: string
}

export interface WorkflowResult {
  success: boolean
  actions: string[]
  errors?: string[]
  data?: any
}

export class UnifiedRestaurantWorkflow {
  private supabase = createClient()
  private restaurantId: string
  private orchestrator: any
  private workflowService: any
  private printService: any
  private realTimeService: any

  constructor(restaurantId: string) {
    this.restaurantId = restaurantId
    this.orchestrator = getRestaurantOrchestrator(restaurantId)
    this.workflowService = getWorkflowAutomationService(restaurantId)
    this.printService = getPrintService()
    this.realTimeService = getRealTimeService(restaurantId)
  }

  // Complete booking workflow - triggered from Checkin Queue
  async completeBooking(bookingId: string, triggeredBy: string = 'checkin_queue'): Promise<WorkflowResult> {
    const actions: string[] = []
    const errors: string[] = []

    try {
      // 1. Get booking details with orders and tables
      const { data: booking, error: bookingError } = await this.supabase
        .from('bookings')
        .select(`
          *,
          orders(*),
          booking_tables(
            table:restaurant_tables(*)
          )
        `)
        .eq('id', bookingId)
        .single()

      if (bookingError || !booking) {
        throw new Error('Failed to fetch booking details')
      }

      // 2. Mark all orders as completed
      if (booking.orders && booking.orders.length > 0) {
        const { error: ordersError } = await this.supabase
          .from('orders')
          .update({ 
            status: 'completed',
            updated_at: new Date().toISOString()
          })
          .eq('booking_id', bookingId)
          .neq('status', 'cancelled')

        if (ordersError) {
          errors.push('Failed to complete orders')
        } else {
          actions.push(`Completed ${booking.orders.length} orders`)
        }
      }

      // 3. Print customer receipt
      try {
        await this.printCustomerReceipt(booking)
        actions.push('Customer receipt printed')
      } catch (error) {
        errors.push('Failed to print receipt')
      }

      // 4. Update booking status to completed
      const { error: bookingUpdateError } = await this.supabase
        .from('bookings')
        .update({ 
          status: 'completed',
          updated_at: new Date().toISOString()
        })
        .eq('id', bookingId)

      if (bookingUpdateError) {
        errors.push('Failed to update booking status')
      } else {
        actions.push('Booking marked as completed')
      }

      // 5. Update table status to needs cleaning
      if (booking.booking_tables && booking.booking_tables.length > 0) {
        const tableIds = booking.booking_tables.map((bt: any) => bt.table.id)
        
        const { error: tableError } = await this.supabase
          .from('restaurant_tables')
          .update({ 
            status: 'needs_cleaning',
            current_booking_id: null,
            updated_at: new Date().toISOString()
          })
          .in('id', tableIds)

        if (tableError) {
          errors.push('Failed to update table status')
        } else {
          actions.push(`Updated ${tableIds.length} tables to needs cleaning`)
        }
      }

      // 6. Trigger workflow automation
      await this.workflowService.processTrigger(
        'booking_status_change',
        bookingId,
        booking.status,
        'completed',
        { triggered_by: triggeredBy }
      )

      // 7. Send real-time updates
      this.realTimeService.triggerOrderUpdate({
        type: 'booking_completed',
        booking_id: bookingId,
        timestamp: new Date().toISOString(),
        triggered_by: triggeredBy
      })

      return {
        success: errors.length === 0,
        actions,
        errors: errors.length > 0 ? errors : undefined,
        data: { booking_id: bookingId, receipt_available: true }
      }

    } catch (error: any) {
      console.error('Error in complete booking workflow:', error)
      return {
        success: false,
        actions,
        errors: [error.message || 'Unknown error occurred']
      }
    }
  }

  // Seat guests workflow - triggered from Checkin Queue or Floor Plan
  async seatGuests(bookingId: string, tableIds: string[], triggeredBy: string = 'checkin_queue'): Promise<WorkflowResult> {
    const actions: string[] = []
    const errors: string[] = []

    try {
      // 1. Update booking status to seated
      const { error: bookingError } = await this.supabase
        .from('bookings')
        .update({ 
          status: 'seated',
          updated_at: new Date().toISOString()
        })
        .eq('id', bookingId)

      if (bookingError) {
        errors.push('Failed to update booking status')
      } else {
        actions.push('Booking status updated to seated')
      }

      // 2. Update table status to occupied
      const { error: tableError } = await this.supabase
        .from('restaurant_tables')
        .update({ 
          status: 'occupied',
          current_booking_id: bookingId,
          updated_at: new Date().toISOString()
        })
        .in('id', tableIds)

      if (tableError) {
        errors.push('Failed to update table status')
      } else {
        actions.push(`Updated ${tableIds.length} tables to occupied`)
      }

      // 3. Create booking-table associations if not exists
      for (const tableId of tableIds) {
        const { error: associationError } = await this.supabase
          .from('booking_tables')
          .upsert({
            booking_id: bookingId,
            table_id: tableId,
            created_at: new Date().toISOString()
          })

        if (associationError) {
          errors.push(`Failed to associate table ${tableId}`)
        }
      }

      // 4. Trigger workflow automation
      await this.workflowService.processTrigger(
        'booking_status_change',
        bookingId,
        'confirmed',
        'seated',
        { triggered_by: triggeredBy, table_ids: tableIds }
      )

      // 5. Send real-time updates
      this.realTimeService.triggerOrderUpdate({
        type: 'guests_seated',
        booking_id: bookingId,
        table_ids: tableIds,
        timestamp: new Date().toISOString(),
        triggered_by: triggeredBy
      })

      return {
        success: errors.length === 0,
        actions,
        errors: errors.length > 0 ? errors : undefined,
        data: { 
          booking_id: bookingId, 
          table_ids: tableIds,
          can_add_order: true 
        }
      }

    } catch (error: any) {
      console.error('Error in seat guests workflow:', error)
      return {
        success: false,
        actions,
        errors: [error.message || 'Unknown error occurred']
      }
    }
  }

  // Add order workflow - triggered from any interface
  async addOrderToBooking(bookingId: string, orderData: any, triggeredBy: string = 'order_entry'): Promise<WorkflowResult> {
    const actions: string[] = []
    const errors: string[] = []

    try {
      // 1. Create the order
      const { data: order, error: orderError } = await this.supabase
        .from('orders')
        .insert({
          ...orderData,
          booking_id: bookingId,
          restaurant_id: this.restaurantId,
          status: 'pending',
          created_at: new Date().toISOString()
        })
        .select()
        .single()

      if (orderError || !order) {
        throw new Error('Failed to create order')
      }

      actions.push(`Created order ${order.order_number}`)

      // 2. Update booking status to ordered if not already
      const { data: booking } = await this.supabase
        .from('bookings')
        .select('status')
        .eq('id', bookingId)
        .single()

      if (booking && booking.status === 'seated') {
        const { error: bookingUpdateError } = await this.supabase
          .from('bookings')
          .update({ 
            status: 'ordered',
            updated_at: new Date().toISOString()
          })
          .eq('id', bookingId)

        if (bookingUpdateError) {
          errors.push('Failed to update booking status')
        } else {
          actions.push('Booking status updated to ordered')
        }
      }

      // 3. Trigger workflow automation
      await this.workflowService.processTrigger(
        'order_status_change',
        order.id,
        undefined,
        'pending',
        { 
          triggered_by: triggeredBy,
          booking_id: bookingId 
        }
      )

      // 4. Send real-time updates
      this.realTimeService.triggerOrderUpdate({
        type: 'order_created',
        order_id: order.id,
        booking_id: bookingId,
        timestamp: new Date().toISOString(),
        triggered_by: triggeredBy
      })

      return {
        success: errors.length === 0,
        actions,
        errors: errors.length > 0 ? errors : undefined,
        data: { 
          order_id: order.id,
          booking_id: bookingId,
          order_number: order.order_number
        }
      }

    } catch (error: any) {
      console.error('Error in add order workflow:', error)
      return {
        success: false,
        actions,
        errors: [error.message || 'Unknown error occurred']
      }
    }
  }

  // Complete order workflow - triggered from Kitchen Display
  async completeOrder(orderId: string, triggeredBy: string = 'kitchen_display'): Promise<WorkflowResult> {
    const actions: string[] = []
    const errors: string[] = []

    try {
      // 1. Get order details
      const { data: order, error: orderError } = await this.supabase
        .from('orders')
        .select(`
          *,
          booking:bookings!orders_booking_id_fkey(*)
        `)
        .eq('id', orderId)
        .single()

      if (orderError || !order) {
        throw new Error('Failed to fetch order details')
      }

      // 2. Update order status to completed
      const { error: updateError } = await this.supabase
        .from('orders')
        .update({ 
          status: 'completed',
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId)

      if (updateError) {
        errors.push('Failed to update order status')
      } else {
        actions.push('Order marked as completed')
      }

      // 3. Print order receipt
      try {
        await this.printOrderReceipt(order)
        actions.push('Order receipt printed')
      } catch (error) {
        errors.push('Failed to print order receipt')
      }

      // 4. Check if all orders for booking are completed
      const { data: allOrders } = await this.supabase
        .from('orders')
        .select('status')
        .eq('booking_id', order.booking_id)
        .neq('status', 'cancelled')

      const allCompleted = allOrders?.every(o => o.status === 'completed') || false

      if (allCompleted) {
        // Update booking status to dining
        const { error: bookingError } = await this.supabase
          .from('bookings')
          .update({ 
            status: 'dining',
            updated_at: new Date().toISOString()
          })
          .eq('id', order.booking_id)

        if (!bookingError) {
          actions.push('All orders completed - booking status updated to dining')
        }
      }

      // 5. Trigger workflow automation
      await this.workflowService.processTrigger(
        'order_status_change',
        orderId,
        order.status,
        'completed',
        { 
          triggered_by: triggeredBy,
          booking_id: order.booking_id,
          all_orders_completed: allCompleted
        }
      )

      // 6. Send real-time updates
      this.realTimeService.triggerOrderUpdate({
        type: 'order_completed',
        order_id: orderId,
        booking_id: order.booking_id,
        all_orders_completed: allCompleted,
        timestamp: new Date().toISOString(),
        triggered_by: triggeredBy
      })

      return {
        success: errors.length === 0,
        actions,
        errors: errors.length > 0 ? errors : undefined,
        data: { 
          order_id: orderId,
          booking_id: order.booking_id,
          all_orders_completed: allCompleted,
          receipt_printed: true
        }
      }

    } catch (error: any) {
      console.error('Error in complete order workflow:', error)
      return {
        success: false,
        actions,
        errors: [error.message || 'Unknown error occurred']
      }
    }
  }

  // Print customer receipt helper
  private async printCustomerReceipt(booking: any): Promise<void> {
    // Get complete order details
    const { data: orders } = await this.supabase
      .from('orders')
      .select(`
        *,
        order_items(
          *,
          menu_item:menu_items(name, price)
        )
      `)
      .eq('booking_id', booking.id)

    const receiptData = {
      booking_id: booking.id,
      guest_name: booking.guest_name || 'Guest',
      party_size: booking.party_size,
      table_number: booking.booking_tables?.[0]?.table?.table_number || 'N/A',
      date: new Date().toLocaleDateString(),
      time: new Date().toLocaleTimeString(),
      orders: orders || [],
      include_itemized: true,
      include_payment_summary: true
    }

    await this.printService.printReceipt(receiptData)
  }

  // Print order receipt helper
  private async printOrderReceipt(order: any): Promise<void> {
    // Get order items
    const { data: orderItems } = await this.supabase
      .from('order_items')
      .select(`
        *,
        menu_item:menu_items(name, price)
      `)
      .eq('order_id', order.id)

    const receiptData = {
      order_id: order.id,
      order_number: order.order_number,
      guest_name: order.booking?.guest_name || 'Guest',
      table_number: 'N/A', // Will be fetched if needed
      order_items: orderItems || [],
      subtotal: order.subtotal,
      tax_amount: order.tax_amount,
      total_amount: order.total_amount,
      special_instructions: order.special_instructions
    }

    await this.printService.printOrderReceipt(receiptData)
  }
}

// Singleton instance
let workflowInstance: any = null

export function getUnifiedWorkflow(restaurantId: string): UnifiedRestaurantWorkflow {
  if (!workflowInstance || workflowInstance.restaurantId !== restaurantId) {
    workflowInstance = new UnifiedRestaurantWorkflow(restaurantId)
  }
  return workflowInstance
}
