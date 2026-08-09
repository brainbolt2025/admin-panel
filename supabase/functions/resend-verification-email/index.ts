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
 * Auth redirect_to / post-verify landing for tenant/technician emails.
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

/** Mailgun link → confirm-mobile-email (sets Auth + public.users.email_verified), then redirects to app. */
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

/** Resend uses magiclink (user already exists); signup type hits email_exists. */
function buildMobileVerifyLink(
  linkData: Record<string, unknown>,
  verifyType: 'magiclink' | 'signup' = 'magiclink',
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
      const url = new URL(actionLink)
      token = url.searchParams.get('token') || url.searchParams.get('token_hash')
    } catch {
      // ignore
    }
  }
  if (!token) return null
  return buildConfirmMobileEmailLink(token, verifyType, userId)
}

// TypeScript interface for the request body
interface ResendVerificationRequest {
  email: string
}

// Resends the same Mailgun-branded verification email used at signup
// (create-tenant / create-technician), without recreating the auth user.
serve(async (req) => {
  console.log('resend-verification-email invoked with method:', req.method)

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
    let body: ResendVerificationRequest
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

    const email = body.email?.trim()

    if (!email) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: email' }),
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
        JSON.stringify({ error: 'Missing Supabase service role key. Please set SUPABASE_SERVICE_ROLE_KEY secret.' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Step 1: Look up the existing user (must already exist — this function never creates users)
    console.log('Looking up user by email:', email)
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, name, email, role, property_name, email_verified')
      .eq('email', email)
      .maybeSingle()

    if (userError) {
      console.error('Error looking up user:', userError)
      return new Response(
        JSON.stringify({ error: 'Failed to look up user', details: userError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    if (!user) {
      return new Response(
        JSON.stringify({ error: `No account found for ${email}.` }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    if (user.email_verified) {
      return new Response(
        JSON.stringify({ error: 'This email is already verified. Please sign in.' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    const role = user.role as string | null
    const isTenant = role === 'tenant'
    const isTechnician = role === 'technician'
    const name = user.name || (isTechnician ? 'Technician' : 'Tenant')
    const propertyName = user.property_name || 'your property'

    // Step 2: Landing URL for Auth redirect + custom Mailgun link
    const redirectTo = mobileAuthVerifiedBase()

    console.log('Generating verification link with redirect_to:', redirectTo)

    // Step 3: Existing users → magiclink (type signup returns email_exists)
    const generateLinkResponse = await fetch(`${supabaseUrl}/auth/v1/admin/generate_link`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseServiceKey,
        Authorization: `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        type: 'magiclink',
        email,
        redirect_to: redirectTo,
      }),
    })

    if (!generateLinkResponse.ok) {
      const errorData = await generateLinkResponse.json().catch(() => ({}))
      console.error('Error generating verification link:', errorData)
      return new Response(
        JSON.stringify({
          error: errorData.error_description || errorData.msg || errorData.message || 'Failed to generate verification link',
        }),
        {
          status: generateLinkResponse.status || 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    const linkData = await generateLinkResponse.json()
    const verifyLink = (isTenant || isTechnician)
      ? (buildMobileVerifyLink(linkData, 'magiclink', user.id) || extractActionLink(linkData))
      : extractActionLink(linkData)

    if (!verifyLink) {
      console.error('No hashed_token/action_link in generate_link response:', JSON.stringify(linkData, null, 2))
      return new Response(
        JSON.stringify({ error: 'Verification link generated but no token found in response' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    console.log('Verification link configured:', {
      linkPreview: verifyLink.substring(0, 100) + '...',
      hasQueryToken: verifyLink.includes('token='),
      role,
    })

    // Step 4: Send the same branded email via Mailgun as the original signup email
    const MAILGUN_DOMAIN = Deno.env.get('MAILGUN_DOMAIN') || 'mg.asine.app'
    const MAILGUN_API_KEY = Deno.env.get('MAILGUN_API_KEY') || ''
    const MAILGUN_REGION = Deno.env.get('MAILGUN_REGION') || 'us'

    if (!MAILGUN_API_KEY) {
      console.warn('MAILGUN_API_KEY not configured, cannot send resend email')
      return new Response(
        JSON.stringify({ error: 'Email service not configured. Please contact support.' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    const accountType = isTenant ? 'tenant' : isTechnician ? 'technician' : 'account'

    const htmlBody = asineEmailHtml({
      title: 'Welcome to Asine',
      greeting: `Hi ${name},`,
      paragraphs: [
        `Please verify your email to activate your ${accountType} account at ${propertyName}.`,
        'After verifying your email, your account will be reviewed by your property manager before you can sign in.',
      ],
      cta: { label: 'Verify Account', href: verifyLink },
      noticeHtml: '<strong>Important:</strong> This verification link expires in 24 hours.',
      secondaryNote: "If you didn't request this, please ignore this email.",
      signOff: null,
      fallbackLink: verifyLink,
    })

    const textBody = `Welcome to Asine

Hi ${name},

Please verify your email to activate your ${accountType} account at ${propertyName}.

Verification Link: ${verifyLink}

This link expires in 24 hours.

After verifying your email, your account will be reviewed by your property manager before you can sign in.

If you didn't request this, please ignore this email.`

    const mailgunBaseUrl = MAILGUN_REGION === 'eu'
      ? 'https://api.eu.mailgun.net/v3'
      : 'https://api.mailgun.net/v3'
    const mailgunUrl = `${mailgunBaseUrl}/${MAILGUN_DOMAIN}/messages`
    const authHeader = `Basic ${btoa(`api:${MAILGUN_API_KEY}`)}`

    const formData = new FormData()
    formData.append('from', `Asine Admin <noreply@${MAILGUN_DOMAIN}>`)
    formData.append('to', email)
    formData.append('subject', `Verify your Asine ${accountType} account`)
    formData.append('html', htmlBody)
    formData.append('text', textBody)

    const mailgunResponse = await fetch(mailgunUrl, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
      },
      body: formData,
    })

    if (!mailgunResponse.ok) {
      const errorText = await mailgunResponse.text().catch(() => 'Unknown error')
      console.error('Failed to resend verification email via Mailgun:', {
        status: mailgunResponse.status,
        error: errorText,
      })
      return new Response(
        JSON.stringify({ error: `Failed to send verification email: ${errorText}` }),
        {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    const mailgunResult = await mailgunResponse.json().catch(() => ({}))
    console.log('✅ Verification email resent successfully to:', email)
    console.log('Mailgun message ID:', mailgunResult.id)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Verification email sent. Please check your inbox and spam folder.',
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  } catch (error) {
    console.error('Error in resend-verification-email function:', error)

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
})
