# Next Steps After Fixing Tenant

## ✅ What You Just Did

You successfully inserted the tenant from `auth.users` into the `users` table. The tenant should now be visible in your queries.

## 🔧 Next Steps

### Step 1: Fix the Database Trigger (CRITICAL)

**Why:** The trigger is failing for new tenants, causing them to be created in `auth.users` but not in `users` table.

**Action:** Run `fix-database-trigger-with-property-id.sql` in Supabase SQL Editor

This will:
- Update the trigger to handle `property_id` from metadata
- Cast `role` to the correct ENUM type
- Prevent future tenants from having this issue

### Step 2: Fix Any Other Missing Tenants

If you have other tenants in `auth.users` but not in `users` table:

**Action:** Run this SQL to fix ALL missing tenants at once:

```sql
-- Fix all tenants missing from users table
INSERT INTO users (
  id,
  email,
  name,
  role,
  property_id,
  property_name,
  approved
)
SELECT 
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'name', 'Tenant User') as name,
  COALESCE(
    (au.raw_user_meta_data->>'role')::user_role,
    'tenant'::user_role
  ) as role,
  CASE 
    WHEN au.raw_user_meta_data->>'property_id' IS NOT NULL 
    AND au.raw_user_meta_data->>'property_id' != ''
    THEN (au.raw_user_meta_data->>'property_id')::UUID
    ELSE NULL
  END as property_id,
  au.raw_user_meta_data->>'property_name' as property_name,
  false as approved
FROM auth.users au
LEFT JOIN users u ON au.id = u.id
WHERE u.id IS NULL  -- Only tenants NOT in users table
AND COALESCE(
  au.raw_user_meta_data->>'role',
  'tenant'
) = 'tenant'::text
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  property_id = COALESCE(EXCLUDED.property_id, users.property_id),
  property_name = COALESCE(EXCLUDED.property_name, users.property_name);
```

### Step 3: Verify Tenant Can Sign In

Test that the tenant can now sign in:

1. **In Postman:**
   - Use the "Sign In" request
   - Email: Your tenant's email
   - Password: The password you set when creating the tenant

2. **Check Response:**
   - Should return an `access_token`
   - Tenant should be able to authenticate

### Step 4: Test Creating a New Tenant

After fixing the trigger, test creating a new tenant:

1. **Call create-tenant function** with a new email
2. **Check if tenant appears** in both `auth.users` AND `users` table
3. **Verify property assignment** is correct

### Step 5: Update Your Client App

Make sure your client app uses the `create-tenant` function instead of the generic signup endpoint for tenant registration.

## Verification Checklist

- [ ] Trigger fixed (`fix-database-trigger-with-property-id.sql` run)
- [ ] All existing tenants fixed (if any)
- [ ] Tenant can sign in successfully
- [ ] New tenant creation works end-to-end
- [ ] Tenant appears in your app's tenant list

## If You Still Have Issues

1. **Check Supabase Logs:**
   - Dashboard → Database → Logs
   - Look for trigger errors

2. **Check Function Logs:**
   - Dashboard → Edge Functions → create-tenant → Logs

3. **Verify Property Exists:**
   ```sql
   SELECT id, name FROM properties 
   WHERE id = 'your-property-id';
   ```

4. **Check RLS Policies:**
   ```sql
   SELECT * FROM pg_policies 
   WHERE tablename = 'users';
   ```

## Summary

You've fixed the immediate issue. Now:
1. **Fix the trigger** (prevents future issues)
2. **Fix any other missing tenants** (if applicable)
3. **Test the complete flow** (create → sign in → query)

The tenant should now be fully functional! 🎉

