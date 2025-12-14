# Update Online Status Edge Function - Quick Overview

## What It Does

The `update-online-status` Edge Function allows tenants and technicians to update their online/offline status in the database, bypassing RLS policies.

## Endpoint

```
POST https://YOUR_PROJECT.supabase.co/functions/v1/update-online-status
```

**Replace `YOUR_PROJECT` with your Supabase project reference** (e.g., `goljbyvrnktxwtnjomaq`)

## Authentication

Requires a valid JWT access token in the Authorization header:

```
Authorization: Bearer <USER_ACCESS_TOKEN>
```

Get the token from your Supabase client:
```kotlin
val accessToken = supabaseClient.auth.currentAccessTokenOrNull()
```

## Request Body

```json
{
  "is_online": true,                    // Required: boolean
  "last_seen": "2024-01-15T10:30:00Z"  // Optional: ISO timestamp (defaults to now)
}
```

## Response

**Success (200):**
```json
{
  "success": true,
  "message": "Online status updated successfully",
  "data": {
    "user_id": "uuid-here",
    "is_online": true,
    "last_seen": "2024-01-15T10:30:00.000Z"
  }
}
```

**Error (4xx/5xx):**
```json
{
  "success": false,
  "error": "Error message here"
}
```

## Quick Implementation (Android/Kotlin)

### 1. Set User Online

```kotlin
suspend fun setUserOnline() {
    val accessToken = supabaseClient.auth.currentAccessTokenOrNull() ?: return
    
    val response = httpClient.post("https://YOUR_PROJECT.supabase.co/functions/v1/update-online-status") {
        header("Authorization", "Bearer $accessToken")
        header("Content-Type", "application/json")
        setBody(Json.encodeToString(mapOf("is_online" to true)))
    }
    
    if (response.status.isSuccess()) {
        println("✅ User is now online")
    }
}
```

### 2. Set User Offline

```kotlin
suspend fun setUserOffline() {
    val accessToken = supabaseClient.auth.currentAccessTokenOrNull() ?: return
    
    httpClient.post("https://YOUR_PROJECT.supabase.co/functions/v1/update-online-status") {
        header("Authorization", "Bearer $accessToken")
        header("Content-Type", "application/json")
        setBody(Json.encodeToString(mapOf("is_online" to false)))
    }
}
```

### 3. Update Last Seen (Periodic)

```kotlin
// Call this every 30 seconds while user is active
suspend fun updateLastSeen() {
    val accessToken = supabaseClient.auth.currentAccessTokenOrNull() ?: return
    
    httpClient.post("https://YOUR_PROJECT.supabase.co/functions/v1/update-online-status") {
        header("Authorization", "Bearer $accessToken")
        header("Content-Type", "application/json")
        setBody(Json.encodeToString(mapOf(
            "is_online" to true,
            "last_seen" to Instant.now().toString()
        )))
    }
}
```

## When to Call

| Event | Action | Function Call |
|-------|--------|---------------|
| App opens/foreground | Set online | `setUserOnline()` |
| App active (every 30s) | Update last_seen | `updateLastSeen()` |
| App closes/background | Set offline | `setUserOffline()` |
| User logs out | Set offline | `setUserOffline()` |

## Error Codes

| Code | Meaning | Solution |
|------|---------|----------|
| 401 | Invalid/missing token | Ensure user is authenticated |
| 403 | Not tenant/technician | Only tenants/technicians can update |
| 400 | Invalid request body | Check `is_online` is boolean |
| 404 | User not found | User doesn't exist in database |
| 500 | Server error | Check logs, retry later |

## Example: Complete Lifecycle Integration

```kotlin
class MainActivity : AppCompatActivity() {
    private var lastSeenJob: Job? = null
    
    override fun onResume() {
        super.onResume()
        lifecycleScope.launch {
            setUserOnline()
            
            // Update last_seen every 30 seconds
            lastSeenJob = launch {
                while (true) {
                    delay(30_000)
                    updateLastSeen()
                }
            }
        }
    }
    
    override fun onPause() {
        super.onPause()
        lifecycleScope.launch {
            setUserOffline()
            lastSeenJob?.cancel()
        }
    }
}
```

## Required Dependencies

Add to your `build.gradle.kts`:

```kotlin
dependencies {
    implementation("io.ktor:ktor-client-core:2.3.5")
    implementation("io.ktor:ktor-client-cio:2.3.5")
    implementation("io.ktor:ktor-client-content-negotiation:2.3.5")
    implementation("io.ktor:ktor-serialization-kotlinx-json:2.3.5")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.6.0")
}
```

## Testing with cURL

```bash
curl -X POST \
  https://YOUR_PROJECT.supabase.co/functions/v1/update-online-status \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"is_online": true}'
```

## Notes

- ✅ Automatically validates user role (only tenants/technicians allowed)
- ✅ Bypasses RLS policies (uses service role key)
- ✅ `last_seen` defaults to current time if not provided
- ✅ Only updates the authenticated user's own status
- ⚠️ Requires valid authentication token
- ⚠️ Only works for tenants and technicians

## Deployment

Make sure the function is deployed:

```bash
supabase functions deploy update-online-status
```

## Full Documentation

See `supabase/functions/update-online-status/README.md` for detailed documentation.

