// lib/services/database-pool.ts
// Database connection pooling and optimization for high concurrency

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { getPerformanceMonitor } from './performance-monitor'

interface PoolConfig {
  maxConnections: number
  minConnections: number
  idleTimeout: number
  connectionTimeout: number
  retryAttempts: number
  retryDelay: number
}

interface ConnectionStats {
  active: number
  idle: number
  total: number
  created: number
  destroyed: number
  errors: number
}

class DatabaseConnection {
  public client: SupabaseClient
  public isActive: boolean = false
  public lastUsed: number = Date.now()
  public createdAt: number = Date.now()
  public id: string

  constructor(client: SupabaseClient, id: string) {
    this.client = client
    this.id = id
  }

  markActive(): void {
    this.isActive = true
    this.lastUsed = Date.now()
  }

  markIdle(): void {
    this.isActive = false
    this.lastUsed = Date.now()
  }

  isExpired(idleTimeout: number): boolean {
    return !this.isActive && (Date.now() - this.lastUsed) > idleTimeout
  }
}

export class DatabasePool {
  private connections: Map<string, DatabaseConnection> = new Map()
  private config: PoolConfig
  private stats: ConnectionStats = {
    active: 0,
    idle: 0,
    total: 0,
    created: 0,
    destroyed: 0,
    errors: 0
  }
  private monitor = getPerformanceMonitor()
  private cleanupInterval: NodeJS.Timeout | null = null

