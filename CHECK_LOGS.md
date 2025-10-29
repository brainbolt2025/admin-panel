# How to Check Logs for create-user Function

## Step 1: Verify Function is Deployed

1. Go to https://supabase.com/dashboard
2. Select your project (`goljbyvrnktxwtnjomaq` for development)
3. Click **Edge Functions** in the left sidebar
4. Look for **`create-user`** in the list
   - ✅ If you see it → Function is deployed, proceed to Step 2
   - ❌ If you don't see it → Function needs to be deployed first

### If Function is NOT Deployed:

1. In Supabase Dashboard → **Edge Functions**
2. Click **Create a new function** or **New Function**
3. Function name: `create-user`
4. Copy the **entire contents** of `supabase/functions/create-user/index.ts`
5. Paste into the code editor
6. Click **Deploy**

## Step 2: Test the Function to Generate Logs

### Option A: Test in Browser Console (Easiest)

1. Open your browser's Developer Console (F12)
2. Go to your app (or any page where you can run JavaScript)
3. Paste and run this code:

```javascript
fetch('https://goljbyvrnktxwtnjomaq.supabase.co/functions/v1/create-user', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdvbGpieXZybmt0eHd0bmpvbWFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE2MTM0NzcsImV4cCI6MjA3NzE4OTQ3N30.qUU-teO-8RSitnM6GemwjcaezVDD6eJcNYUmxL8O5Bw'
  },
  body: JSON.stringify({
    email: 'test+' + Date.now() + '@example.com',
    password: 'password123',
    name: 'Test User',
    property_name: 'Test Property'
  })
})
.then(res => res.json())
.then(data => {
  console.log('Response:', data)
  if (data.error) {
    console.error('Error:', data.error)
  }
})
```

### Option B: Use the Subscription Form in Your App

1. Start your app: `npm run dev`
2. Navigate to the subscription/signup page
3. Fill out the form with test data
4. Submit the form
5. This will automatically call the function and generate logs

### Option C: Use Node.js Test Script

Run the test file I created:

```bash
node test-create-user.js
```

## Step 3: View the Logs

**After running the test above:**

1. Go back to Supabase Dashboard
2. Click **Edge Functions** → **`create-user`**
3. Click the **Logs** tab
4. You should now see log entries with:
   - `console.log()` messages
   - `console.error()` messages
   - Error details if something failed

### What to Look For in Logs:

✅ **Success logs:**
- `"Auth user created successfully: [uuid]"`
- `"User profile created successfully: [uuid]"`
- `"User role confirmed as 'pm'"`

❌ **Error logs:**
- `"User profile creation error: [error details]"`
- `"Error details: [JSON with full error info]"`
- `"Attempted insert data: [data that was being inserted]"`

## Step 4: If Still No Logs

If you still don't see logs after testing:

1. **Check function execution:**
   - Look for the function in Edge Functions list
   - Click on it to see if there are any invocation records
   - Check if there's a "Last invoked" timestamp

2. **Verify the function was called:**
   - Check browser console for network errors
   - Verify the endpoint URL is correct
   - Check if CORS errors appear (these might prevent the function from running)

3. **Check function code:**
   - Make sure the function is deployed with the latest code
   - Verify console.log statements are in the code

4. **Try invoking directly:**
   - Use the "Invoke" button in Supabase Dashboard (if available)
   - Or use the REST API directly with Postman/curl

## Quick Test Command

You can also test using curl if you have it installed:

```bash
curl -X POST https://goljbyvrnktxwtnjomaq.supabase.co/functions/v1/create-user \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdvbGpieXZybmt0eHd0bmpvbWFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE2MTM0NzcsImV4cCI6MjA3NzE4OTQ3N30.qUU-teO-8RSitnM6GemwjcaezVDD6eJcNYUmxL8O5Bw" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "name": "Test User",
    "property_name": "Test Property"
  }'
```

**Remember:** Logs only appear after the function is actually executed/invoked!

