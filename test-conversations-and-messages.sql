-- Test script for conversations and messages functionality
-- Run this after executing create-conversations-and-messages-tables.sql

-- ============================================
-- STEP 1: Verify Tables Were Created
-- ============================================
SELECT 'Step 1: Verifying tables exist...' AS test_step;

SELECT 
  table_name,
  CASE WHEN table_name IN ('conversations', 'messages', 'conversation_participants', 'message_receipts')
    THEN '✓ Created'
    ELSE '✗ Missing'
  END AS status
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('conversations', 'messages', 'conversation_participants', 'message_receipts')
ORDER BY table_name;

-- ============================================
-- STEP 2: Get Test Data (Work Orders and Users)
-- ============================================
SELECT 'Step 2: Getting test data...' AS test_step;

-- Get a work order with tenant and technician
SELECT 
  wo.id AS work_order_id,
  wo.title,
  wo.tenant_id,
  wo.technician_id,
  wo.property_id,
  t.name AS tenant_name,
  tech.name AS technician_name
FROM work_orders wo
LEFT JOIN users t ON wo.tenant_id = t.id
LEFT JOIN users tech ON wo.technician_id = tech.id
WHERE wo.tenant_id IS NOT NULL
LIMIT 1;

-- Save the IDs from above query for next steps
-- Let's assume you have:
-- work_order_id: (copy from above)
-- tenant_id: (copy from above)
-- technician_id: (copy from above)

-- ============================================
-- STEP 3: Test Creating a Conversation
-- ============================================
SELECT 'Step 3: Testing conversation creation...' AS test_step;

-- Replace 'YOUR_WORK_ORDER_ID' with actual work order ID from Step 2
-- Example:
-- SELECT create_conversation_participants('215274b3-e697-4d2f-bbb8-2dcf470141b9');

-- This will:
-- 1. Create a conversation linked to the work order
-- 2. Add tenant, technician (and PM if property has one) as participants
-- 3. Return the conversation_id

-- ============================================
-- STEP 4: Verify Conversation and Participants
-- ============================================
SELECT 'Step 4: Verifying conversation and participants...' AS test_step;

-- Replace 'YOUR_CONVERSATION_ID' with the ID returned from Step 3
/*
SELECT 
  c.id AS conversation_id,
  c.work_order_id,
  wo.title AS work_order_title,
  c.created_at,
  c.updated_at,
  c.last_message_at,
  c.last_message_preview
FROM conversations c
JOIN work_orders wo ON c.work_order_id = wo.id
WHERE c.id = 'YOUR_CONVERSATION_ID';
*/

-- Check participants
/*
SELECT 
  cp.id,
  cp.conversation_id,
  cp.user_id,
  u.name AS user_name,
  u.email,
  u.role,
  cp.role AS participant_role,
  cp.joined_at,
  cp.last_read_at
FROM conversation_participants cp
JOIN users u ON cp.user_id = u.id
WHERE cp.conversation_id = 'YOUR_CONVERSATION_ID'
ORDER BY cp.joined_at;
*/

-- ============================================
-- STEP 5: Test Sending Messages
-- ============================================
SELECT 'Step 5: Testing message creation...' AS test_step;

-- Replace with actual IDs:
-- conversation_id: from Step 3
-- sender_id: tenant_id or technician_id from Step 2

/*
-- Send a message as tenant
INSERT INTO messages (conversation_id, sender_id, content)
VALUES (
  'YOUR_CONVERSATION_ID',
  'YOUR_TENANT_ID',
  'Hello! I have a question about the work order.'
)
RETURNING id, conversation_id, sender_id, content, created_at;
*/

-- After inserting, check:
-- 1. Message was created
-- 2. Conversation updated_at was updated
-- 3. Conversation last_message_at was set
-- 4. Conversation last_message_preview was set
-- 5. Message receipts were auto-created for all participants except sender

