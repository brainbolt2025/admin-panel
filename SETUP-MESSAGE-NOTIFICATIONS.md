# Setup Message Notifications for Android App

Since messages are sent from the Android app (not the web app), we need to set up a database trigger or webhook to automatically call the `notify-message` Edge Function when messages are inserted.

## Option 1: Database Webhook (Recommended - Simplest)

This is the easiest and most reliable approach for Supabase.

### Steps:

1. **Go to Supabase Dashboard**
   - Navigate to: **Database** → **Webhooks**

2. **Create New Webhook**
   - Click **"Create a new webhook"**

3. **Configure Webhook:**
   - **Name**: `notify-message-on-insert`
   - **Table**: `messages` (this refers to `public.messages` - the actual messages table)
     - **Note**: You might see both `realtime.messages` and `public.messages` in the dropdown
     - **Select `messages`** which is the `public.messages` table (the one your app uses)
     - The `realtime` schema is internal to Supabase and not where your data is stored
   - **Events**: Check **INSERT**
   - **Type**: `HTTP Request`
   - **HTTP Method**: `POST`
   - **URL**: `https://YOUR_PROJECT_REF.supabase.co/functions/v1/notify-message`
     - Replace `YOUR_PROJECT_REF` with your actual Supabase project reference
     - You can find this in your Supabase dashboard URL

4. **HTTP Headers:**
   ```
   Content-Type: application/json
   Authorization: Bearer YOUR_SERVICE_ROLE_KEY
   apikey: YOUR_SERVICE_ROLE_KEY
   ```
   - Replace `YOUR_SERVICE_ROLE_KEY` with your actual service role key
   - You can find this in: **Project Settings** → **API** → **Service Role Key**

5. **HTTP Request Body (Optional):**
   - **Note**: Supabase Database Webhooks automatically send the row data in this format:
     ```json
     {
       "type": "INSERT",
       "table": "messages",
       "record": {
         "id": "...",
         "conversation_id": "...",
         "sender_id": "...",
         "content": "...",
         ...
       },
       "schema": "public"
     }
     ```
   - The Edge Function has been updated to handle this format automatically
   - You can leave the HTTP Parameters section empty, or if there's a "Request Body" section, you don't need to configure it

6. **Save the Webhook**

### Testing:
- Send a message from the Android app
- Check the Edge Function logs in: **Edge Functions** → **notify-message** → **Logs**
- You should see logs starting with "=== notify-message function called ==="

---

## Option 2: Database Trigger with pg_net (Alternative)

If you prefer using SQL triggers, you can use the `trigger-notify-message-on-insert.sql` file.

### Steps:

1. **Update the SQL file:**
   - Open `trigger-notify-message-on-insert.sql`
   - Replace `YOUR_PROJECT_REF` with your actual Supabase project reference

2. **Run the SQL:**
   - Go to Supabase Dashboard → **SQL Editor**
   - Paste the contents of `trigger-notify-message-on-insert.sql`
   - Click **Run**

3. **Note:** This approach requires the `pg_net` extension and may need additional configuration.

---

## Verify It's Working

After setting up either option:

1. **Send a test message** from the Android app (between a tenant and technician)

2. **Check Edge Function logs:**
   - Go to: **Edge Functions** → **notify-message** → **Logs**
   - You should see:
     - "=== notify-message function called ==="
     - "Starting notification process..."
     - "Fetching conversation details for: ..."

3. **Check recipient's email** - they should receive a notification email

4. **If no logs appear:**
   - Verify the webhook/trigger is configured correctly
   - Check that the Edge Function is deployed: `supabase functions deploy notify-message`
   - Verify the URL in the webhook matches your project

---

## Troubleshooting

### No logs in Edge Function:
- Make sure the function is deployed
- Check the webhook URL is correct
- Verify the service role key is correct in webhook headers

### Function called but no email sent:
- Check Edge Function logs for errors
- Verify Mailgun is configured (MAILGUN_DOMAIN, MAILGUN_API_KEY)
- Check that both sender and recipient are tenant/technician (PMs don't get notifications)

### Function not being called:
- Verify the webhook is active in Database → Webhooks
- Check that messages are being inserted into the `messages` table
- Try manually triggering the webhook to test

