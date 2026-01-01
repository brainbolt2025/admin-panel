-- Check specifically for triggers/functions that use HTTP or pg_net
-- These are the ones that could cause the "URL using bad/illegal format" error

-- Check for functions that use HTTP/pg_net
SELECT 
    routine_name,
    routine_type,
    LEFT(routine_definition, 500) as definition_preview
FROM information_schema.routines
WHERE routine_schema = 'public'
AND (
    UPPER(routine_definition) LIKE '%HTTP%' 
    OR UPPER(routine_definition) LIKE '%PG_NET%'
    OR UPPER(routine_definition) LIKE '%NET.HTTP%'
    OR routine_name LIKE '%notify%'
    OR routine_name LIKE '%http%'
)
ORDER BY routine_name;

-- Check all triggers and see which functions they call
SELECT 
    t.trigger_name,
    t.event_object_table,
    t.action_timing,
    t.event_manipulation,
    p.proname as function_name,
    pg_get_functiondef(p.oid) as function_definition
FROM information_schema.triggers t
JOIN pg_trigger pt ON pt.tgname = t.trigger_name
JOIN pg_proc p ON p.oid = pt.tgfoid
WHERE t.event_object_table = 'messages';





