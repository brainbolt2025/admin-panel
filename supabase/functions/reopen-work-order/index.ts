import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

interface ReopenWorkOrderRequest {
  work_order_id: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed. Use POST.' }),
      {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing or invalid authorization header' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    const token = authHeader.replace('Bearer ', '')

    // Initialize Supabase client with service role key for admin operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    if (!supabaseServiceKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing Supabase service role key' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // Verify the JWT token and get user info
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)

    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid or expired token' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    // Check user role - allow tenants and PMs
    const userRole = user.user_metadata?.role || user.app_metadata?.role
    if (userRole !== 'tenant' && userRole !== 'pm') {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Unauthorized. Only tenants and property managers can reopen work orders.' 
        }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    // Parse request body
    const body: ReopenWorkOrderRequest = await req.json()
    const { work_order_id } = body

    if (!work_order_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required field: work_order_id' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    // Get user's property_id from users table
    const { data: userData, error: userDataError } = await supabaseAdmin
      .from('users')
      .select('id, role, property_id')
      .eq('id', user.id)
      .single()

    if (userDataError || !userData) {
      return new Response(
        JSON.stringify({ success: false, error: 'User not found in database' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    // Fetch the work order with all needed fields
    const { data: workOrder, error: workOrderError } = await supabaseAdmin
      .from('work_orders')
      .select('id, status, tenant_id, property_id, technician_id, title, description, priority, unit_number')
      .eq('id', work_order_id)
      .single()

    if (workOrderError || !workOrder) {
      return new Response(
        JSON.stringify({ success: false, error: 'Work order not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    // Validate ownership/access:
    // - Tenants can only reopen their own work orders
    // - PMs can reopen work orders in their property
    if (userData.role === 'tenant') {
      if (workOrder.tenant_id !== user.id) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Unauthorized. You can only reopen your own work orders.' 
          }),
          {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        )
      }
    } else if (userData.role === 'pm') {
      if (workOrder.property_id !== userData.property_id) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Unauthorized. You can only reopen work orders in your property.' 
          }),
          {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        )
      }
    }

    // Validate that work order can be reopened (must be Completed or Canceled)
    if (workOrder.status !== 'Completed' && workOrder.status !== 'Canceled') {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Cannot reopen work order with status "${workOrder.status}". Only Completed or Canceled work orders can be reopened.` 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    // Update work order status to "In Progress"
    const { data: updatedWorkOrder, error: updateError } = await supabaseAdmin
      .from('work_orders')
      .update({ status: 'In Progress' })
      .eq('id', work_order_id)
      .select()
      .single()

    if (updateError || !updatedWorkOrder) {
      console.error('Error updating work order:', updateError)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to reopen work order',
          details: updateError?.message 
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    console.log(`Work order ${work_order_id} reopened by ${userRole} ${user.id}`)

    // Send email notification to technician (non-blocking)
    // Don't fail the reopen if email fails
    if (workOrder.technician_id) {
      // Fire and forget - don't await to avoid blocking the response
      sendTechnicianReopenNotification(
        supabaseAdmin,
        workOrder.technician_id,
        work_order_id,
        workOrder
      ).catch((error) => {
        console.error('Failed to send technician reopen notification:', error)
        // Non-critical error, don't throw
      })
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Work order reopened successfully',
        work_order: updatedWorkOrder,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  } catch (error) {
    console.error('Error in reopen-work-order:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
})

// Helper function to send email notification to technician when work order is reopened
async function sendTechnicianReopenNotification(
  supabaseAdmin: any,
  technicianId: string,
  workOrderId: string,
  workOrder: any
) {
  try {
    // Fetch technician details
    const { data: technician, error: technicianError } = await supabaseAdmin
      .from('users')
      .select('id, name, email')
      .eq('id', technicianId)
      .eq('role', 'technician')
      .single()

    if (technicianError || !technician) {
      console.warn('Technician not found for reopen notification:', technicianId)
      return
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
      console.warn('Mailgun configuration missing, skipping technician reopen notification email.')
      return
    }

    if (MAILGUN_API_KEY.startsWith('pubkey-')) {
      console.warn('MAILGUN_API_KEY must be a private key, skipping email.')
      return
    }

    // Determine deep link for mobile app
    // Use web URL format for better email client compatibility
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY') || ''
    const isTestMode = stripeSecretKey.startsWith('sk_test_')
    
    // Get deep link configuration
    let APP_URL = Deno.env.get('APP_URL') || Deno.env.get('BASE_URL') || ''
    
    // In test mode, prioritize web URL (http://localhost:8081) for email compatibility
    if (isTestMode) {
      const DEV_APP_PORT = Deno.env.get('DEV_APP_PORT') || '8081'
      APP_URL = APP_URL || `http://localhost:${DEV_APP_PORT}`
    }
    
    // Fallback for production if no URL set
    if (!APP_URL) {
      APP_URL = 'https://app.asine.app'
    }
    
    // Always use web URL format (matches working emails)
    const workOrderLink = `${APP_URL}/work-order/${workOrderId}`

    // Build email content
    const workOrderTitle = workOrder.title || workOrder.description || 'Untitled Work Order'
    const priorityLabel = workOrder.priority || 'Not specified'

    const htmlBody = `
      <html>
        <body style="font-family: Arial, sans-serif; color: #1f2933; line-height: 1.6; padding: 24px;">
          <h2 style="color: #0f766e; margin-bottom: 20px;">Work Order Reopened</h2>
          <p>Hi ${technician.name},</p>
          <p>A work order you were assigned to has been reopened and requires your attention:</p>
          
          <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0 0 8px 0;"><strong>Title:</strong> ${workOrderTitle}</p>
            ${workOrder.description ? `<p style="margin: 0 0 8px 0;"><strong>Description:</strong> ${workOrder.description}</p>` : ''}
            <p style="margin: 0 0 8px 0;"><strong>Priority:</strong> ${priorityLabel}</p>
            <p style="margin: 0 0 8px 0;"><strong>Property:</strong> ${propertyName}</p>
            ${workOrder.unit_number ? `<p style="margin: 0 0 8px 0;"><strong>Unit Number:</strong> ${workOrder.unit_number}</p>` : ''}
            <p style="margin: 0 0 8px 0;"><strong>Tenant:</strong> ${tenantName}</p>
            <p style="margin: 0;"><strong>Status:</strong> In Progress</p>
          </div>

          <p style="margin: 24px 0;">
            <a href="${workOrderLink}" style="display: inline-block; background: #0f766e; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
              View Work Order
            </a>
          </p>

          <p style="color: #666; font-size: 14px; margin-top: 30px;">
            Please review the work order and continue with the necessary work.
          </p>

          <p style="margin-top: 32px;">Best regards,<br/>The Asine Team</p>
        </body>
      </html>
    `

    const textBody = `Hi ${technician.name},

A work order you were assigned to has been reopened and requires your attention:

Title: ${workOrderTitle}
${workOrder.description ? `Description: ${workOrder.description}\n` : ''}Priority: ${priorityLabel}
Property: ${propertyName}
${workOrder.unit_number ? `Unit Number: ${workOrder.unit_number}\n` : ''}Tenant: ${tenantName}
Status: In Progress

View the work order: ${workOrderLink}

Please review the work order and continue with the necessary work.

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
    formData.append('subject', `Work Order Reopened: ${workOrderTitle}`)
    formData.append('html', htmlBody)
    formData.append('text', textBody)

    console.log('Sending reopen notification email to technician:', technician.email)

    const mailgunResponse = await fetch(mailgunUrl, {
      method: 'POST',
      headers: {
        Authorization: mailgunAuthHeader,
      },
      body: formData,
    })

    if (!mailgunResponse.ok) {
      const mailgunResult = await mailgunResponse.json().catch(() => ({}))
      console.error('Mailgun error sending technician reopen notification email:', mailgunResult)
      throw new Error(`Mailgun error: ${mailgunResult.message || mailgunResponse.statusText}`)
    }

    const mailgunResult = await mailgunResponse.json().catch(() => ({}))
    console.log('✅ Technician reopen notification email sent successfully:', mailgunResult.id)
  } catch (error) {
    console.error('Error in sendTechnicianReopenNotification:', error)
    // Don't throw - this is non-critical
  }
}

