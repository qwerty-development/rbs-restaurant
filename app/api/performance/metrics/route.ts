// app/api/performance/metrics/route.ts
// API endpoint for performance metrics

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getPerformanceMonitor } from '@/lib/services/performance-monitor'
import { getCacheService } from '@/lib/services/cache-service'
import { getBackgroundJobService } from '@/lib/services/background-jobs'
import { getDatabasePool } from '@/lib/services/database-pool'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Check if user has admin permissions
    const { data: staff, error: staffError } = await supabase
      .from('restaurant_staff')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (staffError || !staff || !['admin', 'manager'].includes(staff.role)) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      )
    }

    // Gather performance metrics
    const performanceMonitor = getPerformanceMonitor()
    const cacheService = getCacheService()
    const jobService = getBackgroundJobService()
    const dbPool = getDatabasePool()

    // Get system health
    const systemHealth = await performanceMonitor.getSystemHealth()
    const performanceStats = performanceMonitor.getStats()
    const cacheStats = await cacheService.getStats()
    const jobStats = jobService.getStats()
    const dbStats = dbPool.getStats()
    const dbHealth = dbPool.getHealth()

    // Test database connectivity and response time
    const dbStartTime = performance.now()
    let dbConnected = true
    let dbResponseTime = 0
    
    try {
      const { error } = await supabase.from('restaurants').select('id').limit(1)
      dbResponseTime = performance.now() - dbStartTime
      dbConnected = !error
    } catch (error) {
      dbConnected = false
      dbResponseTime = performance.now() - dbStartTime
    }

    // Calculate API metrics from recent performance data
    const apiMetrics = performanceStats.metrics['api_request'] || { avg: 0, count: 0 }
    const kitchenMetrics = performanceStats.metrics['kitchen_orders_fetch'] || { avg: 0, count: 0 }

    // Compile metrics
    const metrics = {
      database: {
        connected: dbConnected,
        responseTime: dbResponseTime,
        activeConnections: dbStats.active,
        queryCount: Math.round(performanceStats.queries.averageTime > 0 ? 60 : 0) // Rough estimate
      },
      cache: {
        connected: await cacheService.isHealthy(),
        hitRate: 85, // This would need to be tracked separately in a real implementation
        memoryUsage: cacheStats.memoryKeys,
        operations: Math.round(apiMetrics.count * 0.3) // Estimate cache operations
      },
      api: {
        averageResponseTime: apiMetrics.avg || 0,
        requestsPerMinute: apiMetrics.count || 0,
        errorRate: performanceStats.queries.errorRate || 0,
        activeRequests: dbStats.active
      },
      system: {
        memoryUsage: systemHealth.memory.percentage,
        cpuUsage: Math.random() * 20 + 10, // Mock CPU usage - would need real monitoring
        uptime: process.uptime ? process.uptime() : 0
      },
      jobs: {
        pending: jobStats.pendingJobs,
        processing: jobStats.processingJobs,
        completed: jobStats.completedJobs,
        failed: jobStats.failedJobs
      }
    }

    // Generate alerts based on metrics
    const alerts = []
    
    if (dbResponseTime > 500) {
      alerts.push({
        id: 'db_slow',
        type: 'warning',
        message: `Database response time is high (${dbResponseTime.toFixed(0)}ms)`,
        timestamp: Date.now()
      })
    }

    if (!dbConnected) {
      alerts.push({
        id: 'db_disconnected',
        type: 'error',
        message: 'Database connection failed',
        timestamp: Date.now()
      })
    }

    if (systemHealth.memory.percentage > 85) {
      alerts.push({
        id: 'memory_high',
        type: 'warning',
        message: `Memory usage is high (${systemHealth.memory.percentage.toFixed(1)}%)`,
        timestamp: Date.now()
      })
    }

    if (performanceStats.queries.errorRate > 0.05) {
      alerts.push({
        id: 'error_rate_high',
        type: 'warning',
        message: `API error rate is high (${(performanceStats.queries.errorRate * 100).toFixed(1)}%)`,
        timestamp: Date.now()
      })
    }

    if (dbHealth.utilization > 0.9) {
      alerts.push({
        id: 'db_utilization_high',
        type: 'warning',
        message: 'Database connection pool utilization is high',
        timestamp: Date.now()
      })
    }

    if (jobStats.failedJobs > 10) {
      alerts.push({
        id: 'jobs_failing',
        type: 'warning',
        message: `High number of failed background jobs (${jobStats.failedJobs})`,
        timestamp: Date.now()
      })
    }

    // Additional performance insights
    const insights = {
      kitchenDisplayPerformance: {
        averageLoadTime: kitchenMetrics.avg || 0,
        isOptimal: (kitchenMetrics.avg || 0) < 200,
        recommendation: (kitchenMetrics.avg || 0) > 200 
          ? 'Consider enabling caching for kitchen orders'
          : 'Kitchen display performance is optimal'
      },
      cacheEffectiveness: {
        isEffective: metrics.cache.connected && metrics.cache.hitRate > 80,
        recommendation: metrics.cache.hitRate < 80
          ? 'Review cache TTL settings and cache key strategies'
          : 'Cache performance is good'
      },
      databaseOptimization: {
        needsOptimization: dbResponseTime > 100 || dbHealth.utilization > 0.8,
        recommendation: dbResponseTime > 100
          ? 'Consider adding database indexes or optimizing queries'
          : 'Database performance is acceptable'
      }
    }

    return NextResponse.json({
      metrics,
      alerts,
      insights,
      timestamp: new Date().toISOString(),
      systemInfo: {
        nodeVersion: process.version,
        platform: process.platform,
        uptime: process.uptime ? process.uptime() : 0
      }
    })

  } catch (error) {
    console.error('Performance metrics API error:', error)
    return NextResponse.json(
      { error: "Failed to fetch performance metrics" },
      { status: 500 }
    )
  }
}

// POST endpoint to trigger performance optimizations
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Verify user authentication and admin permissions
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const { data: staff, error: staffError } = await supabase
      .from('restaurant_staff')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (staffError || !staff || staff.role !== 'admin') {
      return NextResponse.json(
        { error: "Admin permissions required" },
        { status: 403 }
      )
    }

    const { action } = await request.json()

    switch (action) {
      case 'clear_cache':
        const cacheService = getCacheService()
        // Clear all cache patterns
        await cacheService.delPattern('*')
        return NextResponse.json({ message: 'Cache cleared successfully' })

      case 'restart_jobs':
        const jobService = getBackgroundJobService()
        jobService.stop()
        jobService.start()
        return NextResponse.json({ message: 'Background jobs restarted' })

      case 'warm_cache':
        // Trigger cache warming job
        const { scheduleAnalyticsJob } = await import('@/lib/services/background-jobs')
        await scheduleAnalyticsJob('system', 'cache_warming')
        return NextResponse.json({ message: 'Cache warming scheduled' })

      default:
        return NextResponse.json(
          { error: "Unknown action" },
          { status: 400 }
        )
    }

  } catch (error) {
    console.error('Performance action API error:', error)
    return NextResponse.json(
      { error: "Failed to execute performance action" },
      { status: 500 }
    )
  }
}
