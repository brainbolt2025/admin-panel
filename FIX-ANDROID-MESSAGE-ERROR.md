# Fix Android Message Insert Error

The error "URL using bad/illegal format or missing URL" (Code: XX000) is happening when Android tries to insert messages. This suggests there's a database trigger interfering with the insert operation.

## Step 1: Check for Triggers

Run this SQL in Supabase SQL Editor to check if there's a trigger on the messages table:

```sql
-- Check all triggers on messages table
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement,
    action_timing
FROM information_schema.triggers
WHERE event_object_table = 'messages'
ORDER BY trigger_name;
```

## Step 2: Remove Problematic Trigger

If you see a trigger named `trigger_notify_message_on_insert` or any trigger that mentions HTTP/notify, remove it:

```sql
-- Remove the problematic trigger
DROP TRIGGER IF EXISTS trigger_notify_message_on_insert ON public.messages;

-- Optionally remove the function too
DROP FUNCTION IF EXISTS public.notify_message_on_insert() CASCADE;
```

## Step 3: Verify Webhook is Working

The Database Webhook should work independently - it doesn't interfere with inserts. After removing the trigger:

1. **Verify the webhook is configured correctly:**
   - Go to Database → Webhooks
   - Check that the webhook for `messages` table exists
   - Ensure it's pointing to the correct Edge Function URL
   - Make sure it's enabled

2. **Test sending a message from Android**

3. **Check Edge Function logs:**
   - Go to Edge Functions → notify-message → Logs
   - You should see logs when the webhook triggers

## Why This Happens

Database triggers execute **during** the INSERT operation. If a trigger tries to make an HTTP request and fails, it can cause the entire INSERT to fail.

Database Webhooks, on the other hand, execute **after** the INSERT completes successfully, so they don't interfere with the insert operation.

## Important Note

**You should use EITHER:**
- Database Webhook (recommended) - OR
- Database Trigger (pg_net approach)

**NOT BOTH!** Having both can cause conflicts and errors.



