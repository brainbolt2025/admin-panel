# Create Checkout Session Function

This Supabase Edge Function creates a Stripe checkout session for subscription payments and returns the checkout URL for redirection.

## Overview

The function creates a Stripe checkout session with the specified customer and plan, then returns the checkout URL that users can be redirected to for payment processing.

## Request Body

```typescript
interface CreateCheckoutRequest {
  customer_id: string    // Required: Stripe customer ID
  plan: 'monthly' | 'yearly'  // Required: Subscription plan
  user_id?: string       // Optional: Supabase user ID
  email?: string         // Optional: Customer email
}
```

## Response

### Success Response
```json
{
  "success": true,
  "url": "https://checkout.stripe.com/pay/cs_test_123...",
  "session_id": "cs_test_123..."
}
```

### Error Response
```json
{
  "error": "Error message describing what went wrong"
}
```

## Usage Example

```javascript
// Create checkout session
const response = await fetch('https://YOUR_PROJECT.supabase.co/functions/v1/create-checkout-session', {
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
});

const data = await response.json();

if (data.success) {
  // Redirect user to Stripe Checkout
  window.location.href = data.url;
} else {
  console.error('Error:', data.error);
}
```

## Configuration

### Environment Variables

- `STRIPE_SECRET_KEY`: Your Stripe secret key (set as Supabase secret)
- `SITE_URL`: Your site URL for redirects (optional, defaults to http://localhost:5173 for development)

### Price IDs

The function automatically uses the correct price IDs based on your environment:

**Test Mode (sk_test_...):**
- Monthly: `price_1SMzASLC1RJAUbjMZVUqQCY0`
- Yearly: `price_1SMzB3LC1RJAUbjMB57Ph1dI`

**Live Mode (sk_live_...):**
- Monthly: `price_1SMce8LC1RJAUbjMf3MZyCav`
- Yearly: `price_1SMcgxLC1RJAUbjMCsGkOzCK`

## Deployment

1. Set the Stripe secret key:
   ```bash
   supabase secrets set STRIPE_SECRET_KEY=sk_test_xxx
   ```

2. Set the site URL (optional, defaults to http://localhost:5173 for development):
   ```bash
   supabase secrets set SITE_URL=https://your-domain.com
   ```

3. Deploy the function:
   ```bash
   supabase functions deploy create-checkout-session
   ```

## Testing

Use Stripe's test card numbers:
- **Success**: 4242 4242 4242 4242
- **Decline**: 4000 0000 0000 0002
- **Requires Authentication**: 4000 0025 0000 3155

For more test scenarios, see [Stripe's testing documentation](https://stripe.com/docs/testing).

## Workflow

1. Create a Stripe customer using the `create-stripe-customer` function
2. Call this function with the customer ID and desired plan
3. Redirect the user to the returned checkout URL
4. After successful payment, Stripe redirects to the success URL (dashboard)
5. Handle subscription events using Stripe webhooks

## Success URL

After successful payment, users are redirected to:
```
{SITE_URL}/dashboard?session_id={CHECKOUT_SESSION_ID}
```

## Cancel URL

If the user cancels the checkout, they are redirected to:
```
{SITE_URL}/subscribe?cancelled=true
```
