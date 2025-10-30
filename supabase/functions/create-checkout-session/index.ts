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
interface CreateCheckoutRequest {
  customer_id: string
  plan: 'monthly' | 'yearly'
  user_id?: string
  email?: string
}

// Main handler function
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Parse the request body
    const body: CreateCheckoutRequest = await req.json()
    const { customer_id, plan, user_id, email } = body

    // Validate required fields
    if (!customer_id || !plan) {
      return new Response(
        JSON.stringify({ 
          error: 'Missing required fields. Required: customer_id, plan' 
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

    // Initialize Stripe client with secret key from environment variable
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
      apiVersion: '2024-12-18.acacia',
      httpClient: Stripe.createFetchHttpClient(),
    })

    // Detect if we're in test mode or live mode based on the secret key
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY') ?? ''
    const isTestMode = stripeSecretKey.startsWith('sk_test_')
    
    console.log('Stripe key detected:', stripeSecretKey.substring(0, 10) + '...')
    console.log('Mode detected:', isTestMode ? 'TEST' : 'LIVE')

    // Define price IDs based on plan and environment
    const priceId = plan === 'monthly' 
      ? (isTestMode 
          ? 'price_1SMzASLC1RJAUbjMZVUqQCY0'   // DEV_MONTHLY_PRICE_ID
          : 'price_1SMce8LC1RJAUbjMf3MZyCav')  // LIVE_MONTHLY_PRICE_ID
      : (isTestMode 
          ? 'price_1SMzB3LC1RJAUbjMB57Ph1dI'   // DEV_YEARLY_PRICE_ID
          : 'price_1SMcgxLC1RJAUbjMCsGkOzCK')  // LIVE_YEARLY_PRICE_ID

    // Create a Stripe Checkout Session for subscription
    const session = await stripe.checkout.sessions.create({
      customer: customer_id,
      mode: 'subscription',  // Set mode to subscription for recurring payments
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      metadata: {
        ...(user_id && { user_id }),
        plan,
        ...(email && { email }),
      },
      // Success and cancel URLs - user will be redirected here after payment
      success_url: `${Deno.env.get('SITE_URL') || 'http://localhost:5174'}?session_id={CHECKOUT_SESSION_ID}&payment=success`,
      cancel_url: `${Deno.env.get('SITE_URL') || 'http://localhost:5174'}?payment=cancelled`,
      // Allow promotion codes
      allow_promotion_codes: true,
      // Set billing address collection as required
      billing_address_collection: 'required',
      // Set subscription data
      subscription_data: {
        metadata: {
          ...(user_id && { user_id }),
          plan,
          ...(email && { email }),
        },
      },
    })

    console.log('Stripe Checkout session created:', session.id)

    // Return success response with checkout URL
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
    console.error('Error creating checkout session:', error)
    
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

2. Set the site URL (optional, defaults to https://admin.asine.app):
   supabase secrets set SITE_URL=https://your-domain.com

3. Deploy the function:
   supabase functions deploy create-checkout-session

4. Test the function from your frontend:
   
   fetch('https://YOUR_PROJECT.supabase.co/functions/v1/create-checkout-session', {
     method: 'POST',
     headers: {
       'Content-Type': 'application/json',
       'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
     },
     body: JSON.stringify({
       customer_id: 'cus_123456789',
       plan: 'monthly',
       user_id: 'uuid-of-supabase-user', // optional
       email: 'pm@example.com' // optional
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
2. Call this function with the customer_id and plan
3. Redirect user to the returned URL
4. After successful payment, Stripe will redirect to success_url (dashboard)
5. Use Stripe webhooks to handle subscription events

UPGRADING TO PRODUCTION:
- Replace sk_test_... with sk_live_... in Supabase secrets
- Live monthly price ID: price_1SMce8LC1RJAUbjMf3MZyCav
- Live yearly price ID: price_1SMcgxLC1RJAUbjMCsGkOzCK
- Update SITE_URL for production domain
- The function will automatically detect test vs live mode based on your secret key

TESTING:
- Use test card: 4242 4242 4242 4242
- Use any future expiry date
- Use any 3-digit CVC
- Use any postal code
- Stripe test mode: https://stripe.com/docs/testing

Example response on success:
{
  "success": true,
  "url": "https://checkout.stripe.com/pay/cs_test_123...",
  "session_id": "cs_test_123..."
}
*/
