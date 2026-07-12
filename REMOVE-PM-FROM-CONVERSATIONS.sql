-- ============================================
-- REMOVE PM FROM CONVERSATION PARTICIPANTS
-- ============================================
-- This script removes PM from conversation participants
-- Only tenants and technicians participate in conversations
--
-- Step 1: Remove PM participants from existing conversations (optional cleanup)
-- ============================================

DELETE FROM conversation_participants 
WHERE role = 'pm';

-- ============================================
-- Step 2: Update the database function to not add PM
-- ============================================

CREATE OR REPLACE FUNCTION create_conversation_participants(p_work_order_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conversation_id UUID;
  v_tenant_id UUID;
  v_technician_id UUID;
  v_property_id UUID;
BEGIN
  -- Get work order details
  SELECT 
    tenant_id,
    technician_id,
    property_id
  INTO v_tenant_id, v_technician_id, v_property_id
  FROM work_orders
  WHERE id = p_work_order_id;
  
  -- Check if work order exists
  IF v_property_id IS NULL THEN
    RAISE EXCEPTION 'Work order not found: %', p_work_order_id;
  END IF;
  
  -- Check if conversation already exists
  SELECT id INTO v_conversation_id
  FROM conversations
  WHERE work_order_id = p_work_order_id;
  
  IF v_conversation_id IS NOT NULL THEN
    -- Conversation already exists, return it
    RETURN v_conversation_id;
  END IF;
  
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
  
  -- Note: PMs are NOT added as participants (only tenants and technicians)
  
  RETURN v_conversation_id;
END;
$$;

-- ============================================
-- Step 3: Ensure constraint only allows tenant and technician
-- ============================================

ALTER TABLE conversation_participants 
DROP CONSTRAINT IF EXISTS conversation_participants_role_check;

ALTER TABLE conversation_participants
ADD CONSTRAINT conversation_participants_role_check 
CHECK (role IN ('tenant', 'technician'));

-- ============================================
-- Step 4: Verify the constraint
-- ============================================

SELECT 
  'Constraint updated' as status,
  conname as constraint_name,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conname = 'conversation_participants_role_check'
  AND conrelid = 'conversation_participants'::regclass;

-- Expected: CHECK (role IN ('tenant', 'technician'))

-- ============================================
-- Step 5: Verify function was updated
-- ============================================

SELECT 
  'Function updated' as status,
  proname as function_name,
  prosecdef as is_security_definer
FROM pg_proc
WHERE proname = 'create_conversation_participants';


