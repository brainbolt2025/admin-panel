-- Pending technician invites. Auth + public.users are created only after the
-- technician sets a password via accept-technician-invite.

CREATE TABLE IF NOT EXISTS public.technician_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  property_name TEXT,
  invited_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_technician_invites_property_id
  ON public.technician_invites (property_id);

CREATE INDEX IF NOT EXISTS idx_technician_invites_token_hash
  ON public.technician_invites (token_hash);

-- One outstanding invite per email
CREATE UNIQUE INDEX IF NOT EXISTS idx_technician_invites_pending_email
  ON public.technician_invites (lower(email))
  WHERE accepted_at IS NULL;

ALTER TABLE public.technician_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "PMs can view invites for their property" ON public.technician_invites;
CREATE POLICY "PMs can view invites for their property"
  ON public.technician_invites
  FOR SELECT
  TO authenticated
  USING (
    property_id IN (
      SELECT property_id FROM public.users
      WHERE id = auth.uid() AND role = 'pm'
    )
  );

DROP POLICY IF EXISTS "PMs can delete invites for their property" ON public.technician_invites;
CREATE POLICY "PMs can delete invites for their property"
  ON public.technician_invites
  FOR DELETE
  TO authenticated
  USING (
    property_id IN (
      SELECT property_id FROM public.users
      WHERE id = auth.uid() AND role = 'pm'
    )
  );

GRANT SELECT, DELETE ON public.technician_invites TO authenticated;
GRANT ALL ON public.technician_invites TO service_role;
