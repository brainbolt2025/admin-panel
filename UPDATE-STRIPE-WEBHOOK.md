# Update Stripe Webhook Configuration

You need to add the `customer.subscription.updated` event to your Stripe webhook configuration to handle subscription reactivations automatically.

## Steps

### 1. Go to Stripe Dashboard
1. Navigate to https://dashboard.stripe.com/webhooks (or https://dashboard.stripe.com/test/webhooks for test mode)
2. Find your existing webhook endpoint (the one pointing to your Supabase function)

### 2. Edit the Webhook
1. Click on your webhook endpoint
2. Click **"..."** (three dots) → **"Update"** or click the endpoint name

### 3. Add the New Event
1. Scroll to the **"Events to send"** section
2. Click **"+ Select events"** or **"Add events"**
3. Find and select: `customer.subscription.updated`
4. Click **"Add events"** or **"Update endpoint"**

### 4. Verify Events List
Your webhook should now listen to:
- ✅ `checkout.session.completed`
- ✅ `invoice.paid`
- ✅ `customer.subscription.created`
- ✅ `customer.subscription.updated` ← **NEW**
- ✅ `customer.subscription.deleted`

### 5. Redeploy the Webhook Function (if needed)
If you haven't deployed the updated webhook function yet:

```bash
supabase functions deploy stripe-webhook --no-verify-jwt
```

## What This Does

The `customer.subscription.updated` event will now automatically:
- Update `cancel_at` in your database when a subscription is scheduled for cancellation
- Clear `cancel_at` when a subscription is reactivated (cancel_at_period_end set to false)
- Keep your database in sync with Stripe's subscription state

This ensures data consistency even if subscriptions are modified outside of your app or if there are any race conditions.

## Testing

You can test the webhook with:

```bash
stripe trigger customer.subscription.updated
```

Or manually update a subscription in Stripe Dashboard and watch the webhook logs in Supabase.

