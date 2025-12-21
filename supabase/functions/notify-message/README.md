# Notify Message Edge Function

This Supabase Edge Function sends email notifications to recipients when they receive a message from a tenant or technician.

## Features

- ✅ Sends email notifications when messages are sent between tenants and technicians
- ✅ Fetches conversation participants to determine recipient
- ✅ Includes work order context in email
- ✅ Only sends notifications for tenant/technician conversations
- ✅ Non-blocking (frontend continues even if notification fails)

## Usage

### Request Body

```typescript
{
  conversation_id: string
  sender_id: string
  message_content: string
}
```

### Example Request

```typescript
const response = await fetch(
  `${config.supabase.url}/functions/v1/notify-message`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
      'apikey': config.supabase.anonKey,
    },
    body: JSON.stringify({
      conversation_id: 'uuid-here',
      sender_id: 'sender-uuid-here',
      message_content: 'Hello, this is my message',
    }),
  }
)
```

## Response Format

### Success (200)

```json
{
  "success": true,
  "message": "Notification sent successfully",
  "recipient_email": "recipient@example.com"
}
```

### Skipped (200)
If the conversation is not between a tenant and technician:

```json
{
  "success": true,
  "message": "Notification skipped - not a tenant/technician conversation"
}
```

### Error (400/404/500)

```json
{
  "success": false,
  "error": "Error message here"
}
```

## Deployment

```bash
supabase functions deploy notify-message
```

## Environment Variables

This function requires the following environment variables to be set in Supabase:

- `SUPABASE_URL` - Your Supabase project URL (auto-set)
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (auto-set)
- `MAILGUN_DOMAIN` - Your Mailgun domain (e.g., `mg.asine.app`)
- `MAILGUN_API_KEY` - Your Mailgun private API key
- `MAILGUN_REGION` - Mailgun region (`us` or `eu`, default: `us`)
- `APP_URL` - Base URL for your app (for email links)
- `APP_DEEP_LINK_SCHEME` - Deep link scheme (optional, e.g., `asine://`)
- `DEV_APP_PORT` - Port for local development (default: `8081`)
- `BASE_URL` - Fallback base URL
- `STRIPE_SECRET_KEY` - Used to determine test/production mode

## How It Works

1. Receives conversation_id, sender_id, and message_content
2. Fetches conversation to get work_order_id
3. Fetches conversation participants to find the recipient (the other participant)
4. Validates that it's a tenant/technician conversation
5. Fetches sender and recipient details (name, email, role)
6. Fetches work order title for context
7. Sends email via Mailgun with message preview and link to conversation

## Email Format

The email includes:
- Sender name
- Work order title for context
- Message preview (first 100 characters)
- Link to view the conversation in the app
- Professional HTML formatting

## Integration

This function is automatically called from the Chat component (`src/components/Chat.tsx`) after a message is successfully sent. The notification is sent asynchronously and does not block the message sending process.



