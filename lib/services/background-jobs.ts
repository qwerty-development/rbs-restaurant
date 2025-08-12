// lib/services/background-jobs.ts
// Background job processing system for non-critical tasks

import { getCacheService } from './cache-service'
import { createClient } from '@/lib/supabase/client'
import { getPerformanceMonitor } from './performance-monitor'

interface Job {
  id: string
  type: string
  data: any
  priority: number
  attempts: number
  maxAttempts: number
  createdAt: number
  scheduledAt: number
  processedAt?: number
  completedAt?: number
  error?: string
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'retrying'
}

interface JobProcessor {
  type: string
  handler: (data: any) => Promise<void>
  concurrency: number
  retryDelay: number
}

export class BackgroundJobService {
  private cache = getCacheService()
  private supabase = createClient()
  private monitor = getPerformanceMonitor()
  private processors = new Map<string, JobProcessor>()
  private isRunning = false
  private processingInterval: NodeJS.Timeout | null = null
  private jobQueue: Job[] = []
  private activeJobs = new Set<string>()

  constructor() {
    this.registerDefaultProcessors()
  }

  // Register default job processors
  private registerDefaultProcessors(): void {
    // Analytics aggregation job
    this.registerProcessor({
      type: 'analytics_aggregation',
      handler: this.processAnalyticsAggregation.bind(this),
      concurrency: 2,
      retryDelay: 60000 // 1 minute
    })

    // Notification sending job
    this.registerProcessor({
      type: 'send_notification',
      handler: this.processSendNotification.bind(this),
      concurrency: 5,
      retryDelay: 30000 // 30 seconds
    })

    // Cache warming job
    this.registerProcessor({
      type: 'cache_warming',
      handler: this.processCacheWarming.bind(this),
      concurrency: 1,
      retryDelay: 300000 // 5 minutes
    })

    // Data cleanup job
    this.registerProcessor({
      type: 'data_cleanup',
      handler: this.processDataCleanup.bind(this),
      concurrency: 1,
      retryDelay: 3600000 // 1 hour
    })

    // Performance metrics aggregation
    this.registerProcessor({
      type: 'metrics_aggregation',
      handler: this.processMetricsAggregation.bind(this),
      concurrency: 1,
      retryDelay: 300000 // 5 minutes
    })
  }

  // Register a job processor
  registerProcessor(processor: JobProcessor): void {
    this.processors.set(processor.type, processor)
    console.log(`📝 Registered job processor: ${processor.type}`)
  }

