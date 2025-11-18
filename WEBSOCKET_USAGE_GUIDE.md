# WebSocket Usage Guide - Supabase Realtime

This guide explains how to consume WebSocket connections in your React app using Supabase Realtime.

## Overview

Supabase Realtime uses WebSockets under the hood, but you don't need to manage WebSocket connections manually. Instead, you use Supabase's Realtime API which handles:
- Connection management
- Reconnection logic
- Message queuing
- Authentication

## Basic Setup

### 1. Import Supabase Client

```typescript
import { supabase } from './lib/supabase';
```

### 2. Subscribe to Changes

Supabase Realtime uses **channels** and **subscriptions**. Here's the basic pattern:

```typescript
useEffect(() => {
  // Create a channel
  const channel = supabase
    .channel('channel-name')
    .on('postgres_changes', {
      event: 'INSERT',        // or 'UPDATE', 'DELETE'
      schema: 'public',
      table: 'messages',
      filter: `conversation_id=eq.${conversationId}`, // Optional filter
    }, (payload) => {
      console.log('Change received!', payload);
      // Handle the change
      handleNewMessage(payload.new);
    })
    .subscribe();

  // Cleanup: unsubscribe when component unmounts
  return () => {
    channel.unsubscribe();
  };
}, [conversationId]);
```

## Real-World Examples

### Example 1: Listening for New Messages

