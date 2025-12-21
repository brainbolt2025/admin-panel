-- Fix work_orders INSERT policy to allow tenants to create work orders
-- This fixes the RLS error "new row violates row-level security policy for table 'work_orders'"

-- Step 1: Drop existing INSERT policy if it exists
DROP POLICY IF EXISTS "Tenants can create their own work orders" ON work_orders;
DROP POLICY IF EXISTS "Tenants can insert work orders" ON work_orders;

-- Step 2: Create INSERT policy for tenants
-- Tenants can create work orders if:
-- 1. The tenant_id in the work order matches the authenticated user's id
-- 2. The user is actually a tenant (role = 'tenant')
CREATE POLICY "Tenants can create their own work orders"
ON work_orders
FOR INSERT
WITH CHECK (
  -- Check that the user is a tenant
  EXISTS (
    SELECT 1 
    FROM users 
    WHERE users.id = auth.uid() 
    AND users.role = 'tenant'
  )
  -- AND the tenant_id in the new row matches the authenticated user
  AND tenant_id = auth.uid()
);

-- Step 3: Also allow PMs to insert work orders (if needed for admin panel)
DROP POLICY IF EXISTS "PMs can create work orders in their properties" ON work_orders;
CREATE POLICY "PMs can create work orders in their properties"
ON work_orders
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM users 
    WHERE users.id = auth.uid() 
    AND users.role = 'pm'
    AND users.property_id = work_orders.property_id
  )
  OR is_super_admin()
);

-- Step 4: Verify super admin policy exists (don't recreate if it exists, as it might conflict)
-- Super admin policy should already exist from previous migrations
-- If it doesn't exist, run this:
/*
DROP POLICY IF EXISTS "Super Admin full access to work orders" ON work_orders;
CREATE POLICY "Super Admin full access to work orders"
ON work_orders
FOR ALL
USING (
  EXISTS (
    SELECT 1 
    FROM users 
    WHERE users.id = auth.uid() 
    AND users.role = 'super_admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM users 
    WHERE users.id = auth.uid() 
    AND users.role = 'super_admin'
  )
);
*/

-- Step 5: Verify the policies were created
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'work_orders'
ORDER BY cmd, policyname;

