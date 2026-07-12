-- Convert users.approved from BOOLEAN to ENUM (pending | approved | rejected)
-- Run this in the Supabase SQL Editor before deploying the admin panel changes.

-- Step 1: Create the approval status enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_approval_status') THEN
    CREATE TYPE user_approval_status AS ENUM ('pending', 'approved', 'rejected');
  END IF;
END $$;

-- Step 2: Add temporary column
ALTER TABLE users
ADD COLUMN IF NOT EXISTS approved_new user_approval_status;

-- Step 3: Migrate existing boolean values
-- true  -> approved
-- false / null -> pending  (existing "not approved" users stay pending;
--                          use the admin Reject action going forward for rejected)
UPDATE users
SET approved_new = CASE
  WHEN approved IS TRUE THEN 'approved'::user_approval_status
  ELSE 'pending'::user_approval_status
END
WHERE approved_new IS NULL;

-- Step 4: Drop old boolean column and rename
-- CASCADE drops dependent policies/views that reference users.approved — recreate if needed
ALTER TABLE users DROP COLUMN approved CASCADE;
ALTER TABLE users RENAME COLUMN approved_new TO approved;

-- Step 5: Default for new rows
ALTER TABLE users
ALTER COLUMN approved SET DEFAULT 'pending'::user_approval_status;

-- Step 6: Verify
SELECT
  approved,
  COUNT(*) AS user_count
FROM users
GROUP BY approved
ORDER BY approved;

SELECT
  column_name,
  data_type,
  udt_name,
  column_default
FROM information_schema.columns
WHERE table_name = 'users'
  AND column_name = 'approved';
