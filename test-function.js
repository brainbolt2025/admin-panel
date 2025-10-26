// Test script for Supabase Edge Function
// Copy and paste this into your browser console while logged into your app

async function testInvitePM() {
  try {
    // Get the access token from localStorage
    const token = localStorage.getItem('access_token');
    
    if (!token) {
      console.error('❌ No access token found. Please log in first.');
      return;
    }
    
    console.log('🔑 Token found:', token.substring(0, 20) + '...');
    console.log('📤 Sending invite request...');
    
    // Make the request
    const response = await fetch(
      'https://qmhmgjzkpfzxfjdurigu.supabase.co/functions/v1/invite-pm',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          email: 'testpm@example.com',
          name: 'Test PM',
          role: 'pm'
        })
      }
    );
    
    const data = await response.json();
    
    // Check response
    if (response.ok && data.success) {
      console.log('✅ Success! User invited:', data);
    } else {
      console.error('❌ Error:', data);
    }
    
  } catch (error) {
    console.error('❌ Network error:', error);
  }
}

// Run the test
testInvitePM();
