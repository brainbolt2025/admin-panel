-- Add created_at column to properties table
-- Run this to add a timestamp for when properties are created

-- Step 1: Add created_at column if it doesn't exist
ALTER TABLE properties
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW();

-- Step 2: Add comment to document the column
COMMENT ON COLUMN properties.created_at IS 'Timestamp when the property was created';

-- Step 3: Verify the column was added
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'properties'
AND column_name = 'created_at';

-- Optional: Update existing properties with current timestamp if needed
-- Uncomment if you want to set created_at for existing records:
/*
UPDATE properties
SET created_at = NOW()
WHERE created_at IS NULL;
*/

