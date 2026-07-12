# Android Client - Real-Time Online Status Updates

This guide explains how to consume live/real-time online status updates in the Android client app using Supabase Realtime subscriptions.

## Overview

To get real-time updates when participants come online/offline:
1. **Initial Load**: Use Edge Function to get current status
2. **Real-Time Updates**: Subscribe to `users` table changes for participant IDs
3. **Update UI**: React to real-time events and update the UI

## Implementation

### 1. Set Up Real-Time Subscription

Subscribe to `users` table updates for specific participant IDs:

```kotlin
import io.github.jan.supabase.realtime.RealtimeChannel
import io.github.jan.supabase.realtime.postgresChanges
import io.github.jan.supabase.realtime.realtime
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow

class ChatViewModel : ViewModel() {
    private val _participants = MutableStateFlow<List<Participant>>(emptyList())
    val participants: StateFlow<List<Participant>> = _participants.asStateFlow()
    
    private var onlineStatusChannel: RealtimeChannel? = null
    
    /**
     * Subscribe to real-time online status updates for participants
     */
    fun subscribeToOnlineStatus(participantIds: List<String>) {
        // Unsubscribe from previous channel if exists
        onlineStatusChannel?.unsubscribe()
        
        if (participantIds.isEmpty()) return
        
        // Create a unique channel name
        val channelName = "chat-online-status-${UUID.randomUUID()}"
        
        onlineStatusChannel = supabaseClient
            .realtime
            .channel(channelName)
            .also { channel ->
                // Subscribe to updates for each participant
                participantIds.forEach { userId ->
                    channel.on(
                        postgresChanges(
                            schema = "public",
                            table = "users",
                            filter = "id=eq.$userId"
                        )
                    ) { change ->
                        handleOnlineStatusUpdate(change)
                    }
                }
                
                // Subscribe to the channel
                channel.subscribe()
            }
    }
    
    /**
     * Handle real-time online status updates
     */
    private fun handleOnlineStatusUpdate(change: PostgresChange<Map<String, Any>>) {
        when (change) {
            is PostgresChange.Update -> {
                val updatedUser = change.newRecord
                val userId = updatedUser["id"] as? String ?: return
                val isOnline = updatedUser["is_online"] as? Boolean ?: false
                val lastSeen = updatedUser["last_seen"] as? String
                
                // Update participant status in state
                _participants.value = _participants.value.map { participant ->
                    if (participant.userId == userId) {
                        participant.copy(
                            isOnline = isOnline,
                            lastSeen = lastSeen
                        )
                    } else {
                        participant
                    }
                }
                
                println("✅ Online status updated: $userId -> isOnline=$isOnline")
            }
            else -> {
                // Ignore INSERT/DELETE events
            }
        }
    }
    
    /**
     * Unsubscribe from real-time updates
     */
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

### 2. Complete Chat Screen Implementation

```kotlin
@Composable
fun ChatScreen(
    conversationId: String,
    currentUserId: String,
    viewModel: ChatViewModel = hiltViewModel()
) {
    val participants by viewModel.participants.collectAsState()
    
    // Load initial participants and subscribe to real-time updates
    LaunchedEffect(conversationId) {
        try {
            // Step 1: Fetch initial status using Edge Function
            val initialParticipants = fetchParticipantsOnlineStatus(conversationId)
            viewModel.updateParticipants(initialParticipants)
            
            // Step 2: Subscribe to real-time updates
            val participantIds = initialParticipants.map { it.userId }
            viewModel.subscribeToOnlineStatus(participantIds)
            
        } catch (e: Exception) {
            println("❌ Error loading participants: ${e.message}")
        }
    }
    
    // Cleanup on dispose
    DisposableEffect(conversationId) {
        onDispose {
            viewModel.unsubscribeFromOnlineStatus()
        }
    }
    
    Column {
        // Chat header with real-time online status
        ChatHeader(
            participants = participants,
            currentUserId = currentUserId
        )
        
        // Messages list
        MessagesList(conversationId = conversationId)
    }
}
```

### 3. Alternative: Simpler Single-Channel Approach

If subscribing to multiple user IDs is complex, you can subscribe to all user updates and filter:

```kotlin
fun subscribeToOnlineStatus(conversationId: String) {
    onlineStatusChannel?.unsubscribe()
    
    val channelName = "chat-status-$conversationId"
    
    onlineStatusChannel = supabaseClient
        .realtime
        .channel(channelName)
        .on(
            postgresChanges(
                schema = "public",
                table = "users",
                filter = null // Listen to all user updates
            )
        ) { change ->
            when (change) {
                is PostgresChange.Update -> {
                    val userId = change.newRecord["id"] as? String ?: return@on
                    
                    // Only process if this user is a participant
                    val participant = _participants.value.find { it.userId == userId }
                    if (participant != null) {
                        handleOnlineStatusUpdate(change)
                    }
                }
                else -> {}
            }
        }
        .subscribe()
}
```

### 4. Using Flow for Reactive Updates

You can also use Kotlin Flow to react to status changes:

```kotlin
class ChatViewModel : ViewModel() {
    private val _onlineStatusUpdates = MutableStateFlow<Map<String, OnlineStatus>>(emptyMap())
    val onlineStatusUpdates: StateFlow<Map<String, OnlineStatus>> = _onlineStatusUpdates.asStateFlow()
    
