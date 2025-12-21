-- Check for triggers on messages table that might be causing the error
-- Run this in Supabase SQL Editor to see what triggers exist

-- Check all triggers on messages table
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement,
    action_timing
FROM information_schema.triggers
WHERE event_object_table = 'messages'
ORDER BY trigger_name;

-- Check for functions that might be using HTTP/pg_net
SELECT 
    routine_name,
    routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
AND (
    routine_definition LIKE '%http%' 
    OR routine_definition LIKE '%pg_net%'
    OR routine_definition LIKE '%net.http%'
)
ORDER BY routine_name;



