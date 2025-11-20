-- IMMEDIATE FIX: Create Required Policy
-- RLS is enabled but NO policies exist = BLOCKS EVERYTHING
-- You MUST have at least one policy when RLS is enabled

-- ============================================
-- STEP 1: Check current state
-- ============================================
SELECT 
  'Current State' as info,
  tablename,
  rowsecurity as rls_enabled,
  (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'conversations') as policy_count,
  CASE 
    WHEN rowsecurity AND (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'conversations') = 0 
    THEN '✗ RLS ENABLED + NO POLICIES = BLOCKED'
    WHEN rowsecurity 
    THEN '✓ RLS ENABLED + POLICIES EXIST'
    ELSE 'RLS DISABLED'
  END as status
FROM pg_tables
WHERE schemaname = 'public' 
  AND tablename = 'conversations';

-- ============================================
-- STEP 2: Create the required INSERT policy
-- ============================================
-- This policy allows authenticated users to INSERT
CREATE POLICY "conversations_insert_required"
  ON public.conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (work_order_id IS NOT NULL);

-- Also create for 'public' role (more permissive)
CREATE POLICY "conversations_insert_public"
  ON public.conversations
  FOR INSERT
  TO public
  WITH CHECK (work_order_id IS NOT NULL);

-- ============================================
-- STEP 3: Verify policies were created
-- ============================================
SELECT 
  'Verification' as info,
  policyname,
  cmd,
  roles::text,
  '✓ Policy created' as status
FROM pg_policies
WHERE tablename = 'conversations'
  AND cmd = 'INSERT'
ORDER BY policyname;

-- ============================================
-- ALTERNATIVE: Disable RLS (if policies still don't work)
-- ============================================
-- WARNING: This removes all security - use only if policies won't work
-- Uncomment this line if you want to disable RLS:
/*
ALTER TABLE public.conversations DISABLE ROW LEVEL SECURITY;
*/

-- Check if RLS is disabled after running above:
/*
SELECT 
  'RLS Status' as info,
  rowsecurity as rls_enabled,
  CASE 
    WHEN rowsecurity THEN 'RLS is ENABLED'
    ELSE '✓ RLS is DISABLED (all operations allowed)'
  END as status
FROM pg_tables
WHERE schemaname = 'public' 
  AND tablename = 'conversations';
*/

