-- Add profile_picture_url column to users table
-- This migration adds support for user profile pictures stored in Supabase Storage

-- Add profile_picture_url column (stores the path/URL to the profile picture in storage)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS profile_picture_url TEXT;

-- Create index on profile_picture_url for faster lookups (optional)
CREATE INDEX IF NOT EXISTS idx_users_profile_picture_url 
ON users(profile_picture_url) 
WHERE profile_picture_url IS NOT NULL;

-- Add comment to document the column
COMMENT ON COLUMN users.profile_picture_url IS 'URL or path to the user profile picture stored in Supabase Storage (profile-pictures bucket)';