-- ============================================
-- STEP 6: Verify Message Receipts Were Created
-- ============================================
SELECT 'Step 6: Verifying message receipts...' AS test_step;

-- Replace 'YOUR_MESSAGE_ID' with the message ID from Step 5
/*
SELECT 
  mr.id,
  mr.message_id,
  mr.user_id,
  u.name AS recipient_name,
  u.email,
  mr.delivered_at,
  mr.read_at,
  CASE 
    WHEN mr.read_at IS NOT NULL THEN 'read'
    WHEN mr.delivered_at IS NOT NULL THEN 'delivered'
    ELSE 'sent'
  END AS status,
  mr.created_at
FROM message_receipts mr
JOIN users u ON mr.user_id = u.id
WHERE mr.message_id = 'YOUR_MESSAGE_ID'
ORDER BY mr.created_at;
*/

-- Expected: You should see receipts for all participants EXCEPT the sender
-- Status should be 'sent' (delivered_at and read_at are NULL)

-- ============================================
-- STEP 7: Test Marking Message as Delivered
-- ============================================
SELECT 'Step 7: Testing delivered receipt...' AS test_step;

-- Replace with actual IDs:
-- message_id: from Step 5
-- user_id: technician_id (the recipient)

/*
-- Mark message as delivered (when recipient is online/active)
UPDATE message_receipts 
SET delivered_at = NOW()
WHERE message_id = 'YOUR_MESSAGE_ID' 
  AND user_id = 'YOUR_TECHNICIAN_ID'
  AND delivered_at IS NULL
RETURNING id, message_id, user_id, delivered_at, read_at;
*/

-- Verify the update
/*
SELECT 
  mr.message_id,
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
*/

-- ============================================
-- STEP 8: Test Marking Message as Read
-- ============================================
SELECT 'Step 8: Testing read receipt...' AS test_step;

-- Replace with actual IDs:
-- message_id: from Step 5
-- user_id: technician_id (the recipient)

/*
-- Mark message as read (when recipient views the message)
UPDATE message_receipts 
SET read_at = NOW()
WHERE message_id = 'YOUR_MESSAGE_ID' 
  AND user_id = 'YOUR_TECHNICIAN_ID'
  AND read_at IS NULL
RETURNING id, message_id, user_id, delivered_at, read_at;
*/

-- Verify the update
/*
SELECT 
  mr.message_id,
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
*/

-- ============================================
-- STEP 9: Test Conversation Auto-Update Trigger
-- ============================================
SELECT 'Step 9: Testing conversation auto-update...' AS test_step;

-- Send another message and verify conversation metadata updated
/*
-- Get conversation state before
SELECT 
  id,
  updated_at,
  last_message_at,
  last_message_preview
FROM conversations
WHERE id = 'YOUR_CONVERSATION_ID';

-- Send another message
INSERT INTO messages (conversation_id, sender_id, content)
VALUES (
  'YOUR_CONVERSATION_ID',
  'YOUR_TECHNICIAN_ID',
  'I can help with that. What do you need?'
)
RETURNING id, created_at;

-- Check conversation was updated
SELECT 
  id,
  updated_at,
  last_message_at,
  last_message_preview
FROM conversations
WHERE id = 'YOUR_CONVERSATION_ID';
*/

-- Expected: updated_at, last_message_at, and last_message_preview should be updated

-- ============================================
-- STEP 10: Test Full Conversation Query
-- ============================================
SELECT 'Step 10: Testing full conversation query...' AS test_step;

