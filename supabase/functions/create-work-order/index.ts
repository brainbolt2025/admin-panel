import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CreateWorkOrderRequest {
  title?: string | null
  description: string
  priority?: 'Low' | 'Medium' | 'High' | null
  property_id?: string | null
  unit_number?: string | null
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get authenticated user from request
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Supabase client with service role key for admin operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    if (!supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Missing SUPABASE_SERVICE_ROLE_KEY' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // Create authenticated client to get user info
    const supabaseClient = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    // Get the authenticated user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get user profile to verify role and get tenant info
    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from('users')
      .select('id, role, property_id, unit_number')
      .eq('id', user.id)
      .single()

    if (profileError || !userProfile) {
      return new Response(
        JSON.stringify({ error: 'User profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify user is a tenant
    if (userProfile.role !== 'tenant') {
      return new Response(
        JSON.stringify({ error: 'Only tenants can create work orders' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const body: CreateWorkOrderRequest = await req.json()

    if (!body.description) {
      return new Response(
        JSON.stringify({ error: 'Description is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate priority if provided
    if (body.priority && !['Low', 'Medium', 'High'].includes(body.priority)) {
      return new Response(
        JSON.stringify({ error: 'Priority must be Low, Medium, or High' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Use property_id from request, or fallback to user's property_id
    const propertyId = body.property_id || userProfile.property_id

    if (!propertyId) {
      return new Response(
        JSON.stringify({ error: 'Property ID is required. Either provide it in the request or ensure your user profile has a property_id.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Use unit_number from request, or fallback to user's unit_number
    const unitNumber = body.unit_number || userProfile.unit_number || null

    // Create work order
    const { data: workOrder, error: insertError } = await supabaseAdmin
      .from('work_orders')
      .insert({
        title: body.title || null,
        description: body.description,
        priority: body.priority || 'Medium',
        status: 'Pending',
        tenant_id: user.id, // Always set to authenticated tenant
        property_id: propertyId,
        unit_number: unitNumber,
        attachments: [], // Start with empty attachments array
        seen_by_pm: false, // New work orders are unseen by PM
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error creating work order:', insertError)
      return new Response(
        JSON.stringify({ error: 'Failed to create work order', details: insertError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('✅ Work order created successfully:', workOrder.id)

    // Notify PM (best-effort — do not fail WO creation if email fails)
    try {
      const notifyUrl = `${supabaseUrl}/functions/v1/notify-pm-work-order`
      const notifyResponse = await fetch(notifyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({ work_order_id: workOrder.id }),
      })
      if (!notifyResponse.ok) {
        const notifyError = await notifyResponse.text().catch(() => '')
        console.error('PM work order notification failed:', notifyResponse.status, notifyError)
      } else {
        console.log('PM work order notification sent')
      }
    } catch (notifyErr) {
      console.error('PM work order notification error:', notifyErr)
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: workOrder,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error in create-work-order function:', error)
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})








