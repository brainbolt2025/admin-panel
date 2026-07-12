# Get Participants Online Status Edge Function

This Supabase Edge Function allows users to fetch the online status of participants in a conversation, bypassing RLS policies while ensuring security.

## Features

- ✅ Fetches online status (`is_online`, `last_seen`) for conversation participants
- ✅ Bypasses RLS using service role key
- ✅ Validates user authentication via JWT token
- ✅ Ensures user is a participant in the conversation (security)
- ✅ Only returns online status for tenants and technicians (PMs don't have status)
- ✅ Filters out online status for non-tenant/technician roles

## Deployment

```bash
supabase functions deploy get-participants-online-status
```

## Usage

### Request

**Endpoint:** `https://YOUR_PROJECT.supabase.co/functions/v1/get-participants-online-status`

**Method:** `POST`

**Headers:**
```
Authorization: Bearer <USER_ACCESS_TOKEN>
Content-Type: application/json
```

**Body:**
```json
{
  "conversation_id": "uuid-of-conversation"
}
```

### Response

**Success (200):**
```json
{
  "success": true,
  "data": {
    "conversation_id": "uuid-here",
    "participants": [
      {
        "user_id": "uuid-1",
        "name": "John Doe",
        "role": "tenant",
        "is_online": true,
        "last_seen": "2024-01-15T10:30:00.000Z"
      },
      {
        "user_id": "uuid-2",
        "name": "Jane Smith",
        "role": "technician",
        "is_online": false,
        "last_seen": "2024-01-15T10:25:00.000Z"
      },
      {
        "user_id": "uuid-3",
        "name": "Property Manager",
        "role": "pm",
        "is_online": null,
        "last_seen": null
      }
    ]
  }
}
```

**Error (400/401/403/500):**
```json
{
  "success": false,
  "error": "Error message here"
}
```

## Android Client Implementation

### 1. Fetch Participants with Online Status

```kotlin
suspend fun getParticipantsOnlineStatus(conversationId: String): List<Participant> {
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
    val conversation_id: String,
    val participants: List<Participant>
)

data class Participant(
    @SerialName("user_id") val userId: String,
    val name: String,
    val role: String,
    @SerialName("is_online") val isOnline: Boolean?,
    @SerialName("last_seen") val lastSeen: String?
)
```

### 2. Use in Chat Screen

```kotlin
@Composable
fun ChatScreen(conversationId: String) {
    val participants = remember { mutableStateOf<List<Participant>>(emptyList()) }
    
    LaunchedEffect(conversationId) {
        try {
            val loadedParticipants = getParticipantsOnlineStatus(conversationId)
            participants.value = loadedParticipants
        } catch (e: Exception) {
            println("Error loading participants: ${e.message}")
        }
    }
    
    // Display participants with online status
    ChatHeader(participants = participants.value)
}
```

## Security Notes

- ✅ Requires valid JWT authentication token
- ✅ Only returns participants for conversations the user is part of
- ✅ Uses service role key to bypass RLS
- ✅ Validates conversation membership before returning data
- ✅ Only includes online status for tenants/technicians (PMs return null)

## Error Codes

- `401`: Missing or invalid authentication token
- `400`: Missing `conversation_id` in request body
- `403`: User is not a participant in the requested conversation
- `500`: Server error or database query failed

## Testing

Test the function using curl:

```bash
curl -X POST \
  https://YOUR_PROJECT.supabase.co/functions/v1/get-participants-online-status \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"conversation_id": "conversation-uuid-here"}'
```

## Real-Time Updates

To get real-time updates, combine this function with Supabase Realtime subscriptions:

1. **Initial Load**: Call this function to get current status
2. **Real-Time Updates**: Subscribe to `users` table changes for participant IDs

```kotlin
// After fetching initial status
val participantIds = participants.map { it.userId }

// Subscribe to real-time updates
supabaseClient
    .realtime
    .channel("chat-status")
    .on(REALTIME_POSTGRES_CHANGES, ...)
    .subscribe()
```

This gives you:
- Initial status from the Edge Function (bypasses RLS)
- Real-time updates via Realtime subscriptions (works because you're subscribed to specific user IDs)

## Notes

- The function returns `null` for `is_online` and `last_seen` for PMs and admins (they don't have online status)
- Only participants in the conversation can call this function (validated)
- The function uses service role key, so it bypasses all RLS policies


