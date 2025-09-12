// lib/services/restaurant-orchestrator.ts
// Central orchestrator for all restaurant operations - booking, tables, orders, kitchen

import { createClient } from '@/lib/supabase/client'
import { getRealtimeConnectionManager } from '@/lib/services/realtime-connection-manager'
import { getBookingOrderIntegrationService } from './booking-order-integration'
import { getRealTimeService } from './real-time-service'
import { useState, useEffect } from 'react'

export interface RestaurantState {
  tables: Record<string, TableState>
  bookings: Record<string, BookingState>
  orders: Record<string, OrderState>
  kitchen: KitchenState
  lastUpdate: Date
}

export interface TableState {
  id: string
  table_number: string
  status: 'available' | 'occupied' | 'reserved' | 'needs_cleaning'
  current_booking?: string
  next_booking?: string
  estimated_turnover?: Date
  last_updated: Date
}

export interface BookingState {
  id: string
  guest_name: string
  party_size: number
  status: string
  table_ids: string[]
  orders: string[]
  timeline: BookingTimelineEvent[]
  estimated_completion?: Date
}

export interface OrderState {
  id: string
  booking_id: string
  table_id?: string
  status: string
  course_type?: string
  items: OrderItemState[]
  estimated_completion?: Date
  kitchen_station?: string
}

export interface OrderItemState {
  id: string
  menu_item_id: string
  status: string
  estimated_prep_time?: number
  started_at?: Date
  completed_at?: Date
}

export interface KitchenState {
  active_orders: string[]
  stations: Record<string, StationState>
  queue_depth: number
  average_prep_time: number
}

export interface StationState {
  id: string
  name: string
  current_orders: string[]
  capacity: number
  average_time: number
}

export interface BookingTimelineEvent {
  timestamp: Date
  event: string
  description: string
  automated: boolean
}

class RestaurantOrchestrator {
  private supabase = createClient()
  private connectionManager = getRealtimeConnectionManager()
  private unsubscribeFunctions: Array<() => void> = []
  private state: RestaurantState = {
    tables: {},
    bookings: {},
    orders: {},
    kitchen: {
      active_orders: [],
      stations: {},
      queue_depth: 0,
      average_prep_time: 0
    },
    lastUpdate: new Date()
  }
  private listeners: Array<(state: RestaurantState) => void> = []
  private restaurantId: string

  constructor(restaurantId: string) {
    this.restaurantId = restaurantId
    this.initializeEnhancedRealTimeSubscriptions()
  }

  // Initialize enhanced real-time subscriptions for all components
  private async initializeEnhancedRealTimeSubscriptions() {
    console.log('🎭 Initializing enhanced restaurant orchestrator subscriptions for:', this.restaurantId)

    // Clear any existing subscriptions
    this.unsubscribeFunctions.forEach(unsubscribe => unsubscribe())
    this.unsubscribeFunctions = []

    try {
      // Subscribe to booking changes using enhanced connection manager
      const unsubscribeBookings = this.connectionManager.subscribe(
        `orchestrator-bookings:${this.restaurantId}`,
        this.restaurantId,
        'bookings',
        '*',
        (payload: any) => {
          console.log('📅 Orchestrator booking change:', payload)
          this.handleBookingChange(payload)
        }
      )

      // Subscribe to order changes using enhanced connection manager
      const unsubscribeOrders = this.connectionManager.subscribe(
        `orchestrator-orders:${this.restaurantId}`,
        this.restaurantId,
        'orders',
        '*',
        (payload: any) => {
          console.log('🍽️ Orchestrator order change:', payload)
          this.handleOrderChange(payload)
        }
      )

      // Subscribe to table changes using enhanced connection manager
      const unsubscribeTables = this.connectionManager.subscribe(
        `orchestrator-tables:${this.restaurantId}`,
        this.restaurantId,
        'restaurant_tables',
        '*',
        (payload: any) => {
          console.log('🪑 Orchestrator table change:', payload)
          this.handleTablesChange(payload)
        }
      )

      this.unsubscribeFunctions.push(unsubscribeBookings, unsubscribeOrders, unsubscribeTables)

    } catch (error) {
      console.error('❌ Error initializing orchestrator subscriptions:', error)
    }
  }

  // Cleanup method for subscriptions
  destroy() {
    console.log('🧹 Cleaning up restaurant orchestrator subscriptions')
    this.unsubscribeFunctions.forEach(unsubscribe => unsubscribe())
    this.unsubscribeFunctions = []
  }

  // Get current restaurant state
  getState(): RestaurantState {
    return { ...this.state }
  }

  // Subscribe to state changes
  subscribe(listener: (state: RestaurantState) => void): () => void {
    this.listeners.push(listener)
    return () => {
      const index = this.listeners.indexOf(listener)
      if (index > -1) {
        this.listeners.splice(index, 1)
      }
    }
  }

  // Notify all listeners of state changes
  private notifyListeners() {
    this.state.lastUpdate = new Date()
    this.listeners.forEach(listener => listener(this.state))
  }

