// lib/services/order-workflow-service.ts
"use client"

import { createClient } from "@/lib/supabase/client"
import { getBookingOrderIntegrationService } from "./booking-order-integration"

export interface OrderWorkflowState {
  order_id: string
  status: string
  stage: string
  estimated_completion?: Date
  actual_completion?: Date
  notes?: string
}

export interface CourseCoordination {
  order_id: string
  course_sequence: string[]
  current_course: string
  next_course?: string
  timing_rules: {
    appetizer_to_main: number // minutes
    main_to_dessert: number
    course_overlap: boolean
  }
}

export interface KitchenWorkflow {
  station_assignments: {
    station_id: string
    order_items: string[]
    estimated_time: number
    priority: number
  }[]
  preparation_sequence: string[]
  coordination_notes: string[]
}

export class OrderWorkflowService {
  private supabase = createClient()

  // Order Status Transitions
  private readonly STATUS_TRANSITIONS = {
    pending: ['confirmed', 'cancelled'],
    confirmed: ['preparing', 'cancelled'],
    preparing: ['ready', 'cancelled'],
    ready: ['served', 'cancelled'],
    served: ['completed'],
    completed: [],
    cancelled: []
  }

  // Course Timing Rules (in minutes)
  private readonly COURSE_TIMING = {
    appetizer_to_main: 15,
    main_to_dessert: 20,
    course_overlap_allowed: false
  }

  // Validate status transition
  isValidTransition(currentStatus: string, newStatus: string): boolean {
    const allowedTransitions:any = this.STATUS_TRANSITIONS[currentStatus as keyof typeof this.STATUS_TRANSITIONS]
    return allowedTransitions?.includes(newStatus) || false
  }

  // Update order status with workflow validation
  async updateOrderStatus(
    orderId: string, 
    newStatus: string, 
    userId: string,
    notes?: string,
    stationId?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Get current order status
      const { data: currentOrder, error: fetchError }:any = await this.supabase
        .from('orders')
        .select('status, course_type, booking_id')
        .eq('id', orderId)
        .single()

      if (fetchError || !currentOrder) {
        return { success: false, error: 'Order not found' }
      }

      // Validate transition
      if (!this.isValidTransition(currentOrder.status, newStatus)) {
        return { 
          success: false, 
          error: `Invalid status transition from ${currentOrder.status} to ${newStatus}` 
        }
      }

      // Check course coordination rules
      if (currentOrder.course_type && newStatus === 'preparing') {
        const coordinationCheck = await this.checkCourseCoordination(
          currentOrder.booking_id, 
          currentOrder.course_type
        )
        
        if (!coordinationCheck.canProceed) {
          return { 
            success: false, 
            error: coordinationCheck.reason 
          }
        }
      }

      // Update order status with timestamp
      const updateData: any = {
        status: newStatus,
        updated_at: new Date().toISOString()
      }

      // Add status-specific timestamps
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
          // Calculate actual prep time
          if (currentOrder.started_preparing_at) {
            const prepTime = Math.round(
              (new Date().getTime() - new Date(currentOrder.started_preparing_at).getTime()) / 60000
            )
            updateData.actual_prep_time = prepTime
          }
          break
      }

      const { error: updateError } = await this.supabase
        .from('orders')
        .update(updateData)
        .eq('id', orderId)

      if (updateError) {
        return { success: false, error: 'Failed to update order status' }
      }

      // Log status change
      await this.logStatusChange(
        orderId, 
        currentOrder.status, 
        newStatus, 
        userId, 
        notes,
        stationId
      )

      // Handle workflow automation
      await this.handleWorkflowAutomation(orderId, newStatus, currentOrder)

      // Auto-advance booking status if appropriate
      const integrationService = getBookingOrderIntegrationService()
      await integrationService.autoAdvanceBookingStatus(currentOrder.booking_id)

