-- =============================================================================
-- Fix work_orders RLS for PM assignment + technician visibility
-- =============================================================================
-- Context (new Supabase project qmhmgjzkpfzxfjdurigu):
--   - Only "Tenants can update own work orders" existed for UPDATE, so PM
--     assignment silently updated 0 rows and notify-technician-assignment
--     returned "Work order has no assigned technician".
--   - SELECT policies existed for PM/tenant only, so technicians querying
--     work_orders?technician_id=eq.<id> got an empty array even when assigned.
--
-- Safe to re-run (DROP IF EXISTS + CREATE).
-- Does NOT depend on is_super_admin() so it works even if that function is
-- missing on the project.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) PM can assign technicians / update work orders in their property
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "PM can update work orders in their properties" ON work_orders;

CREATE POLICY "PM can update work orders in their properties"
ON work_orders
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM users
    WHERE users.id = auth.uid()
      AND users.role = 'pm'
      AND users.property_id = work_orders.property_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM users
    WHERE users.id = auth.uid()
      AND users.role = 'pm'
      AND users.property_id = work_orders.property_id
  )
);

-- -----------------------------------------------------------------------------
-- 2) Technicians can view work orders assigned to them
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Technicians can view their assigned work orders" ON work_orders;

CREATE POLICY "Technicians can view their assigned work orders"
ON work_orders
FOR SELECT
TO authenticated
USING (
  technician_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM users
    WHERE id = auth.uid()
      AND role = 'technician'
  )
);

-- -----------------------------------------------------------------------------
-- 3) Technicians can update their assigned work orders (status changes, etc.)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Technicians can update their assigned work orders" ON work_orders;

CREATE POLICY "Technicians can update their assigned work orders"
ON work_orders
FOR UPDATE
TO authenticated
USING (
  technician_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM users
    WHERE id = auth.uid()
      AND role = 'technician'
  )
)
WITH CHECK (
  technician_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM users
    WHERE id = auth.uid()
      AND role = 'technician'
  )
);

-- -----------------------------------------------------------------------------
-- Verify policies
-- -----------------------------------------------------------------------------
SELECT
  policyname,
  cmd,
  roles,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'work_orders'
  AND policyname IN (
    'PM can update work orders in their properties',
    'Technicians can view their assigned work orders',
    'Technicians can update their assigned work orders'
  )
ORDER BY policyname;
