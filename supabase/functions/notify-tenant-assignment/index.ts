import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { asineEmailHtml } from '../_shared/asineEmailLayout.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

interface NotifyTenantRequest {
  work_order_id: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client with service role key for admin access
    // Note: These functions use service role key internally, so user auth is optional
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    
    if (!supabaseServiceKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Service role key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // Parse request body
    const { work_order_id }: NotifyTenantRequest = await req.json()

    if (!work_order_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing work_order_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Fetching work order details for tenant notification:', work_order_id)

    // Fetch work order with related data
    const { data: workOrder, error: workOrderError } = await supabaseAdmin
      .from('work_orders')
      .select(`
        id,
        title,
        description,
        priority,
        status,
        unit_number,
        technician_id,
        tenant_id,
        property_id,
        created_at
      `)
      .eq('id', work_order_id)
      .single()

    if (workOrderError || !workOrder) {
      console.error('Error fetching work order:', workOrderError)
      return new Response(
        JSON.stringify({ success: false, error: 'Work order not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!workOrder.tenant_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Work order has no tenant' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch tenant details
    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from('users')
      .select('id, name, email')
      .eq('id', workOrder.tenant_id)
      .eq('role', 'tenant')
      .single()

    if (tenantError || !tenant) {
      console.error('Error fetching tenant:', tenantError)
      return new Response(
        JSON.stringify({ success: false, error: 'Tenant not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch technician details (for context in email)
    let technicianName = 'a technician'
    if (workOrder.technician_id) {
      const { data: technician } = await supabaseAdmin
        .from('users')
        .select('name')
        .eq('id', workOrder.technician_id)
        .single()
      
      if (technician?.name) {
        technicianName = technician.name
      }
    }

    // Fetch property details (optional, for context)
    let propertyName = 'your property'
    if (workOrder.property_id) {
      const { data: property } = await supabaseAdmin
        .from('properties')
        .select('name')
        .eq('id', workOrder.property_id)
        .single()
      
      if (property?.name) {
        propertyName = property.name
      }
    }

    // Mailgun configuration
    const MAILGUN_DOMAIN = Deno.env.get('MAILGUN_DOMAIN') || ''
    const MAILGUN_API_KEY = Deno.env.get('MAILGUN_API_KEY') || ''
    const MAILGUN_REGION = Deno.env.get('MAILGUN_REGION') || 'us'

    if (!MAILGUN_DOMAIN || !MAILGUN_API_KEY) {
      console.error('Missing Mailgun configuration')
      return new Response(
        JSON.stringify({ success: false, error: 'Mailgun configuration missing' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (MAILGUN_API_KEY.startsWith('pubkey-')) {
      return new Response(
        JSON.stringify({ success: false, error: 'MAILGUN_API_KEY must be a private key' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Determine deep link for mobile app
    // Use web URL format for better email client compatibility (matches working Dec 3 emails)
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY') || ''
    const isTestMode = stripeSecretKey.startsWith('sk_test_')
    
    // Get deep link configuration
    let TENANT_APP_URL = Deno.env.get('TENANT_APP_URL') || Deno.env.get('APP_URL') || Deno.env.get('BASE_URL') || ''
    
    // In test mode, prioritize web URL (http://localhost:8081) for email compatibility
    // This matches the old working emails from Dec 3
    if (isTestMode) {
      const DEV_APP_PORT = Deno.env.get('DEV_APP_PORT') || '8081'
      TENANT_APP_URL = TENANT_APP_URL || `http://localhost:${DEV_APP_PORT}`
    }
    
    // Fallback for production if no URL set
    if (!TENANT_APP_URL) {
      TENANT_APP_URL = 'https://app.asine.app'
    }
    
    // Always use web URL format (matches old working emails)
    // Web URLs work better in email clients and can redirect to app via Android App Links
    const workOrderLink = `${TENANT_APP_URL}/work-order/${work_order_id}`
    
    console.log('=== Tenant Assignment Link (Web URL Format) ===')
    console.log('TENANT_APP_URL:', TENANT_APP_URL)
    console.log('isTestMode:', isTestMode)
    console.log('Generated work order link:', workOrderLink)
    console.log('================================================')

    // Build email content
    const workOrderTitle = workOrder.title || workOrder.description || 'Your Work Order'
    const priorityLabel = workOrder.priority || 'Not specified'
    const unitInfo = workOrder.unit_number ? ` (Unit ${workOrder.unit_number})` : ''

    const htmlBody = asineEmailHtml({
      title: 'Work Order Update',
      greeting: `Hi ${tenant.name},`,
      paragraphs: ['Good news! A technician has been assigned to your work order:'],
      extraHtml: `<div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0 0 8px 0;"><strong>Title:</strong> ${workOrderTitle}</p>
            ${workOrder.description ? `<p style="margin: 0 0 8px 0;"><strong>Description:</strong> ${workOrder.description}</p>` : ''}
            <p style="margin: 0 0 8px 0;"><strong>Priority:</strong> ${priorityLabel}</p>
            <p style="margin: 0 0 8px 0;"><strong>Property:</strong> ${propertyName}${unitInfo}</p>
            <p style="margin: 0 0 8px 0;"><strong>Assigned Technician:</strong> ${technicianName}</p>
            <p style="margin: 0;"><strong>Status:</strong> ${workOrder.status || 'In Progress'}</p>
          </div>`,
      cta: { label: 'View Work Order', href: workOrderLink },
      secondaryNote: 'The technician will begin working on your request soon. You can track the progress and communicate with them through the work order.',
    })

    const textBody = `Hi ${tenant.name},

Good news! A technician has been assigned to your work order:

Title: ${workOrderTitle}
${workOrder.description ? `Description: ${workOrder.description}\n` : ''}Priority: ${priorityLabel}
Property: ${propertyName}${unitInfo}
Assigned Technician: ${technicianName}
Status: ${workOrder.status || 'In Progress'}

View the work order: ${workOrderLink}

The technician will begin working on your request soon. You can track the progress and communicate with them through the work order.

Best regards,
The Asine Team`

    // Send email via Mailgun
    const mailgunBaseUrl =
      MAILGUN_REGION === 'eu' ? 'https://api.eu.mailgun.net/v3' : 'https://api.mailgun.net/v3'
    const mailgunUrl = `${mailgunBaseUrl}/${MAILGUN_DOMAIN}/messages`
    const mailgunAuthHeader = `Basic ${btoa(`api:${MAILGUN_API_KEY}`)}`

    const formData = new FormData()
    formData.append('from', `Asine Work Orders <noreply@${MAILGUN_DOMAIN}>`)
    formData.append('to', tenant.email)
    formData.append('subject', `Technician Assigned: ${workOrderTitle}`)
    formData.append('html', htmlBody)
    formData.append('text', textBody)

    console.log('Sending assignment notification email to tenant:', tenant.email)

    const mailgunResponse = await fetch(mailgunUrl, {
      method: 'POST',
      headers: {
        Authorization: mailgunAuthHeader,
      },
      body: formData,
    })

    if (!mailgunResponse.ok) {
      const mailgunResult = await mailgunResponse.json().catch(() => ({}))
      console.error('Mailgun error sending tenant notification email:', mailgunResult)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to send notification email',
          details: mailgunResult.message || mailgunResponse.statusText
        }),
        { status: mailgunResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const mailgunResult = await mailgunResponse.json().catch(() => ({}))

    console.log('Tenant notification email sent successfully:', mailgunResult.id)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Assignment notification sent to tenant',
        tenant_email: tenant.email,
        work_order_id: work_order_id,
        mailgun_id: mailgunResult.id,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in notify-tenant-assignment:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

