-- ============================================
-- CLEANUP ALL CONVERSATIONS INSERT POLICIES
-- ============================================
-- This removes duplicate policies and creates one correct policy
-- The fact that you see 3 INSERT policies means there are duplicates from previous fix attempts

-- ============================================
-- STEP 1: List all existing INSERT policies on conversations
-- ============================================
SELECT 
  'Existing policies (will be dropped)' as info,
  policyname,
  cmd,
  roles::text,
  with_check
FROM pg_policies
WHERE tablename = 'conversations'
  AND cmd = 'INSERT'
ORDER BY policyname;

-- ============================================
-- STEP 2: Drop ALL existing INSERT policies
-- ============================================
-- This ensures we start fresh

DO $$
DECLARE
  policy_record RECORD;
BEGIN
  FOR policy_record IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE tablename = 'conversations' 
      AND cmd = 'INSERT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON conversations', policy_record.policyname);
    RAISE NOTICE 'Dropped policy: %', policy_record.policyname;
  END LOOP;
END $$;

-- ============================================
-- STEP 3: Create the ONE correct INSERT policy
-- ============================================

CREATE POLICY "Users can create conversations for their work orders"
  ON conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- User must provide a work_order_id
    work_order_id IS NOT NULL
    -- AND user must be tenant or technician for that work order
    AND EXISTS (
      SELECT 1 
      FROM work_orders 
      WHERE id = work_order_id  -- Reference column directly
        AND (
          tenant_id = auth.uid() OR
          technician_id = auth.uid()
        )
    )
  );

-- ============================================
-- STEP 4: Verify - should now show only 1 policy
-- ============================================

SELECT 
  'After cleanup' as info,
  policyname,
  cmd,
  roles::text,
  CASE 
    WHEN with_check LIKE '%work_order_id IS NOT NULL%' THEN '✓ Correct policy'
    ELSE '⚠ Check policy definition'
  END as status
FROM pg_policies
WHERE tablename = 'conversations'
  AND cmd = 'INSERT'
ORDER BY policyname;

-- ============================================
-- STEP 5: Ensure work_orders SELECT policies exist
-- ============================================
-- These are required for the EXISTS check to work

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
-- STEP 6: Final verification
-- ============================================

SELECT 
  'Final Status' as info,
  (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'conversations' AND cmd = 'INSERT') as conversations_insert_policies,
  (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'work_orders' AND policyname LIKE '%Tenant%' AND cmd = 'SELECT') as tenant_work_orders_policies,
  (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'work_orders' AND policyname LIKE '%Technician%' AND cmd = 'SELECT') as technician_work_orders_policies;

-- Expected results:
-- conversations_insert_policies: 1
-- tenant_work_orders_policies: 1
-- technician_work_orders_policies: 1


