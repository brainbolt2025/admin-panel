# Android App Integration: Unread Messages Count

This guide shows how to integrate the `get-unread-messages-count` Edge Function into your Android app to display unread message badges and indicators.

## Overview

The function returns:
- Total unread message count
- Boolean flag indicating if there are unread messages
- Per-conversation unread counts with details

## 1. Create Data Models

First, create Kotlin data classes to match the API response:

```kotlin
// UnreadMessagesResponse.kt
data class UnreadMessagesResponse(
    val success: Boolean,
    val data: UnreadMessagesData
)

data class UnreadMessagesData(
    val unread_count: Int,
    val has_unread: Boolean,
    val conversations_with_unread: List<ConversationUnread>
)

data class ConversationUnread(
    val id: String,
    val work_order_id: String,
    val unread_count: Int,
    val last_message_at: String?,
    val last_message_preview: String?
)
```

## 2. Create Repository/API Service

Add a method to your existing repository or API service:

```kotlin
// MessageRepository.kt or ApiService.kt

import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.Response

interface MessageApiService {
    @GET("functions/v1/get-unread-messages-count")
    suspend fun getUnreadMessagesCount(
        @Header("Authorization") authToken: String,
        @Header("apikey") apiKey: String
    ): Response<UnreadMessagesResponse>
}

// Or if using Supabase client directly:
class MessageRepository(private val supabaseClient: SupabaseClient) {
    
    suspend fun getUnreadMessagesCount(): UnreadMessagesData? {
        return try {
            val response = supabaseClient.functions
                .invoke("get-unread-messages-count")
                .decode<UnreadMessagesResponse>()
            
            if (response.success) {
                response.data
            } else {
                null
            }
        } catch (e: Exception) {
            Log.e("MessageRepository", "Error fetching unread messages count", e)
            null
        }
    }
}
```

## 3. Create ViewModel (Optional but Recommended)

```kotlin
// UnreadMessagesViewModel.kt

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class UnreadMessagesViewModel(
    private val messageRepository: MessageRepository
) : ViewModel() {
    
    private val _unreadCount = MutableStateFlow<Int>(0)
    val unreadCount: StateFlow<Int> = _unreadCount.asStateFlow()
    
    private val _hasUnread = MutableStateFlow<Boolean>(false)
    val hasUnread: StateFlow<Boolean> = _hasUnread.asStateFlow()
    
    private val _conversationsWithUnread = MutableStateFlow<List<ConversationUnread>>(emptyList())
    val conversationsWithUnread: StateFlow<List<ConversationUnread>> = 
        _conversationsWithUnread.asStateFlow()
    
    private val _isLoading = MutableStateFlow<Boolean>(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()
    
    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()
    
    init {
        // Start polling for unread messages
        startPolling()
    }
    
    fun refreshUnreadCount() {
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            
            try {
                val data = messageRepository.getUnreadMessagesCount()
                
                if (data != null) {
                    _unreadCount.value = data.unread_count
                    _hasUnread.value = data.has_unread
                    _conversationsWithUnread.value = data.conversations_with_unread
                } else {
                    _error.value = "Failed to fetch unread messages"
                }
            } catch (e: Exception) {
                _error.value = e.message
                Log.e("UnreadMessagesViewModel", "Error refreshing unread count", e)
            } finally {
                _isLoading.value = false
            }
        }
    }
    
    private fun startPolling() {
        viewModelScope.launch {
            // Poll every 30 seconds
            while (true) {
                refreshUnreadCount()
                kotlinx.coroutines.delay(30000) // 30 seconds
            }
        }
    }
    
    fun stopPolling() {
        // Cancel coroutines when ViewModel is cleared
        viewModelScope.coroutineContext.cancel()
    }
}
```

## 4. Update UI Components

### 4a. Add Badge to Messages Icon in Bottom Navigation

```kotlin
// MainActivity.kt or wherever you have bottom navigation

@Composable
fun MessagesIconWithBadge(
    unreadCount: Int,
    onClick: () -> Unit
) {
    Box {
        IconButton(onClick = onClick) {
            Icon(
                imageVector = Icons.Default.Message,
                contentDescription = "Messages"
            )
        }
        
        // Show badge if there are unread messages
        if (unreadCount > 0) {
            Badge(
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .offset(x = (-8).dp, y = 8.dp)
            ) {
                Text(
                    text = if (unreadCount > 99) "99+" else unreadCount.toString(),
                    style = TextStyle(fontSize = 10.sp)
                )
            }
        }
    }
}
```

### 4b. Update Conversations List to Show Unread Indicators

```kotlin
// ConversationsScreen.kt

@Composable
fun ConversationItem(
    conversation: Conversation,
    unreadCount: Int,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(16.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Conversation content
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = conversation.workOrderTitle,
                fontWeight = if (unreadCount > 0) FontWeight.Bold else FontWeight.Normal
            )
            Text(
                text = conversation.lastMessagePreview ?: "",
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                style = TextStyle(
                    fontWeight = if (unreadCount > 0) FontWeight.Medium else FontWeight.Normal
                )
            )
        }
        
        // Unread count badge
        if (unreadCount > 0) {
            Box(
                modifier = Modifier
                    .size(24.dp)
                    .background(
                        color = MaterialTheme.colorScheme.primary,
                        shape = CircleShape
                    ),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = if (unreadCount > 99) "99+" else unreadCount.toString(),
                    color = Color.White,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold
                )
            }
        }
    }
}
```

