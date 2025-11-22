# Notify Tenant Assignment

This edge function sends an email notification to a tenant when a technician is assigned to their work order.

## Purpose

When a Property Manager assigns a technician to a work order, this function:
1. Fetches the work order details
2. Retrieves the tenant's email address
3. Sends a formatted email notification with work order and technician information

## Request

**Method:** `POST`

**Headers:**
- `Authorization: Bearer <SUPABASE_ANON_KEY or JWT>`
- `Content-Type: application/json`

**Body:**
```json
{
  "work_order_id": "uuid-of-work-order"
}
```

## Response

**Success (200):**
```json
{
  "success": true,
  "message": "Assignment notification sent to tenant",
  "tenant_email": "tenant@example.com",
  "work_order_id": "uuid-of-work-order",
  "mailgun_id": "<mailgun-message-id>"
}
```

**Error (400/404/500):**
```json
{
  "success": false,
  "error": "Error message"
}
```

## Environment Variables

Required in Supabase secrets:
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for admin access
- `MAILGUN_DOMAIN` - Your verified Mailgun domain (e.g., `mg.asine.app`)
- `MAILGUN_API_KEY` - Your Mailgun private API key (starts with `key-`)
- `MAILGUN_REGION` - Optional, `us` or `eu` (default: `us`)

Optional deep link configuration:
- `TENANT_APP_DEEP_LINK_SCHEME` - Custom URL scheme for tenant mobile app (e.g., `asine://` or `oms://`)
  - If set, creates deep links like: `asine://work-order/{work_order_id}`
  - Falls back to `APP_DEEP_LINK_SCHEME` if not set
  - If neither is set, uses universal link
- `TENANT_APP_URL` - Optional, base URL for tenant app universal links
- `APP_DEEP_LINK_SCHEME` - Optional, fallback custom URL scheme
- `APP_URL` - Optional, fallback base URL for universal links
- `BASE_URL` - Optional, final fallback base URL

**Automatic Environment Detection:**
- **Dev/Staging**: If `STRIPE_SECRET_KEY` starts with `sk_test_`, automatically uses `http://localhost:8081` for deep links (unless custom scheme is set)
- **Production**: Uses production URLs from `TENANT_APP_URL`, `APP_URL`, or `BASE_URL` (default: `https://app.asine.app`)
- `DEV_APP_PORT` - Optional, custom port for localhost deep links in dev (default: `8081`)

## Email Content

The email includes:
- Work order title and description
- Priority level
- Property name and unit number
- Assigned technician name
- Current status
- Link to view the work order

## Usage Example

```typescript
const response = await fetch(
  'https://YOUR_PROJECT.supabase.co/functions/v1/notify-tenant-assignment',
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      work_order_id: '123e4567-e89b-12d3-a456-426614174000',
    }),
  }
)

const result = await response.json()
if (result.success) {
  console.log('Notification sent to:', result.tenant_email)
}
```

## Deployment

```bash
supabase functions deploy notify-tenant-assignment
```

## Notes

- The function uses the service role key to bypass RLS and fetch all necessary data
- Only sends email if work order has a tenant
- Email is sent via Mailgun API
- **Deep Links**: The "View Work Order" button uses deep links to open the tenant mobile app directly
  - If `TENANT_APP_DEEP_LINK_SCHEME` or `APP_DEEP_LINK_SCHEME` is set (e.g., `asine://`), uses custom URL scheme: `asine://work-order/{id}`
  - Otherwise, uses universal link: `{TENANT_APP_URL}/work-order/{id}`
  - Make sure your tenant mobile app is configured to handle these deep link patterns

