# Troubleshooting Database Error Creating New User

## Error: "Database error creating new user" (500)

This error occurs when the database trigger fails while creating a user in the `users` table.

## Common Causes

### 1. Trigger Missing property_id Column

**Problem:** The trigger tries to insert into `users` table but `property_id` column might be missing or have constraints.

**Solution:** Run the updated trigger fix:
```sql
-- Run fix-database-trigger-with-property-id.sql
```

This updates the trigger to:
- Extract `property_id` from user metadata
- Include `property_id` in the INSERT statement
- Handle NULL values properly

### 2. Foreign Key Constraint Failure

**Problem:** If `property_id` is provided but doesn't exist in `properties` table, the foreign key constraint will fail.

**Check:**
```sql
-- Verify property exists
SELECT id, name FROM properties WHERE id = 'your-property-id';
```

**Solution:** Make sure the property exists before creating the tenant.

### 3. NOT NULL Constraint Failure

**Problem:** Required columns might be NULL when the trigger inserts.

**Check:**
```sql
-- Check table structure and NOT NULL constraints
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'users'
ORDER BY ordinal_position;
```

**Solution:** The trigger should handle this with defaults, but verify your table schema.

### 4. RLS Policy Blocking Insert

**Problem:** Row Level Security policies might be blocking the trigger from inserting.

**Check:**
```sql
-- Check RLS policies on users table
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'users';
```

**Solution:** The trigger runs with `SECURITY DEFINER` which should bypass RLS, but verify.

### 5. Trigger Function Error

**Problem:** The trigger function itself might have an error.

**Check logs:**
1. Go to Supabase Dashboard → Database → Logs
2. Look for errors from `handle_new_user` function
3. Check for specific constraint violations

## Step-by-Step Fix

### Step 1: Update the Trigger

Run the SQL fix:
```sql
-- Run fix-database-trigger-with-property-id.sql in Supabase SQL Editor
```

### Step 2: Verify Trigger is Active

```sql
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';
```

Should return the trigger details.

### Step 3: Test the Trigger Manually

```sql
-- Check if trigger function exists
SELECT proname FROM pg_proc WHERE proname = 'handle_new_user';

-- View trigger function code
SELECT prosrc FROM pg_proc WHERE proname = 'handle_new_user';
```

### Step 4: Check for Constraint Violations

```sql
-- Check foreign key constraints
SELECT
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'users'::regclass
AND contype = 'f';
```

### Step 5: Verify Property Exists

Before creating tenant, verify:
```sql
SELECT id, name FROM properties 
WHERE id = 'property-id-here' 
OR name = 'property-name-here';
```

## Prevention

1. **Always provide valid property_id or property_name** when creating tenants
2. **Verify property exists** before creating tenant
3. **Keep trigger updated** with latest schema changes
4. **Monitor database logs** for trigger errors

## Alternative: Disable Trigger Temporarily

If you need to debug, you can temporarily disable the trigger:

```sql
-- Disable trigger
ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created;

-- Do your testing...

-- Re-enable trigger
ALTER TABLE auth.users ENABLE TRIGGER on_auth_user_created;
```

## Debugging Steps

1. **Check Supabase Logs**: Dashboard → Database → Logs
2. **Check function logs**: Dashboard → Edge Functions → create-tenant → Logs
3. **Test with minimal data**: Try creating a tenant with just required fields
4. **Check database constraints**: Run the constraint queries above
5. **Verify property exists**: Make sure property_id is valid

## Expected Behavior

After fixing the trigger:
1. Auth user is created via Admin API
2. Trigger fires and creates user in `users` table
3. Trigger includes `property_id` if provided in metadata
4. Edge function updates user with complete data
5. Tenant can sign in

## Still Getting Errors?

1. Check the exact error message in Supabase Dashboard logs
2. Verify the property_id exists in properties table
3. Check if any NOT NULL columns are missing
4. Verify foreign key constraints are satisfied
5. Check RLS policies aren't blocking the insert

