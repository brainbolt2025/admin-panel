# Which Messages Table to Use for Webhook?

You might see two `messages` tables in Supabase:
- `realtime.messages` - Internal Supabase schema (for realtime functionality)
- `public.messages` - Your actual messages table (where chat messages are stored)

## Which One to Use?

**Use `public.messages`** (or just `messages` in the webhook UI, which defaults to `public` schema)

### Why?

1. **All your code uses `public.messages`:**
   - Chat component: `.from('messages')` → queries `public.messages`
   - Android app: inserts into `public.messages`
   - All queries default to `public` schema

2. **The `realtime` schema is internal:**
   - Used by Supabase for managing realtime subscriptions
   - Not where your application data is stored
   - You should not create webhooks for tables in this schema

### How to Verify:

Run this SQL in Supabase SQL Editor to see which table has your data:

```sql
-- Check public.messages (your actual table)
SELECT COUNT(*) as public_messages_count FROM public.messages;

-- Check realtime.messages (internal, likely empty or doesn't exist)
SELECT COUNT(*) as realtime_messages_count FROM realtime.messages;
```

The `public.messages` table should have your actual message data.

### Webhook Configuration:

When creating the webhook in Supabase Dashboard:
- **Table**: Select `messages` (this is `public.messages`)
- If you see a dropdown with both options, choose the one under the `public` schema



