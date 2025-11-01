// Import serve from Deno standard library
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

// CORS headers for cross-origin requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// TypeScript interface for the request body
interface SendVerificationEmailRequest {
  email: string
  name: string
  token: string
  subject: string
}

// Main handler function
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Parse the request body
    const body: SendVerificationEmailRequest = await req.json()
    const { email, name, token, subject } = body

    // Validate required fields
    if (!email || !name || !token || !subject) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required fields. Required: email, name, token, subject',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid email format',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Load environment variables
    // TO CONFIGURE MAILGUN: Set these in your Supabase project secrets
    // Replace MAILGUN_API_KEY with your actual Mailgun API key (format: key-xxxxxxxxxxxxxxxxxxxxx)
    // Replace MAILGUN_DOMAIN with your verified Mailgun domain (e.g., mg.asine.app)
    // Optional: MAILGUN_REGION can be 'us' or 'eu' (default: 'us')
    const MAILGUN_DOMAIN = Deno.env.get('MAILGUN_DOMAIN') || 'mg.asine.app'
    const MAILGUN_API_KEY = Deno.env.get('MAILGUN_API_KEY') || ''
    const MAILGUN_REGION = Deno.env.get('MAILGUN_REGION') || 'us' // 'us' or 'eu'
    
    // Determine BASE_URL dynamically based on environment
    // Priority: 1. BASE_URL secret, 2. Auto-detect from Stripe mode, 3. Default
    let BASE_URL = Deno.env.get('BASE_URL')
    
    if (!BASE_URL) {
      // Auto-detect environment from Stripe secret key
      const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY') || ''
      const isTestMode = stripeSecretKey.startsWith('sk_test_')
      
      if (isTestMode) {
        // Test/Development mode - use localhost
        BASE_URL = 'http://localhost:5173'
        console.log('Auto-detected test mode: Using localhost for BASE_URL')
      } else {
        // Live/Production mode - use production domain
        BASE_URL = 'https://admin.asine.app'
        console.log('Auto-detected live mode: Using production domain for BASE_URL')
      }
    } else {
      console.log('Using BASE_URL from environment:', BASE_URL)
    }

    // Validate Mailgun configuration
    if (!MAILGUN_API_KEY) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Mailgun API key not configured. Please set MAILGUN_API_KEY in Supabase secrets.',
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Validate API key format
    // Mailgun has different API key formats depending on account type or region
    // We'll be flexible and accept any key format, but warn if it's clearly a public key
    if (MAILGUN_API_KEY.startsWith('pubkey-')) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'You are using a Public API key (pubkey-). For sending emails, you need a Private API key. Please go to Mailgun Dashboard → Settings → API Keys → Private API key and use that key instead.',
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }
    
    // Log key format for debugging (only first few chars for security)
    const keyPrefix = MAILGUN_API_KEY.substring(0, Math.min(10, MAILGUN_API_KEY.length))
    console.log('API Key format detected:', keyPrefix + '...')
    
    // Note: Mailgun keys typically start with "key-" but some accounts may have different formats
    // We'll proceed with whatever key is provided and let Mailgun API validate it

    console.log('Mailgun Configuration:', {
      domain: MAILGUN_DOMAIN,
      region: MAILGUN_REGION,
      apiKeyPrefix: MAILGUN_API_KEY.substring(0, 7) + '...',
      baseUrl: BASE_URL,
    })

    // Build the verification link
    // This link will be used by the Property Manager to verify their account
    const verifyLink = `${BASE_URL}/verify?token=${token}`

    // Construct the HTML email body
    // The email includes a styled button and clear instructions for verification
    const htmlBody = `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #0f766e; margin-bottom: 20px;">Welcome to Asine</h2>
          <p>Hi ${name},</p>
          <p>Please verify your email to activate your Property Manager account.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verifyLink}" 
               style="background: #0f766e; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; display: inline-block; font-weight: bold;">
              Verify Account
            </a>
          </div>
          <p style="color: #666; font-size: 14px; margin-top: 30px;">
            <strong>Important:</strong> This verification link expires in 24 hours.
          </p>
          <p style="color: #666; font-size: 14px;">
            If you didn't create an account, please ignore this email.
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="color: #999; font-size: 12px;">
            If the button doesn't work, copy and paste this link into your browser:<br>
            <a href="${verifyLink}" style="color: #0f766e; word-break: break-all;">${verifyLink}</a>
          </p>
        </body>
      </html>
    `

    // Prepare form data for Mailgun API
    // Mailgun requires form-data format for sending emails
    const formData = new FormData()
    // Use the verified domain for the "from" email address
    // Note: For sandbox domains (like sandbox-xxx.mailgun.org), you can only send to authorized recipients
    // For custom domains like my.inactivegroup.com, you can send to any email address
    formData.append('from', `Asine Admin <noreply@${MAILGUN_DOMAIN}>`)
    formData.append('to', email)
    formData.append('subject', subject)
    formData.append('html', htmlBody)
    // Optional: Add plain text version for email clients that don't support HTML
    formData.append(
      'text',
      `Welcome to Asine\n\nHi ${name},\n\nPlease verify your email to activate your Property Manager account.\n\nVerification Link: ${verifyLink}\n\nThis link expires in 24 hours.\n\nIf you didn't create an account, please ignore this email.`
    )

    // Send email using Mailgun REST API
    // The API endpoint varies by region:
    // US: https://api.mailgun.net/v3/{domain}/messages
    // EU: https://api.eu.mailgun.net/v3/{domain}/messages
    // Authentication uses HTTP Basic Auth with "api" as username and API key as password
    const mailgunBaseUrl = MAILGUN_REGION === 'eu' 
      ? 'https://api.eu.mailgun.net/v3'
      : 'https://api.mailgun.net/v3'
    const mailgunUrl = `${mailgunBaseUrl}/${MAILGUN_DOMAIN}/messages`
    const authHeader = `Basic ${btoa(`api:${MAILGUN_API_KEY}`)}`

    console.log('Mailgun Request Details:', {
      url: mailgunUrl,
      domain: MAILGUN_DOMAIN,
      region: MAILGUN_REGION,
      fromEmail: `noreply@${MAILGUN_DOMAIN}`,
    })

    console.log('Sending email via Mailgun to:', email)
    console.log('Mailgun domain:', MAILGUN_DOMAIN)
    console.log('Verification link:', verifyLink)

    // Make the API request to Mailgun
    console.log('Making Mailgun API request...', {
      url: mailgunUrl,
      method: 'POST',
      hasAuthHeader: !!authHeader,
      authHeaderPrefix: authHeader.substring(0, 20) + '...',
      formDataKeys: ['from', 'to', 'subject', 'html', 'text'],
    })

    const mailgunResponse = await fetch(mailgunUrl, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
      },
      body: formData,
    })

    console.log('Mailgun response received:', {
      status: mailgunResponse.status,
      statusText: mailgunResponse.statusText,
      ok: mailgunResponse.ok,
      contentType: mailgunResponse.headers.get('content-type'),
    })

    // Parse Mailgun response (handle both JSON and plain text errors)
    let mailgunResult: any = {}
    let mailgunErrorText = ''
    
    try {
      const contentType = mailgunResponse.headers.get('content-type') || ''
      if (contentType.includes('application/json')) {
        mailgunResult = await mailgunResponse.json()
      } else {
        // If response is not JSON (e.g., plain text "Forbidden"), get as text
        mailgunErrorText = await mailgunResponse.text()
        console.error('Mailgun returned non-JSON response:', mailgunErrorText)
      }
    } catch (parseError) {
      // If JSON parsing fails, try to get as text
      try {
        mailgunErrorText = await mailgunResponse.text()
        console.error('Failed to parse Mailgun response as JSON:', mailgunErrorText)
      } catch (textError) {
        console.error('Failed to read Mailgun response:', textError)
      }
    }

    // Handle Mailgun API errors
    // Mailgun returns 200 status on success, but may include error messages in the response
    if (!mailgunResponse.ok) {
      let errorMessage = mailgunErrorText || 
                         mailgunResult.message || 
                         mailgunResult.error || 
                         `Mailgun API error: ${mailgunResponse.status} ${mailgunResponse.statusText}`
      
      // Provide more helpful error messages for common issues
      if (mailgunResponse.status === 401 || mailgunResponse.status === 403) {
        errorMessage = `Mailgun authentication failed (${mailgunResponse.status} Forbidden).

Troubleshooting steps:
1. Verify MAILGUN_API_KEY is correct - copy the full key from Mailgun Dashboard → Settings → API Keys
2. Ensure you're using the PRIVATE API key (not the Public/Validation key)
3. Verify MAILGUN_DOMAIN matches exactly what's shown in Mailgun Dashboard → Sending → Domains
4. Ensure domain status is "Active" and "Verified" in Mailgun Dashboard
5. Check if your Mailgun account is EU region - if so, set MAILGUN_REGION=eu in Supabase secrets
6. Verify the API key has "Send" or appropriate permissions for your domain

Current configuration:
- Domain: ${MAILGUN_DOMAIN}
- Region: ${MAILGUN_REGION}
- API Key format: ${MAILGUN_API_KEY.substring(0, Math.min(15, MAILGUN_API_KEY.length))}...
- Endpoint: ${mailgunUrl}

Mailgun error response: ${mailgunErrorText || mailgunResult.message || mailgunResponse.statusText || 'Forbidden'}`
      }
      
      console.error('Mailgun API error details:', {
        status: mailgunResponse.status,
        statusText: mailgunResponse.statusText,
        url: mailgunUrl,
        domain: MAILGUN_DOMAIN,
        region: MAILGUN_REGION,
        apiKeyPrefix: MAILGUN_API_KEY.substring(0, 7) + '...',
        responseBody: mailgunResult,
        responseText: mailgunErrorText,
      })
      
      return new Response(
        JSON.stringify({
          success: false,
          error: errorMessage,
        }),
        {
          status: mailgunResponse.status || 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Check for errors in successful response (Mailgun sometimes returns 200 with error field)
    if (mailgunResult.error) {
      console.error('Mailgun returned error in response:', mailgunResult)
      return new Response(
        JSON.stringify({
          success: false,
          error: mailgunResult.message || mailgunResult.error || 'Failed to send email via Mailgun',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Success response
    // Mailgun typically returns: { id: "<...>", message: "Queued. Thank you." }
    console.log('Email sent successfully via Mailgun:', mailgunResult.id || mailgunResult.message)
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Email sent successfully',
        mailgun_id: mailgunResult.id,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error sending verification email:', error)

    // Handle parsing errors, network errors, etc.
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})

/*
DEPLOYMENT INSTRUCTIONS:
========================
1. Set Mailgun configuration in Supabase secrets:
   supabase secrets set MAILGUN_DOMAIN=mg.asine.app
   supabase secrets set MAILGUN_API_KEY=key-xxxxxxxxxxxxxxxxxxxxx
   supabase secrets set BASE_URL=http://localhost:5173  # Optional - auto-detected if not set
   
   BASE_URL is automatically determined:
   - If BASE_URL secret is set: uses that value
   - If STRIPE_SECRET_KEY starts with sk_test_: uses http://localhost:5173 (test/dev)
   - If STRIPE_SECRET_KEY starts with sk_live_: uses https://admin.asine.app (production)
   - You can override by setting BASE_URL secret (e.g., http://localhost:3000)

2. Deploy the function:
   supabase functions deploy send-verification-email

3. How to call this function from the frontend after a new PM is registered:
   
   // After successful Stripe registration/subscription creation
   const response = await fetch(
     'https://YOUR_PROJECT.supabase.co/functions/v1/send-verification-email',
     {
       method: 'POST',
       headers: {
         'Content-Type': 'application/json',
         'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
       },
       body: JSON.stringify({
         email: 'pm@example.com',
         name: 'John Doe',
         token: 'random-verification-token', // Generate this token when creating the user
         subject: 'Activate your Asine account',
       }),
     }
   )
   
   const result = await response.json()
   if (result.success) {
     console.log('Verification email sent:', result.message)
   } else {
     console.error('Failed to send email:', result.error)
   }

WORKFLOW:
=========
1. Property Manager completes Stripe registration
2. Create user record in Supabase (via create-user function or directly)
3. Generate a unique verification token (store it in the user record)
4. Call this function with the PM's email, name, token, and subject
5. PM receives email and clicks verification link
6. Frontend handles /verify route and validates token
7. Mark user as verified in database

EXAMPLE MAILGUN RESPONSE:
==========================
Success response (200 OK):
{
  "id": "<20231201234567.abc123@mg.asine.app>",
  "message": "Queued. Thank you."
}

Error response (e.g., 401 Unauthorized):
{
  "message": "Forbidden"
}

Error response (e.g., 400 Bad Request):
{
  "message": "Need at least one of \"to\", \"cc\", \"bcc\" fields"
}

INTEGRATION WITH STRIPE WEBHOOK:
================================
You can call this function from your stripe-webhook function after a successful 
subscription creation:

// In stripe-webhook/index.ts
if (event.type === 'checkout.session.completed') {
  const session = event.data.object
  // ... create user logic ...
  
  // Send verification email
  await fetch('https://YOUR_PROJECT.supabase.co/functions/v1/send-verification-email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({
      email: session.customer_details.email,
      name: session.customer_details.name || 'Property Manager',
      token: verificationToken, // Generate unique token
      subject: 'Activate your Asine account',
    }),
  })
}

ENVIRONMENT VARIABLES:
=====================
- MAILGUN_DOMAIN: Your verified Mailgun domain (e.g., mg.asine.app)
- MAILGUN_API_KEY: Your Mailgun API key (starts with "key-")
- BASE_URL: Base URL for verification links (e.g., https://admin.asine.app)

SECURITY NOTES:
==============
- Always generate unique, unpredictable verification tokens
- Store tokens with expiration times (24 hours)
- Verify tokens server-side before marking accounts as verified
- Use HTTPS for verification links
- Consider rate limiting to prevent abuse

TESTING:
========
Test the function locally with:
deno run --allow-net --allow-env supabase/functions/send-verification-email/index.ts

Or test via Supabase CLI:
supabase functions serve send-verification-email --env-file .env.local

Example request body for testing:
{
  "email": "test@example.com",
  "name": "Test User",
  "token": "test-verification-token-123",
  "subject": "Test Verification Email"
}
*/

