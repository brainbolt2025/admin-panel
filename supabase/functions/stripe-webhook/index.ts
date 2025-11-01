// Import Stripe SDK from esm.sh (v13)
import Stripe from 'https://esm.sh/stripe@13'
// Import Supabase client from esm.sh
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
// Import serve from Deno standard library
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

// CORS headers for cross-origin requests
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
    let event: Stripe.Event
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
    } catch (err) {
      console.error('Webhook signature verification failed:', err)
      return new Response(
        JSON.stringify({ error: 'Invalid signature' }),
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
        
        const user_id = session.metadata?.user_id
        const plan = session.metadata?.plan || session.metadata?.plan_type
        const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id

        if (!user_id || !customerId) {
          console.error('Missing user_id or customer in session metadata')
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

        // Store verification token in user record (optional: if you have a verification_token column)
        // If your users table has a verification_token column, uncomment this:
        /*
        await supabaseAdmin
          .from('users')
          .update({ 
            verification_token: verificationToken,
            verification_token_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
          })
          .eq('id', user_id)
        */

        // Send verification email via send-verification-email function
        if (userEmailFinal && userNameFinal) {
          try {
            const functionsUrl = `${supabaseUrl}/functions/v1`
            const emailResponse = await fetch(`${functionsUrl}/send-verification-email`, {
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

            const emailResult = await emailResponse.json()
            
            if (emailResult.success) {
              console.log('Verification email sent successfully to:', userEmailFinal)
              console.log('Email Mailgun ID:', emailResult.mailgun_id)
            } else {
              console.error('Failed to send verification email:', emailResult.error)
              // Don't fail the webhook if email fails - log it and continue
            }
          } catch (emailError) {
            console.error('Error calling send-verification-email function:', emailError)
            // Don't fail the webhook if email fails - log it and continue
          }
        } else {
          console.warn('Could not send verification email: missing email or name', {
            email: userEmailFinal,
            name: userNameFinal,
            user_id,
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
   - BASE_URL (for verification links)

2. Deploy the function:
   supabase functions deploy stripe-webhook

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
5. User clicks link to verify their email address

Note: If you want to store verification tokens in the database, uncomment the 
code block that updates the users table with verification_token and 
verification_token_expires_at (around line 176).

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
