# Postman Request: Create Conversation Participants

This guide shows how to test the `create-conversation-participants` Edge Function using Postman.

## Import Postman Collection

1. Open Postman
2. Click **Import**
3. Select the file: `postman/oms-admin-panel.postman_collection.json`
4. The collection will be imported with all requests including "Create Conversation Participants"

## Setup Variables

Before making requests, set these collection variables:

1. Click on the collection **"OMS Admin Panel"**
2. Go to **Variables** tab
3. Set these variables:

| Variable | Value | Description |
|----------|-------|-------------|
| `supabase_url` | `https://your-project.supabase.co` | Your Supabase project URL |
| `anon_key` | `your-anon-key` | Your Supabase anon/public key |
| `access_token` | `your-jwt-token` | User's access token (see below) |
| `service_role_key` | `your-service-role-key` | Service role key (optional, not needed for this endpoint) |

### How to Get Access Token

**From your app after login:**
```javascript
// After user logs in with Supabase
const { data: { session } } = await supabase.auth.getSession()
const accessToken = session?.access_token
```

**Or from browser console (if logged in):**
```javascript
// In browser console on your app
const session = JSON.parse(localStorage.getItem('sb-<project-ref>-auth-token'))
const accessToken = session?.access_token
```

**Or login via Supabase Auth API:**
```bash
curl -X POST 'https://your-project.supabase.co/auth/v1/token?grant_type=password' \
  -H "apikey: YOUR-ANON-KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "tenant@example.com",
    "password": "password123"
  }'
```

The response will contain `access_token` - use that as the `access_token` variable.

## Request Details

### Endpoint
```
POST {{supabase_url}}/functions/v1/create-conversation-participants
```

### Headers
```
Content-Type: application/json
apikey: {{anon_key}}
Authorization: Bearer {{access_token}}
```

### Request Body

**Required field:**
- `work_order_id` (UUID) - The ID of the work order to create a conversation for

**Example request body:**
```json
{
  "work_order_id": "e55311f9-184f-4431-acb8-5423d8d89047"
}
```

## Success Response (200)

```json
{
  "code": 200,
  "message": "Conversation created successfully",
  "conversation_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "work_order_id": "e55311f9-184f-4431-acb8-5423d8d89047"
}
```

## Error Responses

### 400 - Bad Request
```json
{
  "code": 400,
  "message": "Missing required field: work_order_id"
}
```

Or:
```json
{
  "code": 400,
  "message": "Invalid work_order_id format. Must be a valid UUID."
}
```

### 401 - Unauthorized
```json
{
  "code": 401,
  "message": "Invalid or expired authentication token. Please log in again."
}
```

### 403 - Forbidden
```json
{
  "code": 403,
  "message": "Permission denied. You can only create conversations for work orders you are related to (as tenant, technician, or property manager)."
}
```

### 404 - Not Found
```json
{
  "code": 404,
  "message": "Work order not found or you do not have access to it."
}
```

### 500 - Internal Server Error
```json
{
  "code": 500,
  "message": "Failed to create conversation. Please try again.",
  "error": "Detailed error message"
}
```

## Testing Steps

1. **Set up variables** in Postman collection (see above)

2. **Get an access token** from a logged-in user:
   - Log in to your app as a tenant, technician, or PM
   - Extract the access token from the session
   - Set it as the `access_token` variable

3. **Get a work order ID**:
   - Query your `work_orders` table
   - Use an ID where the user (tenant/technician/PM) is related to that work order

4. **Make the request**:
   - Open "Create Conversation Participants" request in Postman
   - Update the `work_order_id` in the request body
   - Click **Send**

5. **Verify the response**:
   - Should return `200` with `conversation_id`
   - Check the `conversations` table to see the new conversation
   - Check `conversation_participants` table to see participants were added

## Quick Test Example

Here's a complete cURL command you can use:

```bash
curl -X POST 'https://your-project.supabase.co/functions/v1/create-conversation-participants' \
  -H 'Content-Type: application/json' \
  -H 'apikey: YOUR-ANON-KEY' \
  -H 'Authorization: Bearer YOUR-ACCESS-TOKEN' \
  -d '{
    "work_order_id": "e55311f9-184f-4431-acb8-5423d8d89047"
  }'
```

## Permissions Required

The authenticated user must be one of the following:
- **Tenant**: Must be the tenant for the work order (`work_orders.tenant_id = user.id`)
- **Technician**: Must be the assigned technician (`work_orders.technician_id = user.id`)
- **Property Manager (PM)**: Must be the PM for the property (`users.property_id = work_orders.property_id`)

If the user doesn't meet these requirements, you'll get a `403 Forbidden` error.

## Notes

- If a conversation already exists for the work order, the function returns the existing `conversation_id` (doesn't create a duplicate)
- The function automatically creates conversation participants for tenant, technician, and PM
- All validation happens server-side for security


