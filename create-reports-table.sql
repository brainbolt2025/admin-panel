-- Reports from tenants and technicians to their property manager.

CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_number BIGSERIAL NOT NULL,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  property_name TEXT,
  reporter_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reporter_role TEXT NOT NULL CHECK (reporter_role IN ('tenant', 'technician')),
  reporter_name TEXT,
  subject_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  subject_role TEXT CHECK (subject_role IS NULL OR subject_role IN ('tenant', 'technician')),
  subject_name TEXT,
  work_order_id UUID REFERENCES public.work_orders(id) ON DELETE SET NULL,
  category TEXT NOT NULL,
  severity TEXT CHECK (severity IS NULL OR severity IN ('low', 'medium', 'high')),
  status TEXT NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted', 'awaiting_pm_review', 'completed')),
  title TEXT,
  description TEXT NOT NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reports_property_id ON public.reports (property_id);
CREATE INDEX IF NOT EXISTS idx_reports_reporter_id ON public.reports (reporter_id);
CREATE INDEX IF NOT EXISTS idx_reports_reporter_role ON public.reports (reporter_role);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON public.reports (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_work_order_id ON public.reports (work_order_id);
CREATE INDEX IF NOT EXISTS idx_reports_subject_id ON public.reports (subject_id);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Reporters can view own reports" ON public.reports;
CREATE POLICY "Reporters can view own reports"
  ON public.reports
  FOR SELECT
  TO authenticated
  USING (reporter_id = auth.uid());

DROP POLICY IF EXISTS "PMs can view reports for their property" ON public.reports;
CREATE POLICY "PMs can view reports for their property"
  ON public.reports
  FOR SELECT
  TO authenticated
  USING (
    property_id IN (
      SELECT property_id FROM public.users
      WHERE id = auth.uid() AND role = 'pm'
    )
  );

DROP POLICY IF EXISTS "PMs can update reports for their property" ON public.reports;
CREATE POLICY "PMs can update reports for their property"
  ON public.reports
  FOR UPDATE
  TO authenticated
  USING (
    property_id IN (
      SELECT property_id FROM public.users
      WHERE id = auth.uid() AND role = 'pm'
    )
  )
  WITH CHECK (
    property_id IN (
      SELECT property_id FROM public.users
      WHERE id = auth.uid() AND role = 'pm'
    )
  );

GRANT SELECT, INSERT, UPDATE ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.reports_display_number_seq TO authenticated, service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime' AND tablename = 'reports'
     )
  THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.reports;
  END IF;
END $$;

ALTER TABLE public.reports REPLICA IDENTITY FULL;