```typescript
import { useEffect } from 'react';
import { supabase } from './lib/supabase';

function ChatComponent({ conversationId }: { conversationId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);

  useEffect(() => {
    if (!conversationId) return;

    // Subscribe to new messages in this conversation
    const channel = supabase
      .channel(`messages-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          console.log('New message received:', payload.new);

          // Fetch full message with sender info
          const { data: messageData } = await supabase
            .from('messages')
            .select(`
              *,
              sender:users!sender_id (
                name,
                role
              )
            `)
            .eq('id', payload.new.id)
            .single();

          if (messageData) {
            // Add new message to state
            setMessages((prev) => [...prev, messageData]);
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [conversationId]);

  return (
    <div>
      {messages.map((msg) => (
        <div key={msg.id}>{msg.content}</div>
      ))}
    </div>
  );
}
```

### Example 2: Listening for Receipt Updates

```typescript
useEffect(() => {
  if (!messageId) return;

  const channel = supabase
    .channel(`receipts-${messageId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'message_receipts',
        filter: `message_id=eq.${messageId}`,
      },
      (payload) => {
        console.log('Receipt updated:', payload.new);
        
        // Update receipt status in UI
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === payload.new.message_id
              ? {
                  ...msg,
                  receipts: updateReceiptStatus(msg.receipts, payload.new),
                }
              : msg
          )
        );
      }
    )
    .subscribe();

  return () => {
    channel.unsubscribe();
  };
}, [messageId]);
```

### Example 3: Listening for Multiple Events

```typescript
useEffect(() => {
  const channel = supabase
    .channel('conversation-updates')
    // Listen for new messages
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => {
        handleNewMessage(payload.new);
      }
    )
    // Listen for message updates
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => {
        handleMessageUpdate(payload.new);
      }
    )
    // Listen for receipt updates
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'message_receipts',
      },
      (payload) => {
        handleReceiptUpdate(payload.new);
      }
    )
    .subscribe();

  return () => {
    channel.unsubscribe();
  };
}, [conversationId]);
```

### Example 4: Listening for Conversation List Updates

```typescript
useEffect(() => {
  const channel = supabase
    .channel('conversations-list')
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'conversations',
      },
      () => {
        // Refresh conversations list when any conversation is updated
        fetchConversations();
      }
    )
    .subscribe();

  return () => {
    channel.unsubscribe();
  };
}, []);
```

## Channel Naming Best Practices

Use unique, descriptive channel names:

```typescript
// ✅ Good: Specific and unique
const channel = supabase.channel(`messages-${conversationId}`);

// ✅ Good: Descriptive
const channel = supabase.channel(`user-${userId}-notifications`);

// ❌ Bad: Too generic (might conflict)
const channel = supabase.channel('messages');

// ❌ Bad: Not descriptive
const channel = supabase.channel('channel1');
```

## Event Types

### postgres_changes

Listens to database changes:

```typescript
.on('postgres_changes', {
  event: 'INSERT' | 'UPDATE' | 'DELETE',
  schema: 'public',
  table: 'table_name',
  filter: 'column=eq.value', // Optional
}, (payload) => {
  // payload.event: 'INSERT' | 'UPDATE' | 'DELETE'
  // payload.new: New/updated row (for INSERT/UPDATE)
  // payload.old: Old row (for UPDATE/DELETE)
  // payload.errors: Any errors
})
```

### broadcast

For custom events (not database changes):

```typescript
// Send a broadcast
supabase.channel('room-1').send({
  type: 'broadcast',
  event: 'typing',
  payload: { user: 'John', isTyping: true },
});

// Listen for broadcasts
supabase
  .channel('room-1')
  .on('broadcast', { event: 'typing' }, (payload) => {
    console.log('User is typing:', payload.payload);
  })
  .subscribe();
```

### presence

For tracking who's online:

```typescript
// Track presence
const channel = supabase.channel('room-1')
  .on('presence', { event: 'sync' }, () => {
    const state = channel.presenceState();
    console.log('Online users:', state);
  })
  .on('presence', { event: 'join' }, ({ key, newPresences }) => {
    console.log('User joined:', newPresences);
  })
  .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
    console.log('User left:', leftPresences);
  })
  .subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      await channel.track({
        user_id: currentUserId,
        online_at: new Date().toISOString(),
      });
    }
  });
```

## Complete Chat Component Example

Here's a complete example combining everything:

```typescript
import { useState, useEffect, useRef } from 'react';
import { supabase } from './lib/supabase';

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender?: {
    name: string;
    role: string;
  };
}

function Chat({ conversationId }: { conversationId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch initial messages
  useEffect(() => {
    const fetchMessages = async () => {
      const { data } = await supabase
        .from('messages')
        .select(`
          *,
          sender:users!sender_id (
            name,
            role
          )
        `)
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (data) {
        setMessages(data);
      }
    };

    fetchMessages();
  }, [conversationId]);

  // Subscribe to new messages via WebSocket
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`messages-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          // Fetch full message with sender info
          const { data: messageData } = await supabase
            .from('messages')
            .select(`
              *,
              sender:users!sender_id (
                name,
                role
              )
            `)
            .eq('id', payload.new.id)
            .single();

          if (messageData) {
            setMessages((prev) => [...prev, messageData]);
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [conversationId]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Send message
  const sendMessage = async () => {
    if (!newMessage.trim()) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: user.id,
        content: newMessage.trim(),
      });

    if (!error) {
      setNewMessage('');
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        {messages.map((message) => (
          <div key={message.id} className="mb-4">
            <div className="font-medium">{message.sender?.name}</div>
            <div>{message.content}</div>
            <div className="text-xs text-gray-500">
              {new Date(message.created_at).toLocaleTimeString()}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t">
        <div className="flex gap-2">
          <input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Type a message..."
            className="flex-1 px-4 py-2 border rounded"
          />
          <button
            onClick={sendMessage}
            className="px-6 py-2 bg-blue-500 text-white rounded"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
```

## Connection Status

Check subscription status:

```typescript
const channel = supabase
  .channel('my-channel')
  .on('postgres_changes', { ... }, callback)
  .subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      console.log('Connected to WebSocket!');
    } else if (status === 'CHANNEL_ERROR') {
      console.error('WebSocket connection error');
    } else if (status === 'TIMED_OUT') {
      console.warn('WebSocket connection timed out');
    } else if (status === 'CLOSED') {
      console.log('WebSocket connection closed');
    }
  });
```

## Error Handling

```typescript
useEffect(() => {
  const channel = supabase
    .channel('messages')
    .on('postgres_changes', { ... }, (payload) => {
      if (payload.errors) {
        console.error('Realtime error:', payload.errors);
        return;
      }
      // Handle success
    })
    .subscribe((status, err) => {
      if (status === 'CHANNEL_ERROR') {
        console.error('Channel error:', err);
      }
    });

  return () => {
    channel.unsubscribe();
  };
}, []);
```

## Performance Tips

1. **Unsubscribe when not needed**: Always clean up subscriptions
2. **Use filters**: Filter subscriptions to only receive relevant data
3. **Debounce updates**: For high-frequency updates, debounce state updates
4. **Limit subscriptions**: Don't create too many channels simultaneously

## Troubleshooting

### Connection not working?

1. **Check Realtime is enabled**: Verify tables are in `supabase_realtime` publication
2. **Check RLS policies**: Make sure user has SELECT permission
3. **Check authentication**: User must be authenticated
4. **Check browser console**: Look for WebSocket connection errors

### Messages not appearing?

1. **Check subscription status**: Log the subscription status
2. **Check filters**: Verify your filter syntax is correct
3. **Check RLS**: User might not have permission to see the data
4. **Check table name**: Ensure table name matches exactly

## Summary

- Use `supabase.channel()` to create channels
- Use `.on('postgres_changes', ...)` to listen to database changes
- Always `.subscribe()` to activate the channel
- Always `.unsubscribe()` in cleanup
- Use unique channel names
- Filter subscriptions to reduce data transfer
- Handle connection status and errors

The WebSocket connection is managed automatically by Supabase - you just subscribe to changes and handle the callbacks!

