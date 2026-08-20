-- Pending tenant invites. Auth + public.users are created only after the
-- tenant sets a password via accept-tenant-invite.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS phone TEXT;

CREATE TABLE IF NOT EXISTS public.tenant_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL DEFAULT '',
  phone TEXT,
  unit_number TEXT NOT NULL,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  property_name TEXT,
  invited_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenant_invites_property_id
  ON public.tenant_invites (property_id);

CREATE INDEX IF NOT EXISTS idx_tenant_invites_token_hash
  ON public.tenant_invites (token_hash);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_invites_pending_email
  ON public.tenant_invites (lower(email))
  WHERE accepted_at IS NULL;

ALTER TABLE public.tenant_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "PMs can view tenant invites for their property" ON public.tenant_invites;
CREATE POLICY "PMs can view tenant invites for their property"
  ON public.tenant_invites
  FOR SELECT
  TO authenticated
  USING (
    property_id IN (
      SELECT property_id FROM public.users
      WHERE id = auth.uid() AND role = 'pm'
    )
  );

DROP POLICY IF EXISTS "PMs can delete tenant invites for their property" ON public.tenant_invites;
CREATE POLICY "PMs can delete tenant invites for their property"
  ON public.tenant_invites
  FOR DELETE
  TO authenticated
  USING (
    property_id IN (
      SELECT property_id FROM public.users
      WHERE id = auth.uid() AND role = 'pm'
    )
  );

GRANT SELECT, DELETE ON public.tenant_invites TO authenticated;
GRANT ALL ON public.tenant_invites TO service_role;
