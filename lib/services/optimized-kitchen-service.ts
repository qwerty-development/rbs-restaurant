// lib/services/optimized-kitchen-service.ts
// Optimized kitchen service with caching and performance improvements

import { createClient } from '@/lib/supabase/client'
import { getCacheService, CacheKeys, CacheTTL } from './cache-service'

interface KitchenOrder {
  id: string
  order_number: string
  status: string
  priority_level: number
  course_type: string
  created_at: string
  updated_at: string
  table_number?: string
  table_type?: string
  guest_name?: string
  party_size?: number
  booking_time?: string
  order_items: KitchenOrderItem[]
  timing?: {
    elapsed_minutes: number
    estimated_completion: Date
    is_overdue: boolean
    max_prep_time: number
  }
}

interface KitchenOrderItem {
  id: string
  quantity: number
  status: string
  special_instructions?: string
  estimated_prep_time?: number
  menu_item: {
    id: string
    name: string
    description?: string
    preparation_time?: number
    dietary_tags?: string[]
    allergens?: string[]
    category?: {
      id: string
      name: string
    }
  }
  order_modifications: any[]
  kitchen_assignments: any[]
}

interface KitchenSummary {
  total: number
  confirmed: number
  preparing: number
  ready: number
  overdue: number
}

export class OptimizedKitchenService {
  private supabase = createClient()
  private cache = getCacheService()

  // Get kitchen orders with caching and optimization
  async getKitchenOrders(
    restaurantId: string,
    options: {
      status?: string
      courseType?: string
      priority?: string
      stationId?: string
      useCache?: boolean
    } = {}
  ): Promise<{ orders: KitchenOrder[]; summary: KitchenSummary }> {
    const { status = 'active', courseType, priority, stationId, useCache = true } = options

    // Generate cache key
    const cacheKey = `${CacheKeys.kitchenOrders(restaurantId, status)}:${courseType || 'all'}:${priority || 'all'}:${stationId || 'all'}`

    // Try cache first
    if (useCache) {
      const cached = await this.cache.get<{ orders: KitchenOrder[]; summary: KitchenSummary }>(cacheKey)
      if (cached) {
        return cached
      }
    }

    try {
      // Optimized query - fetch only essential data first
      let baseQuery = this.supabase
        .from('orders')
        .select(`
          id,
          order_number,
          status,
          priority_level,
          course_type,
          created_at,
          updated_at,
          booking_id,
          table_id
        `)
        .eq('restaurant_id', restaurantId)
        .order('priority_level', { ascending: false })
        .order('created_at', { ascending: true })

      // Apply filters
      if (status === 'active') {
        baseQuery = baseQuery.in('status', ['confirmed', 'preparing', 'ready'])
      } else if (status !== 'all') {
        baseQuery = baseQuery.eq('status', status)
      }

      if (courseType) {
        baseQuery = baseQuery.eq('course_type', courseType)
      }

      if (priority) {
        baseQuery = baseQuery.eq('priority_level', parseInt(priority))
      }

      const { data: orders, error } = await baseQuery

      if (error) {
        throw new Error(`Failed to fetch orders: ${error.message}`)
      }

      if (!orders || orders.length === 0) {
        const emptyResult = { orders: [], summary: { total: 0, confirmed: 0, preparing: 0, ready: 0, overdue: 0 } }
        await this.cache.set(cacheKey, emptyResult, CacheTTL.KITCHEN_ORDERS)
        return emptyResult
      }

      // Fetch related data in parallel with caching
      const [bookingData, tableData, orderItemsData] = await Promise.all([
        this.getBookingData(orders.map(o => o.booking_id).filter(Boolean)),
        this.getTableData(orders.map(o => o.table_id).filter(Boolean)),
        this.getOrderItemsData(orders.map(o => o.id))
      ])

      // Combine data efficiently
      const enrichedOrders: KitchenOrder[] = orders.map(order => {
        const booking = bookingData.get(order.booking_id)
        const table = tableData.get(order.table_id)
        const items = orderItemsData.get(order.id) || []

        return {
          ...order,
          table_number: table?.table_number,
          table_type: table?.table_type,
          guest_name: booking?.guest_name,
          party_size: booking?.party_size,
          booking_time: booking?.booking_time,
          order_items: items,
          timing: this.calculateTiming(order, items)
        }
      })

      // Filter by station if specified
      const filteredOrders = stationId && stationId !== 'all' 
        ? enrichedOrders.filter(order => 
            order.order_items.some(item => 
              item.kitchen_assignments.some((assignment: any) => 
                assignment.station_id === stationId
              )
            )
          )
        : enrichedOrders

      // Calculate summary
      const summary: KitchenSummary = {
        total: filteredOrders.length,
        confirmed: filteredOrders.filter(o => o.status === 'confirmed').length,
        preparing: filteredOrders.filter(o => o.status === 'preparing').length,
        ready: filteredOrders.filter(o => o.status === 'ready').length,
        overdue: filteredOrders.filter(o => o.timing?.is_overdue).length
      }

      const result = { orders: filteredOrders, summary }

      // Cache the result
      await this.cache.set(cacheKey, result, CacheTTL.KITCHEN_ORDERS)

      return result

    } catch (error) {
      console.error('Error fetching kitchen orders:', error)
      throw error
    }
  }

