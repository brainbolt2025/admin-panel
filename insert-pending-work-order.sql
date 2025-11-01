-- Insert a pending work order
-- Note: The 'id' field is auto-generated (uuid_generate_v4()) so we don't include it
-- Replace the tenant_id and property_id with actual UUIDs from your database

INSERT INTO work_orders (
  tenant_id,
  property_id,
  description,
  title,
  status,
  priority,
  action
) VALUES (
  -- Replace these with actual UUIDs from your tenants and properties tables
  (SELECT id FROM tenants LIMIT 1),  -- Get first tenant ID, or replace with specific UUID
  (SELECT id FROM properties LIMIT 1),  -- Get first property ID, or replace with specific UUID
  'Leaking faucet in apartment 3B requires immediate attention',
  'Leaking faucet - Apt 3B',
  'Pending',
  'Medium',
  'Create'
);

-- Alternative: Insert with specific UUIDs if you know them
-- Uncomment and replace the UUIDs below:
/*
INSERT INTO work_orders (
  tenant_id,
  property_id,
  description,
  title,
  status,
  priority,
  action
) VALUES (
  '00000000-0000-0000-0000-000000000001',  -- Replace with actual tenant_id UUID
  '00000000-0000-0000-0000-000000000002',  -- Replace with actual property_id UUID
  'Leaking faucet in apartment 3B requires immediate attention',
  'Leaking faucet - Apt 3B',
  'Pending',
  'Medium',
  'Create'
);
*/

