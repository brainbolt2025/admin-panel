-- =============================================================================
-- Diagnostic queries for work_orders assignment / technician list issues
-- =============================================================================
-- Use when:
--   - notify-technician-assignment returns "Work order has no assigned technician"
--   - Android technician work-order list returns []
-- =============================================================================

-- UPDATE policies currently on work_orders
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'work_orders'
  AND cmd = 'UPDATE';

-- SELECT policies currently on work_orders
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'work_orders'
  AND cmd = 'SELECT';

-- Does is_super_admin() exist? (older PM policies may call it)
SELECT proname
FROM pg_proc
WHERE proname = 'is_super_admin';

-- Most recently touched work orders (check technician_id after assign)
SELECT id, title, status, technician_id, property_id, tenant_id, created_at, updated_at
FROM work_orders
ORDER BY updated_at DESC NULLS LAST, created_at DESC
LIMIT 5;

-- Confirm a technician user row (replace with the technician_id from above if needed)
-- SELECT id, name, email, role, property_id
-- FROM users
-- WHERE id = 'a7b7396b-9159-4993-be32-ed2b2a8e4f38';
