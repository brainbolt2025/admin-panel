-- Check if verification columns exist in users table
-- Run this FIRST to see if columns are missing

SELECT 
  column_name, 
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'users' 
  AND column_name IN ('verification_token', 'email_verified', 'verification_token_expires_at')
ORDER BY column_name;

-- Expected result: Should return 3 rows (one for each column)
-- If it returns 0 rows or fewer than 3: COLUMNS ARE MISSING - run the migration!

