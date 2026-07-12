# Fix Email Verification Not Working

## Problem

The verification button is not verifying the email. This happens because:

1. Supabase's `action_link` verifies the email in `auth.users.email_confirmed_at`
2. BUT it doesn't automatically update our `users.email_verified` column
3. The app checks `users.email_verified` which remains `false`

## Solution

### Step 1: Run Database Trigger (REQUIRED)

Run this SQL in Supabase SQL Editor to sync email verification status:

```sql
-- File: sync-email-verification-trigger.sql
```

This trigger automatically updates `users.email_verified` when Supabase Auth verifies the email.

### Step 2: Verify the Trigger Works

After running the SQL, test by:

1. Creating a new tenant
2. Clicking the verification link
3. Checking in Supabase Dashboard:
   - Authentication → Users → Check if `email_confirmed_at` is set
   - Database → users table → Check if `email_verified` is `true`

### Step 3: Alternative - Use Webhook Handler

If the trigger doesn't work, we can create a webhook that listens to Supabase Auth events and updates the users table.

## Current Flow

1. User clicks email link → `https://xxx.supabase.co/auth/v1/verify?token=xxx`
2. Supabase verifies email → Sets `auth.users.email_confirmed_at`
3. Database trigger fires → Updates `users.email_verified = true`
4. Supabase redirects → `asine://auth/verified` (deep link)
5. App opens → Shows success message

## Troubleshooting

### Email Not Verified in Supabase Auth

Check Supabase Dashboard → Authentication → Users:
- Is `email_confirmed_at` set? If not, the link might be expired or invalid
- Check the link format in the email

### Email Verified in Auth but Not in Users Table

1. Check if trigger exists: `SELECT * FROM pg_trigger WHERE tgname = 'sync_email_verification_trigger';`
2. Check trigger function: `SELECT * FROM pg_proc WHERE proname = 'sync_email_verification';`
3. Manually sync: Run the backfill query from the SQL file

### Link Expires Too Quickly

Supabase's default OTP expiration is short. You can increase it in Supabase Dashboard:
- Go to Authentication → Settings
- Increase "Email OTP Expiry" (default is usually 3600 seconds = 1 hour)

## Manual Verification (If Needed)

If automatic verification isn't working, you can manually verify:

```sql
-- Find user by email
SELECT id, email, email_verified 
FROM users 
WHERE email = 'user@example.com';

-- Manually verify
UPDATE users 
SET email_verified = true 
WHERE email = 'user@example.com';

-- Also verify in Supabase Auth (via Admin API or Dashboard)
```


