import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

interface CreateConversationRequest {
  work_order_id: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Only allow POST requests
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ 
          code: 405, 
          message: 'Method not allowed. Use POST.' 
        }),
        { 
          status: 405, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Get authenticated user from request (Supabase handles JWT verification)
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ 
          code: 401, 
          message: 'Missing authorization header. Please authenticate first.' 
        }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Create Supabase client with anon key and user's auth token
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    
    const supabaseClient = createClient(
      supabaseUrl,
      supabaseAnonKey,
      { 
        global: { 
          headers: { 
            Authorization: authHeader 
          } 
        } 
      }
    )

    // Verify the user is authenticated
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()

    if (userError || !user) {
      console.error('Authentication error:', userError)
      return new Response(
        JSON.stringify({ 
          code: 401, 
          message: 'Invalid or expired authentication token. Please log in again.' 
        }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('Authenticated user:', { id: user.id, email: user.email })

    // Parse request body
    const body: CreateConversationRequest = await req.json()
    const { work_order_id } = body

    // Validate required fields
    if (!work_order_id) {
      return new Response(
        JSON.stringify({ 
          code: 400, 
          message: 'Missing required field: work_order_id' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(work_order_id)) {
      return new Response(
        JSON.stringify({ 
          code: 400, 
          message: 'Invalid work_order_id format. Must be a valid UUID.' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('Creating conversation for work order:', work_order_id)

    // Verify user has access to this work order
    const { data: workOrder, error: workOrderError } = await supabaseClient
      .from('work_orders')
      .select('id, tenant_id, technician_id, property_id')
      .eq('id', work_order_id)
      .single()

    if (workOrderError || !workOrder) {
      console.error('Error fetching work order:', workOrderError)
      return new Response(
        JSON.stringify({ 
          code: 404, 
          message: 'Work order not found or you do not have access to it.' 
        }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Get user's role
    const { data: userProfile, error: profileError } = await supabaseClient
      .from('users')
      .select('id, role, property_id')
      .eq('id', user.id)
      .single()

    if (profileError || !userProfile) {
      console.error('Error fetching user profile:', profileError)
      return new Response(
        JSON.stringify({ 
          code: 500, 
          message: 'Unable to verify user permissions. Please try again.' 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Verify user has permission to create conversation for this work order
    // Only tenants and technicians can create conversations (PMs are not participants)
    const isTenant = userProfile.role === 'tenant' && workOrder.tenant_id === user.id
    const isTechnician = userProfile.role === 'technician' && workOrder.technician_id === user.id

    if (!isTenant && !isTechnician) {
      console.error('Permission denied:', {
        userId: user.id,
        userRole: userProfile.role,
        workOrderTenant: workOrder.tenant_id,
        workOrderTechnician: workOrder.technician_id
      })
      return new Response(
        JSON.stringify({ 
          code: 403, 
          message: 'Permission denied. Only tenants and technicians can create conversations for their work orders.' 
        }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Call the database function to create conversation and participants
    const { data: conversationId, error: rpcError } = await supabaseClient
      .rpc('create_conversation_participants', { 
        p_work_order_id: work_order_id 
      })

    if (rpcError) {
      console.error('Error calling create_conversation_participants:', rpcError)
      
      // Provide more helpful error messages
      let errorMessage = 'Failed to create conversation. Please try again.'
      
      if (rpcError.message?.includes('already exists') || rpcError.message?.includes('unique')) {
        errorMessage = 'A conversation for this work order already exists.'
      } else if (rpcError.message?.includes('not found')) {
        errorMessage = 'Work order not found or is invalid.'
      } else if (rpcError.message?.includes('permission') || rpcError.message?.includes('policy')) {
        errorMessage = 'Permission denied. Please ensure you have access to this work order.'
      }

      return new Response(
        JSON.stringify({ 
          code: 500, 
          message: errorMessage,
          error: rpcError.message 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    if (!conversationId) {
      return new Response(
        JSON.stringify({ 
          code: 500, 
          message: 'Failed to create conversation. No conversation ID returned.' 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('Conversation created successfully:', conversationId)

    // Return success response
    return new Response(
      JSON.stringify({
        code: 200,
        message: 'Conversation created successfully',
        conversation_id: conversationId,
        work_order_id: work_order_id
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Unexpected error in create-conversation-participants:', error)
    return new Response(
      JSON.stringify({
        code: 500,
        message: 'An unexpected error occurred. Please try again later.',
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

