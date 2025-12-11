# Postman Request for Notify Tenant Completion Function

## Request Configuration

### Method
`POST`

### URL
```
https://YOUR_PROJECT_ID.supabase.co/functions/v1/notify-tenant-completion
```

**Development**: `https://goljbyvrnktxwtnjomaq.supabase.co/functions/v1/notify-tenant-completion`

**Production**: `https://qmhmgjzkpfzxfjdurigu.supabase.co/functions/v1/notify-tenant-completion`

### Headers

| Key | Value | Required |
|-----|-------|----------|
| `Content-Type` | `application/json` | Yes |
| `Authorization` | `Bearer YOUR_ACCESS_TOKEN` | Yes |
| `apikey` | `YOUR_SUPABASE_ANON_KEY` | Yes |

**Note**: Replace `YOUR_ACCESS_TOKEN` with a valid user access token from `localStorage.getItem('access_token')` after logging in. Replace `YOUR_SUPABASE_ANON_KEY` with your Supabase anonymous key.

### Request Body (JSON)

```json
{
  "work_order_id": "uuid-string-here"
}
```

## Complete Postman Setup

### Step 1: Create New Request
1. Open Postman
2. Click "New" → "HTTP Request"
3. Set method to `POST`

### Step 2: Set URL
```
https://goljbyvrnktxwtnjomaq.supabase.co/functions/v1/notify-tenant-completion
```
(Use development URL for testing, production URL for production)

### Step 3: Add Headers
Go to "Headers" tab and add:

```
Content-Type: application/json
Authorization: Bearer YOUR_ACCESS_TOKEN
apikey: YOUR_SUPABASE_ANON_KEY
```

**How to get Access Token:**
1. Log in to your app
2. Open browser developer console
3. Run: `localStorage.getItem('access_token')`
4. Copy the token value

**Development Anon Key:**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdvbGpieXZybmt0eHd0bmpvbWFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE2MTM0NzcsImV4cCI6MjA3NzE4OTQ3N30.qUU-teO-8RSitnM6GemwjcaezVDD6eJcNYUmxL8O5Bw
```

### Step 4: Add Body
1. Go to "Body" tab
2. Select "raw"
3. Select "JSON" from dropdown
4. Paste this JSON (replace with actual work_order_id):

```json
{
  "work_order_id": "your-work-order-uuid-here"
}
```

### Step 5: Send Request
Click "Send" button

## Expected Responses

### Success Response (200 OK)
```json
{
  "success": true,
  "message": "Completion notification sent to tenant",
  "tenant_email": "tenant@example.com",
  "work_order_id": "uuid-string-here",
  "mailgun_id": "<20231201234567.abc123@mg.asine.app>"
}
```

### Error Response (400 Bad Request) - Missing work_order_id
```json
{
  "success": false,
  "error": "Missing work_order_id"
}
```

### Error Response (400 Bad Request) - Work order not completed
```json
{
  "success": false,
  "error": "Work order is not completed"
}
```

### Error Response (400 Bad Request) - No tenant
```json
{
  "success": false,
  "error": "Work order has no tenant"
}
```

### Error Response (404 Not Found) - Work order not found
```json
{
  "success": false,
  "error": "Work order not found"
}
```

### Error Response (404 Not Found) - Tenant not found
```json
{
  "success": false,
  "error": "Tenant not found"
}
```

### Error Response (500 Internal Server Error)
```json
{
  "success": false,
  "error": "Internal server error"
}
```

## Postman Collection JSON

You can import this into Postman:

```json
{
  "info": {
    "name": "Notify Tenant Completion",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Notify Tenant Completion",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          },
          {
            "key": "Authorization",
            "value": "Bearer {{access_token}}"
          },
          {
            "key": "apikey",
            "value": "{{supabase_anon_key}}"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"work_order_id\": \"{{work_order_id}}\"\n}",
          "options": {
            "raw": {
              "language": "json"
            }
          }
        },
        "url": {
          "raw": "{{supabase_url}}/functions/v1/notify-tenant-completion",
          "host": [
            "{{supabase_url}}"
          ],
          "path": [
            "functions",
            "v1",
            "notify-tenant-completion"
          ]
        }
      }
    }
  ]
}
```

## Testing Different Scenarios

### Test Case 1: Valid Completed Work Order
1. First, ensure you have a work order with status "Completed" and a tenant assigned
2. Use that work order's ID in the request
```json
{
  "work_order_id": "completed-work-order-uuid"
}
```
**Expected**: Success response with `tenant_email` and `mailgun_id`

### Test Case 2: Missing work_order_id
```json
{}
```
**Expected**: Error response: "Missing work_order_id"

### Test Case 3: Work Order Not Completed
Use a work order ID that has status "Pending" or "In Progress"
```json
{
  "work_order_id": "pending-work-order-uuid"
}
```
**Expected**: Error response: "Work order is not completed"

### Test Case 4: Work Order Without Tenant
Use a work order ID that has no tenant assigned
```json
{
  "work_order_id": "work-order-without-tenant-uuid"
}
```
**Expected**: Error response: "Work order has no tenant"

### Test Case 5: Invalid Work Order ID
```json
{
  "work_order_id": "invalid-uuid"
}
```
**Expected**: Error response: "Work order not found"

### Test Case 6: Invalid Authentication Token
Remove or change the `Authorization` header
**Expected**: 401 Unauthorized or error about authentication

## Environment Variables in Postman

You can set up environment variables in Postman:

1. Click "Environments" → "Create Environment"
2. Add variables:
   - `supabase_url`: `https://goljbyvrnktxwtnjomaq.supabase.co` (dev) or `https://qmhmgjzkpfzxfjdurigu.supabase.co` (prod)
   - `supabase_anon_key`: `YOUR_SUPABASE_ANON_KEY`
   - `access_token`: `YOUR_ACCESS_TOKEN` (get this from browser after login)
   - `work_order_id`: `your-test-work-order-uuid`
