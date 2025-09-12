"use client"

import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { RealtimeChannel, RealtimeChannelSendResponse } from '@supabase/supabase-js'

interface RealtimeSubscriptionConfig {
  table: string
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*'
  schema?: string
  filter?: string
}

interface UseRobustRealtimeOptions {
  channelName: string
  subscriptions: RealtimeSubscriptionConfig[]
  onEvent?: (payload: any, subscription: RealtimeSubscriptionConfig) => void
  enableRetry?: boolean
  maxRetries?: number
  retryDelay?: number
  healthCheckInterval?: number
  enableLogging?: boolean
}

interface RealtimeState {
  isConnected: boolean
  connectionErrors: number
  lastEventTime: Date | null
  retryCount: number
  channelState: string
}

export function useRobustRealtime(options: UseRobustRealtimeOptions) {
  const {
    channelName,
    subscriptions,
    onEvent,
    enableRetry = true,
    maxRetries = 5,
    retryDelay = 1000,
    healthCheckInterval = 30000, // 30 seconds
    enableLogging = false
  } = options

  const supabase = createClient()
  const channelRef = useRef<RealtimeChannel | null>(null)
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const healthCheckIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const isUnmountedRef = useRef(false)

  const [state, setState] = useState<RealtimeState>({
    isConnected: false,
    connectionErrors: 0,
    lastEventTime: null,
    retryCount: 0,
    channelState: 'closed'
  })

  const log = useCallback((message: string, ...args: any[]) => {
    if (enableLogging) {
      console.log(`🔄 [RobustRealtime:${channelName}] ${message}`, ...args)
    }
  }, [channelName, enableLogging])

  const cleanup = useCallback(() => {
    log('Cleaning up resources')
    
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current)
      retryTimeoutRef.current = null
    }
    
    if (healthCheckIntervalRef.current) {
      clearInterval(healthCheckIntervalRef.current)
      healthCheckIntervalRef.current = null
    }
    
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }
  }, [supabase, log])

  const connect = useCallback(async () => {
    if (isUnmountedRef.current) {
      log('Component unmounted, skipping connection')
      return
    }

    cleanup()
    
    log(`Attempting to connect (attempt ${state.retryCount + 1}/${maxRetries + 1})`)

    try {
      const channel = supabase.channel(channelName)

      // Add all subscriptions to the channel
      subscriptions.forEach((sub) => {
        (channel as any).on(
          'postgres_changes',
          {
            event: sub.event || '*',
            schema: sub.schema || 'public',
            table: sub.table,
            ...(sub.filter && { filter: sub.filter })
          },
          (payload: any) => {
            if (isUnmountedRef.current) return
            
            log(`Received ${sub.event || '*'} event for ${sub.table}:`, payload)
            
            setState(prev => ({
              ...prev,
              lastEventTime: new Date(),
              connectionErrors: 0 // Reset error count on successful event
            }))
            
            onEvent?.(payload, sub)
          }
        )
      })

      // Subscribe with status callback
      channel.subscribe((status) => {
        if (isUnmountedRef.current) return
        
        log('Subscription status:', status)
        
        setState(prev => ({
          ...prev,
          channelState: status
        }))

        if (status === 'SUBSCRIBED') {
          log('Successfully connected!')
          setState(prev => ({
            ...prev,
            isConnected: true,
            retryCount: 0,
            connectionErrors: 0
          }))
          
          // Start health monitoring
          if (healthCheckInterval > 0) {
            healthCheckIntervalRef.current = setInterval(() => {
              if (channelRef.current && !isUnmountedRef.current) {
                const currentState = channelRef.current.state
                log('Health check - Channel state:', currentState)
                
                // If channel is closed but we think we're connected, trigger reconnect
                if (currentState === 'closed' && state.isConnected) {
                  log('Health check detected stale connection, reconnecting')
                  connect()
                }
              }
            }, healthCheckInterval)
          }
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          log('Connection failed with status:', status)
          setState(prev => ({
            ...prev,
            isConnected: false,
            connectionErrors: prev.connectionErrors + 1
          }))
          
          // Auto-retry if enabled and not exceeded max attempts
          if (enableRetry && state.retryCount < maxRetries && !isUnmountedRef.current) {
            const delay = retryDelay * Math.pow(2, state.retryCount) // Exponential backoff
            log(`Scheduling retry in ${delay}ms`)
            
            retryTimeoutRef.current = setTimeout(() => {
              if (!isUnmountedRef.current) {
                setState(prev => ({ ...prev, retryCount: prev.retryCount + 1 }))
                connect()
              }
            }, delay)
          } else if (state.retryCount >= maxRetries) {
            log('Max retry attempts reached, giving up')
          }
        }
      })

      channelRef.current = channel

    } catch (error) {
      log('Error during connection setup:', error)
      setState(prev => ({
        ...prev,
        isConnected: false,
        connectionErrors: prev.connectionErrors + 1
      }))
    }
  }, [
    supabase,
    channelName,
    subscriptions,
    onEvent,
    enableRetry,
    maxRetries,
    retryDelay,
    healthCheckInterval,
    cleanup,
    log,
    state.retryCount
  ])

  // Manual reconnect function
  const reconnect = useCallback(() => {
    log('Manual reconnect requested')
    setState(prev => ({
      ...prev,
      retryCount: 0,
      connectionErrors: 0
    }))
    connect()
  }, [connect, log])

  // Send message through channel
  const send = useCallback(async (event: string, payload: any): Promise<RealtimeChannelSendResponse> => {
    if (!channelRef.current) {
      throw new Error('Channel not connected')
    }
    return channelRef.current.send({ type: 'broadcast', event, payload })
  }, [])

  // Get detailed status
  const getStatus = useCallback(() => ({
    ...state,
    channelState: channelRef.current?.state || 'closed',
    hasChannel: !!channelRef.current
  }), [state])

  // Initial connection and cleanup
  useEffect(() => {
    isUnmountedRef.current = false
    connect()
    
    return () => {
      isUnmountedRef.current = true
      cleanup()
      setState({
        isConnected: false,
        connectionErrors: 0,
        lastEventTime: null,
        retryCount: 0,
        channelState: 'closed'
      })
    }
  }, []) // Only run once on mount

  // Update subscriptions when they change
  useEffect(() => {
    if (state.isConnected) {
      log('Subscriptions changed, reconnecting')
      connect()
    }
  }, [subscriptions, connect, state.isConnected, log])

  return {
    ...state,
    reconnect,
    send,
    getStatus,
    // Utility functions
    isHealthy: state.isConnected && state.connectionErrors === 0,
    needsReconnection: !state.isConnected && enableRetry && state.retryCount < maxRetries
  }
}