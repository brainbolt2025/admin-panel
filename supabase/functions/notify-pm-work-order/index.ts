import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { asineEmailHtml } from '../_shared/asineEmailLayout.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

interface NotifyPmWorkOrderRequest {
  work_order_id: string
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

    if (!supabaseServiceKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Service role key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)
    const { work_order_id }: NotifyPmWorkOrderRequest = await req.json()

    if (!work_order_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing work_order_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const { data: workOrder, error: workOrderError } = await supabaseAdmin
      .from('work_orders')
      .select(`
        id,
        title,
        description,
        priority,
        status,
        unit_number,
        tenant_id,
        property_id
      `)
      .eq('id', work_order_id)
      .single()

    if (workOrderError || !workOrder) {
      console.error('Error fetching work order:', workOrderError)
      return new Response(
        JSON.stringify({ success: false, error: 'Work order not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    if (!workOrder.property_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Work order has no property_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const { data: property, error: propertyError } = await supabaseAdmin
      .from('properties')
      .select('id, name, pm_id')
      .eq('id', workOrder.property_id)
      .maybeSingle()

    if (propertyError || !property) {
      console.error('Property not found:', propertyError)
      return new Response(
        JSON.stringify({ success: false, error: 'Property or property manager not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    let pmUser: { id: string; name: string | null; email: string | null; role: string | null } | null = null

    if (property.pm_id) {
      const { data } = await supabaseAdmin
        .from('users')
        .select('id, name, email, role')
        .eq('id', property.pm_id)
        .eq('role', 'pm')
        .maybeSingle()
      pmUser = data
    }

    if (!pmUser?.email) {
      const { data } = await supabaseAdmin
        .from('users')
        .select('id, name, email, role')
        .eq('property_id', workOrder.property_id)
        .eq('role', 'pm')
        .maybeSingle()
      pmUser = data
      if (pmUser?.id && !property.pm_id) {
        await supabaseAdmin
          .from('properties')
          .update({ pm_id: pmUser.id })
          .eq('id', property.id)
      }
    }

    if (!pmUser?.email) {
      console.error('PM user not found for property:', workOrder.property_id)
      return new Response(
        JSON.stringify({ success: false, error: 'Property manager email not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    let tenantName = 'a tenant'
    if (workOrder.tenant_id) {
      const { data: tenant } = await supabaseAdmin
        .from('users')
        .select('name')
        .eq('id', workOrder.tenant_id)
        .maybeSingle()
      if (tenant?.name) tenantName = tenant.name
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

    if (MAILGUN_API_KEY.startsWith('pubkey-')) {
      return new Response(
        JSON.stringify({ success: false, error: 'MAILGUN_API_KEY must be a private key' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY') || ''
    const isTestMode = stripeSecretKey.startsWith('sk_test_')
    const siteUrl = (
      Deno.env.get('SITE_URL') ||
      Deno.env.get('APP_URL') ||
      Deno.env.get('BASE_URL') ||
      (isTestMode ? 'http://localhost:5173' : 'https://www.sycnmore.com')
    ).replace(/\/$/, '')

    const adminLink = siteUrl
    const propertyName = property.name || 'your property'
    const workOrderTitle = workOrder.title || workOrder.description || 'Untitled Work Order'
    const priorityLabel = workOrder.priority || 'Not specified'

    const htmlBody = asineEmailHtml({
      title: 'New Work Order',
      greeting: `Hi ${pmUser.name || 'Property Manager'},`,
      paragraphs: [
        `A tenant submitted a new work order for <strong>${propertyName}</strong>:`,
      ],
      extraHtml: `<div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0 0 8px 0;"><strong>Title:</strong> ${workOrderTitle}</p>
            ${workOrder.description ? `<p style="margin: 0 0 8px 0;"><strong>Description:</strong> ${workOrder.description}</p>` : ''}
            <p style="margin: 0 0 8px 0;"><strong>Priority:</strong> ${priorityLabel}</p>
            <p style="margin: 0 0 8px 0;"><strong>Property:</strong> ${propertyName}</p>
            ${workOrder.unit_number ? `<p style="margin: 0 0 8px 0;"><strong>Unit:</strong> ${workOrder.unit_number}</p>` : ''}
            <p style="margin: 0 0 8px 0;"><strong>Tenant:</strong> ${tenantName}</p>
            <p style="margin: 0;"><strong>Status:</strong> ${workOrder.status || 'Pending'}</p>
          </div>`,
      cta: { label: 'Open Admin Panel', href: adminLink },
      secondaryNote: 'Open the admin panel to review and assign a technician.',
    })

    const textBody = `Hi ${pmUser.name || 'Property Manager'},

A tenant submitted a new work order for ${propertyName}:

Title: ${workOrderTitle}
${workOrder.description ? `Description: ${workOrder.description}\n` : ''}Priority: ${priorityLabel}
Property: ${propertyName}
${workOrder.unit_number ? `Unit: ${workOrder.unit_number}\n` : ''}Tenant: ${tenantName}
Status: ${workOrder.status || 'Pending'}

Open the admin panel: ${adminLink}

Open the admin panel to review and assign a technician.

Best regards,
The Asine Team`

    const mailgunBaseUrl =
      MAILGUN_REGION === 'eu' ? 'https://api.eu.mailgun.net/v3' : 'https://api.mailgun.net/v3'
    const formData = new FormData()
    formData.append('from', `Asine Work Orders <noreply@${MAILGUN_DOMAIN}>`)
    formData.append('to', pmUser.email)
    formData.append('subject', `New Work Order: ${workOrderTitle} – ${propertyName}`)
    formData.append('html', htmlBody)
    formData.append('text', textBody)

    const mailgunResponse = await fetch(`${mailgunBaseUrl}/${MAILGUN_DOMAIN}/messages`, {
      method: 'POST',
      headers: { Authorization: `Basic ${btoa(`api:${MAILGUN_API_KEY}`)}` },
      body: formData,
    })

    if (!mailgunResponse.ok) {
      const mailgunResult = await mailgunResponse.json().catch(() => ({}))
      console.error('Mailgun error sending PM work order email:', mailgunResult)
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to send PM notification email',
          details: mailgunResult.message || mailgunResponse.statusText,
        }),
        {
          status: mailgunResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    const mailgunResult = await mailgunResponse.json().catch(() => ({}))
    console.log('PM work order notification sent:', mailgunResult.id)

    return new Response(
      JSON.stringify({
        success: true,
        pm_email: pmUser.email,
        mailgun_id: mailgunResult.id,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    console.error('Error in notify-pm-work-order:', error)
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