      return { success: true }

    } catch (error) {
      console.error('Order status update error:', error)
      return { success: false, error: 'Internal server error' }
    }
  }

  // Check course coordination rules
  private async checkCourseCoordination(
    bookingId: string, 
    courseType: string
  ): Promise<{ canProceed: boolean; reason?: string }> {
    try {
      // Get all orders for this booking
      const { data: bookingOrders, error } = await this.supabase
        .from('orders')
        .select('id, course_type, status, started_preparing_at, ready_at')
        .eq('booking_id', bookingId)
        .neq('status', 'cancelled')

      if (error || !bookingOrders) {
        return { canProceed: true } // Allow if we can't check
      }

      // Course coordination logic
      switch (courseType) {
        case 'main_course':
          // Check if appetizers are ready or being served
          const appetizers = bookingOrders.filter(o => o.course_type === 'appetizer')
          if (appetizers.length > 0) {
            const allAppetizersReady = appetizers.every(o => 
              ['ready', 'served', 'completed'].includes(o.status)
            )
            
            if (!allAppetizersReady) {
              return { 
                canProceed: false, 
                reason: 'Wait for appetizers to be ready before starting main course' 
              }
            }
          }
          break

        case 'dessert':
          // Check if main courses are served
          const mains = bookingOrders.filter(o => o.course_type === 'main_course')
          if (mains.length > 0) {
            const allMainsServed = mains.every(o => 
              ['served', 'completed'].includes(o.status)
            )
            
            if (!allMainsServed) {
              return { 
                canProceed: false, 
                reason: 'Wait for main courses to be served before starting dessert' 
              }
            }
          }
          break
      }

      return { canProceed: true }

    } catch (error) {
      console.error('Course coordination check error:', error)
      return { canProceed: true } // Allow if check fails
    }
  }

  // Log status changes for audit trail
  private async logStatusChange(
    orderId: string,
    oldStatus: string,
    newStatus: string,
    userId: string,
    notes?: string,
    stationId?: string
  ): Promise<void> {
    try {
      await this.supabase
        .from('order_status_history')
        .insert({
          order_id: orderId,
          old_status: oldStatus,
          new_status: newStatus,
          changed_by: userId,
          notes: notes || `Status changed from ${oldStatus} to ${newStatus}`,
          station_id: stationId,
          changed_at: new Date().toISOString()
        })
    } catch (error) {
      console.error('Failed to log status change:', error)
    }
  }

  // Handle automated workflow actions
  private async handleWorkflowAutomation(
    orderId: string,
    newStatus: string,
    orderData: any
  ): Promise<void> {
    try {
      switch (newStatus) {
        case 'confirmed':
          // Auto-assign to kitchen stations
          await this.autoAssignKitchenStations(orderId)
          break

        case 'ready':
          // Notify service staff
          await this.notifyServiceStaff(orderId, orderData)
          break

        case 'served':
          // Check if all orders for booking are served
          await this.checkBookingCompletion(orderData.booking_id)
          break

        case 'completed':
          // Update booking status if all orders complete
          await this.updateBookingStatus(orderData.booking_id)
          break
      }
    } catch (error) {
      console.error('Workflow automation error:', error)
    }
  }

  // Auto-assign order items to kitchen stations
  private async autoAssignKitchenStations(orderId: string): Promise<void> {
    try {
      // Get order items with menu item details
      const { data: orderItems, error }:any = await this.supabase
        .from('order_items')
        .select(`
          id,
          menu_item:menu_items!order_items_menu_item_id_fkey(
            id,
            menu_item_stations(
              station_id,
              is_primary,
              preparation_order,
              estimated_time
            )
          )
        `)
        .eq('order_id', orderId)

      if (error || !orderItems) return

      // Create kitchen assignments
      const assignments = []
      for (const item of orderItems) {
        const stations = item.menu_item?.menu_item_stations || []
        const primaryStation = stations.find((s: { is_primary: any }) => s.is_primary) || stations[0]
        
        if (primaryStation) {
          assignments.push({
            order_item_id: item.id,
            station_id: primaryStation.station_id,
            assigned_at: new Date().toISOString()
          })
        }
      }

      if (assignments.length > 0) {
        await this.supabase
          .from('kitchen_assignments')
          .insert(assignments)
      }

    } catch (error) {
      console.error('Auto-assignment error:', error)
    }
  }

  // Notify service staff when order is ready
  private async notifyServiceStaff(orderId: string, orderData: any): Promise<void> {
    // This would integrate with notification system
    // For now, we'll just log it
    console.log(`Order ${orderId} is ready for service`)
  }

  // Check if all orders for a booking are served
  private async checkBookingCompletion(bookingId: string): Promise<void> {
    try {
      const { data: orders, error } = await this.supabase
        .from('orders')
        .select('status')
        .eq('booking_id', bookingId)
        .neq('status', 'cancelled')

      if (error || !orders) return

      const allServed = orders.every(order => 
        ['served', 'completed'].includes(order.status)
      )

      if (allServed) {
        // Update booking status to indicate dining phase
        await this.supabase
          .from('bookings')
          .update({ 
            status: 'dining',
            updated_at: new Date().toISOString()
          })
          .eq('id', bookingId)
      }

    } catch (error) {
      console.error('Booking completion check error:', error)
    }
  }

  // Update booking status when all orders are completed
  private async updateBookingStatus(bookingId: string): Promise<void> {
    try {
      const { data: orders, error } = await this.supabase
        .from('orders')
        .select('status')
        .eq('booking_id', bookingId)
        .neq('status', 'cancelled')

      if (error || !orders) return

      const allCompleted = orders.every(order => order.status === 'completed')

      if (allCompleted) {
        // Update booking to payment phase
        await this.supabase
          .from('bookings')
          .update({ 
            status: 'payment',
            updated_at: new Date().toISOString()
          })
          .eq('id', bookingId)
      }

    } catch (error) {
      console.error('Booking status update error:', error)
    }
  }

  // Get order workflow summary
  async getOrderWorkflowSummary(orderId: string): Promise<any> {
    try {
      const { data: order, error } = await this.supabase
        .from('orders')
        .select(`
          *,
          order_items(
            *,
            kitchen_assignments(
              *,
              station:kitchen_stations!kitchen_assignments_station_id_fkey(
                name,
                station_type
              )
            )
          ),
          order_status_history(
            *,
            changed_by_profile:profiles!order_status_history_changed_by_fkey(
              full_name
            )
          )
        `)
        .eq('id', orderId)
        .single()

      if (error || !order) {
        return null
      }

      // Calculate timing information
      const now = new Date()
      const createdAt = new Date(order.created_at)
      const elapsedMinutes = Math.floor((now.getTime() - createdAt.getTime()) / 60000)

      // Estimate completion time based on preparation times
      const maxPrepTime = Math.max(
        ...order.order_items.map((item: any) => item.estimated_prep_time || 0)
      )
      const estimatedCompletion = new Date(createdAt.getTime() + maxPrepTime * 60000)

      return {
        ...order,
        workflow: {
          elapsed_minutes: elapsedMinutes,
          estimated_completion: estimatedCompletion,
          is_overdue: now > estimatedCompletion && order.status !== 'ready',
          next_status: this.STATUS_TRANSITIONS[order.status as keyof typeof this.STATUS_TRANSITIONS]?.[0],
          can_transition: this.STATUS_TRANSITIONS[order.status as keyof typeof this.STATUS_TRANSITIONS]?.length > 0
        }
      }

    } catch (error) {
      console.error('Workflow summary error:', error)
      return null
    }
  }

  // Get kitchen workload summary
  async getKitchenWorkload(restaurantId: string): Promise<any> {
    try {
      const { data: stations, error } = await this.supabase
        .from('kitchen_stations')
        .select(`
          *,
          kitchen_assignments(
            *,
            order_item:order_items!kitchen_assignments_order_item_id_fkey(
              *,
              order:orders!order_items_order_id_fkey(
                id,
                status,
                priority_level,
                created_at
              )
            )
          )
        `)
        .eq('restaurant_id', restaurantId)
        .eq('is_active', true)

      if (error || !stations) {
        return { stations: [], summary: {} }
      }

      const workloadSummary = stations.map(station => {
        const activeAssignments = station.kitchen_assignments.filter((assignment: any) => 
          !assignment.completed_at && 
          ['confirmed', 'preparing'].includes(assignment.order_item.order.status)
        )

        const totalItems = activeAssignments.length
        const preparingItems = activeAssignments.filter((assignment: any) => 
          assignment.started_at && !assignment.completed_at
        ).length

        const highPriorityItems = activeAssignments.filter((assignment: any) => 
          assignment.order_item.order.priority_level >= 4
        ).length

        return {
          ...station,
          workload: {
            total_items: totalItems,
            preparing_items: preparingItems,
            pending_items: totalItems - preparingItems,
            high_priority_items: highPriorityItems,
            status: totalItems === 0 ? 'idle' : 
                    preparingItems > 0 ? 'busy' : 'pending'
          }
        }
      })

      const overallSummary = {
        total_stations: stations.length,
        busy_stations: workloadSummary.filter(s => s.workload.status === 'busy').length,
        idle_stations: workloadSummary.filter(s => s.workload.status === 'idle').length,
        total_pending_items: workloadSummary.reduce((sum, s) => sum + s.workload.pending_items, 0),
        total_preparing_items: workloadSummary.reduce((sum, s) => sum + s.workload.preparing_items, 0)
      }

      return {
        stations: workloadSummary,
        summary: overallSummary
      }

    } catch (error) {
      console.error('Kitchen workload error:', error)
      return { stations: [], summary: {} }
    }
  }
}

// Singleton instance
let workflowServiceInstance: OrderWorkflowService | null = null

export function getOrderWorkflowService(): OrderWorkflowService {
  if (!workflowServiceInstance) {
    workflowServiceInstance = new OrderWorkflowService()
  }
  return workflowServiceInstance
}
