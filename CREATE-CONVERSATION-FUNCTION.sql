-- ============================================
-- CREATE CONVERSATION FUNCTION (SECURITY DEFINER)
-- ============================================
-- This function creates conversations with SECURITY DEFINER, bypassing RLS
-- Use this instead of direct INSERT for better RLS compatibility
--
-- Usage from mobile app:
-- SELECT create_conversation('work-order-uuid-here');

CREATE OR REPLACE FUNCTION create_conversation(p_work_order_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conversation_id UUID;
  v_tenant_id UUID;
  v_technician_id UUID;
  v_user_id UUID;
  v_user_role TEXT;
BEGIN
  -- Get current authenticated user
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;

  -- Get user role
  SELECT role INTO v_user_role
  FROM users
  WHERE id = v_user_id;

  IF v_user_role IS NULL THEN
    RAISE EXCEPTION 'User role not found';
  END IF;

  -- Get work order details
  SELECT 
    tenant_id,
    technician_id
  INTO v_tenant_id, v_technician_id
  FROM work_orders
  WHERE id = p_work_order_id;
  
  -- Check if work order exists
  IF v_tenant_id IS NULL AND v_technician_id IS NULL THEN
    RAISE EXCEPTION 'Work order not found: %', p_work_order_id;
  END IF;
  
  -- Validate that user is related to this work order
  IF v_user_role = 'tenant' AND v_tenant_id != v_user_id THEN
    RAISE EXCEPTION 'Tenant can only create conversations for their own work orders';
  END IF;

  IF v_user_role = 'technician' AND v_technician_id != v_user_id THEN
    RAISE EXCEPTION 'Technician can only create conversations for assigned work orders';
  END IF;

  IF v_user_role NOT IN ('tenant', 'technician', 'pm') THEN
    RAISE EXCEPTION 'User role % cannot create conversations', v_user_role;
  END IF;
  
  -- Check if conversation already exists
  SELECT id INTO v_conversation_id
  FROM conversations
  WHERE work_order_id = p_work_order_id;
  
  IF v_conversation_id IS NOT NULL THEN
    -- Conversation already exists, return it
    RETURN v_conversation_id;
  END IF;
  
  -- Create conversation (this bypasses RLS because function is SECURITY DEFINER)
  INSERT INTO conversations (work_order_id)
  VALUES (p_work_order_id)
  RETURNING id INTO v_conversation_id;
  
  -- Create participants using existing function
  PERFORM create_conversation_participants(p_work_order_id);
  
  RETURN v_conversation_id;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION create_conversation(UUID) TO authenticated;

-- ============================================
-- ALSO: Simplify the INSERT policy as fallback
-- ============================================
-- Even though we recommend using the function, keep a simple policy for direct inserts

DROP POLICY IF EXISTS "Users can create conversations for their work orders" ON conversations;

-- Very permissive policy - validation happens in the SECURITY DEFINER function
-- But we still need SOME policy when RLS is enabled
CREATE POLICY "Users can create conversations for their work orders"
  ON conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    work_order_id IS NOT NULL
    AND EXISTS (
      SELECT 1 
      FROM work_orders 
      WHERE id = work_order_id
        AND (
          tenant_id = auth.uid() OR
          technician_id = auth.uid() OR
          EXISTS (
            SELECT 1 
            FROM users 
            WHERE users.id = auth.uid() 
              AND users.role = 'pm'
              AND users.property_id = work_orders.property_id
          )
        )
    )
  );

-- ============================================
-- VERIFY
-- ============================================

SELECT 
  'Function created' as status,
  proname as function_name,
  prosecdef as is_security_definer
FROM pg_proc
WHERE proname = 'create_conversation';

SELECT 
  'Policy status' as status,
  policyname,
  cmd,
  roles::text
FROM pg_policies
WHERE tablename = 'conversations'
  AND cmd = 'INSERT';

