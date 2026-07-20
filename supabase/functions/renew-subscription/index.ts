import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

interface RenewSubscriptionRequest {
  user_id?: string
  plan: 'monthly' | 'yearly'
}

serve(async (req) => {
  // Handle CORS preflight requests
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

    // Check user role - only PMs can renew subscriptions
    const userRole = user.user_metadata?.role || user.app_metadata?.role
    if (userRole !== 'pm') {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Unauthorized. Only property managers can renew subscriptions.' 
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Parse request body
    const body: RenewSubscriptionRequest = await req.json()
    const { plan } = body

    // Validate plan
    if (!plan || (plan !== 'monthly' && plan !== 'yearly')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid plan. Must be "monthly" or "yearly"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Get user's subscription info from database
    const { data: userData, error: userDataError } = await supabaseAdmin
      .from('users')
      .select('id, email, stripe_customer_id, subscription_status, cancel_at')
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
        JSON.stringify({ success: false, error: 'No Stripe customer found. Please contact support.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Initialize Stripe
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY') ?? ''
    if (!stripeSecretKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Stripe not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2024-12-18.acacia' })
    const isTestMode = stripeSecretKey.startsWith('sk_test_')

    // Define price IDs based on plan and environment
    const priceId = plan === 'monthly' 
      ? (isTestMode 
          ? 'price_1SMzASLC1RJAUbjMZVUqQCY0'   // DEV_MONTHLY_PRICE_ID
          : 'price_1SMce8LC1RJAUbjMf3MZyCav')  // LIVE_MONTHLY_PRICE_ID
      : (isTestMode 
          ? 'price_1SMzB3LC1RJAUbjMB57Ph1dI'   // DEV_YEARLY_PRICE_ID
          : 'price_1SMcgxLC1RJAUbjMCsGkOzCK')  // LIVE_YEARLY_PRICE_ID

    // Find existing subscription - look for the most recent subscription for this customer
    const subscriptions = await stripe.subscriptions.list({
      customer: userData.stripe_customer_id,
      status: 'all', // Include cancelled subscriptions
      limit: 10,
    })

    // Find the most recent subscription that can be updated
    // Stripe doesn't allow updating fully cancelled subscriptions, so we look for active/incomplete/past_due
    let subscriptionToUpdate: Stripe.Subscription | null = null
    let mostRecentSubscription: Stripe.Subscription | null = null
    
    if (subscriptions.data.length > 0) {
      // Sort by created date descending to get most recent
      const sortedSubs = subscriptions.data.sort((a, b) => b.created - a.created)
      mostRecentSubscription = sortedSubs[0]
      
      // Find first subscription that can be updated (not fully cancelled)
      // We can update: active, past_due, incomplete, incomplete_expired, trialing, unpaid
      const updateableStatuses = ['active', 'past_due', 'incomplete', 'incomplete_expired', 'trialing', 'unpaid']
      subscriptionToUpdate = sortedSubs.find(sub => updateableStatuses.includes(sub.status)) || null
    }

    // Determine the site URL based on environment
    const siteUrl = Deno.env.get('SITE_URL') || (isTestMode ? 'http://localhost:5173' : 'https://www.sycnmore.com')

    // Helper: create a Stripe Checkout session that collects a payment method
    // and (re)starts the subscription. Used whenever we can't charge the
    // customer directly (no default payment method, or a fully cancelled sub).
    const createRenewalCheckout = async () => {
      const session = await stripe.checkout.sessions.create({
        customer: userData.stripe_customer_id,
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [{
          price: priceId,
          quantity: 1,
        }],
        metadata: {
          user_id: user.id,
          plan: plan,
          email: userData.email || '',
          renewal: 'true', // Flag to indicate this is a renewal
        },
        success_url: `${siteUrl}?session_id={CHECKOUT_SESSION_ID}&payment=success&renewal=true`,
        cancel_url: `${siteUrl}?payment=cancelled`,
        allow_promotion_codes: true,
        billing_address_collection: 'required',
      })

      console.log(`✅ Created Checkout session for subscription renewal: ${session.id}`)

      return new Response(
        JSON.stringify({
          success: true,
          requires_payment: true,
          checkout_url: session.url,
          message: 'Payment required to renew subscription',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Check if subscription is cancelled and past due date
    const isCancelled = userData.subscription_status === 'canceled'
    const cancelAt = userData.cancel_at ? new Date(userData.cancel_at) : null
    const isPastDueDate = cancelAt && cancelAt < new Date()
    const needsPayment = isCancelled && isPastDueDate

    // Determine whether the customer has a usable default payment method.
    // Creating/updating a subscription via the API charges immediately, which
    // fails with "no attached payment source or default payment method" when
    // the customer has none — in that case we must collect a card via Checkout.
    let hasDefaultPaymentMethod = false
    try {
      const customer = await stripe.customers.retrieve(userData.stripe_customer_id)
      if (customer && !(customer as { deleted?: boolean }).deleted) {
        const customerObj = customer as Stripe.Customer
        hasDefaultPaymentMethod = Boolean(
          customerObj.invoice_settings?.default_payment_method || customerObj.default_source,
        )
      }
    } catch (pmError) {
      console.warn('Could not verify customer payment method; will route to Checkout:', pmError)
      hasDefaultPaymentMethod = false
    }

    // Route to Checkout when we cannot safely charge the customer directly:
    // - the cancellation date has already passed (needsPayment), OR
    // - the customer has no default payment method, OR
    // - there is no updateable subscription and the latest one is cancelled.
    if (
      needsPayment ||
      !hasDefaultPaymentMethod ||
      (!subscriptionToUpdate && mostRecentSubscription?.status === 'canceled')
    ) {
      return await createRenewalCheckout()
    }

    // The customer has a default payment method, so charge directly.
    let updatedSubscription: Stripe.Subscription

    try {
      if (subscriptionToUpdate) {
        // Update existing subscription - use subscription.update() as requested
        const subscriptionItem = subscriptionToUpdate.items.data[0]

        if (!subscriptionItem) {
          return new Response(
            JSON.stringify({ success: false, error: 'Subscription has no items' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          )
        }

        // Update the subscription with the new price using subscription.update()
        updatedSubscription = await stripe.subscriptions.update(subscriptionToUpdate.id, {
          items: [{
            id: subscriptionItem.id,
            price: priceId,
          }],
          cancel_at_period_end: false, // Remove any cancellation flags
          metadata: {
            user_id: user.id,
            plan: plan,
            email: userData.email || '',
          },
        })

        console.log(`✅ Updated existing subscription ${updatedSubscription.id} with new plan ${plan} using subscription.update()`)
      } else {
        // No updateable subscription found - create a new one
        updatedSubscription = await stripe.subscriptions.create({
          customer: userData.stripe_customer_id,
          items: [{
            price: priceId,
          }],
          metadata: {
            user_id: user.id,
            plan: plan,
            email: userData.email || '',
          },
        })

        console.log(`✅ Created new subscription ${updatedSubscription.id} with plan ${plan}`)
      }
    } catch (subError) {
      // Safety net: if Stripe still reports a missing/invalid payment method,
      // fall back to collecting one via Checkout instead of failing the request.
      const message = subError instanceof Error ? subError.message : String(subError)
      if (/payment (source|method)|default payment/i.test(message)) {
        console.warn('Direct subscription charge failed due to payment method; routing to Checkout:', message)
        return await createRenewalCheckout()
      }
      throw subError
    }

    // Update database - set subscription as active
    const updateData: any = {
      subscription_status: 'active',
      subscribed: true,
      cancel_at: null,
      plan: plan,
    }

    // Update subscriptions table
    try {
      // First, try to update existing subscription record
      const { data: existingSub, error: findError } = await supabaseAdmin
        .from('subscriptions')
        .select('id, stripe_subscription_id')
        .eq('stripe_customer_id', userData.stripe_customer_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (existingSub && !findError) {
        // Update existing record
        await supabaseAdmin
          .from('subscriptions')
          .update({
            stripe_subscription_id: updatedSubscription.id,
            plan: plan,
            status: 'active',
          })
          .eq('id', existingSub.id)
      } else {
        // Insert new record
        await supabaseAdmin
          .from('subscriptions')
          .insert({
            user_id: user.id,
            stripe_customer_id: userData.stripe_customer_id,
            stripe_subscription_id: updatedSubscription.id,
            plan: plan,
            status: 'active',
            start_date: new Date().toISOString(),
          })
      }
    } catch (subTableError) {
      console.warn('Could not update subscriptions table:', subTableError)
      // Continue even if subscriptions table update fails
    }

    // Update users table
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update(updateData)
      .eq('id', user.id)

    if (updateError) {
      console.error('Error updating user record:', updateError)
      // Still return success since Stripe subscription was updated
    }

    console.log(`Subscription renewed for PM ${user.id} with plan ${plan}`)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Subscription renewed successfully',
        subscription_id: updatedSubscription.id,
        subscription_status: updatedSubscription.status,
        plan: plan,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    console.error('Error in renew-subscription:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})

