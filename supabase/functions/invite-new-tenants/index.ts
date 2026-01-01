import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

interface NewTenantInvite {
  email: string
  name?: string
  unit_number?: string
}

interface InviteNewTenantsRequest {
  tenants: NewTenantInvite[] // Array of tenant emails to invite
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
        JSON.stringify({ code: 401, message: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase clients
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseClient = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const supabaseAdmin = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get the authenticated user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()

    if (userError || !user) {
      console.error('Authentication error:', userError)
      return new Response(
        JSON.stringify({ code: 401, message: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('User authenticated:', user.email)

    // Get PM's property information
    const { data: pmData, error: pmError } = await supabaseAdmin
      .from('users')
      .select('id, name, email, property_id, property_name')
      .eq('id', user.id)
      .eq('role', 'pm')
      .single()

    if (pmError || !pmData) {
      console.error('Error fetching PM data:', pmError)
      return new Response(
        JSON.stringify({ code: 403, message: 'Property manager not found' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!pmData.property_id) {
      return new Response(
        JSON.stringify({ code: 400, message: 'No property assigned to this property manager' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    let requestBody: InviteNewTenantsRequest
    try {
      requestBody = await req.json()
    } catch (error) {
      return new Response(
        JSON.stringify({ code: 400, message: 'Invalid request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!requestBody.tenants || !Array.isArray(requestBody.tenants) || requestBody.tenants.length === 0) {
      return new Response(
        JSON.stringify({ code: 400, message: 'tenants array is required and must not be empty' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate email format for all tenants
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    for (const tenant of requestBody.tenants) {
      if (!tenant.email || !emailRegex.test(tenant.email)) {
        return new Response(
          JSON.stringify({ code: 400, message: `Invalid email format: ${tenant.email || 'missing'}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Check which emails already exist in the system
    const emails = requestBody.tenants.map(t => t.email)
    const { data: existingUsers } = await supabaseAdmin
      .from('users')
      .select('email')
      .in('email', emails)

    const existingEmails = new Set(existingUsers?.map(u => u.email.toLowerCase()) || [])
    const newTenants = requestBody.tenants.filter(t => !existingEmails.has(t.email.toLowerCase()))

    if (newTenants.length === 0) {
      return new Response(
        JSON.stringify({ code: 400, message: 'All provided emails already exist in the system' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get app download links from environment variables
    const GOOGLE_PLAY_URL = Deno.env.get('GOOGLE_PLAY_URL') || 'https://play.google.com/store/apps/details?id=com.asine.app'
    const PROPERTY_NAME = pmData.property_name || 'your property'
    const PM_NAME = pmData.name || 'Your Property Manager'

    // Mailgun configuration
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
        JSON.stringify({ code: 500, message: 'MAILGUN_API_KEY must be a private API key' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const mailgunBaseUrl =
      MAILGUN_REGION === 'eu' ? 'https://api.eu.mailgun.net/v3' : 'https://api.mailgun.net/v3'
    const mailgunUrl = `${mailgunBaseUrl}/${MAILGUN_DOMAIN}/messages`
    const mailgunAuthHeader = `Basic ${btoa(`api:${MAILGUN_API_KEY}`)}`

    // Send invitation email to each new tenant
    const results = []
    for (const tenant of newTenants) {
      const tenantName = tenant.name || 'there'
      const unitNumber = tenant.unit_number ? ` (Unit ${tenant.unit_number})` : ''

      const htmlBody = `
        <html>
          <body style="font-family: Arial, sans-serif; color: #1f2933; line-height: 1.6; padding: 24px;">
            <p>Hi ${tenantName},</p>
            <p>You've been invited by <strong>${PM_NAME}</strong> to join <strong>${PROPERTY_NAME}</strong>${unitNumber} on <strong>Asine</strong>.</p>
            <p>Asine helps you manage maintenance requests, communicate with your property manager, and stay connected with your property.</p>
            <p><strong>Get started in 3 easy steps:</strong></p>
            <ol style="margin: 20px 0; padding-left: 20px;">
              <li style="margin-bottom: 10px;">Download the Asine app using the link below</li>
              <li style="margin-bottom: 10px;">Open the app and tap "Sign Up"</li>
              <li style="margin-bottom: 10px;">Use your email address: <strong>${tenant.email}</strong> to create your account</li>
            </ol>
            <p style="margin: 24px 0; text-align: center;">
              <a href="${GOOGLE_PLAY_URL}" style="display: inline-block; background: #01875f; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
                📱 Download for Android
              </a>
            </p>
            <p style="margin-top: 32px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              If you have any questions, please contact ${PM_NAME}.<br/>
              <br/>
              Welcome to Asine!<br/>
              The Asine Team
            </p>
          </body>
        </html>
      `

      const textBody = `Hi ${tenantName},

You've been invited by ${PM_NAME} to join ${PROPERTY_NAME}${unitNumber} on Asine.

Asine helps you manage maintenance requests, communicate with your property manager, and stay connected with your property.

Get started in 3 easy steps:
1. Download the Asine app using the link below
2. Open the app and tap "Sign Up"
3. Use your email address: ${tenant.email} to create your account

Download the app:
- Android: ${GOOGLE_PLAY_URL}

If you have any questions, please contact ${PM_NAME}.

Welcome to Asine!
The Asine Team`

      const formData = new FormData()
      formData.append('from', `Asine <noreply@${MAILGUN_DOMAIN}>`)
      formData.append('to', tenant.email)
      formData.append('subject', `You're invited to join ${PROPERTY_NAME} on Asine`)
      formData.append('html', htmlBody)
      formData.append('text', textBody)

      try {
        const mailgunResponse = await fetch(mailgunUrl, {
          method: 'POST',
          headers: {
            Authorization: mailgunAuthHeader,
          },
          body: formData,
        })

        if (!mailgunResponse.ok) {
          const mailgunResult = await mailgunResponse.json().catch(() => ({}))
          console.error(`Mailgun error sending email to ${tenant.email}:`, mailgunResult)
          results.push({ email: tenant.email, success: false, error: 'Failed to send email' })
        } else {
          console.log(`Successfully sent invitation email to ${tenant.email}`)
          results.push({ email: tenant.email, success: true })
        }
      } catch (error) {
        console.error(`Error sending email to ${tenant.email}:`, error)
        results.push({ email: tenant.email, success: false, error: error.message })
      }
    }

    const successCount = results.filter(r => r.success).length
    const failCount = results.filter(r => !r.success).length
    const skippedCount = requestBody.tenants.length - newTenants.length

    return new Response(
      JSON.stringify({
        success: true,
        message: `Invitations sent to ${successCount} new tenant(s)${failCount > 0 ? `, ${failCount} failed` : ''}${skippedCount > 0 ? `, ${skippedCount} already in system` : ''}`,
        data: {
          total_requested: requestBody.tenants.length,
          new_tenants: newTenants.length,
          existing_tenants: skippedCount,
          successful: successCount,
          failed: failCount,
          results
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ code: 500, message: 'Internal server error', error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

