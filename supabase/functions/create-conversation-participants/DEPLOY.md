# Deploy create-conversation-participants Edge Function

This guide explains how to deploy the `create-conversation-participants` Edge Function to Supabase.

## Prerequisites

1. **Supabase CLI installed**
   ```bash
   npm install -g supabase
   ```

2. **Logged in to Supabase**
   ```bash
   supabase login
   ```

3. **Linked to your project**
   ```bash
   supabase link --project-ref your-project-ref
   ```

## Deployment

### Deploy Single Function

Deploy just this function:

```bash
supabase functions deploy create-conversation-participants
```

### Deploy All Functions

Deploy all Edge Functions at once:

```bash
supabase functions deploy
```

## Verify Deployment

After deployment, verify the function is available:

```bash
supabase functions list
```

You should see `create-conversation-participants` in the list.

## Test the Function

### Using cURL

```bash
curl -X POST https://your-project.supabase.co/functions/v1/create-conversation-participants \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"work_order_id": "uuid-here"}'
```

### Using Supabase CLI

```bash
supabase functions invoke create-conversation-participants \
  --data '{"work_order_id": "uuid-here"}' \
  --headers 'Authorization: Bearer YOUR_ACCESS_TOKEN'
```

## Environment Variables

No additional environment variables are required. The function automatically uses:

- `SUPABASE_URL` - Your Supabase project URL (set by Supabase)
- `SUPABASE_ANON_KEY` - Your Supabase anon key (set by Supabase)

## Database Requirements

Before using this function, ensure:

1. **Database function exists**: The PostgreSQL function `create_conversation_participants(p_work_order_id UUID)` must exist in your database
   - This is created by running `create-conversations-and-messages-tables.sql`

2. **Tables exist**: The following tables must exist:
   - `conversations`
   - `conversation_participants`
   - `work_orders`
   - `users`

3. **RLS policies**: Appropriate RLS policies must be in place (run `FINAL-FIX-CONVERSATIONS-RLS.sql`)

## Mobile App Integration

Update your mobile app to use the Edge Function instead of direct database INSERT:

### Android/Kotlin

```kotlin
// Instead of:
supabase.from("conversations").insert(conversationData)

// Use:
val response = supabase.functions
    .invoke("create-conversation-participants") {
        body = mapOf("work_order_id" to workOrderId)
    }

val result = response.decode<CreateConversationResponse>()
val conversationId = result.conversation_id
```

### React/TypeScript

```typescript
const { data, error } = await supabase.functions.invoke(
  'create-conversation-participants',
  {
    body: { work_order_id: workOrderId }
  }
)

if (data) {
  const conversationId = data.conversation_id
  // Use conversationId...
}
```

## Troubleshooting

### Function not found

- Verify deployment: `supabase functions list`
- Check project linking: `supabase projects list`
- Redeploy: `supabase functions deploy create-conversation-participants`

### Authentication errors

- Ensure the Authorization header contains a valid JWT token
- Check that the user is authenticated in your app
- Verify the token hasn't expired

### Permission denied

- Ensure the user has permission to access the work order
- Verify RLS policies are correctly configured
- Check that the database function `create_conversation_participants` exists and is accessible

### Database function not found

- Run `create-conversations-and-messages-tables.sql` in your Supabase SQL editor
- Verify the function exists: 
  ```sql
  SELECT proname FROM pg_proc WHERE proname = 'create_conversation_participants';
  ```

## Logs

View function logs:

```bash
supabase functions logs create-conversation-participants
```

Or in the Supabase Dashboard:
- Go to Edge Functions
- Click on `create-conversation-participants`
- View the Logs tab

## Support

For issues or questions:
1. Check the function logs
2. Verify database setup
3. Ensure RLS policies are configured correctly
4. Review the README.md for usage examples


