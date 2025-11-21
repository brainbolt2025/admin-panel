# Create Conversation Participants Edge Function

This Supabase Edge Function creates a conversation for a work order and automatically adds participants (tenant and technician only).

## Features

- Creates a conversation linked to a work order
- Automatically adds tenant and technician as participants
- Validates user permissions (only tenant or technician can create conversations)
- Prevents duplicate conversations (returns existing conversation if one exists)
- Handles authentication and authorization
- Returns conversation ID for immediate use

## Usage

### From Mobile App (Kotlin/Android)

```kotlin
val response = supabase.functions
    .invoke("create-conversation-participants") {
        body = mapOf("work_order_id" to workOrderId)
    }

val result = response.decode<CreateConversationResponse>()
val conversationId = result.conversation_id
```

### From Web App (React/TypeScript)

```typescript
const { data, error } = await supabase.functions.invoke('create-conversation-participants', {
  body: { work_order_id: workOrderId }
})

if (data) {
  const conversationId = data.conversation_id
}
```

### Direct HTTP Request

```bash
curl -X POST https://your-project.supabase.co/functions/v1/create-conversation-participants \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"work_order_id": "uuid-here"}'
```

## Request

**Method:** `POST`

**Headers:**
- `Authorization: Bearer <access_token>` (required)
- `Content-Type: application/json`

**Body:**
```json
{
  "work_order_id": "uuid-of-work-order"
}
```

## Response

**Success (200):**
```json
{
  "code": 200,
  "message": "Conversation created successfully",
  "conversation_id": "uuid-of-conversation",
  "work_order_id": "uuid-of-work-order"
}
```

**Error (400):**
```json
{
  "code": 400,
  "message": "Missing required field: work_order_id"
}
```

**Error (401):**
```json
{
  "code": 401,
  "message": "Invalid or expired authentication token. Please log in again."
}
```

**Error (403):**
```json
{
  "code": 403,
  "message": "Permission denied. You can only create conversations for work orders you are related to."
}
```

**Error (404):**
```json
{
  "code": 404,
  "message": "Work order not found or you do not have access to it."
}
```

**Error (500):**
```json
{
  "code": 500,
  "message": "Failed to create conversation. Please try again.",
  "error": "Detailed error message"
}
```

## Permission Requirements

Users can only create conversations for work orders they are related to:

- **Tenants**: Can create conversations for work orders where they are the tenant
- **Technicians**: Can create conversations for work orders assigned to them

**Note:** Property Managers (PMs) cannot create conversations. Only tenants and technicians participate in conversations.

## Database Function

This Edge Function calls the PostgreSQL function `create_conversation_participants(p_work_order_id UUID)`, which:

1. Checks if conversation already exists (returns existing ID if found)
2. Creates a new conversation if it doesn't exist
3. Automatically adds tenant, technician, and PM as participants
4. Returns the conversation ID

The database function is `SECURITY DEFINER`, which allows it to bypass RLS policies to create conversations and participants for tenant and technician users.

## Deployment

Deploy this function using the Supabase CLI:

```bash
supabase functions deploy create-conversation-participants
```

Or deploy all functions:

```bash
supabase functions deploy
```

## Environment Variables

No additional environment variables are required. The function uses:

- `SUPABASE_URL` (automatically set by Supabase)
- `SUPABASE_ANON_KEY` (automatically set by Supabase)

## Error Handling

The function provides detailed error messages for common scenarios:

- Missing or invalid authentication token
- Missing or invalid work_order_id
- Work order not found or inaccessible
- Permission denied (user not related to work order)
- Duplicate conversation (returns existing conversation ID)
- Database errors

## Notes

- If a conversation already exists for the work order, the function returns the existing conversation ID (does not create a duplicate)
- The conversation is automatically linked to the work order via `work_order_id`
- Participants (tenant and technician) are automatically added to the conversation
- PMs are not added as participants (only tenants and technicians can chat)
- The function validates permissions before creating the conversation

