-- Quick Fix: Manually add verification token for testing
-- Use this if your token wasn't stored in the database

-- Step 1: Find your user by email
-- Replace 'your-email@example.com' with the actual email that received the verification link
SELECT 
  id, 
  email, 
  verification_token,
  email_verified,
  created_at
FROM users 
WHERE email = 'your-email@example.com';

-- Step 2: Once you have the token from the email link (the part after ?token=)
-- Replace these values:
--   - USER_ID: The id from Step 1
--   - YOUR_TOKEN: The full token from the email URL (everything after ?token=)
UPDATE users 
SET verification_token = 'YOUR_TOKEN_HERE',
    verification_token_expires_at = NOW() + INTERVAL '24 hours',
    email_verified = false
WHERE id = 'USER_ID_HERE';

-- Step 3: Verify it was set
SELECT 
  id,
  email,
  verification_token,
  email_verified,
  verification_token_expires_at
FROM users
WHERE id = 'USER_ID_HERE';

-- Example:
-- If your email is "john@example.com" and token from email is "ed64fcd8-768b-41c3-9abc-def012345678"
-- 
-- First run:
-- SELECT id, email FROM users WHERE email = 'john@example.com';
-- (This returns: id = '123e4567-e89b-12d3-a456-426614174000')
--
-- Then run:
-- UPDATE users 
-- SET verification_token = 'ed64fcd8-768b-41c3-9abc-def012345678',
--     verification_token_expires_at = NOW() + INTERVAL '24 hours'
-- WHERE id = '123e4567-e89b-12d3-a456-426614174000';

