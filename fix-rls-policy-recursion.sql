-- Fix infinite recursion in users table RLS policy
-- This error typically occurs when a policy references itself or creates a circular dependency

-- First, let's check existing policies (you can run this to see what policies exist)
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
-- FROM pg_policies 
-- WHERE tablename = 'users';

-- Option 1: Disable RLS temporarily to identify the problematic policy
-- ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- Option 2: Drop and recreate policies that might be causing recursion
-- Common issue: Policy that checks users table while querying users table

-- Example of a problematic policy (DO NOT RUN - just an example):
-- CREATE POLICY "Users can view their own data"
-- ON users FOR SELECT
-- USING (auth.uid() = id OR EXISTS (
--   SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
-- ));
-- The above would cause recursion because it queries users while checking users

-- Safe policy example (users can view their own record):
-- DROP POLICY IF EXISTS "Users can view own data" ON users;
-- CREATE POLICY "Users can view own data"
-- ON users FOR SELECT
-- USING (auth.uid() = id);

-- Safe policy for PM role check (if needed):
-- DROP POLICY IF EXISTS "PMs can view work orders" ON work_orders;
-- CREATE POLICY "PMs can view work orders"
-- ON work_orders FOR SELECT
-- USING (
--   EXISTS (
--     SELECT 1 FROM auth.users 
--     WHERE auth.users.id = auth.uid() 
--     AND auth.users.raw_user_meta_data->>'role' = 'pm'
--   )
-- );

-- For now, if you need to allow authenticated users to query work_orders without recursion:
-- You can temporarily disable RLS on users table or create a simpler policy

-- To check which policy is causing the issue, run:
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'users';

-- Then review the policies and fix any that reference the users table within their USING clause

