-- Convert existing status column from TEXT to ENUM type
-- This provides better performance and type safety

-- Step 1: Create the status ENUM type (if it doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'work_order_status') THEN
    CREATE TYPE work_order_status AS ENUM ('Pending', 'In Progress', 'Completed', 'Canceled');
  END IF;
END $$;

-- Step 2: Check existing status values to ensure they're all valid
SELECT DISTINCT status 
FROM work_orders 
WHERE status NOT IN ('Pending', 'In Progress', 'Completed', 'Canceled');

-- Step 3: Alter the existing status column to use the ENUM type
-- This will automatically drop any existing constraints
ALTER TABLE "work_orders" 
ALTER COLUMN "status" TYPE work_order_status USING (
  CASE WHEN "status"::text = 'Pending' THEN 'Pending'::work_order_status
       WHEN "status"::text = 'In Progress' THEN 'In Progress'::work_order_status
       WHEN "status"::text = 'Completed' THEN 'Completed'::work_order_status
       WHEN "status"::text = 'Canceled' THEN 'Canceled'::work_order_status
       ELSE 'Pending'::work_order_status
  END
);

-- Step 4: Verify the conversion
SELECT 
  column_name,
  data_type,
  udt_name
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'work_orders'
AND column_name = 'status';

-- Step 5: Show the ENUM type that was created
SELECT 
  typname,
  oid
FROM pg_type
WHERE typname = 'work_order_status';
