# Postman Request for Forgot Password Function

## Request Configuration

### Method
`POST`

### URL
```
https://YOUR_PROJECT_ID.supabase.co/functions/v1/forgot-password
```

Replace `YOUR_PROJECT_ID` with your actual Supabase project ID.

### Headers

| Key | Value |
|-----|-------|
| `Content-Type` | `application/json` |
| `Authorization` | `Bearer YOUR_SUPABASE_ANON_KEY` |
| `apikey` | `YOUR_SUPABASE_ANON_KEY` |

Replace `YOUR_SUPABASE_ANON_KEY` with your actual Supabase anonymous key.

### Request Body (JSON)

```json
{
  "email": "user@example.com"
}
```

## Complete Postman Setup

### Step 1: Create New Request
1. Open Postman
2. Click "New" → "HTTP Request"
3. Set method to `POST`

### Step 2: Set URL
```
https://YOUR_PROJECT_ID.supabase.co/functions/v1/forgot-password
```

### Step 3: Add Headers
Go to "Headers" tab and add:

```
Content-Type: application/json
Authorization: Bearer YOUR_SUPABASE_ANON_KEY
apikey: YOUR_SUPABASE_ANON_KEY
```

### Step 4: Add Body
1. Go to "Body" tab
2. Select "raw"
3. Select "JSON" from dropdown
4. Paste this JSON:

```json
{
  "email": "test@example.com"
}
```

### Step 5: Send Request
Click "Send" button

## Expected Response

### Success Response (200 OK)
```json
{
  "success": true,
  "message": "If an account exists with this email, a password reset link has been sent.",
  "mailgun_id": "<20231201234567.abc123@mg.asine.app>"
}
```

### Error Response (400 Bad Request)
```json
{
  "success": false,
  "error": "Missing email address"
}
```

or

```json
{
  "success": false,
  "error": "Invalid email format"
}
```

## Postman Collection JSON

You can import this into Postman:

```json
{
  "info": {
    "name": "Forgot Password",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Forgot Password",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          },
          {
            "key": "Authorization",
            "value": "Bearer YOUR_SUPABASE_ANON_KEY"
          },
          {
            "key": "apikey",
            "value": "YOUR_SUPABASE_ANON_KEY"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"email\": \"user@example.com\"\n}",
          "options": {
            "raw": {
              "language": "json"
            }
          }
        },
        "url": {
          "raw": "https://YOUR_PROJECT_ID.supabase.co/functions/v1/forgot-password",
          "protocol": "https",
          "host": [
            "YOUR_PROJECT_ID",
            "supabase",
            "co"
          ],
          "path": [
            "functions",
            "v1",
            "forgot-password"
          ]
        }
      }
    }
  ]
}
```

## Testing Different Scenarios

### Test Case 1: Valid Email
```json
{
  "email": "existing-user@example.com"
}
```
**Expected:** Success response with mailgun_id

### Test Case 2: Invalid Email Format
```json
{
  "email": "not-an-email"
}
```
**Expected:** Error response: "Invalid email format"

### Test Case 3: Missing Email
```json
{}
```
**Expected:** Error response: "Missing email address"

### Test Case 4: Non-existent Email
```json
{
  "email": "nonexistent@example.com"
}
```
**Expected:** Success response (to prevent email enumeration), but no email sent

## Environment Variables in Postman

You can set up environment variables in Postman:

1. Click "Environments" → "Create Environment"
2. Add variables:
   - `supabase_url`: `https://YOUR_PROJECT_ID.supabase.co`
   - `supabase_anon_key`: `YOUR_SUPABASE_ANON_KEY`
3. Update your request URL to:
   ```
   {{supabase_url}}/functions/v1/forgot-password
   ```
4. Update Authorization header to:
   ```
   Bearer {{supabase_anon_key}}
   ```

## Troubleshooting

### 401 Unauthorized
- Check that your `SUPABASE_ANON_KEY` is correct
- Verify the Authorization header format: `Bearer YOUR_KEY`

### 404 Not Found
- Verify the function is deployed
- Check the URL is correct (including `/functions/v1/`)
- Ensure function name is `forgot-password` (not `forgot_password`)

### 500 Internal Server Error
- Check Supabase Edge Function logs
- Verify Mailgun secrets are configured
- Check function deployment status

### No Email Received
- Check Mailgun logs in Mailgun Dashboard
- Verify email address exists in your database
- Check spam folder
- Verify Mailgun domain is verified



