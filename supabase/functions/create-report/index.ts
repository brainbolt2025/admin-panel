import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

const COMPLAINT_TYPES = [
  'unprofessional',
  'no_show',
  'harassment',
  'property_damage',
  'access_denied',
  'unsafe',
  'other',
] as const

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

    const body = await req.json().catch(() => ({})) as {
      work_order_id?: string
      description?: string
      type?: string
      category?: string
      title?: string
    }

    const workOrderId = (body.work_order_id || '').trim()
    const description = (body.description || '').trim()
    const complaintType = (body.type || body.category || '').trim().toLowerCase()
    const title = (body.title || '').trim()

    if (!workOrderId) {
      return new Response(
        JSON.stringify({ success: false, error: 'work_order_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    if (!description) {
      return new Response(
        JSON.stringify({ success: false, error: 'Description is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    if (description.length > 5000) {
      return new Response(
        JSON.stringify({ success: false, error: 'Description must be 5000 characters or less' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    if (!COMPLAINT_TYPES.includes(complaintType as (typeof COMPLAINT_TYPES)[number])) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `type is required. Use one of: ${COMPLAINT_TYPES.join(', ')}`,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)
    const { data: profile } = await supabaseAdmin
      .from('users')
      .select('id, name, email, role, property_id, property_name')
      .eq('id', user.id)
      .maybeSingle()

    if (!profile || (profile.role !== 'tenant' && profile.role !== 'technician')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Only tenants and technicians can submit reports.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    if (!profile.property_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Your account is not assigned to a property.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const { data: workOrder } = await supabaseAdmin
      .from('work_orders')
      .select('id, property_id, tenant_id, technician_id')
      .eq('id', workOrderId)
      .maybeSingle()

    if (!workOrder || workOrder.property_id !== profile.property_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Work order not found for your property.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    let subjectId: string | null = null
    if (profile.role === 'tenant') {
      if (workOrder.tenant_id !== profile.id) {
        return new Response(
          JSON.stringify({ success: false, error: 'You can only report on your own work order.' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }
      subjectId = workOrder.technician_id
      if (!subjectId) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'No technician is assigned to this work order yet.',
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }
    } else {
      if (workOrder.technician_id !== profile.id) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'You can only report on a work order assigned to you.',
          }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }
      subjectId = workOrder.tenant_id
      if (!subjectId) {
        return new Response(
          JSON.stringify({ success: false, error: 'This work order has no tenant to report.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }
    }

    const { data: subject } = await supabaseAdmin
      .from('users')
      .select('id, name, email, role')
      .eq('id', subjectId)
      .maybeSingle()

    if (!subject) {
      return new Response(
        JSON.stringify({ success: false, error: 'The other party on this work order was not found.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    let propertyName = profile.property_name || null
    const { data: property } = await supabaseAdmin
      .from('properties')
      .select('name')
      .eq('id', profile.property_id)
      .maybeSingle()
    if (property?.name) propertyName = property.name

    const { data: report, error: insertError } = await supabaseAdmin
      .from('reports')
      .insert({
        property_id: profile.property_id,
        property_name: propertyName,
        reporter_id: profile.id,
        reporter_role: profile.role,
        reporter_name: profile.name || profile.email,
        subject_id: subject.id,
        subject_role: subject.role === 'technician' ? 'technician' : 'tenant',
        subject_name: subject.name || subject.email,
        work_order_id: workOrderId,
        category: complaintType,
        severity: null,
        status: 'submitted',
        title: title || null,
        description,
      })
      .select('id, display_number, status, created_at, reporter_role, subject_role')
      .single()

    if (insertError || !report) {
      console.error('Failed to insert report:', insertError)
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to submit report. Please try again.',
          details: insertError?.message,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        report_id: report.id,
        display_number: report.display_number,
        status: report.status,
        work_order_id: workOrderId,
        reporter_id: profile.id,
        reporter_role: profile.role,
        subject_id: subject.id,
        subject_role: subject.role,
        property_id: profile.property_id,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    console.error('create-report error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
