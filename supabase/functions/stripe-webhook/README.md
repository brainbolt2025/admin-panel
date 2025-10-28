# Stripe Webhook Handler Edge Function

This Supabase Edge Function handles Stripe webhook events to automatically update user subscription status in your database.

## Features

- Verifies Stripe webhook signatures for security
- Handles multiple subscription events:
  - `checkout.session.completed` - Payment successful
  - `invoice.paid` - Recurring payment successful
  - `customer.subscription.created` - New subscription started
- Updates user records with subscription status
- Creates subscription tracking records
- Handles errors gracefully

## Setup

### 1. Set Environment Variables

Add two secrets in Supabase Dashboard:

1. **STRIPE_SECRET_KEY** (same as other functions)
   - Go to **Project Settings** → **Edge Functions** → **Secrets**
   - Add `STRIPE_SECRET_KEY` = `sk_test_xxx` (see .env.local for actual key)

2. **STRIPE_WEBHOOK_SECRET** (webhook signing secret)
   - You'll get this after creating the webhook endpoint in Stripe
   - Add `STRIPE_WEBHOOK_SECRET` = `whsec_xxx`

### 2. Database Schema

Run these SQL commands in your Supabase SQL Editor:

```sql
-- Add columns to users table if they don't exist
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS subscribed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS subscription_status TEXT,
ADD COLUMN IF NOT EXISTS plan TEXT,
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

-- Create subscriptions table for tracking history
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT UNIQUE,
  plan TEXT,
  status TEXT,
  start_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Deployment

### Step 1: Deploy the Function

1. Go to https://supabase.com/dashboard
2. Navigate to **Edge Functions**
3. Click **Create a new function**
4. Function name: `stripe-webhook`
5. Copy and paste the entire contents of `supabase/functions/stripe-webhook/index.ts`
6. Click **Deploy**

### Step 2: Get Your Function URL

After deploying, copy your function URL:
```
https://YOUR_PROJECT.supabase.co/functions/v1/stripe-webhook
```

### Step 3: Create Webhook Endpoint in Stripe

1. Go to https://dashboard.stripe.com/test/webhooks
2. Click **Add endpoint**
3. Paste your function URL
4. Select these events to listen to:
   - `checkout.session.completed`
   - `invoice.paid`
   - `customer.subscription.created`
5. Click **Add endpoint**
6. **Important:** Copy the "Signing secret" (starts with `whsec_...`)
7. Go back to Supabase and add it as `STRIPE_WEBHOOK_SECRET`

## Testing

### Option 1: Using Stripe CLI (Recommended)

Install Stripe CLI, then run:

```bash
# Trigger a test checkout completion
stripe trigger checkout.session.completed

# Trigger a test invoice payment
stripe trigger invoice.paid

# Trigger a test subscription creation
stripe trigger customer.subscription.created
```

### Option 2: Using Stripe Dashboard

1. Go to your Stripe Dashboard
2. Navigate to **Developers** → **Events**
3. Find any `checkout.session.completed` event
4. Click **Send test webhook**
5. Your endpoint will be automatically tested

### Option 3: Complete Payment Flow

1. Use your app to create a checkout session
2. Complete the payment with test card `4242 4242 4242 4242`
3. The webhook will fire automatically
4. Check your database to confirm user is updated

## How It Works

### Event: `checkout.session.completed`

When this event is received:

1. Extracts `user_id`, `customer_id`, and `plan` from metadata
2. Updates the `users` table:
   - Sets `subscribed = true`
   - Sets `stripe_customer_id`
   - Sets `plan`
   - Sets `subscription_status = 'active'`
3. Creates a record in `subscriptions` table for tracking

### Event: `invoice.paid`

When a recurring payment succeeds:

1. Finds the user by `stripe_customer_id`
2. Updates `subscribed = true`
3. Updates `subscription_status = 'active'`

### Event: `customer.subscription.created`

When a new subscription is created:

1. Extracts metadata from the subscription
2. Updates the user record with subscription details

## Security

- ✅ **Signature Verification**: All webhook events are verified using Stripe's signature
- ✅ **Invalid Signatures Rejected**: Returns 400 error for tampered requests
- ✅ **Admin Client**: Uses service role key to bypass RLS
- ✅ **Error Handling**: Gracefully handles missing fields and database errors

## Monitoring

### View Webhook Logs

In Supabase Dashboard:
1. Go to **Edge Functions** → **stripe-webhook**
2. Click **Logs** to see all webhook events

In Stripe Dashboard:
1. Go to **Developers** → **Webhooks**
2. Click on your endpoint
3. View recent events and their responses

## Troubleshooting

### "Invalid signature" error

- Check that `STRIPE_WEBHOOK_SECRET` matches the signing secret from Stripe
- Ensure you're using the correct secret (test vs live mode)

### "Missing required metadata" error

- Ensure your checkout session includes `user_id` in metadata
- Check that the `create-subscription` function passes metadata correctly

### Database update fails

- Check that all required columns exist in your `users` table
- Verify RLS policies allow updates for admin users
- Check Edge Function logs for specific error messages

## Switching to Live Mode

When ready for production:

1. **Switch Stripe to Live Mode** in Stripe Dashboard
2. **Update Supabase Secrets**:
   - `STRIPE_SECRET_KEY`: `sk_test_xxx` → `sk_live_xxx`
3. **Create Live Webhook**:
   - In Stripe (Live mode), create a new webhook endpoint
   - Use the same events
   - Copy the new signing secret
4. **Update Secret**:
   - Replace `STRIPE_WEBHOOK_SECRET` with the live mode secret
5. **Redeploy Function**: Function will automatically use new secrets

## Example Webhook Payload

```json
{
  "id": "evt_1234567890",
  "type": "checkout.session.completed",
  "data": {
    "object": {
      "id": "cs_test_1234567890",
      "customer": "cus_1234567890",
      "metadata": {
        "user_id": "uuid-of-supabase-user",
        "plan": "monthly"
      },
      "subscription": "sub_1234567890"
    }
  }
}
```

## Complete Flow

```
1. User clicks "Subscribe"
   ↓
2. create-stripe-customer function creates Stripe customer
   ↓
3. create-subscription function creates checkout session
   ↓
4. User completes payment on Stripe Checkout
   ↓
5. Stripe sends checkout.session.completed webhook
   ↓
6. stripe-webhook function receives event
   ↓
7. User record updated: subscribed = true
   ↓
8. User can access premium features
```

## Next Steps

After setting up the webhook:

1. Test with test cards in Stripe Checkout
2. Monitor webhook delivery in Stripe Dashboard
3. Add more event handlers (e.g., `customer.subscription.deleted`)
4. Set up email notifications for subscription events
5. Create a user dashboard to show subscription status
