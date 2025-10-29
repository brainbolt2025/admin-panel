// Test script for create-user function
// Run this in your browser console or Node.js to test the function and generate logs

const SUPABASE_URL = 'https://goljbyvrnktxwtnjomaq.supabase.co' // Development URL
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdvbGpieXZybmt0eHd0bmpvbWFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE2MTM0NzcsImV4cCI6MjA3NzE4OTQ3N30.qUU-teO-8RSitnM6GemwjcaezVDD6eJcNYUmxL8O5Bw'

const testData = {
  email: 'mrjpjay2+five@gmail.com',
  password: 'password',
  name: 'JP Five',
  property_name: 'Setpoint Apparment'
}

// Test the function
fetch(`${SUPABASE_URL}/functions/v1/create-user`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${ANON_KEY}`
  },
  body: JSON.stringify(testData)
})
.then(async (res) => {
  const data = await res.json()
  console.log('Response status:', res.status)
  console.log('Response data:', data)
  
  if (!res.ok) {
    console.error('Error:', data.error || data.message)
  } else {
    console.log('✅ Success! User created with ID:', data.user_id)
    console.log('✅ Role:', data.role)
  }
})
.catch(error => {
  console.error('Fetch error:', error)
})

