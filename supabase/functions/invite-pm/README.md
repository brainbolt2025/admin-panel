# Invite PM Function

This Supabase Edge Function handles inviting new property managers to the system.

## Features

- ✅ JWT token verification
- ✅ Super admin role verification
- ✅ Email validation
- ✅ Creates user via Admin API
- ✅ Proper error handling with detailed logs

## Deployment

```bash
# Deploy with JWT verification enabled (default)
supabase functions deploy invite-pm

# If you need to test without JWT verification (NOT recommended for production)
supabase functions deploy invite-pm --no-verify-jwt
```

## Usage from Frontend

```typescript
const token = (await supabase.auth.getSession()).data.session.access_token;

const response = await fetch(
  'https://qmhmgjzkpfzxfjdurigu.supabase.co/functions/v1/invite-pm',
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      email: 'newpm@example.com',
      name: 'John Doe',
      role: 'pm'
    })
  }
);

const data = await response.json();
```

## Error Responses

- **401**: Missing or invalid token
- **403**: User is not a super_admin
- **400**: Missing required fields or invalid email format
- **500**: Internal server error

## Success Response

```json
{
  "success": true,
  "data": {
    "id": "user-uuid",
    "email": "newpm@example.com",
    "name": "John Doe",
    "role": "pm",
    "invited_at": "2024-01-01T00:00:00Z"
  }
}
```
