# Deploy Email Notification Functions

## Quick Deploy

Deploy both functions with these commands:

```bash
# Deploy technician assignment notification
supabase functions deploy notify-technician-assignment

# Deploy tenant assignment notification
supabase functions deploy notify-tenant-assignment
```

## Prerequisites Check

Before deploying, ensure you have the required environment variables set:

### Required Secrets

These should already be set (used by other email functions):

```bash
# Check if these are already set
supabase secrets list

# If missing, set them:
supabase secrets set SUPABASE_URL=https://your-project.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
supabase secrets set MAILGUN_DOMAIN=mg.yourdomain.com
supabase secrets set MAILGUN_API_KEY=key-your-mailgun-api-key
```

### Optional Secrets (for Deep Links)

Only set if you want to override defaults:

```bash
# For custom URL scheme (e.g., asine://work-order/{id})
supabase secrets set APP_DEEP_LINK_SCHEME=asine://
supabase secrets set TENANT_APP_DEEP_LINK_SCHEME=asine://

# For universal links (e.g., https://app.asine.com/work-order/{id})
supabase secrets set APP_URL=https://app.asine.com
supabase secrets set TENANT_APP_URL=https://app.asine.com

# For custom localhost port in dev (default: 8081)
supabase secrets set DEV_APP_PORT=8081
```

**Note:** In dev/staging (when `STRIPE_SECRET_KEY` starts with `sk_test_`), the functions automatically use `http://localhost:8081` for deep links.

## Verification

After deploying, verify the functions are available:

```bash
supabase functions list
```

You should see:
- `notify-technician-assignment`
- `notify-tenant-assignment`

## Testing

After deployment, test by assigning a technician to a work order in the admin panel. Both emails should be sent automatically.

To check logs if emails aren't being sent:

```bash
# Check technician assignment logs
supabase functions logs notify-technician-assignment

# Check tenant assignment logs
supabase functions logs notify-tenant-assignment
```

## What Happens After Deployment

Once deployed:
1. When a PM assigns a technician to a work order in the admin panel
2. The work order is updated in the database
3. Both edge functions are called automatically (fire-and-forget)
4. Technician receives email with work order details and deep link
5. Tenant receives email notification that a technician was assigned

The functions work even if the user's session has expired (they use service role key internally).

