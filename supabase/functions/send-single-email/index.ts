import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { asineEmailHtml } from '../_shared/asineEmailLayout.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface SingleEmailRequest {
  to: string
  subject: string
  message: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed. Use POST.' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: { headers: { Authorization: authHeader } },
    })

    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser()

    if (userError || !user) {
      console.error('Authentication error:', userError)
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const supabaseAdmin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')

    const { data: userData, error: roleError } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (roleError || !userData || userData.role !== 'super_admin') {
      console.error('Role check error:', roleError)
      return new Response(
        JSON.stringify({ success: false, error: 'Super admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    let body: SingleEmailRequest
    try {
      body = await req.json()
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid JSON in request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const to = body.to?.trim() ?? ''
    const subject = body.subject?.trim() ?? ''
    const message = body.message?.trim() ?? ''

    if (!to || !EMAIL_RE.test(to)) {
      return new Response(
        JSON.stringify({ success: false, error: 'A valid recipient email is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    if (!subject) {
      return new Response(
        JSON.stringify({ success: false, error: 'Subject is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    if (!message) {
      return new Response(
        JSON.stringify({ success: false, error: 'Message is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const MAILGUN_DOMAIN = Deno.env.get('MAILGUN_DOMAIN') || ''
    const MAILGUN_API_KEY = Deno.env.get('MAILGUN_API_KEY') || ''
    const MAILGUN_REGION = Deno.env.get('MAILGUN_REGION') || 'us'

    if (!MAILGUN_DOMAIN || !MAILGUN_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: 'Mailgun not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const mailgunBaseUrl =
      MAILGUN_REGION === 'eu' ? 'https://api.eu.mailgun.net/v3' : 'https://api.mailgun.net/v3'
    const mailgunUrl = `${mailgunBaseUrl}/${MAILGUN_DOMAIN}/messages`
    const fromAddress = `JP from Asine <jp@${MAILGUN_DOMAIN}>`
    const replyTo = `jp@${MAILGUN_DOMAIN}`

    const htmlMessage = message
      .split('\n')
      .map((line) => `<p>${line || '&nbsp;'}</p>`)
      .join('')

    const formData = new FormData()
    formData.append('from', fromAddress)
    formData.append('h:Reply-To', replyTo)
    formData.append('to', to)
    formData.append('subject', subject)
    formData.append(
      'html',
      asineEmailHtml({
        title: subject,
        extraHtml: htmlMessage,
      }),
    )
    formData.append('text', message)

    console.log(`send-single-email: ${user.email} -> ${to}`)

    const mailgunResponse = await fetch(mailgunUrl, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa(`api:${MAILGUN_API_KEY}`)}`,
      },
      body: formData,
    })

    if (!mailgunResponse.ok) {
      const errorText = await mailgunResponse.text().catch(() => 'Unknown error')
      console.error('Mailgun error:', mailgunResponse.status, errorText)
      return new Response(
        JSON.stringify({
          success: false,
          error: `Failed to send email (HTTP ${mailgunResponse.status})`,
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Email sent to ${to}`,
        to,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    console.error('Error in send-single-email function:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
