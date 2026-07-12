# How to Check Supabase Logs

There are several ways to check logs in Supabase to debug RLS policy issues:

## Method 1: Supabase Dashboard (Easiest)

1. **Go to your Supabase Dashboard**: https://supabase.com/dashboard
2. **Select your project**
3. **Navigate to "Logs" in the left sidebar**
4. **Select the log type**:
   - **Postgres Logs**: Shows database errors, including RLS policy violations
   - **API Logs**: Shows REST API requests/responses
   - **Auth Logs**: Shows authentication events
   - **Edge Function Logs**: Shows Edge Function execution logs

5. **Filter by**:
   - Time range
   - Log level (Error, Warning, Info)
   - Search for keywords like "row-level security", "policy", "conversations", etc.

## Method 2: Supabase SQL Editor - Check Policy Violations

Run this SQL to check recent policy violations:

```sql
-- Check PostgreSQL logs (if log_statement is enabled)
SELECT 
  log_time,
  error_severity,
  message,
  detail
FROM pg_stat_statements
WHERE message LIKE '%row-level security%'
ORDER BY log_time DESC
LIMIT 50;
```

## Method 3: Check Current Policies

Run this to see all policies and their definitions:

```sql
-- Check all policies on conversations table
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual as USING_clause,
  with_check as WITH_CHECK_clause
FROM pg_policies
WHERE tablename = 'conversations'
ORDER BY cmd, policyname;

-- Check policies on work_orders table
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual as USING_clause,
  with_check as WITH_CHECK_clause
FROM pg_policies
WHERE tablename = 'work_orders'
ORDER BY cmd, policyname;
```

## Method 4: Test the Policy Manually

Test if the policy works with a specific user and work order:

```sql
-- First, set the role to test as (replace with actual user ID)
SET ROLE authenticated;
SET request.jwt.claim.sub = '6113d394-66f5-450c-8300-c8b424adc083';

-- Test if user can see the work order
SELECT 
  id,
  tenant_id,
  technician_id,
  CASE 
    WHEN tenant_id = auth.uid() THEN 'User is tenant'
    WHEN technician_id = auth.uid() THEN 'User is technician'
    ELSE 'User not related'
  END as relationship
FROM work_orders
WHERE id = 'e55311f9-184f-4431-acb8-5423d8d89047';

-- Test if the policy function works
SELECT check_user_can_create_conversation('e55311f9-184f-4431-acb8-5423d8d89047'::uuid);

-- Try to insert (this will show the actual error)
INSERT INTO conversations (work_order_id)
VALUES ('e55311f9-184f-4431-acb8-5423d8d89047')
RETURNING *;
```

## Method 5: Enable Detailed Logging

Enable more detailed PostgreSQL logging:

```sql
-- Enable logging of all statements
ALTER DATABASE postgres SET log_statement = 'all';

-- Or just DDL and errors (less verbose)
ALTER DATABASE postgres SET log_statement = 'ddl';

-- Enable logging of policy checks
ALTER DATABASE postgres SET log_min_messages = 'info';
```

**Note**: These settings might not be changeable depending on your Supabase plan. Check with Supabase support if needed.

## Method 6: Check Application Logs

If you're using the mobile app or web app:

1. **Browser Console** (for web):
   - Open Developer Tools (F12)
   - Go to Console tab
   - Look for Supabase/network errors

2. **Mobile App Logs**:
   - Check Android Logcat or iOS Console
   - Filter by your app package name
   - Look for Supabase errors

## Method 7: Check Policy Execution

Create a test to see what's happening:

```sql
-- Create a function to test policy evaluation
CREATE OR REPLACE FUNCTION test_conversation_policy(
  p_work_order_id UUID,
  p_user_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tenant_id UUID;
  v_technician_id UUID;
  v_result TEXT;
BEGIN
  -- Get work order details
  SELECT tenant_id, technician_id
  INTO v_tenant_id, v_technician_id
  FROM work_orders
  WHERE id = p_work_order_id;
  
  -- Build result message
  v_result := format(
    'Work Order: %s, Tenant: %s, Technician: %s, User: %s, ',
    p_work_order_id,
    v_tenant_id,
    v_technician_id,
    p_user_id
  );
  
  IF v_tenant_id = p_user_id THEN
    v_result := v_result || 'User IS tenant - Policy SHOULD allow';
  ELSIF v_technician_id = p_user_id THEN
    v_result := v_result || 'User IS technician - Policy SHOULD allow';
  ELSE
    v_result := v_result || 'User is NOT tenant or technician - Policy will BLOCK';
  END IF;
  
  RETURN v_result;
END;
$$;

-- Test it
SELECT test_conversation_policy(
  'e55311f9-184f-4431-acb8-5423d8d89047'::uuid,
  '6113d394-66f5-450c-8300-c8b424adc083'::uuid
);
```

## What to Look For in Logs

When checking logs, look for:

1. **Error messages** containing:
   - "new row violates row-level security policy"
   - "permission denied"
   - "policy"

2. **Policy evaluation details**:
   - Which policy was evaluated
   - Why it failed (if available)

3. **User context**:
   - What `auth.uid()` value was used
   - Whether the user was authenticated

4. **Work order details**:
   - Whether the work order exists
   - What the tenant_id and technician_id values are

## Quick Debug Query

Run this to see current state:

```sql
-- Quick debug: Check everything at once
SELECT 
  'Current User' as check_type,
  auth.uid()::text as value
UNION ALL
SELECT 
  'Work Order Exists',
  CASE WHEN EXISTS (SELECT 1 FROM work_orders WHERE id = 'e55311f9-184f-4431-acb8-5423d8d89047') THEN 'YES' ELSE 'NO' END
UNION ALL
SELECT 
  'Tenant ID',
  tenant_id::text
FROM work_orders
WHERE id = 'e55311f9-184f-4431-acb8-5423d8d89047'
UNION ALL
SELECT 
  'Technician ID',
  technician_id::text
FROM work_orders
WHERE id = 'e55311f9-184f-4431-acb8-5423d8d89047'
UNION ALL
SELECT 
  'Policy Function Result',
  check_user_can_create_conversation('e55311f9-184f-4431-acb8-5423d8d89047')::text
UNION ALL
SELECT 
  'User is Tenant',
  CASE WHEN (SELECT tenant_id FROM work_orders WHERE id = 'e55311f9-184f-4431-acb8-5423d8d89047') = auth.uid() THEN 'YES' ELSE 'NO' END;
```

Replace the UUIDs with your actual values.

