-- Remove the notify-message trigger if it exists and is causing issues
-- This is safe to run - it only removes the trigger we created

-- Drop the trigger if it exists
DROP TRIGGER IF EXISTS trigger_notify_message_on_insert ON public.messages;

-- Drop the function if it exists (optional - only if you want to remove it completely)
-- DROP FUNCTION IF EXISTS public.notify_message_on_insert();

-- Note: If you're using the Database Webhook approach (recommended),
-- you don't need this trigger at all. The webhook will handle notifications.





