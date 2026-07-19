-- =============================================================================
-- Allow deleting a PM user without blocking on properties.pm_id FK
-- =============================================================================
-- Symptom:
--   Cannot delete from users because properties_pm_id_fkey still references them
--
-- Prefer SET NULL so properties are kept; pm_id becomes NULL.
-- =============================================================================

ALTER TABLE public.properties
DROP CONSTRAINT IF EXISTS properties_pm_id_fkey;

ALTER TABLE public.properties
ADD CONSTRAINT properties_pm_id_fkey
FOREIGN KEY (pm_id)
REFERENCES public.users(id)
ON DELETE SET NULL;

-- Optional: clear a specific PM before delete instead of changing the FK:
-- UPDATE public.properties
-- SET pm_id = NULL
-- WHERE pm_id = '<pm-user-uuid>';
