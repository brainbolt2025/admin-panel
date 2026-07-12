-- Add property_id column to users table for Property Managers
-- This links PMs to their assigned property

-- Step 1: Add property_id column
ALTER TABLE users
ADD COLUMN IF NOT EXISTS property_id UUID NULL;

-- Step 2: Add foreign key constraint to properties table
ALTER TABLE users
ADD CONSTRAINT users_property_id_fkey 
FOREIGN KEY (property_id) 
REFERENCES properties(id)
ON DELETE SET NULL;

-- Step 3: Add comment to document the column
COMMENT ON COLUMN users.property_id IS 'Property ID that this PM user manages (for PM role only)';

-- Step 4: Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_users_property_id 
ON users(property_id) 
WHERE property_id IS NOT NULL;

-- Optional: Update existing PM users to link them to a property
-- Uncomment and modify if you want to link existing PMs:
/*
UPDATE users
SET property_id = (SELECT id FROM properties LIMIT 1)
WHERE role = 'pm' 
AND property_id IS NULL;
*/

