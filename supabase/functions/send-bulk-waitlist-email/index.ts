import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { asineEmailHtml } from '../_shared/asineEmailLayout.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

interface BulkEmailRequest {
  subject: string
  message: string
  status_filter?: 'pending' | 'contacted' | 'approved' | 'declined' | 'all'
}

interface EmailResult {
  email: string
  property_name: string
  success: boolean
  error?: string
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed. Use POST.' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  try {
    // Get authenticated user from request
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase client with anon key for user auth
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseClient = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    // Get the user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()

    if (userError || !user) {
      console.error('Authentication error:', userError)
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('User authenticated:', user.email)

    // Check if user is super_admin
    const supabaseAdmin = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: userData, error: roleError } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (roleError || !userData || userData.role !== 'super_admin') {
      console.error('Role check error:', roleError)
      return new Response(
        JSON.stringify({ success: false, error: 'Super admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    let body: BulkEmailRequest
    try {
      body = await req.json()
    } catch (error) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid JSON in request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { subject, message, status_filter = 'all' } = body

    // Validate required fields
    if (!subject || !subject.trim()) {
      return new Response(
        JSON.stringify({ success: false, error: 'Subject is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!message || !message.trim()) {
      return new Response(
        JSON.stringify({ success: false, error: 'Message is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch waitlist entries
    let query = supabaseAdmin
      .from('pm_waitlist')
      .select('id, email, property_name')

    if (status_filter !== 'all') {
      query = query.eq('status', status_filter)
    }

    const { data: waitlistEntries, error: fetchError } = await query

    if (fetchError) {
      console.error('Error fetching waitlist:', fetchError)
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to fetch waitlist entries' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!waitlistEntries || waitlistEntries.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No waitlist entries found to send emails to',
          total: 0,
          sent: 0,
          failed: 0,
          results: []
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Sending bulk email to ${waitlistEntries.length} waitlist entries`)

    // Mailgun configuration
    const MAILGUN_DOMAIN = Deno.env.get('MAILGUN_DOMAIN') || ''
    const MAILGUN_API_KEY = Deno.env.get('MAILGUN_API_KEY') || ''
    const MAILGUN_REGION = Deno.env.get('MAILGUN_REGION') || 'us'

    if (!MAILGUN_DOMAIN || !MAILGUN_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: 'Mailgun not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const mailgunBaseUrl = MAILGUN_REGION === 'eu' 
      ? 'https://api.eu.mailgun.net/v3'
      : 'https://api.mailgun.net/v3'
    const mailgunUrl = `${mailgunBaseUrl}/${MAILGUN_DOMAIN}/messages`
    const authHeaderMailgun = `Basic ${btoa(`api:${MAILGUN_API_KEY}`)}`

    // Convert message to HTML (simple conversion - preserve line breaks)
    const htmlMessage = message
      .split('\n')
      .map(line => `<p>${line || '&nbsp;'}</p>`)
      .join('')

    // Send emails to all waitlist entries
    const results: EmailResult[] = []
    let sentCount = 0
    let failedCount = 0

    for (const entry of waitlistEntries) {
      try {
        const formData = new FormData()
        formData.append('from', `Asine <noreply@${MAILGUN_DOMAIN}>`)
        formData.append('to', entry.email)
        formData.append('subject', subject)

        const htmlBody = asineEmailHtml({
          title: subject,
          extraHtml: htmlMessage,
        })

        formData.append('html', htmlBody)
        formData.append('text', message)

        const mailgunResponse = await fetch(mailgunUrl, {
          method: 'POST',
          headers: {
            'Authorization': authHeaderMailgun,
          },
          body: formData,
        })

        if (mailgunResponse.ok) {
          // Update notified_at timestamp
          try {
            await supabaseAdmin
              .from('pm_waitlist')
              .update({ notified_at: new Date().toISOString() })
              .eq('id', entry.id)
          } catch (updateErr) {
            console.error(`Error updating notified_at for ${entry.email}:`, updateErr)
          }

          results.push({
            email: entry.email,
            property_name: entry.property_name,
            success: true
          })
          sentCount++
          console.log(`Email sent successfully to ${entry.email}`)
        } else {
          const errorText = await mailgunResponse.text().catch(() => 'Unknown error')
          console.error(`Failed to send email to ${entry.email}:`, errorText)
          results.push({
            email: entry.email,
            property_name: entry.property_name,
            success: false,
            error: `HTTP ${mailgunResponse.status}: ${errorText.substring(0, 100)}`
          })
          failedCount++
        }
      } catch (emailError) {
        console.error(`Error sending email to ${entry.email}:`, emailError)
        results.push({
          email: entry.email,
          property_name: entry.property_name,
          success: false,
          error: emailError instanceof Error ? emailError.message : 'Unknown error'
        })
        failedCount++
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Bulk email completed: ${sentCount} sent, ${failedCount} failed`,
        total: waitlistEntries.length,
        sent: sentCount,
        failed: failedCount,
        results: results
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in send-bulk-waitlist-email function:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

