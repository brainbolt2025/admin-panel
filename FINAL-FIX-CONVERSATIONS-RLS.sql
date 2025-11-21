-- ============================================
-- FINAL FIX FOR CONVERSATIONS RLS
-- ============================================
-- This fixes the PostgREST RLS error when mobile app directly inserts conversations
-- 
-- The problem: Direct INSERT via PostgREST fails RLS check
-- Solution: Ensure work_orders SELECT policies exist AND fix the INSERT policy
--
-- ============================================
-- STEP 1: Ensure tenants can SELECT their work orders
-- ============================================
-- CRITICAL: Without this, the EXISTS check in conversations INSERT will fail

DROP POLICY IF EXISTS "Tenants can view their own work orders" ON work_orders;
CREATE POLICY "Tenants can view their own work orders"
  ON work_orders
  FOR SELECT
  TO authenticated
  USING (
    -- Simple check: tenant_id matches authenticated user
    tenant_id = auth.uid()
    AND EXISTS (
      SELECT 1 
      FROM users 
      WHERE id = auth.uid() 
        AND role = 'tenant'
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
    -- Simple check: technician_id matches authenticated user
    technician_id = auth.uid()
    AND EXISTS (
      SELECT 1 
      FROM users 
      WHERE id = auth.uid() 
        AND role = 'technician'
    )
  );

-- ============================================
-- STEP 3: Drop ALL existing conversations INSERT policies
-- ============================================

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
-- STEP 4: Create SIMPLE and RELIABLE INSERT policy
-- ============================================
-- Key fixes:
-- 1. Use work_order_id directly (not conversations.work_order_id)
-- 2. Simplify the EXISTS check to avoid recursion
-- 3. Check user role first to avoid unnecessary queries

CREATE POLICY "Users can create conversations for their work orders"
  ON conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Must have work_order_id
    work_order_id IS NOT NULL
    -- AND user must be authenticated with valid role
    AND EXISTS (
      SELECT 1 
      FROM users 
      WHERE id = auth.uid() 
        AND role IN ('tenant', 'technician', 'pm')
    )
    -- AND work order must exist AND user must be related to it
    AND EXISTS (
      SELECT 1 
      FROM work_orders 
      WHERE id = work_order_id
        AND (
          -- User is the tenant
          tenant_id = auth.uid()
          OR
          -- User is the technician
          technician_id = auth.uid()
          OR
          -- User is the PM for this property
          EXISTS (
            SELECT 1 
            FROM users u
            WHERE u.id = auth.uid()
              AND u.role = 'pm'
              AND u.property_id = work_orders.property_id
          )
        )
    )
  );

-- ============================================
-- STEP 5: Verify all policies exist
-- ============================================

SELECT 
  'work_orders SELECT policies' as table_name,
  policyname,
  cmd,
  roles::text
FROM pg_policies
WHERE tablename = 'work_orders'
  AND cmd = 'SELECT'
  AND (policyname LIKE '%Tenant%' OR policyname LIKE '%Technician%')
ORDER BY policyname;

SELECT 
  'conversations INSERT policy' as table_name,
  policyname,
  cmd,
  roles::text,
  CASE 
    WHEN with_check LIKE '%work_order_id IS NOT NULL%' THEN '✓ Policy created'
    ELSE '⚠ Check policy'
  END as status
FROM pg_policies
WHERE tablename = 'conversations'
  AND cmd = 'INSERT'
ORDER BY policyname;

-- ============================================
-- STEP 6: Test diagnostics
-- ============================================

SELECT 
  'Diagnostics' as info,
  (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'work_orders' AND cmd = 'SELECT' AND policyname LIKE '%Tenant%') as tenant_wo_policies,
  (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'work_orders' AND cmd = 'SELECT' AND policyname LIKE '%Technician%') as technician_wo_policies,
  (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'conversations' AND cmd = 'INSERT') as conversations_insert_policies;

-- Expected: tenant_wo_policies = 1, technician_wo_policies = 1, conversations_insert_policies = 1

-- ============================================
-- ALTERNATIVE: Use SECURITY DEFINER function
-- ============================================
-- If the policy still doesn't work, use this function instead:
-- Mobile app should call: SELECT create_conversation_participants('work-order-uuid')
-- This function already exists and is SECURITY DEFINER, so it bypasses RLS

SELECT 
  'Alternative approach' as info,
  proname as function_name,
  prosecdef as is_security_definer,
  'Call this function instead of direct INSERT' as usage
FROM pg_proc
WHERE proname = 'create_conversation_participants';

