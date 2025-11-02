-- Convert existing priority column from TEXT to ENUM type
-- This provides better performance and type safety

-- Step 1: Drop any existing constraints on priority
ALTER TABLE "work_orders" 
DROP CONSTRAINT IF EXISTS work_orders_priority_check;

-- Step 2: Create the priority ENUM type (drop and recreate to ensure consistency)
DROP TYPE IF EXISTS work_order_priority CASCADE;

CREATE TYPE work_order_priority AS ENUM ('Low', 'Medium', 'High');

-- Step 3: Check existing priority values to ensure they're all valid
SELECT DISTINCT priority 
FROM work_orders 
WHERE priority NOT IN ('Low', 'Medium', 'High');

-- Step 4: Update any invalid priority values to 'Low'
UPDATE "work_orders"
SET priority = 'Low'
WHERE priority IS NOT NULL 
AND priority NOT IN ('Low', 'Medium', 'High');

-- Step 5: Add a temporary column with the ENUM type
ALTER TABLE "work_orders" ADD COLUMN "priority_new" work_order_priority;

-- Step 6: Copy and convert data to the new column
UPDATE "work_orders" 
SET "priority_new" = (
  CASE 
    WHEN "priority" = 'Low' THEN 'Low'::work_order_priority
    WHEN "priority" = 'Medium' THEN 'Medium'::work_order_priority
    WHEN "priority" = 'High' THEN 'High'::work_order_priority
    ELSE NULL::work_order_priority
  END
);

-- Step 7: Drop the old column and rename the new one
ALTER TABLE "work_orders" DROP COLUMN "priority";
ALTER TABLE "work_orders" RENAME COLUMN "priority_new" TO "priority";

-- Step 8: Verify the conversion
SELECT 
  column_name,
  data_type,
  udt_name,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'work_orders'
AND column_name = 'priority';

-- Step 9: Show sample data
SELECT priority, COUNT(*) 
FROM work_orders 
GROUP BY priority
ORDER BY priority;

