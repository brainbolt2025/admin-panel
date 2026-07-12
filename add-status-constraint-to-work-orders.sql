-- Add status constraint to work_orders table
-- Restricts status to only valid values: Pending, In Progress, Completed, Canceled

-- Step 1: Drop existing status constraint if it exists (to allow modification)
ALTER TABLE work_orders
DROP CONSTRAINT IF EXISTS work_orders_status_check;

-- Step 2: Add CHECK constraint to enforce valid status values
ALTER TABLE work_orders
ADD CONSTRAINT work_orders_status_check 
CHECK (status IN ('Pending', 'In Progress', 'Completed', 'Canceled'));

-- Step 3: Add comment to document the constraint
COMMENT ON CONSTRAINT work_orders_status_check ON work_orders 
IS 'Ensures status can only be: Pending, In Progress, Completed, or Canceled';

-- Step 4: Verify the constraint was added
SELECT
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'work_orders'::regclass
AND contype = 'c'
AND conname = 'work_orders_status_check';

-- Step 5: Check if there are any invalid status values in existing data
SELECT DISTINCT status 
FROM work_orders 
WHERE status NOT IN ('Pending', 'In Progress', 'Completed', 'Canceled');

