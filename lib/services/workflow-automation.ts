// lib/services/workflow-automation.ts
// Automated workflow system for restaurant operations

import { createClient } from '@/lib/supabase/client'
import { getRestaurantOrchestrator } from './restaurant-orchestrator'
import { getRealTimeService } from './real-time-service'
import { getPrintService } from './print-service'

export interface WorkflowRule {
  id: string
  name: string
  trigger: WorkflowTrigger
  conditions: WorkflowCondition[]
  actions: WorkflowAction[]
  enabled: boolean
}

export interface WorkflowTrigger {
  type: 'booking_status_change' | 'order_status_change' | 'table_status_change' | 'time_based'
  entity: string
  from_status?: string
  to_status?: string
  time_condition?: string
}

export interface WorkflowCondition {
  type: 'status_equals' | 'time_elapsed' | 'all_orders_complete' | 'table_available'
  entity: string
  value: any
}

export interface WorkflowAction {
  type: 'update_status' | 'send_notification' | 'assign_table' | 'create_order' | 'update_booking' | 'print_receipt'
  entity: string
  parameters: Record<string, any>
}

class WorkflowAutomationService {
  private supabase = createClient()
  private rules: WorkflowRule[] = []
  private restaurantId: string

  constructor(restaurantId: string) {
    this.restaurantId = restaurantId
    this.initializeDefaultRules()
  }