    fun subscribeToOnlineStatus(participantIds: List<String>) {
        onlineStatusChannel = supabaseClient
            .realtime
            .channel("chat-status-${UUID.randomUUID()}")
            .also { channel ->
                participantIds.forEach { userId ->
                    channel.on(
                        postgresChanges(
                            schema = "public",
                            table = "users",
                            filter = "id=eq.$userId"
                        )
                    ) { change ->
                        if (change is PostgresChange.Update) {
                            val updatedUser = change.newRecord
                            val isOnline = updatedUser["is_online"] as? Boolean ?: false
                            val lastSeen = updatedUser["last_seen"] as? String
                            
                            _onlineStatusUpdates.value = _onlineStatusUpdates.value.toMutableMap().apply {
                                put(userId, OnlineStatus(isOnline, lastSeen))
                            }
                        }
                    }
                }
                channel.subscribe()
            }
    }
}

data class OnlineStatus(
    val isOnline: Boolean,
    val lastSeen: String?
)
```

Then in your Composable:

```kotlin
@Composable
fun ChatHeader(
    participants: List<Participant>,
    currentUserId: String,
    viewModel: ChatViewModel
) {
    val statusUpdates by viewModel.onlineStatusUpdates.collectAsState()
    
    participants.forEach { participant ->
        val status = statusUpdates[participant.userId]
        val isOnline = status?.isOnline ?: participant.isOnline
        val lastSeen = status?.lastSeen ?: participant.lastSeen
        
        // Display with real-time status
    }
}
```

## Required Dependencies

Add to your `build.gradle.kts`:

```kotlin
dependencies {
    // Supabase Realtime
    implementation("io.github.jan-tennert.supabase:realtime-kt:2.0.0")
    
    // Or if using the full Supabase client:
    implementation("io.github.jan-tennert.supabase:postgrest-kt:2.0.0")
    implementation("io.github.jan-tennert.supabase:realtime-kt:2.0.0")
}
```

## Connection Status Handling

Handle connection status changes:

```kotlin
fun subscribeToOnlineStatus(participantIds: List<String>) {
    onlineStatusChannel = supabaseClient
        .realtime
        .channel("chat-status-${UUID.randomUUID()}")
        .also { channel ->
            // Subscribe to connection status
            channel.on(RealtimeChannelEvent.SUBSCRIBE) {
                println("✅ Subscribed to online status updates")
            }
            
            channel.on(RealtimeChannelEvent.UNSUBSCRIBE) {
                println("⚠️ Unsubscribed from online status updates")
            }
            
            channel.on(RealtimeChannelEvent.ERROR) { error ->
                println("❌ Realtime error: ${error.message}")
                // Optionally retry subscription
            }
            
            // Subscribe to user updates
            participantIds.forEach { userId ->
                channel.on(
                    postgresChanges(
                        schema = "public",
                        table = "users",
                        filter = "id=eq.$userId"
                    )
                ) { change ->
                    handleOnlineStatusUpdate(change)
                }
            }
            
            channel.subscribe()
        }
}
```

## Error Handling and Retry Logic

Add retry logic for failed subscriptions:

```kotlin
private var retryCount = 0
private val maxRetries = 3

fun subscribeToOnlineStatus(participantIds: List<String>) {
    try {
        onlineStatusChannel = supabaseClient
            .realtime
            .channel("chat-status-${UUID.randomUUID()}")
            .also { channel ->
                channel.on(RealtimeChannelEvent.ERROR) { error ->
                    println("❌ Realtime error: ${error.message}")
                    if (retryCount < maxRetries) {
                        retryCount++
                        delay(1000 * retryCount) // Exponential backoff
                        subscribeToOnlineStatus(participantIds) // Retry
                    }
                }
                
                participantIds.forEach { userId ->
                    channel.on(
                        postgresChanges(
                            schema = "public",
                            table = "users",
                            filter = "id=eq.$userId"
                        )
                    ) { change ->
                        handleOnlineStatusUpdate(change)
                        retryCount = 0 // Reset on success
                    }
                }
                
                channel.subscribe()
            }
    } catch (e: Exception) {
        println("❌ Failed to subscribe: ${e.message}")
        // Fallback to polling if real-time fails
        startStatusPolling(participantIds)
    }
}
```

## Polling Fallback

If real-time subscriptions fail, fall back to polling:

```kotlin
private var pollingJob: Job? = null