  constructor(config?: Partial<PoolConfig>) {
    this.config = {
      maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '20'),
      minConnections: parseInt(process.env.DB_MIN_CONNECTIONS || '5'),
      idleTimeout: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
      connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT || '10000'),
      retryAttempts: parseInt(process.env.DB_RETRY_ATTEMPTS || '3'),
      retryDelay: parseInt(process.env.DB_RETRY_DELAY || '1000'),
      ...config
    }

    this.initializePool()
    this.startCleanupProcess()
  }

  // Initialize the connection pool with minimum connections
  private async initializePool(): Promise<void> {
    console.log(`🔗 Initializing database pool with ${this.config.minConnections} connections`)

    for (let i = 0; i < this.config.minConnections; i++) {
      try {
        await this.createConnection()
      } catch (error) {
        console.error(`Failed to create initial connection ${i + 1}:`, error)
        this.stats.errors++
      }
    }

    console.log(`✅ Database pool initialized with ${this.connections.size} connections`)
  }

  // Create a new database connection
  private async createConnection(): Promise<DatabaseConnection> {
    const connectionId = `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    try {
      const client = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          db: {
            schema: 'public'
          },
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false
          },
          global: {
            headers: {
              'x-client-info': `rbs-pool-${connectionId}`,
              'x-connection-pool': 'true'
            }
          }
        }
      )

      // Test the connection
      const { error } = await client.from('restaurants').select('id').limit(1)
      if (error) {
        throw new Error(`Connection test failed: ${error.message}`)
      }

      const connection = new DatabaseConnection(client, connectionId)
      this.connections.set(connectionId, connection)
      
      this.stats.created++
      this.stats.total++
      
      console.log(`🔗 Created database connection: ${connectionId}`)
      return connection

    } catch (error) {
      this.stats.errors++
      console.error(`Failed to create database connection:`, error)
      throw error
    }
  }

  // Get a connection from the pool
  async getConnection(): Promise<DatabaseConnection> {
    return this.monitor.measureAsync('database_pool_get_connection', async () => {
      // Try to find an idle connection
      for (const connection of this.connections.values()) {
        if (!connection.isActive) {
          connection.markActive()
          this.updateStats()
          return connection
        }
      }

      // If no idle connections and we haven't reached max, create a new one
      if (this.connections.size < this.config.maxConnections) {
        const connection = await this.createConnection()
        connection.markActive()
        this.updateStats()
        return connection
      }

      // Wait for a connection to become available
      return this.waitForConnection()
    })
  }

  // Release a connection back to the pool
  releaseConnection(connectionId: string): void {
    const connection = this.connections.get(connectionId)
    if (connection) {
      connection.markIdle()
      this.updateStats()
      this.monitor.recordMetric('database_connection_released', 1)
    }
  }

  // Wait for a connection to become available
  private async waitForConnection(): Promise<DatabaseConnection> {
    const startTime = Date.now()
    const timeout = this.config.connectionTimeout

    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(() => {
        // Check for available connections
        for (const connection of this.connections.values()) {
          if (!connection.isActive) {
            clearInterval(checkInterval)
            connection.markActive()
            this.updateStats()
            resolve(connection)
            return
          }
        }

        // Check timeout
        if (Date.now() - startTime > timeout) {
          clearInterval(checkInterval)
          reject(new Error('Connection timeout: No connections available'))
        }
      }, 100) // Check every 100ms
    })
  }

  // Execute a query with automatic connection management
  async executeQuery<T>(
    queryFn: (client: SupabaseClient) => Promise<T>,
    retryCount: number = 0
  ): Promise<T> {
    let connection: DatabaseConnection | null = null

    try {
      connection = await this.getConnection()
      const result = await this.monitor.measureAsync(
        'database_query_execution',
        () => queryFn(connection!.client)
      )
      
      return result

    } catch (error) {
      this.stats.errors++
      
      // Retry logic for transient errors
      if (retryCount < this.config.retryAttempts && this.isRetryableError(error)) {
        console.warn(`Query failed, retrying (${retryCount + 1}/${this.config.retryAttempts}):`, error)
        await new Promise(resolve => setTimeout(resolve, this.config.retryDelay * (retryCount + 1)))
        return this.executeQuery(queryFn, retryCount + 1)
      }

      throw error

    } finally {
      if (connection) {
        this.releaseConnection(connection.id)
      }
    }
  }

  // Check if an error is retryable
  private isRetryableError(error: any): boolean {
    const retryableErrors = [
      'connection timeout',
      'connection reset',
      'connection refused',
      'temporary failure',
      'rate limit'
    ]

    const errorMessage = error?.message?.toLowerCase() || ''
    return retryableErrors.some(retryableError => errorMessage.includes(retryableError))
  }

  // Update connection statistics
  private updateStats(): void {
    this.stats.active = Array.from(this.connections.values()).filter(c => c.isActive).length
    this.stats.idle = this.connections.size - this.stats.active
    this.stats.total = this.connections.size
  }

  // Start the cleanup process for expired connections
  private startCleanupProcess(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredConnections()
    }, 30000) // Run every 30 seconds
  }

  // Clean up expired idle connections
  private cleanupExpiredConnections(): void {
    const expiredConnections: string[] = []

    for (const [id, connection] of this.connections.entries()) {
      if (connection.isExpired(this.config.idleTimeout) && this.connections.size > this.config.minConnections) {
        expiredConnections.push(id)
      }
    }

    for (const id of expiredConnections) {
      this.connections.delete(id)
      this.stats.destroyed++
      console.log(`🗑️  Cleaned up expired connection: ${id}`)
    }

    if (expiredConnections.length > 0) {
      this.updateStats()
    }
  }

  // Get pool statistics
  getStats(): ConnectionStats & { config: PoolConfig } {
    this.updateStats()
    return {
      ...this.stats,
      config: this.config
    }
  }

  // Get pool health status
  getHealth(): {
    healthy: boolean
    utilization: number
    avgConnectionAge: number
    issues: string[]
  } {
    this.updateStats()
    
    const issues: string[] = []
    const utilization = this.stats.total > 0 ? this.stats.active / this.stats.total : 0
    
    // Calculate average connection age
    const now = Date.now()
    const ages = Array.from(this.connections.values()).map(c => now - c.createdAt)
    const avgConnectionAge = ages.length > 0 ? ages.reduce((sum, age) => sum + age, 0) / ages.length : 0

    // Check for issues
    if (utilization > 0.9) {
      issues.push('High connection utilization (>90%)')
    }
    
    if (this.stats.errors > 10) {
      issues.push('High error count')
    }
    
    if (this.stats.total < this.config.minConnections) {
      issues.push('Below minimum connection count')
    }

    return {
      healthy: issues.length === 0,
      utilization,
      avgConnectionAge,
      issues
    }
  }

  // Graceful shutdown
  async shutdown(): Promise<void> {
    console.log('🔌 Shutting down database pool...')
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }

    // Wait for active connections to finish (with timeout)
    const shutdownTimeout = 30000 // 30 seconds
    const startTime = Date.now()

    while (this.stats.active > 0 && (Date.now() - startTime) < shutdownTimeout) {
      await new Promise(resolve => setTimeout(resolve, 100))
      this.updateStats()
    }

    // Force close remaining connections
    this.connections.clear()
    this.stats = {
      active: 0,
      idle: 0,
      total: 0,
      created: 0,
      destroyed: 0,
      errors: 0
    }

    console.log('✅ Database pool shutdown complete')
  }
}

// Singleton instance
let databasePoolInstance: DatabasePool | null = null

export function getDatabasePool(): DatabasePool {
  if (!databasePoolInstance) {
    databasePoolInstance = new DatabasePool()
  }
  return databasePoolInstance
}

// Utility function to execute queries with the pool
export async function executePooledQuery<T>(
  queryFn: (client: SupabaseClient) => Promise<T>
): Promise<T> {
  const pool = getDatabasePool()
  return pool.executeQuery(queryFn)
}
