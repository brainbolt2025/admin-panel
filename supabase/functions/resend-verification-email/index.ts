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

    // Step 2: Determine redirect URL (same logic/env vars as create-tenant / create-technician)
    let redirectTo: string
    if (isTenant) {
      const TENANT_APP_DEEP_LINK_SCHEME = Deno.env.get('TENANT_APP_DEEP_LINK_SCHEME') || Deno.env.get('APP_DEEP_LINK_SCHEME') || ''
      const TENANT_APP_URL =
        Deno.env.get('TENANT_APP_URL') ||
        Deno.env.get('APP_URL') ||
        Deno.env.get('SITE_URL') ||
        Deno.env.get('BASE_URL') ||
        'http://localhost:5173'

      redirectTo = TENANT_APP_DEEP_LINK_SCHEME
        ? `${TENANT_APP_DEEP_LINK_SCHEME}auth/verified`
        : TENANT_APP_URL.replace(/\/$/, '')
    } else {
      const APP_DEEP_LINK_SCHEME = Deno.env.get('APP_DEEP_LINK_SCHEME') || ''
      const APP_URL = Deno.env.get('APP_URL') || Deno.env.get('SITE_URL') || Deno.env.get('BASE_URL') || ''

      if (APP_DEEP_LINK_SCHEME) {
        redirectTo = `${APP_DEEP_LINK_SCHEME}auth/verified`
      } else if (APP_URL) {
        redirectTo = `${APP_URL}/auth/verified`
      } else {
        redirectTo = 'https://admin.asine.app/auth/verified'
      }
    }

    console.log('Generating verification link with redirect_to:', redirectTo)

    // Step 3: Generate a fresh confirmation link via Supabase Admin API
    const generateLinkResponse = await fetch(`${supabaseUrl}/auth/v1/admin/generate_link`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseServiceKey,
        Authorization: `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        type: 'signup',
        email,
        redirect_to: redirectTo,
      }),
    })

    if (!generateLinkResponse.ok) {
      const errorData = await generateLinkResponse.json().catch(() => ({}))
      console.error('Error generating verification link:', errorData)
      return new Response(
        JSON.stringify({
          error: errorData.error_description || errorData.message || 'Failed to generate verification link',
        }),
        {
          status: generateLinkResponse.status || 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    const linkData = await generateLinkResponse.json()
    const verifyLink = linkData.action_link || linkData.properties?.action_link || linkData.properties?.actionLink

    if (!verifyLink) {
      console.error('No action_link found in generated link data:', JSON.stringify(linkData, null, 2))
      return new Response(
        JSON.stringify({ error: 'Verification link generated but no action link found in response' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    console.log('Found action_link:', verifyLink.substring(0, 100) + '...')

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

    const htmlBody = `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #0f766e; margin-bottom: 20px;">Welcome to Asine</h2>
          <p>Hi ${name},</p>
          <p>Please verify your email to activate your ${accountType} account at ${propertyName}.</p>
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
            If you didn't request this, please ignore this email.
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
