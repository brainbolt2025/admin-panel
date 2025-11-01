import { createClient } from '@supabase/supabase-js';
import { config } from '../config';

// Create Supabase client with authentication
export const supabase = createClient(
  config.supabase.url,
  config.supabase.anonKey,
  {
    auth: {
      persistSession: false, // We're managing sessions manually via localStorage
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  }
);

// Helper function to get authenticated Supabase client
export const getAuthenticatedSupabase = () => {
  const accessToken = localStorage.getItem('access_token');
  
  if (accessToken) {
    // Set the auth header for authenticated requests
    return createClient(config.supabase.url, config.supabase.anonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    });
  }
  
  return supabase;
};

