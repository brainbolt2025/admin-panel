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
  propertyName?: string
  personName?: string
}

function propertyToken(): RegExp {
  return /\{\{\s*property(?:_?name)?\s*\}\}/gi
}

function nameToken(): RegExp {
  return /\{\{\s*name\s*\}\}/gi
}

function firstNameToken(): RegExp {
  return /\{\{\s*first_?name\s*\}\}/gi
}

function usesToken(token: () => RegExp, ...texts: string[]): boolean {
  return texts.some((text) => token().test(text))
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function applyTokens(text: string, propertyName: string, personName: string): string {
  const firstName = personName.split(/\s+/)[0] ?? ''
  return text
    .replace(propertyToken(), propertyName)
    .replace(firstNameToken(), firstName)
    .replace(nameToken(), personName)
}

function messageToHtml(message: string): string {
  return message
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const inner = escapeHtml(block).replace(/\n/g, '<br/>')
      return `<p style="margin:0 0 16px 0;color:#334155;font-size:15px;line-height:1.6;">${inner}</p>`
    })
    .join('')
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
    const propertyName = body.propertyName?.trim() ?? ''
    const personName = body.personName?.trim() ?? ''
    let subject = body.subject?.trim() ?? ''
    let message = body.message?.trim() ?? ''

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

    if (usesToken(propertyToken, subject, message) && !propertyName) {
      return new Response(
        JSON.stringify({ success: false, error: 'Property name is required when the message uses {{property}}' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    if ((usesToken(nameToken, subject, message) || usesToken(firstNameToken, subject, message)) && !personName) {
      return new Response(
        JSON.stringify({ success: false, error: 'Person name is required when the message uses {{name}} or {{first_name}}' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    subject = applyTokens(subject, propertyName, personName)
    message = applyTokens(message, propertyName, personName)

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

    const htmlMessage = messageToHtml(message)

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
        signOff: 'JP<br/><strong style="color:#0d2b23;">Founder, Asine</strong>',
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
