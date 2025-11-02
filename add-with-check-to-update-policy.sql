-- Update the existing UPDATE policy to include WITH CHECK clause
-- This is needed for UPDATE operations to work properly

-- Drop the existing policy
DROP POLICY IF EXISTS "PM can update work orders in their properties" ON work_orders;

-- Recreate with both USING and WITH CHECK clauses
CREATE POLICY "PM can update work orders in their properties"
ON work_orders
FOR UPDATE
USING (
  -- PM can update work orders if:
  -- 1. The work order's property_id matches the PM's property_id
  EXISTS (
    SELECT 1 
    FROM users 
    WHERE users.id = auth.uid() 
    AND users.role = 'pm'
    AND users.property_id = work_orders.property_id
  )
  -- OR 2. User is a super admin
  OR is_super_admin()
)
WITH CHECK (
  -- Same conditions for the updated row
  EXISTS (
    SELECT 1 
    FROM users 
    WHERE users.id = auth.uid() 
    AND users.role = 'pm'
    AND users.property_id = work_orders.property_id
  )
  OR is_super_admin()
);

-- Verify the policy was recreated
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'work_orders' 
AND policyname = 'PM can update work orders in their properties';