  // Initialize default workflow rules
  private initializeDefaultRules() {
    this.rules = [
      // Booking confirmed → Reserve table
      {
        id: 'booking-confirmed-reserve-table',
        name: 'Reserve table when booking confirmed',
        trigger: {
          type: 'booking_status_change',
          entity: 'booking',
          to_status: 'confirmed'
        },
        conditions: [],
        actions: [
          {
            type: 'update_status',
            entity: 'table',
            parameters: { status: 'reserved' }
          }
        ],
        enabled: true
      },

      // Guest arrived → Update booking and table status
      {
        id: 'guest-arrived-seat',
        name: 'Seat guests when they arrive',
        trigger: {
          type: 'booking_status_change',
          entity: 'booking',
          to_status: 'arrived'
        },
        conditions: [
          {
            type: 'table_available',
            entity: 'table',
            value: true
          }
        ],
        actions: [
          {
            type: 'update_booking',
            entity: 'booking',
            parameters: { status: 'seated' }
          },
          {
            type: 'update_status',
            entity: 'table',
            parameters: { status: 'occupied' }
          },
          {
            type: 'send_notification',
            entity: 'staff',
            parameters: { 
              message: 'Guests seated and ready to order',
              type: 'info'
            }
          }
        ],
        enabled: true
      },

      // Order created → Update booking status
      {
        id: 'order-created-update-booking',
        name: 'Update booking when first order created',
        trigger: {
          type: 'order_status_change',
          entity: 'order',
          to_status: 'pending'
        },
        conditions: [],
        actions: [
          {
            type: 'update_booking',
            entity: 'booking',
            parameters: { status: 'ordered' }
          },
          {
            type: 'send_notification',
            entity: 'kitchen',
            parameters: {
              message: 'New order received',
              type: 'order_alert'
            }
          }
        ],
        enabled: true
      },

      // Order confirmed → Start preparation
      {
        id: 'order-confirmed-start-prep',
        name: 'Start preparation when order confirmed',
        trigger: {
          type: 'order_status_change',
          entity: 'order',
          to_status: 'confirmed'
        },
        conditions: [],
        actions: [
          {
            type: 'update_status',
            entity: 'order',
            parameters: { 
              status: 'preparing',
              started_preparing_at: new Date().toISOString()
            }
          },
          {
            type: 'send_notification',
            entity: 'kitchen',
            parameters: {
              message: 'Order preparation started',
              type: 'prep_started'
            }
          }
        ],
        enabled: true
      },

      // Order ready → Notify service staff
      {
        id: 'order-ready-notify-service',
        name: 'Notify service when order ready',
        trigger: {
          type: 'order_status_change',
          entity: 'order',
          to_status: 'ready'
        },
        conditions: [],
        actions: [
          {
            type: 'send_notification',
            entity: 'service',
            parameters: {
              message: 'Order ready for service',
              type: 'service_alert',
              priority: 'high'
            }
          }
        ],
        enabled: true
      },

      // Order completed → Print order receipt
      {
        id: 'order-completed-print-receipt',
        name: 'Print receipt when individual order completed',
        trigger: {
          type: 'order_status_change',
          entity: 'order',
          to_status: 'completed'
        },
        conditions: [],
        actions: [
          {
            type: 'print_receipt',
            entity: 'order',
            parameters: {
              receipt_type: 'order_receipt',
              include_itemized: true
            }
          },
          {
            type: 'send_notification',
            entity: 'service',
            parameters: {
              message: 'Order receipt printed',
              type: 'receipt_printed'
            }
          }
        ],
        enabled: true
      },

      // All orders served → Update booking status
      {
        id: 'all-orders-served-update-booking',
        name: 'Update booking when all orders served',
        trigger: {
          type: 'order_status_change',
          entity: 'order',
          to_status: 'served'
        },
        conditions: [
          {
            type: 'all_orders_complete',
            entity: 'booking',
            value: 'served'
          }
        ],
        actions: [
          {
            type: 'update_booking',
            entity: 'booking',
            parameters: { status: 'dining' }
          },
          {
            type: 'send_notification',
            entity: 'service',
            parameters: {
              message: 'All orders served - check on guests',
              type: 'check_in'
            }
          }
        ],
        enabled: true
      },

      // All orders completed → Print receipt and complete booking
      {
        id: 'all-orders-completed-print-receipt',
        name: 'Print receipt when all orders completed',
        trigger: {
          type: 'order_status_change',
          entity: 'order',
          to_status: 'completed'
        },
        conditions: [
          {
            type: 'all_orders_complete',
            entity: 'booking',
            value: 'completed'
          }
        ],
        actions: [
          {
            type: 'print_receipt',
            entity: 'booking',
            parameters: {
              receipt_type: 'customer_receipt',
              include_itemized: true,
              include_payment_summary: true
            }
          },
          {
            type: 'update_booking',
            entity: 'booking',
            parameters: { status: 'completed' }
          },
          {
            type: 'send_notification',
            entity: 'service',
            parameters: {
              message: 'Receipt printed - booking completed',
              type: 'booking_complete'
            }
          }
        ],
        enabled: true
      },

      // Booking completed → Clean table
      {
        id: 'booking-completed-clean-table',
        name: 'Mark table for cleaning when booking completed',
        trigger: {
          type: 'booking_status_change',
          entity: 'booking',
          to_status: 'completed'
        },
        conditions: [],
        actions: [
          {
            type: 'update_status',
            entity: 'table',
            parameters: { status: 'needs_cleaning' }
          },
          {
            type: 'print_receipt',
            entity: 'booking',
            parameters: {
              receipt_type: 'kitchen_summary',
              include_timing: true,
              include_notes: true
            }
          },
          {
            type: 'send_notification',
            entity: 'service',
            parameters: {
              message: 'Table needs cleaning and reset',
              type: 'cleaning_required'
            }
          }
        ],
        enabled: true
      },

      // Table cleaned → Make available
      {
        id: 'table-cleaned-make-available',
        name: 'Make table available after cleaning',
        trigger: {
          type: 'table_status_change',
          entity: 'table',
          to_status: 'cleaned'
        },
        conditions: [],
        actions: [
          {
            type: 'update_status',
            entity: 'table',
            parameters: { status: 'available' }
          },
          {
            type: 'send_notification',
            entity: 'host',
            parameters: {
              message: 'Table available for seating',
              type: 'table_ready'
            }
          }
        ],
        enabled: true
      }
    ]
  }

  // Process a workflow trigger
  async processTrigger(
    triggerType: WorkflowTrigger['type'],
    entityId: string,
    fromStatus?: string,
    toStatus?: string,
    additionalData?: any
  ) {
    try {
      // Find matching rules
      const matchingRules = this.rules.filter(rule => 
        rule.enabled &&
        rule.trigger.type === triggerType &&
        (!rule.trigger.from_status || rule.trigger.from_status === fromStatus) &&
        (!rule.trigger.to_status || rule.trigger.to_status === toStatus)
      )

      for (const rule of matchingRules) {
        // Check conditions
        const conditionsMet = await this.checkConditions(rule.conditions, entityId, additionalData)
        
        if (conditionsMet) {
          // Execute actions
          await this.executeActions(rule.actions, entityId, additionalData)
          
          console.log(`Workflow rule executed: ${rule.name}`)
        }
      }

    } catch (error) {
      console.error('Error processing workflow trigger:', error)
    }
  }

