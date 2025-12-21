-- Trigger to call notify-message Edge Function when a message is inserted
-- This works for both web app and Android app messages
-- 
-- IMPORTANT: Replace 'YOUR_PROJECT_REF' with your actual Supabase project reference
-- You can find this in your Supabase dashboard URL: https://YOUR_PROJECT_REF.supabase.co

-- Step 1: Enable pg_net extension if not already enabled
-- This extension allows PostgreSQL to make HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Step 2: Create function to call the Edge Function
-- NOTE: You need to replace 'YOUR_PROJECT_REF' with your actual Supabase project reference
-- and set the SUPABASE_SERVICE_ROLE_KEY as a database secret
CREATE OR REPLACE FUNCTION public.notify_message_on_insert()
RETURNS TRIGGER AS $$
DECLARE
  supabase_url TEXT := 'https://YOUR_PROJECT_REF.supabase.co'; -- REPLACE THIS!
  function_url TEXT;
  request_body JSONB;
  http_job_id BIGINT;
BEGIN
  -- Construct the Edge Function URL
  function_url := supabase_url || '/functions/v1/notify-message';
  
  -- Build request body
  request_body := jsonb_build_object(
    'conversation_id', NEW.conversation_id,
    'sender_id', NEW.sender_id,
    'message_content', NEW.content
  );
  
  -- Make HTTP request to Edge Function using pg_net
  -- This makes an asynchronous HTTP request
  -- Note: We use the service role key from Supabase secrets
  -- The key is automatically available in Supabase Edge Functions environment
  -- For database triggers, we need to pass it via the request
  SELECT net.http_post(
    url := function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', current_setting('app.settings.supabase_anon_key', true)
    )::jsonb,
    body := request_body::text
  ) INTO http_job_id;
  
  -- Log the job ID (optional, for debugging)
  RAISE LOG 'Queued notify-message HTTP request for message % (job_id: %)', NEW.id, http_job_id;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the insert
    RAISE WARNING 'Error calling notify-message function: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 3: Create trigger that fires after message insert
DROP TRIGGER IF EXISTS trigger_notify_message_on_insert ON public.messages;

CREATE TRIGGER trigger_notify_message_on_insert
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_message_on_insert();

-- Note: This trigger will fire for ALL message inserts (web and mobile)
-- The Edge Function will handle filtering to only send emails for tenant/technician conversations

-- ALTERNATIVE APPROACH (Recommended for Supabase):
-- Instead of using pg_net, you can use Supabase Database Webhooks:
-- 1. Go to Supabase Dashboard → Database → Webhooks
-- 2. Create a new webhook:
--    - Table: messages
--    - Events: INSERT
--    - Type: HTTP Request
--    - URL: https://YOUR_PROJECT_REF.supabase.co/functions/v1/notify-message
--    - HTTP Method: POST
--    - HTTP Headers: 
--      - Content-Type: application/json
--      - Authorization: Bearer YOUR_SERVICE_ROLE_KEY
--      - apikey: YOUR_SERVICE_ROLE_KEY
--    - HTTP Body: 
--      {
--        "conversation_id": "{{ $1.conversation_id }}",
--        "sender_id": "{{ $1.sender_id }}",
--        "message_content": "{{ $1.content }}"
--      }
--
-- This approach is simpler and doesn't require pg_net or custom SQL functions.

