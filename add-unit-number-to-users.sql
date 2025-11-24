-- Add unit_number column to users table
-- This column stores the unit/apartment number for tenants

-- Add unit_number column if it doesn't exist
ALTER TABLE users
ADD COLUMN IF NOT EXISTS unit_number TEXT NULL;

-- Add comment to document the column
COMMENT ON COLUMN users.unit_number IS 'Unit/apartment number for tenant users';

-- Verify the column was added
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'users'
AND column_name = 'unit_number'
ORDER BY ordinal_position;

