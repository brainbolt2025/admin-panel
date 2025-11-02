-- Add technician_id column to work_orders table
-- This column will store the ID of the technician assigned to the work order

-- Add technician_id column if it doesn't exist
ALTER TABLE work_orders
ADD COLUMN IF NOT EXISTS technician_id UUID NULL;

-- Add foreign key constraint to users table (technicians have role='technician')
ALTER TABLE work_orders
ADD CONSTRAINT work_orders_technician_id_fkey 
FOREIGN KEY (technician_id) 
REFERENCES users(id)
ON DELETE SET NULL;

-- Add comment to document the column
COMMENT ON COLUMN work_orders.technician_id IS 'ID of the technician assigned to this work order';

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_work_orders_technician_id 
ON work_orders(technician_id) 
WHERE technician_id IS NOT NULL;

-- Verify the column was added
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'work_orders'
AND column_name = 'technician_id'
ORDER BY ordinal_position;

