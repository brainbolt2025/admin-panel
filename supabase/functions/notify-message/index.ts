import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

interface NotifyMessageRequest {
  conversation_id: string
  sender_id: string
  message_content: string
}

serve(async (req) => {
  console.log('=== notify-message function called ===')
  console.log('Method:', req.method)
  console.log('URL:', req.url)
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('Handling OPTIONS preflight request')
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('Starting notification process...')
    
    // Create Supabase client with service role key for admin access
    // This function can be called from:
    // 1. Web app (with user auth token) - we'll use service role internally anyway
    // 2. Database webhook (with service role key) - direct call
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    
    if (!supabaseServiceKey) {
      console.error('Service role key not configured')
      return new Response(
        JSON.stringify({ success: false, error: 'Service role key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // Parse request body
    console.log('Parsing request body...')
    const body = await req.json()
    console.log('Request body received:', JSON.stringify(body, null, 2))
    
    // Handle different payload formats:
    // 1. Direct format from Chat component: { conversation_id, sender_id, message_content }
    // 2. Supabase Database Webhook format: { type, table, record: { id, conversation_id, sender_id, content, ... }, schema, old_record }
    let conversation_id: string
    let sender_id: string
    let message_content: string
    
    if (body.record) {
      // Supabase Database Webhook format
      console.log('Detected Supabase Database Webhook format')
      conversation_id = body.record.conversation_id
      sender_id = body.record.sender_id
      message_content = body.record.content // Note: webhook sends 'content', not 'message_content'
    } else if (body.conversation_id && body.sender_id) {
      // Direct format from Chat component
      console.log('Detected direct format')
      conversation_id = body.conversation_id
      sender_id = body.sender_id
      message_content = body.message_content || body.content
    } else {
      console.error('Unknown request body format:', body)
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid request body format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    console.log('Extracted values:', { 
      conversation_id, 
      sender_id,
      message_content_length: message_content?.length || 0
    })

    if (!conversation_id || !sender_id || !message_content) {
      console.error('Missing required fields:', { conversation_id: !!conversation_id, sender_id: !!sender_id, message_content: !!message_content })
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields: conversation_id, sender_id, message_content' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Fetching conversation details for:', conversation_id)

    // Fetch conversation to get work_order_id
    const { data: conversation, error: conversationError } = await supabaseAdmin
      .from('conversations')
      .select('id, work_order_id')
      .eq('id', conversation_id)
      .single()

    if (conversationError || !conversation) {
      console.error('Error fetching conversation:', conversationError)
      return new Response(
        JSON.stringify({ success: false, error: 'Conversation not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch conversation participants to find the recipient (the other participant)
    const { data: participants, error: participantsError } = await supabaseAdmin
      .from('conversation_participants')
      .select('user_id')
      .eq('conversation_id', conversation_id)

    if (participantsError || !participants || participants.length !== 2) {
      console.error('Error fetching participants or invalid participant count:', participantsError)
      return new Response(
        JSON.stringify({ success: false, error: 'Could not find conversation participants' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Find recipient (the participant who is not the sender)
    const recipientId = participants.find((p: any) => p.user_id !== sender_id)?.user_id

    if (!recipientId) {
      console.error('Could not find recipient (other participant)')
      return new Response(
        JSON.stringify({ success: false, error: 'Could not find recipient' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch sender details
    const { data: sender, error: senderError } = await supabaseAdmin
      .from('users')
      .select('id, name, email, role')
      .eq('id', sender_id)
      .single()

    if (senderError || !sender) {
      console.error('Error fetching sender:', senderError)
      return new Response(
        JSON.stringify({ success: false, error: 'Sender not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch recipient details (including online status)
    const { data: recipient, error: recipientError } = await supabaseAdmin
      .from('users')
      .select('id, name, email, role, is_online, last_seen')
      .eq('id', recipientId)
      .single()

    if (recipientError || !recipient || !recipient.email) {
      console.error('Error fetching recipient:', recipientError)
      return new Response(
        JSON.stringify({ success: false, error: 'Recipient not found or missing email' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Only send notifications between tenants and technicians
    const senderRole = sender.role
    const recipientRole = recipient.role

    if (!((senderRole === 'tenant' && recipientRole === 'technician') || 
          (senderRole === 'technician' && recipientRole === 'tenant'))) {
      console.log('Skipping notification - only tenant/technician messages trigger notifications')
      return new Response(
        JSON.stringify({ success: true, message: 'Notification skipped - not a tenant/technician conversation' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if recipient is online and active - skip email if they are
    // Only send email notifications when recipient is offline or inactive (> 5 minutes)
    const OFFLINE_THRESHOLD_MINUTES = 5
    const isRecipientOnline = recipient.is_online === true
    
    // Debug logging
    console.log(`Recipient online status check:`, {
      recipient_id: recipient.id,
      recipient_role: recipient.role,
      is_online: recipient.is_online,
      last_seen: recipient.last_seen,
      isRecipientOnline
    })
    
    // Check last_seen to determine if user is active (even if is_online is null/undefined)
    let minutesSinceLastSeen = Infinity
    if (recipient.last_seen) {
      const lastSeen = new Date(recipient.last_seen)
      minutesSinceLastSeen = (Date.now() - lastSeen.getTime()) / (1000 * 60)
    }
    
    // If recipient is marked as online OR was active recently (within threshold), skip email
    if (isRecipientOnline) {
      // Explicitly marked as online
      if (recipient.last_seen && minutesSinceLastSeen <= OFFLINE_THRESHOLD_MINUTES) {
        // Online and active within threshold - definitely skip
        console.log(`✅ Skipping email notification - recipient (${recipient.role}) is online and active (last seen ${Math.round(minutesSinceLastSeen)} minutes ago)`)
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Notification skipped - recipient is online and active' 
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      } else {
        // Online but no last_seen or inactive - still skip (they're marked online)
        console.log(`✅ Skipping email notification - recipient (${recipient.role}) is online (last_seen: ${recipient.last_seen ? Math.round(minutesSinceLastSeen) + ' minutes ago' : 'not available'})`)
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Notification skipped - recipient is online' 
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    } else if (recipient.last_seen && minutesSinceLastSeen <= OFFLINE_THRESHOLD_MINUTES) {
      // Not marked as online, but was active recently - treat as online and skip email
      console.log(`✅ Skipping email notification - recipient (${recipient.role}) was active recently (last seen ${Math.round(minutesSinceLastSeen)} minutes ago, is_online: ${recipient.is_online})`)
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Notification skipped - recipient was active recently' 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } else {
      // Offline or inactive - send email
      console.log(`📧 Sending email notification - recipient (${recipient.role}) is offline or inactive (is_online: ${recipient.is_online}, last seen ${recipient.last_seen ? Math.round(minutesSinceLastSeen) : 'never'} minutes ago)`)
    }

    // Fetch work order details for context
    let workOrderTitle = 'Work Order'
    if (conversation.work_order_id) {
      const { data: workOrder } = await supabaseAdmin
        .from('work_orders')
        .select('title')
        .eq('id', conversation.work_order_id)
        .single()
      
      if (workOrder?.title) {
        workOrderTitle = workOrder.title
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
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY') || ''
    const isTestMode = stripeSecretKey.startsWith('sk_test_')
    
    // Get app URL configuration
    const APP_URL = Deno.env.get('APP_URL') || Deno.env.get('BASE_URL') || ''
    const APP_DEEP_LINK_SCHEME = Deno.env.get('APP_DEEP_LINK_SCHEME') || ''
    
    // Construct link to conversation using work_order_id (more reliable than conversation_id)
    // The client app can find or create the conversation based on work_order_id
    let conversationLink: string
    if (isTestMode) {
      const DEV_APP_PORT = Deno.env.get('DEV_APP_PORT') || '8081'
      conversationLink = `http://localhost:${DEV_APP_PORT}/chat?work_order=${conversation.work_order_id}`
    } else if (APP_URL) {
      conversationLink = `${APP_URL}/chat?work_order=${conversation.work_order_id}`
    } else {
      conversationLink = `https://admin.asine.app/chat?work_order=${conversation.work_order_id}`
    }

    // Prepare email content
    const senderName = sender.name || 'Someone'
    const recipientName = recipient.name || 'there'
    const messagePreview = message_content.length > 100 
      ? message_content.substring(0, 100) + '...' 
      : message_content

    // Build email HTML
    const htmlBody = `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #0f766e; margin-bottom: 20px;">New Message from ${senderName}</h2>
          <p>Hi ${recipientName},</p>
          <p>You have received a new message regarding <strong>${workOrderTitle}</strong>.</p>
          <div style="background: #f5f5f5; border-left: 4px solid #0f766e; padding: 15px; margin: 20px 0; border-radius: 4px;">
            <p style="margin: 0; font-style: italic;">"${messagePreview}"</p>
          </div>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${conversationLink}" 
              style="background: #0f766e; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; display: inline-block; font-weight: bold;">
              View Message
            </a>
          </div>
          <p style="color: #666; font-size: 14px; margin-top: 30px;">
            This is an automated notification from Asine.
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="color: #999; font-size: 12px;">
            If the button doesn't work, copy and paste this link into your browser:<br>
            <a href="${conversationLink}" style="color: #0f766e; word-break: break-all;">${conversationLink}</a>
          </p>
        </body>
      </html>
    `
    
    const textBody = `New Message from ${senderName}

Hi ${recipientName},

You have received a new message regarding ${workOrderTitle}.

"${messagePreview}"

View the message: ${conversationLink}

This is an automated notification from Asine.`

    // Send via Mailgun
    const mailgunBaseUrl = MAILGUN_REGION === 'eu' 
      ? 'https://api.eu.mailgun.net/v3'
      : 'https://api.mailgun.net/v3'
    const mailgunUrl = `${mailgunBaseUrl}/${MAILGUN_DOMAIN}/messages`
    const authHeader = `Basic ${btoa(`api:${MAILGUN_API_KEY}`)}`
    
    const formData = new FormData()
    formData.append('from', `Asine <noreply@${MAILGUN_DOMAIN}>`)
    formData.append('to', recipient.email)
    formData.append('subject', `New message from ${senderName} - ${workOrderTitle}`)
    formData.append('html', htmlBody)
    formData.append('text', textBody)
    
    const mailgunResponse = await fetch(mailgunUrl, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
      },
      body: formData,
    })
    
    if (mailgunResponse.ok) {
      const mailgunResult = await mailgunResponse.json()
      console.log('✅ Message notification email sent successfully to:', recipient.email)
      console.log('Mailgun message ID:', mailgunResult.id)
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Notification sent successfully',
          recipient_email: recipient.email
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } else {
      const errorText = await mailgunResponse.text().catch(() => 'Unknown error')
      console.error('Failed to send notification email via Mailgun:', {
        status: mailgunResponse.status,
        error: errorText
      })
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Mailgun error: ${mailgunResponse.status} ${errorText}` 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
  } catch (error) {
    console.error('Error in notify-message function:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

