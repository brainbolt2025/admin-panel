// Import Supabase client from esm.sh
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
// Import serve from Deno standard library
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

// CORS headers for cross-origin requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Main handler function
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get token from query parameters
    const url = new URL(req.url)
    const token = url.searchParams.get('token')

    if (!token) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing verification token. Please use the link from your email.',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Initialize Supabase Admin client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    
    if (!supabaseServiceRoleKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Server configuration error',
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    console.log('Verifying email with token:', token.substring(0, 20) + '...')

    // Verify the token and update user
    // Note: This assumes you have a verification_token column in your users table
    // If you're using a different approach, adjust accordingly
    
    // Option 1: If you have verification_token column (recommended)
    // First, try to find user by verification_token
    const { data: userData, error: findError } = await supabaseAdmin
      .from('users')
      .select('id, email, email_verified, verification_token')
      .eq('verification_token', token)
      .maybeSingle()

    // Log detailed error information for debugging
    if (findError) {
      console.error('Database query error:', {
        message: findError.message,
        code: findError.code,
        details: findError.details,
        hint: findError.hint,
        fullError: findError,
      })
      
      // Check if it's a column missing error
      if (findError.code === '42703' || findError.message?.includes('column') || findError.message?.includes('does not exist')) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Database schema error: verification_token column is missing. Please run the migration: add-email-verification-columns.sql',
            hint: 'Run this SQL in Supabase SQL Editor: ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token TEXT;',
          }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        )
      }
      
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Database error during verification. Please try again later.',
          details: findError.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    if (!userData) {
      console.error('Token not found in database. Token:', token.substring(0, 20) + '...')
      
      // Check if any users have verification tokens (for debugging)
      const { data: debugData, error: debugError } = await supabaseAdmin
        .from('users')
        .select('id, email, verification_token')
        .not('verification_token', 'is', null)
        .limit(5)
      
      console.log('Debug: Users with verification tokens:', {
        count: debugData?.length || 0,
        samples: debugData?.map(u => ({
          id: u.id,
          email: u.email,
          tokenPrefix: u.verification_token?.substring(0, 10) + '...',
        })),
        debugError,
      })
      
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid or expired verification token. Please request a new verification email.',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Check if already verified
    if (userData.email_verified) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Email already verified. You can sign in now.',
          already_verified: true,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Update user: mark email as verified and clear verification token
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        email_verified: true,
        verification_token: null, // Clear token after verification
        verification_token_expires_at: null,
      })
      .eq('id', userData.id)

    if (updateError) {
      console.error('Error updating user verification status:', updateError)
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to verify email. Please try again.',
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Also update Supabase Auth email confirmation status
    try {
      await supabaseAdmin.auth.admin.updateUserById(userData.id, {
        email_confirm: true,
      })
      console.log('Updated Supabase Auth email confirmation status')
    } catch (authError) {
      console.warn('Could not update Auth email confirmation:', authError)
      // Don't fail if this doesn't work - user table update is primary
    }

    console.log('✅ Email verified successfully for user:', userData.id)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Email verified successfully! You can now sign in.',
        user_id: userData.id,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error verifying email:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})

/*
DEPLOYMENT INSTRUCTIONS:
========================
1. Deploy the function:
   supabase functions deploy verify-email

2. How to use:
   - Users click verification link: ${BASE_URL}/verify?token=${token}
   - Frontend should redirect to this function or call it directly
   - Function verifies the token and marks email as verified

3. Database schema requirements:
   - users table should have:
     * verification_token (TEXT) - stores the token
     * email_verified (BOOLEAN) - tracks verification status
     * verification_token_expires_at (TIMESTAMPTZ) - optional expiration

4. Alternative approach (if not using verification_token column):
   - Store tokens in a separate verification_tokens table
   - Join with users table to verify
   - This approach is more scalable for token expiration

USAGE FROM FRONTEND:
===================
When user clicks verification link, redirect to:

Option 1: Direct API call
GET https://YOUR_PROJECT.supabase.co/functions/v1/verify-email?token=xxx

Option 2: Handle in frontend
- Parse token from URL
- Call verify-email function
- Show success/error message
- Redirect to login

Example frontend code (already added to Login component):
```typescript
const response = await fetch(
  `${config.supabase.url}/functions/v1/verify-email?token=${token}`,
  {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'apikey': config.supabase.anonKey,
    }
  }
);
```

NOTE:
=====
If you don't have a verification_token column, you'll need to either:
1. Add the column to your users table
2. Store tokens when sending emails (uncomment code in stripe-webhook)
3. Or use a different verification method (e.g., Supabase Auth's built-in verification)
*/

