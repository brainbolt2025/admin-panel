# Notify PM Signup Edge Function

This Supabase Edge Function sends an email notification to Property Managers (PMs) when a new tenant or technician signs up for their property.

## Features

- Automatically finds the PM associated with a property (via `properties.pm_id`)
- Sends email notification to PM with signup details
- Supports both tenant and technician signups
- Non-blocking - failures don't prevent user creation
- Includes property name, user details, and unit number (for tenants)

## Setup

### 1. Environment Variables

This function uses the same environment variables as other email functions:

- `SUPABASE_URL` - Your Supabase project URL (automatically set)
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (automatically set)
- `MAILGUN_DOMAIN` - Your Mailgun domain (e.g., `mg.asine.app`)
- `MAILGUN_API_KEY` - Your Mailgun private API key
- `MAILGUN_REGION` - Mailgun region (`us` or `eu`, defaults to `us`)

Set these in Supabase Dashboard → Project Settings → Edge Functions → Secrets

### 2. Deploy the Function

```bash
supabase functions deploy notify-pm-signup
```

## Usage

This function is automatically called by:
- `create-tenant` - When a tenant signs up
- `create-technician` - When a technician signs up

You can also call it directly via API:

```bash
curl -X POST \
  https://YOUR_PROJECT.supabase.co/functions/v1/notify-pm-signup \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "property_id": "uuid-of-property",
    "user_name": "John Doe",
    "user_email": "john@example.com",
    "user_role": "tenant",
    "unit_number": "A101"
  }'
```

### Request Body

```typescript
{
  property_id: string      // Required: UUID of the property
  user_name: string        // Required: Name of the new user
  user_email: string       // Required: Email of the new user
  user_role: 'tenant' | 'technician'  // Required: Role of the new user
  unit_number?: string     // Optional: Unit number (for tenants)
}
```

### Response

Success response:
```json
{
  "success": true,
  "message": "PM notification sent for new tenant signup",
  "pm_email": "pm@example.com",
  "property_id": "uuid",
  "property_name": "Property Name",
  "user_name": "John Doe",
  "user_email": "john@example.com",
  "user_role": "tenant",
  "mailgun_id": "mailgun-message-id"
}
```

Error response:
```json
{
  "success": false,
  "error": "Error message",
  "details": "Additional error details"
}
```

## Email Content

The email sent to PMs includes:
- User's name and email
- User's role (tenant or technician)
- Property name
- Unit number (for tenants)
- Instructions to review and approve the account

## Integration

This function is integrated into:
- `create-tenant/index.ts` - Calls after tenant creation
- `create-technician/index.ts` - Calls after technician creation

The notification is non-blocking - if it fails, it won't prevent the user from being created. Errors are logged but don't affect the signup process.

## Database Requirements

The function requires:
- `properties` table with `id`, `name`, and `pm_id` columns
- `users` table with `id`, `name`, `email`, and `role` columns
- Properties must have a `pm_id` set to notify PMs
- If no PM is assigned to a property, the function returns success but skips sending email

## Error Handling

- Property not found → Returns 404 error
- PM not found → Returns 404 error
- No PM assigned → Returns success (skips notification)
- Mailgun errors → Returns error response
- Missing configuration → Returns error response

