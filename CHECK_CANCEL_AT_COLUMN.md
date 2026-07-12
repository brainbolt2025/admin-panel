# How to Check and Add `cancel_at` Column

## Where to Find It

The `cancel_at` column should be in the **`users` table** in your Supabase database.

### Steps to Check:

1. **Go to Supabase Dashboard**
   - Navigate to: https://supabase.com/dashboard
   - Select your project

2. **Open Table Editor**
   - Click on **"Table Editor"** in the left sidebar
   - Select the **`users`** table

3. **Look for `cancel_at` column**
   - It should be a column of type `TIMESTAMPTZ` (timestamp with timezone)
   - It may be `NULL` if the subscription is not scheduled for cancellation

### If the Column Doesn't Exist:

Run this SQL migration in **SQL Editor**:

```sql
-- Add cancel_at column to users table for storing scheduled cancellation date
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS cancel_at TIMESTAMPTZ;

-- Add index for faster queries of scheduled cancellations
CREATE INDEX IF NOT EXISTS idx_users_cancel_at 
ON users(cancel_at) 
WHERE cancel_at IS NOT NULL;

-- Add comment to document the column
COMMENT ON COLUMN users.cancel_at IS 'Timestamp when subscription is scheduled to be cancelled (from Stripe cancel_at field). NULL if not scheduled for cancellation.';
```

### How to Check a Specific User's `cancel_at` Value:

Run this query in SQL Editor:

```sql
SELECT 
  id,
  email,
  name,
  subscription_status,
  cancel_at,
  CASE 
    WHEN cancel_at IS NULL THEN 'No cancellation scheduled'
    WHEN cancel_at > NOW() THEN 'Cancellation scheduled for ' || cancel_at::text
    ELSE 'Subscription expired on ' || cancel_at::text
  END AS cancellation_status
FROM users
WHERE email = 'your-email@example.com';  -- Replace with your email
```

Or to see all PM users with cancellation info:

```sql
SELECT 
  id,
  email,
  name,
  subscription_status,
  cancel_at,
  CASE 
    WHEN cancel_at IS NULL THEN 'No cancellation scheduled'
    WHEN cancel_at > NOW() THEN 'Cancellation scheduled for ' || cancel_at::text
    ELSE 'Subscription expired on ' || cancel_at::text
  END AS cancellation_status
FROM users
WHERE role = 'pm'
ORDER BY cancel_at DESC NULLS LAST;
```

## Expected Values:

- **`NULL`**: Subscription is not scheduled for cancellation
- **Future date** (e.g., `2025-01-15 00:00:00+00`): Subscription is scheduled to be cancelled on this date (still in grace period)
- **Past date**: Subscription cancellation date has passed (subscription is expired)



