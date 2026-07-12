# How to Update Stripe Webhook Configuration

This guide explains how to add the `customer.subscription.deleted` event to your existing Stripe webhook configuration.

## Step-by-Step Instructions

### Option 1: Update Existing Webhook (Recommended)

1. **Go to Stripe Dashboard**
   - Test Mode: https://dashboard.stripe.com/test/webhooks
   - Live Mode: https://dashboard.stripe.com/webhooks (switch to Live mode first)

2. **Find Your Existing Webhook**
   - Look for the webhook endpoint pointing to your Supabase function
   - URL format: `https://YOUR_PROJECT.supabase.co/functions/v1/stripe-webhook`
   - Click on it to edit

3. **Add the New Event**
   - Scroll down to the **"Events to send"** section
   - Click **"Add events"** or **"Select events"**
   - Search for `customer.subscription.deleted`
   - Check the box next to `customer.subscription.deleted`
   - Click **"Add events"** or **"Update events"**

4. **Save Changes**
   - Click **"Save changes"** at the bottom of the page

### Option 2: Create a New Webhook Endpoint

If you prefer to create a separate endpoint (not recommended unless you have a specific reason):

1. **Go to Stripe Dashboard**
   - Test Mode: https://dashboard.stripe.com/test/webhooks
   - Live Mode: https://dashboard.stripe.com/webhooks

2. **Click "Add endpoint"**

3. **Enter Your Function URL**
   ```
   https://YOUR_PROJECT.supabase.co/functions/v1/stripe-webhook
   ```
   Replace `YOUR_PROJECT` with your Supabase project ID

4. **Select Events**
   Select all these events:
   - ✅ `checkout.session.completed`
   - ✅ `invoice.paid`
   - ✅ `customer.subscription.created`
   - ✅ `customer.subscription.deleted` ⬅️ **New event**

5. **Click "Add endpoint"**

6. **Copy the Signing Secret**
   - After creating the endpoint, you'll see a "Signing secret" (starts with `whsec_...`)
   - Copy this value
   - If updating an existing webhook, you should already have this secret

7. **Update Supabase Secret (if new webhook)**
   - Go to Supabase Dashboard → Project Settings → Edge Functions → Secrets
   - Update `STRIPE_WEBHOOK_SECRET` with the new signing secret
   - **Note**: If you're updating an existing webhook, you don't need to change the secret

## Verify Configuration

### Test the Webhook

1. **Using Stripe CLI** (Recommended)
   ```bash
   # Install Stripe CLI if you haven't already
   # Then trigger a test event
   stripe trigger customer.subscription.deleted
   ```

2. **Check Stripe Dashboard**
   - Go to **Developers** → **Webhooks** → Your endpoint
   - Click on **"Recent events"**
   - You should see the test event listed

3. **Check Supabase Logs**
   - Go to Supabase Dashboard → Edge Functions → `stripe-webhook` → Logs
   - You should see a log entry showing the event was received and processed

### Verify in Database

After triggering a test cancellation, check your database:

```sql
-- Check if subscription status was updated
SELECT id, email, subscription_status, subscribed 
FROM users 
WHERE stripe_customer_id IS NOT NULL;
```

## Complete Event List

Your webhook should now listen to these events:

| Event | Description | When It Fires |
|-------|-------------|---------------|
| `checkout.session.completed` | Payment successful | User completes payment during checkout |
| `invoice.paid` | Recurring payment successful | Monthly/yearly subscription renews |
| `customer.subscription.created` | New subscription started | Subscription is created in Stripe |
| `customer.subscription.deleted` | Subscription cancelled | PM cancels subscription (immediate or at period end) |

## Troubleshooting

### Event Not Being Received

1. **Check Webhook Status**
   - In Stripe Dashboard → Webhooks → Your endpoint
   - Look at "Recent events" to see if events are being sent
   - Check the status code (should be 200)

2. **Check Supabase Logs**
   - Edge Functions → `stripe-webhook` → Logs
   - Look for errors or missing event handlers

3. **Verify Event is Selected**
   - Go back to Stripe Dashboard → Webhooks → Your endpoint
   - Scroll to "Events to send"
   - Make sure `customer.subscription.deleted` is checked

### "Invalid signature" Error

- Ensure `STRIPE_WEBHOOK_SECRET` in Supabase matches the signing secret from Stripe
- Make sure you're using the correct secret for your environment (test vs live)

### Subscription Status Not Updating

- Check that the webhook is actually firing (check Stripe Dashboard)
- Check Supabase Edge Function logs for errors
- Verify the webhook handler code is deployed with the latest changes

## Live Mode

When switching to Live Mode:

1. **Switch to Live Mode in Stripe Dashboard**
   - Toggle the "Test mode" switch in the top right

2. **Create/Update Live Webhook**
   - Follow the same steps above but in Live mode
   - Use your production Supabase function URL

3. **Update Secrets**
   - Update `STRIPE_SECRET_KEY` to your live key (`sk_live_...`)
   - Update `STRIPE_WEBHOOK_SECRET` to the live webhook signing secret (`whsec_...`)

4. **Test**
   - Use a real payment method to test
   - Verify events are being received and processed

## Quick Reference

**Test Mode Webhooks:**
- Dashboard: https://dashboard.stripe.com/test/webhooks

**Live Mode Webhooks:**
- Dashboard: https://dashboard.stripe.com/webhooks

**Function URL Format:**
```
https://goljbyvrnktxwtnjomaq.supabase.co/functions/v1/stripe-webhook  (dev)
https://qmhmgjzkpfzxfjdurigu.supabase.co/functions/v1/stripe-webhook  (prod)
```

Replace with your actual project IDs if different.

