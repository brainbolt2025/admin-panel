# Renew Subscription Edge Function

This Edge Function updates an existing Stripe subscription instead of creating a new one when a PM renews their cancelled subscription.

## Features

- Updates existing Stripe subscriptions using `subscription.update()` API
- Handles cancelled subscriptions by creating new subscriptions when necessary
- Updates database records to reflect renewed subscription
- Requires authentication (PM role only)

## How It Works

1. **Checks Subscription Status**: Determines if subscription is cancelled and past the cancellation date
2. **Collects Payment If Needed**: If subscription is cancelled and past due date, creates a Stripe Checkout session to collect payment
3. **Updates Existing Subscription**: If subscription exists and can be updated (status: active, past_due, incomplete, etc.), uses `stripe.subscriptions.update()` to update the plan
4. **Creates New If Needed**: If no updateable subscription exists, creates a new subscription
5. **Updates Database**: Updates both `users` and `subscriptions` tables with new subscription status

### Payment Collection Flow

When a subscription is cancelled and past the cancellation date:
- Returns `requires_payment: true` and `checkout_url` in the response
- User is redirected to Stripe Checkout to complete payment
- After successful payment, Stripe webhook handles subscription creation
- User is redirected back with `?payment=success&renewal=true`
- App reloads user profile to refresh subscription status

## API Endpoint

**Development:**
```
https://goljbyvrnktxwtnjomaq.supabase.co/functions/v1/renew-subscription
```

**Production:**
```
https://qmhmgjzkpfzxfjdurigu.supabase.co/functions/v1/renew-subscription
```

## Request

### Method
`POST`

### Headers
```
Authorization: Bearer <supabase_jwt_token>
Content-Type: application/json
```

### Body
```json
{
  "plan": "monthly" | "yearly"
}
```

## Response

### Success - Direct Update (200)
When subscription can be updated directly without payment:
```json
{
  "success": true,
  "message": "Subscription renewed successfully",
  "subscription_id": "sub_xxxxx",
  "subscription_status": "active",
  "plan": "monthly"
}
```

### Success - Payment Required (200)
When subscription is cancelled and payment is needed:
```json
{
  "success": true,
  "requires_payment": true,
  "checkout_url": "https://checkout.stripe.com/pay/cs_xxxxx",
  "message": "Payment required to renew subscription"
}
```

### Error (400/401/403/500)
```json
{
  "success": false,
  "error": "Error message here"
}
```

## Environment Variables

Requires the same environment variables as other Stripe functions:
- `STRIPE_SECRET_KEY`: Your Stripe secret key
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key

## Deployment

1. Deploy to Supabase Edge Functions:
   ```bash
   supabase functions deploy renew-subscription
   ```

2. Ensure environment variables are set in Supabase Dashboard

## Usage Example

```typescript
const renewSubscription = async (plan: 'monthly' | 'yearly') => {
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) {
    throw new Error('Not authenticated')
  }

  const response = await fetch(
    'https://YOUR_PROJECT.supabase.co/functions/v1/renew-subscription',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ plan })
    }
  )

  const data = await response.json()
  
  if (!data.success) {
    throw new Error(data.error)
  }
  
  return data
}
```

