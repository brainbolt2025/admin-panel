import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, '0')).join('')
}

function redirectToApp(rawToken: string): Response {
  const location = `asine://auth/reset-password?token=${encodeURIComponent(rawToken)}&type=tenant_invite`
  return new Response(null, {
    status: 302,
    headers: { ...corsHeaders, Location: location },
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method === 'GET') {
    const url = new URL(req.url)
    const token = url.searchParams.get('token')
    if (!token) {
      return new Response('Missing invitation token.', {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
      })
    }
    return redirectToApp(token)
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  try {
    const body = await req.json().catch(() => ({})) as { token?: string; password?: string }
    const token = (body.token || '').trim()
    const password = body.password || ''

    if (!token || !password) {
      return new Response(
        JSON.stringify({ success: false, error: 'Token and password are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    if (password.length < 6) {
      return new Response(
        JSON.stringify({ success: false, error: 'Password must be at least 6 characters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const tokenHash = await sha256Hex(token)

    const { data: invite, error: inviteError } = await supabase
      .from('tenant_invites')
      .select(
        'id, email, first_name, last_name, phone, unit_number, property_id, property_name, expires_at, accepted_at',
      )
      .eq('token_hash', tokenHash)
      .maybeSingle()

    if (inviteError || !invite) {
      return new Response(
        JSON.stringify({ success: false, error: 'This invitation link is invalid.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    if (invite.accepted_at) {
      return new Response(
        JSON.stringify({ success: false, error: 'This invitation has already been used. Sign in instead.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    if (new Date(invite.expires_at).getTime() < Date.now()) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'This invitation has expired. Ask your property manager for a new QR code.',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const name = [invite.first_name, invite.last_name].filter(Boolean).join(' ')
    const email = (invite.email || '').trim().toLowerCase()

    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .ilike('email', email)
      .maybeSingle()

    if (existingUser) {
      return new Response(
        JSON.stringify({ success: false, error: 'An account with this email already exists. Sign in instead.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const adminResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseServiceKey,
        Authorization: `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        email,
        password,
        user_metadata: {
          name,
          role: 'tenant',
          property_id: invite.property_id,
          property_name: invite.property_name,
          unit_number: invite.unit_number,
        },
        email_confirm: true,
      }),
    })

    const adminResult = await adminResponse.json().catch(() => ({}))
    if (!adminResponse.ok) {
      console.error('Admin create tenant failed:', adminResult)
      return new Response(
        JSON.stringify({
          success: false,
          error: adminResult.error_description || adminResult.msg || adminResult.message || 'Failed to create account',
        }),
        { status: adminResponse.status || 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const authUserId = adminResult.id || adminResult.user?.id
    if (!authUserId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Account created but no user id was returned' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const profileFields = {
      name,
      email,
      role: 'tenant' as const,
      property_id: invite.property_id,
      property_name: invite.property_name,
      unit_number: invite.unit_number,
      phone: invite.phone,
      approved: 'approved',
      email_verified: true,
    }

    for (let attempt = 1; attempt <= 5; attempt++) {
      await new Promise((r) => setTimeout(r, 200))
      const { data, error } = await supabase
        .from('users')
        .update(profileFields)
        .eq('id', authUserId)
        .select('id')
        .maybeSingle()

      if (!error && data) break

      if (attempt === 5) {
        await supabase.from('users').insert({
          id: authUserId,
          ...profileFields,
        })
      }
    }

    const { error: acceptError } = await supabase
      .from('tenant_invites')
      .update({ accepted_at: new Date().toISOString() })
      .eq('id', invite.id)

    if (acceptError) {
      console.error('Failed to mark tenant invite accepted:', acceptError)
    }

    return new Response(
      JSON.stringify({
        success: true,
        user_id: authUserId,
        email,
        property_id: invite.property_id,
        property_name: invite.property_name,
        message: 'Account created. You can now sign in.',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    console.error('accept-tenant-invite error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
