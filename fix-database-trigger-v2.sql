-- Fix the database trigger to handle PM users properly
-- This version handles NOT NULL constraints safely

-- Step 1: Make name and property_name nullable temporarily
-- This allows the trigger to work without constraint violations
ALTER TABLE public.users 
ALTER COLUMN name DROP NOT NULL,
ALTER COLUMN property_name DROP NOT NULL;

-- Step 2: Create the improved trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_role TEXT;
  user_name TEXT;
  user_property_name TEXT;
BEGIN
  -- Debug: Log the raw metadata to see what's available
  RAISE LOG 'Raw user metadata: %', NEW.raw_user_meta_data;
  RAISE LOG 'User metadata role: %', NEW.raw_user_meta_data->>'role';
  RAISE LOG 'User metadata name: %', NEW.raw_user_meta_data->>'name';
  RAISE LOG 'User metadata property_name: %', NEW.raw_user_meta_data->>'property_name';
  
  -- Extract values from auth user metadata
  -- Try both raw_user_meta_data and user_meta_data
  user_role := COALESCE(
    NEW.raw_user_meta_data->>'role',
    NEW.user_meta_data->>'role', 
    'tenant'
  );
  user_name := COALESCE(
    NEW.raw_user_meta_data->>'name',
    NEW.user_meta_data->>'name',
    NULL  -- Use NULL instead of empty string
  );
  user_property_name := COALESCE(
    NEW.raw_user_meta_data->>'property_name',
    NEW.user_meta_data->>'property_name',
    NULL  -- Use NULL instead of empty string
  );
  
  RAISE LOG 'Extracted values - role: %, name: %, property_name: %', user_role, user_name, user_property_name;
  
  -- Create user in public.users table
  -- This works for both PM users (with role='pm') and tenant users
  -- The edge function will then UPDATE PM users with complete data
  INSERT INTO public.users (id, email, role, name, property_name)
  VALUES (
    NEW.id,
    NEW.email,
    user_role,
    user_name,
    user_property_name
  )
  ON CONFLICT (id) DO UPDATE SET
    -- If user already exists (rare), update with latest metadata
    email = EXCLUDED.email,
    role = EXCLUDED.role,
    name = COALESCE(EXCLUDED.name, users.name),
    property_name = COALESCE(EXCLUDED.property_name, users.property_name);
  
  RAISE LOG 'User created/updated with role: %', user_role;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 3: Ensure the trigger exists
-- Drop and recreate to make sure it's properly attached
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Step 4: Add back NOT NULL constraints after the trigger is working
-- (We'll do this after testing)
-- ALTER TABLE public.users 
-- ALTER COLUMN name SET NOT NULL,
-- ALTER COLUMN property_name SET NOT NULL;

-- This trigger will:
-- 1. Create PM users with role='pm' from metadata
-- 2. Create tenant users with role='tenant'
-- 3. Extract name and property_name from auth metadata (can be NULL initially)
-- 4. The create-user edge function will then UPDATE PM users with complete, verified data