  // Handle booking changes
  private async handleBookingChange(payload: any) {
    const booking = payload.new || payload.old
    if (!booking) return

    if (payload.eventType === 'DELETE') {
      delete this.state.bookings[booking.id]
      await this.updateAffectedTables(booking.table_ids || [])
    } else {
      await this.refreshBookingState(booking.id)
    }

    this.notifyListeners()
  }

  // Handle table changes
  private async handleTablesChange(payload: any) {
    const table = payload.new || payload.old
    if (!table) return

    if (payload.eventType === 'DELETE') {
      delete this.state.tables[table.id]
    } else {
      await this.refreshTableState(table.id)
    }

    this.notifyListeners()
  }

  // Handle order changes
  private async handleOrderChange(payload: any) {
    const order = payload.new || payload.old
    if (!order) return

    if (payload.eventType === 'DELETE') {
      delete this.state.orders[order.id]
    } else {
      await this.refreshOrderState(order.id)
    }

    // Update booking state if order belongs to a booking
    if (order.booking_id) {
      await this.refreshBookingState(order.booking_id)
    }

    // Update kitchen state
    await this.refreshKitchenState()

    this.notifyListeners()
  }

  // Handle order item changes
  private async handleOrderItemChange(payload: any) {
    const orderItem = payload.new || payload.old
    if (!orderItem) return

    // Find the order this item belongs to
    const order = Object.values(this.state.orders).find(o => 
      o.items.some(item => item.id === orderItem.id)
    )

    if (order) {
      await this.refreshOrderState(order.id)
      await this.refreshKitchenState()
      this.notifyListeners()
    }
  }

  // Handle order updates from real-time service
  private handleOrderUpdate(orderUpdate: any) {
    if (this.state.orders[orderUpdate.orderId]) {
      // Update order state
      this.refreshOrderState(orderUpdate.orderId)
      this.notifyListeners()
    }
  }

  // Handle kitchen updates
  private handleKitchenUpdate(kitchenData: any) {
    // Update kitchen state with real-time data
    this.state.kitchen = {
      ...this.state.kitchen,
      ...kitchenData
    }
    this.notifyListeners()
  }

  // Refresh booking state from database
  private async refreshBookingState(bookingId: string) {
    try {
      const { data: booking, error } = await this.supabase
        .from('bookings')
        .select(`
          *,
          booking_tables(
            table:restaurant_tables(id, table_number)
          ),
          orders(
            id,
            status,
            course_type,
            estimated_completion_time
          )
        `)
        .eq('id', bookingId)
        .single()

      if (error || !booking) return

      // Calculate estimated completion
      const estimatedCompletion = this.calculateBookingCompletion(booking)

      this.state.bookings[bookingId] = {
        id: booking.id,
        guest_name: booking.guest_name,
        party_size: booking.party_size,
        status: booking.status,
        table_ids: booking.booking_tables?.map((bt: any) => bt.table.id) || [],
        orders: booking.orders?.map((o: any) => o.id) || [],
        timeline: await this.getBookingTimeline(bookingId),
        estimated_completion: estimatedCompletion
      }

      // Update affected tables
      await this.updateAffectedTables(this.state.bookings[bookingId].table_ids)

    } catch (error) {
      console.error('Error refreshing booking state:', error)
    }
  }

  // Refresh order state from database
  private async refreshOrderState(orderId: string) {
    try {
      const { data: order, error } = await this.supabase
        .from('orders')
        .select(`
          *,
          order_items(
            id,
            menu_item_id,
            status,
            estimated_prep_time,
            started_at,
            completed_at
          )
        `)
        .eq('id', orderId)
        .single()

      if (error || !order) return

      this.state.orders[orderId] = {
        id: order.id,
        booking_id: order.booking_id,
        table_id: order.table_id,
        status: order.status,
        course_type: order.course_type,
        items: order.order_items?.map((item: any) => ({
          id: item.id,
          menu_item_id: item.menu_item_id,
          status: item.status,
          estimated_prep_time: item.estimated_prep_time,
          started_at: item.started_at ? new Date(item.started_at) : undefined,
          completed_at: item.completed_at ? new Date(item.completed_at) : undefined
        })) || [],
        estimated_completion: this.calculateOrderCompletion(order),
        kitchen_station: order.kitchen_station
      }

    } catch (error) {
      console.error('Error refreshing order state:', error)
    }
  }

  // Update table states based on current bookings and orders
  private async updateAffectedTables(tableIds: string[]) {
    for (const tableId of tableIds) {
      await this.refreshTableState(tableId)
    }
  }

