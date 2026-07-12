# Android Client App - Online Status Implementation Guide

This guide explains how the Android client app should update the `is_online` and `last_seen` status in the database for tenants and technicians.

## Overview

The Android app needs to track when tenants and technicians are online/offline so their status can be displayed in chat conversations. This is done by calling the `update-online-status` Edge Function, which bypasses RLS policies.

## Database Schema

The `users` table has two columns for online status:
- `is_online` (BOOLEAN): `true` when user is online, `false` when offline
- `last_seen` (TIMESTAMPTZ): Last timestamp when the user was active

## Why Use an Edge Function?

We use an Edge Function (`update-online-status`) instead of direct database updates because:
- ✅ Bypasses RLS policies that may block updates
- ✅ Centralized validation and security
- ✅ Ensures only tenants and technicians can update their status
- ✅ More reliable across different network conditions

## Implementation Steps

### 1. Update Online Status When App Opens/Becomes Active

When the app starts or comes to foreground, set the user as online by calling the Edge Function:

```kotlin
// In your Application class or MainActivity onCreate/onResume
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
        } else {
            println("❌ Failed to set user online: ${response.status}")
        }
    } catch (e: Exception) {
        println("❌ Error setting user online: ${e.message}")
    }
}
```

### 2. Periodically Update `last_seen` While App is Active

Update `last_seen` every 30 seconds while the user is active:

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

### 3. Set User Offline When App Goes to Background or Closes

When the app goes to background or closes, set the user as offline:

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

### 4. Complete Implementation Example

Here's a complete example using Android lifecycle:

```kotlin
class MainActivity : AppCompatActivity() {
    private var lastSeenUpdateJob: Job? = null
    private val httpClient = HttpClient(CIO) {
        install(ContentNegotiation) {
            json()
        }
    }
    
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
        httpClient.close()
    }
    
    private suspend fun setUserOnline() {
        // Implementation from step 1
    }
    
    private fun startLastSeenUpdates() {
        // Implementation from step 2
    }
    
    private suspend fun setUserOffline() {
        // Implementation from step 3
    }
}
```

**Required Dependencies (build.gradle.kts):**
```kotlin
dependencies {
    implementation("io.ktor:ktor-client-core:2.3.5")
    implementation("io.ktor:ktor-client-cio:2.3.5")
    implementation("io.ktor:ktor-client-content-negotiation:2.3.5")
    implementation("io.ktor:ktor-serialization-kotlinx-json:2.3.5")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.6.0")
}
```

### 5. Alternative: Using LifecycleObserver

For better lifecycle management, use a `LifecycleObserver`:

```kotlin
class OnlineStatusManager(
    private val supabaseClient: SupabaseClient
) : LifecycleObserver {
    
    private var lastSeenUpdateJob: Job? = null
    
    @OnLifecycleEvent(Lifecycle.Event.ON_START)
    fun onStart() {
        setUserOnline()
        startLastSeenUpdates()
    }
    
    @OnLifecycleEvent(Lifecycle.Event.ON_STOP)
    fun onStop() {
        setUserOffline()
    }
    
    // Implement setUserOnline, startLastSeenUpdates, setUserOffline methods
}
```

Then register it in your Activity/Fragment:

```kotlin
lifecycle.addObserver(OnlineStatusManager(supabaseClient))
```

## Important Notes

1. **Edge Function Endpoint**: Replace `YOUR_PROJECT` in the URL with your actual Supabase project reference (e.g., `goljbyvrnktxwtnjomaq`).

2. **Authentication**: The Edge Function requires a valid JWT access token in the Authorization header. Get it from `supabaseClient.auth.currentAccessTokenOrNull()`.

3. **Only for Tenants and Technicians**: The Edge Function automatically validates that the user is a tenant or technician. PMs and admins will receive a 403 error.

4. **Error Handling**: Wrap all HTTP requests in try-catch blocks and handle errors gracefully. Don't let online status updates break your app flow.

5. **Network Failures**: If the network request fails, you can retry, but don't block the UI. The status will update on the next successful request.

6. **User Authentication**: Always check if the user is authenticated and has a valid access token before calling the Edge Function.

7. **Timing**: 
   - Update immediately when app becomes active
   - Update `last_seen` every 30 seconds while active
   - Update to offline immediately when app goes to background

8. **Logout**: Make sure to set `is_online = false` when the user logs out.

## Testing

1. **Test Online Status**: 
   - Open app → Check database: `is_online` should be `true`
   - Wait 30 seconds → Check database: `last_seen` should update
   - Close/minimize app → Check database: `is_online` should be `false`

2. **Test Real-time Updates**:
   - User A opens app (should show online)
   - User B viewing chat should see User A's status change in real-time via Supabase Realtime subscriptions

3. **Test Role Filtering**:
   - Verify that PM users don't update their online status
   - Only tenants and technicians should have their status tracked

## Database Query to Verify

You can verify online status in Supabase SQL Editor:

```sql
-- Check online tenants and technicians
SELECT id, name, email, role, is_online, last_seen
FROM users
WHERE role IN ('tenant', 'technician')
ORDER BY is_online DESC, last_seen DESC;
```

## Real-time Subscription (For Chat UI)

In your Android chat UI, subscribe to online status changes:

```kotlin
supabaseClient
    .realtime
    .channel("online-status")
    .on(
        REALTIME_POSTGRES_CHANGES,
        RealtimePostgresChangesFilter(
            schema = "public",
            table = "users",
            event = PostgresChangeEvent.UPDATE
        )
    ) {
        val updatedUser = it.decodeRecord<User>()
        // Update UI to show online/offline status
        updateParticipantOnlineStatus(updatedUser.id, updatedUser.isOnline)
    }
    .subscribe()
```

This allows the chat UI to update in real-time when participants come online or go offline.

