-- Add all columns at once (run this entire block together)
DO $$ 
BEGIN
  -- Add priority column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'work_orders' AND column_name = 'priority') THEN
    ALTER TABLE work_orders ADD COLUMN priority TEXT NULL;
  END IF;

  -- Add title column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'work_orders' AND column_name = 'title') THEN
    ALTER TABLE work_orders ADD COLUMN title TEXT NULL;
  END IF;

  -- Add action column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'work_orders' AND column_name = 'action') THEN
    ALTER TABLE work_orders ADD COLUMN action TEXT NULL;
  END IF;
END $$;

-- Add constraints
ALTER TABLE work_orders 
DROP CONSTRAINT IF EXISTS work_orders_priority_check;

ALTER TABLE work_orders
ADD CONSTRAINT work_orders_priority_check 
CHECK (priority IS NULL OR priority IN ('Low', 'Medium', 'High'));

ALTER TABLE work_orders 
DROP CONSTRAINT IF EXISTS work_orders_action_check;

ALTER TABLE work_orders
ADD CONSTRAINT work_orders_action_check 
CHECK (action IS NULL OR action IN ('Create', 'Assign', 'Reassign', 'Start', 'Complete', 'Close', 'Reopen'));
