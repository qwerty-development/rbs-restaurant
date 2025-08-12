// lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'

// Optimized client configuration for performance
export const createClient = () =>
  createBrowserClient<any>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      db: {
        schema: 'public'
      },
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      },
      global: {
        headers: {
          'x-client-info': 'rbs-restaurant-optimized'
        }
      },
      // Connection pooling and performance settings
      realtime: {
        params: {
          eventsPerSecond: 10 // Limit real-time events for performance
        }
      }
    }
  )
