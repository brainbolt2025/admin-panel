import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

interface NotifyPMSignupRequest {
  property_id: string
  user_name: string
  user_email: string
  user_role: 'tenant' | 'technician'
  unit_number?: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed. Use POST.' }),
      {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }

  try {
    const body: NotifyPMSignupRequest = await req.json()
    const { property_id, user_name, user_email, user_role, unit_number } = body

    // Validate required fields
    if (!property_id || !user_name || !user_email || !user_role) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required fields: property_id, user_name, user_email, user_role',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    // Validate user_role
    if (user_role !== 'tenant' && user_role !== 'technician') {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'user_role must be either "tenant" or "technician"',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    if (!supabaseServiceKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing Supabase service role key',
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Step 1: Find the property and get PM information
    console.log('Finding property and PM for property_id:', property_id)
    const { data: property, error: propertyError } = await supabase
      .from('properties')
      .select('id, name, pm_id')
      .eq('id', property_id)
      .maybeSingle()

    if (propertyError || !property) {
      console.error('Property not found:', propertyError)
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Property not found',
          details: propertyError?.message,
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    if (!property.pm_id) {
      console.log('Property has no PM assigned, skipping notification')
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No PM assigned to property, notification skipped',
          property_id,
          property_name: property.name,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    // Step 2: Get PM user information
    console.log('Finding PM user:', property.pm_id)
    const { data: pmUser, error: pmError } = await supabase
      .from('users')
      .select('id, name, email, role')
      .eq('id', property.pm_id)
      .eq('role', 'pm')
      .maybeSingle()

    if (pmError || !pmUser || !pmUser.email) {
      console.error('PM user not found:', pmError)
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Property Manager not found or has no email',
          details: pmError?.message,
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    console.log('Found PM:', pmUser.email)

    // Step 3: Send email notification to PM
    const MAILGUN_DOMAIN = Deno.env.get('MAILGUN_DOMAIN') || 'mg.asine.app'
    const MAILGUN_API_KEY = Deno.env.get('MAILGUN_API_KEY') || ''
    const MAILGUN_REGION = Deno.env.get('MAILGUN_REGION') || 'us'

    if (!MAILGUN_API_KEY) {
      console.warn('MAILGUN_API_KEY not configured, skipping email notification')
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Email service not configured',
          warning: 'PM notification skipped',
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    // Build email content based on user role
    const userTypeLabel = user_role === 'tenant' ? 'Tenant' : 'Technician'
    const userTypeArticle = user_role === 'tenant' ? 'a' : 'a'
    const actionRequired = user_role === 'tenant' 
      ? 'Please review and approve their account in the admin panel.'
      : 'Please review and approve their account in the admin panel.'

    const unitInfo = unit_number ? ` (Unit ${unit_number})` : ''
    const propertyName = property.name || 'your property'

    const htmlBody = `
      <html>
        <body style="font-family: Arial, sans-serif; color: #1f2933; line-height: 1.6; padding: 24px;">
          <h2 style="color: #0f766e; margin-bottom: 20px;">New ${userTypeLabel} Signup</h2>
          <p>Hi ${pmUser.name || 'Property Manager'},</p>
          <p>A new ${userTypeLabel.toLowerCase()} has signed up for <strong>${propertyName}</strong>:</p>
          
          <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0 0 8px 0;"><strong>Name:</strong> ${user_name}</p>
            <p style="margin: 0 0 8px 0;"><strong>Email:</strong> ${user_email}</p>
            <p style="margin: 0 0 8px 0;"><strong>Role:</strong> ${userTypeLabel}</p>
            <p style="margin: 0 0 8px 0;"><strong>Property:</strong> ${propertyName}</p>
            ${unit_number ? `<p style="margin: 0;"><strong>Unit:</strong> ${unit_number}</p>` : '<p style="margin: 0;">&nbsp;</p>'}
          </div>

          <p style="margin-top: 24px;">
            ${actionRequired}
          </p>

          <p style="color: #666; font-size: 14px; margin-top: 30px;">
            You can review and approve this account in the admin panel.
          </p>

          <p style="margin-top: 32px;">Best regards,<br/>The Asine Team</p>
        </body>
      </html>
    `

    const textBody = `Hi ${pmUser.name || 'Property Manager'},

A new ${userTypeLabel.toLowerCase()} has signed up for ${propertyName}:

Name: ${user_name}
Email: ${user_email}
Role: ${userTypeLabel}
Property: ${propertyName}
${unit_number ? `Unit: ${unit_number}\n` : ''}
${actionRequired}

You can review and approve this account in the admin panel.

Best regards,
The Asine Team`

    // Send email via Mailgun
    const mailgunBaseUrl =
      MAILGUN_REGION === 'eu' ? 'https://api.eu.mailgun.net/v3' : 'https://api.mailgun.net/v3'
    const mailgunUrl = `${mailgunBaseUrl}/${MAILGUN_DOMAIN}/messages`
    const mailgunAuthHeader = `Basic ${btoa(`api:${MAILGUN_API_KEY}`)}`

    const formData = new FormData()
    formData.append('from', `Asine Work Orders <noreply@${MAILGUN_DOMAIN}>`)
    formData.append('to', pmUser.email)
    formData.append('subject', `New ${userTypeLabel} Signup: ${user_name} - ${propertyName}`)
    formData.append('html', htmlBody)
    formData.append('text', textBody)

    console.log('Sending PM notification email to:', pmUser.email)

    const mailgunResponse = await fetch(mailgunUrl, {
      method: 'POST',
      headers: {
        Authorization: mailgunAuthHeader,
      },
      body: formData,
    })

    if (!mailgunResponse.ok) {
      const mailgunResult = await mailgunResponse.json().catch(() => ({}))
      console.error('Mailgun error sending PM notification email:', mailgunResult)
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to send PM notification email',
          details: mailgunResult.message || mailgunResponse.statusText,
        }),
        {
          status: mailgunResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    const mailgunResult = await mailgunResponse.json().catch(() => ({}))

    console.log('PM notification email sent successfully:', mailgunResult.id)

    return new Response(
      JSON.stringify({
        success: true,
        message: `PM notification sent for new ${userTypeLabel.toLowerCase()} signup`,
        pm_email: pmUser.email,
        property_id,
        property_name: propertyName,
        user_name,
        user_email,
        user_role,
        mailgun_id: mailgunResult.id,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  } catch (error) {
    console.error('Error in notify-pm-signup:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
})

