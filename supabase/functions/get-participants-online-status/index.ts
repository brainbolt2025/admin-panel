import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface GetParticipantsStatusRequest {
  conversation_id: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed. Use POST.' }),
      {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing authorization header' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Initialize Supabase client with service role key to bypass RLS
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase configuration')
      return new Response(
        JSON.stringify({ success: false, error: 'Server configuration error' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // Verify the user is authenticated using the provided token
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid or expired authentication token' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Parse request body
    const body: GetParticipantsStatusRequest = await req.json()
    const { conversation_id } = body

    if (!conversation_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'conversation_id is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Verify that the authenticated user is a participant in this conversation
    const { data: participantCheck, error: participantError } = await supabaseAdmin
      .from('conversation_participants')
      .select('user_id')
      .eq('conversation_id', conversation_id)
      .eq('user_id', user.id)
      .single()

    if (participantError || !participantCheck) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'You are not a participant in this conversation' 
        }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Get all participants in the conversation with their online status
    const { data: participantsData, error: participantsError } = await supabaseAdmin
      .from('conversation_participants')
      .select(`
        user_id,
        role,
        user:users!user_id (
          id,
          name,
          role,
          is_online,
          last_seen
        )
      `)
      .eq('conversation_id', conversation_id)

    if (participantsError) {
      console.error('Error fetching participants:', participantsError)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to fetch participants',
          details: participantsError.message 
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Format the response (filter out current user, only include online status for tenants/technicians)
    const formattedParticipants = (participantsData || []).map((p: any) => ({
      user_id: p.user_id,
      name: p.user?.name || 'Unknown',
      role: p.user?.role || p.role,
      // Only include online status for tenants and technicians
      is_online: (p.user?.role === 'tenant' || p.user?.role === 'technician') 
        ? (p.user?.is_online ?? false)
        : null,
      last_seen: (p.user?.role === 'tenant' || p.user?.role === 'technician')
        ? (p.user?.last_seen || null)
        : null,
    }))

    console.log(`✅ Retrieved online status for ${formattedParticipants.length} participants in conversation ${conversation_id}`)

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          conversation_id,
          participants: formattedParticipants,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Unexpected error in get-participants-online-status:', error)
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


