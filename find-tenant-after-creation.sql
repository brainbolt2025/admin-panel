-- Find tenant after creation using create-tenant function
-- Use these queries to locate newly created tenants

-- Option 1: Find by email (most reliable) - Replace with actual email
SELECT 
  u.id,
  u.email,
  u.name,
  u.role,
  u.property_id,
  u.property_name,
  u.approved,
  u.created_at,
  CASE 
    WHEN au.id IS NOT NULL THEN '✅ Has Auth User' 
    ELSE '❌ No Auth User' 
  END as auth_status
FROM users u
LEFT JOIN auth.users au ON u.id = au.id
WHERE u.email = 'tenant@example.com'  -- Replace with actual email
OR LOWER(u.email) = LOWER('tenant@example.com');

-- Option 2: Find recent tenants (last 10 created)
SELECT 
  u.id,
  u.email,
  u.name,
  u.role,
  u.property_id,
  u.property_name,
  u.approved,
  u.created_at,
  CASE 
    WHEN au.id IS NOT NULL THEN '✅ Has Auth User' 
    ELSE '❌ No Auth User' 
  END as auth_status
FROM users u
LEFT JOIN auth.users au ON u.id = au.id
WHERE u.role = 'tenant'
ORDER BY u.created_at DESC
LIMIT 10;

-- Option 3: Find tenants by property_id
SELECT 
  u.id,
  u.email,
  u.name,
  u.role,
  u.property_id,
  u.property_name,
  p.name as property_name_from_table,
  u.approved,
  u.created_at
FROM users u
LEFT JOIN properties p ON u.property_id = p.id
WHERE u.role = 'tenant'
AND u.property_id = '215274b3-e697-4d2f-bbb8-2dcf470141b9'  -- Replace with your property_id
ORDER BY u.created_at DESC;

-- Option 4: Check if tenant exists in auth.users but NOT in users table (trigger failed)
SELECT 
  au.id,
  au.email,
  au.raw_user_meta_data->>'name' as name_from_metadata,
  au.raw_user_meta_data->>'role' as role_from_metadata,
  au.raw_user_meta_data->>'property_id' as property_id_from_metadata,
  au.raw_user_meta_data->>'property_name' as property_name_from_metadata,
  au.created_at,
  CASE 
    WHEN u.id IS NOT NULL THEN '✅ In users table' 
    ELSE '❌ Missing from users table - TRIGGER FAILED' 
  END as users_table_status
FROM auth.users au
LEFT JOIN users u ON au.id = u.id
WHERE au.email = 'tenant@example.com'  -- Replace with actual email
OR LOWER(au.email) = LOWER('tenant@example.com');

-- Option 5: Find all tenants with their auth status
SELECT 
  u.id,
  u.email,
  u.name,
  u.role,
  u.property_id,
  u.property_name,
  u.approved,
  u.created_at,
  au.email as auth_email,
  CASE 
    WHEN au.id IS NOT NULL THEN '✅ Can Sign In' 
    ELSE '❌ Cannot Sign In' 
  END as can_sign_in
FROM users u
LEFT JOIN auth.users au ON u.id = au.id
WHERE u.role = 'tenant'
ORDER BY u.created_at DESC
LIMIT 20;

-- Option 6: Find tenants created in last hour
SELECT 
  u.id,
  u.email,
  u.name,
  u.role,
  u.property_id,
  u.property_name,
  u.approved,
  u.created_at,
  CASE 
    WHEN au.id IS NOT NULL THEN '✅ Has Auth User' 
    ELSE '❌ No Auth User' 
  END as auth_status
FROM users u
LEFT JOIN auth.users au ON u.id = au.id
WHERE u.role = 'tenant'
AND u.created_at > NOW() - INTERVAL '1 hour'
ORDER BY u.created_at DESC;

-- Option 7: Check if tenant exists but with wrong role
SELECT 
  id,
  email,
  name,
  role,
  property_id,
  property_name,
  created_at
FROM users
WHERE email = 'tenant@example.com'  -- Replace with actual email
OR LOWER(email) = LOWER('tenant@example.com');

-- Option 8: Find tenant by user_id (from create-tenant response)
SELECT 
  u.id,
  u.email,
  u.name,
  u.role,
  u.property_id,
  u.property_name,
  u.approved,
  u.created_at,
  au.email as auth_email
FROM users u
LEFT JOIN auth.users au ON u.id = au.id
WHERE u.id = 'user-id-from-response';  -- Replace with user_id from create-tenant response
