-- Test query to check if work orders exist and can be fetched
-- Run this to diagnose the issue

-- 1. Check if work_orders table has any data
SELECT COUNT(*) as total_work_orders FROM work_orders;

-- 2. Check the latest work orders (if any exist)
SELECT 
  id,
  title,
  description,
  priority,
  status,
  tenant_id,
  property_id,
  created_at
FROM work_orders
ORDER BY id DESC
LIMIT 3;

-- 3. Check if tenants and properties tables have data
SELECT COUNT(*) as total_tenants FROM tenants;
SELECT COUNT(*) as total_properties FROM properties;

-- 4. Check RLS policies on work_orders table
SELECT 
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'work_orders';

-- 5. Check if you have tenants and properties to link to
SELECT id, name FROM tenants LIMIT 5;
SELECT id, name FROM properties LIMIT 5;

