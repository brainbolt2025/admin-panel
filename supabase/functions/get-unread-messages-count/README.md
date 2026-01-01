# Get Unread Messages Count Function

This Supabase Edge Function returns the count of unread messages for the authenticated user. It's designed to be called by the client app to show unread message indicators/badges.

## Features

- ✅ JWT token verification
- ✅ Returns total unread message count
- ✅ Returns unread count per conversation
- ✅ Includes conversation details (work_order_id, last_message_at, etc.)
- ✅ Lightweight and fast query

## Deployment

```bash
supabase functions deploy get-unread-messages-count
```

## Usage from Client App

```typescript
const accessToken = await supabase.auth.getSession().then(s => s.data.session?.access_token);

const response = await fetch(
  'https://YOUR_PROJECT.supabase.co/functions/v1/get-unread-messages-count',
  {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'apikey': SUPABASE_ANON_KEY
    }
  }
);

const data = await response.json();

if (data.success) {
  console.log('Unread messages:', data.data.unread_count);
  console.log('Has unread:', data.data.has_unread);
  console.log('Conversations with unread:', data.data.conversations_with_unread);
}
```

## Response

### Success Response (200 OK)

```json
{
  "success": true,
  "data": {
    "unread_count": 5,
    "has_unread": true,
    "conversations_with_unread": [
      {
        "id": "conversation-uuid",
        "work_order_id": "work-order-uuid",
        "unread_count": 3,
        "last_message_at": "2024-01-15T10:30:00Z",
        "last_message_preview": "Hello, this is the message preview..."
      },
      {
        "id": "another-conversation-uuid",
        "work_order_id": "another-work-order-uuid",
        "unread_count": 2,
        "last_message_at": "2024-01-15T09:15:00Z",
        "last_message_preview": "Another message preview..."
      }
    ]
  }
}
```

### No Unread Messages

```json
{
  "success": true,
  "data": {
    "unread_count": 0,
    "has_unread": false,
    "conversations_with_unread": []
  }
}
```

### Error Responses

- **401**: Missing or invalid token
- **500**: Internal server error

## How It Works

1. Authenticates the user from the JWT token
2. Queries `message_receipts` table for records where:
   - `user_id` = authenticated user's ID
   - `read_at` IS NULL (message hasn't been read)
3. Groups unread messages by conversation
4. Fetches conversation details for conversations with unread messages
5. Returns count and conversation details

## Integration Example

```typescript
// Check for unread messages periodically
setInterval(async () => {
  const response = await fetch('/functions/v1/get-unread-messages-count', {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });
  
  const { data } = await response.json();
  
  if (data.has_unread) {
    // Show badge on messages icon
    updateBadgeCount(data.unread_count);
  } else {
    // Hide badge
    hideBadge();
  }
}, 30000); // Check every 30 seconds
```

## Notes

- Messages are marked as read when the user views them in the chat (handled by the Chat component)
- The function uses the `message_receipts` table which is automatically populated when messages are sent
- Unread status is determined by `read_at` being NULL in the `message_receipts` table


