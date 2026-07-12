import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
          <title>Thank You - Asine Waitlist</title>
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
            <p>You've been successfully added to the Asine waitlist. We'll be in touch soon!</p>
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
          error: 'Email already registered on waitlist',
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
          error: 'Failed to add to waitlist',
          details: insertError.message 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!waitlistEntry) {
      console.error('Waitlist entry created but data is null')
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to create waitlist entry' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Waitlist entry created:', waitlistEntry.id)

    // Send confirmation email via Mailgun
    const MAILGUN_DOMAIN = Deno.env.get('MAILGUN_DOMAIN') || ''
    const MAILGUN_API_KEY = Deno.env.get('MAILGUN_API_KEY') || ''
    const MAILGUN_REGION = Deno.env.get('MAILGUN_REGION') || 'us'

    if (MAILGUN_DOMAIN && MAILGUN_API_KEY) {
      try {
        const mailgunBaseUrl = MAILGUN_REGION === 'eu' 
          ? 'https://api.eu.mailgun.net/v3'
          : 'https://api.mailgun.net/v3'
        const mailgunUrl = `${mailgunBaseUrl}/${MAILGUN_DOMAIN}/messages`
        const authHeader = `Basic ${btoa(`api:${MAILGUN_API_KEY}`)}`

        const formData = new FormData()
        formData.append('from', `Asine <noreply@${MAILGUN_DOMAIN}>`)
        formData.append('to', email)
        formData.append('subject', 'Thank you for joining the Asine waitlist!')

        const htmlBody = `
          <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #0f766e; margin-bottom: 20px;">Thank You for Joining the Asine Waitlist!</h2>
              <p>Hello,</p>
              <p>Thank you for signing up for the Asine Property Management waitlist! We're excited to have <strong>${property_name}</strong> join our community.</p>
              <p>We've received your interest and have added you to our waitlist. We'll keep you updated as we move forward.</p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
              <p style="color: #999; font-size: 12px;">
                Best regards,<br>
                The Asine Team
              </p>
            </body>
          </html>
        `

        const textBody = `Thank You for Joining the Asine Waitlist!

Hello,

Thank you for signing up for the Asine Property Management waitlist! We're excited to have ${property_name} join our community.

We've received your interest and have added you to our waitlist. We'll keep you updated as we move forward.

Best regards,
The Asine Team`

        formData.append('html', htmlBody)
        formData.append('text', textBody)

        const mailgunResponse = await fetch(mailgunUrl, {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
          },
          body: formData,
        })

        if (mailgunResponse.ok) {
          try {
            const mailgunResult = await mailgunResponse.json()
            console.log('Confirmation email sent:', mailgunResult.id || mailgunResult.message || 'Success')
            
            // Update notified_at timestamp (don't fail if this fails)
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
              // Continue anyway - email was sent successfully
            }
          } catch (jsonError) {
            // Mailgun returned OK but response wasn't valid JSON - log and continue
            console.warn('Mailgun response OK but not JSON, email likely sent:', jsonError)
            // Still try to update notified_at since email was sent
            try {
              await supabaseAdmin
                .from('pm_waitlist')
                .update({ notified_at: new Date().toISOString() })
                .eq('id', waitlistEntry.id)
            } catch (updateErr) {
              console.error('Error updating notified_at after email:', updateErr)
            }
          }
        } else {
          const errorText = await mailgunResponse.text().catch(() => 'Unknown error')
          console.error('Failed to send confirmation email:', {
            status: mailgunResponse.status,
            error: errorText
          })
          // Don't fail the request if email fails
        }
      } catch (emailError) {
        console.error('Error sending confirmation email:', emailError)
        // Don't fail the request if email fails
      }
    } else {
      console.warn('Mailgun not configured, skipping confirmation email')
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Successfully added to waitlist',
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

