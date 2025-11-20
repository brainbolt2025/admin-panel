# How to Send Messages to the Messages Table

This guide explains how to insert messages into the `messages` table for the chat functionality.

## Table Structure

The `messages` table has the following structure:

```sql
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  attachment_url TEXT,          -- Optional: for file attachments
  attachment_type TEXT          -- Optional: 'image', 'document', etc.
);
```

## Basic Message Sending

### Method 1: Using Supabase Client (Recommended)

```typescript
import { supabase } from './lib/supabase';

async function sendMessage(
  conversationId: string,
  content: string,
  attachmentUrl?: string,
  attachmentType?: string
) {
  // 1. Get the current authenticated user
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('User must be authenticated to send messages');
  }

  // 2. Insert the message
  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content: content.trim(),
      attachment_url: attachmentUrl || null,
      attachment_type: attachmentType || null,
    })
    .select()
    .single();

  if (error) {
    console.error('Error sending message:', error);
    throw error;
  }

  return data;
}

// Usage
try {
  const newMessage = await sendMessage(
    'conversation-uuid-here',
    'Hello, this is my message!'
  );
  console.log('Message sent:', newMessage);
} catch (error) {
  console.error('Failed to send message:', error);
}
```

### Method 2: With Authentication Check

```typescript
import { getAuthenticatedSupabase } from './lib/supabase';

async function sendMessage(
  conversationId: string,
  content: string
) {
  const supabaseClient = getAuthenticatedSupabase();
  
  // Get current user
  const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
  
  if (userError || !user) {
    throw new Error('Authentication required');
  }

  // Verify user is a participant in the conversation
  const { data: participant } = await supabaseClient
    .from('conversation_participants')
    .select('user_id')
    .eq('conversation_id', conversationId)
    .eq('user_id', user.id)
    .single();

  if (!participant) {
    throw new Error('You are not a participant in this conversation');
  }

  // Send the message
  const { data, error } = await supabaseClient
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content: content.trim(),
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}
```

## Complete Example from Chat Component

Here's the actual implementation from `Chat.tsx`:

```typescript
const sendMessage = useCallback(async () => {
  if (!newMessage.trim() || !selectedConversationId || !currentUserId) {
    return;
  }

  const content = newMessage.trim();
  setNewMessage(''); // Clear input immediately for better UX

  try {
    const supabaseClient = getAuthenticatedSupabase();

    // Insert the message
    const { data: messageData, error: messageError } = await supabaseClient
      .from('messages')
      .insert({
        conversation_id: selectedConversationId,
        sender_id: currentUserId,
        content: content,
      })
      .select()
      .single();

    if (messageError) {
      throw messageError;
    }

    // Note: The trigger automatically:
    // 1. Updates conversation's last_message_at and last_message_preview
    // 2. Creates message_receipts for all participants (except sender)

    // The Realtime subscription will automatically add the new message to the UI
    // But you can also manually add it for instant feedback:
    if (messageData) {
      const { data: senderData } = await supabaseClient
        .from('users')
        .select('name, role')
        .eq('id', currentUserId)
        .single();

      const formattedMessage: Message = {
        id: messageData.id,
        conversation_id: messageData.conversation_id,
        sender_id: messageData.sender_id,
        content: messageData.content,
        created_at: messageData.created_at,
        sender: {
          name: senderData?.name || 'Unknown',
          role: senderData?.role || 'unknown',
        },
        receipts: [], // Will be populated by receipts fetch or Realtime
      };

      setMessages((prev) => [...prev, formattedMessage]);
    }
  } catch (error) {
    console.error('Error in sendMessage:', error);
    // Optionally restore the message text if sending failed
    setNewMessage(content);
  }
}, [newMessage, selectedConversationId, currentUserId]);
```

## What Happens Automatically

When you insert a message, database triggers handle several things:

### 1. Conversation Update Trigger
The `trigger_update_conversation_on_message` trigger automatically:
- Updates `conversations.updated_at` to current time
- Updates `conversations.last_message_at` to the message's `created_at`
- Updates `conversations.last_message_preview` to the first 100 characters

### 2. Receipt Creation Trigger
The `trigger_create_message_receipts` trigger automatically:
- Creates `message_receipts` entries for all conversation participants
- Marks receipts as delivered (with `delivered_at`) for non-sender participants
- Skips creating a receipt for the sender

## Sending Messages with Attachments

