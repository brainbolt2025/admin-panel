import { createClient } from '@supabase/supabase-js'
import { config } from '../config'

// Create a single Supabase client and let it manage the auth session lifecycle
export const supabase = createClient(config.supabase.url, config.supabase.anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
})

// Backwards-compatible helper – all callers share the same client instance
export const getAuthenticatedSupabase = () => supabase

