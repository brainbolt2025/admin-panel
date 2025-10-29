-- Fix the database trigger to handle PM users properly
-- The trigger needs to extract name and property_name from auth user metadata

-- First, let's see the current trigger
-- You can find it in: Supabase Dashboard → Database → Triggers

-- Option 1: Fix the trigger to handle PM users with metadata
-- Replace your existing trigger function with this:

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if this is a PM user (from user_metadata)
  -- If it's a PM user, skip - the edge function will handle it
  -- Otherwise, create tenant user
  IF NEW.raw_user_meta_data->>'role' != 'pm' THEN
    INSERT INTO public.users (id, email, role, name, property_name)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'role', 'tenant'),
      COALESCE(NEW.raw_user_meta_data->>'name', ''),
      COALESCE(NEW.raw_user_meta_data->>'property_name', '')
    )
    ON CONFLICT (id) DO NOTHING; -- Handle if user already exists
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Option 2: Make name and property_name nullable or provide defaults
-- If you prefer to keep the trigger simple, update the table:

-- ALTER TABLE public.users 
-- ALTER COLUMN name DROP NOT NULL,
-- ALTER COLUMN property_name DROP NOT NULL;

-- Then your trigger can use:
-- INSERT INTO public.users (id, email, role)
-- VALUES (new.id, new.email, COALESCE(new.raw_user_meta_data->>'role', 'tenant'));

-- Option 3: Disable the trigger entirely for PM users
-- Modify the trigger to skip PM users:

/*
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Only auto-create tenant users, not PM users
  -- PM users are created by the edge function with full data
  IF COALESCE(NEW.raw_user_meta_data->>'role', 'tenant') != 'pm' THEN
    INSERT INTO public.users (id, email, role, name, property_name)
    VALUES (
      NEW.id,
      NEW.email,
      'tenant',
      COALESCE(NEW.raw_user_meta_data->>'name', ''),
      COALESCE(NEW.raw_user_meta_data->>'property_name', '')
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
*/

-- IMPORTANT: After updating the trigger function, make sure the trigger itself still exists:
-- The trigger should be on auth.users table, AFTER INSERT, calling handle_new_user()

