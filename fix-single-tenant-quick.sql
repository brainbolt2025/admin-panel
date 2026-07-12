-- Quick fix: Insert a specific tenant from auth.users into users table
-- Replace 'YOUR-TENANT-EMAIL@example.com' with the actual tenant email

-- Step 1: Check what data is in auth.users for this tenant
SELECT 
  au.id,
  au.email,
  au.raw_user_meta_data->>'name' as name,
  au.raw_user_meta_data->>'role' as role,
  au.raw_user_meta_data->>'property_id' as property_id,
  au.raw_user_meta_data->>'property_name' as property_name,
  au.created_at
FROM auth.users au
WHERE au.email = 'YOUR-TENANT-EMAIL@example.com';  -- Replace with actual email

-- Step 2: Insert the tenant into users table
-- This will insert the tenant with all the metadata from auth.users
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
  COALESCE(au.raw_user_meta_data->>'name', 'Tenant User') as name,
  COALESCE(
    (au.raw_user_meta_data->>'role')::user_role,
    'tenant'::user_role
  ) as role,
  CASE 
    WHEN au.raw_user_meta_data->>'property_id' IS NOT NULL 
    AND au.raw_user_meta_data->>'property_id' != ''
    THEN (au.raw_user_meta_data->>'property_id')::UUID
    ELSE NULL
  END as property_id,
  au.raw_user_meta_data->>'property_name' as property_name,
  false as approved
FROM auth.users au
WHERE au.email = 'YOUR-TENANT-EMAIL@example.com'  -- Replace with actual email
AND NOT EXISTS (
  SELECT 1 FROM users u WHERE u.id = au.id
)
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
    WHEN au.id IS NOT NULL THEN '✅ Complete - Can Sign In' 
    ELSE '❌ Missing Auth User' 
  END as status
FROM users u
LEFT JOIN auth.users au ON u.id = au.id
WHERE u.email = 'YOUR-TENANT-EMAIL@example.com';  -- Replace with actual email

