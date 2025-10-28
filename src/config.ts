// Environment configuration
export const config = {
  // Supabase configuration
  supabase: {
    url: 'https://qmhmgjzkpfzxfjdurigu.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFtaG1nanprcGZ6eGZqZHVyaWd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEyNDcwODcsImV4cCI6MjA3NjgyMzA4N30.ALgIUUSgxuDaaEIuh-izKHAcRiWURLjje4jxUDalC1Y'
  },
  
  // Stripe configuration
  stripe: {
    publicKey: import.meta.env.VITE_STRIPE_PUBLIC_KEY || 'pk_test_51SMW5PLC1RJAUbjMm3YeYK0X7UDOApodSWG603SAE7hUgHjdmPsIYRIgdaATq0EpRbcq4tiDzobtcyydFsEbGC7y00oz597a74',
    monthlyPriceId: import.meta.env.VITE_STRIPE_MONTHLY_PRICE_ID || 'price_1SMzASLC1RJAUbjMZVUqQCY0',
    yearlyPriceId: import.meta.env.VITE_STRIPE_YEARLY_PRICE_ID || 'price_1SMzB3LC1RJAUbjMB57Ph1dI'
  },
  
  // API endpoints
  api: {
    createStripeCustomer: 'https://qmhmgjzkpfzxfjdurigu.supabase.co/functions/v1/create-stripe-customer',
    createSubscription: 'https://qmhmgjzkpfzxfjdurigu.supabase.co/functions/v1/create-subscription'
  }
}
