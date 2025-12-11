# Deploy Notify Tenant Completion Function

This guide explains how to deploy the `notify-tenant-completion` edge function to Supabase.

## Prerequisites

1. Supabase CLI installed
2. Logged into Supabase CLI
3. Project linked to your Supabase project

## Step 1: Set Environment Variables

Set the required Mailgun secrets in your Supabase project:

```bash
# Required
supabase secrets set MAILGUN_DOMAIN=mg.asine.app
supabase secrets set MAILGUN_API_KEY=key-xxxxxxxxxxxxxxxxxxxxx
supabase secrets set MAILGUN_REGION=us  # or 'eu' for EU region

# Optional (for deep links)
supabase secrets set TENANT_APP_DEEP_LINK_SCHEME=asineapp://
supabase secrets set TENANT_APP_URL=https://app.asine.app
```

**Note:** Make sure to use your **private** Mailgun API key (starts with `key-`), not the public key.

## Step 2: Deploy the Function

```bash
supabase functions deploy notify-tenant-completion
```

## Step 3: Verify Deployment

Check that the function is deployed:

```bash
supabase functions list
```

You should see `notify-tenant-completion` in the list.

## Step 4: Test the Function

You can test the function using curl:

```bash
curl -X POST \
  'https://your-project.supabase.co/functions/v1/notify-tenant-completion' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "work_order_id": "your-work-order-id"
  }'
```

## Step 5: Check Logs

View function logs to debug any issues:

```bash
supabase functions logs notify-tenant-completion
```

## Integration

The function is automatically called from the WorkOrders component when a work order is marked as completed. No additional integration is needed.

## Troubleshooting

### Email not sending
1. Check Mailgun configuration in Supabase secrets
2. Verify the API key is a private key (not public)
3. Check function logs for errors
4. Verify the work order has a tenant assigned

### Function not found
1. Ensure the function is deployed: `supabase functions list`
2. Check the function name matches exactly
3. Verify you're using the correct project URL

### CORS errors
- The function includes CORS headers, but if you see errors, check:
  - The request includes proper Authorization headers
  - The Content-Type header is set to application/json


