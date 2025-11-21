# How Client Should Listen to WebSocket (Supabase Realtime)

This guide explains how to properly set up WebSocket connections for Supabase Realtime in your client application.

## Overview

Supabase Realtime uses WebSocket connections to push database changes to clients in real-time. The client doesn't need to manually manage WebSocket connections - Supabase JS client handles it automatically.

## Step-by-Step Setup

### Step 1: Configure Supabase Client with Realtime

In your Supabase client configuration (`src/lib/supabase.ts`):

```typescript
import { createClient } from '@supabase/supabase-js'
import { config } from '../config'

export const supabase = createClient(config.supabase.url, config.supabase.anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
  realtime: {
    params: {
      eventsPerSecond: 10,  // Rate limiting
    },
  },
})
```

**Important:** The `realtime` config is optional but recommended. It sets rate limiting.

### Step 2: Subscribe to Database Changes

Subscribe to `postgres_changes` events for the table you want to monitor:

```typescript
// Example: Listen for new messages
const channel = supabase
  .channel('messages-channel')  // Unique channel name
  .on(
    'postgres_changes',
    {
      event: 'INSERT',          // Event type: INSERT, UPDATE, DELETE, or '*'
      schema: 'public',         // Database schema
      table: 'messages',        // Table name
      filter: 'conversation_id=eq.abc123',  // Optional: Filter by column
    },
    (payload) => {
      // Handle the change
      console.log('New message received:', payload.new)
      // payload.new = new row data
      // payload.old = old row data (for UPDATE/DELETE)
      // payload.eventType = 'INSERT' | 'UPDATE' | 'DELETE'
    }
  )
  .subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      console.log('✓ Subscribed to real-time messages')
    } else if (status === 'CHANNEL_ERROR') {
      console.error('✗ Subscription failed')
    } else if (status === 'TIMED_OUT') {
      console.error('✗ Subscription timeout')
    } else if (status === 'CLOSED') {
      console.warn('⚠ Subscription closed')
    }
  })
```

### Step 3: Clean Up Subscription

Always unsubscribe when the component unmounts:

```typescript
useEffect(() => {
  const channel = supabase
    .channel('messages-channel')
    .on('postgres_changes', { /* ... */ }, handleChange)
    .subscribe()

  // Cleanup function
  return () => {
    channel.unsubscribe()
  }
}, [])  // Dependencies
```

## Complete Example: React Component

Here's a complete example for listening to messages in a chat:

```typescript
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

function Chat({ conversationId }: { conversationId: string }) {
  const [messages, setMessages] = useState([])

  useEffect(() => {
    if (!conversationId) return

    console.log('Setting up Realtime subscription for conversation:', conversationId)

    // Create a unique channel name per conversation
    const channelName = `messages-${conversationId}`

    const channel = supabase
      .channel(channelName, {
        config: {
          broadcast: { self: true },  // Receive your own messages
        },
      })
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,  // Filter by conversation
        },
        async (payload) => {
          console.log('New message received via WebSocket:', payload.new)

          // Fetch full message data with sender info
          const { data: messageData, error } = await supabase
            .from('messages')
            .select(`
              *,
              sender:users!sender_id (
                name,
                role
              )
            `)
            .eq('id', payload.new.id)
            .single()

          if (!error && messageData) {
            // Add message to state
            setMessages((prev) => [...prev, messageData])
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'message_receipts',  // Listen for read receipts
        },
        (payload) => {
          console.log('Receipt updated:', payload.new)
          // Update message receipts in UI
        }
      )
      .subscribe((status) => {
        console.log('Realtime subscription status:', status)
        if (status === 'SUBSCRIBED') {
          console.log('✓ Successfully subscribed to real-time messages')
        } else if (status === 'CHANNEL_ERROR') {
          console.error('✗ Failed to subscribe - Channel error')
        } else if (status === 'TIMED_OUT') {
          console.error('✗ Failed to subscribe - Timeout')
        } else if (status === 'CLOSED') {
          console.warn('⚠ Subscription closed')
        }
      })

    // Cleanup
    return () => {
      console.log('Cleaning up subscription')
      channel.unsubscribe()
    }
  }, [conversationId])  // Re-subscribe when conversationId changes

  return (
    <div>
      {messages.map((msg) => (
        <div key={msg.id}>{msg.content}</div>
      ))}
    </div>
  )
}
```

## Event Types

### INSERT Events
Triggered when a new row is inserted:

```typescript
.on('postgres_changes', {
  event: 'INSERT',
  schema: 'public',
  table: 'messages',
}, (payload) => {
  // payload.new = { id, content, created_at, ... }
  console.log('New row:', payload.new)
})
```

### UPDATE Events
Triggered when a row is updated:

