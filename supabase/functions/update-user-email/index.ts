import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { asineEmailHtml } from '../_shared/asineEmailLayout.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

interface UpdateEmailRequest {
  new_email: string
  /** Cancel a pending email change instead of starting a new one */
  cancel?: boolean
}

function siteOrigin(): string {
  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY') || ''
  const isTestMode = stripeKey.startsWith('sk_test_')
  const configured =
    Deno.env.get('SITE_URL') || Deno.env.get('APP_URL') || Deno.env.get('BASE_URL') || ''
  if (configured) return configured.replace(/\/+$/, '')
  return isTestMode ? 'http://localhost:5173' : 'https://www.sycnmore.com'
}

async function sendConfirmEmail(opts: {
  to: string
  name: string
  confirmLink: string
}): Promise<{ ok: boolean; error?: string; mailgun_id?: string }> {
  const MAILGUN_DOMAIN = Deno.env.get('MAILGUN_DOMAIN') || 'mg.asine.app'
  const MAILGUN_API_KEY = Deno.env.get('MAILGUN_API_KEY') || ''
  const MAILGUN_REGION = Deno.env.get('MAILGUN_REGION') || 'us'

  if (!MAILGUN_API_KEY) {
    return { ok: false, error: 'Mailgun API key not configured' }
  }

  const htmlBody = asineEmailHtml({
    title: 'Confirm your new email',
    greeting: `Hi ${opts.name},`,
    paragraphs: [
      `You requested to change your Asine Property Manager email to <strong>${opts.to}</strong>.`,
      'Click the button below to confirm. Your login email will only change after you confirm.',
    ],
    cta: { label: 'Confirm new email', href: opts.confirmLink },
    noticeHtml:
      'This link expires in 24 hours. If you did not request this change, you can ignore this email.',
    signOff: null,
    fallbackLink: opts.confirmLink,
  })

  const formData = new FormData()
  formData.append('from', `Asine Admin <noreply@${MAILGUN_DOMAIN}>`)
  formData.append('to', opts.to)
  formData.append('subject', 'Confirm your new Asine email address')
  formData.append('html', htmlBody)
  formData.append(
    'text',
    `Confirm your new email\n\nHi ${opts.name},\n\nConfirm changing your Asine email to ${opts.to}:\n${opts.confirmLink}\n\nThis link expires in 24 hours.`,
  )

  const mailgunBaseUrl =
    MAILGUN_REGION === 'eu' ? 'https://api.eu.mailgun.net/v3' : 'https://api.mailgun.net/v3'
  const mailgunResponse = await fetch(`${mailgunBaseUrl}/${MAILGUN_DOMAIN}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`api:${MAILGUN_API_KEY}`)}`,
    },
    body: formData,
  })

  const result = await mailgunResponse.json().catch(() => ({}))
  if (!mailgunResponse.ok) {
    return {
      ok: false,
      error: result.message || result.error || `Mailgun error ${mailgunResponse.status}`,
    }
  }

  return { ok: true, mailgun_id: result.id }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ success: false, error: 'Method not allowed. Use POST.' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

    if (!supabaseServiceKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Service role key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseAuthed = createClient(supabaseUrl, supabaseAnonKey || supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: authData, error: authError } = await supabaseAuthed.auth.getUser()
    if (authError || !authData.user) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid or expired token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const userId = authData.user.id
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    const body: UpdateEmailRequest = await req.json().catch(() => ({} as UpdateEmailRequest))
    const cancel = !!body.cancel
    const newEmail = (body.new_email || '').trim().toLowerCase()

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('users')
      .select('id, email, name, role, pending_email')
      .eq('id', userId)
      .maybeSingle()

    if (profileError || !profile) {
      return new Response(JSON.stringify({ success: false, error: 'User profile not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (profile.role !== 'pm') {
      return new Response(
        JSON.stringify({ success: false, error: 'Only property managers can change their email here.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    if (cancel) {
      const { error: clearError } = await supabaseAdmin
        .from('users')
        .update({
          pending_email: null,
          verification_token: null,
          verification_token_expires_at: null,
        })
        .eq('id', userId)

      if (clearError) {
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to cancel pending email change' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }

      return new Response(
        JSON.stringify({
          success: true,
          cancelled: true,
          message: 'Pending email change cancelled.',
          email: profile.email,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!newEmail || !emailRegex.test(newEmail)) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid email format' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const currentEmail = (profile.email || '').trim().toLowerCase()
    if (newEmail === currentEmail) {
      return new Response(
        JSON.stringify({ success: false, error: 'That is already your current email address.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const { data: existing } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', newEmail)
      .neq('id', userId)
      .maybeSingle()

    if (existing) {
      return new Response(
        JSON.stringify({ success: false, error: 'That email is already in use by another account.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const verificationToken = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

    const { error: pendingError } = await supabaseAdmin
      .from('users')
      .update({
        pending_email: newEmail,
        verification_token: verificationToken,
        verification_token_expires_at: expiresAt,
      })
      .eq('id', userId)

    if (pendingError) {
      console.error('Failed to store pending email:', pendingError)
      const hint =
        pendingError.message?.includes('pending_email') || pendingError.code === '42703'
          ? ' Run add-pending-email-column.sql in the SQL editor.'
          : ''
      return new Response(
        JSON.stringify({
          success: false,
          error: `Failed to start email change.${hint}`,
          details: pendingError.message,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const confirmLink = `${siteOrigin()}?token=${verificationToken}`
    const displayName = profile.name || 'Property Manager'
    const emailResult = await sendConfirmEmail({
      to: newEmail,
      name: displayName,
      confirmLink,
    })

    if (!emailResult.ok) {
      // Roll back pending state so the user is not stuck
      await supabaseAdmin
        .from('users')
        .update({
          pending_email: null,
          verification_token: null,
          verification_token_expires_at: null,
        })
        .eq('id', userId)

      return new Response(
        JSON.stringify({
          success: false,
          error: emailResult.error || 'Failed to send confirmation email',
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    console.log('✅ Email change confirmation queued:', {
      userId,
      pending_email: newEmail,
      mailgun_id: emailResult.mailgun_id,
    })

    return new Response(
      JSON.stringify({
        success: true,
        pending: true,
        pending_email: newEmail,
        message:
          'Confirmation email sent to your new address. Your login email will change after you click the link.',
        mailgun_id: emailResult.mailgun_id,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    console.error('Error in update-user-email:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
