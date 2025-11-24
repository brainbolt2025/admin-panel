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
interface CreateTenantRequest {
  email: string
  password: string
  name: string
  property_id?: string // Optional: if provided, use this property_id
  property_name?: string // Optional: if provided, find property by name
  unit_number?: string // Optional: unit number for the tenant
}

// Main handler function
serve(async (req) => {
  console.log('Function called with method:', req.method)
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 204, 
      headers: corsHeaders
    })
  }

  try {
    // Only allow POST
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed. Use POST.' }),
        { 
          status: 405, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }
    
    // Parse the request body
    let body: CreateTenantRequest
    try {
      const bodyText = await req.text()
      if (!bodyText || bodyText.trim() === '') {
        return new Response(
          JSON.stringify({ error: 'Request body is empty' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }
      body = JSON.parse(bodyText)
    } catch (parseError) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid JSON in request body',
          details: parseError instanceof Error ? parseError.message : 'Unknown error'
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const { email, password, name, property_id, property_name, unit_number } = body

    // Validate required fields
    if (!email || !password || !name) {
      return new Response(
        JSON.stringify({ 
          error: 'Missing required fields. Required: email, password, name' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email format' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Initialize Supabase client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    
    if (!supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Missing Supabase service role key. Please set SUPABASE_SERVICE_ROLE_KEY secret.' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Step 1: Check if user already exists
    console.log('Step 1: Checking if user already exists')
    const { data: existingUser } = await supabase
      .from('users')
      .select('id, email, role')
      .eq('email', email)
      .maybeSingle()

    if (existingUser) {
      return new Response(
        JSON.stringify({ 
          error: `User with email ${email} already exists. Please use a different email.` 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Step 2: Resolve property_id and property_name
    // If property_id is provided, fetch property_name
    // If property_name is provided, fetch property_id
    let finalPropertyId: string | null = property_id || null
    let finalPropertyName: string | null = property_name || null

    if (finalPropertyId && !finalPropertyName) {
      // Fetch property_name from property_id
      console.log('Fetching property name from property_id:', finalPropertyId)
      const { data: propData, error: propError } = await supabase
        .from('properties')
        .select('id, name')
        .eq('id', finalPropertyId)
        .maybeSingle()
      
      if (!propError && propData) {
        finalPropertyName = propData.name
        console.log('Found property by ID:', propData)
      } else {
        return new Response(
          JSON.stringify({ 
            error: `Property with ID "${finalPropertyId}" not found. Please provide a valid property_id or property_name.` 
          }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }
    } else if (!finalPropertyId && finalPropertyName) {
      // Fetch property_id from property_name
      console.log('Fetching property_id from property name:', finalPropertyName)
      const { data: propData, error: propError } = await supabase
        .from('properties')
        .select('id, name')
        .eq('name', finalPropertyName)
        .maybeSingle()
      
      if (!propError && propData) {
        finalPropertyId = propData.id
        // Use the exact name from database (case-sensitive match)
        finalPropertyName = propData.name
        console.log('Found property by name:', propData)
      } else {
        // Try case-insensitive search as fallback
        console.log('Exact match not found, trying case-insensitive search')
        const { data: propDataCI, error: propErrorCI } = await supabase
          .from('properties')
          .select('id, name')
          .ilike('name', finalPropertyName)
          .maybeSingle()
        
        if (!propErrorCI && propDataCI) {
          finalPropertyId = propDataCI.id
          finalPropertyName = propDataCI.name
          console.log('Found property by name (case-insensitive):', propDataCI)
        } else {
          return new Response(
            JSON.stringify({ 
              error: `Property with name "${finalPropertyName}" not found. Please provide a valid property_id or property_name.`,
              hint: 'Check property name spelling or use property_id instead.'
            }),
            { 
              status: 400, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          )
        }
      }
    }

    // Validate that we have both property_id and property_name
    if (!finalPropertyId) {
      return new Response(
        JSON.stringify({ 
          error: 'Property assignment required. Please provide property_id or property_name.' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    if (!finalPropertyName) {
      // This shouldn't happen if property_id lookup succeeded, but add safety check
      console.warn('Property name is missing even though property_id exists:', finalPropertyId)
      finalPropertyName = 'Unknown Property'
    }

    console.log('Final property assignment:', {
      property_id: finalPropertyId,
      property_name: finalPropertyName
    })

    // Step 3: Create auth user using Admin API
    console.log('Step 3: Creating auth user via Admin API')
    
    const adminResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`
      },
      body: JSON.stringify({
        email,
        password,
        user_metadata: {
          name,
          role: 'tenant',
          property_id: finalPropertyId,  // Include as string for metadata
          property_name: finalPropertyName,
          unit_number: unit_number || null
        },
        email_confirm: false, // Send confirmation email to tenant
      })
    })
    
    // Parse Admin API response
    let adminResult: any = {}
    try {
      const responseText = await adminResponse.text()
      if (responseText && responseText.trim() !== '') {
        adminResult = JSON.parse(responseText)
      }
    } catch (parseError) {
      console.error('Error parsing Admin API response:', parseError)
      return new Response(
        JSON.stringify({ 
          error: 'Failed to create auth user',
          details: `Admin API returned invalid response`,
          status: adminResponse.status
        }),
        { 
          status: adminResponse.status || 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    if (!adminResponse.ok) {
      console.error('Admin API error:', adminResult)
      return new Response(
        JSON.stringify({ 
          error: adminResult.error_description || adminResult.message || 'Failed to create auth user',
          details: adminResult,
          status: adminResponse.status
        }),
        { 
          status: adminResponse.status || 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const authUserId = adminResult.id || adminResult.user?.id
    if (!authUserId) {
      return new Response(
        JSON.stringify({ 
          error: 'Auth user created but no user ID returned',
          details: adminResult
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('✅ Auth user created successfully:', authUserId)

    // Step 4: Wait for database trigger to create user, then update with complete data
    console.log('Step 4: Waiting for database trigger and updating user record')
    
    // Wait longer for trigger to complete, and retry if needed
    let userData: any = null
    let userError: any = null
    
    for (let attempt = 1; attempt <= 5; attempt++) {
      console.log(`Update attempt ${attempt}/5...`)
      await new Promise(resolve => setTimeout(resolve, 300))
      
      // Try to update user record with complete tenant data
      const updateResult = await supabase
        .from('users')
        .update({
          name,
          email,
          role: 'tenant',
          property_id: finalPropertyId,
          property_name: finalPropertyName,
          unit_number: unit_number || null,
          approved: false // Default to pending approval
        })
        .eq('id', authUserId)
        .select('id, name, email, role, property_id, property_name, unit_number, approved')
        .single()

      userData = updateResult.data
      userError = updateResult.error
      
      if (!userError && userData) {
        console.log(`✅ User profile updated successfully on attempt ${attempt}`)
        break
      } else if (userError && (userError.code === 'PGRST116' || userError.message?.includes('No rows'))) {
        // User doesn't exist yet, wait and retry
        if (attempt < 5) {
          console.log(`User doesn't exist yet, waiting 300ms before retry...`)
          continue
        } else {
          // Final attempt failed, try to insert instead
          console.log('Trigger did not create user, attempting INSERT...')
          const insertResult = await supabase
            .from('users')
            .insert({
              id: authUserId,
              name,
              email,
              role: 'tenant',
              property_id: finalPropertyId,
              property_name: finalPropertyName,
              unit_number: unit_number || null,
              approved: false
            })
            .select('id, name, email, role, property_id, property_name, unit_number, approved')
            .single()
          
          userData = insertResult.data
          userError = insertResult.error
          
          if (!userError && userData) {
            console.log('✅ User profile created via INSERT')
          }
        }
      } else {
        // Other error
        break
      }
    }

    if (userError) {
      console.error('Error updating/creating user record:', userError)
      // Still return success if auth user was created, but warn about database issue
      return new Response(
        JSON.stringify({ 
          success: true,
          warning: 'Auth user created but database record may be incomplete',
          user_id: authUserId,
          email,
          name,
          property_id: finalPropertyId,
          property_name: finalPropertyName,
          unit_number: unit_number || null,
          database_error: userError.message,
          message: 'Tenant auth user created. You may need to manually fix the database record.',
          troubleshooting: 'Check Supabase logs and run: SELECT * FROM users WHERE id = \'' + authUserId + '\''
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('✅ Tenant created successfully:', userData?.id || authUserId)

    // Note: When email_confirm: false, Supabase automatically sends a confirmation email
    // The tenant will receive an email with a confirmation link to verify their account

    // Return success response
    return new Response(
      JSON.stringify({ 
        success: true, 
        user_id: authUserId,
        email,
        name,
        property_id: finalPropertyId,
        property_name: finalPropertyName,
        unit_number: unit_number || null,
        message: 'Tenant account created successfully. A confirmation email has been sent. Please check your email to verify your account before signing in.'
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error creating tenant:', error)
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Internal server error',
        details: error
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

