-- Fix tenant that exists in auth.users but not in users table
-- This happens when the database trigger fails

-- Step 1: Check tenant in auth.users and get metadata
SELECT 
  au.id,
  au.email,
  au.raw_user_meta_data->>'name' as name,
  au.raw_user_meta_data->>'role' as role,
  au.raw_user_meta_data->>'property_id' as property_id,
  au.raw_user_meta_data->>'property_name' as property_name,
  au.created_at
FROM auth.users au
LEFT JOIN users u ON au.id = u.id
WHERE u.id IS NULL  -- Only show tenants NOT in users table
AND au.raw_user_meta_data->>'role' = 'tenant'
ORDER BY au.created_at DESC;

-- Step 2: Insert tenant into users table (replace with actual values from Step 1)
-- Replace the values below with actual data from Step 1 query
INSERT INTO users (
  id,
  email,
  name,
  role,
  property_id,
  property_name,
  approved
)
SELECT 
  au.id,
  au.email,
  COALESCE(
    au.raw_user_meta_data->>'name',
    'Tenant User'
  ) as name,
  COALESCE(
    (au.raw_user_meta_data->>'role')::user_role,
    'tenant'::user_role
  ) as role,
  CASE 
    WHEN au.raw_user_meta_data->>'property_id' IS NOT NULL 
    THEN (au.raw_user_meta_data->>'property_id')::UUID
    ELSE NULL
  END as property_id,
  au.raw_user_meta_data->>'property_name' as property_name,
  false as approved  -- Default to pending approval
FROM auth.users au
LEFT JOIN users u ON au.id = u.id
WHERE u.id IS NULL  -- Only tenants NOT in users table
AND COALESCE(
  au.raw_user_meta_data->>'role',
  'tenant'
) = 'tenant'::text
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  property_id = COALESCE(EXCLUDED.property_id, users.property_id),
  property_name = COALESCE(EXCLUDED.property_name, users.property_name);

-- Step 3: Verify the tenant was inserted
SELECT 
  u.id,
  u.email,
  u.name,
  u.role,
  u.property_id,
  u.property_name,
  u.approved,
  CASE 
    WHEN au.id IS NOT NULL THEN '✅ Complete' 
    ELSE '❌ Missing Auth User' 
  END as status
FROM users u
LEFT JOIN auth.users au ON u.id = au.id
WHERE u.role = 'tenant'
ORDER BY u.created_at DESC
LIMIT 10;

-- Alternative: Insert specific tenant by email
-- Replace 'tenant@example.com' with actual email
/*
INSERT INTO users (
  id,
  email,
  name,
  role,
  property_id,
  property_name,
  approved
)
SELECT 
  au.id,
  au.email,
  COALESCE(
    au.raw_user_meta_data->>'name',
    'Tenant User'
  ) as name,
  COALESCE(
    (au.raw_user_meta_data->>'role')::user_role,
    'tenant'::user_role
  ) as role,
  CASE 
    WHEN au.raw_user_meta_data->>'property_id' IS NOT NULL 
    THEN (au.raw_user_meta_data->>'property_id')::UUID
    ELSE NULL
  END as property_id,
  au.raw_user_meta_data->>'property_name' as property_name,
  false as approved
FROM auth.users au
WHERE au.email = 'tenant@example.com'  -- Replace with actual email
AND NOT EXISTS (
  SELECT 1 FROM users u WHERE u.id = au.id
)
ON CONFLICT (id) DO NOTHING;
*/

