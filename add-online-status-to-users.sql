-- Add online status tracking columns to users table
-- This enables showing online/offline status for tenants and technicians in chat

-- Add is_online column (boolean to track if user is currently online)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT false;

-- Add last_seen column (timestamp of when user was last seen/active)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ DEFAULT now();

-- Create index on is_online for faster queries (filtering online users)
CREATE INDEX IF NOT EXISTS idx_users_is_online 
ON users(is_online) 
WHERE is_online = true;

-- Create index on last_seen for sorting by recent activity
CREATE INDEX IF NOT EXISTS idx_users_last_seen 
ON users(last_seen DESC);

-- Add comments to document the columns
COMMENT ON COLUMN users.is_online IS 'Whether the user is currently online (true) or offline (false)';
COMMENT ON COLUMN users.last_seen IS 'Timestamp of when the user was last seen/active in the application';

-- Optional: Set default last_seen for existing users to now
UPDATE users 
SET last_seen = now() 
WHERE last_seen IS NULL;

