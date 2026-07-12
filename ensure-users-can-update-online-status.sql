-- Ensure tenants and technicians can update their own online status
-- This verifies and creates the necessary RLS policy if it doesn't exist

-- Check if the policy exists
-- The existing policy "Super Admin full access to users" allows users to update their own records
-- via: auth.uid() = id

-- However, let's verify that the policy allows updating is_online and last_seen
-- If needed, we can create a specific policy or ensure the existing one works

-- Option 1: Verify existing policy works (it should based on auth.uid() = id)
-- Users can update their own records, including is_online and last_seen

-- Option 2: If you want to be explicit, create a specific policy for online status updates
-- (Only needed if the existing policy doesn't work)

-- Create a policy specifically for tenants and technicians to update their online status
DROP POLICY IF EXISTS "Users can update their own online status" ON users;

CREATE POLICY "Users can update their own online status"
ON users
FOR UPDATE
USING (
  -- Users can update their own record if they are the owner
  auth.uid() = id
  AND (
    -- Only tenants and technicians can update online status
    role = 'tenant' OR role = 'technician'
  )
)
WITH CHECK (
  -- Same check for the updated row
  auth.uid() = id
  AND (
    role = 'tenant' OR role = 'technician'
  )
);

-- Note: The existing "Super Admin full access to users" policy should already allow
-- users to update their own records (auth.uid() = id). This explicit policy is
-- optional but provides clarity and ensures only tenants/technicians can update
-- their online status.

-- Verify policies
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'users'
ORDER BY policyname;

