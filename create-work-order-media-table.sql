-- =============================================================================
-- Create work_order_media table + RLS
-- =============================================================================
-- Symptom:
--   PGRST205: relation "work_order_media" does not exist
--
-- Notes:
--   - Storage files live in the `work-order-media` bucket
--   - This table stores URL/metadata rows the Android client inserts/reads
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.work_order_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  media_type TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_work_order_media_work_order_id
  ON public.work_order_media(work_order_id);

ALTER TABLE public.work_order_media ENABLE ROW LEVEL SECURITY;

-- Tenants
DROP POLICY IF EXISTS "Tenants can insert media for own work orders" ON public.work_order_media;
CREATE POLICY "Tenants can insert media for own work orders"
ON public.work_order_media
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM work_orders
    WHERE work_orders.id = work_order_media.work_order_id
      AND work_orders.tenant_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Tenants can view media for own work orders" ON public.work_order_media;
CREATE POLICY "Tenants can view media for own work orders"
ON public.work_order_media
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM work_orders
    WHERE work_orders.id = work_order_media.work_order_id
      AND work_orders.tenant_id = auth.uid()
  )
);

-- Technicians
DROP POLICY IF EXISTS "Technicians can view media for assigned work orders" ON public.work_order_media;
CREATE POLICY "Technicians can view media for assigned work orders"
ON public.work_order_media
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM work_orders
    WHERE work_orders.id = work_order_media.work_order_id
      AND work_orders.technician_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Technicians can insert media for assigned work orders" ON public.work_order_media;
CREATE POLICY "Technicians can insert media for assigned work orders"
ON public.work_order_media
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM work_orders
    WHERE work_orders.id = work_order_media.work_order_id
      AND work_orders.technician_id = auth.uid()
  )
);

-- PMs (admin panel)
DROP POLICY IF EXISTS "PMs can view media for their property work orders" ON public.work_order_media;
CREATE POLICY "PMs can view media for their property work orders"
ON public.work_order_media
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM work_orders
    JOIN users ON users.property_id = work_orders.property_id
    WHERE work_orders.id = work_order_media.work_order_id
      AND users.id = auth.uid()
      AND users.role = 'pm'
  )
);

-- Verify
SELECT policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'work_order_media'
ORDER BY policyname;
