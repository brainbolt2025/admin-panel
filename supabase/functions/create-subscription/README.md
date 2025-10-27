# Create Subscription Checkout Edge Function

This Supabase Edge Function creates a Stripe Checkout session for subscription payments (monthly or yearly plans).

## Features

- Creates a Stripe Checkout Session for subscription payments
- Supports monthly and yearly plans with configurable price IDs
- Validates input fields and plan selection
- Returns checkout URL for frontend redirection
- Handles errors gracefully with proper HTTP status codes
- Works in test mode with test cards for development

## Setup

### 1. Set Environment Variables

The function uses the same `STRIPE_SECRET_KEY` secret from your previous function. If you haven't set it yet:

**Using Supabase Dashboard:**
1. Go to https://supabase.com/dashboard
2. Select your project
3. Go to **Project Settings** → **Edge Functions** → **Secrets**
4. Click **Add Secret**
5. Key: `STRIPE_SECRET_KEY`
6. Value: `sk_test_xxx` (your Stripe test key)
7. Click **Save**

### 2. Create Price IDs in Stripe Dashboard

Before deploying, you need to create products and prices in Stripe:

1. Go to https://dashboard.stripe.com/test/products
2. Click **Add Product**
3. Create two products:
   - **Monthly Plan**: $1.49/month (for testing)
   - **Yearly Plan**: $14.29/year (for testing)
4. Copy the Price IDs (e.g., `price_xxxxxxxxxxxxx`)

### 3. Update Price IDs in the Function

Replace the placeholder price IDs in the function with your actual Stripe price IDs:

```typescript
const priceId = plan === 'monthly' 
  ? 'price_YOUR_MONTHLY_ID'     // Replace with your actual price ID
  : 'price_YOUR_YEARLY_ID'      // Replace with your actual price ID
```

## Deployment

### Using Supabase Dashboard (No CLI Required)

1. Go to your Supabase project: https://supabase.com/dashboard
2. Navigate to **Edge Functions** in the left sidebar
3. Click **Create a new function**
4. Function name: `create-subscription`
5. Copy and paste the entire contents of `supabase/functions/create-subscription/index.ts` into the editor
6. Click **Deploy**

### Using CLI (if available)

```bash
supabase functions deploy create-subscription
```

## Usage

### Request

**Endpoint:** `https://YOUR_PROJECT.supabase.co/functions/v1/create-subscription`

**Method:** `POST`

**Headers:**
- `Content-Type: application/json`
- `Authorization: Bearer YOUR_SUPABASE_ANON_KEY`

**Body:**
```json
{
  "user_id": "uuid-of-supabase-user",
  "email": "pm@example.com",
  "stripe_customer_id": "cus_123456789",
  "plan": "monthly"
}
```

### Response

**Success (200):**
```json
{
  "success": true,
  "url": "https://checkout.stripe.com/pay/cs_test_123...",
  "session_id": "cs_test_123..."
}
```

**Error (400):**
```json
{
  "error": "Missing required fields. Required: user_id, email, stripe_customer_id, plan"
}
```

**Error (500):**
```json
{
  "error": "Internal server error"
}
```

## Complete Workflow

### Step 1: Create Stripe Customer

First, create a Stripe customer using the `create-stripe-customer` function:

```typescript
const customerResult = await fetch(
  'https://YOUR_PROJECT.supabase.co/functions/v1/create-stripe-customer',
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseAnonKey}`
    },
    body: JSON.stringify({
      email: 'pm@example.com',
      name: 'John Doe',
      property_name: 'Sunset Apartments'
    })
  }
)

const customerData = await customerResult.json()
const stripeCustomerId = customerData.customer_id
```

### Step 2: Create Checkout Session

Then, create a checkout session for subscription:

```typescript
const subscriptionResult = await fetch(
  'https://YOUR_PROJECT.supabase.co/functions/v1/create-subscription',
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseAnonKey}`
    },
    body: JSON.stringify({
      user_id: 'uuid-of-supabase-user',
      email: 'pm@example.com',
      stripe_customer_id: stripeCustomerId,
      plan: 'monthly'  // or 'yearly'
    })
  }
)

const subscriptionData = await subscriptionResult.json()

if (subscriptionData.success) {
  // Redirect user to Stripe Checkout
  window.location.href = subscriptionData.url
}
```

### Step 3: Handle Success

After successful payment, Stripe redirects to:
`https://admin.asine.app/subscribe/success?session_id=cs_xxxxx`

## Example Usage

### React/Next.js Example

```typescript
const handleSubscribe = async (plan: 'monthly' | 'yearly') => {
  try {
    // 1. Create Stripe customer
    const customerRes = await fetch(
      `${supabaseUrl}/functions/v1/create-stripe-customer`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${anonKey}`
        },
        body: JSON.stringify({
          email: user.email,
          name: user.name,
          property_name: propertyName
        })
      }
    )
    const customerData = await customerRes.json()

    // 2. Create checkout session
    const checkoutRes = await fetch(
      `${supabaseUrl}/functions/v1/create-subscription`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${anonKey}`
        },
        body: JSON.stringify({
          user_id: user.id,
          email: user.email,
          stripe_customer_id: customerData.customer_id,
          plan: plan
        })
      }
    )
    const checkoutData = await checkoutRes.json()

    // 3. Redirect to checkout
    if (checkoutData.success) {
      window.location.href = checkoutData.url
    }
  } catch (error) {
    console.error('Subscription error:', error)
  }
}
```

## Testing

### Test Cards

Use these test cards in Stripe Checkout:

| Card Number | Description |
|------------|-------------|
| `4242 4242 4242 4242` | Visa (success) |
| `4000 0000 0000 9995` | Visa (declined) |
| `4000 0025 0000 3155` | Requires authentication |

Use any:
- Future expiry date (e.g., 12/25)
- Any 3-digit CVC
- Any postal code

### Test in Stripe Dashboard

1. Go to https://dashboard.stripe.com/test/payments
2. Check your test mode subscriptions
3. Monitor events in Developers → Events

## Upgrading to Production

When ready for live payments:

1. **Update Stripe Secret Key:**
   - Go to Supabase Secrets
   - Replace `sk_test_...` with `sk_live_...`

2. **Update Price IDs:**
   - Edit the function code
   - Replace `price_dev_monthly_149` with your production monthly price ID
   - Replace `price_dev_yearly_1429` with your production yearly price ID

3. **Update Redirect URLs** (if needed):
   - Update `success_url` to production domain
   - Update `cancel_url` to production domain

## Webhook Integration

For complete subscription management, set up a webhook endpoint to handle Stripe events:

Recommended webhook events:
- `checkout.session.completed` - Payment successful
- `customer.subscription.created` - Subscription started
- `customer.subscription.updated` - Subscription changed
- `customer.subscription.deleted` - Subscription canceled

## Error Handling

The function returns appropriate HTTP status codes:

- **400**: Missing fields, invalid plan, or invalid email
- **500**: Stripe API errors or server errors
- **200**: Success

## Security

- Validates all input fields
- Uses HTTPS for all API calls
- Stripe secret key stored securely as Supabase secret
- Customer ID validated before creating session
