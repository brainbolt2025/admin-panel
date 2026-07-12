-- Sync email verification status from Supabase Auth to users table
-- This trigger automatically updates users.email_verified when auth.users.email_confirmed_at changes

CREATE OR REPLACE FUNCTION sync_email_verification()
RETURNS TRIGGER AS $$
BEGIN
  -- Update users table when email_confirmed_at is set in auth.users
  IF NEW.email_confirmed_at IS NOT NULL AND (OLD.email_confirmed_at IS NULL OR OLD.email_confirmed_at IS DISTINCT FROM NEW.email_confirmed_at) THEN
    UPDATE public.users
    SET email_verified = true
    WHERE id = NEW.id;
    
    RAISE LOG 'Email verification synced for user: %', NEW.id;
  END IF;
  
  -- Also handle when email_confirmed_at is cleared (shouldn't happen, but handle edge case)
  IF NEW.email_confirmed_at IS NULL AND OLD.email_confirmed_at IS NOT NULL THEN
    UPDATE public.users
    SET email_verified = false
    WHERE id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if it exists
DROP TRIGGER IF EXISTS sync_email_verification_trigger ON auth.users;

-- Create trigger to sync email verification
CREATE TRIGGER sync_email_verification_trigger
  AFTER UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW
  WHEN (OLD.email_confirmed_at IS DISTINCT FROM NEW.email_confirmed_at)
  EXECUTE FUNCTION sync_email_verification();

-- Also sync on INSERT if email is already confirmed (edge case)
CREATE OR REPLACE FUNCTION sync_email_verification_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL THEN
    UPDATE public.users
    SET email_verified = true
    WHERE id = NEW.id;
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

-- Backfill: Update existing users who have email_confirmed_at set
UPDATE public.users u
SET email_verified = true
FROM auth.users au
WHERE u.id = au.id
  AND au.email_confirmed_at IS NOT NULL
  AND (u.email_verified IS NULL OR u.email_verified = false);