fun startStatusPolling(participantIds: List<String>) {
    pollingJob?.cancel()
    
    pollingJob = viewModelScope.launch {
        while (true) {
            delay(10_000) // Poll every 10 seconds
            
            try {
                // Fetch status using Edge Function
                val currentParticipants = fetchParticipantsOnlineStatus(conversationId)
                viewModel.updateParticipants(currentParticipants)
            } catch (e: Exception) {
                println("❌ Polling error: ${e.message}")
            }
        }
    }
}

fun stopStatusPolling() {
    pollingJob?.cancel()
    pollingJob = null
}
```

## Complete Example: ViewModel

```kotlin
class ChatViewModel : ViewModel() {
    private val _participants = MutableStateFlow<List<Participant>>(emptyList())
    val participants: StateFlow<List<Participant>> = _participants.asStateFlow()
    
    private var onlineStatusChannel: RealtimeChannel? = null
    private var pollingJob: Job? = null
    
    /**
     * Initialize chat with participants and real-time subscriptions
     */
    suspend fun initializeChat(conversationId: String) {
        try {
            // 1. Fetch initial status
            val initialParticipants = fetchParticipantsOnlineStatus(conversationId)
            _participants.value = initialParticipants
            
            // 2. Subscribe to real-time updates
            val participantIds = initialParticipants.map { it.userId }
            subscribeToOnlineStatus(participantIds)
            
        } catch (e: Exception) {
            println("❌ Error initializing chat: ${e.message}")
            // Fallback to polling
            val participantIds = _participants.value.map { it.userId }
            startStatusPolling(conversationId)
        }
    }
    
    private fun subscribeToOnlineStatus(participantIds: List<String>) {
        onlineStatusChannel?.unsubscribe()
        pollingJob?.cancel() // Stop polling if real-time works
        
        if (participantIds.isEmpty()) return
        
        val channelName = "chat-status-${UUID.randomUUID()}"
        
        onlineStatusChannel = supabaseClient
            .realtime
            .channel(channelName)
            .on(RealtimeChannelEvent.SUBSCRIBE) {
                println("✅ Subscribed to online status")
            }
            .on(RealtimeChannelEvent.ERROR) { error ->
                println("❌ Realtime error: ${error.message}")
                // Fallback to polling
                startStatusPolling(participantIds)
            }
            .also { channel ->
                participantIds.forEach { userId ->
                    channel.on(
                        postgresChanges(
                            schema = "public",
                            table = "users",
                            filter = "id=eq.$userId"
                        )
                    ) { change ->
                        if (change is PostgresChange.Update) {
                            updateParticipantStatus(change.newRecord)
                        }
                    }
                }
                channel.subscribe()
            }
    }
    
    private fun updateParticipantStatus(updatedUser: Map<String, Any>) {
        val userId = updatedUser["id"] as? String ?: return
        val isOnline = updatedUser["is_online"] as? Boolean ?: false
        val lastSeen = updatedUser["last_seen"] as? String
        
        _participants.value = _participants.value.map { participant ->
            if (participant.userId == userId) {
                participant.copy(
                    isOnline = isOnline,
                    lastSeen = lastSeen
                )
            } else {
                participant
            }
        }
    }
    
    private fun startStatusPolling(conversationId: String) {
        pollingJob = viewModelScope.launch {
            while (true) {
                delay(10_000)
                try {
                    val currentParticipants = fetchParticipantsOnlineStatus(conversationId)
                    _participants.value = currentParticipants
                } catch (e: Exception) {
                    println("❌ Polling error: ${e.message}")
                }
            }
        }
    }
    
    fun cleanup() {
        onlineStatusChannel?.unsubscribe()
        pollingJob?.cancel()
    }
    
    override fun onCleared() {
        super.onCleared()
        cleanup()
    }
}
```

## Summary

To consume live online status updates:

1. ✅ **Initial Load**: Use `get-participants-online-status` Edge Function
2. ✅ **Real-Time**: Subscribe to `users` table updates for participant IDs
3. ✅ **Update UI**: React to real-time events and update StateFlow/State
4. ✅ **Error Handling**: Fallback to polling if real-time fails
5. ✅ **Cleanup**: Unsubscribe when leaving chat screen

This provides instant updates when participants come online/offline without polling.


