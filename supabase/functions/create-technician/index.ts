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
        email_confirm: false, // Send confirmation email to technician
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
          approved: 'pending',
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
              approved: 'pending',
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

    // Step 4.5: Notify PM about new technician signup (non-blocking)
    try {
      console.log('Notifying PM about new technician signup')
      const notifyPMResponse = await fetch(`${supabaseUrl}/functions/v1/notify-pm-signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'apikey': supabaseServiceKey,
        },
        body: JSON.stringify({
          property_id: finalPropertyId,
          user_name: name,
          user_email: email,
          user_role: 'technician',
        }),
      })
      
      if (notifyPMResponse.ok) {
        const pmNotifyResult = await notifyPMResponse.json().catch(() => ({}))
        console.log('✅ PM notification sent:', pmNotifyResult)
      } else {
        const pmNotifyError = await notifyPMResponse.text().catch(() => 'Unknown error')
        console.warn('⚠️ PM notification failed (non-critical):', pmNotifyError)
      }
    } catch (pmNotifyError) {
      console.warn('⚠️ PM notification error (non-critical):', pmNotifyError)
      // Continue - PM notification failure shouldn't block technician creation
    }

    // Step 5: Generate verification link and send email (same approach as tenants)
    console.log('Step 5: Sending verification email to technician')
    
    let emailSent = false
    let emailError: string | null = null
    
    try {
      // Determine redirect URL based on environment
      const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY') || ''
      const isTestMode = stripeSecretKey.startsWith('sk_test_')
      
      // Get deep link configuration
      let APP_DEEP_LINK_SCHEME = Deno.env.get('APP_DEEP_LINK_SCHEME') || ''
      let APP_URL = Deno.env.get('APP_URL') || Deno.env.get('SITE_URL') || Deno.env.get('BASE_URL') || ''
      
      // Determine redirect URL
      let redirectTo: string
      if (APP_DEEP_LINK_SCHEME) {
        redirectTo = `${APP_DEEP_LINK_SCHEME}auth/verified`
      } else if (APP_URL) {
        redirectTo = `${APP_URL}/auth/verified`
      } else {
        redirectTo = 'https://www.sycnmore.com/auth/verified'
      }
      
      console.log('Generating verification link with redirect_to:', redirectTo)
      
      // Use Supabase Admin API to generate a confirmation link (same as tenants)
      const generateLinkResponse = await fetch(`${supabaseUrl}/auth/v1/admin/generate_link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseServiceKey,
          'Authorization': `Bearer ${supabaseServiceKey}`
        },
        body: JSON.stringify({
          type: 'signup',
          email: email,
          redirect_to: redirectTo,
        })
      })

      if (!generateLinkResponse.ok) {
        const errorData = await generateLinkResponse.json().catch(() => ({}))
        console.error('Error generating verification link:', errorData)
        emailError = errorData.error_description || errorData.message || 'Failed to generate verification link'
      } else {
        const linkData = await generateLinkResponse.json()
        const actionLink = linkData.action_link || linkData.properties?.action_link || linkData.properties?.actionLink
        
        if (!actionLink) {
          console.error('No action_link found in generated link data:', JSON.stringify(linkData, null, 2))
          emailError = 'Verification link generated but no action link found in response'
        } else {
          console.log('Found action_link:', actionLink.substring(0, 100) + '...')
          
          // Use Supabase's action_link directly (same as tenants)
          const verifyLink = actionLink
          
          console.log('Verification link configured:', {
            actionLink: actionLink.substring(0, 150) + '...',
            note: 'Using Supabase action_link directly for email verification'
          })
          
          // Send email using Mailgun (same approach as tenants)
          const MAILGUN_DOMAIN = Deno.env.get('MAILGUN_DOMAIN') || 'mg.asine.app'
          const MAILGUN_API_KEY = Deno.env.get('MAILGUN_API_KEY') || ''
          const MAILGUN_REGION = Deno.env.get('MAILGUN_REGION') || 'us'
          
          if (!MAILGUN_API_KEY) {
            console.warn('MAILGUN_API_KEY not configured, skipping custom email send')
            emailError = 'Email service not configured. Supabase default email may be sent.'
          } else {
            // Build technician-specific email HTML
            const htmlBody = `
                <html>
                  <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #0f766e; margin-bottom: 20px;">Welcome to Asine</h2>
                    <p>Hi ${name},</p>
                    <p>Please verify your email to activate your technician account at ${finalPropertyName || 'your property'}.</p>
                    <div style="text-align: center; margin: 30px 0;">
                      <a href="${verifyLink}" 
                        style="background: #0f766e; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; display: inline-block; font-weight: bold;">
                        Verify Account
                      </a>
                    </div>
                    <p style="color: #666; font-size: 14px; margin-top: 30px;">
                      <strong>Important:</strong> This verification link expires in 24 hours.
                    </p>
                    <p style="color: #666; font-size: 14px;">
                      After verifying your email, your account will be reviewed by your property manager before you can sign in.
                    </p>
                    <p style="color: #666; font-size: 14px;">
                      If you didn't create an account, please ignore this email.
                    </p>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                    <p style="color: #999; font-size: 12px;">
                      If the button doesn't work, copy and paste this link into your browser:<br>
                      <a href="${verifyLink}" style="color: #0f766e; word-break: break-all;">${verifyLink}</a>
                    </p>
                  </body>
                </html>
            `
            
            const textBody = `Welcome to Asine

Hi ${name},

Please verify your email to activate your technician account at ${finalPropertyName || 'your property'}.

Verification Link: ${verifyLink}

This link expires in 24 hours.

After verifying your email, your account will be reviewed by your property manager before you can sign in.

If you didn't create an account, please ignore this email.`
            
            // Send via Mailgun
            const mailgunBaseUrl = MAILGUN_REGION === 'eu' 
              ? 'https://api.eu.mailgun.net/v3'
              : 'https://api.mailgun.net/v3'
            const mailgunUrl = `${mailgunBaseUrl}/${MAILGUN_DOMAIN}/messages`
            const authHeader = `Basic ${btoa(`api:${MAILGUN_API_KEY}`)}`
            
            const formData = new FormData()
            formData.append('from', `Asine Admin <noreply@${MAILGUN_DOMAIN}>`)
            formData.append('to', email)
            formData.append('subject', 'Verify your Asine technician account')
            formData.append('html', htmlBody)
            formData.append('text', textBody)
            
            const mailgunResponse = await fetch(mailgunUrl, {
              method: 'POST',
              headers: {
                Authorization: authHeader,
              },
              body: formData,
            })
            
            if (mailgunResponse.ok) {
              const mailgunResult = await mailgunResponse.json()
              console.log('✅ Verification email sent successfully to:', email)
              console.log('Mailgun message ID:', mailgunResult.id)
              emailSent = true
            } else {
              const errorText = await mailgunResponse.text().catch(() => 'Unknown error')
              console.error('Failed to send verification email via Mailgun:', {
                status: mailgunResponse.status,
                error: errorText
              })
              emailError = `Mailgun error: ${mailgunResponse.status} ${errorText}`
            }
          }
        }
      }
    } catch (error) {
      console.error('Error in email verification process:', error)
      emailError = error instanceof Error ? error.message : 'Unknown error sending verification email'
    }

    // Note: We don't fetch an access token here because the email must be confirmed first
    // The technician will need to verify their email, then sign in normally to get a token
    console.log('Skipping token fetch - technician must verify email first before signing in')

    return new Response(
      JSON.stringify({
        success: true,
        user_id: authUserId,
        email,
        name,
        property_id: finalPropertyId,
        property_name: finalPropertyName,
        approved: 'pending',
        email_sent: emailSent,
        email_error: emailError || undefined,
        message: emailSent 
          ? 'Technician account created successfully. A verification email has been sent. Please check your email to verify your account before signing in.'
          : 'Technician account created successfully. ' + (emailError ? 'However, there was an issue sending the verification email. ' + emailError + '.' : 'A verification email may have been sent.') + ' Please verify your email before signing in. Your account awaits PM approval after email verification.',
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

