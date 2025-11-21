# How to Check Supabase Realtime Logs

## Where to Find Logs in Supabase Dashboard

### Option 1: Logs Explorer (Recommended)

1. **Go to Supabase Dashboard**: https://supabase.com/dashboard
2. **Select your project**
3. **Navigate to Logs Explorer**:
   - Click on **"Logs"** in the left sidebar (looks like a document/list icon)
   - Or go to: `Project Settings → Logs` (if using older dashboard)
   - Or directly: `https://supabase.com/dashboard/project/[YOUR-PROJECT-REF]/logs`

4. **Filter for Realtime logs**:
   - At the top, you'll see filter options
   - Click on **"Resource"** or **"Type"** dropdown
   - Select **"Realtime"** or **"Postgres Changes"**
   - You can also search for: `realtime`, `postgres_changes`, `websocket`

5. **Filter by table**:
   - In the search box, type: `messages` or `conversations`
   - This will show only events related to those tables

### Option 2: Database → Logs (Alternative)

1. Go to **Database** in left sidebar
2. Click on **"Logs"** tab (if available in your dashboard version)
3. Filter by **"Postgres Changes"** or **"Realtime"**

### Option 3: API → Logs (If Available)

1. Go to **API** in left sidebar
2. Look for **"Realtime"** section
3. Click on **"Logs"** or **"Activity"**

## What to Look For in Logs

### Successful Realtime Events
You should see entries like:
```
[Realtime] Postgres change event
Table: messages
Event: INSERT
Data: {id: "...", conversation_id: "...", content: "..."}
```

### Connection Events
Look for:
- `WebSocket connection established`
- `Channel subscribed: messages-[conversation-id]`
- `Postgres change received for messages table`

### Error Events
If there are issues, you might see:
- `Channel subscription failed`
- `RLS policy violation`
- `WebSocket connection error`
- `Permission denied`

## Browser Console (Also Check This)

The **browser console** (F12 → Console tab) will show client-side logs:

1. Open your chat page
2. Press **F12** to open Developer Tools
3. Go to **Console** tab
4. Look for these logs (added by our code):
   - `Setting up Realtime subscription for conversation: [id]`
   - `Realtime subscription status: SUBSCRIBED`
   - `✓ Successfully subscribed to real-time messages`
   - `New message received via WebSocket: {...}`

## Network Tab (Check WebSocket Connection)

1. Open Developer Tools (F12)
2. Go to **Network** tab
3. Filter by **WS** (WebSocket)
4. Look for connection to: `wss://[your-project].supabase.co/realtime/v1/websocket`
5. Check if it shows **Status: 101 Switching Protocols** (means connected)
6. Click on it to see messages being sent/received

## Real-Time Testing

To test if Realtime is working:

1. **Open chat in two browser tabs**
2. **Send a message from Tab 1**
3. **Check in Tab 2** if message appears
4. **In Supabase Logs**:
   - You should see an INSERT event on messages table
   - Then a Postgres change event being broadcast
5. **In Browser Console (Tab 2)**:
   - You should see: `New message received via WebSocket`

## If You Don't See Realtime Logs

### Check Realtime Settings

1. Go to **Database → Replication**
2. Verify `messages` table shows **"Realtime Enabled"** with a green checkmark
3. If not, click the toggle to enable it

### Verify Publication

Run this SQL query in SQL Editor:

```sql
-- Check if messages table is in Realtime publication
SELECT tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' 
  AND tablename = 'messages';
```

Should return one row with `tablename = 'messages'`

### Check RLS Policies

Realtime subscriptions respect RLS policies. Ensure:

```sql
-- Check if user can SELECT messages
SELECT policyname, cmd, qual 
FROM pg_policies 
WHERE tablename = 'messages' 
  AND cmd = 'SELECT';
```

## Quick Diagnostic Query

Run this in SQL Editor to see recent Realtime activity:

```sql
-- Check publication status
SELECT 
  'Realtime Publication Status' as check_type,
  tablename,
  schemaname
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND tablename IN ('messages', 'conversations', 'message_receipts')
ORDER BY tablename;
```

## Logs Explorer Screenshot Locations

In newer Supabase Dashboard:
- **Left Sidebar** → **"Logs"** icon (usually near the bottom)
- Or: **Project Settings** → **Logs** (in Settings sidebar)

The logs will show:
- Timestamp
- Resource type (Realtime, Postgres, API, etc.)
- Event type
- Details/message
- User/Auth info

## Troubleshooting

If you can't find logs:
1. **Try searching in Logs Explorer**: Type `realtime` or `messages` in search
2. **Check time range**: Make sure you're looking at recent logs (last hour/day)
3. **Check if logging is enabled**: Some Supabase plans may have logging limits
4. **Use browser console instead**: The browser console logs we added are more reliable for debugging client-side issues

## Most Common Issue

If messages aren't appearing in real-time but are being stored:
- **Check browser console** first (F12 → Console)
- Look for `Realtime subscription status` - should say `SUBSCRIBED`
- If it says `CHANNEL_ERROR` or `TIMED_OUT`, Realtime might not be enabled properly in Dashboard

