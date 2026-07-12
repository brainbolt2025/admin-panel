-- Enable real-time replication for work_orders table
ALTER PUBLICATION supabase_realtime
  ADD TABLE public.work_orders;

-- Enable real-time replication for users table (for technician approval updates)
ALTER PUBLICATION supabase_realtime
  ADD TABLE public.users;

