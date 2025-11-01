-- Setup RLS policies for work_orders table to allow PM users to view their work orders
-- Run this after fixing the users table RLS policy

-- Check if RLS is enabled on work_orders
ALTER TABLE work_orders ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "PMs can view their work orders" ON work_orders;
DROP POLICY IF EXISTS "Users can view work orders" ON work_orders;

-- Create policy for PM users to view work orders
-- PMs should be able to see work orders for properties they manage
-- You may need to adjust this based on how PM-property relationships are stored
CREATE POLICY "PMs can view their work orders"
ON work_orders
FOR SELECT
USING (
  -- Allow if user is a PM (check from auth.users metadata)
  EXISTS (
    SELECT 1 
    FROM auth.users 
    WHERE auth.users.id = auth.uid() 
    AND (auth.users.raw_user_meta_data->>'role') = 'pm'
  )
  -- OR allow super admins (using the function we created)
  OR is_super_admin()
);

-- If PMs are linked to properties through a separate table, you might need a different policy
-- For example, if there's a pm_properties table:
-- CREATE POLICY "PMs can view their work orders"
-- ON work_orders
-- FOR SELECT
-- USING (
--   property_id IN (
--     SELECT property_id FROM pm_properties WHERE pm_id = auth.uid()
--   )
-- );

