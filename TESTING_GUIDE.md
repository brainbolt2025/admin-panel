# Testing Guide: Conversations and Messages

This guide walks you through testing the chat functionality step by step.

## Prerequisites

1. ✅ Run `create-conversations-and-messages-tables.sql` in Supabase SQL Editor
2. ✅ Enable Realtime replication for `conversations`, `messages`, and `message_receipts` tables
3. ✅ Have at least one work order with a tenant and technician assigned

## Step-by-Step Testing

### 1. Verify Tables Were Created

Run this in Supabase SQL Editor:

```sql
SELECT table_name 
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('conversations', 'messages', 'conversation_participants', 'message_receipts');
```

**Expected:** All 4 tables should be listed.

---

### 2. Get Test Data

Find a work order with tenant and technician:

```sql
SELECT 
  wo.id AS work_order_id,
  wo.title,
  wo.tenant_id,
  wo.technician_id,
  t.name AS tenant_name,
  tech.name AS technician_name
FROM work_orders wo
LEFT JOIN users t ON wo.tenant_id = t.id
LEFT JOIN users tech ON wo.technician_id = tech.id
WHERE wo.tenant_id IS NOT NULL 
  AND wo.technician_id IS NOT NULL
LIMIT 1;
```

**Save these IDs** - you'll need them for the next steps:
- `work_order_id`
- `tenant_id`
- `technician_id`

---

### 3. Create a Conversation

Replace `'YOUR_WORK_ORDER_ID'` with the work order ID from Step 2:

```sql
SELECT create_conversation_participants('YOUR_WORK_ORDER_ID') AS conversation_id;
```

**Expected:** Returns a UUID (the conversation ID). This function:
- Creates a conversation linked to the work order
- Adds tenant and technician as participants
- Returns the conversation ID

**Save the `conversation_id`** for next steps.

---

### 4. Verify Conversation and Participants

Replace `'YOUR_CONVERSATION_ID'` with the ID from Step 3:

```sql
-- Check conversation
SELECT 
  c.id,
  c.work_order_id,
  wo.title AS work_order_title,
  c.created_at,
  c.last_message_at
FROM conversations c
JOIN work_orders wo ON c.work_order_id = wo.id
WHERE c.id = 'YOUR_CONVERSATION_ID';

-- Check participants
SELECT 
  cp.user_id,
  u.name AS user_name,
  u.role,
  cp.role AS participant_role,
  cp.joined_at
FROM conversation_participants cp
JOIN users u ON cp.user_id = u.id
WHERE cp.conversation_id = 'YOUR_CONVERSATION_ID';
```

**Expected:** 
- Conversation exists with correct work_order_id
- Two participants: tenant and technician

---

### 5. Send a Test Message

Replace with your actual IDs:

```sql
INSERT INTO messages (conversation_id, sender_id, content)
VALUES (
  'YOUR_CONVERSATION_ID',
  'YOUR_TENANT_ID',
  'Hello! I have a question about the work order.'
)
RETURNING id, conversation_id, sender_id, content, created_at;
```

**Save the returned `id`** (message_id) for next steps.

**Expected:** Message is created and returns the message ID.

---

### 6. Verify Auto-Created Receipts

The trigger should have automatically created receipts. Check:

```sql
SELECT 
  mr.id,
  mr.message_id,
  u.name AS recipient_name,
  mr.delivered_at,
  mr.read_at,
  CASE 
    WHEN mr.read_at IS NOT NULL THEN 'read'
    WHEN mr.delivered_at IS NOT NULL THEN 'delivered'
    ELSE 'sent'
  END AS status
FROM message_receipts mr
JOIN users u ON mr.user_id = u.id
WHERE mr.message_id = 'YOUR_MESSAGE_ID';
```

**Expected:** 
- One receipt for the technician (recipient)
- Status should be `'sent'` (delivered_at and read_at are NULL)
- No receipt for the sender (tenant)

---

### 7. Test Conversation Auto-Update

Check if the conversation metadata was updated:

```sql
SELECT 
  id,
  updated_at,
  last_message_at,
  last_message_preview
FROM conversations
WHERE id = 'YOUR_CONVERSATION_ID';
```

**Expected:**
- `updated_at` = current timestamp
- `last_message_at` = message creation time
- `last_message_preview` = first 100 chars of message content

---

### 8. Mark Message as Delivered

Simulate the technician being online and receiving the message:

```sql
UPDATE message_receipts 
SET delivered_at = NOW()
WHERE message_id = 'YOUR_MESSAGE_ID' 
  AND user_id = 'YOUR_TECHNICIAN_ID'
  AND delivered_at IS NULL
RETURNING id, delivered_at, read_at;
```

