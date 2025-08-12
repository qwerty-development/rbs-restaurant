// lib/services/cache-service.ts
// Redis caching service for restaurant management system performance optimization

import Redis from 'ioredis'

interface CacheConfig {
  host: string
  port: number
  password?: string
  db?: number
  retryDelayOnFailover?: number
  maxRetriesPerRequest?: number
}

interface CacheItem<T = any> {
  data: T
  timestamp: number
  ttl: number
}

export class CacheService {
  private redis: Redis | null = null
  private fallbackCache = new Map<string, CacheItem>()
  private isConnected = false
  private connectionAttempts = 0
  private maxConnectionAttempts = 3

  constructor(private config?: CacheConfig) {
    this.initializeRedis()
  }

  private async initializeRedis() {
    try {
      // Check if we're using Upstash Redis (production) or local Redis (development)
      const isUpstash = process.env.REDIS_HOST?.includes('upstash.io')

      let redisConfig: any

      if (isUpstash) {
        // Upstash Redis configuration (production)
        redisConfig = {
          host: process.env.REDIS_HOST,
          port: parseInt(process.env.REDIS_PORT || '6379'),
          password: process.env.REDIS_PASSWORD,
          db: parseInt(process.env.REDIS_DB || '0'),
          tls: {}, // Upstash requires TLS
          retryDelayOnFailover: 100,
          maxRetriesPerRequest: 3,
          connectTimeout: 10000, // Longer timeout for cloud Redis
          commandTimeout: 5000,
          lazyConnect: true
        }
      } else {
        // Local Redis configuration (development)
        redisConfig = this.config || {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379'),
          password: process.env.REDIS_PASSWORD,
          db: parseInt(process.env.REDIS_DB || '0'),
          retryDelayOnFailover: 100,
          maxRetriesPerRequest: 3,
          connectTimeout: 5000,
          commandTimeout: 3000,
          lazyConnect: true
        }
      }

      this.redis = new Redis(redisConfig)

      this.redis.on('connect', () => {
        console.log('Redis connected successfully')
        this.isConnected = true
        this.connectionAttempts = 0
      })

      this.redis.on('error', (error) => {
        // Only log Redis errors in development if explicitly enabled
        if (process.env.NODE_ENV === 'development' && process.env.LOG_REDIS_ERRORS === 'true') {
          console.warn('Redis connection error, falling back to memory cache:', error.message)
        }
        this.isConnected = false
        this.connectionAttempts++
      })

      this.redis.on('close', () => {
        // Only log Redis connection close in development if explicitly enabled
        if (process.env.NODE_ENV === 'development' && process.env.LOG_REDIS_ERRORS === 'true') {
          console.log('Redis connection closed')
        }
        this.isConnected = false
      })

      // Test connection
      await this.redis.connect()
      await this.redis.ping()

    } catch (error) {
      // Only log Redis initialization errors in development if explicitly enabled
      if (process.env.NODE_ENV === 'development' && process.env.LOG_REDIS_ERRORS === 'true') {
        console.warn('Failed to initialize Redis, using memory cache fallback:', error)
      }
      this.isConnected = false
      this.redis = null
    }
  }

  // Get cached data with fallback to memory cache
  async get<T>(key: string): Promise<T | null> {
    try {
      if (this.isConnected && this.redis) {
        const cached = await this.redis.get(key)
        if (cached) {
          const parsed: CacheItem<T> = JSON.parse(cached)
          
          // Check if expired
          if (Date.now() - parsed.timestamp > parsed.ttl * 1000) {
            await this.redis.del(key)
            return null
          }
          
          return parsed.data
        }
      }
      
      // Fallback to memory cache
      return this.getFromMemoryCache<T>(key)
      
    } catch (error) {
      // Only log cache errors in development if explicitly enabled
      if (process.env.NODE_ENV === 'development' && process.env.LOG_REDIS_ERRORS === 'true') {
        console.warn('Cache get error, falling back to memory cache:', error)
      }
      return this.getFromMemoryCache<T>(key)
    }
  }

  // Set cached data with TTL
  async set<T>(key: string, data: T, ttlSeconds: number = 300): Promise<void> {
    const cacheItem: CacheItem<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttlSeconds
    }

