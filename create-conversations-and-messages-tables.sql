-- Create conversations and messages tables for chat functionality
-- This schema supports work-order-specific conversations between tenants, PMs, and technicians

-- Step 1: Create conversations table
-- Each conversation is linked to a work order and includes all participants
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  work_order_id UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Metadata
  last_message_at TIMESTAMPTZ,
  last_message_preview TEXT,
  
  -- Constraints
  CONSTRAINT conversations_work_order_id_unique UNIQUE (work_order_id)
);

-- Step 2: Create messages table
-- Individual messages within a conversation
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Optional: For file attachments (if using Supabase Storage)
  attachment_url TEXT,
  attachment_type TEXT -- 'image', 'document', etc.
);

-- Step 3: Create conversation_participants table (optional but recommended)
-- Explicitly track who is part of each conversation
-- This makes it easier to query "all conversations for user X"
CREATE TABLE IF NOT EXISTS conversation_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('tenant', 'technician')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  last_read_at TIMESTAMPTZ,
  
  -- Ensure a user can only be in a conversation once
  CONSTRAINT conversation_participants_unique UNIQUE (conversation_id, user_id)
);

-- Step 3.5: Create message_receipts table
-- Tracks delivered and read status per user per message
-- This allows you to show "delivered" and "read" indicators like WhatsApp/iMessage
CREATE TABLE IF NOT EXISTS message_receipts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Receipt status
  delivered_at TIMESTAMPTZ, -- When message was delivered to user (they're online/active)
  read_at TIMESTAMPTZ,      -- When user actually viewed/read the message
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure one receipt per user per message
  CONSTRAINT message_receipts_unique UNIQUE (message_id, user_id)
);

-- Step 4: Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_conversations_work_order_id 
  ON conversations(work_order_id);

