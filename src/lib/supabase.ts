import { createClient } from '@supabase/supabase-js'
import { config } from '../config'

// Capture password-recovery indicators from the URL *before* the Supabase
// client runs (detectSessionInUrl consumes and clears the recovery hash on
// startup). This lets the app reliably show the reset-password screen even when
// the recovery email redirects to the site root instead of "/reset-password".
const detectRecoveryLanding = (): boolean => {
  if (typeof window === 'undefined') return false
  try {
    const url = new URL(window.location.href)
    const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''))
    return (
      url.pathname.includes('reset-password') ||
      url.searchParams.get('type') === 'recovery' ||
      hashParams.get('type') === 'recovery'
    )
  } catch {
    return false
  }
}

export const isPasswordRecoveryLanding = detectRecoveryLanding()

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