```typescript
.on('postgres_changes', {
  event: 'UPDATE',
  schema: 'public',
  table: 'messages',
}, (payload) => {
  // payload.new = updated row data
  // payload.old = previous row data
  console.log('Updated:', payload.new)
})
```

### DELETE Events
Triggered when a row is deleted:

```typescript
.on('postgres_changes', {
  event: 'DELETE',
  schema: 'public',
  table: 'messages',
}, (payload) => {
  // payload.old = deleted row data
  console.log('Deleted:', payload.old)
})
```

### All Events
Listen to all events:

```typescript
.on('postgres_changes', {
  event: '*',  // All events
  schema: 'public',
  table: 'messages',
}, (payload) => {
  console.log('Event type:', payload.eventType)  // 'INSERT', 'UPDATE', or 'DELETE'
})
```

## Filters

Filter events by column value:

```typescript
// Single value
filter: 'conversation_id=eq.abc123'

// Multiple values (OR)
filter: 'status=in.(pending,active)'

// Not equal
filter: 'sender_id=neq.current-user-id'

// Greater than
filter: 'created_at=gt.2024-01-01'
```

## Multiple Subscriptions

You can subscribe to multiple tables or events:

```typescript
const channel = supabase
  .channel('multi-channel')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'messages',
  }, handleMessages)
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'conversations',
  }, handleConversations)
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'message_receipts',
  }, handleReceipts)
  .subscribe()
```

## Channel Configuration Options

```typescript
const channel = supabase.channel('my-channel', {
  config: {
    // Receive your own broadcasts
    broadcast: { self: true },
    
    // Presence configuration (for online status)
    presence: {
      key: 'user-id',  // Unique key per user
    },
  },
})
```

## Best Practices

### 1. Use Unique Channel Names
```typescript
// ✅ Good: Unique per conversation
const channelName = `messages-${conversationId}`

// ❌ Bad: Shared channel (can cause conflicts)
const channelName = 'messages'
```

### 2. Always Clean Up
```typescript
useEffect(() => {
  const channel = supabase.channel(...).subscribe()
  
  return () => {
    channel.unsubscribe()  // Always cleanup
  }
}, [dependencies])
```

### 3. Handle Subscription Status
```typescript
.subscribe((status) => {
  if (status === 'SUBSCRIBED') {
    // Success - can now receive events
  } else {
    // Error - handle accordingly
  }
})
```

### 4. Fetch Full Data
WebSocket payload contains raw row data. Fetch related data if needed:

```typescript
.on('postgres_changes', {
  event: 'INSERT',
  schema: 'public',
  table: 'messages',
}, async (payload) => {
  // payload.new only has direct columns
  // Fetch related data (joins) if needed
  const { data } = await supabase
    .from('messages')
    .select('*, sender:users(*)')
    .eq('id', payload.new.id)
    .single()
})
```

### 5. Error Handling
```typescript
.subscribe((status, error) => {
  if (status === 'CHANNEL_ERROR') {
    console.error('Subscription error:', error)
    // Retry or show error message
  }
})
```

## Troubleshooting

### Subscription Status: CHANNEL_ERROR
**Cause:** Realtime not enabled for table or connection issue
**Fix:** Enable Realtime in Supabase Dashboard → Database → Replication

### Subscription Status: TIMED_OUT
**Cause:** Network issue or Supabase service problem
**Fix:** Check internet connection, retry subscription

### No Events Received
**Possible causes:**
1. Realtime not enabled for table (check Dashboard)
2. RLS policies blocking access (check policies)
3. Filter too restrictive (test without filter)
4. WebSocket connection not established (check Network tab)

### Check WebSocket Connection
In browser DevTools → Network tab:
1. Filter by **WS** (WebSocket)
2. Look for: `wss://[project].supabase.co/realtime/v1/websocket`
3. Status should be: **101 Switching Protocols**
4. Click it to see messages being sent/received

## Testing

Test if WebSocket is working:

1. **Open chat in two browser tabs**
2. **Send a message from Tab 1**
3. **In Tab 2 console**, you should see:
   ```
   New message received via WebSocket: {...}
   ```
4. **Message should appear instantly** in Tab 2

## Summary

✅ **Do:**
- Use `supabase.channel()` to create channels
- Use `.on('postgres_changes', ...)` to listen to changes
- Always call `.subscribe()` to start listening
- Always clean up with `.unsubscribe()`
- Check subscription status
- Use unique channel names

❌ **Don't:**
- Manually create WebSocket connections (Supabase handles it)
- Forget to unsubscribe (memory leaks)
- Share channel names across components
- Ignore subscription status errors

The Supabase JS client automatically manages WebSocket connections - you just need to subscribe to the changes you want to listen to!

