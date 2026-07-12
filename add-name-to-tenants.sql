-- Add name column to tenants table if it doesn't exist
-- Run this to add the name column for tenant records

-- Step 1: Add name column if it doesn't exist
ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS "name" TEXT;

-- Step 2: Add comment to document the column
COMMENT ON COLUMN tenants."name" IS 'Full name of the tenant';

-- Step 3: Verify the column was added
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'tenants'
AND column_name = 'name';

-- Optional: Update existing tenants with placeholder names if needed
-- Uncomment if you want to set default names for existing records:
/*
UPDATE tenants
SET "name" = 'Tenant ' || SUBSTRING(id::text, 1, 8)
WHERE "name" IS NULL;
*/

