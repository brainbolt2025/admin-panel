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
