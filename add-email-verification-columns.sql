-- Add email verification columns to users table
-- This migration adds support for email verification tokens

-- Add verification_token column (stores the UUID token sent via email)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS verification_token TEXT;

-- Add email_verified column (tracks if email has been verified)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false;

-- Add verification_token_expires_at column (optional: for token expiration)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS verification_token_expires_at TIMESTAMPTZ;

-- Create index on verification_token for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_verification_token 
ON users(verification_token) 
WHERE verification_token IS NOT NULL;

-- Optional: Add comment to document the columns
COMMENT ON COLUMN users.verification_token IS 'UUID token sent via email for email verification';
COMMENT ON COLUMN users.email_verified IS 'Whether the user has verified their email address';
COMMENT ON COLUMN users.verification_token_expires_at IS 'Expiration timestamp for the verification token (typically 24 hours from creation)';

