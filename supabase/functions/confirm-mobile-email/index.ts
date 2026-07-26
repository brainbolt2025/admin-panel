// Confirms Auth email via token_hash, sets public.users.email_verified, redirects to app.
// Deploy with --no-verify-jwt (users open this from email before login).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function defaultAppOrigin(): string {
  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY') || ''
  if (stripeKey.startsWith('sk_test_')) {
    return 'http://localhost:5173'
  }
  return 'https://www.sycnmore.com'
}

function appVerifiedRedirectUrl(extra: Record<string, string> = {}): string {
  const envRedirect = (
    Deno.env.get('MOBILE_VERIFY_REDIRECT_TO') ||
    Deno.env.get('APP_URL') ||
    Deno.env.get('SITE_URL') ||
    Deno.env.get('BASE_URL') ||
    defaultAppOrigin()
  ).replace(/\/$/, '')

  const isLocalHttp =
    envRedirect.startsWith('http://localhost') ||
    envRedirect.startsWith('http://127.0.0.1')
  const isHttps = envRedirect.startsWith('https://')
  const origin = isHttps || isLocalHttp ? envRedirect : defaultAppOrigin()

  const base = origin.endsWith('/auth/verified')
    ? origin
    : `${origin}/auth/verified`

  const params = new URLSearchParams({ email_verified: '1', ...extra })
  return `${base}?${params.toString()}`
}

function redirect(url: string, status = 302): Response {
  return new Response(null, {
    status,
    headers: {
      ...corsHeaders,
      Location: url,
    },
  })
}

function htmlError(message: string, status = 400): Response {
  const body = `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:2rem">
    <h2>Email verification failed</h2>
    <p>${message}</p>
    <p>You can close this window and request a new verification email from the app.</p>
  </body></html>`
  return new Response(body, {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' },
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const token =
      url.searchParams.get('token') ||
      url.searchParams.get('confirmation_token') ||
      url.searchParams.get('token_hash')
    const typeParam = (url.searchParams.get('type') || 'magiclink').toLowerCase()

    if (!token) {
      return htmlError('Missing verification token.')
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    if (!supabaseUrl || !serviceKey) {
      return htmlError('Server configuration error.', 500)
    }

    // GoTrue accept signup | magiclink | invite | recovery | email_change | email
    const verifyType =
      typeParam === 'signup' || typeParam === 'invite' || typeParam === 'email'
        ? typeParam
        : 'magiclink'

    console.log('confirm-mobile-email:', {
      type: verifyType,
      tokenPrefix: token.substring(0, 12) + '...',
    })

    const verifyResponse = await fetch(`${supabaseUrl}/auth/v1/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        type: verifyType,
        token_hash: token,
      }),
    })

    const verifyPayload = await verifyResponse.json().catch(() => ({})) as {
      access_token?: string
      user?: { id?: string; email?: string; email_confirmed_at?: string | null }
      error?: string
      error_description?: string
      msg?: string
    }

    if (!verifyResponse.ok) {
      console.error('Auth verify failed:', verifyResponse.status, verifyPayload)

      // Token may already be consumed while Auth is confirmed — still sync app flag if we can.
      // Fall through only when we have no user; otherwise show error.
      return htmlError(
        verifyPayload.error_description ||
          verifyPayload.msg ||
          verifyPayload.error ||
          'Invalid or expired verification link. Please request a new email.',
        verifyResponse.status === 401 ? 400 : verifyResponse.status,
      )
    }

    const userId = verifyPayload.user?.id
    if (!userId) {
      console.error('Verify succeeded but no user id:', verifyPayload)
      return htmlError('Verification succeeded but user was not returned.', 500)
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Ensure Auth email is confirmed (magiclink / signup should already do this)
    if (!verifyPayload.user?.email_confirmed_at) {
      const { error: confirmError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        email_confirm: true,
      })
      if (confirmError) {
        console.warn('Could not force email_confirm:', confirmError.message)
      }
    }

    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({ email_verified: true })
      .eq('id', userId)
      .neq('role', 'pm')

    if (updateError) {
      console.error('Failed to set email_verified:', updateError)
      return htmlError('Account confirmed but app verification flag failed. Please contact support.', 500)
    }

    console.log('✅ Mobile email verified for user:', userId)

    return redirect(
      appVerifiedRedirectUrl({
        type: verifyType,
        user_id: userId,
      }),
    )
  } catch (error) {
    console.error('confirm-mobile-email error:', error)
    return htmlError(
      error instanceof Error ? error.message : 'Unexpected verification error.',
      500,
    )
  }
})
