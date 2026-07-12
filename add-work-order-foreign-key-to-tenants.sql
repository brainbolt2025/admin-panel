-- Add work_order_id foreign key constraint to tenants table
-- This ensures tenant work orders reference valid work_orders

-- Step 1: Check if work_order_id column exists in tenants table
SELECT column_name 
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'tenants'
AND column_name = 'work_order_id';

-- Step 2: Add work_order_id column if it doesn't exist
ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS work_order_id UUID;

-- Step 3: Drop existing foreign key if it exists (to avoid conflicts)
ALTER TABLE tenants
DROP CONSTRAINT IF EXISTS tenants_work_order_id_fkey;

-- Step 4: Add foreign key constraint to work_orders table
ALTER TABLE tenants
ADD CONSTRAINT tenants_work_order_id_fkey 
FOREIGN KEY (work_order_id) 
REFERENCES work_orders(id)
ON DELETE SET NULL;

-- Step 5: Add comment to document the column
COMMENT ON COLUMN tenants.work_order_id IS 'Foreign key reference to work_orders table';

-- Step 6: Verify the constraint was added
SELECT
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'tenants'::regclass
AND contype = 'f'
AND conname = 'tenants_work_order_id_fkey';

