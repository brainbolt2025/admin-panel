-- =============================================================================
-- Add work_orders columns expected by the Android client / admin panel
-- =============================================================================
-- Symptoms seen on the new project:
--   42703: column "updated_at" does not exist
--   42703: column "service_request_number" does not exist
--   (and earlier) tenant_name / unit_number / created_at missing
-- =============================================================================

ALTER TABLE public.work_orders
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.work_orders
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.work_orders
ADD COLUMN IF NOT EXISTS service_request_number TEXT;

ALTER TABLE public.work_orders
ADD COLUMN IF NOT EXISTS tenant_name TEXT;

ALTER TABLE public.work_orders
ADD COLUMN IF NOT EXISTS unit_number TEXT;

-- Backfill updated_at from created_at when possible
UPDATE public.work_orders
SET updated_at = COALESCE(created_at, NOW())
WHERE updated_at IS NULL;

UPDATE public.work_orders
SET created_at = NOW()
WHERE created_at IS NULL;

-- Optional: backfill tenant_name / unit_number from users
UPDATE public.work_orders wo
SET tenant_name = u.name
FROM public.users u
WHERE wo.tenant_id = u.id
  AND (wo.tenant_name IS NULL OR wo.tenant_name = '');

UPDATE public.work_orders wo
SET unit_number = u.unit_number
FROM public.users u
WHERE wo.tenant_id = u.id
  AND wo.unit_number IS NULL
  AND u.unit_number IS NOT NULL;

-- Verify
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'work_orders'
ORDER BY ordinal_position;
