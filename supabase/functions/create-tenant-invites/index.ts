import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PLAY_STORE_URL =
  Deno.env.get('GOOGLE_PLAY_URL') ||
  'https://play.google.com/store/apps/details?id=com.asine.app'
const INVITE_TTL_MS = 30 * 24 * 60 * 60 * 1000

interface TenantInput {
  email?: string
  first_name?: string
  last_name?: string
  name?: string
  unit_number?: string
  phone?: string
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

function deepLinkScheme(): string {
  const raw = (Deno.env.get('APP_DEEP_LINK_SCHEME') || 'asine://').trim() || 'asine://'
  const match = raw.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):\/\//)
  return match ? `${match[1]}://` : `${raw.replace(/:?$/, '')}://`
}

function inviteHttpsBase(): string {
  return (
    Deno.env.get('TENANT_INVITE_HTTPS_BASE') ||
    Deno.env.get('PASSWORD_RESET_WEB_URL') ||
    'https://www.sycnmore.com'
  ).replace(/\/$/, '')
}

function inviteLinks(rawToken: string): { app_link: string; https_link: string; qr_link: string } {
  const qs = `token=${encodeURIComponent(rawToken)}&type=tenant_invite`
  const scheme = deepLinkScheme()
  const app_link = `${scheme}auth/reset-password?${qs}`
  const https_link = `${inviteHttpsBase()}/auth/reset-password?${qs}`
  const qrMode = (Deno.env.get('TENANT_INVITE_QR_MODE') || 'https').trim().toLowerCase()
  return {
    app_link,
    https_link,
    qr_link: qrMode === 'app' ? app_link : https_link,
  }
}

function splitName(input: TenantInput): { first_name: string; last_name: string } {
  const first = (input.first_name || '').trim()
  const last = (input.last_name || '').trim()
  if (first) return { first_name: first, last_name: last }
  const name = (input.name || '').trim()
  if (!name) return { first_name: '', last_name: '' }
  const parts = name.split(/\s+/)
  return { first_name: parts[0], last_name: parts.slice(1).join(' ') }
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    if (!supabaseServiceKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const supabaseAuthed = createClient(supabaseUrl, supabaseAnonKey || supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: authData, error: authError } = await supabaseAuthed.auth.getUser()
    if (authError || !authData.user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const { data: pmProfile } = await supabase
      .from('users')
      .select('id, role, property_id, property_name')
      .eq('id', authData.user.id)
      .maybeSingle()

    if (!pmProfile || pmProfile.role !== 'pm' || !pmProfile.property_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Only property managers can add tenants for their property.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const body = await req.json().catch(() => ({})) as {
      tenants?: TenantInput[]
      refresh_invite_id?: string
    }

    let propertyName = pmProfile.property_name || null
    const { data: property } = await supabase
      .from('properties')
      .select('id, name')
      .eq('id', pmProfile.property_id)
      .maybeSingle()
    if (property?.name) propertyName = property.name

    const mintInvite = async (input: TenantInput) => {
      const email = (input.email || '').trim().toLowerCase()
      const { first_name, last_name } = splitName(input)
      const unit_number = (input.unit_number || '').trim()
      const phone = (input.phone || '').trim() || null

      if (!email || !first_name || !unit_number) {
        return { email, error: 'Email, name, and unit are required' }
      }
      if (!EMAIL_RE.test(email)) {
        return { email, error: 'Invalid email format' }
      }

      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .ilike('email', email)
        .maybeSingle()
      if (existingUser) {
        return { email, error: 'An account with this email already exists' }
      }

      await supabase
        .from('tenant_invites')
        .delete()
        .ilike('email', email)
        .is('accepted_at', null)

      const rawToken = generateInviteToken()
      const tokenHash = await sha256Hex(rawToken)
      const expiresAt = new Date(Date.now() + INVITE_TTL_MS).toISOString()

      const { data: inviteRow, error: inviteError } = await supabase
        .from('tenant_invites')
        .insert({
          email,
          first_name,
          last_name,
          phone,
          unit_number,
          property_id: pmProfile.property_id,
          property_name: propertyName,
          invited_by: pmProfile.id,
          token_hash: tokenHash,
          expires_at: expiresAt,
        })
        .select('id, email, first_name, last_name, unit_number, phone, expires_at')
        .single()

      if (inviteError || !inviteRow) {
        return { email, error: inviteError?.message || 'Failed to create invitation' }
      }

      const links = inviteLinks(rawToken)
      return {
        email,
        invite_id: inviteRow.id,
        first_name: inviteRow.first_name,
        last_name: inviteRow.last_name,
        unit_number: inviteRow.unit_number,
        phone: inviteRow.phone,
        token: rawToken,
        expires_at: inviteRow.expires_at,
        ...links,
      }
    }

    if (body.refresh_invite_id) {
      const { data: existing } = await supabase
        .from('tenant_invites')
        .select('id, email, first_name, last_name, phone, unit_number')
        .eq('id', body.refresh_invite_id)
        .eq('property_id', pmProfile.property_id)
        .is('accepted_at', null)
        .maybeSingle()

      if (!existing) {
        return new Response(
          JSON.stringify({ success: false, error: 'Invite not found or already used.' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }

      const result = await mintInvite({
        email: existing.email,
        first_name: existing.first_name,
        last_name: existing.last_name,
        phone: existing.phone,
        unit_number: existing.unit_number,
      })

      return new Response(
        JSON.stringify({
          success: !result.error,
          play_store_url: PLAY_STORE_URL,
          results: [result],
        }),
        { status: result.error ? 400 : 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const tenants = Array.isArray(body.tenants) ? body.tenants : []
    if (tenants.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'tenants array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }
    if (tenants.length > 100) {
      return new Response(
        JSON.stringify({ success: false, error: 'Add at most 100 tenants at a time.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const results = []
    for (const tenant of tenants) {
      results.push(await mintInvite(tenant))
    }

    const created = results.filter((r) => !r.error).length
    return new Response(
      JSON.stringify({
        success: created > 0,
        created,
        failed: results.length - created,
        play_store_url: PLAY_STORE_URL,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    console.error('create-tenant-invites error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