    try {
      if (this.isConnected && this.redis) {
        await this.redis.setex(key, ttlSeconds, JSON.stringify(cacheItem))
      }
      
      // Always store in memory cache as fallback
      this.setInMemoryCache(key, cacheItem)
      
    } catch (error) {
      // Only log cache errors in development if explicitly enabled
      if (process.env.NODE_ENV === 'development' && process.env.LOG_REDIS_ERRORS === 'true') {
        console.warn('Cache set error, using memory cache only:', error)
      }
      this.setInMemoryCache(key, cacheItem)
    }
  }

  // Delete cached data
  async del(key: string): Promise<void> {
    try {
      if (this.isConnected && this.redis) {
        await this.redis.del(key)
      }
      this.fallbackCache.delete(key)
    } catch (error) {
      console.warn('Cache delete error:', error)
      this.fallbackCache.delete(key)
    }
  }

  // Delete multiple keys by pattern
  async delPattern(pattern: string): Promise<void> {
    try {
      if (this.isConnected && this.redis) {
        const keys = await this.redis.keys(pattern)
        if (keys.length > 0) {
          await this.redis.del(...keys)
        }
      }
      
      // Clear matching keys from memory cache
      for (const key of this.fallbackCache.keys()) {
        if (this.matchesPattern(key, pattern)) {
          this.fallbackCache.delete(key)
        }
      }
    } catch (error) {
      console.warn('Cache pattern delete error:', error)
    }
  }

  // Memory cache fallback methods
  private getFromMemoryCache<T>(key: string): T | null {
    const cached = this.fallbackCache.get(key)
    if (cached) {
      // Check if expired
      if (Date.now() - cached.timestamp > cached.ttl * 1000) {
        this.fallbackCache.delete(key)
        return null
      }
      return cached.data as T
    }
    return null
  }

  private setInMemoryCache<T>(key: string, cacheItem: CacheItem<T>): void {
    this.fallbackCache.set(key, cacheItem)
    
    // Clean up expired entries periodically
    if (this.fallbackCache.size > 1000) {
      this.cleanupMemoryCache()
    }
  }

  private cleanupMemoryCache(): void {
    const now = Date.now()
    for (const [key, item] of this.fallbackCache.entries()) {
      if (now - item.timestamp > item.ttl * 1000) {
        this.fallbackCache.delete(key)
      }
    }
  }

  private matchesPattern(key: string, pattern: string): boolean {
    // Simple pattern matching for memory cache
    const regex = new RegExp(pattern.replace(/\*/g, '.*'))
    return regex.test(key)
  }

  // Health check
  async isHealthy(): Promise<boolean> {
    try {
      if (this.isConnected && this.redis) {
        await this.redis.ping()
        return true
      }
      return false
    } catch {
      return false
    }
  }

  // Get cache statistics
  async getStats(): Promise<{
    redisConnected: boolean
    memoryKeys: number
    connectionAttempts: number
  }> {
    return {
      redisConnected: this.isConnected,
      memoryKeys: this.fallbackCache.size,
      connectionAttempts: this.connectionAttempts
    }
  }

  // Graceful shutdown
  async disconnect(): Promise<void> {
    if (this.redis) {
      await this.redis.quit()
      this.redis = null
    }
    this.fallbackCache.clear()
    this.isConnected = false
  }
}

// Singleton instance
let cacheServiceInstance: CacheService | null = null

export function getCacheService(): CacheService {
  if (!cacheServiceInstance) {
    cacheServiceInstance = new CacheService()
  }
  return cacheServiceInstance
}

// Cache key generators for consistent naming
export const CacheKeys = {
  // Restaurant data
  restaurant: (id: string) => `restaurant:${id}`,
  restaurantSettings: (id: string) => `restaurant:${id}:settings`,
  
  // Menu data
  menuItems: (restaurantId: string) => `menu:${restaurantId}:items`,
  menuCategories: (restaurantId: string) => `menu:${restaurantId}:categories`,
  
  // Kitchen data
  kitchenOrders: (restaurantId: string, status?: string) => 
    `kitchen:${restaurantId}:orders${status ? `:${status}` : ''}`,
  kitchenStations: (restaurantId: string) => `kitchen:${restaurantId}:stations`,
  
  // Table data
  tables: (restaurantId: string) => `tables:${restaurantId}`,
  tableStatus: (tableId: string) => `table:${tableId}:status`,
  
  // Booking data
  activeBookings: (restaurantId: string) => `bookings:${restaurantId}:active`,
  
  // Waitlist data
  waitlist: (restaurantId: string) => `waitlist:${restaurantId}`,
  
  // Analytics cache
  analytics: (restaurantId: string, type: string, period: string) => 
    `analytics:${restaurantId}:${type}:${period}`,
}

// Cache TTL constants (in seconds)
export const CacheTTL = {
  MENU_ITEMS: 3600,        // 1 hour - menu changes infrequently
  RESTAURANT_SETTINGS: 1800, // 30 minutes - settings change occasionally
  KITCHEN_ORDERS: 30,       // 30 seconds - orders change frequently
  TABLE_STATUS: 60,         // 1 minute - table status changes moderately
  ANALYTICS: 900,           // 15 minutes - analytics can be slightly stale
  WAITLIST: 60,            // 1 minute - waitlist changes moderately
  STATIONS: 1800,          // 30 minutes - stations rarely change
}
