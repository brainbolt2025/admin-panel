-- Fix property_id foreign key constraint violation
-- The error means you're trying to use a property_id that doesn't exist in properties table

-- Step 1: Check what properties exist in your database
SELECT id, name, created_at 
FROM properties 
ORDER BY created_at DESC;

-- Step 2: Check current users and their property_id values
SELECT 
  id,
  email,
  name,
  role,
  property_id,
  property_name
FROM users
WHERE role = 'pm'
ORDER BY email;

-- Step 3: Check if any users have invalid property_id values
SELECT 
  u.id,
  u.email,
  u.name,
  u.property_id,
  CASE 
    WHEN u.property_id IS NULL THEN 'No property assigned'
    WHEN p.id IS NULL THEN 'INVALID - Property does not exist'
    ELSE 'Valid property'
  END as status
FROM users u
LEFT JOIN properties p ON u.property_id = p.id
WHERE u.role = 'pm'
ORDER BY status, u.email;

-- Step 4: Fix invalid property_id values
-- Option A: Set to NULL if property doesn't exist
UPDATE users
SET property_id = NULL
WHERE role = 'pm'
AND property_id IS NOT NULL
AND NOT EXISTS (
  SELECT 1 FROM properties WHERE properties.id = users.property_id
);

-- Option B: Assign to first available property (uncomment if needed)
-- UPDATE users
-- SET property_id = (SELECT id FROM properties LIMIT 1)
-- WHERE role = 'pm'
-- AND property_id IS NULL;

-- Step 5: Verify the fix
SELECT 
  u.id,
  u.email,
  u.name,
  u.property_id,
  p.name as property_name
FROM users u
LEFT JOIN properties p ON u.property_id = p.id
WHERE u.role = 'pm';

