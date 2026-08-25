// Environment configuration — prefer Vite env vars (.env.development / .env.production)
const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL || 'https://qmhmgjzkpfzxfjdurigu.supabase.co'
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFtaG1nanprcGZ6eGZqZHVyaWd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEyNDcwODcsImV4cCI6MjA3NjgyMzA4N30.ALgIUUSgxuDaaEIuh-izKHAcRiWURLjje4jxUDalC1Y'

console.log('Vite MODE:', import.meta.env.MODE)
console.log('Supabase URL:', supabaseUrl)

export const config = {
  supabase: {
    url: supabaseUrl,
    anonKey: supabaseAnonKey,
  },

  stripe: {
    publicKey:
      import.meta.env.VITE_STRIPE_PUBLIC_KEY ||
      'pk_test_51SMW5PLC1RJAUbjMm3YeYK0X7UDOApodSWG603SAE7hUgHjdmPsIYRIgdaATq0EpRbcq4tiDzobtcyydFsEbGC7y00oz597a74',
    monthlyPriceId:
      import.meta.env.VITE_STRIPE_MONTHLY_PRICE_ID || 'price_1SMzASLC1RJAUbjMZVUqQCY0',
    yearlyPriceId:
      import.meta.env.VITE_STRIPE_YEARLY_PRICE_ID || 'price_1SMzB3LC1RJAUbjMB57Ph1dI',
  },

  api: {
    createUser: `${supabaseUrl}/functions/v1/create-user`,
    createStripeCustomer: `${supabaseUrl}/functions/v1/create-stripe-customer`,
    createSubscription: `${supabaseUrl}/functions/v1/create-subscription`,
    cancelSubscription: `${supabaseUrl}/functions/v1/cancel-subscription`,
    reactivateSubscription: `${supabaseUrl}/functions/v1/reactivate-subscription`,
    renewSubscription: `${supabaseUrl}/functions/v1/renew-subscription`,
    updateUserEmail: `${supabaseUrl}/functions/v1/update-user-email`,
    contactSupport: `${supabaseUrl}/functions/v1/contact-support`,
    addToWaitlist: `${supabaseUrl}/functions/v1/add-to-waitlist`,
    createReport: `${supabaseUrl}/functions/v1/create-report`,
    createTenantInvites: `${supabaseUrl}/functions/v1/create-tenant-invites`,
  },
  playStoreUrl:
    import.meta.env.VITE_PLAY_STORE_URL ||
    'https://play.google.com/store/apps/details?id=com.asine.app',
}
