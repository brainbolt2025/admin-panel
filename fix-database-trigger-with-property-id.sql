-- Fix database trigger to handle property_id from user metadata
-- This ensures tenants can be created with property_id in metadata

-- Update the trigger function to extract and use property_id
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_role TEXT;
  user_name TEXT;
  user_property_name TEXT;
  user_property_id UUID;
BEGIN
  -- Debug: Log the raw metadata to see what's available
  RAISE LOG 'Raw user metadata: %', NEW.raw_user_meta_data;
  RAISE LOG 'User metadata role: %', NEW.raw_user_meta_data->>'role';
  RAISE LOG 'User metadata name: %', NEW.raw_user_meta_data->>'name';
  RAISE LOG 'User metadata property_name: %', NEW.raw_user_meta_data->>'property_name';
  RAISE LOG 'User metadata property_id: %', NEW.raw_user_meta_data->>'property_id';
  
  -- Extract values from auth user metadata
  -- Try both raw_user_meta_data and user_meta_data
  user_role := COALESCE(
    NEW.raw_user_meta_data->>'role',
    'tenant'
  )::user_role;
  user_name := COALESCE(
    NEW.raw_user_meta_data->>'name',
    'Temporary Name'  -- Provide a default value instead of NULL
  );
  user_property_name := NEW.raw_user_meta_data->>'property_name';  -- Allow NULL
  
  -- Extract property_id from metadata (if provided)
  -- property_id might be stored as string in JSON, so try to cast it
  BEGIN
    IF NEW.raw_user_meta_data->>'property_id' IS NOT NULL 
    AND NEW.raw_user_meta_data->>'property_id' != '' THEN
      user_property_id := (NEW.raw_user_meta_data->>'property_id')::UUID;
    ELSE
      user_property_id := NULL;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    user_property_id := NULL;
  END;
  
  RAISE LOG 'Extracted values - role: %, name: %, property_name: %, property_id: %', 
    user_role, user_name, user_property_name, user_property_id;
  
  -- Create user in public.users table
  -- Include property_id if it was provided in metadata
  INSERT INTO public.users (id, email, role, name, property_name, property_id)
  VALUES (
    NEW.id,
    NEW.email,
    user_role::user_role,  -- Cast to ENUM type
    user_name,
    user_property_name,
    user_property_id  -- Can be NULL if not provided
  )
  ON CONFLICT (id) DO UPDATE SET
    -- If user already exists (rare), update with latest metadata
    email = EXCLUDED.email,
    role = EXCLUDED.role::user_role,
    name = CASE 
      WHEN EXCLUDED.name != 'Temporary Name' THEN EXCLUDED.name 
      ELSE users.name 
    END,
    property_name = COALESCE(EXCLUDED.property_name, users.property_name),
    property_id = COALESCE(EXCLUDED.property_id, users.property_id);
  
  RAISE LOG 'User created/updated with role: %', user_role;
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the auth user creation
    RAISE WARNING 'Error in handle_new_user trigger: %', SQLERRM;
    -- Return NEW anyway so auth user creation doesn't fail
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure the trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Verify the trigger was created
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';

-- Test query to check trigger function
SELECT 
  proname AS function_name,
  prosrc AS function_source
FROM pg_proc
WHERE proname = 'handle_new_user';

