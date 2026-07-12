# Testing Guide: Renew Subscription Feature

This guide explains how to test the renew subscription page that appears when a PM's subscription has been cancelled and the cancellation period (30 days) has passed.

## Prerequisites

1. Have a PM user account that is logged in
2. Access to Supabase SQL Editor or database access
3. Test Stripe account (for payment testing)

## Test Scenarios

### Scenario 1: Simulate Expired Cancelled Subscription

**Goal**: Test that the renew subscription page appears when a subscription is cancelled and the cancellation period has passed.

#### Steps:

1. **Get your PM user ID**:
   - Log in to the admin panel
   - Open browser console and run:
     ```javascript
     const userStr = localStorage.getItem('user')
     const user = JSON.parse(userStr)
     console.log('User ID:', user.id)
     ```

2. **Update user subscription status in database**:
   - Go to Supabase Dashboard → SQL Editor
   - Run this SQL (replace `YOUR_USER_ID` with your actual user ID):
     ```sql
     -- Set subscription to cancelled with cancel_at date in the past
     UPDATE users
     SET 
       subscription_status = 'canceled',
       subscribed = false,
       cancel_at = NOW() - INTERVAL '1 day'  -- Set to 1 day ago (past the cancellation period)
     WHERE id = 'YOUR_USER_ID';
     ```

3. **Refresh the admin panel**:
   - The page should automatically show the RenewSubscription component
   - You should see:
     - Orange alert icon
     - "Your Subscription Has Expired" heading
     - Monthly and Yearly plan options

### Scenario 2: Test Plan Selection

#### Steps:

1. **On the renew subscription page**:
   - Click on the Monthly Plan card
   - Verify it shows "Selected" state with teal border
   - Click on the Yearly Plan card
   - Verify it becomes selected and Monthly becomes unselected

2. **Click "Renew Subscription" button**:
   - Should be enabled when a plan is selected
   - Should redirect to Stripe Checkout page

### Scenario 3: Test Stripe Checkout Flow

#### Steps:

1. **After clicking "Renew Subscription"**:
   - Should redirect to Stripe Checkout
   - Should show the selected plan details

2. **Complete payment with test card**:
   - Use test card: `4242 4242 4242 4242`
   - Any future expiry date (e.g., `12/34`)
   - Any 3-digit CVC (e.g., `123`)
   - Any postal code (e.g., `12345`)

3. **After successful payment**:
   - Should redirect back to admin panel
   - Should NOT show renew subscription page
   - Subscription status should be updated to 'active'

### Scenario 4: Test Real-Time Updates

#### Steps:

1. **Set subscription to cancelled** (from Scenario 1)

2. **Open browser console and monitor**:
   - Check for real-time subscription updates

3. **In another browser/incognito window** (or use Supabase Dashboard):
   - Update the subscription status back to active:
     ```sql
     UPDATE users
     SET 
       subscription_status = 'active',
       subscribed = true,
       cancel_at = NULL
     WHERE id = 'YOUR_USER_ID';
     ```

4. **Verify**:
   - The renew subscription page should disappear
   - User should see normal dashboard

### Scenario 5: Test Edge Cases

#### Test 1: Subscription Cancelled But Not Yet Expired

**Goal**: Verify that renew page does NOT show if cancellation period hasn't passed yet.

**Steps**:
```sql
-- Set cancel_at to future date (within cancellation period)
UPDATE users
SET 
  subscription_status = 'active',  -- Still active during cancellation period
  subscribed = true,
  cancel_at = NOW() + INTERVAL '10 days'  -- 10 days in the future
WHERE id = 'YOUR_USER_ID';
```

**Expected**: Renew subscription page should NOT appear. User should see normal dashboard.

#### Test 2: Subscription Active

**Goal**: Verify normal flow when subscription is active.

**Steps**:
```sql
-- Set subscription to active
UPDATE users
SET 
  subscription_status = 'active',
  subscribed = true,
  cancel_at = NULL
WHERE id = 'YOUR_USER_ID';
```

**Expected**: Renew subscription page should NOT appear. User should see normal dashboard.

## Manual Database Testing Queries

### Check Current Subscription Status

