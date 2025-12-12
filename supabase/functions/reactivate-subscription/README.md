# Reactivate Subscription Edge Function

This Supabase Edge Function allows Property Managers to reactivate their subscription if it's scheduled for cancellation.

## Features

- Verifies JWT authentication
- Only allows PMs to reactivate subscriptions
- Removes `cancel_at_period_end` flag in Stripe
- Clears `cancel_at` field in database
- Updates subscription status to active

## Request

**Endpoint:** `POST /functions/v1/reactivate-subscription`

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

**Body:** None required

## Response

**Success (200):**
```json
{
  "success": true,
  "message": "Subscription reactivated successfully",
  "subscription_status": "active"
}
```

**Error (400):**
```json
{
  "success": false,
  "error": "Subscription is not scheduled for cancellation"
}
```

**Error (401):**
```json
{
  "success": false,
  "error": "Invalid or expired token"
}
```

**Error (403):**
```json
{
  "success": false,
  "error": "Unauthorized. Only property managers can reactivate subscriptions."
}
```

## Deployment

```bash
supabase functions deploy reactivate-subscription
```

## Environment Variables

- `STRIPE_SECRET_KEY` - Stripe secret key (required)
- `SUPABASE_URL` - Supabase project URL (auto-set)
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (auto-set)

## How It Works

1. Verifies the user is authenticated and is a PM
2. Checks if subscription has `cancel_at` set (scheduled for cancellation)
3. Gets the Stripe subscription ID from database or Stripe API
4. Updates Stripe subscription to remove `cancel_at_period_end: false`
5. Clears `cancel_at` in database and ensures status is active
6. Returns success response

## Database Updates

- `users.cancel_at` → `null`
- `users.subscription_status` → `'active'`
- `users.subscribed` → `true`
- `subscriptions.status` → `'active'` (if subscriptions table exists)

