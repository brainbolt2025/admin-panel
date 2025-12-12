import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed. Use POST.' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing or invalid authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const token = authHeader.replace('Bearer ', '')

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    if (!supabaseServiceKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing Supabase service role key' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // Verify the JWT token and get user info
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)

    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Check user role - only PMs can reactivate subscriptions
    const userRole = user.user_metadata?.role || user.app_metadata?.role
    if (userRole !== 'pm') {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Unauthorized. Only property managers can reactivate subscriptions.' 
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Get user's subscription info from database
    const { data: userData, error: userDataError } = await supabaseAdmin
      .from('users')
      .select('id, stripe_customer_id, subscription_status, cancel_at')
      .eq('id', user.id)
      .single()

    if (userDataError || !userData) {
      return new Response(
        JSON.stringify({ success: false, error: 'User not found in database' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    if (!userData.stripe_customer_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'No subscription found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    if (!userData.cancel_at) {
      return new Response(
        JSON.stringify({ success: false, error: 'Subscription is not scheduled for cancellation' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Get Stripe subscription ID from subscriptions table
    const { data: subscriptionData, error: subError } = await supabaseAdmin
      .from('subscriptions')
      .select('stripe_subscription_id')
      .eq('stripe_customer_id', userData.stripe_customer_id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    let stripeSubscriptionId: string | null = null

    if (subError || !subscriptionData?.stripe_subscription_id) {
      // Try to get subscription directly from Stripe
      const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY') ?? ''
      if (!stripeSecretKey) {
        return new Response(
          JSON.stringify({ success: false, error: 'Stripe not configured' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }

      const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' })
      
      // List active subscriptions for this customer
      const subscriptions = await stripe.subscriptions.list({
        customer: userData.stripe_customer_id,
        status: 'active',
        limit: 1,
      })

      if (subscriptions.data.length === 0) {
        return new Response(
          JSON.stringify({ success: false, error: 'No active subscription found in Stripe' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }

      stripeSubscriptionId = subscriptions.data[0].id
    } else {
      stripeSubscriptionId = subscriptionData.stripe_subscription_id
    }

    // Initialize Stripe
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY') ?? ''
    if (!stripeSecretKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Stripe not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' })

    // Reactivate subscription in Stripe (remove cancel_at_period_end flag)
    const reactivatedSubscription = await stripe.subscriptions.update(stripeSubscriptionId, {
      cancel_at_period_end: false,
    })

    // Update database - clear cancel_at and ensure status is active
    await supabaseAdmin
      .from('users')
      .update({ 
        subscription_status: 'active',
        subscribed: true,
        cancel_at: null, // Clear cancellation date
      })
      .eq('id', user.id)

    // Update subscriptions table if it exists
    if (subscriptionData?.stripe_subscription_id) {
      try {
        await supabaseAdmin
          .from('subscriptions')
          .update({ 
            status: 'active',
          })
          .eq('stripe_subscription_id', stripeSubscriptionId)
      } catch (err) {
        console.warn('Could not update subscriptions table:', err)
      }
    }

    console.log(`Subscription ${stripeSubscriptionId} reactivated by PM ${user.id}`)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Subscription reactivated successfully',
        subscription_status: reactivatedSubscription.status,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    console.error('Error in reactivate-subscription:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})

