// Environment configuration
const isDevelopment = import.meta.env.DEV || import.meta.env.MODE === 'development'

// Debug logging
console.log('Environment detected:', isDevelopment ? 'DEVELOPMENT' : 'PRODUCTION')
console.log('Vite DEV mode:', import.meta.env.DEV)
console.log('Vite MODE:', import.meta.env.MODE)

export const config = {
  // Supabase configuration - Dynamic based on environment
  supabase: {
    url: isDevelopment 
      ? 'https://goljbyvrnktxwtnjomaq.supabase.co'  // Development project
      : 'https://qmhmgjzkpfzxfjdurigu.supabase.co', // Production project
    anonKey: isDevelopment
      ? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdvbGpieXZybmt0eHd0bmpvbWFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE2MTM0NzcsImV4cCI6MjA3NzE4OTQ3N30.qUU-teO-8RSitnM6GemwjcaezVDD6eJcNYUmxL8O5Bw'  // Development anon key
      : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFtaG1nanprcGZ6eGZqZHVyaWd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEyNDcwODcsImV4cCI6MjA3NjgyMzA4N30.ALgIUUSgxuDaaEIuh-izKHAcRiWURLjje4jxUDalC1Y'
  },
  
  // Stripe configuration
  stripe: {
    publicKey: import.meta.env.VITE_STRIPE_PUBLIC_KEY || 'pk_test_51SMW5PLC1RJAUbjMm3YeYK0X7UDOApodSWG603SAE7hUgHjdmPsIYRIgdaATq0EpRbcq4tiDzobtcyydFsEbGC7y00oz597a74',
    monthlyPriceId: import.meta.env.VITE_STRIPE_MONTHLY_PRICE_ID || 'price_1SMzASLC1RJAUbjMZVUqQCY0',
    yearlyPriceId: import.meta.env.VITE_STRIPE_YEARLY_PRICE_ID || 'price_1SMzB3LC1RJAUbjMB57Ph1dI'
  },
  
  // API endpoints - Dynamic based on environment
  api: {
    createStripeCustomer: isDevelopment
      ? 'https://goljbyvrnktxwtnjomaq.supabase.co/functions/v1/create-stripe-customer'
      : 'https://qmhmgjzkpfzxfjdurigu.supabase.co/functions/v1/create-stripe-customer',
    createSubscription: isDevelopment
      ? 'https://goljbyvrnktxwtnjomaq.supabase.co/functions/v1/create-subscription'
      : 'https://qmhmgjzkpfzxfjdurigu.supabase.co/functions/v1/create-subscription'
  }
}