3. Update your request URL to:
   ```
   {{supabase_url}}/functions/v1/notify-tenant-completion
   ```
4. Update Authorization header to:
   ```
   Bearer {{access_token}}
   ```
5. Update apikey header to:
   ```
   {{supabase_anon_key}}
   ```

## How to Get a Valid Work Order ID for Testing

### Option 1: From Database
1. Go to Supabase Dashboard → Table Editor
2. Open `work_orders` table
3. Find a work order with:
   - `status = 'Completed'`
   - `tenant_id` is not null
4. Copy the `id` value (UUID)

### Option 2: From Your App
1. Log in to your admin panel
2. Go to Work Orders section
3. Find a completed work order
4. Inspect the element or check network requests to find the work order ID

### Option 3: Create Test Data via SQL
```sql
-- Create a test work order with Completed status
INSERT INTO work_orders (
  title,
  description,
  status,
  priority,
  tenant_id,
  property_id
) VALUES (
  'Test Completion Notification',
  'This is a test work order for notification',
  'Completed',
  'Medium',
  'your-tenant-uuid-here',  -- Replace with actual tenant UUID
  'your-property-uuid-here'  -- Replace with actual property UUID
) RETURNING id;
```

## Troubleshooting

### 401 Unauthorized
- **Cause**: Missing or invalid `access_token`
- **Solution**: 
  - Log in to your app
  - Get fresh token from `localStorage.getItem('access_token')`
  - Update the `Authorization` header

### 400 Bad Request - "Work order is not completed"
- **Cause**: Work order status is not "Completed"
- **Solution**: Update the work order status to "Completed" first:
  ```sql
  UPDATE work_orders 
  SET status = 'Completed' 
  WHERE id = 'your-work-order-uuid';
  ```

### 400 Bad Request - "Work order has no tenant"
- **Cause**: Work order doesn't have a `tenant_id`
- **Solution**: Assign a tenant to the work order:
  ```sql
  UPDATE work_orders 
  SET tenant_id = 'your-tenant-uuid' 
  WHERE id = 'your-work-order-uuid';
  ```

### 404 Not Found
- **Cause**: Work order ID doesn't exist
- **Solution**: Verify the work order ID is correct and exists in the database

### 500 Internal Server Error
- **Cause**: Server-side configuration issue
- **Solution**: 
  - Check Supabase Edge Function logs
  - Verify Mailgun secrets are configured in Supabase Dashboard
  - Check function deployment status

### Email Not Received
- **Cause**: Email delivery issue
- **Solution**: 
  - Check Mailgun logs in Mailgun Dashboard
  - Verify tenant email address is correct in database
  - Check spam folder
  - Verify Mailgun domain is verified

## Quick Test Checklist

- [ ] Request method is `POST`
- [ ] URL includes `/functions/v1/notify-tenant-completion`
- [ ] `Content-Type` header is `application/json`
- [ ] `Authorization` header has format: `Bearer YOUR_ACCESS_TOKEN`
- [ ] `apikey` header has valid Supabase anonymous key
- [ ] Request body contains `work_order_id` as JSON
- [ ] Work order exists in database
- [ ] Work order status is "Completed"
- [ ] Work order has a tenant assigned (`tenant_id` is not null)
- [ ] Access token is valid (not expired)

