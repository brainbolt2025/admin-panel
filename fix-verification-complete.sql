-- COMPLETE FIX: Add email verification support
-- Run this in Supabase SQL Editor

-- Step 1: Add the required columns (if they don't exist)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS verification_token TEXT,
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS verification_token_expires_at TIMESTAMPTZ;

-- Step 2: Create index for faster token lookups
CREATE INDEX IF NOT EXISTS idx_users_verification_token 
ON users(verification_token) 
WHERE verification_token IS NOT NULL;

-- Step 3: If you need to manually add a token for testing
-- (Only run this if you want to test with an existing token)
-- Replace:
--   - 'your-email@example.com' with the actual email
--   - 'ed64fcd8-768b-41c3-9abc-def012345678' with the FULL token from your email URL

-- First, find your user:
-- SELECT id, email FROM users WHERE email = 'your-email@example.com';

-- Then update with the actual UUID (not the literal string 'USER_ID'):
-- UPDATE users 
-- SET verification_token = 'ed64fcd8-768b-41c3-9abc-def012345678',
--     verification_token_expires_at = NOW() + INTERVAL '24 hours',
--     email_verified = false
-- WHERE id = '123e4567-e89b-12d3-a456-426614174000'; -- Use actual UUID from SELECT above

-- BETTER SOLUTION: After running Step 1, complete a NEW subscription
-- This will automatically store the token via the webhook

