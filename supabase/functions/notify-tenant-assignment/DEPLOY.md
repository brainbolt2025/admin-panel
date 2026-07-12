# Deploy Notify Tenant Assignment Function

## Prerequisites

1. Supabase CLI installed and authenticated
2. Mailgun account with verified domain
3. Mailgun API key (private key, not public)

## Step 1: Set Environment Variables

Set the required secrets in your Supabase project:

```bash
# Required secrets
supabase secrets set SUPABASE_URL=https://your-project.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
supabase secrets set MAILGUN_DOMAIN=mg.yourdomain.com
supabase secrets set MAILGUN_API_KEY=key-your-mailgun-api-key

# Optional secrets
supabase secrets set MAILGUN_REGION=us  # or 'eu'

# Deep link configuration (for tenant mobile app)
# In dev/staging (when STRIPE_SECRET_KEY starts with sk_test_), localhost is used automatically
# Optional: Override with custom scheme or URL
supabase secrets set TENANT_APP_DEEP_LINK_SCHEME=asine://  # Custom URL scheme (e.g., "asine://" or "oms://")
# OR use universal link:
supabase secrets set TENANT_APP_URL=https://app.asine.com  # Universal link base URL
# For dev, optionally set custom port:
supabase secrets set DEV_APP_PORT=8081  # Localhost port for dev deep links (default: 8081)
# Fallback options:
supabase secrets set APP_DEEP_LINK_SCHEME=asine://  # Fallback custom scheme
supabase secrets set APP_URL=https://app.asine.com  # Fallback universal link
```

## Step 2: Deploy the Function

```bash
supabase functions deploy notify-tenant-assignment
```

## Step 3: Verify Deployment

Check that the function is deployed:

```bash
supabase functions list
```

You should see `notify-tenant-assignment` in the list.

## Step 4: Test the Function

You can test the function using curl or your API client:

```bash
curl -X POST \
  'https://your-project.supabase.co/functions/v1/notify-tenant-assignment' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "work_order_id": "your-work-order-uuid"
  }'
```

## Troubleshooting

### Check Logs

```bash
supabase functions logs notify-tenant-assignment
```

### Common Issues

1. **"Mailgun configuration missing"**
   - Ensure `MAILGUN_DOMAIN` and `MAILGUN_API_KEY` are set
   - Verify you're using a private API key (starts with `key-`)

2. **"Work order not found"**
   - Verify the `work_order_id` exists in your database
   - Check that the work order has a `tenant_id`

3. **"Tenant not found"**
   - Ensure the tenant exists in the `users` table
   - Verify the tenant has `role = 'tenant'`

## Integration

The function is automatically called from `WorkOrders.tsx` when a technician is assigned. No additional integration needed.

## Deep Link Configuration

The "View Work Order" button in emails uses deep links to open the mobile app directly to the work order.

### Option 1: Custom URL Scheme (Recommended for Mobile Apps)

Set a custom URL scheme like `asine://`:
```bash
supabase secrets set TENANT_APP_DEEP_LINK_SCHEME=asine://
```

This creates deep links like: `asine://work-order/{work_order_id}`

Make sure your mobile app is configured to handle this URL scheme pattern.

### Option 2: Universal Links (Web + Mobile)

Use a universal link URL:
```bash
supabase secrets set TENANT_APP_URL=https://app.asine.com
```

This creates universal links like: `https://app.asine.com/work-order/{work_order_id}`

Your mobile app must be configured to handle universal links for this domain.

### Priority Order

1. `TENANT_APP_DEEP_LINK_SCHEME` (custom scheme)
2. `APP_DEEP_LINK_SCHEME` (fallback custom scheme)
3. `TENANT_APP_URL` (universal link)
4. `APP_URL` (fallback universal link)
5. `BASE_URL` (final fallback)

