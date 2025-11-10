// Import Supabase client
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
// Import serve from Deno standard library
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

// CORS headers for cross-origin requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

// TypeScript interface for the request body
interface CreateTechnicianRequest {
  email: string
  password: string
  name: string
  property_id?: string
  property_name?: string
}

// Main handler function
serve(async (req) => {
  console.log('create-technician invoked with method:', req.method)

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    })
  }

  try {
    // Only allow POST
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed. Use POST.' }),
        {
          status: 405,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    // Parse the request body
    let body: CreateTechnicianRequest
    try {
      const bodyText = await req.text()
      if (!bodyText || bodyText.trim() === '') {
        return new Response(
          JSON.stringify({ error: 'Request body is empty' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        )
      }
      body = JSON.parse(bodyText)
    } catch (parseError) {
      return new Response(
        JSON.stringify({
          error: 'Invalid JSON in request body',
          details: parseError instanceof Error ? parseError.message : 'Unknown error',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    const { email, password, name, property_id, property_name } = body

    // Validate required fields
    if (!email || !password || !name) {
      return new Response(
        JSON.stringify({
          error: 'Missing required fields. Required: email, password, name',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email format' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    // Initialize Supabase client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    if (!supabaseServiceKey) {
      return new Response(
        JSON.stringify({
          error: 'Missing Supabase service role key. Please set SUPABASE_SERVICE_ROLE_KEY secret.',
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Step 1: Check if user already exists
    console.log('Checking for existing technician by email')
    const { data: existingUser } = await supabase
      .from('users')
      .select('id, email, role')
      .eq('email', email)
      .maybeSingle()

    if (existingUser) {
      return new Response(
        JSON.stringify({
          error: `User with email ${email} already exists. Please use a different email.`,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    // Step 2: Resolve property assignment (same logic as create-tenant)
    let finalPropertyId: string | null = property_id || null
    let finalPropertyName: string | null = property_name || null

    if (finalPropertyId && !finalPropertyName) {
      console.log('Resolving property name from property_id:', finalPropertyId)
      const { data: propData, error: propError } = await supabase
        .from('properties')
        .select('id, name')
        .eq('id', finalPropertyId)
        .maybeSingle()

      if (!propError && propData) {
        finalPropertyName = propData.name
        console.log('Property found by ID:', propData)
      } else {
        return new Response(
          JSON.stringify({
            error: `Property with ID "${finalPropertyId}" not found. Provide a valid property_id or property_name.`,
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        )
      }
    } else if (!finalPropertyId && finalPropertyName) {
      console.log('Resolving property id from property name:', finalPropertyName)
      const { data: propData, error: propError } = await supabase
        .from('properties')
        .select('id, name')
        .eq('name', finalPropertyName)
        .maybeSingle()

      if (!propError && propData) {
        finalPropertyId = propData.id
        finalPropertyName = propData.name
        console.log('Property found by name:', propData)
      } else {
        console.log('Exact match failed. Trying case-insensitive search.')
        const { data: propDataCI, error: propErrorCI } = await supabase
          .from('properties')
          .select('id, name')
          .ilike('name', finalPropertyName)
          .maybeSingle()

        if (!propErrorCI && propDataCI) {
          finalPropertyId = propDataCI.id
          finalPropertyName = propDataCI.name
          console.log('Property found by name (case-insensitive):', propDataCI)
        } else {
          return new Response(
            JSON.stringify({
              error: `Property with name "${finalPropertyName}" not found. Provide a valid property_id or property_name.`,
              hint: 'Check spelling or use property_id.',
            }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            },
          )
        }
      }
    }

    if (!finalPropertyId) {
      return new Response(
        JSON.stringify({
          error: 'Property assignment required. Provide property_id or property_name.',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    if (!finalPropertyName) {
      console.warn('Property name missing despite property_id resolution. Using fallback.')
      finalPropertyName = 'Unknown Property'
    }

    console.log('Resolved property assignment:', {
      property_id: finalPropertyId,
      property_name: finalPropertyName,
    })

    // Step 3: Create auth user using Admin API
    console.log('Creating technician auth user via Admin API')
    const adminResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseServiceKey,
        Authorization: `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        email,
        password,
        user_metadata: {
          name,
          role: 'technician',
          property_id: finalPropertyId,
          property_name: finalPropertyName,
        },
        email_confirm: true,
      }),
    })

    let adminResult: any = {}
    try {
      const responseText = await adminResponse.text()
      if (responseText && responseText.trim() !== '') {
        adminResult = JSON.parse(responseText)
      }
    } catch (parseError) {
      console.error('Failed to parse Admin API response', parseError)
      return new Response(
        JSON.stringify({
          error: 'Failed to create auth user',
          details: 'Admin API returned invalid response',
          status: adminResponse.status,
        }),
        {
          status: adminResponse.status || 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    if (!adminResponse.ok) {
      console.error('Admin API error:', adminResult)
      return new Response(
        JSON.stringify({
          error: adminResult.error_description || adminResult.message || 'Failed to create auth user',
          details: adminResult,
          status: adminResponse.status,
        }),
        {
          status: adminResponse.status || 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    const authUserId = adminResult.id || adminResult.user?.id
    if (!authUserId) {
      return new Response(
        JSON.stringify({
          error: 'Auth user created but no user ID returned',
          details: adminResult,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    console.log('Auth user created successfully:', authUserId)

    // Step 4: Sync with public users table
    console.log('Syncing technician profile into users table')
    let userData: any = null
    let userError: any = null

    for (let attempt = 1; attempt <= 5; attempt++) {
      console.log(`Technician profile update attempt ${attempt}/5`)
      await new Promise((resolve) => setTimeout(resolve, 300))

      const updateResult = await supabase
        .from('users')
        .update({
          name,
          email,
          role: 'technician',
          property_id: finalPropertyId,
          property_name: finalPropertyName,
          approved: false,
        })
        .eq('id', authUserId)
        .select('id, name, email, role, property_id, property_name, approved')
        .single()

      userData = updateResult.data
      userError = updateResult.error

      if (!userError && userData) {
        console.log(`Technician profile updated on attempt ${attempt}`)
        break
      } else if (userError && (userError.code === 'PGRST116' || userError.message?.includes('No rows'))) {
        if (attempt < 5) {
          console.log('User record not ready yet. Retrying...')
          continue
        } else {
          console.log('Attempting INSERT into users table for technician')
          const insertResult = await supabase
            .from('users')
            .insert({
              id: authUserId,
              name,
              email,
              role: 'technician',
              property_id: finalPropertyId,
              property_name: finalPropertyName,
              approved: false,
            })
            .select('id, name, email, role, property_id, property_name, approved')
            .single()

          userData = insertResult.data
          userError = insertResult.error

          if (!userError && userData) {
            console.log('Technician profile created via INSERT')
          }
        }
      } else {
        break
      }
    }

    if (userError) {
      console.error('Error syncing technician record:', userError)
      return new Response(
        JSON.stringify({
          success: true,
          warning: 'Technician auth user created but database record may be incomplete',
          user_id: authUserId,
          email,
          name,
          property_id: finalPropertyId,
          property_name: finalPropertyName,
          database_error: userError.message,
          message: 'Technician auth user created. You may need to manually fix the database record.',
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    console.log('Technician created successfully:', userData?.id || authUserId)

    const serviceRoleResponse = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseServiceKey,
        Authorization: `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({ email, password }),
    })

    if (!serviceRoleResponse.ok) {
      console.error('Error fetching technician access token:', await serviceRoleResponse.text())
      return new Response(
        JSON.stringify({
          success: true,
          user_id: authUserId,
          email,
          name,
          property_id: finalPropertyId,
          property_name: finalPropertyName,
          approved: false,
          warning: 'Technician created but failed to fetch access token.',
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    const tokenResult = await serviceRoleResponse.json()

    return new Response(
      JSON.stringify({
        success: true,
        user_id: authUserId,
        email,
        name,
        property_id: finalPropertyId,
        property_name: finalPropertyName,
        approved: false,
        access_token: tokenResult.access_token,
        refresh_token: tokenResult.refresh_token,
        token_type: tokenResult.token_type,
        expires_in: tokenResult.expires_in,
        message: 'Technician account created successfully and awaits PM approval.',
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  } catch (error) {
    console.error('Error creating technician:', error)

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal server error',
        details: error,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
})

