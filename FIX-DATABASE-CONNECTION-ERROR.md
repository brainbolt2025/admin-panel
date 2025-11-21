# Fix: Database Connection Error - Postgrex.Protocol Disconnected

The error `Postgrex.Protocol disconnected: ** (DBConnection.ConnectionError) client exited` indicates a database connection was dropped. This can affect Realtime subscriptions if it happens during connection setup.

## Where This Error Comes From

This error typically appears in:
- **Elixir/Phoenix backend** (Postgrex is the Elixir PostgreSQL driver)
- **Server-side logs** (not browser console)
- **Mobile app backend** if you're using Elixir/Phoenix

If you're seeing this in:
- **Browser console** → Might be from a different service
- **Supabase logs** → Check Database logs in Dashboard
- **Mobile app logs** → Your backend is having connection issues

## Common Causes

### 1. Connection Pool Exhaustion
- Too many open connections
- Connection pool size too small
- Connections not being properly closed

### 2. Connection Timeout
- Long-running queries
- Database connection idle timeout
- Network issues

### 3. Database Limits
- Supabase connection limit reached
- Too many concurrent connections

### 4. Network Issues
- Intermittent network problems
- Firewall/proxy blocking connections
- VPN issues

## Quick Fixes

### Fix 1: Check Supabase Connection Limits

1. Go to **Supabase Dashboard**
2. Navigate to **Project Settings** → **Database**
3. Check **Connection Pooling** settings
4. Look for connection limits/usage

### Fix 2: Restart Your Backend Service

If this is from your backend:
```bash
# Restart your Elixir/Phoenix app
# Or restart your server/container
```

### Fix 3: Check Database Connection Settings

For Elixir/Phoenix, check your database config:

```elixir
# config/releases.exs or config/prod.exs
config :your_app, YourApp.Repo,
  pool_size: 10,  # Adjust based on your needs
  timeout: 15_000,
  connect_timeout: 10_000,
  checkout_timeout: 5_000,
  queue_target: 50,
  queue_interval: 1_000
```

### Fix 4: Use Supabase Connection Pooler

Instead of direct connections, use Supabase's connection pooler:

**For Elixir/Phoenix:**
```elixir
# Use the pooler URL instead of direct connection
# Port 6543 for transaction mode
# Port 5432 for session mode

# Example:
hostname: "aws-0-us-west-1.pooler.supabase.com"
port: 6543
database: "postgres"
```

Get your pooler URL from:
- **Supabase Dashboard** → **Project Settings** → **Database** → **Connection Pooling**

### Fix 5: Add Connection Retry Logic

```elixir
# Add retry logic to your database connection
config :your_app, YourApp.Repo,
  pool_size: 10,
  queue_target: 50,
  queue_interval: 1_000,
  # Retry on disconnect
  retry_on_connection_error: true
```

## If This Affects Realtime Messages

If messages aren't appearing in real-time due to connection issues:

### Check 1: Browser Console
Open browser console (F12) and check if Realtime subscription is working:
```
✓ Successfully subscribed to real-time messages
```

### Check 2: WebSocket Connection
In Network tab (F12), check WebSocket connection:
- Look for: `wss://[project].supabase.co/realtime/v1/websocket`
- Status should be: `101 Switching Protocols`

### Check 3: Supabase Dashboard Logs
1. Go to **Logs** in Supabase Dashboard
2. Filter by **Realtime** or **Postgres Changes**
3. Look for connection/disconnection events

## Testing Realtime Without Backend

Realtime subscriptions in the React app work independently of your backend. To test:

1. **Open chat in two browser tabs**
2. **Send a message from Tab 1** (directly via Supabase client)
3. **Check Tab 2 console** - should see WebSocket message

If this works, the backend connection error is separate and doesn't affect Realtime.

## Diagnose Connection Issues

Run this SQL in Supabase SQL Editor to check active connections:

```sql
-- Check current connections
SELECT 
  count(*) as total_connections,
  count(*) FILTER (WHERE state = 'active') as active,
  count(*) FILTER (WHERE state = 'idle') as idle,
  count(*) FILTER (WHERE state = 'idle in transaction') as idle_in_transaction
FROM pg_stat_activity
WHERE datname = current_database();

-- Check connection limits
SELECT 
  setting as max_connections
FROM pg_settings
WHERE name = 'max_connections';
```

## If Error Persists

### Check Supabase Status
- Go to https://status.supabase.com
- Check if there are any ongoing issues

### Check Your Backend Logs
If using Elixir/Phoenix:
```bash
# View logs
tail -f log/prod.log

# Or if using Docker
docker logs [container-name] -f
```

### Contact Support
- Supabase Support: https://supabase.com/support
- Include:
  - Project reference
  - Time of error
  - Full error message
  - What you were doing when it happened

## Prevent Future Issues

1. **Use Connection Pooling**: Always use Supabase pooler for backend connections
2. **Set Proper Pool Size**: Don't exceed your plan's connection limit
3. **Close Connections**: Ensure connections are properly closed after use
4. **Add Retry Logic**: Handle connection errors gracefully
5. **Monitor Connections**: Regularly check connection count

## Summary

**For Realtime messages specifically:**
- This error is likely from your backend, not the Realtime subscription
- Realtime uses WebSocket, not direct DB connections
- Test Realtime independently in browser tabs
- Check browser console for subscription status

**For backend connection errors:**
- Use Supabase connection pooler
- Adjust pool size
- Add retry logic
- Check connection limits

