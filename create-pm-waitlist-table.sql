-- Create waitlist table for PM signups from Carrd
-- This table stores Property Manager signups from the Carrd form
-- No RLS needed since it won't be consumed from the dashboard

CREATE TABLE IF NOT EXISTS public.pm_waitlist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL UNIQUE,
  property_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  notified_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'contacted', 'approved', 'declined'))
);

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_pm_waitlist_email ON pm_waitlist(email);

-- Create index on status for filtering
CREATE INDEX IF NOT EXISTS idx_pm_waitlist_status ON pm_waitlist(status);

-- Create index on created_at for sorting
CREATE INDEX IF NOT EXISTS idx_pm_waitlist_created_at ON pm_waitlist(created_at DESC);

