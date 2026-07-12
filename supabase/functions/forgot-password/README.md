# Forgot Password Edge Function

This Supabase Edge Function handles password reset requests by generating a secure password reset link and sending it via email.

## Features

- ✅ Generates secure password reset links using Supabase Admin API
- ✅ Sends custom branded emails via Mailgun
- ✅ Supports deep linking for mobile apps
- ✅ Prevents email enumeration attacks (always returns success)
- ✅ Auto-detects environment (dev vs production)
- ✅ Role-based deep link configuration (tenant vs PM/technician)

## Setup

### 1. Environment Variables

Set these in your Supabase project secrets:

**Required:**
- `MAILGUN_DOMAIN` - Your verified Mailgun domain (e.g., `mg.asine.app`)
- `MAILGUN_API_KEY` - Your Mailgun private API key (starts with `key-`)
- `MAILGUN_REGION` - `us` or `eu` (default: `us`)

**Optional (for deep linking):**
- `APP_DEEP_LINK_SCHEME` - Custom URL scheme for mobile app (e.g., `asine://`)
- `APP_URL` - Base URL for web app (e.g., `https://app.asine.app`)
- `TENANT_APP_DEEP_LINK_SCHEME` - Tenant-specific deep link scheme
- `TENANT_APP_URL` - Tenant-specific app URL
- `BASE_URL` - Fallback base URL
- `STRIPE_SECRET_KEY` - Used to auto-detect environment (test vs production)

### 2. Database Schema

No additional database schema required. Uses existing `users` table.

## Deployment

### Using Supabase Dashboard

1. Go to your Supabase project: https://supabase.com/dashboard
2. Navigate to **Edge Functions** in the left sidebar
3. Click **Create a new function**
4. Function name: `forgot-password`
5. Copy and paste the entire contents of `supabase/functions/forgot-password/index.ts` into the editor
6. Click **Deploy**

### Using CLI

```bash
supabase functions deploy forgot-password
```

## Usage

### Request

**Endpoint:** `https://YOUR_PROJECT.supabase.co/functions/v1/forgot-password`

**Method:** `POST`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer YOUR_SUPABASE_ANON_KEY
```

**Body:**
```json
{
  "email": "user@example.com"
}
```

### Response

**Success (200):**
```json
{
  "success": true,
  "message": "If an account exists with this email, a password reset link has been sent.",
  "mailgun_id": "<20231201234567.abc123@mg.asine.app>"
}
```

**Note:** The function always returns success (even if the email doesn't exist) to prevent email enumeration attacks.

### Frontend Integration

#### React/TypeScript Example

```typescript
const handleForgotPassword = async (email: string) => {
  try {
    const response = await fetch(
      `${config.supabase.url}/functions/v1/forgot-password`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.supabase.anonKey}`,
        },
        body: JSON.stringify({ email }),
      }
    )

    const result = await response.json()
    
    if (result.success) {
      // Show success message to user
      alert('If an account exists with this email, a password reset link has been sent.')
    } else {
      alert('Failed to send password reset email. Please try again.')
    }
  } catch (error) {
    console.error('Error:', error)
    alert('An error occurred. Please try again.')
  }
}
```

#### Kotlin/Android Example

```kotlin
suspend fun requestPasswordReset(email: String): Result<String> {
    return try {
        val response = supabase.functions
            .invoke("forgot-password") {
                setBody(mapOf("email" to email))
            }
        
        val result = response.decode<Map<String, Any>>()
        val success = result["success"] as? Boolean ?: false
        val message = result["message"] as? String ?: "Unknown error"
        
        if (success) {
            Result.success(message)
        } else {
            Result.failure(Exception(message))
        }
    } catch (e: Exception) {
        Result.failure(e)
    }
}
```

## Deep Linking

The function supports deep linking for mobile apps:

### Custom URL Scheme

If `APP_DEEP_LINK_SCHEME` or `TENANT_APP_DEEP_LINK_SCHEME` is set, the reset link will use:
- `asine://auth/reset-password` (for custom scheme)

### Universal Links

If `APP_URL` or `TENANT_APP_URL` is set, the reset link will use:
- `https://app.asine.app/auth/reset-password` (for web/universal links)

### Environment Detection

The function auto-detects environment:
- **Test/Dev:** If `STRIPE_SECRET_KEY` starts with `sk_test_`, uses `http://localhost:5173/auth/reset-password`
- **Production:** Otherwise, uses `https://admin.asine.app/auth/reset-password`

## Security Features

1. **Email Enumeration Prevention:** Always returns success, even if email doesn't exist
2. **Secure Links:** Uses Supabase Admin API to generate secure, time-limited reset tokens
3. **Link Expiration:** Reset links expire after 1 hour (Supabase default)
4. **HTTPS Only:** Production links use HTTPS
5. **Email Validation:** Validates email format before processing

## Password Reset Flow

1. User enters email and clicks "Forgot Password"
2. Frontend calls this function with the email
3. Function generates password reset link via Supabase Admin API
4. Function sends custom email via Mailgun with reset link
5. User clicks link in email
6. Link redirects to app (web or mobile deep link)
7. App handles password reset UI
8. User enters new password
9. App calls Supabase Auth API to complete password reset

## Handling the Reset Link

### Web App

The reset link will redirect to: `https://admin.asine.app/auth/reset-password?token=xxx&type=recovery`

Your app should:
1. Extract the `token` from the URL
2. Show password reset form
3. Call Supabase Auth to reset password:

```typescript
const { data, error } = await supabase.auth.updateUser({
  password: newPassword
})
```

### Mobile App (Deep Link)

The reset link will be: `asine://auth/reset-password?token=xxx&type=recovery`

Your app should:
1. Handle the deep link in your app
2. Extract the `token` from the URL
3. Show password reset form
4. Call Supabase Auth to reset password

## Troubleshooting

### Email Not Received

1. Check Mailgun logs in Mailgun Dashboard
2. Check Supabase Edge Function logs
3. Verify email address is correct
4. Check spam folder
5. Verify Mailgun domain is verified

### Link Not Working

1. Check if link has expired (1 hour limit)
2. Verify deep link configuration in app
3. Check redirect URL is correct
4. Verify Supabase Auth settings allow password recovery

### Deep Link Not Opening App

1. Verify `APP_DEEP_LINK_SCHEME` is configured correctly
2. Check Android `AndroidManifest.xml` intent filters
3. Check iOS URL scheme configuration
4. Test deep link manually

## Testing

Test the function locally:

```bash
supabase functions serve forgot-password --env-file .env.local
```

Test with curl:

```bash
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/forgot-password \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{"email": "test@example.com"}'
```

## Related Functions

- `verify-email` - Email verification
- `create-tenant` - Creates tenant with verification email
- `create-technician` - Creates technician with verification email



