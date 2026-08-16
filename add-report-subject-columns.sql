-- Complaints: who reported whom (tenant ↔ technician on a work order).

ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS subject_id UUID REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS subject_name TEXT;

ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS subject_role TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'reports_subject_role_check'
  ) THEN
    ALTER TABLE public.reports
      ADD CONSTRAINT reports_subject_role_check
      CHECK (subject_role IS NULL OR subject_role IN ('tenant', 'technician'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_reports_subject_id ON public.reports (subject_id);
