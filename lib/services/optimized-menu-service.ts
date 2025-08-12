// lib/services/optimized-menu-service.ts
// Optimized menu service with caching for performance

import { createClient } from '@/lib/supabase/client'
import { getCacheService, CacheKeys, CacheTTL } from './cache-service'

interface MenuItem {
  id: string
  name: string
  description?: string
  price: number
  image_url?: string
  is_available: boolean
  preparation_time?: number
  dietary_tags?: string[]
  allergens?: string[]
  category_id: string
  category?: MenuCategory
}

interface MenuCategory {
  id: string
  name: string
  description?: string
  display_order: number
  is_active: boolean
}

interface MenuData {
  categories: MenuCategory[]
  items: MenuItem[]
  lastUpdated: string
}

export class OptimizedMenuService {
  private supabase = createClient()
  private cache = getCacheService()

  // Get complete menu data with caching
  async getMenuData(restaurantId: string, useCache: boolean = true): Promise<MenuData> {
    const cacheKey = CacheKeys.menuItems(restaurantId)

    // Try cache first
    if (useCache) {
      const cached = await this.cache.get<MenuData>(cacheKey)
      if (cached) {
        return cached
      }
    }

    try {
      // Fetch categories and items in parallel
      const [categoriesResult, itemsResult] = await Promise.all([
        this.getMenuCategories(restaurantId, false), // Don't use cache for sub-queries
        this.getMenuItems(restaurantId, false)
      ])

      const menuData: MenuData = {
        categories: categoriesResult,
        items: itemsResult,
        lastUpdated: new Date().toISOString()
      }

      // Cache the complete menu data
      await this.cache.set(cacheKey, menuData, CacheTTL.MENU_ITEMS)

      return menuData

    } catch (error) {
      console.error('Error fetching menu data:', error)
      throw new Error('Failed to fetch menu data')
    }
  }

  // Get menu categories with caching
  async getMenuCategories(restaurantId: string, useCache: boolean = true): Promise<MenuCategory[]> {
    const cacheKey = CacheKeys.menuCategories(restaurantId)

    if (useCache) {
      const cached = await this.cache.get<MenuCategory[]>(cacheKey)
      if (cached) {
        return cached
      }
    }

    const { data: categories, error } = await this.supabase
      .from('menu_categories')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('is_active', true)
      .order('display_order')

    if (error) {
      throw new Error(`Failed to fetch menu categories: ${error.message}`)
    }

    const result = categories || []
    await this.cache.set(cacheKey, result, CacheTTL.MENU_ITEMS)

    return result
  }

  // Get menu items with caching
  async getMenuItems(restaurantId: string, useCache: boolean = true): Promise<MenuItem[]> {
    const cacheKey = `${CacheKeys.menuItems(restaurantId)}:items`

    if (useCache) {
      const cached = await this.cache.get<MenuItem[]>(cacheKey)
      if (cached) {
        return cached
      }
    }

    const { data: items, error } = await this.supabase
      .from('menu_items')
      .select(`
        *,
        category:menu_categories!menu_items_category_id_fkey(
          id,
          name,
          display_order
        )
      `)
      .eq('restaurant_id', restaurantId)
      .eq('is_available', true)
      .order('name')

    if (error) {
      throw new Error(`Failed to fetch menu items: ${error.message}`)
    }

    const result = items || []
    await this.cache.set(cacheKey, result, CacheTTL.MENU_ITEMS)

    return result
  }

  // Get menu items by category with caching
  async getMenuItemsByCategory(
    restaurantId: string, 
    categoryId: string, 
    useCache: boolean = true
  ): Promise<MenuItem[]> {
    const cacheKey = `${CacheKeys.menuItems(restaurantId)}:category:${categoryId}`

    if (useCache) {
      const cached = await this.cache.get<MenuItem[]>(cacheKey)
      if (cached) {
        return cached
      }
    }

    const { data: items, error } = await this.supabase
      .from('menu_items')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('category_id', categoryId)
      .eq('is_available', true)
      .order('name')

    if (error) {
      throw new Error(`Failed to fetch menu items by category: ${error.message}`)
    }

    const result = items || []
    await this.cache.set(cacheKey, result, CacheTTL.MENU_ITEMS)

    return result
  }

  // Get single menu item with caching
  async getMenuItem(itemId: string, useCache: boolean = true): Promise<MenuItem | null> {
    const cacheKey = `menu_item:${itemId}`

    if (useCache) {
      const cached = await this.cache.get<MenuItem>(cacheKey)
      if (cached) {
        return cached
      }
    }

    const { data: item, error } = await this.supabase
      .from('menu_items')
      .select(`
        *,
        category:menu_categories!menu_items_category_id_fkey(
          id,
          name,
          display_order
        )
      `)
      .eq('id', itemId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null // Item not found
      }
      throw new Error(`Failed to fetch menu item: ${error.message}`)
    }

    await this.cache.set(cacheKey, item, CacheTTL.MENU_ITEMS)

