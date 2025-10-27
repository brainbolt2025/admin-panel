# Quick Deployment Guide (No CLI Required)

Follow these steps to deploy the function using only the Supabase Dashboard.

## Step 1: Add Stripe Secret Key

1. Go to https://supabase.com/dashboard
2. Select your project
3. Go to **Project Settings** (gear icon in left sidebar)
4. Click **Edge Functions** → **Secrets**
5. Click **Add Secret**
6. **Key:** `STRIPE_SECRET_KEY`
7. **Value:** `sk_test_xxx` (your Stripe test key)
8. Click **Save**

## Step 2: Update Database Schema

1. In your Supabase dashboard, go to **SQL Editor**
2. Click **New Query**
3. Paste and run:
   ```sql
   ALTER TABLE users 
   ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
   ADD COLUMN IF NOT EXISTS property_name TEXT;
   ```

## Step 3: Deploy the Function

1. In your Supabase dashboard, go to **Edge Functions**
2. Click **Create a new function**
3. **Function name:** `create-stripe-customer`
4. Copy the **entire contents** of `index.ts` and paste into the code editor
5. Click **Deploy**

## Step 4: Test the Function

Use this example in your browser console or Postman:

```javascript
fetch('https://YOUR_PROJECT.supabase.co/functions/v1/create-stripe-customer', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_SUPABASE_ANON_KEY'
  },
  body: JSON.stringify({
    email: 'pm@example.com',
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

**Note**: This function creates a Stripe customer BEFORE the user exists in your database. Save the returned `customer_id` to use during checkout and store it with the user record after payment success.

## Done! 🎉

Your function is now live and ready to use.
