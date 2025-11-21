-- ============================================
-- VERIFY REALTIME IS ENABLED FOR MESSAGES
-- ============================================
-- Run this to check if Realtime is properly enabled for chat tables

-- Step 1: Check if Realtime extension is installed
SELECT 
  'Realtime Extension' as check_type,
  extname as extension_name,
  extversion as version,
  CASE 
    WHEN extname = 'pg_cron' THEN '⚠ pg_cron may interfere with Realtime'
    WHEN extname IS NOT NULL THEN '✓ Extension found'
    ELSE '✗ Extension not found'
  END as status
FROM pg_extension
WHERE extname IN ('pg_cron', 'wAL2json');

-- Step 2: Check if supabase_realtime publication exists
SELECT 
  'Realtime Publication' as check_type,
  pubname as publication_name,
  CASE 
    WHEN pubname = 'supabase_realtime' THEN '✓ Publication exists'
    ELSE '✗ Publication not found'
  END as status
FROM pg_publication
WHERE pubname = 'supabase_realtime';

-- Step 3: Check which tables are in the Realtime publication
SELECT 
  'Tables in Realtime' as check_type,
  schemaname,
  tablename,
  CASE 
    WHEN tablename IN ('messages', 'conversations', 'message_receipts') THEN '✓ In Realtime'
    ELSE 'Other table'
  END as status
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;

-- Step 4: Specifically check for messages table
SELECT 
  'Messages Table Check' as check_type,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' 
        AND tablename = 'messages'
        AND schemaname = 'public'
    ) THEN '✓ Messages table IS in Realtime publication'
    ELSE '✗ Messages table NOT in Realtime publication'
  END as status;

-- Step 5: Check if messages table exists
SELECT 
  'Messages Table Exists' as check_type,
  tablename,
  CASE 
    WHEN tablename = 'messages' THEN '✓ Table exists'
    ELSE '✗ Table not found'
  END as status
FROM pg_tables
WHERE schemaname = 'public' 
  AND tablename = 'messages';

-- Step 6: Verify RLS is enabled (should be for security)
SELECT 
  'RLS Status' as check_type,
  tablename,
  rowsecurity as rls_enabled,
  CASE 
    WHEN rowsecurity THEN '✓ RLS enabled (secure)'
    ELSE '⚠ RLS disabled'
  END as status
FROM pg_tables
WHERE schemaname = 'public' 
  AND tablename IN ('messages', 'conversations', 'message_receipts')
ORDER BY tablename;

-- ============================================
-- FIX: Add messages table to Realtime if missing
-- ============================================

DO $$
BEGIN
  -- Add messages table to Realtime publication if not already there
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND tablename = 'messages'
      AND schemaname = 'public'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
    RAISE NOTICE '✓ Added messages table to Realtime publication';
  ELSE
    RAISE NOTICE '✓ Messages table already in Realtime publication';
  END IF;

  -- Add conversations table to Realtime publication if not already there
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND tablename = 'conversations'
      AND schemaname = 'public'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
    RAISE NOTICE '✓ Added conversations table to Realtime publication';
  ELSE
    RAISE NOTICE '✓ Conversations table already in Realtime publication';
  END IF;

  -- Add message_receipts table to Realtime publication if not already there
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND tablename = 'message_receipts'
      AND schemaname = 'public'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.message_receipts;
    RAISE NOTICE '✓ Added message_receipts table to Realtime publication';
  ELSE
    RAISE NOTICE '✓ Message_receipts table already in Realtime publication';
  END IF;
EXCEPTION
  WHEN undefined_object THEN
    RAISE WARNING 'supabase_realtime publication does not exist. Enable Realtime in Supabase Dashboard → Database → Replication.';
END $$;

-- Final verification
SELECT 
  'Final Status' as info,
  tablename,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' 
        AND pg_publication_tables.tablename = t.tablename
        AND schemaname = 'public'
    ) THEN '✓ Enabled for Realtime'
    ELSE '✗ NOT enabled for Realtime'
  END as realtime_status
FROM pg_tables t
WHERE schemaname = 'public' 
  AND tablename IN ('messages', 'conversations', 'message_receipts')
ORDER BY tablename;