### 4c. Use ViewModel in Screen

```kotlin
// MessagesScreen.kt

@Composable
fun MessagesScreen(
    viewModel: UnreadMessagesViewModel = viewModel(),
    onConversationClick: (String) -> Unit
) {
    val unreadCount by viewModel.unreadCount.collectAsState()
    val hasUnread by viewModel.hasUnread.collectAsState()
    val conversationsWithUnread by viewModel.conversationsWithUnread.collectAsState()
    
    // Get unread count map for quick lookup
    val unreadCountMap = remember(conversationsWithUnread) {
        conversationsWithUnread.associate { it.id to it.unread_count }
    }
    
    // Your conversations list
    LazyColumn {
        items(conversations) { conversation ->
            ConversationItem(
                conversation = conversation,
                unreadCount = unreadCountMap[conversation.id] ?: 0,
                onClick = { onConversationClick(conversation.id) }
            )
        }
    }
    
    // Show badge in bottom navigation
    MessagesIconWithBadge(
        unreadCount = unreadCount,
        onClick = { /* Navigate to messages */ }
    )
}
```

## 5. Alternative: Simple Polling Implementation

If you don't want to use a ViewModel, here's a simpler approach:

```kotlin
// MainActivity.kt or Application class

class MyApplication : Application() {
    
    private var unreadMessagesJob: Job? = null
    
    fun startUnreadMessagesPolling(supabaseClient: SupabaseClient) {
        unreadMessagesJob = CoroutineScope(Dispatchers.IO).launch {
            while (isActive) {
                try {
                    val response = supabaseClient.functions
                        .invoke("get-unread-messages-count")
                        .decode<UnreadMessagesResponse>()
                    
                    if (response.success) {
                        val unreadCount = response.data.unread_count
                        
                        // Update UI on main thread
                        withContext(Dispatchers.Main) {
                            updateUnreadBadge(unreadCount)
                        }
                    }
                } catch (e: Exception) {
                    Log.e("UnreadMessages", "Error polling unread messages", e)
                }
                
                delay(30000) // Wait 30 seconds before next poll
            }
        }
    }
    
    fun stopUnreadMessagesPolling() {
        unreadMessagesJob?.cancel()
    }
    
    private fun updateUnreadBadge(count: Int) {
        // Update your badge UI component
        // This could be a LiveData, StateFlow, or direct UI update
    }
}
```

## 6. Optimize: Poll Less Frequently When App is in Background

```kotlin
class UnreadMessagesViewModel : ViewModel() {
    
    private var pollingJob: Job? = null
    
    fun startPolling() {
        pollingJob = viewModelScope.launch {
            while (true) {
                refreshUnreadCount()
                
                // Poll every 30 seconds when app is active
                // Poll every 5 minutes when app is in background
                val interval = if (isAppInForeground()) {
                    30000L // 30 seconds
                } else {
                    300000L // 5 minutes
                }
                
                delay(interval)
            }
        }
    }
    
    fun pausePolling() {
        pollingJob?.cancel()
    }
    
    fun resumePolling() {
        pausePolling()
        startPolling()
    }
}
```

## 7. Handle Real-time Updates (Optional Enhancement)

Instead of polling, you could also listen to real-time changes:

```kotlin
// Listen to message_receipts table changes
supabaseClient
    .from("message_receipts")
    .channel("unread_messages")
    .on(
        SupabaseRealtimeAction.UPDATE,
        RealtimeAction { _, payload ->
            // Refresh unread count when receipts are updated
            refreshUnreadCount()
        }
    )
    .subscribe()
```

## 8. Error Handling

Always handle network errors gracefully:

```kotlin
suspend fun getUnreadMessagesCount(): Result<UnreadMessagesData> {
    return try {
        val response = supabaseClient.functions
            .invoke("get-unread-messages-count")
            .decode<UnreadMessagesResponse>()
        
        if (response.success) {
            Result.success(response.data)
        } else {
            Result.failure(Exception("Failed to fetch unread messages"))
        }
    } catch (e: NetworkException) {
        Log.e("MessageRepository", "Network error", e)
        Result.failure(e)
    } catch (e: Exception) {
        Log.e("MessageRepository", "Unexpected error", e)
        Result.failure(e)
    }
}
```

## Testing

Test the integration:

1. **No unread messages**: Should return `unread_count: 0`, `has_unread: false`
2. **Some unread messages**: Should return correct count and conversation details
3. **Network error**: Should handle gracefully without crashing
4. **Polling**: Should update badge every 30 seconds when new messages arrive

## Best Practices

1. **Polling Interval**: Start with 30 seconds, adjust based on battery/data usage
2. **Background**: Reduce polling frequency when app is in background
3. **Error Handling**: Always handle errors gracefully, don't crash the app
4. **Caching**: Consider caching the last known count to show immediately while fetching
5. **User Experience**: Show a loading indicator briefly when refreshing

## Example Integration Flow

1. User opens app → ViewModel starts polling
2. Every 30 seconds → Fetch unread count
3. Update UI → Show badge with count
4. User opens conversation → Mark messages as read (existing Chat logic)
5. Next poll → Badge count decreases/removes

This creates a seamless experience where users always know if they have unread messages!