  // Check if all conditions are met
  private async checkConditions(
    conditions: WorkflowCondition[],
    entityId: string,
    additionalData?: any
  ): Promise<boolean> {
    for (const condition of conditions) {
      const met = await this.checkCondition(condition, entityId, additionalData)
      if (!met) return false
    }
    return true
  }

  // Check individual condition
  private async checkCondition(
    condition: WorkflowCondition,
    entityId: string,
    additionalData?: any
  ): Promise<boolean> {
    try {
      switch (condition.type) {
        case 'status_equals':
          return await this.checkStatusEquals(condition, entityId)
        
        case 'all_orders_complete':
          return await this.checkAllOrdersComplete(condition, entityId)
        
        case 'table_available':
          return await this.checkTableAvailable(condition, entityId)
        
        case 'time_elapsed':
          return await this.checkTimeElapsed(condition, entityId)
        
        default:
          return true
      }
    } catch (error) {
      console.error('Error checking condition:', error)
      return false
    }
  }

  // Execute workflow actions
  private async executeActions(
    actions: WorkflowAction[],
    entityId: string,
    additionalData?: any
  ) {
    for (const action of actions) {
      try {
        await this.executeAction(action, entityId, additionalData)
      } catch (error) {
        console.error('Error executing action:', error)
      }
    }
  }

  // Execute individual action
  private async executeAction(
    action: WorkflowAction,
    entityId: string,
    additionalData?: any
  ) {
    switch (action.type) {
      case 'update_status':
        await this.updateEntityStatus(action, entityId)
        break
      
      case 'send_notification':
        await this.sendNotification(action, entityId)
        break
      
      case 'update_booking':
        await this.updateBooking(action, entityId, additionalData)
        break
      
      case 'assign_table':
        await this.assignTable(action, entityId)
        break

      case 'print_receipt':
        await this.printReceipt(action, entityId, additionalData)
        break
    }
  }

  // Condition checkers
  private async checkStatusEquals(condition: WorkflowCondition, entityId: string): Promise<boolean> {
    // Implementation depends on entity type
    return true
  }

  private async checkAllOrdersComplete(condition: WorkflowCondition, entityId: string): Promise<boolean> {
    const { data: orders } = await this.supabase
      .from('orders')
      .select('status')
      .eq('booking_id', entityId)

    if (!orders || orders.length === 0) return false

    return orders.every(order => order.status === condition.value)
  }

  private async checkTableAvailable(condition: WorkflowCondition, entityId: string): Promise<boolean> {
    // Get table status from orchestrator
    const orchestrator = getRestaurantOrchestrator(this.restaurantId)
    const state = orchestrator.getState()
    
    // Find table for this booking
    const booking = state.bookings[entityId]
    if (!booking || booking.table_ids.length === 0) return false

    const table = state.tables[booking.table_ids[0]]
    return table?.status === 'available' || table?.status === 'reserved'
  }

  private async checkTimeElapsed(condition: WorkflowCondition, entityId: string): Promise<boolean> {
    // Implementation for time-based conditions
    return true
  }

  // Action executors
  private async updateEntityStatus(action: WorkflowAction, entityId: string) {
    const table = action.entity === 'table' ? 'restaurant_tables' : 
                  action.entity === 'booking' ? 'bookings' : 
                  action.entity === 'order' ? 'orders' : null

    if (!table) return

    await this.supabase
      .from(table)
      .update({
        ...action.parameters,
        updated_at: new Date().toISOString()
      })
      .eq('id', entityId)
  }

  private async sendNotification(action: WorkflowAction, entityId: string) {
    const realTimeService = getRealTimeService( this.restaurantId)
    
    await realTimeService.notifyKitchen(
      action.parameters.message,
      action.parameters.priority || 'medium'
    )
  }

  private async updateBooking(action: WorkflowAction, entityId: string, additionalData?: any) {
    // If entityId is an order, get the booking ID
    let bookingId = entityId
    
    if (additionalData?.booking_id) {
      bookingId = additionalData.booking_id
    } else {
      // Try to get booking ID from order
      const { data: order } = await this.supabase
        .from('orders')
        .select('booking_id')
        .eq('id', entityId)
        .single()
      
      if (order) {
        bookingId = order.booking_id
      }
    }

    await this.supabase
      .from('bookings')
      .update({
        ...action.parameters,
        updated_at: new Date().toISOString()
      })
      .eq('id', bookingId)
  }

