-- Pending email for verify-then-switch PM email updates
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS pending_email TEXT;

COMMENT ON COLUMN public.users.pending_email IS
  'New email awaiting confirmation via verification_token link; applied on click';
