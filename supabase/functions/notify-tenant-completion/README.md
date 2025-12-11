# Notify Tenant Completion Edge Function

## Overview

This edge function sends a completion notification email to a tenant when their work order is marked as completed. The email includes details about the completed work order and a deep link or web URL to view the work order.

## Purpose

When a work order is completed:
1. The admin panel or technician marks the work order as "Completed"
2. This function is called to notify the tenant
3. The tenant receives an email with:
   - Work order details (title, description, priority, property, unit number)
   - Technician name who completed it
   - Deep link or web URL to view the completed work order

## Function Behavior

### Prerequisites
- Work order must have `status = 'Completed'`
- Work order must have a `tenant_id` assigned
- Work order must exist in the database

### What It Does
1. Validates the request (checks for `work_order_id`)
2. Fetches work order details from database
3. Verifies work order is completed and has a tenant
4. Fetches tenant, technician, and property details
5. Generates a deep link or web URL for viewing the work order
6. Sends a custom email via Mailgun to the tenant
7. Returns success response with email delivery details

## API Endpoint

```
POST /functions/v1/notify-tenant-completion
```

## Request

### Headers
- `Content-Type: application/json`
- `Authorization: Bearer YOUR_ACCESS_TOKEN` (user's auth token)
- `apikey: YOUR_SUPABASE_ANON_KEY`

### Request Body
```json
{
  "work_order_id": "uuid-string"
}
```

## Response

### Success (200 OK)
```json
{
  "success": true,
  "message": "Completion notification sent to tenant",
  "tenant_email": "tenant@example.com",
  "work_order_id": "uuid-string",
  "mailgun_id": "<mailgun-id>"
}
```

### Errors
- `400`: Missing `work_order_id`, work order not completed, or no tenant
- `404`: Work order or tenant not found
- `500`: Server error (Mailgun config, etc.)

## Usage

### When to Call
Call this function **immediately after** updating a work order's status to "Completed":

```typescript
// 1. Update work order status
await updateWorkOrderStatus(workOrderId, 'Completed')

// 2. Notify tenant
await notifyTenantCompletion(workOrderId)
```

### Integration
See `CLIENT-APP-INTEGRATION.md` for detailed integration examples in:
- React/TypeScript
- Kotlin/Android
- Swift/iOS

## Configuration

### Environment Variables (Supabase Dashboard)

Required:
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key
- `MAILGUN_DOMAIN`: Mailgun domain
- `MAILGUN_API_KEY`: Mailgun private API key
- `MAILGUN_REGION`: `us` or `eu` (default: `us`)

Optional:
- `TENANT_APP_DEEP_LINK_SCHEME`: Deep link scheme (e.g., `asine://`)
- `TENANT_APP_URL`: Tenant app URL fallback
- `STRIPE_SECRET_KEY`: Used to detect test/production mode

## Email Content

The email includes:
- Subject: "Work Order Completed: {title}"
- Work order details (title, description, priority, property, unit number)
- Technician name who completed it
- Status: "Completed"
- Button/link to view the work order (deep link or web URL)

## Deep Link Format

If `TENANT_APP_DEEP_LINK_SCHEME` is configured:
- Deep link: `asine://work-order/{work_order_id}`

Otherwise, uses web URL:
- Web URL: `{TENANT_APP_URL}/work-order/{work_order_id}`

## Testing

See `POSTMAN-REQUEST.md` for detailed Postman testing instructions.

### Quick Test Steps
1. Ensure you have a completed work order with a tenant assigned
2. Get the work order ID
3. Get a valid access token (from `localStorage.getItem('access_token')`)
4. Call the endpoint with the work order ID
5. Check that the tenant receives the email

## Related Documentation

- `CLIENT-APP-INTEGRATION.md`: Detailed client integration guide
- `POSTMAN-REQUEST.md`: Postman testing guide