  private async assignTable(action: WorkflowAction, entityId: string) {
    // Implementation for table assignment
    // This would involve the table assignment logic
  }

  private async printReceipt(action: WorkflowAction, entityId: string, additionalData?: any) {
    try {
      const printService = getPrintService()

      // Get booking ID - either directly or from order
      let bookingId = entityId

      if (additionalData?.booking_id) {
        bookingId = additionalData.booking_id
      } else {
        // Try to get booking ID from order
        const { data: order } = await this.supabase
          .from('orders')
          .select('booking_id')
          .eq('id', entityId)
          .single()

        if (order) {
          bookingId = order.booking_id
        }
      }

      // Get complete booking data for receipt
      const { data: booking, error: bookingError } = await this.supabase
        .from('bookings')
        .select(`
          *,
          booking_tables(
            table:restaurant_tables(table_number)
          ),
          orders(
            *,
            order_items(
              *,
              menu_item:menu_items(name, price)
            )
          )
        `)
        .eq('id', bookingId)
        .single()

      if (bookingError || !booking) {
        console.error('Error fetching booking for receipt:', bookingError)
        return
      }

      // Generate receipt based on type
      const receiptType = action.parameters.receipt_type || 'customer_receipt'

      switch (receiptType) {
        case 'customer_receipt':
          await this.printCustomerReceipt(printService, booking, action.parameters)
          break

        case 'kitchen_summary':
          await this.printKitchenSummary(printService, booking, action.parameters)
          break

        case 'order_receipt':
          await this.printOrderReceipt(printService, booking, entityId, action.parameters)
          break
      }

    } catch (error) {
      console.error('Error printing receipt:', error)
    }
  }

  // Print customer receipt with itemized bill
  private async printCustomerReceipt(printService: any, booking: any, parameters: any) {
    const receiptData = {
      type: 'customer_receipt',
      booking_id: booking.id,
      guest_name: booking.guest_name,
      party_size: booking.party_size,
      table_number: booking.booking_tables?.[0]?.table?.table_number || 'N/A',
      date: new Date().toLocaleDateString(),
      time: new Date().toLocaleTimeString(),
      orders: booking.orders || [],
      include_itemized: parameters.include_itemized || true,
      include_payment_summary: parameters.include_payment_summary || true,
      footer_message: 'Thank you for dining with us!'
    }

    await printService.printReceipt(receiptData)
  }

  // Print kitchen summary for completed service
  private async printKitchenSummary(printService: any, booking: any, parameters: any) {
    const summaryData = {
      type: 'kitchen_summary',
      booking_id: booking.id,
      guest_name: booking.guest_name,
      table_number: booking.booking_tables?.[0]?.table?.table_number || 'N/A',
      orders: booking.orders || [],
      include_timing: parameters.include_timing || true,
      include_notes: parameters.include_notes || true,
      completion_time: new Date().toLocaleTimeString()
    }

    await printService.printKitchenSummary(summaryData)
  }

  // Print individual order receipt
  private async printOrderReceipt(printService: any, booking: any, orderId: string, parameters: any) {
    const order = booking.orders?.find((o: any) => o.id === orderId)
    if (!order) return

    const receiptData = {
      type: 'order_receipt',
      order_id: order.id,
      order_number: order.order_number,
      guest_name: booking.guest_name,
      table_number: booking.booking_tables?.[0]?.table?.table_number || 'N/A',
      order_items: order.order_items || [],
      subtotal: order.subtotal,
      tax_amount: order.tax_amount,
      total_amount: order.total_amount,
      special_instructions: order.special_instructions
    }

    await printService.printOrderReceipt(receiptData)
  }
}

// Singleton instance
let workflowInstance: WorkflowAutomationService | null = null

export function getWorkflowAutomationService(restaurantId: string): WorkflowAutomationService {
  if (!workflowInstance) {
    workflowInstance = new WorkflowAutomationService(restaurantId)
  }
  return workflowInstance
}

// Hook into existing services to trigger workflows
export function initializeWorkflowIntegration(restaurantId: string) {
  const workflowService = getWorkflowAutomationService(restaurantId)
  const orchestrator = getRestaurantOrchestrator(restaurantId)

  // Subscribe to orchestrator state changes to trigger workflows
  orchestrator.subscribe((state) => {
    // This would trigger workflows based on state changes
    // Implementation would track previous state and detect changes
  })
}
