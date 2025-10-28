# Development Keys Setup Guide

This guide explains how to set up the development keys for the Asine Admin Panel.

## 🔑 Development Keys Added

The following development keys have been configured:

### Stripe Keys
- **Public Key**: `pk_test_51SMW5PLC1RJAUbjMm3YeYK0X7UDOApodSWG603SAE7hUgHjdmPsIYRIgdaATq0EpRbcq4tiDzobtcyydFsEbGC7y00oz597a74`
- **Secret Key**: `sk_test_xxx` (see .env.local for actual key)

### Stripe Price IDs
- **Monthly Plan**: `price_1SMzASLC1RJAUbjMZVUqQCY0`
- **Yearly Plan**: `price_1SMzB3LC1RJAUbjMB57Ph1dI`

## 🚀 Setup Instructions

### 1. Supabase Edge Functions Secrets

Set the Stripe secret key as a Supabase secret:

**Using Supabase Dashboard:**
1. Go to https://supabase.com/dashboard
2. Select your project
3. Navigate to **Project Settings** → **Edge Functions** → **Secrets**
4. Click **Add Secret**
5. Key: `STRIPE_SECRET_KEY`
6. Value: `sk_test_xxx` (see .env.local for actual key)
7. Click **Save**

### 2. Frontend Environment Variables

Create a `.env.local` file in the project root with:

```bash
# Stripe Development Keys
VITE_STRIPE_PUBLIC_KEY=pk_test_51SMW5PLC1RJAUbjMm3YeYK0X7UDOApodSWG603SAE7hUgHjdmPsIYRIgdaATq0EpRbcq4tiDzobtcyydFsEbGC7y00oz597a74
VITE_STRIPE_SECRET_KEY=sk_test_xxx

# Stripe Price IDs for Development
VITE_STRIPE_MONTHLY_PRICE_ID=price_1SMzASLC1RJAUbjMZVUqQCY0
VITE_STRIPE_YEARLY_PRICE_ID=price_1SMzB3LC1RJAUbjMB57Ph1dI
```

### 3. Deploy Edge Functions

Deploy the updated Edge Functions with the new price IDs:

1. **create-stripe-customer**: Already configured
2. **create-subscription**: Updated with new price IDs
3. **stripe-webhook**: Ready for webhook secret setup

## 🔧 Configuration Files Updated

### Frontend Configuration (`src/config.ts`)
- Centralized configuration for Supabase and Stripe
- Environment variable support
- Fallback values for development

### Updated Components
- **Subscription.tsx**: Now uses real Stripe integration
- **Login.tsx**: Uses centralized config
- **App.tsx**: Uses centralized config

## 🧪 Testing

### Test Cards (Stripe Test Mode)
- **Card Number**: `4242 4242 4242 4242`
- **Expiry**: Any future date
- **CVC**: Any 3 digits
- **Postal Code**: Any valid code

### Test Flow
1. User selects subscription plan
2. Fills out registration form
3. Creates Stripe customer
4. Redirects to Stripe Checkout
5. Completes payment with test card
6. Webhook updates user subscription status

## 🔄 Next Steps

1. **Set up Stripe Webhook**:
   - Create webhook endpoint in Stripe Dashboard
   - Add `STRIPE_WEBHOOK_SECRET` to Supabase secrets
   - Deploy stripe-webhook function

2. **Test Complete Flow**:
   - Test subscription creation
   - Verify webhook events
   - Check database updates

3. **Production Setup** (when ready):
   - Replace test keys with live keys
   - Update price IDs to production prices
   - Update success/cancel URLs

## 📝 Notes

- All keys are currently in **test mode**
- The frontend will automatically use environment variables if available
- Fallback values are provided for immediate development
- Edge Functions use Supabase secrets for security
- Frontend uses environment variables for public keys

## 🚨 Security

- Never commit `.env.local` to version control
- Keep Stripe secret keys secure
- Use Supabase secrets for server-side keys
- Environment variables are safe for public keys in frontend
