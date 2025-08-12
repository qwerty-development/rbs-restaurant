// lib/services/performance-monitor.ts
// Performance monitoring service for restaurant management system

import { getCacheService } from './cache-service'

interface PerformanceMetric {
  name: string
  value: number
  timestamp: number
  tags?: Record<string, string>
}

interface QueryPerformance {
  query: string
  duration: number
  timestamp: number
  success: boolean
  error?: string
}

interface SystemHealth {
  database: {
    connected: boolean
    responseTime: number
    activeConnections?: number
  }
  cache: {
    connected: boolean
    hitRate: number
    memoryUsage: number
  }
  api: {
    averageResponseTime: number
    errorRate: number
    requestsPerMinute: number
  }
  memory: {
    used: number
    total: number
    percentage: number
  }
}

export class PerformanceMonitor {
  private cache = getCacheService()
  private metrics: PerformanceMetric[] = []
  private queryMetrics: QueryPerformance[] = []
  private maxMetrics = 1000
  private isEnabled = process.env.ENABLE_PERFORMANCE_MONITORING === 'true'

  // Record a performance metric
  recordMetric(name: string, value: number, tags?: Record<string, string>): void {
    if (!this.isEnabled) return

    const metric: PerformanceMetric = {
      name,
      value,
      timestamp: Date.now(),
      tags
    }

    this.metrics.push(metric)

    // Keep only recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics)
    }

