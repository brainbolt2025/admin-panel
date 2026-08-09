// Import Supabase client
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
// Import serve from Deno standard library
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { asineEmailHtml } from '../_shared/asineEmailLayout.ts'

// CORS headers for cross-origin requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

/**
 * Auth redirect_to / post-verify landing for tenant emails.
 * MOBILE_VERIFY_REDIRECT_TO / APP_URL / SITE_URL / BASE_URL.
 * Allows https, http://localhost, and app schemes (asine://auth/verified).
 */
function defaultVerifyOrigin(): string {
  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY') || ''
  if (stripeKey.startsWith('sk_test_')) {
    return 'http://localhost:5173'
  }
  return 'https://www.sycnmore.com'
}

function isAllowedMobileRedirect(url: string): boolean {
  if (url.startsWith('https://')) return true
  if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1')) return true
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(url) && !url.startsWith('http://')) return true
  return false
}

function toAuthVerifiedBase(envRedirect: string, fallbackOrigin: string): string {
  const raw = envRedirect.replace(/\/+$/, '')
  if (!isAllowedMobileRedirect(raw)) {
    return `${fallbackOrigin.replace(/\/+$/, '')}/auth/verified`
  }
  if (/auth\/verified$/i.test(raw)) return raw
  if (/^[a-z][a-z0-9+.-]*:$/i.test(raw) || /^[a-z][a-z0-9+.-]*:\/\/$/i.test(envRedirect.trim())) {
    return `${raw.split(':')[0]}://auth/verified`
  }
  return `${raw}/auth/verified`
}

function mobileAuthVerifiedBase(): string {
  const envRedirect =
    Deno.env.get('MOBILE_VERIFY_REDIRECT_TO') ||
    Deno.env.get('APP_URL') ||
    Deno.env.get('SITE_URL') ||
    Deno.env.get('BASE_URL') ||
    defaultVerifyOrigin()
  return toAuthVerifiedBase(envRedirect, defaultVerifyOrigin())
}

function extractActionLink(linkData: Record<string, unknown>): string | null {
  const props = (linkData.properties || {}) as Record<string, unknown>
  const link = linkData.action_link || props.action_link || props.actionLink
  return typeof link === 'string' && link.length > 0 ? link : null
}

/** Mailgun link → confirm-mobile-email (Auth + email_verified), then redirects to app. */
function buildConfirmMobileEmailLink(
  token: string,
  verifyType: string,
  userId?: string,
): string {
  const supabaseUrl = (Deno.env.get('SUPABASE_URL') || '').replace(/\/$/, '')
  const params = new URLSearchParams({
    token,
    confirmation_token: token,
    type: verifyType,
  })
  if (userId) params.set('user_id', userId)
  return `${supabaseUrl}/functions/v1/confirm-mobile-email?${params.toString()}`
}

