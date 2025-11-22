import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

interface ApprovalEmailRequest {
  email: string
  name?: string
  propertyName?: string
  approvedBy?: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
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
    const body: ApprovalEmailRequest = await req.json()
    const email = body.email?.trim()

    if (!email) {
      return new Response(
        JSON.stringify({ success: false, error: 'Email is required.' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid email.' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    const tenantName = body.name?.trim() || 'Resident'
    const propertyName = body.propertyName?.trim() || 'your community'
    const approvedBy = body.approvedBy?.trim() || 'Property Management Team'

    const MAILGUN_DOMAIN = Deno.env.get('MAILGUN_DOMAIN') || ''
    const MAILGUN_API_KEY = Deno.env.get('MAILGUN_API_KEY') || ''
    const MAILGUN_REGION = Deno.env.get('MAILGUN_REGION') || 'us'

    if (!MAILGUN_DOMAIN || !MAILGUN_API_KEY) {
      return new Response(
        JSON.stringify({
          success: false,
          error:
            'Mailgun configuration missing. Set MAILGUN_DOMAIN and MAILGUN_API_KEY in Supabase secrets.',
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    if (MAILGUN_API_KEY.startsWith('pubkey-')) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'MAILGUN_API_KEY must be a private API key (starts with "key-").',
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    const subject = `Welcome! Your access to ${propertyName} has been approved`
    const htmlBody = `
      <html>
        <body style="font-family: Arial, sans-serif; color: #1f2933; line-height: 1.6; padding: 24px;">
          <h2 style="color: #0f766e; margin-bottom: 16px;">You're Approved!</h2>
          <p>Hi ${tenantName},</p>
          <p>Great news — your request to join <strong>${propertyName}</strong> has been approved.</p>
          <p style="margin-top: 32px;">If you have any questions, please contact your property manager.</p>
          <p style="margin-top: 40px;">Warm regards,<br/>${approvedBy}</p>
        </body>
      </html>
    `

    const textBody = `Hi ${tenantName},

Your request to join ${propertyName} has been approved.

If you have any questions, please contact your property manager.

${approvedBy}`

    const mailgunBaseUrl =
      MAILGUN_REGION === 'eu' ? 'https://api.eu.mailgun.net/v3' : 'https://api.mailgun.net/v3'
    const mailgunUrl = `${mailgunBaseUrl}/${MAILGUN_DOMAIN}/messages`
    const authHeader = `Basic ${btoa(`api:${MAILGUN_API_KEY}`)}`

    const formData = new FormData()
    formData.append('from', `Property Management <noreply@${MAILGUN_DOMAIN}>`)
    formData.append('to', email)
    formData.append('subject', subject)
    formData.append('html', htmlBody)
    formData.append('text', textBody)

    const response = await fetch(mailgunUrl, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
      },
      body: formData,
    })

    const contentType = response.headers.get('content-type') || ''
    const result = contentType.includes('application/json') ? await response.json() : await response.text()

    if (!response.ok || (result && result.error)) {
      console.error('Mailgun error sending tenant approval email:', result)
      return new Response(
        JSON.stringify({
          success: false,
          error:
            typeof result === 'string'
              ? result
              : result?.message || result?.error || 'Failed to send email via Mailgun.',
        }),
        {
          status: response.status || 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Tenant approval email sent successfully.',
        mailgun_id: typeof result === 'object' ? result?.id : undefined,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  } catch (error) {
    console.error('Unexpected error sending tenant approval email:', error)
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