CREATE INDEX IF NOT EXISTS idx_conversations_updated_at 
  ON conversations(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id 
  ON messages(conversation_id);

CREATE INDEX IF NOT EXISTS idx_messages_created_at 
  ON messages(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_sender_id 
  ON messages(sender_id);

CREATE INDEX IF NOT EXISTS idx_conversation_participants_user_id 
  ON conversation_participants(user_id);

CREATE INDEX IF NOT EXISTS idx_conversation_participants_conversation_id 
  ON conversation_participants(conversation_id);

CREATE INDEX IF NOT EXISTS idx_message_receipts_message_id 
  ON message_receipts(message_id);

CREATE INDEX IF NOT EXISTS idx_message_receipts_user_id 
  ON message_receipts(user_id);

CREATE INDEX IF NOT EXISTS idx_message_receipts_read_at 
  ON message_receipts(read_at) WHERE read_at IS NOT NULL;

-- Step 5: Create function to update conversation's updated_at and last_message_at
CREATE OR REPLACE FUNCTION update_conversation_on_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversations
  SET 
    updated_at = NOW(),
    last_message_at = NEW.created_at,
    last_message_preview = LEFT(NEW.content, 100) -- First 100 chars as preview
  WHERE id = NEW.conversation_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 6: Create trigger to automatically update conversation when message is added
DROP TRIGGER IF EXISTS trigger_update_conversation_on_message ON messages;
CREATE TRIGGER trigger_update_conversation_on_message
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_on_message();

-- Step 6.5: Create function to auto-create message receipts for all participants (except sender)
CREATE OR REPLACE FUNCTION create_message_receipts()
RETURNS TRIGGER AS $$
BEGIN
  -- Create receipts for all conversation participants except the sender
  INSERT INTO message_receipts (message_id, user_id, delivered_at)
  SELECT 
    NEW.id,
    cp.user_id,
    CASE 
      -- Auto-mark as delivered if user is currently active (you can enhance this logic)
      WHEN cp.user_id != NEW.sender_id THEN NOW()
      ELSE NULL
    END
  FROM conversation_participants cp
  WHERE cp.conversation_id = NEW.conversation_id
    AND cp.user_id != NEW.sender_id; -- Don't create receipt for sender
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 6.6: Create trigger to auto-create receipts when message is sent
DROP TRIGGER IF EXISTS trigger_create_message_receipts ON messages;
CREATE TRIGGER trigger_create_message_receipts
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION create_message_receipts();

-- Step 7: Create function to auto-create conversation participants when conversation is created
-- This function should be called from your application code, but here's a helper:
CREATE OR REPLACE FUNCTION create_conversation_participants(p_work_order_id UUID)
RETURNS UUID AS $$
DECLARE
  v_conversation_id UUID;
  v_tenant_id UUID;
  v_technician_id UUID;
  v_pm_id UUID;
BEGIN
  -- Get work order details
  SELECT 
    tenant_id,
    technician_id,
    property_id
  INTO v_tenant_id, v_technician_id, v_pm_id
  FROM work_orders
  WHERE id = p_work_order_id;
  
  -- Get PM from property
  SELECT user_id INTO v_pm_id
  FROM properties
  WHERE id = (SELECT property_id FROM work_orders WHERE id = p_work_order_id)
  LIMIT 1;
  
  -- Create conversation
  INSERT INTO conversations (work_order_id)
  VALUES (p_work_order_id)
  RETURNING id INTO v_conversation_id;
  
  -- Add tenant as participant
  IF v_tenant_id IS NOT NULL THEN
    INSERT INTO conversation_participants (conversation_id, user_id, role)
    VALUES (v_conversation_id, v_tenant_id, 'tenant')
    ON CONFLICT (conversation_id, user_id) DO NOTHING;
  END IF;
  
  -- Add technician as participant
  IF v_technician_id IS NOT NULL THEN
    INSERT INTO conversation_participants (conversation_id, user_id, role)
    VALUES (v_conversation_id, v_technician_id, 'technician')
    ON CONFLICT (conversation_id, user_id) DO NOTHING;
  END IF;
  
  -- Add PM as participant (if property has a PM)
  IF v_pm_id IS NOT NULL THEN
    INSERT INTO conversation_participants (conversation_id, user_id, role)
    VALUES (v_conversation_id, v_pm_id, 'pm')
    ON CONFLICT (conversation_id, user_id) DO NOTHING;
  END IF;
  
  RETURN v_conversation_id;
END;
$$ LANGUAGE plpgsql;

-- Step 8: Add comments for documentation
COMMENT ON TABLE conversations IS 'Chat conversations linked to work orders';
COMMENT ON TABLE messages IS 'Individual messages within conversations';
COMMENT ON TABLE conversation_participants IS 'Tracks which users are part of each conversation';
COMMENT ON TABLE message_receipts IS 'Tracks delivered and read status for each message per user';

COMMENT ON COLUMN conversations.work_order_id IS 'The work order this conversation is about';
COMMENT ON COLUMN messages.sender_id IS 'The user who sent this message';
COMMENT ON COLUMN messages.attachment_url IS 'URL to file in Supabase Storage (if message has attachment)';
COMMENT ON COLUMN conversation_participants.last_read_at IS 'When this user last read messages in this conversation';
COMMENT ON COLUMN message_receipts.delivered_at IS 'When the message was delivered to the user (they were online/active)';
COMMENT ON COLUMN message_receipts.read_at IS 'When the user actually viewed/read the message';

-- Step 9: Enable Row Level Security (RLS)
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_receipts ENABLE ROW LEVEL SECURITY;

-- Step 10: Create RLS policies
-- Users can only see conversations they're participants in
DROP POLICY IF EXISTS "Users can view conversations they participate in" ON conversations;
CREATE POLICY "Users can view conversations they participate in"
  ON conversations FOR SELECT
  USING (
    id IN (
      SELECT conversation_id 
      FROM conversation_participants 
      WHERE user_id = auth.uid()
    )
  );

-- Users can only see messages in conversations they participate in
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON messages;
CREATE POLICY "Users can view messages in their conversations"
  ON messages FOR SELECT
  USING (
    conversation_id IN (
      SELECT conversation_id 
      FROM conversation_participants 
      WHERE user_id = auth.uid()
    )
  );

-- Users can insert messages into conversations they participate in
DROP POLICY IF EXISTS "Users can send messages in their conversations" ON messages;
CREATE POLICY "Users can send messages in their conversations"
  ON messages FOR INSERT
  WITH CHECK (
    conversation_id IN (
      SELECT conversation_id 
      FROM conversation_participants 
      WHERE user_id = auth.uid()
    )
    AND sender_id = auth.uid()
  );

-- Users can view their own participant records
DROP POLICY IF EXISTS "Users can view their own participant records" ON conversation_participants;
CREATE POLICY "Users can view their own participant records"
  ON conversation_participants FOR SELECT
  USING (user_id = auth.uid());

-- Users can view receipts for messages in their conversations
DROP POLICY IF EXISTS "Users can view receipts for their messages" ON message_receipts;
CREATE POLICY "Users can view receipts for their messages"
  ON message_receipts FOR SELECT
  USING (
    message_id IN (
      SELECT m.id 
      FROM messages m
      INNER JOIN conversation_participants cp ON m.conversation_id = cp.conversation_id
      WHERE cp.user_id = auth.uid()
    )
  );

-- Users can update their own read receipts (mark messages as read)
DROP POLICY IF EXISTS "Users can update their own read receipts" ON message_receipts;
CREATE POLICY "Users can update their own read receipts"
  ON message_receipts FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users can update delivered_at for receipts where they are the recipient
DROP POLICY IF EXISTS "Users can mark messages as delivered" ON message_receipts;
CREATE POLICY "Users can mark messages as delivered"
  ON message_receipts FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Step 11: Grant necessary permissions (adjust based on your setup)
-- These are typically handled by RLS, but you may need explicit grants
GRANT SELECT, INSERT ON conversations TO authenticated;
GRANT SELECT, INSERT ON messages TO authenticated;
GRANT SELECT ON conversation_participants TO authenticated;
GRANT SELECT, UPDATE ON message_receipts TO authenticated;

-- Step 12: Enable Realtime for real-time chat updates
-- Add tables to the supabase_realtime publication for WebSocket subscriptions
-- This enables real-time updates via WebSocket for the chat functionality

DO $$
BEGIN
  -- Add conversations table to Realtime publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'conversations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
  END IF;

  -- Add messages table to Realtime publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE messages;
  END IF;

  -- Add message_receipts table to Realtime publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'message_receipts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE message_receipts;
  END IF;
EXCEPTION
  WHEN undefined_object THEN
    RAISE NOTICE 'supabase_realtime publication does not exist. Realtime may need to be enabled in Supabase Dashboard.';
END $$;

-- Verification queries
SELECT 'Conversations table created successfully' AS status;
SELECT 'Messages table created successfully' AS status;
SELECT 'Conversation participants table created successfully' AS status;
SELECT 'Message receipts table created successfully' AS status;

-- Verify Realtime is enabled for the tables
SELECT 
  schemaname,
  tablename,
  CASE 
    WHEN tablename IN ('conversations', 'messages', 'message_receipts') 
    THEN '✓ Realtime enabled'
    ELSE '✗ Not in Realtime'
  END AS realtime_status
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND tablename IN ('conversations', 'messages', 'message_receipts')
ORDER BY tablename;

-- Example queries for working with receipts:

-- Mark a message as delivered (call this when user is online/active)
-- UPDATE message_receipts 
-- SET delivered_at = NOW() 
-- WHERE message_id = 'message-uuid' AND user_id = auth.uid() AND delivered_at IS NULL;

-- Mark a message as read (call this when user views the message)
-- UPDATE message_receipts 
-- SET read_at = NOW() 
-- WHERE message_id = 'message-uuid' AND user_id = auth.uid() AND read_at IS NULL;

-- Get receipt status for a message (to show delivered/read indicators)
-- SELECT 
--   mr.user_id,
--   u.name,
--   mr.delivered_at,
--   mr.read_at,
--   CASE 
--     WHEN mr.read_at IS NOT NULL THEN 'read'
--     WHEN mr.delivered_at IS NOT NULL THEN 'delivered'
--     ELSE 'sent'
--   END AS status
-- FROM message_receipts mr
-- JOIN users u ON mr.user_id = u.id
-- WHERE mr.message_id = 'message-uuid'
-- ORDER BY mr.read_at DESC NULLS LAST, mr.delivered_at DESC NULLS LAST;

