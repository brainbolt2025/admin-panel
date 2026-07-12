-- Set default value for seen_by_pm column
-- This ensures new work orders are created as unseen

-- First, check if the column exists
SELECT 
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'work_orders'
AND column_name = 'seen_by_pm';

-- If the column exists but has no default, alter it
ALTER TABLE work_orders
ALTER COLUMN seen_by_pm SET DEFAULT false;

-- Verify the default was set
SELECT 
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'work_orders'
AND column_name = 'seen_by_pm';

-- Set any NULL values to false (for existing work orders)
UPDATE work_orders
SET seen_by_pm = false
WHERE seen_by_pm IS NULL;

-- Check recent work orders to verify
SELECT 
  id,
  title,
  property_id,
  seen_by_pm
FROM work_orders
ORDER BY id DESC
LIMIT 10;

