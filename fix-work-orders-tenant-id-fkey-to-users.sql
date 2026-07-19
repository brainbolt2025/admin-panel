-- =============================================================================
-- Point work_orders.tenant_id FK at users(id) instead of legacy tenants(id)
-- =============================================================================
-- Symptom:
--   create-work-order fails with:
--   insert or update on table "work_orders" violates foreign key constraint
--   "work_orders_tenant_id_fkey"
--
-- Cause:
--   App stores tenants in public.users (role = 'tenant'), but the FK still
--   references the legacy tenants table.
-- =============================================================================

-- 1) Confirm current FK target (optional)
-- SELECT pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conname = 'work_orders_tenant_id_fkey';

-- 2) Orphan check — must return 0 rows before adding the new FK
SELECT wo.id, wo.tenant_id
FROM work_orders wo
LEFT JOIN users u ON u.id = wo.tenant_id
WHERE wo.tenant_id IS NOT NULL
  AND u.id IS NULL;

-- 3) Replace the FK
BEGIN;

ALTER TABLE work_orders
DROP CONSTRAINT IF EXISTS work_orders_tenant_id_fkey;

ALTER TABLE work_orders
ADD CONSTRAINT work_orders_tenant_id_fkey
FOREIGN KEY (tenant_id)
REFERENCES users(id)
ON DELETE SET NULL;

COMMIT;

-- 4) Verify
SELECT pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conname = 'work_orders_tenant_id_fkey';
