# Create Stripe Customer Edge Function

This Supabase Edge Function creates a new Stripe customer and updates the user record in the database with the Stripe customer ID and property name.

## Features

- Creates a Stripe customer with name, email, and metadata
- Validates input fields and email format
- Returns the Stripe customer ID for use after payment success
- Handles errors gracefully with proper HTTP status codes
- No user_id required - use this BEFORE creating the user (e.g., before checkout)

## Setup

### 1. Set Environment Variables

Set your Stripe secret key as a Supabase secret:

**Using Supabase Dashboard:**
1. Go to your Supabase project: https://supabase.com/dashboard
2. Navigate to **Project Settings** → **Edge Functions** → **Secrets**
3. Click **Add Secret**
4. Key: `STRIPE_SECRET_KEY`
5. Value: `sk_test_xxx` (replace with your actual Stripe secret key)
6. Click **Save**

**Using CLI (if available):**
```bash
supabase secrets set STRIPE_SECRET_KEY=sk_test_xxx
```

### 2. Database Schema

Make sure your `users` table has these columns. Run this in your Supabase SQL Editor:

```sql
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
ADD COLUMN IF NOT EXISTS property_name TEXT;
```

## Deployment

### Option 1: Using Supabase Dashboard (No CLI Required)

1. Go to your Supabase project: https://supabase.com/dashboard
2. Navigate to **Edge Functions** in the left sidebar
3. Click **Create a new function**
4. Function name: `create-stripe-customer`
5. Copy and paste the entire contents of `supabase/functions/create-stripe-customer/index.ts` into the editor
6. Click **Deploy**

### Option 2: Using CLI (if available)

```bash
supabase functions deploy create-stripe-customer
```

## Usage

### Request

**Endpoint:** `https://YOUR_PROJECT.supabase.co/functions/v1/create-stripe-customer`

**Method:** `POST`

**Headers:**
- `Content-Type: application/json`
- `Authorization: Bearer YOUR_SUPABASE_ANON_KEY`

**Body:**
```json
{
  "email": "pm@example.com",
  "name": "John Doe",
  "property_name": "Sunset Apartments"
}
```

### Response

**Success (200):**
```json
{
  "success": true,
  "customer_id": "cus_xxxxxxxxxxxxx",
  "message": "Stripe customer created successfully"
}
```

**Error (400):**
```json
{
  "error": "Missing required fields. Required: email, name, property_name"
}
```

**Error (500):**
```json
{
  "error": "Internal server error"
}
```

## Example Usage

### JavaScript/TypeScript

```typescript
const createStripeCustomer = async (customerData: {
  email: string
  name: string
  property_name: string
}) => {
  const response = await fetch(
    'https://YOUR_PROJECT.supabase.co/functions/v1/create-stripe-customer',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`
      },
      body: JSON.stringify(customerData)
    }
  )

  const data = await response.json()
  return data
}

// Usage - Call this BEFORE creating the user, for example before checkout
try {
  const result = await createStripeCustomer({
    email: 'pm@example.com',
    name: 'John Doe',
    property_name: 'Sunset Apartments'
  })
  
  if (result.success) {
    console.log('Stripe customer created:', result.customer_id)
    
    // Use this customer_id for:
    // 1. Stripe Checkout session creation
    // 2. Save to your database AFTER payment success
    // 3. Store it with the user record when the user is created
  } else {
    console.error('Error:', result.error)
  }
} catch (error) {
  console.error('Request failed:', error)
}
```

### cURL

```bash
curl -X POST \
  'https://YOUR_PROJECT.supabase.co/functions/v1/create-stripe-customer' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_SUPABASE_ANON_KEY' \
  -d '{
    "email": "pm@example.com",
    "name": "John Doe",
    "property_name": "Sunset Apartments"
  }'
```

## Error Handling

The function returns appropriate HTTP status codes:

- **400**: Missing required fields or invalid email format
- **500**: Server errors (Stripe API errors, database errors)
- **200**: Success

## Stripe Customer Details

When a customer is created in Stripe, it includes:

- **Name**: Customer's full name
- **Email**: Customer's email address
- **Metadata**: `property_name` field
- **Description**: "Asine Property Manager"

## Recommended Workflow

1. **Before Payment**: Call this function to create a Stripe customer
   - Returns `customer_id` (e.g., `cus_xxxxxxxxxxxxx`)

2. **During Payment**: Use the `customer_id` for Stripe Checkout or payment intent

3. **After Payment Success**: 
   - Create the user in your database
   - Save the `customer_id` and `property_name` to the user record
   - This links the Stripe customer to your app user

## Security

- Validates all input fields
- Uses HTTPS for all API calls
- Stripe secret key is stored securely as a Supabase secret

## Testing

Test locally with Supabase CLI:

```bash
supabase functions serve create-stripe-customer
```

Then test with:

```bash
curl -X POST http://localhost:54321/functions/v1/create-stripe-customer \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_SUPABASE_ANON_KEY' \
  -d '{
    "email": "test@example.com",
    "name": "Test User",
    "property_name": "Test Property",
    "user_id": "test-user-id"
  }'
```
