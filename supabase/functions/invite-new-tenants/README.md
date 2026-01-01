# Invite New Tenants Function

This Supabase Edge Function allows Property Managers (PMs) to send invitation emails to tenants who are not yet registered in the system. The emails include app download links and signup instructions.

## Features

- ✅ JWT token verification
- ✅ PM role verification
- ✅ Validates that emails don't already exist in the system
- ✅ Sends personalized invitation emails via Mailgun
- ✅ Includes Google Play Store download link
- ✅ Provides signup instructions
- ✅ Supports bulk invitations (multiple tenants at once)
- ✅ Returns detailed results for each invitation

## Deployment

```bash
supabase functions deploy invite-new-tenants
```

## Environment Variables

Set these in Supabase secrets:

```bash
supabase secrets set GOOGLE_PLAY_URL=https://play.google.com/store/apps/details?id=com.asine.app
supabase secrets set MAILGUN_DOMAIN=mg.asine.app
supabase secrets set MAILGUN_API_KEY=key-xxxxxxxxxxxxxxxxxxxxx
supabase secrets set MAILGUN_REGION=us
```

## Usage from Frontend

```typescript
const accessToken = localStorage.getItem('access_token');

const response = await fetch(
  'https://YOUR_PROJECT.supabase.co/functions/v1/invite-new-tenants',
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
      'apikey': config.supabase.anonKey
    },
    body: JSON.stringify({
      tenants: [
        {
          email: 'tenant1@example.com',
          name: 'John Doe', // Optional
          unit_number: 'A101' // Optional
        },
        {
          email: 'tenant2@example.com',
          name: 'Jane Smith',
          unit_number: 'B202'
        }
      ]
    })
  }
);

const data = await response.json();
```

## Request Body

```typescript
interface InviteNewTenantsRequest {
  tenants: Array<{
    email: string;        // Required: Tenant email address
    name?: string;        // Optional: Tenant name
    unit_number?: string; // Optional: Unit number
  }>
}
```

## Response

### Success Response (200 OK)

```json
{
  "success": true,
  "message": "Invitations sent to 2 new tenant(s), 1 already in system",
  "data": {
    "total_requested": 3,
    "new_tenants": 2,
    "existing_tenants": 1,
    "successful": 2,
    "failed": 0,
    "results": [
      { "email": "tenant1@example.com", "success": true },
      { "email": "tenant2@example.com", "success": true }
    ]
  }
}
```

### Error Responses

- **401**: Missing or invalid token
- **403**: User is not a property manager
- **400**: Missing required fields, invalid email format, or all emails already exist
- **500**: Internal server error or Mailgun configuration missing

## Email Template

The invitation email includes:
- Personalized greeting with tenant name (if provided)
- Property manager name and property name
- Unit number (if provided)
- Step-by-step signup instructions
- Google Play Store download button
- Contact information

## Notes

- Only sends emails to addresses that don't already exist in the system
- Skips existing emails and reports them in the response
- Requires the PM to have a `property_id` assigned
- Uses the PM's property name and name in the email template


