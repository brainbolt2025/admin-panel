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
interface CreateCustomerRequest {
  email: string
  name: string
  property_name: string
}

// Main handler function
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Parse the request body
    const body: CreateCustomerRequest = await req.json()
    const { email, name, property_name } = body

    // Validate required fields
    if (!email || !name || !property_name) {
      return new Response(
        JSON.stringify({ 
          error: 'Missing required fields. Required: email, name, property_name' 
        }),
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
    // TO ADD STRIPE SECRET KEY: Set it in your Supabase project secrets:
    // supabase secrets set STRIPE_SECRET_KEY=sk_test_xxx
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
      apiVersion: '2024-12-18.acacia',
      httpClient: Stripe.createFetchHttpClient(),
    })

    // Create a new customer in Stripe
    const customer = await stripe.customers.create({
      name,
      email,
      metadata: {
        property_name,
      },
      description: 'Asine Property Manager',
    })

    console.log('Stripe customer created:', customer.id)

    // Return success response with customer ID
    // Note: The Stripe customer ID and property_name should be saved to the user record
    // AFTER the user is created successfully (e.g., after payment confirmation)
    return new Response(
      JSON.stringify({ 
        success: true, 
        customer_id: customer.id,
        message: 'Stripe customer created successfully'
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error creating Stripe customer:', error)
    
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
   supabase functions deploy create-stripe-customer

3. Test the function from your frontend:
   
   fetch('https://YOUR_PROJECT.supabase.co/functions/v1/create-stripe-customer', {
     method: 'POST',
     headers: {
       'Content-Type': 'application/json',
       'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
     },
     body: JSON.stringify({
       email: 'pm@example.com',
       name: 'John Doe',
       property_name: 'Sunset Apartments'
     })
   })
   .then(res => res.json())
   .then(data => console.log(data))

   WORKFLOW:
   - Call this BEFORE creating the user (before checkout)
   - Use the returned customer_id for Stripe Checkout
   - After payment success, save customer_id to the user record

4. Example response on success:
   {
     "success": true,
     "customer_id": "cus_xxxxxxxxxxxxx",
     "message": "Stripe customer created successfully"
   }
*/