  // Refresh individual table state
  private async refreshTableState(tableId: string) {
    try {
      // Get table info
      const { data: table, error: tableError } = await this.supabase
        .from('restaurant_tables')
        .select('*')
        .eq('id', tableId)
        .single()

      if (tableError || !table) return

      // Find current and next bookings for this table
      const currentBooking = Object.values(this.state.bookings).find(b => 
        b.table_ids.includes(tableId) && 
        ['seated', 'ordered', 'appetizers', 'main_course', 'dessert'].includes(b.status)
      )

      const nextBooking = Object.values(this.state.bookings).find(b => 
        b.table_ids.includes(tableId) && 
        b.status === 'confirmed' &&
        b.id !== currentBooking?.id
      )

      // Determine table status
      let status: TableState['status'] = 'available'
      if (currentBooking) {
        status = 'occupied'
        
        // Check if ready for turnover
        const allOrdersCompleted = currentBooking.orders.every(orderId => {
          const order = this.state.orders[orderId]
          return order?.status === 'completed'
        })
        
        if (allOrdersCompleted) {
          status = 'needs_cleaning'
        }
      } else if (nextBooking) {
        status = 'reserved'
      }

      this.state.tables[tableId] = {
        id: table.id,
        table_number: table.table_number,
        status,
        current_booking: currentBooking?.id,
        next_booking: nextBooking?.id,
        estimated_turnover: currentBooking?.estimated_completion,
        last_updated: new Date()
      }

    } catch (error) {
      console.error('Error refreshing table state:', error)
    }
  }

  // Refresh kitchen state
  private async refreshKitchenState() {
    const activeOrders = Object.values(this.state.orders).filter(o => 
      ['confirmed', 'preparing'].includes(o.status)
    )

    this.state.kitchen = {
      active_orders: activeOrders.map(o => o.id),
      stations: {}, // TODO: Implement station tracking
      queue_depth: activeOrders.length,
      average_prep_time: this.calculateAveragePrepTime(activeOrders)
    }
  }

  // Calculate booking completion time
  private calculateBookingCompletion(booking: any): Date | undefined {
    // Implementation depends on business logic
    // For now, estimate based on orders
    return undefined
  }

  // Calculate order completion time
  private calculateOrderCompletion(order: any): Date | undefined {
    // Implementation depends on business logic
    return undefined
  }

  // Calculate average prep time
  private calculateAveragePrepTime(orders: OrderState[]): number {
    if (orders.length === 0) return 0
    
    const totalPrepTime = orders.reduce((sum, order) => {
      const orderPrepTime = order.items.reduce((itemSum, item) => 
        itemSum + (item.estimated_prep_time || 0), 0
      )
      return sum + orderPrepTime
    }, 0)

    return totalPrepTime / orders.length
  }

  // Get booking timeline
  private async getBookingTimeline(bookingId: string): Promise<BookingTimelineEvent[]> {
    const integrationService = getBookingOrderIntegrationService()
    const timeline = await integrationService.getBookingTimeline(bookingId)
    
    return timeline.map(event => ({
      timestamp: new Date(event.timestamp),
      event: event.event,
      description: event.description,
      automated: event.automated || false
    }))
  }

  // Initialize state from database
  async initialize() {
    try {
      // Load all current bookings
      const { data: bookings } = await this.supabase
        .from('bookings')
        .select('id')
        .eq('restaurant_id', this.restaurantId)
        .in('status', ['confirmed', 'seated', 'ordered', 'appetizers', 'main_course', 'dessert'])

      if (bookings) {
        for (const booking of bookings) {
          await this.refreshBookingState(booking.id)
        }
      }

      // Load all current orders
      const { data: orders } = await this.supabase
        .from('orders')
        .select('id')
        .eq('restaurant_id', this.restaurantId)
        .in('status', ['pending', 'confirmed', 'preparing', 'ready'])

      if (orders) {
        for (const order of orders) {
          await this.refreshOrderState(order.id)
        }
      }

      // Load all tables
      const { data: tables } = await this.supabase
        .from('restaurant_tables')
        .select('id')
        .eq('restaurant_id', this.restaurantId)
        .eq('is_active', true)

      if (tables) {
        for (const table of tables) {
          await this.refreshTableState(table.id)
        }
      }

      await this.refreshKitchenState()
      this.notifyListeners()

    } catch (error) {
      console.error('Error initializing restaurant orchestrator:', error)
    }
  }
}

// Singleton instance
let orchestratorInstance: RestaurantOrchestrator | null = null

export function getRestaurantOrchestrator(restaurantId: string): RestaurantOrchestrator {
  if (!orchestratorInstance || orchestratorInstance['restaurantId'] !== restaurantId) {
    orchestratorInstance = new RestaurantOrchestrator(restaurantId)
  }
  return orchestratorInstance
}

// React hook for using the orchestrator
export function useRestaurantOrchestrator(restaurantId: string) {
  const [state, setState] = useState<RestaurantState | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const orchestrator = getRestaurantOrchestrator(restaurantId)
    
    // Subscribe to state changes
    const unsubscribe = orchestrator.subscribe((newState) => {
      setState(newState)
      setIsLoading(false)
    })

    // Initialize if needed
    orchestrator.initialize()

    return unsubscribe
  }, [restaurantId])

  return {
    state,
    isLoading,
    orchestrator: orchestratorInstance
  }
}
