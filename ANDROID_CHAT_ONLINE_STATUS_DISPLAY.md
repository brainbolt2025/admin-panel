# Android Client - Displaying Online Status in Chat

This guide explains how tenants and technicians can see the online status of the person they're chatting with in the chat interface.

## Overview

When a user opens a chat conversation, they should see:
- **Green dot** = Other participant is online
- **Gray dot** = Other participant is offline (with "Last seen: X minutes ago")

The status updates in real-time as participants come online/offline.

## Why Use an Edge Function?

We use the `get-participants-online-status` Edge Function because:
- ✅ Bypasses RLS policies that may block reading other users' online status
- ✅ Ensures users can only see status of participants in their conversations (security)
- ✅ Centralized validation and error handling
- ✅ More reliable than direct database queries

## Implementation Steps

### 1. Fetch Participant Online Status When Loading Conversation

Use the Edge Function to fetch participants' online status:

```kotlin
suspend fun fetchConversationParticipants(conversationId: String): List<Participant> {
    val accessToken = supabaseClient.auth.currentAccessTokenOrNull()
        ?: throw Exception("User not authenticated")
    
    val response = httpClient.post("https://YOUR_PROJECT.supabase.co/functions/v1/get-participants-online-status") {
        header("Authorization", "Bearer $accessToken")
        header("Content-Type", "application/json")
        setBody(Json.encodeToString(mapOf(
            "conversation_id" to conversationId
        )))
    }
    
    if (!response.status.isSuccess()) {
        throw Exception("Failed to fetch participants: ${response.status}")
    }
    
    val result = response.body<ParticipantsStatusResponse>()
    return result.data.participants
}

data class ParticipantsStatusResponse(
    val success: Boolean,
    val data: ParticipantsData
)

data class ParticipantsData(
    @SerialName("conversation_id") val conversationId: String,
    val participants: List<Participant>
)

data class Participant(
    @SerialName("user_id") val userId: String,
    val name: String,
    val role: String,
    @SerialName("is_online") val isOnline: Boolean?,  // null for PMs
    @SerialName("last_seen") val lastSeen: String?    // null for PMs
)
```

### 2. Subscribe to Real-Time Online Status Updates

Subscribe to changes in the `users` table for the participants in the current conversation. See `ANDROID_REALTIME_ONLINE_STATUS.md` for detailed implementation.

**Quick Example:**

```kotlin
class ChatViewModel : ViewModel() {
    private var onlineStatusChannel: RealtimeChannel? = null
    
    fun subscribeToOnlineStatus(participantIds: List<String>) {
        // Unsubscribe from previous channel if exists
        onlineStatusChannel?.unsubscribe()
        
        if (participantIds.isEmpty()) return
        
        onlineStatusChannel = supabaseClient
            .realtime
            .channel("chat-online-status-${UUID.randomUUID()}")
            .also { channel ->
                // Subscribe to updates for each participant
                participantIds.forEach { userId ->
                    channel.on(
                        REALTIME_POSTGRES_CHANGES,
                        RealtimePostgresChangesFilter(
                            schema = "public",
                            table = "users",
                            event = PostgresChangeEvent.UPDATE,
                            filter = "id=eq.$userId"
                        )
                    ) { payload ->
                        handleOnlineStatusUpdate(payload)
                    }
                }
                channel.subscribe()
            }
    }
    
    private fun handleOnlineStatusUpdate(payload: RealtimePostgresInsertPayload<Map<String, Any>>) {
        val updatedUser = payload.newRecord
        
        val userId = updatedUser["id"] as? String ?: return
        val isOnline = updatedUser["is_online"] as? Boolean ?: false
        val lastSeen = updatedUser["last_seen"] as? String
        
        // Update participant status in your UI state
        updateParticipantStatus(userId, isOnline, lastSeen)
    }
    
    fun unsubscribeFromOnlineStatus() {
        onlineStatusChannel?.unsubscribe()
        onlineStatusChannel = null
    }
    
    override fun onCleared() {
        super.onCleared()
        unsubscribeFromOnlineStatus()
    }
}
```

### 3. Display Online Status in Chat UI

Show online status indicators in your chat header or participant list:

