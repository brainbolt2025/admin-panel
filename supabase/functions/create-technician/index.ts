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
 * Auth redirect_to / post-verify landing for technician emails.
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
      const parsed = new URL(actionLink)
      token = parsed.searchParams.get('token') || parsed.searchParams.get('token_hash')
    } catch {
      // ignore
    }
  }
  if (!token) return null
  return buildConfirmMobileEmailLink(token, 'signup', userId)
}

// TypeScript interface for the request body
interface CreateTechnicianRequest {
  email: string
  first_name: string
  last_name: string
  property_id?: string
  property_name?: string
  /** @deprecated PM no longer sets password — ignored if sent */
  password?: string
  /** @deprecated Use first_name + last_name */
  name?: string
}

/** Cryptographically random 6-digit numeric password (100000–999999). */
function generateSixDigitPassword(): string {
  const buf = new Uint32Array(1)
  crypto.getRandomValues(buf)
  return String(100000 + (buf[0] % 900000))
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

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

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

    // Require a valid caller JWT and a PM profile for a specific property
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    const supabaseAuthed = createClient(supabaseUrl, supabaseAnonKey || supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: authData, error: authError } = await supabaseAuthed.auth.getUser()
    if (authError || !authData.user) {
      console.error('Authentication error:', authError)
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const { data: pmProfile, error: pmProfileError } = await supabase
      .from('users')
      .select('id, role, property_id, property_name')
      .eq('id', authData.user.id)
      .maybeSingle()

    if (pmProfileError || !pmProfile || pmProfile.role !== 'pm' || !pmProfile.property_id) {
      console.error('PM authorization failed:', {
        userId: authData.user.id,
        role: pmProfile?.role,
        hasProperty: !!pmProfile?.property_id,
        error: pmProfileError?.message,
      })
      return new Response(
        JSON.stringify({ error: 'Only property managers can invite technicians for their property.' }),
        {
          status: 403,
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
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    const firstName = (body.first_name || '').trim()
    const lastName = (body.last_name || '').trim()
    const email = (body.email || '').trim()
    const { property_id, property_name } = body
    const name =
      [firstName, lastName].filter(Boolean).join(' ') ||
      (typeof body.name === 'string' ? body.name.trim() : '')

    // Validate required fields (PM provides names + email; password is generated)
    if (!email || !firstName || !lastName) {
      return new Response(
        JSON.stringify({
          error: 'Missing required fields. Required: email, first_name, last_name',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    const password = generateSixDigitPassword()

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

    // Caller may only invite for their own property (ignore/reject mismatched body)
    if (property_id && property_id !== pmProfile.property_id) {
      console.error('Property mismatch:', {
        requested: property_id,
        pmProperty: pmProfile.property_id,
      })
      return new Response(
        JSON.stringify({ error: 'You can only invite technicians for your own property.' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

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

    // Step 2: Always scope to the authenticated PM's property
    let finalPropertyId: string = pmProfile.property_id
    let finalPropertyName: string | null =
      property_name || pmProfile.property_name || null

    if (!finalPropertyName) {
      console.log('Resolving property name from PM property_id:', finalPropertyId)
      const { data: propData, error: propError } = await supabase
        .from('properties')
        .select('id, name')
        .eq('id', finalPropertyId)
        .maybeSingle()

      if (!propError && propData) {
        finalPropertyName = propData.name
        console.log('Property found by ID:', propData)
      } else {
        console.warn('Property name missing for PM property. Using fallback.')
        finalPropertyName = 'Unknown Property'
      }
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
          approved: 'approved',
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
              approved: 'approved',
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

    // Step 5: Generate verification link and send credentials email
    // (PM invited this technician — skip notify-pm-signup)
    console.log('Step 5: Sending verification email to technician')
    
    let emailSent = false
    let emailError: string | null = null
    
    try {
      const redirectTo = mobileAuthVerifiedBase()

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

          // Send email using Mailgun (same approach as tenants)
          const MAILGUN_DOMAIN = Deno.env.get('MAILGUN_DOMAIN') || 'mg.asine.app'
          const MAILGUN_API_KEY = Deno.env.get('MAILGUN_API_KEY') || ''
          const MAILGUN_REGION = Deno.env.get('MAILGUN_REGION') || 'us'
          
          if (!MAILGUN_API_KEY) {
            console.warn('MAILGUN_API_KEY not configured, skipping custom email send')
            emailError = 'Email service not configured. Supabase default email may be sent.'
          } else {
            // Build technician invite email: verify deep link + login credentials
            const htmlBody = asineEmailHtml({
              title: 'Welcome to Asine',
              greeting: `Hi ${name},`,
              paragraphs: [
                `Your property manager invited you as a technician at <strong>${finalPropertyName || 'your property'}</strong>.`,
                'Tap the button below to verify your email and open the Asine app. Then sign in with the credentials below.',
              ],
              extraHtml: `<div style="background: #f0fdfa; border: 1px solid #99f6e4; border-radius: 8px; padding: 16px; margin: 24px 0;">
                      <p style="margin: 0 0 8px 0; font-weight: bold; color: #0f766e;">Your login credentials</p>
                      <p style="margin: 4px 0;"><strong>Email:</strong> ${email}</p>
                      <p style="margin: 4px 0;"><strong>Temporary password:</strong> <span style="font-size: 1.25rem; letter-spacing: 0.15em; font-family: monospace;">${password}</span></p>
                    </div>`,
              cta: { label: 'Verify & Open App', href: verifyLink },
              noticeHtml: '<strong>Important:</strong> The verification link expires in 24 hours. You can change your password after signing in.',
              secondaryNote: "If you didn't expect this invitation, please ignore this email.",
              signOff: null,
              fallbackLink: verifyLink,
            })
            
            const textBody = `Welcome to Asine

Hi ${name},

Your property manager invited you as a technician at ${finalPropertyName || 'your property'}.

Verify your email and open the app:
${verifyLink}

Your login credentials:
Email: ${email}
Temporary password: ${password}

The verification link expires in 24 hours. You can change your password after signing in.

If you didn't expect this invitation, please ignore this email.`
            
            // Send via Mailgun
            const mailgunBaseUrl = MAILGUN_REGION === 'eu' 
              ? 'https://api.eu.mailgun.net/v3'
              : 'https://api.mailgun.net/v3'
            const mailgunUrl = `${mailgunBaseUrl}/${MAILGUN_DOMAIN}/messages`
            const authHeader = `Basic ${btoa(`api:${MAILGUN_API_KEY}`)}`
            
            const formData = new FormData()
            formData.append('from', `Asine Admin <noreply@${MAILGUN_DOMAIN}>`)
            formData.append('to', email)
            formData.append('subject', 'Your Asine technician invitation')
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
        first_name: firstName,
        last_name: lastName,
        property_id: finalPropertyId,
        property_name: finalPropertyName,
        approved: 'approved',
        email_sent: emailSent,
        email_error: emailError || undefined,
        message: emailSent
          ? 'Technician invited successfully. Login credentials and a verification link were emailed.'
          : 'Technician account created. ' +
            (emailError
              ? 'However, there was an issue sending the invitation email. ' + emailError + '.'
              : 'An invitation email may have been sent.'),
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

