-- Update email from jromero+technician4@mimmect.com to jromero+technician4@minnect.com
-- This script updates both auth.users and public.users tables

-- Step 1: Find the user ID by email
DO $$
DECLARE
    user_uuid UUID;
    old_email TEXT := 'jromero+technician4@mimmect.com';
    new_email TEXT := 'jromero+technician4@minnect.com';
BEGIN
    -- Find user ID from auth.users
    SELECT id INTO user_uuid
    FROM auth.users
    WHERE email = old_email;
    
    IF user_uuid IS NULL THEN
        RAISE EXCEPTION 'User with email % not found in auth.users', old_email;
    END IF;
    
    RAISE NOTICE 'Found user ID: %', user_uuid;
    
    -- Step 2: Update email in auth.users
    UPDATE auth.users
    SET 
        email = new_email,
        email_change = new_email,
        email_change_token = NULL,
        email_change_token_new = NULL,
        email_change_sent_at = NULL
    WHERE id = user_uuid;
    
    RAISE NOTICE 'Updated email in auth.users';
    
    -- Step 3: Update email in public.users table (if exists)
    UPDATE public.users
    SET email = new_email
    WHERE id = user_uuid;
    
    IF FOUND THEN
        RAISE NOTICE 'Updated email in public.users';
    ELSE
        RAISE NOTICE 'No matching record found in public.users (this is OK if user was created differently)';
    END IF;
    
    RAISE NOTICE 'Email update completed successfully!';
    RAISE NOTICE 'Old email: %', old_email;
    RAISE NOTICE 'New email: %', new_email;
    RAISE NOTICE 'User ID: %', user_uuid;
END $$;

-- Verify the update
SELECT 
    au.id,
    au.email as auth_email,
    au.email_confirmed_at,
    pu.email as users_table_email,
    pu.name,
    pu.role
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
WHERE au.email = 'jromero+technician4@minnect.com'
   OR au.email = 'jromero+technician4@mimmect.com';

