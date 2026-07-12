-- Convert existing role column from TEXT to ENUM type
-- This version handles RLS policies that depend on the role column

-- Step 1: Drop any existing constraints on role
ALTER TABLE users 
DROP CONSTRAINT IF EXISTS users_role_check;

-- Step 2: Create the role ENUM type (drop and recreate to ensure consistency)
DROP TYPE IF EXISTS user_role CASCADE;

CREATE TYPE user_role AS ENUM ('super_admin', 'pm', 'tenant', 'technician');

-- Step 3: Check existing role values to ensure they're all valid
SELECT DISTINCT role 
FROM users 
WHERE role NOT IN ('super_admin', 'pm', 'tenant', 'technician');

-- Step 4: Update any invalid role values to 'tenant' as default
UPDATE users
SET role = 'tenant'
WHERE role IS NOT NULL 
AND role NOT IN ('super_admin', 'pm', 'tenant', 'technician');

-- Step 5: Add a temporary column with the ENUM type
ALTER TABLE users ADD COLUMN "role_new" user_role;

-- Step 6: Copy and convert data to the new column
UPDATE users 
SET "role_new" = (
  CASE 
    WHEN "role" = 'super_admin' THEN 'super_admin'::user_role
    WHEN "role" = 'pm' THEN 'pm'::user_role
    WHEN "role" = 'tenant' THEN 'tenant'::user_role
    WHEN "role" = 'technician' THEN 'technician'::user_role
    ELSE NULL::user_role
  END
);

-- Step 7: Drop the old column and rename the new one
-- CASCADE will drop dependent RLS policies - we'll recreate them below
ALTER TABLE users DROP COLUMN role CASCADE;
ALTER TABLE users RENAME COLUMN "role_new" TO role;

-- Step 8: Recreate RLS policies that depend on users.role
-- Note: You may need to adjust these based on your actual policy definitions

-- Policy for Super Admin full access to work orders
CREATE POLICY "Super Admin full access to work orders"
ON work_orders
FOR ALL
USING (
  EXISTS (
    SELECT 1 
    FROM users 
    WHERE users.id = auth.uid() 
    AND users.role = 'super_admin'
  )
);

-- Policy for Super Admin full access to tenants
CREATE POLICY "Super Admin full access to tenants"
ON tenants
FOR ALL
USING (
  EXISTS (
    SELECT 1 
    FROM users 
    WHERE users.id = auth.uid() 
    AND users.role = 'super_admin'
  )
);

-- Policy for Super Admin full access to properties
CREATE POLICY "Super Admin full access to properties"
ON properties
FOR ALL
USING (
  EXISTS (
    SELECT 1 
    FROM users 
    WHERE users.id = auth.uid() 
    AND users.role = 'super_admin'
  )
);

-- Policy for PM can view work orders in their properties
CREATE POLICY "PM can view work orders in their properties"
ON work_orders
FOR SELECT
USING (
  EXISTS (
    SELECT 1 
    FROM users 
    WHERE users.id = auth.uid() 
    AND users.role = 'pm'
    AND users.property_id = work_orders.property_id
  )
);

-- Verify the conversion
SELECT 
  column_name,
  data_type,
  udt_name,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'users'
AND column_name = 'role';

-- Show sample data
SELECT role, COUNT(*) 
FROM users 
GROUP BY role
ORDER BY role;

-- Show all policies on work_orders, tenants, and properties
SELECT 
  schemaname,
  tablename,
  policyname
FROM pg_policies
WHERE tablename IN ('work_orders', 'tenants', 'properties', 'users')
ORDER BY tablename, policyname;

