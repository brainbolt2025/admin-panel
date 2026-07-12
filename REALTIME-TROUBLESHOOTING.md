# Realtime Messages Not Displaying - Troubleshooting Guide

If messages are being sent and stored but not displaying in real-time, follow these steps:

## Step 1: Verify Realtime is Enabled in Supabase Dashboard

1. Go to your Supabase Dashboard
2. Navigate to **Database** → **Replication**
3. Ensure the **messages** table is listed and enabled for replication
4. If it's not there, click **Enable** next to the `messages` table

## Step 2: Run SQL Diagnostic Script

Run the `VERIFY-REALTIME-ENABLED.sql` script in your Supabase SQL Editor:

```sql
-- This will check and fix Realtime publication for messages table
```

The script will:
- Verify Realtime extension is installed
- Check if `supabase_realtime` publication exists
- Verify `messages`, `conversations`, and `message_receipts` are in the publication
- Add them if missing

## Step 3: Check Browser Console

Open your browser's Developer Console (F12) and look for:

1. **Subscription status logs:**
   ```
   Setting up Realtime subscription for conversation: [id]
   Realtime subscription status: SUBSCRIBED
   ✓ Successfully subscribed to real-time messages
   ```

2. **Error messages:**
   - `✗ Failed to subscribe to real-time messages - Channel error`
   - `✗ Failed to subscribe to real-time messages - Timeout`
   - `⚠ Realtime subscription closed`

## Step 4: Verify Realtime is Enabled at Project Level

In Supabase Dashboard:
1. Go to **Settings** → **API**
2. Scroll to **Realtime** section
3. Ensure **Realtime** is enabled for your project

## Step 5: Check Network Tab

1. Open Browser DevTools → **Network** tab
2. Filter by **WS** (WebSocket)
3. Look for a WebSocket connection to `wss://your-project.supabase.co/realtime/v1/websocket`
4. Check if it's connected (status should be 101 Switching Protocols)

## Step 6: Test Subscription Manually

In browser console, try this:

```javascript
// Check if supabase client has Realtime enabled
const channel = supabase.channel('test-channel')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'messages',
  }, (payload) => {
    console.log('Test subscription received:', payload)
  })
  .subscribe((status) => {
    console.log('Test subscription status:', status)
  })
```

## Common Issues and Fixes

### Issue 1: "Realtime subscription status: CHANNEL_ERROR"

**Cause:** Realtime not enabled in Supabase Dashboard

**Fix:**
1. Go to Database → Replication
2. Enable replication for `messages` table
3. Refresh the page

### Issue 2: "Realtime subscription status: TIMED_OUT"

**Cause:** Network or connection issue

**Fix:**
1. Check internet connection
2. Verify Supabase URL is correct
3. Check firewall/proxy settings
4. Try refreshing the page

### Issue 3: Messages save but subscription never fires

**Cause:** Messages table not in Realtime publication

**Fix:**
Run this SQL:

```sql
-- Add messages table to Realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- Verify it was added
SELECT tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' 
  AND tablename = 'messages';
```

### Issue 4: Subscription works but doesn't receive updates

**Cause:** Filter might be incorrect or RLS blocking

**Fix:**
1. Check the filter in Chat.tsx: `filter: 'conversation_id=eq.${selectedConversationId}'`
2. Verify RLS policies allow SELECT on messages
3. Ensure user is authenticated

### Issue 5: Works in one browser but not another

**Cause:** Browser WebSocket support or extension blocking

**Fix:**
1. Disable browser extensions (ad blockers, privacy tools)
2. Try incognito/private mode
3. Clear browser cache
4. Try a different browser

## Quick Fix Script

Run this SQL to ensure everything is set up:

```sql
-- Enable Realtime for messages table
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS public.conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS public.message_receipts;

-- Verify
SELECT tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' 
  AND tablename IN ('messages', 'conversations', 'message_receipts');
```

## Testing Checklist

- [ ] Realtime enabled in Supabase Dashboard (Database → Replication)
- [ ] Messages table added to `supabase_realtime` publication
- [ ] WebSocket connection established (check Network tab)
- [ ] Subscription status shows `SUBSCRIBED` (check console)
- [ ] RLS policies allow SELECT on messages table
- [ ] User is authenticated
- [ ] Browser console shows no errors

## Still Not Working?

1. Check Supabase logs in Dashboard → Edge Functions → Logs
2. Verify your Supabase project hasn't hit Realtime rate limits
3. Try restarting the Supabase Realtime service (contact Supabase support)
4. Check if this is a known issue on Supabase Status page


