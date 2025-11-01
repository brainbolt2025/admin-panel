// Import Stripe SDK from esm.sh (v13)
import Stripe from 'https://esm.sh/stripe@13'
// Import Supabase client from esm.sh
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
// Import serve from Deno standard library
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

// CORS headers for cross-origin requests
// Note: Stripe webhooks don't use JWT authorization - they use stripe-signature header
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
}

// Main handler function
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Log all incoming request details for debugging
  console.log('Webhook request received:', {
    method: req.method,
    url: req.url,
    hasStripeSignature: !!req.headers.get('stripe-signature'),
    hasAuthorization: !!req.headers.get('authorization'),
    allHeaders: Object.fromEntries(req.headers.entries()),
  })

  try {
    // Get the Stripe signature from headers
    const signature = req.headers.get('stripe-signature')
    if (!signature) {
      console.error('Missing stripe-signature header')
      return new Response(
        JSON.stringify({ error: 'Missing stripe-signature header' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Get the raw request body as text (needed for signature verification)
    const body = await req.text()

    // Initialize Stripe client
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
      apiVersion: '2024-12-18.acacia',
      httpClient: Stripe.createFetchHttpClient(),
    })

    // Initialize Supabase Admin client for database operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Get webhook secret from environment variable
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
    if (!webhookSecret) {
      console.error('Missing STRIPE_WEBHOOK_SECRET')
      return new Response(
        JSON.stringify({ error: 'Webhook secret not configured' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Verify the webhook signature
    // Note: In Deno/Edge Functions, must use constructEventAsync (not constructEvent)
    // because SubtleCrypto is async-only
    let event: Stripe.Event
    try {
      console.log('Verifying webhook signature:', {
        hasSignature: !!signature,
        signatureLength: signature?.length,
        hasBody: !!body,
        bodyLength: body?.length,
        hasWebhookSecret: !!webhookSecret,
        webhookSecretPrefix: webhookSecret ? webhookSecret.substring(0, 10) + '...' : 'missing',
      })
      
      // Use constructEventAsync for Deno/Edge Functions (async crypto required)
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret)
      
      console.log('✅ Signature verification successful')
    } catch (err: any) {
      console.error('❌ Webhook signature verification failed:', {
        errorMessage: err?.message,
        errorType: err?.name,
        hasWebhookSecret: !!webhookSecret,
        webhookSecretPrefix: webhookSecret ? webhookSecret.substring(0, 10) + '...' : 'missing',
        signaturePrefix: signature ? signature.substring(0, 20) + '...' : 'missing',
        bodyLength: body?.length,
        fullError: err,
      })
      
      return new Response(
        JSON.stringify({ 
          error: 'Invalid signature',
          hint: 'Check that STRIPE_WEBHOOK_SECRET matches the signing secret from your Stripe webhook endpoint. Make sure you\'re using the correct secret for the correct Stripe mode (test vs live).'
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('Received Stripe event:', event.type)

    // Handle different event types
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        
        console.log('Processing checkout.session.completed for session:', session.id)
        console.log('Session details:', {
          id: session.id,
          customer: session.customer,
          customer_details: session.customer_details,
          metadata: session.metadata,
          payment_status: session.payment_status,
          mode: session.mode,
        })
        
        const user_id = session.metadata?.user_id
        const plan = session.metadata?.plan || session.metadata?.plan_type
        const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id

        console.log('Extracted data:', {
          user_id,
          plan,
          customerId,
          hasUserId: !!user_id,
          hasCustomerId: !!customerId,
        })

        if (!user_id || !customerId) {
          console.error('❌ Missing user_id or customer in session metadata', {
            user_id,
            customerId,
            metadata: session.metadata,
          })
          return new Response(
            JSON.stringify({ error: 'Missing required metadata' }),
            { 
              status: 400, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          )
        }

        // Update user record
        const { error: updateError } = await supabaseAdmin
          .from('users')
          .update({ 
            subscribed: true,
            stripe_customer_id: customerId,
            plan: plan,
            subscription_status: 'active'
          })
          .eq('id', user_id)

        if (updateError) {
          console.error('Error updating user:', updateError)
          return new Response(
            JSON.stringify({ error: 'Failed to update user' }),
            { 
              status: 500, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          )
        }

        // Optionally insert into subscriptions table
        if (session.subscription) {
          const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription.id
          
          await supabaseAdmin
            .from('subscriptions')
            .insert({
              user_id: user_id,
              stripe_customer_id: customerId,
              stripe_subscription_id: subscriptionId,
              plan: plan,
              status: 'active',
              start_date: new Date().toISOString()
            })
            .then(({ error }) => {
              if (error) console.error('Error inserting subscription record:', error)
            })
        }

        // Get user details for verification email
        // Get email from session customer_details or fetch from user record
        const userEmail = session.customer_details?.email || session.metadata?.email
        const userName = session.customer_details?.name || session.metadata?.name

        // Fetch user record to get complete details
        let userEmailFinal = userEmail
        let userNameFinal = userName

        if (!userEmailFinal || !userNameFinal) {
          const { data: userData, error: userFetchError } = await supabaseAdmin
            .from('users')
            .select('email, name')
            .eq('id', user_id)
            .single()

          if (!userFetchError && userData) {
            userEmailFinal = userEmailFinal || userData.email
            userNameFinal = userNameFinal || userData.name || 'Property Manager'
          }
        }

        // Generate verification token
        // Using crypto.randomUUID() for secure random token generation
        const verificationToken = crypto.randomUUID()

        // Store verification token in user record
        // This allows the verify-email function to validate the token
        // Note: Make sure your users table has verification_token and verification_token_expires_at columns
        console.log('Attempting to store verification token for user:', user_id)
        const { data: tokenUpdateData, error: tokenUpdateError } = await supabaseAdmin
          .from('users')
          .update({ 
            verification_token: verificationToken,
            verification_token_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
          })
          .eq('id', user_id)
          .select('id, verification_token')
        
        if (tokenUpdateError) {
          console.error('❌ Error storing verification token:', {
            error: tokenUpdateError,
            message: tokenUpdateError.message,
            code: tokenUpdateError.code,
            details: tokenUpdateError.details,
            hint: tokenUpdateError.hint,
            user_id,
            token: verificationToken.substring(0, 20) + '...',
          })
          
          // Check if it's a missing column error
          if (tokenUpdateError.code === '42703' || tokenUpdateError.message?.includes('column') || tokenUpdateError.message?.includes('does not exist')) {
            console.error('⚠️ DATABASE SCHEMA ERROR: verification_token column is missing!')
            console.error('🔧 FIX: Run this SQL in Supabase SQL Editor:')
            console.error('   ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token TEXT;')
            console.error('   ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false;')
            console.error('   ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token_expires_at TIMESTAMPTZ;')
          }
          // Don't fail the webhook if token storage fails - log it and continue
          // The email will still be sent, but verification won't work until columns are added
        } else {
          console.log('✅ Verification token stored successfully:', {
            user_id,
            token: verificationToken.substring(0, 20) + '...',
            updated_user: tokenUpdateData?.[0]?.id,
          })
        }

        // Send verification email via send-verification-email function
        console.log('Preparing to send verification email:', {
          hasEmail: !!userEmailFinal,
          hasName: !!userNameFinal,
          email: userEmailFinal,
          name: userNameFinal,
          token: verificationToken.substring(0, 20) + '...',
        })
        
        if (userEmailFinal && userNameFinal) {
          try {
            const functionsUrl = `${supabaseUrl}/functions/v1`
            const emailEndpoint = `${functionsUrl}/send-verification-email`
            
            console.log('Calling send-verification-email function:', {
              endpoint: emailEndpoint,
              email: userEmailFinal,
              name: userNameFinal,
            })
            
            const emailResponse = await fetch(emailEndpoint, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseServiceRoleKey}`,
                'apikey': supabaseServiceRoleKey,
              },
              body: JSON.stringify({
                email: userEmailFinal,
                name: userNameFinal,
                token: verificationToken,
                subject: 'Activate your Asine account',
              }),
            })

            console.log('Email function response:', {
              status: emailResponse.status,
              statusText: emailResponse.statusText,
              ok: emailResponse.ok,
            })

            const emailResult = await emailResponse.json()
            
            console.log('Email function result:', emailResult)
            
            if (emailResult.success) {
              console.log('✅ Verification email sent successfully to:', userEmailFinal)
              console.log('Email Mailgun ID:', emailResult.mailgun_id)
            } else {
              console.error('❌ Failed to send verification email:', {
                error: emailResult.error,
                fullResult: emailResult,
              })
              // Don't fail the webhook if email fails - log it and continue
            }
          } catch (emailError) {
            console.error('❌ Error calling send-verification-email function:', {
              message: emailError?.message,
              name: emailError?.name,
              stack: emailError?.stack,
              fullError: emailError,
            })
            // Don't fail the webhook if email fails - log it and continue
          }
        } else {
          console.error('❌ Could not send verification email: missing email or name', {
            email: userEmailFinal,
            name: userNameFinal,
            user_id,
            sessionEmail: session.customer_details?.email,
            sessionName: session.customer_details?.name,
            metadataEmail: session.metadata?.email,
            metadataName: session.metadata?.name,
          })
        }

        break
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice
        
        console.log('Processing invoice.paid for invoice:', invoice.id)

        // For invoice.paid, we might need to extract customer info
        const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id

        if (customerId) {
          // Find user by stripe_customer_id and update their subscription status
          const { error: updateError } = await supabaseAdmin
            .from('users')
            .update({ 
              subscribed: true,
              subscription_status: 'active'
            })
            .eq('stripe_customer_id', customerId)

          if (updateError) {
            console.error('Error updating user from invoice:', updateError)
          }
        }

        break
      }

      case 'customer.subscription.created': {
        const subscription = event.data.object as Stripe.Subscription
        
        console.log('Processing customer.subscription.created for subscription:', subscription.id)

        // Extract metadata from subscription object
        const user_id = subscription.metadata?.user_id
        const plan = subscription.metadata?.plan || subscription.items.data[0]?.price.nickname
        const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id

        if (user_id && customerId) {
          const { error: updateError } = await supabaseAdmin
            .from('users')
            .update({ 
              subscribed: true,
              stripe_customer_id: customerId,
              plan: plan,
              subscription_status: 'active'
            })
            .eq('id', user_id)

          if (updateError) {
            console.error('Error updating user from subscription:', updateError)
          }
        }

        break
      }

      default:
        console.log('Unhandled event type:', event.type)
        return new Response(
          JSON.stringify({ message: 'Event received but not processed' }),
          { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
    }

    // Return success response
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Subscription activated',
        event: event.type
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error processing webhook:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

/* 
DEPLOYMENT INSTRUCTIONS:
=======================
1. Set environment variables in Supabase Dashboard:
   - STRIPE_SECRET_KEY (same as other functions)
   - STRIPE_WEBHOOK_SECRET (webhook signing secret from Stripe)
   - MAILGUN_DOMAIN (for verification emails)
   - MAILGUN_API_KEY (for verification emails)
   - BASE_URL (optional - for verification links. Auto-detected from Stripe mode if not set)
     * Test mode (sk_test_): defaults to http://localhost:5173
     * Live mode (sk_live_): defaults to https://admin.asine.app
     * Override by setting BASE_URL secret (e.g., http://localhost:3000 for custom port)

2. Deploy the function WITHOUT JWT verification:
   supabase functions deploy stripe-webhook --no-verify-jwt
   
   IMPORTANT: Use --no-verify-jwt because Stripe webhooks don't use JWT.
   Security is handled via Stripe signature verification instead.

3. Copy the function URL:
   https://YOUR_PROJECT.supabase.co/functions/v1/stripe-webhook

4. Add webhook endpoint in Stripe Dashboard:
   - Go to Developers → Webhooks
   - Click "Add endpoint"
   - Paste your function URL
   - Select events: checkout.session.completed, invoice.paid, customer.subscription.created
   - Copy the "Signing secret" (whsec_xxx)
   - Add it to Supabase Secrets as STRIPE_WEBHOOK_SECRET

5. Test the webhook:
   stripe trigger checkout.session.completed
   stripe trigger invoice.paid
   stripe trigger customer.subscription.created

DATABASE SCHEMA:
================
Make sure your users table has these columns:
- subscribed (BOOLEAN)
- stripe_customer_id (TEXT)
- plan (TEXT)
- subscription_status (TEXT)

Optional: Add verification token columns for email verification:
- verification_token (TEXT)
- verification_token_expires_at (TIMESTAMPTZ)
- email_verified (BOOLEAN)

Optional: Create a subscriptions table for tracking subscription history:
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT UNIQUE,
  plan TEXT,
  status TEXT,
  start_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

EMAIL VERIFICATION FLOW:
========================
After a successful checkout.session.completed event:
1. User subscription is activated in the database
2. Verification token is generated (using crypto.randomUUID())
3. Verification email is automatically sent via send-verification-email function
4. Email contains a link: ${BASE_URL}/verify?token=${token}
   - BASE_URL is dynamically determined:
     * If BASE_URL secret is set: uses that value
     * If in Stripe test mode (sk_test_): uses http://localhost:5173
     * If in Stripe live mode (sk_live_): uses https://admin.asine.app
5. User clicks link to verify their email address

Note: If you want to store verification tokens in the database, uncomment the 
code block that updates the users table with verification_token and 
verification_token_expires_at (around line 230).

SWITCHING TO LIVE MODE:
=======================
1. Update STRIPE_SECRET_KEY in Supabase Secrets: sk_test_... → sk_live_...
2. Create a new webhook endpoint in Stripe (Live mode)
3. Update STRIPE_WEBHOOK_SECRET with the new webhook signing secret
4. Update BASE_URL to production URL: https://admin.asine.app
5. Redeploy the function with production settings

SAFETY:
=======
- Always verify the webhook signature (already implemented)
- Never expose your webhook secret
- Test in test mode before switching to live
- Monitor webhook events in Stripe Dashboard
- Email sending failures don't fail the webhook (logged only)
*/
