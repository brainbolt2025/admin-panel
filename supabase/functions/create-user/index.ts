// Import Supabase client
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
// Import serve from Deno standard library
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

// CORS headers for cross-origin requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// TypeScript interface for the request body
interface CreateUserRequest {
  email: string
  password: string
  name: string
  property_name: string
}

// Main handler function
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Parse the request body
    const body: CreateUserRequest = await req.json()
    const { email, password, name, property_name } = body

    // Validate required fields
    if (!email || !password || !name || !property_name) {
      return new Response(
        JSON.stringify({ 
          error: 'Missing required fields. Required: email, password, name, property_name' 
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

    // Initialize Supabase client with service role key (server-side only)
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    
    // Fallback to direct environment variables if secrets are not set
    const finalSupabaseUrl = supabaseUrl || 'https://goljbyvrnktxwtnjomaq.supabase.co'
    const finalSupabaseServiceKey = supabaseServiceKey || (Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
    
    if (!finalSupabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Missing Supabase service role key. Please set SUPABASE_SERVICE_ROLE_KEY secret.' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const supabase = createClient(finalSupabaseUrl, finalSupabaseServiceKey)

    // Step 1: Create user in Supabase Auth using regular signup
    console.log('Step 1: Attempting to create auth user with email:', email)
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
          property_name,
          role: 'pm'
        }
      }
    })

    if (authError) {
      console.error('❌ STEP 1 FAILED: Auth user creation error')
      console.error('Auth error object:', authError)
      console.error('Auth error type:', typeof authError)
      console.error('Auth error constructor:', authError?.constructor?.name)
      // Try to get all error information
      const errorInfo: any = {}
      try {
        errorInfo.message = authError.message
        errorInfo.status = authError.status
        errorInfo.code = authError.code
        errorInfo.name = authError.name
        errorInfo.stack = authError.stack
        
        // Try to access all properties
        for (const key in authError) {
          try {
            errorInfo[key] = authError[key]
          } catch (e) {
            errorInfo[key] = '[Unable to serialize]'
          }
        }
        
        // Try JSON stringify
        try {
          errorInfo.stringified = JSON.stringify(authError, null, 2)
        } catch (e) {
          errorInfo.stringified = '[Unable to stringify]'
        }
        
        // Try with Object.getOwnPropertyNames
        try {
          errorInfo.allProperties = JSON.stringify(authError, Object.getOwnPropertyNames(authError), 2)
        } catch (e) {
          errorInfo.allProperties = '[Unable to stringify with all properties]'
        }
      } catch (e) {
        errorInfo.stringifyError = String(e)
      }
      
      console.error('=== FULL AUTH ERROR INFO ===')
      console.error('Error info object:', JSON.stringify(errorInfo, null, 2))
      console.error('Auth error message:', authError.message)
      console.error('Auth error status:', authError.status)
      console.error('Auth error code:', authError.code)
      console.error('Auth error name:', authError.name)
      console.error('Auth error stack:', authError.stack)
      
      // Log all properties of the error
      console.error('=== ITERATING THROUGH ERROR PROPERTIES ===')
      for (const key in authError) {
        try {
          console.error(`Auth error.${key}:`, String(authError[key]))
        } catch (e) {
          console.error(`Auth error.${key}:`, '[Error accessing property]')
        }
      }
      
      // Try to access common AuthApiError properties
      if (authError instanceof Error) {
        console.error('Is Error instance: true')
        console.error('Error toString:', authError.toString())
      }
      
      // Check for Supabase-specific error properties
      const supabaseError = authError as any
      if (supabaseError.response) {
        console.error('Error response object:', supabaseError.response)
        try {
          console.error('Error response status:', supabaseError.response?.status)
          console.error('Error response statusText:', supabaseError.response?.statusText)
          console.error('Error response url:', supabaseError.response?.url)
          // Note: Can't await here, but can check for text method
          if (supabaseError.response?.text) {
            supabaseError.response.text().then((responseText: string) => {
              console.error('Error response body (text):', responseText)
              try {
                const responseJson = JSON.parse(responseText)
                console.error('Error response body (parsed):', JSON.stringify(responseJson, null, 2))
              } catch (e) {
                console.error('Could not parse response as JSON')
              }
            }).catch((e: any) => {
              console.error('Error reading response text:', e)
            })
          }
        } catch (e) {
          console.error('Error accessing response properties:', e)
        }
      }
      if (supabaseError.context) {
        console.error('Error context:', supabaseError.context)
      }
      
      // Try to get the actual error message from the response
      if (supabaseError.message) {
        console.error('Original error message:', supabaseError.message)
      }
      
      // Log the entire error as a string
      console.error('Error as string:', String(authError))
      console.error('Error toString():', authError.toString())
      
      // Extract error message - handle different formats
      const errorMsg = authError.message || 'Unknown error'
      
      // Provide detailed error message
      let errorMessage = `[AUTH STEP] Failed to create auth user: ${errorMsg}`
      if (authError.status) {
        errorMessage += ` (HTTP Status: ${authError.status})`
      }
      if (authError.code) {
        errorMessage += ` (Error Code: ${authError.code})`
      }
      if (authError.error_description) {
        errorMessage += ` (Description: ${authError.error_description})`
      }
      if (authError.name) {
        errorMessage += ` (Error Type: ${authError.name})`
      }
      
      // If the message contains "Database error", it might be from a trigger
      if (errorMsg.includes('Database error') || errorMsg.includes('database')) {
        console.error('⚠️ WARNING: Error message suggests database issue during auth creation')
        console.error('This might indicate a database trigger or function is failing when creating the auth user')
        console.error('Check your database for triggers on auth.users table')
      }
      
      // Extract all available error information for response
      const authErrorResponse: any = {
        message: authError.message,
        status: authError.status,
        code: authError.code,
        name: authError.name,
        error_description: authError.error_description
      }
      
      // Try to get response body if available
      const supabaseError = authError as any
      if (supabaseError.response) {
        try {
          authErrorResponse.response_status = supabaseError.response?.status
          authErrorResponse.response_statusText = supabaseError.response?.statusText
        } catch (e) {
          // Ignore
        }
      }
      
      return new Response(
        JSON.stringify({ 
          error: errorMessage,
          step: 'auth_creation',
          auth_error: authErrorResponse
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }
    
    console.log('✅ Step 1: Auth user created successfully')

    if (!authData.user) {
      return new Response(
        JSON.stringify({ error: 'User creation failed - no user data returned' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const authUserId = authData.user.id
    console.log('Auth user created successfully:', authUserId)

    // Step 2: Check if user already exists (email unique constraint)
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', email)
      .maybeSingle()

    // If there's a database error (not just "not found"), log it but continue
    if (checkError && checkError.code !== 'PGRST116') {
      console.warn('Error checking for existing user:', checkError)
    }

    if (existingUser) {
      console.error('User with this email already exists:', existingUser.id)
      // Try to clean up the auth user
      try {
        await supabase.auth.admin.deleteUser(authUserId)
      } catch (cleanupError) {
        console.error('Failed to cleanup auth user:', cleanupError)
      }
      
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

    // Step 3: Create or update profile in custom users table with 'pm' role
    // Note: A database trigger might have already created the user with 'tenant' role
    console.log('Step 3: Attempting to create/update user profile in database')
    console.log('Auth user ID to use:', authUserId)
    
    // First, check if user already exists (trigger might have created it)
    const { data: existingProfile, error: checkError } = await supabase
      .from('users')
      .select('id, name, email, role, property_name')
      .eq('id', authUserId)
      .maybeSingle()
    
    let userData
    let userError
    
    if (existingProfile) {
      // User exists (created by trigger), UPDATE it with PM data
      console.log('User profile exists (created by trigger), updating with PM data')
      console.log('Existing profile:', existingProfile)
      
      const { data: updatedData, error: updateError } = await supabase
        .from('users')
        .update({
          name,
          email,
          property_name,
          role: 'pm', // Property Manager role (matches constraint)
          approved: false, // Will be approved after payment
          subscribed: false, // Will be updated after payment
          subscription_status: 'pending'
        })
        .eq('id', authUserId)
        .select('id, name, email, role, property_name, approved, subscribed, subscription_status')
        .single()
      
      userData = updatedData
      userError = updateError
    } else {
      // User doesn't exist (trigger failed or didn't run), INSERT it
      console.log('User profile does not exist, creating new profile')
      
      const { data: insertedData, error: insertError } = await supabase
        .from('users')
        .insert({
          id: authUserId, // Use the auth user ID to link with auth.users
          name,
          email,
          property_name,
          role: 'pm', // Property Manager role (matches constraint)
          approved: false, // Will be approved after payment
          subscribed: false, // Will be updated after payment
          subscription_status: 'pending'
        })
        .select('id, name, email, role, property_name, approved, subscribed, subscription_status')
        .single()
      
      userData = insertedData
      userError = insertError
    }

    if (userError) {
      console.error('❌ STEP 3 FAILED: User profile creation error')
      console.error('Database error object:', userError)
      console.error('Database error type:', typeof userError)
      console.error('Database error constructor:', userError?.constructor?.name)
      console.error('Database error stringified:', JSON.stringify(userError, Object.getOwnPropertyNames(userError), 2))
      console.error('Error code:', userError.code)
      console.error('Error message:', userError.message)
      console.error('Error details:', userError.details)
      console.error('Error hint:', userError.hint)
      console.error('All database error properties:', Object.keys(userError))
      
      // Log all properties of the error
      for (const key in userError) {
        console.error(`Database error.${key}:`, userError[key])
      }
      
      console.error('Attempted insert data:', JSON.stringify({
        id: authUserId,
        name,
        email,
        property_name,
        role: 'pm',
        approved: false,
        subscribed: false,
        subscription_status: 'pending'
      }, null, 2))
      
      // Try to clean up the auth user if profile creation fails
      try {
        await supabase.auth.admin.deleteUser(authUserId)
        console.log('Cleaned up auth user after profile creation failure')
      } catch (cleanupError) {
        console.error('Failed to cleanup auth user:', cleanupError)
      }
      
      // Provide more detailed error message with all available information
      let errorMessage = `[DATABASE STEP] Database error saving new user: ${userError.message || 'Unknown database error'}`
      if (userError.code) {
        errorMessage += ` (Code: ${userError.code})`
      }
      if (userError.details) {
        errorMessage += ` (Details: ${userError.details})`
      }
      if (userError.hint) {
        errorMessage += ` (Hint: ${userError.hint})`
      }
      
      return new Response(
        JSON.stringify({ 
          error: errorMessage,
          step: 'database_insert',
          database_error: {
            message: userError.message,
            code: userError.code,
            details: userError.details,
            hint: userError.hint,
            attempted_data: {
              id: authUserId,
              name,
              email,
              property_name,
              role: 'pm'
            },
            full_error: userError
          }
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('User profile created successfully:', userData.id)
    
    // Verify role was set correctly
    if (userData.role !== 'pm') {
      console.warn('WARNING: User role mismatch. Expected "pm", got:', userData.role)
    } else {
      console.log('User role confirmed as "pm"')
    }

    // Return success response with user ID and role
    return new Response(
      JSON.stringify({ 
        success: true, 
        user_id: userData.id,
        role: userData.role || 'pm', // Include role in response
        message: 'User account and profile created successfully with PM role'
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error creating user:', error)
    
    // Handle all other errors
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

/* 
DEPLOYMENT INSTRUCTIONS:
=======================
1. Set the Supabase service role key as a Supabase secret:
   supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

2. Deploy the function:
   supabase functions deploy create-user

3. Test the function from your frontend:
   
   fetch('https://YOUR_PROJECT.supabase.co/functions/v1/create-user', {
     method: 'POST',
     headers: {
       'Content-Type': 'application/json',
       'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
     },
     body: JSON.stringify({
       email: 'pm@example.com',
       password: 'securepassword',
       name: 'John Doe',
       property_name: 'Sunset Apartments'
     })
   })
   .then(res => res.json())
   .then(data => console.log(data))

WORKFLOW:
- Creates user in Supabase Auth with PM role metadata
- Creates profile in custom users table with PM role
- Returns user ID for use in subscription flow
- Handles cleanup if profile creation fails

4. Example response on success:
   {
     "success": true,
     "user_id": "uuid-of-created-user",
     "message": "User account and profile created successfully"
   }
*/
