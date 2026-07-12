# Deployment Checklist: Renew Subscription Feature

## What Needs to be Deployed

### 1. ✅ New Edge Function: `renew-subscription` (REQUIRED)

This is a **NEW** Edge Function that needs to be deployed to Supabase.

#### Deployment Options:

**Option A: Using Supabase Dashboard (Recommended - No CLI Required)**

1. Go to https://supabase.com/dashboard
2. Select your project
3. Navigate to **Edge Functions** in the left sidebar
4. Click **Create a new function**
5. Function name: `renew-subscription`
6. Copy the entire contents of `supabase/functions/renew-subscription/index.ts` and paste into the code editor
7. Click **Deploy**

**Option B: Using CLI**

```bash
# Navigate to project directory
cd "C:\Users\juego\OneDrive\Documentos\ideas\OMS_app\admin panel\admin-panel"

# Login to Supabase (if not already logged in)
supabase login

# Link to your project (if not already linked)
supabase link --project-ref qmhmgjzkpfzxfjdurigu  # Development
# OR
supabase link --project-ref YOUR_PRODUCTION_PROJECT_REF  # Production

# Deploy the function
supabase functions deploy renew-subscription
```

#### Environment Variables Required

The function uses the same environment variables as other Stripe functions. Make sure these are set in Supabase Dashboard:

1. **STRIPE_SECRET_KEY** - Your Stripe secret key
   - Go to **Project Settings** → **Edge Functions** → **Secrets**
   - Verify `STRIPE_SECRET_KEY` exists

2. **SUPABASE_SERVICE_ROLE_KEY** - Already set (used by all functions)

3. **SUPABASE_URL** - Automatically available

4. **SITE_URL** (optional) - For checkout redirect URLs
   - Defaults to `http://localhost:5173` in test mode
   - Defaults to `https://admin.asine.app` in production

### 2. ✅ Frontend Changes (Already in Codebase)

The following frontend files have been updated but don't require separate deployment - they're part of your React app build:

- ✅ `src/config.ts` - Added `renewSubscription` endpoint
- ✅ `src/components/RenewSubscription.tsx` - Updated to use new endpoint
- ✅ `src/App.tsx` - Added renewal payment success handling

These will be deployed when you build and deploy your React app.

---

## Verify Deployment

### 1. Check Function is Deployed

**Development:**
```
https://goljbyvrnktxwtnjomaq.supabase.co/functions/v1/renew-subscription
```

**Production:**
```
https://qmhmgjzkpfzxfjdurigu.supabase.co/functions/v1/renew-subscription
```

You should see a CORS preflight response (OPTIONS request) or an authentication error, which confirms the function is deployed.

### 2. Test the Function

Use the testing guide in `TEST_RENEW_SUBSCRIPTION.md` to verify everything works.

---

## Quick Deployment Summary

**Only ONE new thing to deploy:**
1. ✨ **NEW Edge Function**: `renew-subscription` (via Supabase Dashboard or CLI)

**Already done (no deployment needed):**
- ✅ Frontend code changes (will deploy with your app build)
- ✅ Configuration updates (already in codebase)

---

## Post-Deployment Checklist

- [ ] Edge Function `renew-subscription` is deployed
- [ ] Environment variables are set (STRIPE_SECRET_KEY)
- [ ] Test with a cancelled subscription that's past due date
- [ ] Verify Checkout redirect works
- [ ] Verify subscription renewal after payment
- [ ] Check that renewal page disappears after successful renewal