function buildMobileSignupVerifyLink(
  linkData: Record<string, unknown>,
  userId?: string,
): string | null {
  const props = (linkData.properties || {}) as Record<string, unknown>
  const actionLink = extractActionLink(linkData)
  let token =
    (typeof linkData.hashed_token === 'string' && linkData.hashed_token) ||
    (typeof props.hashed_token === 'string' && props.hashed_token) ||
    null
  if (!token && actionLink) {
    try {
      token = new URL(actionLink).searchParams.get('token') ||
        new URL(actionLink).searchParams.get('token_hash')
    } catch {
      // ignore
    }
  }
  if (!token) return null
  return buildConfirmMobileEmailLink(token, 'signup', userId)
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
          approved: 'pending' // Default to pending approval
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
              approved: 'pending'
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

    // Step 4.5: Notify PM about new tenant signup (non-blocking)
    try {
      console.log('Notifying PM about new tenant signup')
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
          user_role: 'tenant',
          unit_number: unit_number || undefined,
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
      // Continue - PM notification failure shouldn't block tenant creation
    }

    // Step 5: Generate verification link and send custom verification email
    console.log('Step 5: Sending verification email to tenant')
    
    let emailSent = false
    let emailError: string | null = null
    
    try {
      const redirectTo = mobileAuthVerifiedBase()

      console.log('Generating verification link with redirect_to:', redirectTo)

      // Use Supabase Admin API to generate a confirmation link
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
        // Prefer token_hash deep link for Android verifyOtp (keeps token in query, not #fragment)
        const verifyLink =
          buildMobileSignupVerifyLink(linkData, authUserId) || extractActionLink(linkData)

        if (!verifyLink) {
          console.error('No hashed_token/action_link in generate_link response:', JSON.stringify(linkData, null, 2))
          emailError = 'Verification link generated but no token found in response'
        } else {
          console.log('Verification link configured:', {
            linkPreview: verifyLink.substring(0, 150) + '...',
            hasQueryToken: verifyLink.includes('token='),
            redirectTo,
          })

          // Send email using Mailgun directly (with tenant-specific messaging)
          const MAILGUN_DOMAIN = Deno.env.get('MAILGUN_DOMAIN') || 'mg.asine.app'
          const MAILGUN_API_KEY = Deno.env.get('MAILGUN_API_KEY') || ''
          const MAILGUN_REGION = Deno.env.get('MAILGUN_REGION') || 'us'
          
          if (!MAILGUN_API_KEY) {
            console.warn('MAILGUN_API_KEY not configured, skipping custom email send')
            emailError = 'Email service not configured. Supabase default email may be sent.'
          } else {
            // Build tenant-specific email HTML
            const htmlBody = asineEmailHtml({
              title: 'Welcome to Asine',
              greeting: `Hi ${name},`,
              paragraphs: [
                `Please verify your email to activate your tenant account at ${finalPropertyName || 'your property'}.`,
                'After verifying your email, your account will be reviewed by your property manager before you can sign in.',
              ],
              cta: { label: 'Verify Account', href: verifyLink },
              noticeHtml: '<strong>Important:</strong> This verification link expires in 24 hours.',
              secondaryNote: "If you didn't create an account, please ignore this email.",
              fallbackLink: verifyLink,
            })
            
            const textBody = `Welcome to Asine

Hi ${name},

Please verify your email to activate your tenant account at ${finalPropertyName || 'your property'}.

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
            formData.append('subject', 'Verify your Asine tenant account')
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
      console.error('Error in email sending process:', error)
      emailError = error instanceof Error ? error.message : 'Unknown error sending verification email'
    }

    // Fetch access token for the newly created tenant (same approach as create-technician)
    // Note: Token may not work until email is confirmed by the user
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
      console.error('Error fetching tenant access token:', await serviceRoleResponse.text())
      return new Response(
        JSON.stringify({ 
          success: true, 
          user_id: authUserId,
          email,
          name,
          property_id: finalPropertyId,
          property_name: finalPropertyName,
          unit_number: unit_number || null,
          email_sent: emailSent,
          email_error: emailError || undefined,
          warning: 'Tenant created but failed to fetch access token.',
          message: emailSent 
            ? 'Tenant account created successfully. A verification email has been sent. Please check your email to verify your account before signing in.'
            : 'Tenant account created successfully. However, there was an issue sending the verification email. ' + (emailError || 'Please contact support.')
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const tokenResult = await serviceRoleResponse.json()

    // Return success response with access token
    return new Response(
      JSON.stringify({ 
        success: true, 
        user_id: authUserId,
        email,
        name,
        property_id: finalPropertyId,
        property_name: finalPropertyName,
        unit_number: unit_number || null,
        access_token: tokenResult.access_token,
        refresh_token: tokenResult.refresh_token,
        token_type: tokenResult.token_type,
        expires_in: tokenResult.expires_in,
        email_sent: emailSent,
        email_error: emailError || undefined,
        message: emailSent 
          ? 'Tenant account created successfully. A verification email has been sent. Please check your email to verify your account before signing in.'
          : 'Tenant account created successfully. However, there was an issue sending the verification email. ' + (emailError || 'Please contact support.')
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