```typescript
async function sendMessageWithAttachment(
  conversationId: string,
  content: string,
  file: File
) {
  const supabaseClient = getAuthenticatedSupabase();
  const { data: { user } } = await supabaseClient.auth.getUser();
  
  if (!user) throw new Error('Not authenticated');

  // 1. Upload file to Supabase Storage
  const fileExt = file.name.split('.').pop();
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
  const filePath = `chat-attachments/${conversationId}/${fileName}`;

  const { data: uploadData, error: uploadError } = await supabaseClient.storage
    .from('chat-attachments') // Your storage bucket name
    .upload(filePath, file);

  if (uploadError) {
    throw uploadError;
  }

  // 2. Get public URL
  const { data: urlData } = supabaseClient.storage
    .from('chat-attachments')
    .getPublicUrl(filePath);

  // 3. Determine attachment type
  const attachmentType = file.type.startsWith('image/') ? 'image' : 'document';

  // 4. Insert message with attachment
  const { data, error } = await supabaseClient
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content: content || '', // Can be empty if sending only an attachment
      attachment_url: urlData.publicUrl,
      attachment_type: attachmentType,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}
```

## React Hook Example

```typescript
import { useState, useCallback } from 'react';
import { supabase } from './lib/supabase';

function useSendMessage(conversationId: string) {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = useCallback(async (content: string) => {
    if (!content.trim()) return;

    setSending(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error: insertError } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: user.id,
          content: content.trim(),
        })
        .select()
        .single();

      if (insertError) throw insertError;

      return data;
    } catch (err: any) {
      setError(err.message || 'Failed to send message');
      throw err;
    } finally {
      setSending(false);
    }
  }, [conversationId]);

  return { send, sending, error };
}

// Usage in component
function ChatInput({ conversationId }: { conversationId: string }) {
  const [input, setInput] = useState('');
  const { send, sending, error } = useSendMessage(conversationId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await send(input);
      setInput('');
    } catch (err) {
      // Error is already set in hook
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        disabled={sending}
        placeholder="Type a message..."
      />
      <button type="submit" disabled={sending || !input.trim()}>
        {sending ? 'Sending...' : 'Send'}
      </button>
      {error && <div className="error">{error}</div>}
    </form>
  );
}
```

## Required Fields

- **`conversation_id`** (UUID): The ID of the conversation this message belongs to
- **`sender_id`** (UUID): The ID of the user sending the message (usually `user.id`)
- **`content`** (TEXT): The message text (cannot be empty)

## Optional Fields

- **`attachment_url`** (TEXT): URL to an attachment file
- **`attachment_type`** (TEXT): Type of attachment ('image', 'document', etc.)

## Auto-Generated Fields

- **`id`** (UUID): Auto-generated primary key
- **`created_at`** (TIMESTAMPTZ): Auto-set to current timestamp

## RLS (Row Level Security) Requirements

Make sure your RLS policies allow INSERT for authenticated users who are participants:

```sql
-- Example RLS policy (should already be in create-conversations-and-messages-tables.sql)
CREATE POLICY "Users can send messages in their conversations"
ON messages FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM conversation_participants
    WHERE conversation_id = messages.conversation_id
      AND user_id = auth.uid()
  )
);
```

## Error Handling

Common errors you might encounter:

1. **Authentication Error**: User is not logged in
   ```typescript
   if (!user) {
     throw new Error('Please log in to send messages');
   }
   ```

2. **RLS Policy Violation**: User is not a participant
   ```typescript
   // Check if user is a participant before sending
   const { data: participant } = await supabase
     .from('conversation_participants')
     .select('user_id')
     .eq('conversation_id', conversationId)
     .eq('user_id', user.id)
     .single();

   if (!participant) {
     throw new Error('You are not part of this conversation');
   }
   ```

3. **Empty Content**: Content is required
   ```typescript
   if (!content.trim()) {
     throw new Error('Message cannot be empty');
   }
   ```

## Real-time Updates

After sending a message:

1. **Automatic UI Update**: If you have a Realtime subscription set up, the new message will automatically appear in all connected clients
2. **Manual Update**: You can also manually add the message to your state for instant feedback (optimistic update)

```typescript
// Option 1: Wait for Realtime (automatic)
// Just send the message, and Realtime will update the UI

// Option 2: Optimistic update (manual, instant feedback)
const { data: newMessage } = await supabase
  .from('messages')
  .insert({ ... })
  .select()
  .single();

// Immediately add to UI
setMessages(prev => [...prev, newMessage]);

// Realtime will also fire, but React will deduplicate by ID
```

## Summary

To send a message:

1. **Authenticate**: Get the current user
2. **Validate**: Check conversation exists and user is a participant
3. **Insert**: Use `supabase.from('messages').insert({...})`
4. **Handle**: The triggers automatically update conversation and create receipts
5. **Update UI**: Realtime will notify all subscribers, or manually update state

```typescript
// Minimal example
const { data: { user } } = await supabase.auth.getUser();
await supabase
  .from('messages')
  .insert({
    conversation_id: conversationId,
    sender_id: user.id,
    content: 'Hello!',
  });
```

That's it! The database triggers handle the rest automatically.

