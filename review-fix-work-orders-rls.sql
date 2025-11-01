-- Review and fix RLS policies for work_orders table
-- Based on the policies you showed me

-- First, let's see the full details of existing policies
SELECT 
  policyname,
  cmd,
  permissive,
  roles,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'work_orders'
ORDER BY cmd, policyname;

-- ISSUE FOUND: "Tenant can create work orders for own property" has SELECT instead of INSERT
-- Let's fix it:

-- Step 1: Drop the incorrect policy
DROP POLICY IF EXISTS "Tenant can create work orders for own property" ON work_orders;

-- Step 2: Create correct INSERT policy for tenants
CREATE POLICY "Tenant can create work orders for own property"
ON work_orders
FOR INSERT
WITH CHECK (
  -- Tenant can only create work orders for their own tenant_id
  tenant_id = auth.uid()
  OR
  -- Or if tenant_id matches the authenticated user's ID
  EXISTS (
    SELECT 1 
    FROM tenants 
    WHERE tenants.id = work_orders.tenant_id 
    AND tenants.user_id = auth.uid()
  )
);

-- Verify PM policies are correct and working
-- The "PM can view work orders in their properties" policy should allow PMs to see work orders
-- If it's not working, we may need to check how PM-property relationships are stored

-- Check if PMs have access (this query helps debug)
-- Replace YOUR_PM_USER_ID with an actual PM user UUID:
-- SELECT 
--   wo.*,
--   is_super_admin() as is_super_admin,
--   (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) as user_role
-- FROM work_orders wo
-- LIMIT 1;

