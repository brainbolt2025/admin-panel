-- ============================================
-- FIX: conversation_participants role constraint
-- ============================================
-- The constraint only allowed 'tenant' and 'technician', but the function
-- also tries to add 'pm' (property manager) as a participant.
-- This fix updates the constraint to include 'pm'.

-- Step 1: Drop the existing constraint
ALTER TABLE conversation_participants 
DROP CONSTRAINT IF EXISTS conversation_participants_role_check;

-- Step 2: Add the updated constraint that includes 'pm'
ALTER TABLE conversation_participants
ADD CONSTRAINT conversation_participants_role_check 
CHECK (role IN ('tenant', 'technician', 'pm'));

-- Step 3: Verify the constraint was updated
SELECT 
  'Constraint updated' as status,
  conname as constraint_name,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conname = 'conversation_participants_role_check'
  AND conrelid = 'conversation_participants'::regclass;

-- Expected output should show: CHECK (role IN ('tenant', 'technician', 'pm'))

