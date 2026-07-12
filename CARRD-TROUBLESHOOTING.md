# Carrd Webhook Troubleshooting Guide

## Common Error: "Invalid request body"

This error occurs when the Edge Function cannot parse the request body from Carrd.

### Possible Causes:

1. **Carrd webhook not configured correctly**
   - Missing Content-Type header
   - Body format mismatch
   - Empty body

2. **Field name mismatch**
   - Carrd field names don't match the payload template
   - Missing required fields

3. **JSON formatting issues**
   - Invalid JSON syntax
   - Special characters not escaped

## How to Debug

### Step 1: Check Supabase Logs

1. Go to Supabase Dashboard
2. Navigate to **Edge Functions** → `add-to-waitlist`
3. Click on **Logs** tab
4. Look for the most recent request

The logs will show:
- Request method and URL
- All headers received
- Raw request body
- Parsed body (if successful)

### Step 2: Verify Carrd Webhook Configuration

In your Carrd form settings, verify:

**Webhook URL:**
```
https://goljbyvrnktxwtnjomaq.supabase.co/functions/v1/add-to-waitlist
```

**HTTP Method:** `POST`

**Content Type:** `application/json`

**Request Body:**
```json
{
  "email": "{email}",
  "property_name": "{property_name}"
}
```

**Important:** Replace `{email}` and `{property_name}` with your actual Carrd field names.

### Step 3: Check Your Carrd Field Names

1. Edit your Carrd form
2. Check the exact field names you're using
3. Make sure they match what you put in the webhook payload

**Example:**
If your Carrd form has:
- Email field with ID: `email`
- Property Name field with ID: `property`

Then your webhook payload should be:
```json
{
  "email": "{email}",
  "property_name": "{property}"
}
```

**NOT:**
```json
{
  "email": "{email}",
  "property_name": "{property_name}"  // ❌ Wrong - field doesn't exist
}
```

### Step 4: Test with cURL

Test the function directly to verify it works:

```bash
curl -X POST https://goljbyvrnktxwtnjomaq.supabase.co/functions/v1/add-to-waitlist \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "property_name": "Test Property"
  }'
```

If this works but Carrd doesn't, the issue is with Carrd configuration.

### Step 5: Check Carrd Webhook Logs

Some Carrd plans allow you to see webhook delivery logs:
1. Check if your Carrd plan includes webhook logs
2. View the actual payload Carrd is sending
3. Compare it to what the function expects

## Common Carrd Configuration Mistakes

### ❌ Wrong: Using literal field names
```json
{
  "email": "email",
  "property_name": "property_name"
}
```

### ✅ Correct: Using placeholders
```json
{
  "email": "{email}",
  "property_name": "{property_name}"
}
```

### ❌ Wrong: Wrong content type
- Content-Type: `text/plain` or missing

### ✅ Correct: JSON content type
- Content-Type: `application/json`

### ❌ Wrong: Wrong HTTP method
- Method: `GET`

### ✅ Correct: POST method
- Method: `POST`

## Expected Request Format

The function expects:

```json
{
  "email": "user@example.com",
  "property_name": "ABC Properties"
}
```

Both fields are **required** and must be strings.

## Testing Checklist

- [ ] Function is deployed
- [ ] Webhook URL is correct (staging or production)
- [ ] HTTP method is POST
- [ ] Content-Type is application/json
- [ ] Body uses correct field placeholders (e.g., `{email}`)
- [ ] Field names in payload match actual Carrd field names
- [ ] Test submission from Carrd form
- [ ] Check Supabase logs for detailed error messages
- [ ] Verify database table exists (`pm_waitlist`)
- [ ] Check Mailgun secrets are configured

## Still Having Issues?

1. **Check Supabase Function Logs** - They now include detailed request information
2. **Try the cURL test** - Verify the function works independently
3. **Double-check field names** - Make sure they match exactly
4. **Test with a simple payload first** - Use just email and property_name
5. **Check Carrd documentation** - Verify webhook setup requirements

## Contact Support

If issues persist, check the Supabase Edge Function logs for the specific error message and share:
- The error message from logs
- Your Carrd webhook configuration (field names)
- The raw request body from logs (if available)

