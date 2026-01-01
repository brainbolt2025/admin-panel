# Add to Waitlist Edge Function

This Supabase Edge Function handles PM signups from Carrd forms and adds them to the waitlist.

## Features

- ✅ Accepts public webhook requests from Carrd (no authentication required)
- ✅ Validates email format
- ✅ Prevents duplicate email entries
- ✅ Stores signup information in `pm_waitlist` table
- ✅ Sends confirmation email via Mailgun
- ✅ Returns success/error responses

## Setup

### 1. Database Schema

Run the SQL migration to create the `pm_waitlist` table:

```sql
-- See create-pm-waitlist-table.sql
```

Execute this in your Supabase SQL Editor.

### 2. Set Environment Variables

Ensure these secrets are set in Supabase Dashboard → Project Settings → Edge Functions → Secrets:

- `MAILGUN_DOMAIN` - Your Mailgun domain (e.g., `mg.asine.app`)
- `MAILGUN_API_KEY` - Your Mailgun private API key (starts with `key-`)
- `MAILGUN_REGION` - Mailgun region (`us` or `eu`, default: `us`)

### 3. Deploy the Function

```bash
supabase functions deploy add-to-waitlist --project-ref YOUR_PROJECT_REF
```

Or for staging:
```bash
supabase functions deploy add-to-waitlist --project-ref goljbyvrnktxwtnjomaq
```

## Usage

### Request Format

**Endpoint:** `POST /functions/v1/add-to-waitlist`

**Headers:**
```
Content-Type: application/json
```

**Body:**
```json
{
  "email": "pm@example.com",
  "property_name": "ABC Properties"
}
```

**Required Fields:**
- `email` (string, valid email format)
- `property_name` (string, property/company name)

### Response Format

**Success (200 OK):**
```json
{
  "success": true,
  "message": "Successfully added to waitlist",
  "id": "uuid-of-waitlist-entry"
}
```

**Error Responses:**

- **400 Bad Request** - Invalid email, missing property_name, or request body
  ```json
  {
    "success": false,
    "error": "Valid email is required"
  }
  ```
  or
  ```json
  {
    "success": false,
    "error": "Property name is required"
  }
  ```

- **409 Conflict** - Email already exists
  ```json
  {
    "success": false,
    "error": "Email already registered on waitlist",
    "id": "existing-entry-id"
  }
  ```

- **500 Internal Server Error** - Server error
  ```json
  {
    "success": false,
    "error": "Internal server error"
  }
  ```

## Carrd Integration

### Configure Carrd Webhook

1. Go to your Carrd form → Settings → Integrations
2. Add a **Webhook** integration
3. Set the webhook URL:
   - **Staging:** `https://goljbyvrnktxwtnjomaq.supabase.co/functions/v1/add-to-waitlist`
   - **Production:** `https://qmhmgjzkpfzxfjdurigu.supabase.co/functions/v1/add-to-waitlist`
4. Configure the webhook payload to match the function's expected format

### Carrd Webhook Payload Configuration

Map your Carrd form fields to the function's expected fields:

```json
{
  "email": "{email}",
  "property_name": "{property_name}"
}
```

Replace `{email}` and `{property_name}` with the actual field names from your Carrd form.

**Note:** Both `email` and `property_name` are required.

## Testing

### Test with cURL

```bash
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/add-to-waitlist \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "property_name": "Test Property"
  }'
```

### Test Duplicate Email

```bash
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/add-to-waitlist \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "property_name": "Another Property"
  }'
```

Should return 409 Conflict with "Email already registered on waitlist".

## Database Table Structure

```sql
pm_waitlist
├── id (UUID, primary key)
├── email (TEXT, unique, required)
├── property_name (TEXT, required)
├── created_at (TIMESTAMPTZ, auto)
├── notified_at (TIMESTAMPTZ, set when email sent)
└── status (TEXT, default: 'pending')
    Values: 'pending', 'contacted', 'approved', 'declined'
```

## Email Notification

When a new signup is added:
1. A confirmation email is sent via Mailgun (if configured)
2. The `notified_at` timestamp is updated when email is sent successfully
3. Email sending failures are logged but don't fail the request

## Notes

- No authentication required (public webhook endpoint)
- Email addresses are normalized to lowercase
- Duplicate emails return 409 Conflict
- Email sending is optional (function succeeds even if Mailgun fails)
- No RLS policies needed (table not accessed from dashboard)

## Deployment Checklist

- [ ] Run SQL migration (`create-pm-waitlist-table.sql`)
- [ ] Set Mailgun secrets (MAILGUN_DOMAIN, MAILGUN_API_KEY, MAILGUN_REGION)
- [ ] Deploy function to staging
- [ ] Test function with cURL
- [ ] Configure Carrd webhook with staging URL
- [ ] Test end-to-end with Carrd form
- [ ] Deploy function to production
- [ ] Update Carrd webhook to production URL

