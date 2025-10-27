// Import Stripe SDK from esm.sh (v13)
import Stripe from 'https://esm.sh/stripe@13'
// Import serve from Deno standard library
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

// CORS headers for cross-origin requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// TypeScript interface for the request body
interface CreateSubscriptionRequest {
  user_id: string
  email: string
  stripe_customer_id: string
  plan: 'monthly' | 'yearly'
}

// Main handler function
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Parse the request body
    const body: CreateSubscriptionRequest = await req.json()
    const { user_id, email, stripe_customer_id, plan } = body

    // Validate required fields
    if (!user_id || !email || !stripe_customer_id || !plan) {
      return new Response(
        JSON.stringify({ 
          error: 'Missing required fields. Required: user_id, email, stripe_customer_id, plan' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Validate plan value
    if (plan !== 'monthly' && plan !== 'yearly') {
      return new Response(
        JSON.stringify({ error: 'Invalid plan. Must be "monthly" or "yearly"' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email format' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Initialize Stripe client with secret key from environment variable
    // TO ADD STRIPE SECRET KEY: Set it in your Supabase project secrets
    // For production, replace sk_test_... with sk_live_...
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
      apiVersion: '2024-12-18.acacia',
      httpClient: Stripe.createFetchHttpClient(),
    })

    // Define price IDs based on plan
    // TODO: Replace these test price IDs with your production prices in Stripe Dashboard
    // For production: Replace price_dev_... with price_live_...
    const priceId = plan === 'monthly' 
      ? 'price_1SMce8LC1RJAUbjMf3MZyCav'   
      : 'price_1SMcgxLC1RJAUbjMCsGkOzCK'    // Replace with production price ID

    // Create a Stripe Checkout Session for subscription
    const session = await stripe.checkout.sessions.create({
      customer: stripe_customer_id,
      mode: 'subscription',  // Set mode to subscription for recurring payments
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      metadata: {
        user_id,
        plan,
        email,  // Store email in metadata for reference
      },
      // Success and cancel URLs - user will be redirected here after payment
      success_url: 'https://admin.asine.app/subscribe/success?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: 'https://admin.asine.app/subscribe/cancel',
      // Note: Don't use customer_email when customer is already specified
      // The customer object already has the email associated
      // Allow promotion codes
      allow_promotion_codes: true,
      // Set billing address collection as required
      billing_address_collection: 'required',
    })

    console.log('Stripe Checkout session created:', session.id)

    // Return success response with checkout URL
    // The frontend should redirect the user to this URL
    return new Response(
      JSON.stringify({ 
        success: true, 
        url: session.url,
        session_id: session.id
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error creating subscription checkout:', error)
    
    // Handle Stripe API errors
    if (error instanceof Stripe.errors.StripeError) {
      return new Response(
        JSON.stringify({ error: `Stripe error: ${error.message}` }),
        { 
          status: error.statusCode || 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Handle all other errors
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
1. Set the Stripe secret key as a Supabase secret:
   supabase secrets set STRIPE_SECRET_KEY=sk_test_xxx

2. Deploy the function:
   supabase functions deploy create-subscription

3. Test the function from your frontend:
   
   fetch('https://YOUR_PROJECT.supabase.co/functions/v1/create-subscription', {
     method: 'POST',
     headers: {
       'Content-Type': 'application/json',
       'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
     },
     body: JSON.stringify({
       user_id: 'uuid-of-supabase-user',
       email: 'pm@example.com',
       stripe_customer_id: 'cus_123456789',
       plan: 'monthly'
     })
   })
   .then(res => res.json())
   .then(data => {
     if (data.success) {
       // Redirect user to Stripe Checkout
       window.location.href = data.url
     }
   })

WORKFLOW:
1. Create Stripe customer using create-stripe-customer function
2. Call this function with the customer_id
3. Redirect user to the returned URL
4. After successful payment, Stripe will redirect to success_url
5. Use Stripe webhooks to handle subscription events (created, updated, canceled)

UPGRADING TO PRODUCTION:
- Replace sk_test_... with sk_live_... in Supabase secrets
- Replace price_dev_monthly_149 with your live monthly price ID
- Replace price_dev_yearly_1429 with your live yearly price ID
- Update success_url and cancel_url for production domain

TESTING:
- Use test card: 4242 4242 4242 4242
- Use any future expiry date
- Use any 3-digit CVC
- Use any postal code
- Stripe test mode: https://stripe.com/docs/testing

4. Example response on success:
   {
     "success": true,
     "url": "https://checkout.stripe.com/pay/cs_test_123...",
     "session_id": "cs_test_123..."
   }
*/