**Expected:** `delivered_at` is set to current timestamp.

---

### 9. Mark Message as Read

Simulate the technician viewing the message:

```sql
UPDATE message_receipts 
SET read_at = NOW()
WHERE message_id = 'YOUR_MESSAGE_ID' 
  AND user_id = 'YOUR_TECHNICIAN_ID'
  AND read_at IS NULL
RETURNING id, delivered_at, read_at;
```

**Expected:** Both `delivered_at` and `read_at` are set.

---

### 10. Verify Receipt Status

Check the final receipt status:

```sql
SELECT 
  u.name AS recipient,
  mr.delivered_at,
  mr.read_at,
  CASE 
    WHEN mr.read_at IS NOT NULL THEN 'read'
    WHEN mr.delivered_at IS NOT NULL THEN 'delivered'
    ELSE 'sent'
  END AS status
FROM message_receipts mr
JOIN users u ON mr.user_id = u.id
WHERE mr.message_id = 'YOUR_MESSAGE_ID';
```

**Expected:** Status should be `'read'`.

---

### 11. Test Full Conversation Query

Get all messages with sender info and receipt status:

```sql
SELECT 
  m.id AS message_id,
  m.content,
  m.created_at,
  sender.name AS sender_name,
  sender.role AS sender_role,
  -- Receipt status
  json_agg(
    json_build_object(
      'recipient', recipient.name,
      'status', CASE 
        WHEN mr.read_at IS NOT NULL THEN 'read'
        WHEN mr.delivered_at IS NOT NULL THEN 'delivered'
        ELSE 'sent'
      END
    )
  ) AS receipts
FROM messages m
JOIN users sender ON m.sender_id = sender.id
LEFT JOIN message_receipts mr ON m.id = mr.message_id
LEFT JOIN users recipient ON mr.user_id = recipient.id
WHERE m.conversation_id = 'YOUR_CONVERSATION_ID'
GROUP BY m.id, m.content, m.created_at, sender.name, sender.role
ORDER BY m.created_at ASC;
```

**Expected:** All messages with sender info and receipt status.

---

### 12. Test RLS Policies

Test that users can only see their own conversations:

1. **In Supabase Dashboard:**
   - Go to Authentication > Users
   - Use "Impersonate" to test as different users
   - Run queries to verify they only see conversations they participate in

2. **Or test via your app:**
   - Log in as tenant → should only see conversations where they're a participant
   - Log in as technician → should only see conversations where they're a participant

---

### 13. Test Realtime (In Your React App)

Add this to your chat component:

```typescript
import { useEffect } from 'react';
import { supabase } from './lib/supabase';

// Subscribe to new messages
useEffect(() => {
  const subscription = supabase
    .channel(`conversation-${conversationId}`)
    .on('postgres_changes', 
      { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`
      }, 
      (payload) => {
        console.log('New message received:', payload.new);
        // Add message to your state
        setMessages(prev => [...prev, payload.new]);
      }
    )
    .subscribe();

  // Subscribe to receipt updates
  const receiptSub = supabase
    .channel(`receipts-${conversationId}`)
    .on('postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'message_receipts',
        filter: `message_id=eq.${messageId}`
      },
      (payload) => {
        console.log('Receipt updated:', payload.new);
        // Update read/delivered indicators in UI
      }
    )
    .subscribe();

  return () => {
    subscription.unsubscribe();
    receiptSub.unsubscribe();
  };
}, [conversationId]);
```

**Expected:** Messages and receipt updates appear in real-time without page refresh.

---

## Quick Test Checklist

- [ ] Tables created successfully
- [ ] Conversation created with participants
- [ ] Message sent successfully
- [ ] Receipts auto-created (one per recipient)
- [ ] Conversation metadata auto-updated
- [ ] Message marked as delivered
- [ ] Message marked as read
- [ ] RLS policies working (users only see their conversations)
- [ ] Realtime subscriptions working

---

## Troubleshooting

### Receipts not being created
- Check if the trigger `trigger_create_message_receipts` exists
- Verify conversation_participants exist for the conversation

### Conversation not updating
- Check if the trigger `trigger_update_conversation_on_message` exists
- Verify the function `update_conversation_on_message()` exists

### RLS blocking queries
- Make sure you're authenticated
- Verify RLS policies are created correctly
- Check if user is a participant in the conversation

### Realtime not working
- Enable replication in Supabase Dashboard > Database > Replication
- Check browser console for connection errors
- Verify you're subscribed to the correct channel

---

## Next Steps

Once testing is complete:
1. Build the React chat component
2. Integrate with work orders UI
3. Add file attachment support (Supabase Storage)
4. Add typing indicators (optional)
5. Add message search (optional)

