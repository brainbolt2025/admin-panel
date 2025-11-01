-- COMPREHENSIVE DIAGNOSTIC: Check why verification isn't working
-- Run this in Supabase SQL Editor to see what's wrong

-- 1. Check if verification columns exist
SELECT 
  column_name, 
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'users' 
  AND column_name IN ('verification_token', 'email_verified', 'verification_token_expires_at')
ORDER BY column_name;

-- Expected result: Should show 3 rows (one for each column)
-- If empty or fewer rows: Columns are missing - run the migration!

-- 2. Check if ANY users have verification tokens stored
SELECT 
  COUNT(*) as total_users,
  COUNT(CASE WHEN verification_token IS NOT NULL THEN 1 END) as users_with_tokens,
  COUNT(CASE WHEN email_verified = true THEN 1 END) as verified_users
FROM users;

-- 3. Show recent users and their verification status
SELECT 
  id,
  email,
  email_verified,
  verification_token IS NOT NULL as has_token,
  verification_token_expires_at,
  created_at
FROM users
ORDER BY created_at DESC
LIMIT 10;

-- 4. Show users WITH tokens (if any exist)
SELECT 
  id,
  email,
  verification_token,
  email_verified,
  verification_token_expires_at
FROM users
WHERE verification_token IS NOT NULL
ORDER BY created_at DESC;

-- 5. Check webhook storage errors
-- This will show in Edge Function logs, not SQL
-- Go to: Supabase Dashboard → Edge Functions → stripe-webhook → Logs
-- Look for: "Error storing verification token" or "Verification token stored successfully"

