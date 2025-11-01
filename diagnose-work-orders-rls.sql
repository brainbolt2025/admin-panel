-- Diagnose work_orders RLS policies
-- This helps identify why PM users can't see work orders

-- 1. Check all work_orders policies in detail
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

-- 2. Check if you're logged in as a PM user
-- Replace auth.uid() with your actual user ID, or run this while authenticated:
SELECT 
  id,
  email,
  raw_user_meta_data->>'role' as role,
  raw_user_meta_data->>'name' as name
FROM auth.users
WHERE id = auth.uid();

-- 3. Test if the is_super_admin() function works
SELECT is_super_admin() as is_super_admin;

-- 4. Check what work orders exist (this will respect RLS policies)
SELECT COUNT(*) as total_work_orders FROM work_orders;

-- 5. Try to view work orders (will show only what RLS allows)
SELECT 
  id,
  title,
  status,
  priority,
  property_id,
  tenant_id
FROM work_orders
LIMIT 5;

-- 6. Check if there's a pm_properties or users table that links PMs to properties
-- This depends on your schema
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND (table_name LIKE '%pm%' OR table_name LIKE '%property%' OR table_name = 'users')
ORDER BY table_name;

-- 7. Check the "PM can view work orders in their properties" policy definition
-- The policy might be checking for property relationships that don't exist
-- We need to see the full USING clause

-- If you see "No work orders found", it could mean:
-- a) The table is empty (check with COUNT above)
-- b) The RLS policy is too restrictive
-- c) The PM user doesn't have properties assigned