  // Get booking data with caching
  private async getBookingData(bookingIds: string[]): Promise<Map<string, any>> {
    if (bookingIds.length === 0) return new Map()

    const bookingMap = new Map()
    const uncachedIds: string[] = []

    // Check cache for each booking
    for (const id of bookingIds) {
      const cached = await this.cache.get(`booking:${id}`)
      if (cached) {
        bookingMap.set(id, cached)
      } else {
        uncachedIds.push(id)
      }
    }

    // Fetch uncached bookings
    if (uncachedIds.length > 0) {
      const { data: bookings } = await this.supabase
        .from('bookings')
        .select(`
          id,
          guest_name,
          party_size,
          booking_time,
          profiles!bookings_user_id_fkey(
            id,
            full_name
          )
        `)
        .in('id', uncachedIds)

      if (bookings) {
        for (const booking of bookings) {
          bookingMap.set(booking.id, booking)
          // Cache individual booking
          await this.cache.set(`booking:${booking.id}`, booking, 300) // 5 minutes
        }
      }
    }

    return bookingMap
  }

  // Get table data with caching
  private async getTableData(tableIds: string[]): Promise<Map<string, any>> {
    if (tableIds.length === 0) return new Map()

    const tableMap = new Map()
    const uncachedIds: string[] = []

    // Check cache for each table
    for (const id of tableIds) {
      const cached = await this.cache.get(`table:${id}`)
      if (cached) {
        tableMap.set(id, cached)
      } else {
        uncachedIds.push(id)
      }
    }

    // Fetch uncached tables
    if (uncachedIds.length > 0) {
      const { data: tables } = await this.supabase
        .from('restaurant_tables')
        .select('id, table_number, table_type')
        .in('id', uncachedIds)

      if (tables) {
        for (const table of tables) {
          tableMap.set(table.id, table)
          // Cache individual table
          await this.cache.set(`table:${table.id}`, table, 1800) // 30 minutes
        }
      }
    }

    return tableMap
  }

  // Get order items data with caching
  private async getOrderItemsData(orderIds: string[]): Promise<Map<string, KitchenOrderItem[]>> {
    if (orderIds.length === 0) return new Map()

    const { data: orderItems } = await this.supabase
      .from('order_items')
      .select(`
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
      `)
      .in('order_id', orderIds)

    const itemsMap = new Map<string, KitchenOrderItem[]>()
    
    if (orderItems) {
      for (const item of orderItems) {
        const orderId = item.order_id
        if (!itemsMap.has(orderId)) {
          itemsMap.set(orderId, [])
        }
        itemsMap.get(orderId)!.push(item)
      }
    }

    return itemsMap
  }

  // Calculate timing information
  private calculateTiming(order: any, items: KitchenOrderItem[]): {
    elapsed_minutes: number
    estimated_completion: Date
    is_overdue: boolean
    max_prep_time: number
  } {
    const now = new Date()
    const createdAt = new Date(order.created_at)
    const elapsedMinutes = Math.floor((now.getTime() - createdAt.getTime()) / 60000)
    
    const maxPrepTime = Math.max(
      ...items.map(item => item.estimated_prep_time || item.menu_item?.preparation_time || 0)
    )
    
    const estimatedCompletion = new Date(createdAt.getTime() + maxPrepTime * 60000)
    const isOverdue = now > estimatedCompletion && order.status !== 'ready'

    return {
      elapsed_minutes: elapsedMinutes,
      estimated_completion: estimatedCompletion,
      is_overdue: isOverdue,
      max_prep_time: maxPrepTime
    }
  }

  // Invalidate cache when orders change
  async invalidateOrderCache(restaurantId: string, orderId?: string): Promise<void> {
    const patterns = [
      `${CacheKeys.kitchenOrders(restaurantId)}*`,
      `${CacheKeys.activeBookings(restaurantId)}`,
    ]

    if (orderId) {
      patterns.push(`order:${orderId}*`)
    }

    for (const pattern of patterns) {
      await this.cache.delPattern(pattern)
    }
  }

  // Get kitchen stations with caching
  async getKitchenStations(restaurantId: string): Promise<any[]> {
    const cacheKey = CacheKeys.kitchenStations(restaurantId)
    
    const cached = await this.cache.get<any[]>(cacheKey)
    if (cached) {
      return cached
    }

    const { data: stations, error } = await this.supabase
      .from('kitchen_stations')
      .select(`
        id,
        name,
        station_type,
        display_order,
        is_active
      `)
      .eq('restaurant_id', restaurantId)
      .eq('is_active', true)
      .order('display_order')

    if (error) {
      throw new Error(`Failed to fetch kitchen stations: ${error.message}`)
    }

    const result = stations || []
    await this.cache.set(cacheKey, result, CacheTTL.STATIONS)
    
    return result
  }
}

// Singleton instance
let optimizedKitchenServiceInstance: OptimizedKitchenService | null = null

export function getOptimizedKitchenService(): OptimizedKitchenService {
  if (!optimizedKitchenServiceInstance) {
    optimizedKitchenServiceInstance = new OptimizedKitchenService()
  }
  return optimizedKitchenServiceInstance
}
