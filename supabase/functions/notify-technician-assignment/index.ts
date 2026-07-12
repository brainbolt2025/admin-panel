import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

interface NotifyTechnicianRequest {
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
    const { work_order_id }: NotifyTechnicianRequest = await req.json()

    if (!work_order_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing work_order_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Fetching work order details for:', work_order_id)

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

    if (!workOrder.technician_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Work order has no assigned technician' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch technician details
    const { data: technician, error: technicianError } = await supabaseAdmin
      .from('users')
      .select('id, name, email')
      .eq('id', workOrder.technician_id)
      .eq('role', 'technician')
      .single()

    if (technicianError || !technician) {
      console.error('Error fetching technician:', technicianError)
      return new Response(
        JSON.stringify({ success: false, error: 'Technician not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch tenant details (optional, for context in email)
    let tenantName = 'the tenant'
    if (workOrder.tenant_id) {
      const { data: tenant } = await supabaseAdmin
        .from('users')
        .select('name')
        .eq('id', workOrder.tenant_id)
        .single()
      
      if (tenant?.name) {
        tenantName = tenant.name
      }
    }

    // Fetch property details (optional, for context)
    let propertyName = 'the property'
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
    let APP_URL = Deno.env.get('APP_URL') || Deno.env.get('BASE_URL') || ''
    
    // In test mode, prioritize web URL (http://localhost:8081) for email compatibility
    // This matches the old working emails from Dec 3
    if (isTestMode) {
      const DEV_APP_PORT = Deno.env.get('DEV_APP_PORT') || '8081'
      APP_URL = APP_URL || `http://localhost:${DEV_APP_PORT}`
    }
    
    // Fallback for production if no URL set
    if (!APP_URL) {
      APP_URL = 'https://app.asine.app'
    }
    
    // Always use web URL format (matches old working emails)
    // Web URLs work better in email clients and can redirect to app via Android App Links
    const workOrderLink = `${APP_URL}/work-order/${work_order_id}`
    
    console.log('=== Technician Assignment Link (Web URL Format) ===')
    console.log('APP_URL:', APP_URL)
    console.log('isTestMode:', isTestMode)
    console.log('Generated work order link:', workOrderLink)
    console.log('===================================================')

    // Build email content
    const workOrderTitle = workOrder.title || workOrder.description || 'Untitled Work Order'
    const priorityLabel = workOrder.priority || 'Not specified'

    const htmlBody = `
      <html>
        <body style="font-family: Arial, sans-serif; color: #1f2933; line-height: 1.6; padding: 24px;">
          <h2 style="color: #0f766e; margin-bottom: 20px;">New Work Order Assignment</h2>
          <p>Hi ${technician.name},</p>
          <p>You have been assigned to a new work order:</p>
          
          <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0 0 8px 0;"><strong>Title:</strong> ${workOrderTitle}</p>
            ${workOrder.description ? `<p style="margin: 0 0 8px 0;"><strong>Description:</strong> ${workOrder.description}</p>` : ''}
            <p style="margin: 0 0 8px 0;"><strong>Priority:</strong> ${priorityLabel}</p>
            <p style="margin: 0 0 8px 0;"><strong>Property:</strong> ${propertyName}</p>
            ${workOrder.unit_number ? `<p style="margin: 0 0 8px 0;"><strong>Unit Number:</strong> ${workOrder.unit_number}</p>` : ''}
            <p style="margin: 0 0 8px 0;"><strong>Tenant:</strong> ${tenantName}</p>
            <p style="margin: 0;"><strong>Status:</strong> ${workOrder.status || 'Pending'}</p>
          </div>

          <p style="margin: 24px 0;">
            <a href="${workOrderLink}" style="display: inline-block; background: #0f766e; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
              View Work Order
            </a>
          </p>

          <p style="color: #666; font-size: 14px; margin-top: 30px;">
            Please review the work order details and begin work as soon as possible.
          </p>

          <p style="margin-top: 32px;">Best regards,<br/>The Asine Team</p>
        </body>
      </html>
    `

    const textBody = `Hi ${technician.name},

You have been assigned to a new work order:

Title: ${workOrderTitle}
${workOrder.description ? `Description: ${workOrder.description}\n` : ''}Priority: ${priorityLabel}
Property: ${propertyName}
${workOrder.unit_number ? `Unit Number: ${workOrder.unit_number}\n` : ''}Tenant: ${tenantName}
Status: ${workOrder.status || 'Pending'}

View the work order: ${workOrderLink}

Please review the work order details and begin work as soon as possible.

Best regards,
The Asine Team`

    // Send email via Mailgun
    const mailgunBaseUrl =
      MAILGUN_REGION === 'eu' ? 'https://api.eu.mailgun.net/v3' : 'https://api.mailgun.net/v3'
    const mailgunUrl = `${mailgunBaseUrl}/${MAILGUN_DOMAIN}/messages`
    const mailgunAuthHeader = `Basic ${btoa(`api:${MAILGUN_API_KEY}`)}`

    const formData = new FormData()
    formData.append('from', `Asine Work Orders <noreply@${MAILGUN_DOMAIN}>`)
    formData.append('to', technician.email)
    formData.append('subject', `New Work Order Assignment: ${workOrderTitle}`)
    formData.append('html', htmlBody)
    formData.append('text', textBody)

    console.log('Sending assignment email to technician:', technician.email)

    const mailgunResponse = await fetch(mailgunUrl, {
      method: 'POST',
      headers: {
        Authorization: mailgunAuthHeader,
      },
      body: formData,
    })

    if (!mailgunResponse.ok) {
      const mailgunResult = await mailgunResponse.json().catch(() => ({}))
      console.error('Mailgun error sending technician assignment email:', mailgunResult)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to send assignment email',
          details: mailgunResult.message || mailgunResponse.statusText
        }),
        { status: mailgunResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const mailgunResult = await mailgunResponse.json().catch(() => ({}))

    console.log('Technician assignment email sent successfully:', mailgunResult.id)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Assignment notification sent to technician',
        technician_email: technician.email,
        work_order_id: work_order_id,
        mailgun_id: mailgunResult.id,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in notify-technician-assignment:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

