# Password Reset Token Expiration Configuration

## Problem

Password reset tokens are expiring too quickly. By default, Supabase password reset tokens expire after **60 minutes (1 hour)**.

## Solution

You can increase the expiration time in your Supabase project settings.

## Method 1: Configure in Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **Authentication** → **Settings**
3. Scroll down to the **Email** section
4. Find the **"Mailer OTP Expiration"** field
5. Change the value from `3600` (60 minutes) to your desired duration in **seconds**

### Common Values:

- **2 hours**: `7200` seconds
- **6 hours**: `21600` seconds
- **12 hours**: `43200` seconds
- **24 hours**: `86400` seconds
- **48 hours**: `172800` seconds

### Recommended Settings:

- **Development/Testing**: `21600` (6 hours) - gives you time to test
- **Production**: `7200` (2 hours) - good balance between security and usability

## Method 2: Configure via Supabase CLI (if available)

Some Supabase configurations can be set via CLI, but the Mailer OTP Expiration is typically managed through the dashboard.

## Current Configuration Check

To see your current expiration setting:

1. Go to Supabase Dashboard
2. Authentication → Settings
3. Look for **"Mailer OTP Expiration"** value
4. Default is `3600` (1 hour = 60 minutes)

## Important Notes

⚠️ **Security Considerations:**
- Longer expiration times = less secure (more time for tokens to be compromised)
- Shorter expiration times = more secure but less user-friendly
- **Recommended**: 2-6 hours for production

⚠️ **Email Client Issues:**
- Some email clients (like Gmail) may pre-fetch/preview links, which can invalidate them
- Users should click the link directly, not preview it first

⚠️ **Token Usage:**
- Password reset tokens are **one-time use** - they expire after first use
- If user clicks link and doesn't complete reset, they need to request a new one

## How It Works

The expiration is controlled by Supabase's `generate_link` API when creating password reset links. The setting affects:

- Password reset tokens (`type: 'recovery'`)
- Email verification tokens (`type: 'signup'`)
- Magic link tokens

All are controlled by the same **"Mailer OTP Expiration"** setting.

## Testing

After changing the expiration time:

1. Request a password reset
2. Note the time
3. Wait and test if the link still works after the new expiration time
4. Check function logs to see if tokens are expiring correctly

## Alternative: Custom Token Management

If you need more control over token expiration, you could implement custom token management, but this is more complex and not recommended unless you have specific requirements.

For most use cases, adjusting the **"Mailer OTP Expiration"** in the Supabase dashboard is the best solution.

