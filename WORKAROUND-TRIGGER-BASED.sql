-- WORKAROUND: Use Trigger Instead of RLS Policy
-- If RLS policies won't work, use a trigger to enforce permissions
-- This will definitely work

-- ============================================
-- STEP 1: Drop existing policies (keep SELECT for viewing)
-- ============================================
DROP POLICY IF EXISTS "Users can create conversations for their work orders" ON public.conversations;
DROP POLICY IF EXISTS "conversations_insert_policy" ON public.conversations;

-- Create very permissive INSERT policy (trigger will do the checking)
CREATE POLICY "conversations_insert_permissive"
  ON public.conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (work_order_id IS NOT NULL);

-- ============================================
-- STEP 2: Create trigger function to check permissions
-- ============================================
CREATE OR REPLACE FUNCTION check_conversation_insert_permission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $trigger$
DECLARE
  v_tenant_id UUID;
  v_technician_id UUID;
  v_user_id UUID;
BEGIN
  -- Get user ID (try multiple methods)
  BEGIN
    v_user_id := (current_setting('request.jwt.claim.sub', true))::uuid;
  EXCEPTION
    WHEN OTHERS THEN
      v_user_id := auth.uid();
  END;
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Permission denied: User not authenticated';
  END IF;
  
  -- Get work order details (bypasses RLS)
  SELECT tenant_id, technician_id
  INTO v_tenant_id, v_technician_id
  FROM work_orders
  WHERE id = NEW.work_order_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Permission denied: Work order not found';
  END IF;
  
  -- Check if user is tenant or technician
  IF v_user_id != v_tenant_id AND v_user_id != v_technician_id THEN
    RAISE EXCEPTION 'Permission denied: User ID % is not tenant (%) or technician (%) for work order %',
      v_user_id, v_tenant_id, v_technician_id, NEW.work_order_id;
  END IF;
  
  RETURN NEW;
END;
$trigger$;

-- ============================================
-- STEP 3: Create the trigger
-- ============================================
DROP TRIGGER IF EXISTS check_conversation_insert_permission_trigger ON public.conversations;

CREATE TRIGGER check_conversation_insert_permission_trigger
  BEFORE INSERT ON public.conversations
  FOR EACH ROW
  EXECUTE FUNCTION check_conversation_insert_permission();

-- ============================================
-- STEP 4: Verify
-- ============================================
SELECT 
  'Trigger Check' as check_type,
  CASE 
    WHEN EXISTS (
      SELECT 1 
      FROM pg_trigger 
      WHERE tgname = 'check_conversation_insert_permission_trigger'
        AND tgrelid = 'public.conversations'::regclass
    ) THEN '✓ Trigger exists'
    ELSE '✗ Trigger NOT FOUND'
  END as status;

SELECT 
  'Policy Check' as check_type,
  policyname,
  cmd,
  with_check::text
FROM pg_policies
WHERE tablename = 'conversations'
  AND cmd = 'INSERT';

-- ============================================
-- DONE!
-- ============================================
-- Now the trigger will check permissions instead of RLS policy
-- The policy just needs to allow the INSERT to happen
-- The trigger will block it if user is not authorized

