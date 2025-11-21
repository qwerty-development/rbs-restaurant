'use client'

import { createClient } from '@/lib/supabase/client'
import type { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js'

export type MobileUserPresence = {
  user: string
  online_at: string
  last_seen?: string
}

export type MobilePresenceState = Record<string, MobileUserPresence[]>

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'error' | 'disconnected'

type PresenceListener = (state: MobilePresenceState) => void
type StatusListener = (status: ConnectionStatus) => void

const CHANNEL_NAME = 'live_users'

class MobilePresenceService {
  private static instance: MobilePresenceService
  private client: SupabaseClient
  private channel: RealtimeChannel | null = null
  private listeners = new Set<PresenceListener>()
  private statusListeners = new Set<StatusListener>()
  private currentState: MobilePresenceState = {}
  private status: ConnectionStatus = 'idle'
  private retryAttempts = 0
  private readonly maxRetries = 5
  private retryTimer: ReturnType<typeof setTimeout> | null = null

  private constructor() {
    this.client = createClient()
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.handleVisibilityChange)
    }
  }

  static getInstance() {
    if (!this.instance) {
      this.instance = new MobilePresenceService()
    }
    return this.instance
  }

  subscribe(onStateChange: PresenceListener, onStatusChange?: StatusListener) {
    this.listeners.add(onStateChange)
    onStateChange(this.currentState)

    if (onStatusChange) {
      this.statusListeners.add(onStatusChange)
      onStatusChange(this.status)
    }

    this.ensureChannel()

    return () => {
      this.listeners.delete(onStateChange)
      if (onStatusChange) {
        this.statusListeners.delete(onStatusChange)
      }

      if (this.listeners.size === 0 && this.statusListeners.size === 0) {
        this.teardown()
      }
    }
  }

  private ensureChannel() {
    if (this.channel) {
      // If channel exists but is not joined, we might need to rejoin? 
      // Usually Supabase handles this, but let's log it.
      return
    }

    console.log('MobilePresenceService: Initializing channel...')
    this.setStatus('connecting')

    this.channel = this.client.channel(CHANNEL_NAME)

    const updateState = () => {
      console.log('MobilePresenceService: Presence event received')
      this.refreshPresenceState()
    }

    this.channel
      .on('presence', { event: 'sync' }, updateState)
      .on('presence', { event: 'join' }, updateState)
      .on('presence', { event: 'leave' }, updateState)
      .subscribe((status) => {
        console.log(`MobilePresenceService: Channel status changed to ${status}`)
        switch (status) {
          case 'SUBSCRIBED':
            this.retryAttempts = 0
            this.setStatus('connected')
            this.refreshPresenceState()
            break
          case 'CHANNEL_ERROR':
          case 'TIMED_OUT':
            this.setStatus('error')
            this.scheduleRetry()
            break
          case 'CLOSED':
            this.setStatus('disconnected')
            this.scheduleRetry()
            break
          default:
            break
        }
      })
  }

  private refreshPresenceState() {
    if (!this.channel) {
      console.warn('MobilePresenceService: No channel available to refresh state')
      return
    }
    try {
      // We cast to unknown first because Supabase types might not perfectly align with our strict types
      const state = (this.channel.presenceState<MobileUserPresence>() as unknown) as MobilePresenceState || {}
      
      // Log state for debugging in development
      if (process.env.NODE_ENV === 'development') {
        const userCount = Object.keys(state).length
        console.log(`MobilePresenceService: Presence state updated. Users online: ${userCount}`, state)
      }

      this.currentState = state
      this.notifyStateListeners()
    } catch (error) {
      console.error('MobilePresenceService: Failed to read mobile presence state:', error)
    }
  }

  private scheduleRetry() {
    if (this.retryTimer || this.listeners.size === 0) return
    if (this.retryAttempts >= this.maxRetries) {
      // Only log in development to avoid console noise in production
      if (process.env.NODE_ENV === 'development') {
        console.warn('Max presence retry attempts reached')
      }
      return
    }

    const delay = Math.min(1000 * 2 ** this.retryAttempts, 30000)
    this.retryAttempts += 1

    this.retryTimer = setTimeout(() => {
      this.retryTimer = null
      this.reconnectChannel()
    }, delay)
  }

  private reconnectChannel() {
    this.cleanupChannel(false)
    this.ensureChannel()
  }

  private teardown() {
    this.cleanupChannel()
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange)
    }
    this.setStatus('idle')
  }

  private cleanupChannel(resetState = true) {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer)
      this.retryTimer = null
    }

    if (this.channel) {
      this.channel.unsubscribe()
      this.channel = null
    }

    if (resetState) {
      this.currentState = {}
      this.notifyStateListeners()
    }
  }

  private notifyStateListeners() {
    this.listeners.forEach((listener) => listener(this.currentState))
  }

  private setStatus(status: ConnectionStatus) {
    this.status = status
    this.statusListeners.forEach((listener) => listener(status))
  }

  private handleVisibilityChange = () => {
    if (document.hidden) return

    if (this.status !== 'connected') {
      this.retryAttempts = 0
      this.reconnectChannel()
    }
  }

}

export { MobilePresenceService }


