-- Enable realtime for PM sidebar badges (no admin polling).
-- Run on each Supabase project (Asine-dev + prod) if badges only update after refresh.

ALTER PUBLICATION supabase_realtime ADD TABLE public.work_orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.users;

-- Helps UPDATE/DELETE payloads include enough row data for filtered channels
ALTER TABLE public.users REPLICA IDENTITY FULL;
ALTER TABLE public.work_orders REPLICA IDENTITY FULL;
