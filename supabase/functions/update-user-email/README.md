# Update User Email Edge Function

This Supabase Edge Function allows you to update a user's email address in Supabase Auth (and optionally in your custom users table).

## Features

- ✅ Updates email in Supabase Auth
- ✅ Optionally updates email in custom `users` table
- ✅ Can mark email as confirmed (skip verification)
- ✅ Validates email format
- ✅ Requires service role key (admin access)

## Usage

### Request

```bash
POST https://YOUR_PROJECT.supabase.co/functions/v1/update-user-email
Content-Type: application/json
Authorization: Bearer YOUR_SERVICE_ROLE_KEY

{
  "user_id": "uuid-of-user",
  "new_email": "newemail@example.com",
  "confirm_email": false  // Optional: if true, marks email as confirmed without verification
}
```

### Response

**Success:**
```json
{
  "success": true,
  "message": "Email updated successfully",
  "user_id": "uuid-of-user",
  "new_email": "newemail@example.com",
  "email_confirmed": false
}
```

**Error:**
```json
{
  "success": false,
  "error": "Error message here"
}
```

## Deployment

```bash
supabase functions deploy update-user-email
```

## Important Notes

1. **Email Verification**: If `confirm_email` is `false` (default), Supabase will send a verification email to the new address. The user must verify before they can use the new email to sign in.

2. **Service Role Key**: This function requires the service role key to bypass RLS and update auth users. Never expose this key in client-side code.

3. **Users Table Sync**: The function also updates the `users` table if it exists. If the update fails, it logs a warning but doesn't fail the request (auth update is primary).

## Alternative: Client-Side Update

For users updating their own email, use the client SDK:

```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

const { data, error } = await supabase.auth.updateUser({
  email: 'newemail@example.com'
})
```

This will:
- Update the email
- Send a confirmation email to the new address
- Require the user to verify the new email before it becomes active

