# Create User Edge Function

This Supabase Edge Function creates a new user account in Supabase Auth and a corresponding profile in the custom `users` table.

## Features

- Creates user in Supabase Auth with PM role metadata
- Creates profile in custom `users` table with PM role
- Returns user ID for use in subscription flow
- Handles cleanup if profile creation fails
- Validates input fields and email format

## Setup

### 1. Database Schema

**IMPORTANT:** You must create the `users` table before using this function. Run this SQL in your Supabase SQL Editor:

```sql
-- Your existing users table schema:
create table public.users (
  id uuid not null default extensions.uuid_generate_v4 (),
  name text not null,
  email text not null,
  role text null,
  approved boolean null default false,
  created_at timestamp without time zone null default now(),
  stripe_customer_id text null,
  property_name text null,
  subscribed boolean null default false,
  subscription_status text null,
  plan text null,
  constraint users_pkey primary key (id),
  constraint users_email_key unique (email),
  constraint users_role_check check (
    (
      role = any (
        array[
          'super_admin'::text,
          'pm'::text,
          'tenant'::text,
          'technician'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

-- Optional: Create index on email for faster lookups (if not exists)
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Important: If Row Level Security (RLS) is enabled, make sure your service role
-- can insert records. The service role key should bypass RLS, but if you have
-- custom policies, you may need to adjust them.
```

**Note:** The function will insert the `id` from `auth.users` explicitly, which will override the default UUID generation. This ensures the `users` table record is linked to the auth user record.

### 2. Set Environment Variables

Set your Supabase service role key as a Supabase secret:

**Using Supabase Dashboard:**
1. Go to your Supabase project: https://supabase.com/dashboard
2. Navigate to **Project Settings** → **Edge Functions** → **Secrets**
3. Click **Add Secret**
4. Key: `SUPABASE_SERVICE_ROLE_KEY`
5. Value: Your service role key (found in Project Settings → API → service_role key)
6. Click **Save**

**Using CLI:**
```bash
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## Deployment

### Option 1: Using Supabase Dashboard (No CLI Required)

1. Go to your Supabase project: https://supabase.com/dashboard
2. Navigate to **Edge Functions** in the left sidebar
3. Click **Create a new function**
4. Function name: `create-user`
5. Copy and paste the entire contents of `supabase/functions/create-user/index.ts` into the editor
6. Click **Deploy**

### Option 2: Using CLI

```bash
supabase functions deploy create-user
```

## Usage

### Request

**Endpoint:** `https://YOUR_PROJECT.supabase.co/functions/v1/create-user`

**Method:** `POST`

**Headers:**
- `Content-Type: application/json`
- `Authorization: Bearer YOUR_SUPABASE_ANON_KEY`

**Body:**
```json
{
  "email": "pm@example.com",
  "password": "securepassword",
  "name": "John Doe",
  "property_name": "Sunset Apartments"
}
```

### Response

**Success (200):**
```json
{
  "success": true,
  "user_id": "uuid-of-created-user",
  "message": "User account and profile created successfully"
}
```

**Error (400/500):**
```json
{
  "error": "Database error saving new user: detailed error message"
}
```

## Common Errors

1. **"relation 'users' does not exist"**
   - Solution: Run the SQL schema script above to create the `users` table

2. **"column 'X' does not exist"**
   - Solution: Ensure all required columns exist. Run `ALTER TABLE users ADD COLUMN IF NOT EXISTS X TYPE;`

3. **"duplicate key value violates unique constraint"**
   - Solution: The email already exists in the database. Use a different email or check existing users.

4. **"Missing Supabase service role key"**
   - Solution: Set the `SUPABASE_SERVICE_ROLE_KEY` secret in Supabase Dashboard

## Workflow

1. Creates user in Supabase Auth with PM role metadata
2. Creates profile in custom `users` table with PM role
3. Returns user ID for use in subscription flow
4. Handles cleanup if profile creation fails (deletes auth user)

## Testing

Test the function from your browser console or Postman:

```javascript
fetch('https://YOUR_PROJECT.supabase.co/functions/v1/create-user', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_SUPABASE_ANON_KEY'
  },
  body: JSON.stringify({
    email: 'pm@example.com',
    password: 'securepassword',
    name: 'John Doe',
    property_name: 'Sunset Apartments'
  })
})
.then(res => res.json())
.then(data => console.log(data))
```

Replace:
- `YOUR_PROJECT` with your actual project name
- `YOUR_SUPABASE_ANON_KEY` with your anon key from Project Settings → API

