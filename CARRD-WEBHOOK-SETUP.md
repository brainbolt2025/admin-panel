# Carrd Webhook Setup Guide

This guide shows you how to connect your Carrd form to the Asine waitlist Edge Function.

## Prerequisites

✅ Function deployed to Supabase (staging or production)  
✅ Database table created (`pm_waitlist`)  
✅ Mailgun secrets configured  

## Step 1: Deploy the Function

If you haven't deployed yet, deploy to staging first:

```bash
# For staging
supabase functions deploy add-to-waitlist --project-ref goljbyvrnktxwtnjomaq

# For production (after testing)
supabase functions deploy add-to-waitlist --project-ref qmhmgjzkpfzxfjdurigu
```

## Step 2: Get Your Webhook URL

**Staging URL (for testing):**
```
https://goljbyvrnktxwtnjomaq.supabase.co/functions/v1/add-to-waitlist
```

**Production URL (when ready):**
```
https://qmhmgjzkpfzxfjdurigu.supabase.co/functions/v1/add-to-waitlist
```

## Step 3: Configure Carrd Webhook

### In Your Carrd Form:

1. **Edit your form** in Carrd
2. Go to **Settings** → **Integrations**
3. Click **Add Integration** or **Add Webhook**
4. Select **Webhook** integration type

### Webhook Configuration:

**Webhook URL:**
```
https://goljbyvrnktxwtnjomaq.supabase.co/functions/v1/add-to-waitlist
```
(Use staging URL for testing, production URL when ready)

**HTTP Method:** `POST`

**Content Type:** `application/json`

**Request Body / Payload:**
```json
{
  "email": "{email}",
  "property_name": "{property_name}"
}
```

**Important:** Replace `{email}` and `{property_name}` with your actual Carrd form field names.

### Field Mapping Examples:

If your Carrd form fields are named:
- Email field: `email` → use `{email}`
- Property name field: `property` → use `{property}`

Example payload:
```json
{
  "email": "{email}",
  "property_name": "{property}"
}
```

### Common Carrd Field Placeholders:

- `{email}` - Email field value
- `{name}` - Name field value (not used in waitlist, but you might have it)
- `{property_name}` - Your property name field
- `{company}` - Company field (if you named it differently)

**Note:** Only `email` and `property_name` are required. The function will validate both fields.

## Step 4: Test the Integration

1. **Submit a test form** on your Carrd page
2. **Check Supabase logs:**
   - Go to Supabase Dashboard → Edge Functions → `add-to-waitlist` → Logs
   - You should see successful requests

3. **Verify in database:**
   - Go to Supabase Dashboard → Table Editor → `pm_waitlist`
   - Check that your test entry was created

4. **Check email:**
   - Verify the thank-you email was sent to the test email address

## Step 5: Handle Response (Optional)

Carrd can show success/error messages based on the webhook response:

**Success Response (200):**
```json
{
  "success": true,
  "message": "Successfully added to waitlist",
  "id": "uuid-here"
}
```

**Error Response (400/409/500):**
```json
{
  "success": false,
  "error": "Error message here"
}
```

You can configure Carrd to show custom messages based on the response, but the default success message should work fine.

## Troubleshooting

### Webhook not firing:
- ✅ Check webhook URL is correct
- ✅ Verify function is deployed
- ✅ Check Carrd form is published (not just draft)

### 404 Not Found:
- Function not deployed
- Wrong project URL (check staging vs production)

### 400 Bad Request:
- Missing `email` or `property_name` in payload
- Field names don't match your Carrd form
- Invalid email format

### 409 Conflict:
- Email already exists in waitlist (duplicate submission)
- This is expected behavior - user is already registered

### Email not sending:
- Check Mailgun secrets are configured
- Verify Mailgun domain is verified
- Check Edge Function logs for Mailgun errors

### Check Logs:

View function logs in Supabase Dashboard:
1. Go to **Edge Functions**
2. Click on `add-to-waitlist`
3. Click **Logs** tab
4. Look for request/response details

## Production Deployment

Once testing is complete:

1. **Deploy function to production:**
   ```bash
   supabase functions deploy add-to-waitlist --project-ref qmhmgjzkpfzxfjdurigu
   ```

2. **Run SQL migration on production database**

3. **Update Carrd webhook URL to production:**
   ```
   https://qmhmgjzkpfzxfjdurigu.supabase.co/functions/v1/add-to-waitlist
   ```

4. **Test again with production URL**

## Example Complete Setup

**Carrd Form Fields:**
- Email (field name: `email`)
- Property Name (field name: `property_name`)

**Carrd Webhook Configuration:**
- **URL:** `https://goljbyvrnktxwtnjomaq.supabase.co/functions/v1/add-to-waitlist`
- **Method:** POST
- **Body:**
  ```json
  {
    "email": "{email}",
    "property_name": "{property_name}"
  }
  ```

That's it! Once configured, every form submission will automatically:
1. ✅ Add the PM to the waitlist database
2. ✅ Send a thank-you email via Mailgun
3. ✅ Return success/error response to Carrd

