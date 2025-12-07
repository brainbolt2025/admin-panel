# Client Email Verification Guide

This guide explains how the mobile app should handle email verification.

## Current Flow

### How It Works

1. **User receives email** with Supabase verification link
2. **User clicks link** → Opens Supabase's verification endpoint
3. **Supabase automatically verifies** the email (server-side)
4. **Supabase redirects** to your deep link: `asine://auth/verified`
5. **Mobile app opens** via deep link
6. **App checks verification status** (optional)

## Important: No Client Endpoint Call Needed

**Supabase verifies the email automatically** when the user clicks the link. The client doesn't need to call any endpoint to verify - it's already done by Supabase.

## What the Client Should Do

### Option 1: Trust Supabase's Verification (Recommended)

Since Supabase verifies the email automatically when the link is clicked, you can simply:

1. **Handle the deep link** `asine://auth/verified`
2. **Show success message** to user
3. **Optionally check verification status** via Supabase Auth

```kotlin
// When deep link asine://auth/verified is received
fun handleEmailVerificationDeepLink() {
    // Email is already verified by Supabase
    // Just show success and let user sign in
    showSuccessMessage("Email verified! You can now sign in.")
    navigateToLogin()
}
```

### Option 2: Verify Status After Deep Link

If you want to double-check the verification status:

```kotlin
suspend fun checkEmailVerificationStatus(userId: String): Boolean {
    val supabase = createSupabaseClient()
    
    // Check Supabase Auth status
    val { data: user, error } = supabase.auth.admin.getUserById(userId)
    
    if (error != null) {
        Log.e("Verification", "Error checking status: ${error.message}")
        return false
    }
    
    // Check if email is confirmed
    val isVerified = user?.emailConfirmedAt != null
    return isVerified
}
```

## Available Endpoints

### 1. Supabase Auth Verification (Automatic)

**Endpoint**: `https://YOUR_PROJECT.supabase.co/auth/v1/verify`

- **Method**: GET
- **Called by**: Supabase automatically when user clicks email link
- **Client action**: None needed - happens automatically
- **Redirects to**: Your configured `redirect_to` URL (deep link)

### 2. Custom Verify-Email Edge Function (Optional)

**Endpoint**: `https://YOUR_PROJECT.supabase.co/functions/v1/verify-email?token={token}`

- **Method**: GET
- **Purpose**: Custom verification using tokens stored in database
- **When to use**: Only if you're using custom tokens (not currently used)
- **Headers**:
  ```
  Content-Type: application/json
  apikey: YOUR_SUPABASE_ANON_KEY
  ```

**Response**:
```json
{
  "success": true,
  "message": "Email verified successfully! You can now sign in.",
  "user_id": "uuid-here"
}
```

### 3. Check User Verification Status

**Endpoint**: Supabase Auth API

```kotlin
// Using Supabase Kotlin client
val { data: user, error } = supabase.auth.getUser()

if (user != null) {
    val isEmailVerified = user.emailConfirmedAt != null
    // Handle verification status
}
```

## Recommended Implementation

### Android/Kotlin Example

```kotlin
class EmailVerificationHandler(private val supabase: SupabaseClient) {
    
    suspend fun handleVerificationDeepLink() {
        // Email is already verified by Supabase when link was clicked
        // Just check status and show success
        
        val { data: user, error } = supabase.auth.getUser()
        
        if (error != null) {
            // User not logged in yet - that's fine, they'll sign in after verification
            showSuccessMessage("Email verified! Please sign in.")
            return
        }
        
        if (user?.emailConfirmedAt != null) {
            showSuccessMessage("Email verified successfully!")
            // Navigate to home or login
        } else {
            // This shouldn't happen, but handle edge case
            showErrorMessage("Verification may still be processing. Please try signing in.")
        }
    }
    
    suspend fun checkVerificationStatus(): Boolean {
        val { data: user } = supabase.auth.getUser()
        return user?.emailConfirmedAt != null
    }
}
```

## Deep Link Handling

When the app receives `asine://auth/verified`:

```kotlin
override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    val uri = intent.data
    
    if (uri?.scheme == "asine" && uri.host == "auth" && uri.path == "/verified") {
        // Handle email verification
        handleEmailVerificationDeepLink()
    }
}
```

## Summary

**The client does NOT need to call any endpoint to verify the email.**

1. ✅ **Supabase verifies automatically** when user clicks the email link
2. ✅ **App receives deep link** `asine://auth/verified`
3. ✅ **App shows success message** and navigates to login/home
4. ✅ **Optional**: Check verification status via Supabase Auth API

## Verification Status Check

If you want to verify the email was actually confirmed:

```kotlin
// Check via Supabase Auth
val { data: user } = supabase.auth.getUser()
val isVerified = user?.emailConfirmedAt != null

// Or check your users table
val { data: userRecord } = supabase
    .from("users")
    .select("email_verified")
    .eq("id", userId)
    .single()
    
val isVerified = userRecord?.emailVerified == true
```

## Troubleshooting

### Email Not Verified After Clicking Link

1. **Check Supabase Dashboard**: Go to Authentication → Users → Check if `email_confirmed_at` is set
2. **Check logs**: Look for errors in Supabase function logs
3. **Verify redirect URL**: Ensure `redirect_to` is correctly configured
4. **Check token expiration**: Supabase tokens expire after a set time (default is short)

### Deep Link Not Opening App

1. **Check AndroidManifest.xml**: Ensure intent filters are configured
2. **Verify scheme**: Must match exactly `asine://`
3. **Test with ADB**: `adb shell am start -W -a android.intent.action.VIEW -d "asine://auth/verified"`


