import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { asineEmailHtml } from '../_shared/asineEmailLayout.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

interface WaitlistRequest {
  email: string
  property_name: string
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

async function sendMailgunMessage(opts: {
  mailgunUrl: string
  authHeader: string
  from: string
  to: string
  subject: string
  html: string
  text: string
  replyTo?: string
}): Promise<boolean> {
  const formData = new FormData()
  formData.append('from', opts.from)
  formData.append('to', opts.to)
  formData.append('subject', opts.subject)
  formData.append('html', opts.html)
  formData.append('text', opts.text)
  if (opts.replyTo) formData.append('h:Reply-To', opts.replyTo)

  const mailgunResponse = await fetch(opts.mailgunUrl, {
    method: 'POST',
    headers: { Authorization: opts.authHeader },
    body: formData,
  })

  if (!mailgunResponse.ok) {
    const errorText = await mailgunResponse.text().catch(() => 'Unknown error')
    console.error('Mailgun error:', {
      to: opts.to,
      status: mailgunResponse.status,
      error: errorText,
    })
    return false
  }

  return true
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Handle GET requests (for redirects after successful form submission)
  if (req.method === 'GET') {
    // Return a simple HTML success page for redirects from Carrd
    const successHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Thank You - Asine</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #0f766e 0%, #14b8a6 100%);
              color: #fff;
            }
            .container {
              text-align: center;
              padding: 3rem;
              max-width: 500px;
            }
            h1 {
              font-size: 2.5rem;
              margin-bottom: 1rem;
            }
            p {
              font-size: 1.2rem;
              line-height: 1.6;
              opacity: 0.9;
            }
            .checkmark {
              font-size: 4rem;
              margin-bottom: 1rem;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="checkmark">✓</div>
            <h1>Thank You!</h1>
            <p>We've received your message and will follow up shortly.</p>
            <p style="margin-top: 2rem; font-size: 1rem; opacity: 0.7;">Check your email for a confirmation message.</p>
          </div>
        </body>
      </html>
    `
    return new Response(successHtml, {
      status: 200,
      headers: { 
        'Content-Type': 'text/html; charset=utf-8',
        ...corsHeaders
      }
    })
  }

  // Only allow POST requests for actual submissions
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed. Use POST.' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  try {
    // Log incoming request for debugging
    console.log('=== Add to Waitlist Request ===')
    console.log('Method:', req.method)
    console.log('URL:', req.url)
    console.log('Content-Type:', req.headers.get('content-type'))
    
    // Get Supabase client with service role (no auth required for public webhook)
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    
    if (!supabaseServiceKey) {
      console.error('SUPABASE_SERVICE_ROLE_KEY not configured')
      return new Response(
        JSON.stringify({ success: false, error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // Parse request body (simplified - just like other functions)
    let body: WaitlistRequest
    try {
      // Read body as text first so we can log it if parsing fails
      const rawBody = await req.text()
      console.log('Raw request body:', rawBody)
      
      if (!rawBody || rawBody.trim().length === 0) {
        return new Response(
          JSON.stringify({ success: false, error: 'Request body is empty' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      // Parse JSON from the text
      try {
        body = JSON.parse(rawBody)
        console.log('Parsed request body:', body)
      } catch (parseError) {
        console.error('JSON parse error:', parseError)
        console.error('Raw body that failed to parse:', rawBody)
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Invalid JSON format',
            details: parseError instanceof Error ? parseError.message : 'Unknown error'
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    } catch (error) {
      console.error('Error reading request body:', error)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Invalid request body - could not read request',
          details: error instanceof Error ? error.message : 'Unknown error'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { email, property_name } = body

    // Validate email
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Valid email is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate property_name
    if (!property_name || property_name.trim().length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Property name is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if email already exists in waitlist
    const { data: existing, error: checkError } = await supabaseAdmin
      .from('pm_waitlist')
      .select('id, email')
      .eq('email', email.toLowerCase())
      .maybeSingle() // Use maybeSingle() instead of single() to avoid errors when no row found

    if (checkError) {
      console.error('Error checking existing email:', checkError)
      return new Response(
        JSON.stringify({ success: false, error: 'Database error checking email' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (existing) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'We have already received a message from this email. We will follow up shortly.',
          id: existing.id
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Insert into waitlist (status has a default value of 'pending' in the database)
    const { data: waitlistEntry, error: insertError } = await supabaseAdmin
      .from('pm_waitlist')
      .insert({
        email: email.toLowerCase(),
        property_name: property_name.trim()
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error inserting into waitlist:', insertError)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Unable to send your message. Please try again.',
          details: insertError.message 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!waitlistEntry) {
      console.error('Waitlist entry created but data is null')
      return new Response(
        JSON.stringify({ success: false, error: 'Unable to send your message. Please try again.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Waitlist entry created:', waitlistEntry.id)

    // Send confirmation email via Mailgun
    const MAILGUN_DOMAIN = Deno.env.get('MAILGUN_DOMAIN') || ''
    const MAILGUN_API_KEY = Deno.env.get('MAILGUN_API_KEY') || ''
    const MAILGUN_REGION = Deno.env.get('MAILGUN_REGION') || 'us'

    if (MAILGUN_DOMAIN && MAILGUN_API_KEY) {
      const mailgunBaseUrl = MAILGUN_REGION === 'eu'
        ? 'https://api.eu.mailgun.net/v3'
        : 'https://api.mailgun.net/v3'
      const mailgunUrl = `${mailgunBaseUrl}/${MAILGUN_DOMAIN}/messages`
      const authHeader = `Basic ${btoa(`api:${MAILGUN_API_KEY}`)}`
      const fromAddress = `Asine <noreply@${MAILGUN_DOMAIN}>`
      const leadInbox = `jp@${MAILGUN_DOMAIN}`
      const safePropertyName = escapeHtml(property_name.trim())
      const safeEmail = escapeHtml(email.toLowerCase())

      try {
        const confirmationSent = await sendMailgunMessage({
          mailgunUrl,
          authHeader,
          from: fromAddress,
          to: email,
          subject: 'Thanks for reaching out to Asine',
          html: asineEmailHtml({
            title: 'Thanks for reaching out',
            greeting: 'Hello,',
            paragraphs: [
              `We received your message about <strong>${safePropertyName}</strong>.`,
              "We'll follow up shortly. If you'd like to get started right away, you can also activate a plan on sycnmore.com.",
            ],
          }),
          text: `Thanks for reaching out

Hello,

We received your message about ${property_name}.

We'll follow up shortly. If you'd like to get started right away, you can also activate a plan on sycnmore.com.

Best regards,
The Asine Team`,
        })

        if (confirmationSent) {
          console.log('Confirmation email sent to', email)
          try {
            const { error: updateError } = await supabaseAdmin
              .from('pm_waitlist')
              .update({ notified_at: new Date().toISOString() })
              .eq('id', waitlistEntry.id)

            if (updateError) {
              console.error('Error updating notified_at:', updateError)
            }
          } catch (updateErr) {
            console.error('Exception updating notified_at:', updateErr)
          }
        }
      } catch (emailError) {
        console.error('Error sending confirmation email:', emailError)
      }

      try {
        const leadSent = await sendMailgunMessage({
          mailgunUrl,
          authHeader,
          from: fromAddress,
          to: leadInbox,
          subject: `New landing page inquiry from ${property_name.trim()}`,
          replyTo: email.toLowerCase(),
          html: asineEmailHtml({
            title: 'New landing page inquiry',
            greeting: 'Hi JP,',
            paragraphs: [
              'Someone submitted the Contact us form on sycnmore.com.',
            ],
            extraHtml: `<div style="background:#f3f4f6;padding:16px;border-radius:8px;margin:8px 0 20px 0;">
              <p style="margin:0 0 8px 0;"><strong>Email:</strong> ${safeEmail}</p>
              <p style="margin:0;"><strong>Property / company:</strong> ${safePropertyName}</p>
            </div>`,
            signOff: 'Reply to this email to reach them directly.',
          }),
          text: `New landing page inquiry

Hi JP,

Someone submitted the Contact us form on sycnmore.com.

Email: ${email.toLowerCase()}
Property / company: ${property_name.trim()}

Reply to this email to reach them directly.`,
        })

        if (leadSent) {
          console.log('Lead notification sent to', leadInbox)
        }
      } catch (leadError) {
        console.error('Error sending lead notification:', leadError)
      }
    } else {
      console.warn('Mailgun not configured, skipping confirmation and lead emails')
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Message received',
        id: waitlistEntry.id
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in add-to-waitlist function:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