-- Get all messages in a conversation with sender info and receipt status
/*
SELECT 
  m.id AS message_id,
  m.content,
  m.created_at,
  sender.name AS sender_name,
  sender.role AS sender_role,
  -- Receipt status for each recipient
  json_agg(
    json_build_object(
      'recipient', recipient.name,
      'status', CASE 
        WHEN mr.read_at IS NOT NULL THEN 'read'
        WHEN mr.delivered_at IS NOT NULL THEN 'delivered'
        ELSE 'sent'
      END,
      'delivered_at', mr.delivered_at,
      'read_at', mr.read_at
    )
  ) AS receipts
FROM messages m
JOIN users sender ON m.sender_id = sender.id
LEFT JOIN message_receipts mr ON m.id = mr.message_id
LEFT JOIN users recipient ON mr.user_id = recipient.id
WHERE m.conversation_id = 'YOUR_CONVERSATION_ID'
GROUP BY m.id, m.content, m.created_at, sender.name, sender.role
ORDER BY m.created_at ASC;
*/

-- ============================================
-- STEP 11: Test RLS Policies
-- ============================================
SELECT 'Step 11: Testing RLS policies...' AS test_step;

-- Test as different users (you'll need to switch auth context)
-- In Supabase Dashboard, you can test this by:
-- 1. Going to Authentication > Users
-- 2. Using "Impersonate" feature to test as different users
-- 3. Running queries to see if they can only see their own conversations

-- Or test via your application with different user sessions

-- ============================================
-- STEP 12: Test Realtime (Optional)
-- ============================================
SELECT 'Step 12: Testing Realtime subscriptions...' AS test_step;

-- In your React app, you can test with:
/*
import { supabase } from './lib/supabase';

// Subscribe to new messages
const subscription = supabase
  .channel('messages')
  .on('postgres_changes', 
    { 
      event: 'INSERT', 
      schema: 'public', 
      table: 'messages',
      filter: `conversation_id=eq.${conversationId}`
    }, 
    (payload) => {
      console.log('New message:', payload.new);
      // Update your UI with the new message
    }
  )
  .subscribe();

// Subscribe to receipt updates
const receiptSubscription = supabase
  .channel('receipts')
  .on('postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'message_receipts',
      filter: `message_id=eq.${messageId}`
    },
    (payload) => {
      console.log('Receipt updated:', payload.new);
      // Update read/delivered indicators
    }
  )
  .subscribe();
*/

-- ============================================
-- QUICK TEST SCRIPT (Copy and modify with your IDs)
-- ============================================

/*
-- 1. Create conversation (replace WORK_ORDER_ID)
SELECT create_conversation_participants('WORK_ORDER_ID') AS conversation_id;

-- 2. Send message as tenant (replace CONVERSATION_ID and TENANT_ID)
INSERT INTO messages (conversation_id, sender_id, content)
VALUES ('CONVERSATION_ID', 'TENANT_ID', 'Test message from tenant')
RETURNING id AS message_id;

-- 3. Check receipts (replace MESSAGE_ID)
SELECT 
  u.name,
  mr.delivered_at,
  mr.read_at,
  CASE 
    WHEN mr.read_at IS NOT NULL THEN 'read'
    WHEN mr.delivered_at IS NOT NULL THEN 'delivered'
    ELSE 'sent'
  END AS status
FROM message_receipts mr
JOIN users u ON mr.user_id = u.id
WHERE mr.message_id = 'MESSAGE_ID';

-- 4. Mark as delivered (replace MESSAGE_ID and TECHNICIAN_ID)
UPDATE message_receipts 
SET delivered_at = NOW()
WHERE message_id = 'MESSAGE_ID' AND user_id = 'TECHNICIAN_ID';

-- 5. Mark as read (replace MESSAGE_ID and TECHNICIAN_ID)
UPDATE message_receipts 
SET read_at = NOW()
WHERE message_id = 'MESSAGE_ID' AND user_id = 'TECHNICIAN_ID';

-- 6. Get all messages in conversation (replace CONVERSATION_ID)
SELECT 
  m.id,
  m.content,
  m.created_at,
  sender.name AS sender,
  sender.role AS sender_role
FROM messages m
JOIN users sender ON m.sender_id = sender.id
WHERE m.conversation_id = 'CONVERSATION_ID'
ORDER BY m.created_at ASC;
*/

