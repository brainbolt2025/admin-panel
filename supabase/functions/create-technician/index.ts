import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { asineEmailHtml } from '../_shared/asineEmailLayout.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

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

async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, '0')).join('')
}

function generateInviteToken(): string {
  const buf = new Uint8Array(32)
  crypto.getRandomValues(buf)
  return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('')
}

function inviteSetPasswordLinks(rawToken: string): { appLink: string; httpsLink: string } {
  const qs = `token=${encodeURIComponent(rawToken)}&type=invite`
  return {
    appLink: `asine://auth/reset-password?${qs}`,
    httpsLink: `https://www.sycnmore.com/auth/reset-password?${qs}`,
  }
}

serve(async (req) => {
  console.log('create-technician invoked with method:', req.method)

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed. Use POST.' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
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
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
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
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const { data: pmProfile, error: pmProfileError } = await supabase
      .from('users')
      .select('id, role, property_id, property_name')
      .eq('id', authData.user.id)
      .maybeSingle()

    if (pmProfileError || !pmProfile || pmProfile.role !== 'pm' || !pmProfile.property_id) {
      return new Response(
        JSON.stringify({ error: 'Only property managers can invite technicians for their property.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    let body: CreateTechnicianRequest
    try {
      const bodyText = await req.text()
      if (!bodyText || bodyText.trim() === '') {
        return new Response(
          JSON.stringify({ error: 'Request body is empty' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }
      body = JSON.parse(bodyText)
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const firstName = (body.first_name || '').trim()
    const lastName = (body.last_name || '').trim()
    const email = (body.email || '').trim().toLowerCase()
    const { property_id, property_name } = body
    const name =
      [firstName, lastName].filter(Boolean).join(' ') ||
      (typeof body.name === 'string' ? body.name.trim() : '')

    if (!email || !firstName || !lastName) {
      return new Response(
        JSON.stringify({
          error: 'Missing required fields. Required: email, first_name, last_name',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    if (property_id && property_id !== pmProfile.property_id) {
      return new Response(
        JSON.stringify({ error: 'You can only invite technicians for your own property.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const { data: existingUser } = await supabase
      .from('users')
      .select('id, email, role')
      .ilike('email', email)
      .maybeSingle()

    if (existingUser) {
      return new Response(
        JSON.stringify({
          error: `User with email ${email} already exists. Please use a different email.`,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const finalPropertyId: string = pmProfile.property_id
    let finalPropertyName: string | null = null

    const { data: propData, error: propError } = await supabase
      .from('properties')
      .select('id, name')
      .eq('id', finalPropertyId)
      .maybeSingle()

    if (!propError && propData) {
      finalPropertyName = propData.name
    } else {
      finalPropertyName =
        (property_name && property_id === pmProfile.property_id ? property_name : null) ||
        pmProfile.property_name ||
        'Unknown Property'
      console.warn('Property name lookup failed; using fallback:', finalPropertyName, propError)
    }

    const rawToken = generateInviteToken()
    const tokenHash = await sha256Hex(rawToken)
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

    // Replace any outstanding invite for this email
    await supabase
      .from('technician_invites')
      .delete()
      .ilike('email', email)
      .is('accepted_at', null)

    const { data: inviteRow, error: inviteError } = await supabase
      .from('technician_invites')
      .insert({
        email,
        first_name: firstName,
        last_name: lastName,
        property_id: finalPropertyId,
        property_name: finalPropertyName,
        invited_by: pmProfile.id,
        token_hash: tokenHash,
        expires_at: expiresAt,
      })
      .select('id')
      .single()

    if (inviteError || !inviteRow) {
      console.error('Failed to store technician invite:', inviteError)
      return new Response(
        JSON.stringify({
          error: 'Failed to create invitation. Please try again.',
          details: inviteError?.message,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const { appLink, httpsLink } = inviteSetPasswordLinks(rawToken)
    let emailSent = false
    let emailSendError: string | null = null

    try {
      const MAILGUN_DOMAIN = Deno.env.get('MAILGUN_DOMAIN') || 'mg.asine.app'
      const MAILGUN_API_KEY = Deno.env.get('MAILGUN_API_KEY') || ''
      const MAILGUN_REGION = Deno.env.get('MAILGUN_REGION') || 'us'

      if (!MAILGUN_API_KEY) {
        emailSendError = 'Email service not configured.'
      } else {
        const htmlBody = asineEmailHtml({
          title: 'Welcome to Asine',
          greeting: `Hi ${name},`,
          paragraphs: [
            `Your property manager invited you as a technician at <strong>${finalPropertyName || 'your property'}</strong>.`,
            'Tap the button below to open the Asine app and create your password. Your account is created only after you set that password.',
          ],
          extraHtml: `<div style="background: #f0fdfa; border: 1px solid #99f6e4; border-radius: 8px; padding: 16px; margin: 24px 0;">
                      <p style="margin: 0 0 8px 0; font-weight: bold; color: #0f766e;">Your sign-in email</p>
                      <p style="margin: 4px 0;"><strong>Email:</strong> ${email}</p>
                    </div>`,
          cta: { label: 'Set Password & Open App', href: httpsLink },
          noticeHtml:
            '<strong>Important:</strong> This link expires in 24 hours. After you set your password, sign in with your email and that password.',
          secondaryNote: "If you didn't expect this invitation, please ignore this email.",
          signOff: null,
          fallbackLink: httpsLink,
        })

        const textBody = `Welcome to Asine

Hi ${name},

Your property manager invited you as a technician at ${finalPropertyName || 'your property'}.

Open the app and create your password:
${httpsLink}

Or open this link on your phone:
${appLink}

Sign-in email: ${email}
Your account is created only after you set your password.

This link expires in 24 hours.

If you didn't expect this invitation, please ignore this email.`

        const mailgunBaseUrl =
          MAILGUN_REGION === 'eu' ? 'https://api.eu.mailgun.net/v3' : 'https://api.mailgun.net/v3'
        const formData = new FormData()
        formData.append('from', `Asine Admin <noreply@${MAILGUN_DOMAIN}>`)
        formData.append('to', email)
        formData.append('subject', 'Your Asine technician invitation — set your password')
        formData.append('html', htmlBody)
        formData.append('text', textBody)

        const mailgunResponse = await fetch(`${mailgunBaseUrl}/${MAILGUN_DOMAIN}/messages`, {
          method: 'POST',
          headers: { Authorization: `Basic ${btoa(`api:${MAILGUN_API_KEY}`)}` },
          body: formData,
        })

        if (mailgunResponse.ok) {
          emailSent = true
        } else {
          const errorText = await mailgunResponse.text().catch(() => 'Unknown error')
          emailSendError = `Mailgun error: ${mailgunResponse.status} ${errorText}`
        }
      }
    } catch (error) {
      emailSendError = error instanceof Error ? error.message : 'Unknown error sending invitation email'
    }

    return new Response(
      JSON.stringify({
        success: true,
        invite_id: inviteRow.id,
        email,
        name,
        first_name: firstName,
        last_name: lastName,
        property_id: finalPropertyId,
        property_name: finalPropertyName,
        email_sent: emailSent,
        email_error: emailSendError || undefined,
        message: emailSent
          ? 'Invitation sent. The technician will create their account when they set a password.'
          : 'Invitation saved, but the email may not have been sent. ' + (emailSendError || ''),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    console.error('Error inviting technician:', error)
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
