-- Update work_orders RLS policy to use property_id from users table
-- This allows PMs to view work orders for their assigned property

-- Step 1: Drop the old "PM can view work orders in their properties" policy
DROP POLICY IF EXISTS "PM can view work orders in their properties" ON work_orders;

-- Step 2: Create updated policy that uses property_id from users table
CREATE POLICY "PM can view work orders in their properties"
ON work_orders
FOR SELECT
USING (
  -- PM can view work orders if:
  -- 1. The work order's property_id matches the PM's property_id
  EXISTS (
    SELECT 1 
    FROM users 
    WHERE users.id = auth.uid() 
    AND users.role = 'pm'
    AND users.property_id = work_orders.property_id
  )
  -- OR 2. User is a super admin (using the function we created)
  OR is_super_admin()
);

-- Verify the policy was created
SELECT 
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'work_orders' 
AND policyname = 'PM can view work orders in their properties';