```kotlin
@Composable
fun ChatHeader(
    participants: List<Participant>,
    currentUserId: String
) {
    Column {
        // Chat title
        Text(
            text = "Chat",
            style = MaterialTheme.typography.h5
        )
        
        // Participants with online status
        Row(
            modifier = Modifier.padding(top = 8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            participants
                .filter { it.userId != currentUserId } // Don't show current user
                .forEach { participant ->
                          // Only show status for tenants and technicians (isOnline will be null for PMs)
                          if (participant.isOnline != null) {
                        Row(
                            modifier = Modifier.padding(end = 16.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = participant.name,
                                style = MaterialTheme.typography.body2,
                                color = Color.Gray
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            
                            // Online status indicator (isOnline is not null here)
                            val isOnline = participant.isOnline ?: false
                            Box(
                                modifier = Modifier
                                    .size(8.dp)
                                    .background(
                                        color = if (isOnline) Color.Green else Color.Gray,
                                        shape = CircleShape
                                    )
                            )
                            
                            // Last seen text for offline users
                            if (!isOnline && participant.lastSeen != null) {
                                Spacer(modifier = Modifier.width(4.dp))
                                Text(
                                    text = "• ${formatLastSeen(participant.lastSeen)}",
                                    style = MaterialTheme.typography.caption,
                                    color = Color.Gray
                                )
                            }
                        }
                    } else {
                        // For PMs, just show name without status
                        Text(
                            text = participant.name,
                            style = MaterialTheme.typography.body2,
                            color = Color.Gray,
                            modifier = Modifier.padding(end = 16.dp)
                        )
                    }
                }
        }
    }
}

fun formatLastSeen(lastSeen: String): String {
    val lastSeenTime = Instant.parse(lastSeen)
    val now = Instant.now()
    val diffSeconds = now.epochSecond - lastSeenTime.epochSecond
    val diffMinutes = diffSeconds / 60
    
    return when {
        diffMinutes < 1 -> "Just now"
        diffMinutes < 60 -> "${diffMinutes}m ago"
        diffMinutes < 1440 -> "${diffMinutes / 60}h ago"
        else -> {
            val days = diffMinutes / 1440
            "${days}d ago"
        }
    }
}
```

### 4. Complete Chat Screen Example

```kotlin
@Composable
fun ChatScreen(
    conversationId: String,
    currentUserId: String,
    viewModel: ChatViewModel = hiltViewModel()
) {
    val participants by viewModel.participants.collectAsState()
    
    // Load participants and subscribe to status updates
    LaunchedEffect(conversationId) {
        val loadedParticipants = viewModel.fetchConversationParticipants(conversationId)
        viewModel.updateParticipants(loadedParticipants)
        
        // Subscribe to real-time updates
        val participantIds = loadedParticipants.map { it.userId }
        viewModel.subscribeToOnlineStatus(participantIds)
    }
    
    // Cleanup on dispose
    DisposableEffect(conversationId) {
        onDispose {
            viewModel.unsubscribeFromOnlineStatus()
        }
    }
    
    Column {
        // Chat header with online status
        ChatHeader(
            participants = participants,
            currentUserId = currentUserId
        )
        
        // Messages list
        // ... your messages UI
    }
}
```

## Alternative: Simpler Real-Time Subscription

If the above approach is complex, you can use a simpler pattern that subscribes to all user updates in the conversation:

```kotlin
fun subscribeToOnlineStatus(conversationId: String) {
    onlineStatusChannel = supabaseClient
        .realtime
        .channel("chat-status-$conversationId")
        .on(
            REALTIME_POSTGRES_CHANGES,
            RealtimePostgresChangesFilter(
                schema = "public",
                table = "users",
                event = PostgresChangeEvent.UPDATE
            )
        ) { payload ->
            // Check if this user is a participant in the current conversation
            val userId = payload.newRecord["id"] as? String ?: return@on
            if (participants.any { it.userId == userId }) {
                handleOnlineStatusUpdate(payload)
            }
        }
        .subscribe()
}
```

## Visual Examples

### Chat Header Layout

```
┌─────────────────────────────────┐
│ Chat                            │
│                                 │
│ John Doe 🟢  Jane Smith ⚪ 2m ago│
└─────────────────────────────────┘
```

### Participant List (if you have one)

```
Participants:
  • John Doe 🟢 Online
  • Jane Smith ⚪ Last seen 5m ago
  • Property Manager (no status shown)
```

## Important Notes

1. **Only Show Status for Tenants/Technicians**: PMs don't have online status, so don't show indicators for them.

2. **Filter Current User**: Don't show online status for the current user (they know they're online).

3. **Real-Time Updates**: The status should update automatically when participants come online/offline.

4. **Performance**: Only subscribe to status updates for participants in the current conversation, not all users.

5. **Cleanup**: Always unsubscribe from real-time channels when leaving the chat screen to prevent memory leaks.

6. **Error Handling**: Handle cases where:
   - Real-time connection fails (fallback to periodic polling)
   - Participant data is missing
   - Network is unavailable

## Polling Fallback (Optional)

If real-time subscriptions are unreliable, you can poll for status updates as a fallback:

```kotlin
fun startStatusPolling(participantIds: List<String>) {
    viewModelScope.launch {
        while (true) {
            delay(10_000) // Poll every 10 seconds
            
            participantIds.forEach { userId ->
                val user = supabaseClient
                    .from("users")
                    .select("is_online, last_seen")
                    .eq("id", userId)
                    .single()
                    .decodeSingle<UserStatus>()
                
                updateParticipantStatus(userId, user.isOnline, user.lastSeen)
            }
        }
    }
}
```

## Summary

To display online status in chat:

1. ✅ Fetch participant data with `is_online` and `last_seen` when loading conversation
2. ✅ Subscribe to real-time updates on the `users` table for participants
3. ✅ Display green dot for online, gray dot for offline
4. ✅ Show "Last seen: X ago" for offline users
5. ✅ Only show status for tenants/technicians (not PMs)
6. ✅ Update UI when real-time events are received
7. ✅ Clean up subscriptions when leaving chat

This provides a real-time, responsive experience where users can see when their chat partners are online or offline.

