-- Allow anonymous (unauthenticated) users to view properties
-- This is needed for tenant signup so they can see all properties and pick one

-- Step 1: Drop the policy if it exists (to avoid errors on re-run)
DROP POLICY IF EXISTS "Anonymous users can view properties for signup" ON properties;

-- Step 2: Create policy for anonymous users to read properties
CREATE POLICY "Anonymous users can view properties for signup"
ON properties
FOR SELECT
TO anon
USING (true);  -- Allow all anonymous users to read properties (read-only)

-- Step 3: Verify the policy was created
SELECT 
  policyname,
  cmd,
  roles,
  qual
FROM pg_policies
WHERE tablename = 'properties' 
AND policyname = 'Anonymous users can view properties for signup';

-- Step 4: Test query (should work without authentication)
-- Run this without any auth headers to verify it works:
-- SELECT id, name FROM properties LIMIT 10;

-- Note: This policy only allows SELECT (read), not INSERT/UPDATE/DELETE
-- So anonymous users can only view properties, not modify them