    return item
  }

  // Search menu items with caching
  async searchMenuItems(
    restaurantId: string, 
    query: string, 
    useCache: boolean = true
  ): Promise<MenuItem[]> {
    const normalizedQuery = query.toLowerCase().trim()
    const cacheKey = `${CacheKeys.menuItems(restaurantId)}:search:${normalizedQuery}`

    if (useCache && normalizedQuery.length >= 3) {
      const cached = await this.cache.get<MenuItem[]>(cacheKey)
      if (cached) {
        return cached
      }
    }

    const { data: items, error } = await this.supabase
      .from('menu_items')
      .select(`
        *,
        category:menu_categories!menu_items_category_id_fkey(
          id,
          name
        )
      `)
      .eq('restaurant_id', restaurantId)
      .eq('is_available', true)
      .or(`name.ilike.%${normalizedQuery}%,description.ilike.%${normalizedQuery}%`)
      .order('name')
      .limit(20)

    if (error) {
      throw new Error(`Failed to search menu items: ${error.message}`)
    }

    const result = items || []
    
    // Only cache searches with 3+ characters
    if (normalizedQuery.length >= 3) {
      await this.cache.set(cacheKey, result, 300) // 5 minutes for search results
    }

    return result
  }

  // Get menu items with dietary filters
  async getMenuItemsByDietaryTags(
    restaurantId: string,
    dietaryTags: string[],
    useCache: boolean = true
  ): Promise<MenuItem[]> {
    const sortedTags = dietaryTags.sort().join(',')
    const cacheKey = `${CacheKeys.menuItems(restaurantId)}:dietary:${sortedTags}`

    if (useCache) {
      const cached = await this.cache.get<MenuItem[]>(cacheKey)
      if (cached) {
        return cached
      }
    }

    const { data: items, error } = await this.supabase
      .from('menu_items')
      .select(`
        *,
        category:menu_categories!menu_items_category_id_fkey(
          id,
          name
        )
      `)
      .eq('restaurant_id', restaurantId)
      .eq('is_available', true)
      .contains('dietary_tags', dietaryTags)
      .order('name')

    if (error) {
      throw new Error(`Failed to fetch menu items by dietary tags: ${error.message}`)
    }

    const result = items || []
    await this.cache.set(cacheKey, result, CacheTTL.MENU_ITEMS)

    return result
  }

  // Invalidate menu cache when items change
  async invalidateMenuCache(restaurantId: string, itemId?: string): Promise<void> {
    const patterns = [
      CacheKeys.menuItems(restaurantId),
      CacheKeys.menuCategories(restaurantId),
      `${CacheKeys.menuItems(restaurantId)}:*`
    ]

    if (itemId) {
      patterns.push(`menu_item:${itemId}`)
    }

    for (const pattern of patterns) {
      await this.cache.delPattern(pattern)
    }
  }

  // Preload menu data for better performance
  async preloadMenuData(restaurantId: string): Promise<void> {
    try {
      // Preload complete menu data
      await this.getMenuData(restaurantId, false)
      
      // Preload categories
      await this.getMenuCategories(restaurantId, false)
      
      console.log(`Menu data preloaded for restaurant ${restaurantId}`)
    } catch (error) {
      console.error('Failed to preload menu data:', error)
    }
  }

  // Get menu statistics for analytics
  async getMenuStats(restaurantId: string): Promise<{
    totalItems: number
    totalCategories: number
    availableItems: number
    unavailableItems: number
    averagePrice: number
  }> {
    const cacheKey = `${CacheKeys.menuItems(restaurantId)}:stats`
    
    const cached = await this.cache.get<any>(cacheKey)
    if (cached) {
      return cached
    }

    const [itemsResult, categoriesResult] = await Promise.all([
      this.supabase
        .from('menu_items')
        .select('price, is_available')
        .eq('restaurant_id', restaurantId),
      
      this.supabase
        .from('menu_categories')
        .select('id', { count: 'exact' })
        .eq('restaurant_id', restaurantId)
        .eq('is_active', true)
    ])

    const items = itemsResult.data || []
    const availableItems = items.filter(item => item.is_available)
    const totalPrice = availableItems.reduce((sum, item) => sum + (item.price || 0), 0)

    const stats = {
      totalItems: items.length,
      totalCategories: categoriesResult.count || 0,
      availableItems: availableItems.length,
      unavailableItems: items.length - availableItems.length,
      averagePrice: availableItems.length > 0 ? totalPrice / availableItems.length : 0
    }

    await this.cache.set(cacheKey, stats, 3600) // Cache for 1 hour

    return stats
  }
}

// Singleton instance
let optimizedMenuServiceInstance: OptimizedMenuService | null = null

export function getOptimizedMenuService(): OptimizedMenuService {
  if (!optimizedMenuServiceInstance) {
    optimizedMenuServiceInstance = new OptimizedMenuService()
  }
  return optimizedMenuServiceInstance
}
