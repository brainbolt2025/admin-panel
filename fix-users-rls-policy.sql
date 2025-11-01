-- Fix the infinite recursion in "Super Admin full access to users" policy
-- Using a Security Definer function approach (more reliable)
--
-- WARNING: This script will modify RLS policies on the users table
-- Make sure you have a backup or understand what you're doing
--
-- Step 1: Create a function to check if user is super admin (avoids recursion)
-- This function queries auth.users (separate schema) not public.users, so no recursion
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM auth.users 
    WHERE auth.users.id = auth.uid() 
    AND (auth.users.raw_user_meta_data->>'role') = 'super_admin'
  );
$$;

-- Step 2: Grant execute permission on the function first
GRANT EXECUTE ON FUNCTION is_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION is_super_admin() TO anon;

-- Step 3: Drop the problematic policy (only if it exists)
-- This is safe because we're recreating it immediately after
DROP POLICY IF EXISTS "Super Admin full access to users" ON users;

-- Step 4: Create new policy using the function (no recursion)
-- This replaces the dropped policy with a non-recursive version
CREATE POLICY "Super Admin full access to users"
ON users
FOR ALL
USING (
  is_super_admin() 
  OR 
  auth.uid() = id
);

-- Verify the policy was created correctly
-- You can run this separately to check:
-- SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'users' AND policyname = 'Super Admin full access to users';