    // Log critical performance issues
    this.checkPerformanceThresholds(metric)
  }

  // Record query performance
  recordQuery(query: string, duration: number, success: boolean, error?: string): void {
    if (!this.isEnabled) return

    const queryMetric: QueryPerformance = {
      query: this.sanitizeQuery(query),
      duration,
      timestamp: Date.now(),
      success,
      error
    }

    this.queryMetrics.push(queryMetric)

    // Keep only recent query metrics
    if (this.queryMetrics.length > this.maxMetrics) {
      this.queryMetrics = this.queryMetrics.slice(-this.maxMetrics)
    }

    // Log slow queries
    if (duration > 1000) {
      console.warn(`🐌 Slow query detected (${duration}ms):`, this.sanitizeQuery(query))
    }
  }

  // Measure function execution time
  async measureAsync<T>(
    name: string,
    fn: () => Promise<T>,
    tags?: Record<string, string>
  ): Promise<T> {
    const startTime = performance.now()
    let success = true
    let error: string | undefined

    try {
      const result = await fn()
      return result
    } catch (err) {
      success = false
      error = err instanceof Error ? err.message : 'Unknown error'
      throw err
    } finally {
      const duration = performance.now() - startTime
      this.recordMetric(name, duration, { ...tags, success: success.toString() })
      
      if (name.includes('query') || name.includes('database')) {
        this.recordQuery(name, duration, success, error)
      }
    }
  }

  // Measure synchronous function execution time
  measure<T>(name: string, fn: () => T, tags?: Record<string, string>): T {
    const startTime = performance.now()
    let success = true

    try {
      const result = fn()
      return result
    } catch (err) {
      success = false
      throw err
    } finally {
      const duration = performance.now() - startTime
      this.recordMetric(name, duration, { ...tags, success: success.toString() })
    }
  }

  // Get performance statistics
  getStats(timeWindow: number = 300000): {
    metrics: Record<string, { avg: number; min: number; max: number; count: number }>
    queries: {
      slowest: QueryPerformance[]
      errorRate: number
      averageTime: number
    }
  } {
    const cutoff = Date.now() - timeWindow
    const recentMetrics = this.metrics.filter(m => m.timestamp > cutoff)
    const recentQueries = this.queryMetrics.filter(q => q.timestamp > cutoff)

    // Aggregate metrics by name
    const metricStats: Record<string, { avg: number; min: number; max: number; count: number }> = {}
    
    for (const metric of recentMetrics) {
      if (!metricStats[metric.name]) {
        metricStats[metric.name] = { avg: 0, min: Infinity, max: 0, count: 0 }
      }
      
      const stats = metricStats[metric.name]
      stats.min = Math.min(stats.min, metric.value)
      stats.max = Math.max(stats.max, metric.value)
      stats.count++
    }

    // Calculate averages
    for (const name in metricStats) {
      const values = recentMetrics.filter(m => m.name === name).map(m => m.value)
      metricStats[name].avg = values.reduce((sum, val) => sum + val, 0) / values.length
    }

    // Query statistics
    const errorQueries = recentQueries.filter(q => !q.success)
    const successQueries = recentQueries.filter(q => q.success)
    const slowestQueries = [...recentQueries]
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10)

    return {
      metrics: metricStats,
      queries: {
        slowest: slowestQueries,
        errorRate: recentQueries.length > 0 ? errorQueries.length / recentQueries.length : 0,
        averageTime: successQueries.length > 0 
          ? successQueries.reduce((sum, q) => sum + q.duration, 0) / successQueries.length 
          : 0
      }
    }
  }

  // Get system health status
  async getSystemHealth(): Promise<SystemHealth> {
    const health: SystemHealth = {
      database: {
        connected: false,
        responseTime: 0
      },
      cache: {
        connected: false,
        hitRate: 0,
        memoryUsage: 0
      },
      api: {
        averageResponseTime: 0,
        errorRate: 0,
        requestsPerMinute: 0
      },
      memory: {
        used: 0,
        total: 0,
        percentage: 0
      }
    }

    try {
      // Check cache health
      const cacheHealthy = await this.cache.isHealthy()
      const cacheStats = await this.cache.getStats()
      
      health.cache = {
        connected: cacheHealthy,
        hitRate: 0.85, // This would need to be tracked separately
        memoryUsage: cacheStats.memoryKeys
      }

      // Get memory usage (Node.js)
      if (typeof process !== 'undefined' && process.memoryUsage) {
        const memUsage = process.memoryUsage()
        health.memory = {
          used: memUsage.heapUsed,
          total: memUsage.heapTotal,
          percentage: (memUsage.heapUsed / memUsage.heapTotal) * 100
        }
      }

      // Calculate API metrics from recent data
      const stats = this.getStats(300000) // Last 5 minutes
      const apiMetrics = stats.metrics['api_request'] || { avg: 0, count: 0 }
      
      health.api = {
        averageResponseTime: apiMetrics.avg,
        errorRate: stats.queries.errorRate,
        requestsPerMinute: apiMetrics.count / 5 // 5 minute window
      }

    } catch (error) {
      console.error('Error getting system health:', error)
    }

    return health
  }

  // Check performance thresholds and alert
  private checkPerformanceThresholds(metric: PerformanceMetric): void {
    const thresholds = {
      'api_request': 1000, // 1 second
      'database_query': 500, // 500ms
      'cache_operation': 50, // 50ms
      'kitchen_orders_fetch': 200, // 200ms
    }

    const threshold = thresholds[metric.name as keyof typeof thresholds]
    if (threshold && metric.value > threshold) {
      console.warn(`⚠️  Performance threshold exceeded: ${metric.name} took ${metric.value}ms (threshold: ${threshold}ms)`)
    }
  }

  // Sanitize query for logging (remove sensitive data)
  private sanitizeQuery(query: string): string {
    return query
      .replace(/password\s*=\s*'[^']*'/gi, "password='***'")
      .replace(/token\s*=\s*'[^']*'/gi, "token='***'")
      .substring(0, 200) // Limit length
  }

  // Start performance monitoring
  startMonitoring(): void {
    if (!this.isEnabled) {
      console.log('Performance monitoring is disabled')
      return
    }

    console.log('🔍 Performance monitoring started')

    // Monitor memory usage periodically
    setInterval(() => {
      if (typeof process !== 'undefined' && process.memoryUsage) {
        const memUsage = process.memoryUsage()
        this.recordMetric('memory_heap_used', memUsage.heapUsed)
        this.recordMetric('memory_heap_total', memUsage.heapTotal)
        this.recordMetric('memory_external', memUsage.external)
      }
    }, 30000) // Every 30 seconds

    // Log performance summary periodically
    setInterval(() => {
      const stats = this.getStats()
      console.log('📊 Performance Summary:', {
        totalMetrics: Object.keys(stats.metrics).length,
        averageApiTime: stats.queries.averageTime.toFixed(2) + 'ms',
        errorRate: (stats.queries.errorRate * 100).toFixed(2) + '%'
      })
    }, 300000) // Every 5 minutes
  }

  // Export metrics for external monitoring systems
  exportMetrics(): {
    metrics: PerformanceMetric[]
    queries: QueryPerformance[]
    timestamp: number
  } {
    return {
      metrics: [...this.metrics],
      queries: [...this.queryMetrics],
      timestamp: Date.now()
    }
  }

  // Clear old metrics
  clearOldMetrics(olderThan: number = 3600000): void {
    const cutoff = Date.now() - olderThan
    this.metrics = this.metrics.filter(m => m.timestamp > cutoff)
    this.queryMetrics = this.queryMetrics.filter(q => q.timestamp > cutoff)
  }
}

// Singleton instance
let performanceMonitorInstance: PerformanceMonitor | null = null

export function getPerformanceMonitor(): PerformanceMonitor {
  if (!performanceMonitorInstance) {
    performanceMonitorInstance = new PerformanceMonitor()
  }
  return performanceMonitorInstance
}

// Utility function to wrap API routes with performance monitoring
export function withPerformanceMonitoring<T extends any[], R>(
  name: string,
  fn: (...args: T) => Promise<R>
) {
  return async (...args: T): Promise<R> => {
    const monitor = getPerformanceMonitor()
    return monitor.measureAsync(name, () => fn(...args))
  }
}
