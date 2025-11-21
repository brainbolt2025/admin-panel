-- ============================================
-- COMPLETE FIX FOR CONVERSATIONS RLS
-- ============================================
-- This fixes the RLS policy error when tenants/technicians try to create conversations
--
-- Problems fixed:
-- 1. Column reference in WITH CHECK clause (conversations.work_order_id -> work_order_id)
-- 2. Missing SELECT policies on work_orders for tenants/technicians
-- 3. Policy simplification to avoid recursion issues
--
-- ============================================
-- STEP 1: Ensure tenants can SELECT their work orders
-- ============================================
-- This is required for the EXISTS check in conversations INSERT policy to work

DROP POLICY IF EXISTS "Tenants can view their own work orders" ON work_orders;
CREATE POLICY "Tenants can view their own work orders"
  ON work_orders
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM users 
      WHERE users.id = auth.uid() 
        AND users.role = 'tenant'
        AND work_orders.tenant_id = auth.uid()
    )
  );

-- ============================================
-- STEP 2: Ensure technicians can SELECT their assigned work orders
-- ============================================

DROP POLICY IF EXISTS "Technicians can view their assigned work orders" ON work_orders;
CREATE POLICY "Technicians can view their assigned work orders"
  ON work_orders
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM users 
      WHERE users.id = auth.uid() 
        AND users.role = 'technician'
        AND work_orders.technician_id = auth.uid()
    )
  );

-- ============================================
-- STEP 3: Fix the conversations INSERT policy
-- ============================================
-- Key fix: In WITH CHECK, reference columns directly, not through table name

DROP POLICY IF EXISTS "Users can create conversations for their work orders" ON conversations;
CREATE POLICY "Users can create conversations for their work orders"
  ON conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- User must be authenticated AND
    -- The work_order_id must exist AND
    -- The user must be either the tenant OR technician for that work order
    work_order_id IS NOT NULL
    AND EXISTS (
      SELECT 1 
      FROM work_orders 
      WHERE id = work_order_id  -- Reference the column directly, not conversations.work_order_id
        AND (
          tenant_id = auth.uid() OR
          technician_id = auth.uid()
        )
    )
  );

-- ============================================
-- STEP 4: Verify all policies exist
-- ============================================

SELECT 
  'work_orders policies' as table_name,
  policyname,
  cmd,
  roles::text
FROM pg_policies
WHERE tablename = 'work_orders'
  AND policyname IN (
    'Tenants can view their own work orders',
    'Technicians can view their assigned work orders'
  )
ORDER BY policyname;

SELECT 
  'conversations policies' as table_name,
  policyname,
  cmd,
  roles::text,
  with_check
FROM pg_policies
WHERE tablename = 'conversations'
  AND cmd = 'INSERT'
ORDER BY policyname;

-- ============================================
-- STEP 5: Test the policy (diagnostic query)
-- ============================================
-- This will show what the policy sees for the current user
-- Run this as a tenant or technician to verify

SELECT 
  'Policy Test' as test_name,
  auth.uid() as current_user_id,
  (
    SELECT COUNT(*) 
    FROM work_orders 
    WHERE tenant_id = auth.uid() OR technician_id = auth.uid()
  ) as accessible_work_orders_count,
  (
    SELECT COUNT(*) 
    FROM pg_policies 
    WHERE tablename = 'conversations' 
      AND cmd = 'INSERT'
  ) as conversations_insert_policies_count;

