import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

interface InviteRequest {
  email: string
  name?: string
  role: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get authenticated user from request (Supabase handles JWT verification)
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ code: 401, message: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase client with anon key
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseClient = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    // Get the user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()

    if (userError || !user) {
      console.error('Authentication error:', userError)
      return new Response(
        JSON.stringify({ code: 401, message: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('User authenticated:', user.email)

    // TODO: Optional role check - uncomment when you have a users table
    // This checks if the authenticated user (inviter) is a super_admin
    /*
    const supabaseAdmin = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: userData, error: roleError } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (roleError || !userData || userData.role !== 'super_admin') {
      console.error('Role check error:', roleError)
      return new Response(
        JSON.stringify({ code: 403, message: 'Super admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    */

    // Parse request body
    let requestBody: InviteRequest
    try {
      requestBody = await req.json()
    } catch (error) {
      console.error('Error parsing request body:', error)
      return new Response(
        JSON.stringify({ code: 400, message: 'Invalid request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { email, name, role } = requestBody
    
    console.log('Received invite request:', { email, name, role })

    if (!email || !role) {
      console.error('Missing required fields:', { email: !!email, role: !!role })
      return new Response(
        JSON.stringify({ code: 400, message: 'Missing required fields: email and role are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ code: 400, message: 'Invalid email format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const siteUrl = Deno.env.get('SITE_URL') ?? 'https://admin.asine.app'
    const isLocal = siteUrl.includes('localhost')
    const subscribeBaseUrl = isLocal ? 'http://localhost:5173' : 'https://admin.asine.app'
    const subscribeLink = name 
      ? `${subscribeBaseUrl}/subscribe?email=${encodeURIComponent(email)}&name=${encodeURIComponent(name)}`
      : `${subscribeBaseUrl}/subscribe?email=${encodeURIComponent(email)}`

    const MAILGUN_DOMAIN = Deno.env.get('MAILGUN_DOMAIN') || ''
    const MAILGUN_API_KEY = Deno.env.get('MAILGUN_API_KEY') || ''
    const MAILGUN_REGION = Deno.env.get('MAILGUN_REGION') || 'us'

    if (!MAILGUN_DOMAIN || !MAILGUN_API_KEY) {
      console.error('Missing Mailgun configuration')
      return new Response(
        JSON.stringify({ code: 500, message: 'Mailgun configuration missing' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (MAILGUN_API_KEY.startsWith('pubkey-')) {
      console.error('MAILGUN_API_KEY must be a private key')
      return new Response(
        JSON.stringify({ code: 500, message: 'MAILGUN_API_KEY must be a private API key (starts with "key-")' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const greeting = name ? `Hi ${name},` : 'Hi there,'
    
    const htmlBody = `
      <html>
        <body style="font-family: Arial, sans-serif; color: #1f2933; line-height: 1.6; padding: 24px;">
          <p>${greeting}</p>
          <p>You've been invited to manage your properties with <strong>Asine</strong>.</p>
          <p>Click the button below to activate your account and start your subscription.</p>
          <p style="margin: 24px 0;">
            <a href="${subscribeLink}" style="display: inline-block; background: #0f766e; color: #ffffff; padding: 12px 24px; border-radius: 9999px; text-decoration: none; font-weight: bold;">
              Activate &amp; Choose Plan
            </a>
          </p>
          <p>The setup takes less than 2 minutes — once you subscribe, you'll gain full access to your dashboard.</p>
          <p style="margin-top: 32px;">Welcome aboard,<br/>The Asine Team</p>
        </body>
      </html>
    `

    const textBody = `${greeting}

You've been invited to manage your properties with Asine.
Activate your account and choose your plan:
${subscribeLink}

The setup takes less than 2 minutes — once you subscribe, you'll gain full access to your dashboard.

The Asine Team`

    const mailgunBaseUrl =
      MAILGUN_REGION === 'eu' ? 'https://api.eu.mailgun.net/v3' : 'https://api.mailgun.net/v3'
    const mailgunUrl = `${mailgunBaseUrl}/${MAILGUN_DOMAIN}/messages`
    const mailgunAuthHeader = `Basic ${btoa(`api:${MAILGUN_API_KEY}`)}`

    const formData = new FormData()
    formData.append('from', `Asine Invitations <noreply@${MAILGUN_DOMAIN}>`)
    formData.append('to', email)
    formData.append('subject', 'Activate your Asine account')
    formData.append('html', htmlBody)
    formData.append('text', textBody)

    const mailgunResponse = await fetch(mailgunUrl, {
      method: 'POST',
      headers: {
        Authorization: mailgunAuthHeader,
      },
      body: formData,
    })

    if (!mailgunResponse.ok) {
      const mailgunResult = await mailgunResponse.json().catch(() => ({}))
      console.error('Mailgun error sending invite email:', mailgunResult)
      return new Response(
        JSON.stringify({ code: mailgunResponse.status, message: 'Failed to send invitation email' }),
        { status: mailgunResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          email,
          name: name || null,
          role,
          activation_link: subscribeLink,
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ code: 500, message: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