  // Add a job to the queue
  async addJob(
    type: string,
    data: any,
    options: {
      priority?: number
      delay?: number
      maxAttempts?: number
    } = {}
  ): Promise<string> {
    const job: Job = {
      id: `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      data,
      priority: options.priority || 0,
      attempts: 0,
      maxAttempts: options.maxAttempts || 3,
      createdAt: Date.now(),
      scheduledAt: Date.now() + (options.delay || 0),
      status: 'pending'
    }

    // Add to in-memory queue
    this.jobQueue.push(job)
    this.jobQueue.sort((a, b) => b.priority - a.priority || a.scheduledAt - b.scheduledAt)

    // Cache the job for persistence
    await this.cache.set(`job:${job.id}`, job, 86400) // 24 hours

    console.log(`➕ Added job: ${job.type} (${job.id})`)
    return job.id
  }

  // Start processing jobs
  start(): void {
    if (this.isRunning) {
      console.log('⚠️  Background job service is already running')
      return
    }

    this.isRunning = true
    console.log('🚀 Starting background job service')

    // Process jobs every 5 seconds
    this.processingInterval = setInterval(() => {
      this.processJobs()
    }, 5000)

    // Schedule recurring jobs
    this.scheduleRecurringJobs()
  }

  // Stop processing jobs
  stop(): void {
    if (!this.isRunning) {
      return
    }

    this.isRunning = false
    console.log('🛑 Stopping background job service')

    if (this.processingInterval) {
      clearInterval(this.processingInterval)
      this.processingInterval = null
    }

    // Wait for active jobs to complete
    const waitForCompletion = setInterval(() => {
      if (this.activeJobs.size === 0) {
        clearInterval(waitForCompletion)
        console.log('✅ Background job service stopped')
      }
    }, 1000)
  }

  // Process pending jobs
  private async processJobs(): Promise<void> {
    if (!this.isRunning) return

    const now = Date.now()
    const readyJobs = this.jobQueue.filter(
      job => job.status === 'pending' && 
             job.scheduledAt <= now && 
             !this.activeJobs.has(job.id)
    )

    for (const job of readyJobs) {
      const processor = this.processors.get(job.type)
      if (!processor) {
        console.warn(`⚠️  No processor found for job type: ${job.type}`)
        continue
      }

      // Check concurrency limit
      const activeJobsOfType = Array.from(this.activeJobs).filter(id => {
        const activeJob = this.jobQueue.find(j => j.id === id)
        return activeJob?.type === job.type
      })

      if (activeJobsOfType.length >= processor.concurrency) {
        continue
      }

      // Process the job
      this.processJob(job, processor)
    }
  }

  // Process a single job
  private async processJob(job: Job, processor: JobProcessor): Promise<void> {
    this.activeJobs.add(job.id)
    job.status = 'processing'
    job.processedAt = Date.now()
    job.attempts++

    console.log(`⚙️  Processing job: ${job.type} (${job.id}) - Attempt ${job.attempts}`)

    try {
      await this.monitor.measureAsync(
        `background_job_${job.type}`,
        () => processor.handler(job.data)
      )

      // Job completed successfully
      job.status = 'completed'
      job.completedAt = Date.now()
      
      // Remove from queue
      this.jobQueue = this.jobQueue.filter(j => j.id !== job.id)
      
      console.log(`✅ Completed job: ${job.type} (${job.id})`)

    } catch (error) {
      console.error(`❌ Job failed: ${job.type} (${job.id}):`, error)
      
      job.error = error instanceof Error ? error.message : 'Unknown error'

      if (job.attempts >= job.maxAttempts) {
        job.status = 'failed'
        console.error(`💀 Job permanently failed: ${job.type} (${job.id})`)
      } else {
        job.status = 'retrying'
        job.scheduledAt = Date.now() + processor.retryDelay
        console.log(`🔄 Retrying job: ${job.type} (${job.id}) in ${processor.retryDelay / 1000}s`)
      }
    } finally {
      this.activeJobs.delete(job.id)
      
      // Update cached job
      await this.cache.set(`job:${job.id}`, job, 86400)
    }
  }

  // Schedule recurring jobs
  private scheduleRecurringJobs(): void {
    // Analytics aggregation every hour
    setInterval(() => {
      this.addJob('analytics_aggregation', { type: 'hourly' }, { priority: 5 })
    }, 3600000)

    // Cache warming every 30 minutes
    setInterval(() => {
      this.addJob('cache_warming', { scope: 'menu_data' }, { priority: 3 })
    }, 1800000)

    // Data cleanup daily
    setInterval(() => {
      this.addJob('data_cleanup', { type: 'old_logs' }, { priority: 1 })
    }, 86400000)

    // Performance metrics every 5 minutes
    setInterval(() => {
      this.addJob('metrics_aggregation', {}, { priority: 2 })
    }, 300000)

    console.log('📅 Scheduled recurring jobs')
  }

  // Job processors implementation
  private async processAnalyticsAggregation(data: any): Promise<void> {
    console.log('📊 Processing analytics aggregation:', data.type)
    
    // Aggregate booking statistics
    const { data: bookings } = await this.supabase
      .from('bookings')
      .select('restaurant_id, status, party_size, booking_time')
      .gte('booking_time', new Date(Date.now() - 3600000).toISOString()) // Last hour

    if (bookings) {
      // Group by restaurant and calculate metrics
      const restaurantMetrics = new Map()
      
      for (const booking of bookings) {
        if (!restaurantMetrics.has(booking.restaurant_id)) {
          restaurantMetrics.set(booking.restaurant_id, {
            totalBookings: 0,
            totalGuests: 0,
            completedBookings: 0
          })
        }
        
        const metrics = restaurantMetrics.get(booking.restaurant_id)
        metrics.totalBookings++
        metrics.totalGuests += booking.party_size
        
        if (booking.status === 'completed') {
          metrics.completedBookings++
        }
      }

      // Cache aggregated metrics
      for (const [restaurantId, metrics] of restaurantMetrics) {
        await this.cache.set(
          `analytics:${restaurantId}:hourly:${new Date().getHours()}`,
          metrics,
          7200 // 2 hours
        )
      }
    }
  }

  private async processSendNotification(data: any): Promise<void> {
    console.log('📱 Processing notification:', data.type)
    
    // Implement notification sending logic
    // This could integrate with push notification services, email, SMS, etc.
    
    // For now, just log the notification
    console.log(`Notification sent: ${data.message} to ${data.recipient}`)
  }

  private async processCacheWarming(data: any): Promise<void> {
    console.log('🔥 Processing cache warming:', data.scope)
    
    if (data.scope === 'menu_data') {
      // Warm up menu data cache for all active restaurants
      const { data: restaurants } = await this.supabase
        .from('restaurants')
        .select('id')
        .eq('status', 'active')
        .limit(10)

      if (restaurants) {
        for (const restaurant of restaurants) {
          // Pre-load menu data
          await this.cache.set(
            `menu:${restaurant.id}:warmed`,
            { warmedAt: Date.now() },
            3600
          )
        }
      }
    }
  }

  private async processDataCleanup(data: any): Promise<void> {
    console.log('🧹 Processing data cleanup:', data.type)
    
    if (data.type === 'old_logs') {
      // Clean up old performance metrics
      this.monitor.clearOldMetrics(86400000) // 24 hours
      
      // Clean up old cache entries
      // This would typically involve removing expired cache keys
      console.log('Cleaned up old logs and metrics')
    }
  }

  private async processMetricsAggregation(data: any): Promise<void> {
    console.log('📈 Processing metrics aggregation')
    
    // Get current performance stats
    const stats = this.monitor.getStats()
    const systemHealth = await this.monitor.getSystemHealth()
    
    // Cache aggregated metrics
    await this.cache.set(
      `metrics:system:${Math.floor(Date.now() / 300000)}`, // 5-minute buckets
      {
        stats,
        systemHealth,
        timestamp: Date.now()
      },
      3600 // 1 hour
    )
  }

  // Get job statistics
  getStats(): {
    totalJobs: number
    pendingJobs: number
    processingJobs: number
    completedJobs: number
    failedJobs: number
    activeProcessors: number
  } {
    return {
      totalJobs: this.jobQueue.length,
      pendingJobs: this.jobQueue.filter(j => j.status === 'pending').length,
      processingJobs: this.jobQueue.filter(j => j.status === 'processing').length,
      completedJobs: this.jobQueue.filter(j => j.status === 'completed').length,
      failedJobs: this.jobQueue.filter(j => j.status === 'failed').length,
      activeProcessors: this.processors.size
    }
  }
}

// Singleton instance
let backgroundJobServiceInstance: BackgroundJobService | null = null

export function getBackgroundJobService(): BackgroundJobService {
  if (!backgroundJobServiceInstance) {
    backgroundJobServiceInstance = new BackgroundJobService()
  }
  return backgroundJobServiceInstance
}

// Utility functions for common job types
export async function scheduleAnalyticsJob(restaurantId: string, type: string): Promise<string> {
  const jobService = getBackgroundJobService()
  return jobService.addJob('analytics_aggregation', { restaurantId, type }, { priority: 5 })
}

export async function scheduleNotification(
  recipient: string,
  message: string,
  type: string = 'info'
): Promise<string> {
  const jobService = getBackgroundJobService()
  return jobService.addJob('send_notification', { recipient, message, type }, { priority: 7 })
}

export async function scheduleCacheWarming(scope: string): Promise<string> {
  const jobService = getBackgroundJobService()
  return jobService.addJob('cache_warming', { scope }, { priority: 3 })
}
