import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

interface UpdateEmailRequest {
  user_id: string
  new_email: string
  confirm_email?: boolean // If true, mark email as confirmed without requiring verification
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client with service role key for admin access
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    
    if (!supabaseServiceKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Service role key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // Parse request body
    const { user_id, new_email, confirm_email = false }: UpdateEmailRequest = await req.json()

    if (!user_id || !new_email) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing user_id or new_email' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(new_email)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid email format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Updating email for user ${user_id} to ${new_email}`)

    // Update email in Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.updateUserById(
      user_id,
      {
        email: new_email,
        email_confirm: confirm_email, // If true, skip email verification
      }
    )

    if (authError) {
      console.error('Error updating auth email:', authError)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to update email in auth',
          details: authError.message 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Also update email in your custom users table (if it exists)
    const { error: userTableError } = await supabaseAdmin
      .from('users')
      .update({ email: new_email })
      .eq('id', user_id)

    if (userTableError) {
      console.warn('Error updating users table email:', userTableError)
      // Don't fail the request if users table update fails - auth update is primary
    }

    console.log('✅ Email updated successfully for user:', user_id)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Email updated successfully',
        user_id: user_id,
        new_email: new_email,
        email_confirmed: confirm_email,
        // Note: If confirm_email is false, user will need to verify the new email
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error updating user email:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