```sql
SELECT 
  id,
  email,
  name,
  subscription_status,
  subscribed,
  cancel_at,
  CASE 
    WHEN cancel_at IS NULL THEN 'No cancellation scheduled'
    WHEN cancel_at > NOW() THEN 'Cancellation scheduled for ' || cancel_at::text
    ELSE 'Subscription expired on ' || cancel_at::text
  END AS status_description
FROM users
WHERE id = 'YOUR_USER_ID';
```

### Reset to Active Subscription

```sql
UPDATE users
SET 
  subscription_status = 'active',
  subscribed = true,
  cancel_at = NULL
WHERE id = 'YOUR_USER_ID';
```

### Set to Expired Cancelled Subscription

```sql
UPDATE users
SET 
  subscription_status = 'canceled',
  subscribed = false,
  cancel_at = NOW() - INTERVAL '1 day'
WHERE id = 'YOUR_USER_ID';
```

### Set to Scheduled Cancellation (Not Yet Expired)

```sql
UPDATE users
SET 
  subscription_status = 'active',
  subscribed = true,
  cancel_at = NOW() + INTERVAL '20 days'
WHERE id = 'YOUR_USER_ID';
```

## Browser Console Testing

### Check Current User Profile

```javascript
// In browser console
const userStr = localStorage.getItem('user')
const user = JSON.parse(userStr)
console.log('User:', user)

// Check Supabase session
const { data: { session } } = await supabase.auth.getSession()
console.log('Session:', session)
```

### Check Subscription Status

```javascript
// After logging in
const supabaseClient = getAuthenticatedSupabase()
const { data: profile } = await supabaseClient
  .from('users')
  .select('id, email, subscription_status, cancel_at, subscribed')
  .eq('id', session.user.id)
  .single()

console.log('Subscription Status:', profile)
```

## Expected Behavior

### When Subscription is Cancelled and Expired:
- ✅ RenewSubscription page appears automatically
- ✅ Cannot access dashboard or other pages
- ✅ Shows pricing plans
- ✅ Can select plan and proceed to Stripe Checkout

### When Subscription is Active:
- ✅ Normal dashboard access
- ✅ No renew subscription page
- ✅ All features available

### When Subscription is Scheduled for Cancellation (not yet expired):
- ✅ Normal dashboard access
- ✅ Yellow banner shows cancellation warning
- ✅ Can reactivate subscription
- ✅ No renew subscription page

## Troubleshooting

### Renew Subscription Page Not Appearing

1. **Check subscription_status**:
   ```sql
   SELECT subscription_status, cancel_at, subscribed 
   FROM users WHERE id = 'YOUR_USER_ID';
   ```
   - Should be `'canceled'`
   - `cancel_at` should be in the past

2. **Check browser console for errors**

3. **Verify user role is 'pm'**:
   ```sql
   SELECT role FROM users WHERE id = 'YOUR_USER_ID';
   ```

4. **Refresh the page** after database update

### Stripe Checkout Not Redirecting

1. **Check network tab** in browser DevTools
2. **Verify create-subscription Edge Function is deployed**
3. **Check Edge Function logs** in Supabase Dashboard
4. **Verify Stripe API keys are set** in Supabase secrets

### Payment Succeeds But Status Not Updated

1. **Check Stripe webhook configuration**:
   - Webhook should be set up for `customer.subscription.created`
   - Webhook URL should point to `stripe-webhook` Edge Function

2. **Check Edge Function logs** for webhook processing

3. **Manually verify in database**:
   ```sql
   SELECT subscription_status, subscribed 
   FROM users WHERE id = 'YOUR_USER_ID';
   ```

## Quick Test Script

Run this in Supabase SQL Editor to cycle through test states:

```sql
-- Replace with your user ID
DO $$
DECLARE
  user_id UUID := 'YOUR_USER_ID';  -- Replace this
BEGIN
  -- Set to expired cancelled subscription
  UPDATE users
  SET 
    subscription_status = 'canceled',
    subscribed = false,
    cancel_at = NOW() - INTERVAL '1 day'
  WHERE id = user_id;
  
  RAISE NOTICE 'Subscription set to expired cancelled. Renew page should appear.';
END $$;
```

Then refresh your browser to see the renew subscription page.


