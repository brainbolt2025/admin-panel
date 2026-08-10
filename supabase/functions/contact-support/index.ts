import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { asineEmailHtml } from '../_shared/asineEmailLayout.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

const SUPPORT_EMAIL = Deno.env.get('SUPPORT_EMAIL') || 'mrjpjay2@gmail.com'

interface ContactSupportRequest {
  title: string
  description: string
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
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
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    if (!supabaseServiceKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const {
      data: { user },
      error: userError,
    } = await supabaseUser.auth.getUser()

    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const body: ContactSupportRequest = await req.json()
    const title = (body.title || '').trim()
    const description = (body.description || '').trim()

    if (!title || !description) {
      return new Response(
        JSON.stringify({ success: false, error: 'Title and description are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    if (title.length > 200) {
      return new Response(
        JSON.stringify({ success: false, error: 'Title must be 200 characters or less' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    if (description.length > 5000) {
      return new Response(
        JSON.stringify({ success: false, error: 'Description must be 5000 characters or less' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)
    const { data: profile } = await supabaseAdmin
      .from('users')
      .select('id, name, email, role, property_id')
      .eq('id', user.id)
      .maybeSingle()

    let propertyName: string | null = null
    if (profile?.property_id) {
      const { data: property } = await supabaseAdmin
        .from('properties')
        .select('name')
        .eq('id', profile.property_id)
        .maybeSingle()
      propertyName = property?.name || null
    }

    const MAILGUN_DOMAIN = Deno.env.get('MAILGUN_DOMAIN') || ''
    const MAILGUN_API_KEY = Deno.env.get('MAILGUN_API_KEY') || ''
    const MAILGUN_REGION = Deno.env.get('MAILGUN_REGION') || 'us'

    if (!MAILGUN_DOMAIN || !MAILGUN_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: 'Mailgun configuration missing' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const safeTitle = escapeHtml(title)
    const safeDescription = escapeHtml(description).replace(/\n/g, '<br>')
    const senderName = escapeHtml(profile?.name || user.email || 'Unknown')
    const senderEmail = escapeHtml(profile?.email || user.email || 'unknown')
    const senderRole = escapeHtml(profile?.role || 'unknown')

    const htmlBody = asineEmailHtml({
      title: 'Support request',
      greeting: 'Hi Support,',
      paragraphs: ['A user submitted a support request from the Asine admin panel.'],
      extraHtml: `<div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0 0 8px 0;"><strong>Title:</strong> ${safeTitle}</p>
            <p style="margin: 0 0 8px 0;"><strong>From:</strong> ${senderName} (${senderEmail})</p>
            <p style="margin: 0 0 8px 0;"><strong>Role:</strong> ${senderRole}</p>
            ${propertyName ? `<p style="margin: 0 0 8px 0;"><strong>Property:</strong> ${escapeHtml(propertyName)}</p>` : ''}
            <p style="margin: 0 0 8px 0;"><strong>User ID:</strong> ${escapeHtml(user.id)}</p>
          </div>
          <p style="margin:0 0 8px 0;color:#1f2933;font-size:16px;line-height:1.6;"><strong>Description</strong></p>
          <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;padding:16px;color:#1f2933;font-size:15px;line-height:1.6;">
            ${safeDescription}
          </div>`,
      signOff: null,
    })

    const textBody = `Support request

Title: ${title}
From: ${profile?.name || user.email} (${profile?.email || user.email})
Role: ${profile?.role || 'unknown'}
${propertyName ? `Property: ${propertyName}\n` : ''}User ID: ${user.id}

Description:
${description}
`

    const mailgunBaseUrl =
      MAILGUN_REGION === 'eu' ? 'https://api.eu.mailgun.net/v3' : 'https://api.mailgun.net/v3'
    const formData = new FormData()
    formData.append('from', `Asine Support <noreply@${MAILGUN_DOMAIN}>`)
    formData.append('to', SUPPORT_EMAIL)
    formData.append('subject', `Support: ${title}`)
    formData.append('html', htmlBody)
    formData.append('text', textBody)
    if (profile?.email || user.email) {
      formData.append('h:Reply-To', profile?.email || user.email || '')
    }

    const mailgunResponse = await fetch(`${mailgunBaseUrl}/${MAILGUN_DOMAIN}/messages`, {
      method: 'POST',
      headers: { Authorization: `Basic ${btoa(`api:${MAILGUN_API_KEY}`)}` },
      body: formData,
    })

    if (!mailgunResponse.ok) {
      const mailgunResult = await mailgunResponse.json().catch(() => ({}))
      console.error('Mailgun error sending support email:', mailgunResult)
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to send support email',
          details: mailgunResult.message || mailgunResponse.statusText,
        }),
        {
          status: mailgunResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    const mailgunResult = await mailgunResponse.json().catch(() => ({}))
    console.log('Support email sent:', mailgunResult.id, 'to', SUPPORT_EMAIL)

    return new Response(
      JSON.stringify({ success: true, mailgun_id: mailgunResult.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    console.error('Error in contact-support:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
