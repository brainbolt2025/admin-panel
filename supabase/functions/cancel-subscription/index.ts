import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

interface CancelSubscriptionRequest {
  cancel_immediately?: boolean // If true, cancel now. If false, cancel at period end
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

    // Check user role - only PMs can cancel subscriptions
    const userRole = user.user_metadata?.role || user.app_metadata?.role
    if (userRole !== 'pm') {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Unauthorized. Only property managers can cancel subscriptions.' 
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Get user's subscription info from database
    const { data: userData, error: userDataError } = await supabaseAdmin
      .from('users')
      .select('id, stripe_customer_id, subscription_status')
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
        JSON.stringify({ success: false, error: 'No active subscription found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    if (userData.subscription_status !== 'active') {
      return new Response(
        JSON.stringify({ success: false, error: 'No active subscription to cancel' }),
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

    // Parse request body
    const body: CancelSubscriptionRequest = await req.json()
    const cancelImmediately = body.cancel_immediately ?? false

    // Initialize Stripe
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY') ?? ''
    if (!stripeSecretKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Stripe not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' })

    // Cancel subscription in Stripe
    let cancelledSubscription
    if (cancelImmediately) {
      cancelledSubscription = await stripe.subscriptions.cancel(stripeSubscriptionId)
    } else {
      cancelledSubscription = await stripe.subscriptions.update(stripeSubscriptionId, {
        cancel_at_period_end: true,
      })
    }

    // Update database
    await supabaseAdmin
      .from('users')
      .update({ 
        subscription_status: cancelImmediately ? 'canceled' : 'active',
        subscribed: !cancelImmediately, // Keep subscribed if canceling at period end
      })
      .eq('id', user.id)

    // Update subscriptions table if it exists
    if (subscriptionData?.stripe_subscription_id) {
      try {
        await supabaseAdmin
          .from('subscriptions')
          .update({ 
            status: cancelImmediately ? 'canceled' : 'active',
          })
          .eq('stripe_subscription_id', stripeSubscriptionId)
      } catch (err) {
        console.warn('Could not update subscriptions table:', err)
      }
    }

    console.log(`Subscription ${stripeSubscriptionId} cancelled by PM ${user.id} (immediately: ${cancelImmediately})`)

    return new Response(
      JSON.stringify({
        success: true,
        message: cancelImmediately 
          ? 'Subscription cancelled immediately' 
          : 'Subscription will be cancelled at the end of the billing period',
        cancelled_immediately: cancelImmediately,
        subscription_status: cancelledSubscription.status,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    console.error('Error in cancel-subscription:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})

