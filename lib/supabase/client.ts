// lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

let clientInstance: SupabaseClient<any, 'public', any> | null = null

// PWA-specific Supabase client configuration
export const createClient = () => {
  // Return existing instance if available (singleton pattern for PWA)
  if (clientInstance) {
    return clientInstance
  }

  clientInstance = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      db: {
        schema: 'public'
      },
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        // PWA-specific: More aggressive refresh for better reliability
        flowType: 'pkce'
      },
      global: {
        headers: {
          'x-client-info': 'rbs-restaurant-pwa-optimized'
        }
      },
      // Enhanced real-time configuration for PWA
      realtime: {
        worker:true,
        heartbeatIntervalMs: 15000, // 15 seconds heartbeat
        params: {
          eventsPerSecond: 50, // Increased from 10 for better responsiveness
        },
        // PWA-specific settings
        timeout: 200000, 
        // Enable logging for debugging
        logger: (level: string, message: string, data?: any) => {
          if (level === 'error') {
            console.error('Supabase Realtime Error:', message, data)
          } else if (level === 'info') {
            console.log('Supabase Realtime:', message, data)
          }
        }
      }
    }
  )

  // Add PWA-specific event listeners
  if (typeof window !== 'undefined' && clientInstance) {
    setupPWAConnectionHandling(clientInstance)
  }

  return clientInstance
}

// PWA Connection Handling
function setupPWAConnectionHandling(client: SupabaseClient<any, 'public', any>) {
  // Handle online/offline events
  window.addEventListener('online', () => {
    console.log('🌐 Network online - reconnecting real-time subscriptions')
    // Force reconnection of realtime subscriptions
    if (client.realtime) {
      client.realtime.disconnect()
      // Small delay before reconnecting
      setTimeout(() => {
        client.realtime.connect()
      }, 1000)
    }
  })

  window.addEventListener('offline', () => {
    console.log('🌐 Network offline - real-time subscriptions will pause')
  })

  // Handle visibility changes (PWA background/foreground)
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      console.log('👁️ App visible - ensuring real-time connection')
      // When app becomes visible, ensure connection is active
      setTimeout(() => {
        if (client.realtime && client.realtime.isConnected() === false) {
          console.log('🔄 Reconnecting real-time after visibility change')
          client.realtime.connect()
        }
      }, 500)
    }
  })

  // Handle PWA lifecycle events
  window.addEventListener('beforeunload', () => {
    // Clean disconnect before app closes
    if (client.realtime) {
      client.realtime.disconnect()
    }
  })

  // Handle focus/blur for PWA environments
  window.addEventListener('focus', () => {
    console.log('🎯 App focused - checking real-time connection')
    setTimeout(() => {
      if (client.realtime && client.realtime.isConnected() === false) {
        console.log('🔄 Reconnecting real-time after focus')
        client.realtime.connect()
      }
    }, 500)
  })

  // Service Worker message handling
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'SW_APP_VISIBLE') {
        console.log('📱 Service worker reports app visible - checking real-time')
        setTimeout(() => {
          if (client.realtime && client.realtime.isConnected() === false) {
            console.log('🔄 Reconnecting real-time from service worker signal')
            client.realtime.connect()
          }
        }, 1000)
      }
    })
  }
}

// Reset client instance (useful for testing or manual reconnection)
export const resetClientInstance = () => {
  if (clientInstance?.realtime) {
    clientInstance.realtime.disconnect()
  }
  clientInstance = null
}
