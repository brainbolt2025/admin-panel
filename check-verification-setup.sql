-- Check if email verification columns exist
-- Run this in Supabase SQL Editor to diagnose the issue

-- 1. Check if columns exist
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'users' 
  AND column_name IN ('verification_token', 'email_verified', 'verification_token_expires_at')
ORDER BY column_name;

-- 2. Check if any users have verification tokens
SELECT 
  id,
  email,
  email_verified,
  verification_token,
  verification_token_expires_at,
  created_at
FROM users
WHERE verification_token IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;

-- 3. Check total count of users with tokens
SELECT 
  COUNT(*) as users_with_tokens,
  COUNT(CASE WHEN email_verified = true THEN 1 END) as verified_users,
  COUNT(CASE WHEN verification_token IS NOT NULL THEN 1 END) as users_with_tokens_count
FROM users;

-- If columns are missing, run this:
-- ALTER TABLE users 
-- ADD COLUMN IF NOT EXISTS verification_token TEXT,
-- ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false,
-- ADD COLUMN IF NOT EXISTS verification_token_expires_at TIMESTAMPTZ;

