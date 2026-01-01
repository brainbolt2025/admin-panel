# Get Unread Messages Count - API Reference

## Endpoint

```
GET /functions/v1/get-unread-messages-count
```

## Authentication

Requires authentication via Bearer token in the Authorization header.

## Request Headers

```
Authorization: Bearer <access_token>
apikey: <supabase_anon_key>
```

## Request Body

None. This is a GET request with no body.

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
        "id": "conversation-uuid-1",
        "work_order_id": "work-order-uuid-1",
        "unread_count": 3,
        "last_message_at": "2024-01-15T10:30:00Z",
        "last_message_preview": "Hello, this is the message preview..."
      },
      {
        "id": "conversation-uuid-2",
        "work_order_id": "work-order-uuid-2",
        "unread_count": 2,
        "last_message_at": "2024-01-15T09:15:00Z",
        "last_message_preview": "Another message preview..."
      }
    ]
  }
}
```

### No Unread Messages (200 OK)

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

#### 401 Unauthorized

```json
{
  "code": 401,
  "message": "Invalid or expired token"
}
```

#### 500 Internal Server Error

```json
{
  "code": 500,
  "message": "Internal server error",
  "error": "Error details..."
}
```

## Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | Always `true` on success |
| `data.unread_count` | integer | Total number of unread messages |
| `data.has_unread` | boolean | `true` if there are any unread messages |
| `data.conversations_with_unread` | array | List of conversations with unread messages |
| `data.conversations_with_unread[].id` | string | Conversation ID |
| `data.conversations_with_unread[].work_order_id` | string | Associated work order ID |
| `data.conversations_with_unread[].unread_count` | integer | Number of unread messages in this conversation |
| `data.conversations_with_unread[].last_message_at` | string (ISO 8601) | Timestamp of last message in conversation |
| `data.conversations_with_unread[].last_message_preview` | string | Preview text of last message (first 100 chars) |

## Example cURL Request

```bash
curl -X GET \
  'https://YOUR_PROJECT.supabase.co/functions/v1/get-unread-messages-count' \
  -H 'Authorization: Bearer YOUR_ACCESS_TOKEN' \
  -H 'apikey: YOUR_ANON_KEY'
```

## Example JavaScript/TypeScript Request

```typescript
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
console.log('Unread count:', data.data.unread_count);
```


