# Update Online Status Edge Function

This Supabase Edge Function allows tenants and technicians to update their online status (`is_online` and `last_seen`) in the database, bypassing RLS policies.

## Features

- ✅ Updates `is_online` status (true/false)
- ✅ Updates `last_seen` timestamp
- ✅ Validates user authentication via JWT token
- ✅ Only allows tenants and technicians to update their status
- ✅ Bypasses RLS using service role key
- ✅ Proper error handling and validation

## Deployment

```bash
supabase functions deploy update-online-status
```

## Usage

### Request

**Endpoint:** `https://YOUR_PROJECT.supabase.co/functions/v1/update-online-status`

**Method:** `POST`

**Headers:**
```
Authorization: Bearer <USER_ACCESS_TOKEN>
Content-Type: application/json
```

**Body:**
```json
{
  "is_online": true,
  "last_seen": "2024-01-15T10:30:00.000Z"  // Optional, defaults to current time
}
```

### Response

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

**Error (400/401/403/404/500):**
```json
{
  "success": false,
  "error": "Error message here"
}
```

## Android Client Implementation

### 1. Set User Online (When App Opens/Becomes Active)

```kotlin
suspend fun setUserOnline() {
    val currentUser = supabaseClient.auth.currentUserOrNull()
    if (currentUser == null) return
    
    val accessToken = supabaseClient.auth.currentAccessTokenOrNull()
    if (accessToken == null) return
    
    try {
        val response = httpClient.post("https://YOUR_PROJECT.supabase.co/functions/v1/update-online-status") {
            header("Authorization", "Bearer $accessToken")
            header("Content-Type", "application/json")
            setBody(Json.encodeToString(mapOf(
                "is_online" to true,
                "last_seen" to Instant.now().toString()
            )))
        }
        
        if (response.status.isSuccess()) {
            println("✅ User set to online")
        }
    } catch (e: Exception) {
        println("❌ Error setting user online: ${e.message}")
    }
}
```

### 2. Update Last Seen (Periodically While Active)

```kotlin
private var lastSeenUpdateJob: Job? = null

fun startLastSeenUpdates() {
    lastSeenUpdateJob?.cancel()
    
    lastSeenUpdateJob = CoroutineScope(Dispatchers.IO).launch {
        while (true) {
            delay(30_000) // 30 seconds
            
            val accessToken = supabaseClient.auth.currentAccessTokenOrNull()
            if (accessToken == null) break
            
            try {
                val response = httpClient.post("https://YOUR_PROJECT.supabase.co/functions/v1/update-online-status") {
                    header("Authorization", "Bearer $accessToken")
                    header("Content-Type", "application/json")
                    setBody(Json.encodeToString(mapOf(
                        "is_online" to true,
                        "last_seen" to Instant.now().toString()
                    )))
                }
                
                if (response.status.isSuccess()) {
                    println("✅ Last seen updated")
                }
            } catch (e: Exception) {
                println("❌ Error updating last seen: ${e.message}")
            }
        }
    }
}
```

### 3. Set User Offline (When App Closes/Goes to Background)

```kotlin
suspend fun setUserOffline() {
    val currentUser = supabaseClient.auth.currentUserOrNull()
    if (currentUser == null) return
    
    val accessToken = supabaseClient.auth.currentAccessTokenOrNull()
    if (accessToken == null) return
    
    try {
        val response = httpClient.post("https://YOUR_PROJECT.supabase.co/functions/v1/update-online-status") {
            header("Authorization", "Bearer $accessToken")
            header("Content-Type", "application/json")
            setBody(Json.encodeToString(mapOf(
                "is_online" to false,
                "last_seen" to Instant.now().toString()
            )))
        }
        
        if (response.status.isSuccess()) {
            println("✅ User set to offline")
        }
    } catch (e: Exception) {
        println("❌ Error setting user offline: ${e.message}")
    }
    
    lastSeenUpdateJob?.cancel()
    lastSeenUpdateJob = null
}
```

### 4. Complete Implementation with Lifecycle

```kotlin
class MainActivity : AppCompatActivity() {
    private var lastSeenUpdateJob: Job? = null
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        lifecycleScope.launch {
            setUserOnline()
            startLastSeenUpdates()
        }
    }
    
    override fun onResume() {
        super.onResume()
        lifecycleScope.launch {
            setUserOnline()
            startLastSeenUpdates()
        }
    }
    
    override fun onPause() {
        super.onPause()
        lifecycleScope.launch {
            setUserOffline()
        }
    }
    
    override fun onDestroy() {
        super.onDestroy()
        lifecycleScope.launch {
            setUserOffline()
        }
    }
    
    // Implement setUserOnline(), startLastSeenUpdates(), setUserOffline()
}
```

## Security Notes

- ✅ Requires valid JWT authentication token
- ✅ Only updates the authenticated user's own status
- ✅ Only allows tenants and technicians (rejects PMs and admins)
- ✅ Uses service role key to bypass RLS
- ✅ Validates input data types

## Error Codes

- `401`: Missing or invalid authentication token
- `403`: User is not a tenant or technician
- `404`: User not found in database
- `400`: Invalid request body (e.g., `is_online` is not a boolean)
- `500`: Server error or database update failed

## Testing

Test the function using curl:

```bash
curl -X POST \
  https://YOUR_PROJECT.supabase.co/functions/v1/update-online-status \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"is_online": true}'
```

## Notes

- The function automatically uses the current timestamp for `last_seen` if not provided
- The function validates that the user is a tenant or technician before allowing updates
- The function uses the service role key to bypass RLS, so it will work even if RLS policies are restrictive

