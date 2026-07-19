-- Fix: PMs were marked email_verified=true as soon as Auth was confirmed
-- (create-user / stripe-webhook), which made the Mailgun verification email pointless.
--
-- Run this in the Supabase SQL Editor, then redeploy:
--   - create-user
--   - stripe-webhook
--
-- Same logic as sync-email-verification-trigger.sql (PM excluded from Auth sync).

CREATE OR REPLACE FUNCTION sync_email_verification()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL AND (OLD.email_confirmed_at IS NULL OR OLD.email_confirmed_at IS DISTINCT FROM NEW.email_confirmed_at) THEN
    UPDATE public.users
    SET email_verified = true
    WHERE id = NEW.id
      AND role IS DISTINCT FROM 'pm';
  END IF;

  IF NEW.email_confirmed_at IS NULL AND OLD.email_confirmed_at IS NOT NULL THEN
    UPDATE public.users
    SET email_verified = false
    WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS sync_email_verification_trigger ON auth.users;

CREATE TRIGGER sync_email_verification_trigger
  AFTER UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW
  WHEN (OLD.email_confirmed_at IS DISTINCT FROM NEW.email_confirmed_at)
  EXECUTE FUNCTION sync_email_verification();

CREATE OR REPLACE FUNCTION sync_email_verification_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL THEN
    UPDATE public.users
    SET email_verified = true
    WHERE id = NEW.id
      AND role IS DISTINCT FROM 'pm';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS sync_email_verification_insert_trigger ON auth.users;

CREATE TRIGGER sync_email_verification_insert_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW
  WHEN (NEW.email_confirmed_at IS NOT NULL)
  EXECUTE FUNCTION sync_email_verification_on_insert();

-- Un-verify PMs still waiting on the Mailgun link
UPDATE public.users
SET email_verified = false
WHERE role = 'pm'
  AND verification_token IS NOT NULL
  AND email_verified IS DISTINCT FROM false;
