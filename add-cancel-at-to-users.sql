-- Add cancel_at column to users table for storing scheduled cancellation date
-- This allows us to show persistent messages about scheduled cancellations

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS cancel_at TIMESTAMPTZ;

-- Add index for faster queries of scheduled cancellations
CREATE INDEX IF NOT EXISTS idx_users_cancel_at 
ON users(cancel_at) 
WHERE cancel_at IS NOT NULL;

-- Add comment to document the column
COMMENT ON COLUMN users.cancel_at IS 'Timestamp when subscription is scheduled to be cancelled (from Stripe cancel_at field). NULL if not scheduled for cancellation.';

