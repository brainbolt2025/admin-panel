import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

interface ForgotPasswordRequest {
  email: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client with service role key for admin access
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    
    if (!supabaseServiceKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Service role key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // Parse request body
    const { email }: ForgotPasswordRequest = await req.json()

    if (!email) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing email address' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid email format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Processing password reset request for:', email)

    // Normalize email
    const normalizedEmail = email.toLowerCase().trim()
    
    // Check if user exists in public.users table
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, name, email, role')
      .eq('email', normalizedEmail)
      .single()

    // Always return success to prevent email enumeration attacks
    // Even if user doesn't exist, return success message
    if (userError || !userData) {
      console.log('User not found in public.users table (or error):', userError?.message || 'No user found')
      console.log('Email searched:', normalizedEmail)
      // Return success to prevent email enumeration
      return new Response(
        JSON.stringify({
          success: true,
          message: 'If an account exists with this email, a password reset link has been sent.',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userName = userData.name || 'User'
    const userRole = userData.role || 'tenant'
    
    console.log(`Processing password reset for ${userRole}:`, {
      email: normalizedEmail,
      name: userName,
      role: userRole,
      userId: userData.id
    })

    // Determine redirect URL based on environment and user role
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY') || ''
    const isTestMode = stripeSecretKey.startsWith('sk_test_')

    // Get deep link configuration based on user role
    let APP_DEEP_LINK_SCHEME = ''
    let APP_URL = ''
    
    if (userRole === 'tenant') {
      // Tenant-specific settings
      APP_DEEP_LINK_SCHEME = Deno.env.get('TENANT_APP_DEEP_LINK_SCHEME') || Deno.env.get('APP_DEEP_LINK_SCHEME') || ''
      APP_URL = Deno.env.get('TENANT_APP_URL') || Deno.env.get('APP_URL') || Deno.env.get('BASE_URL') || ''
    } else {
      // PM/Technician/Admin settings
      APP_DEEP_LINK_SCHEME = Deno.env.get('APP_DEEP_LINK_SCHEME') || ''
      APP_URL = Deno.env.get('APP_URL') || Deno.env.get('BASE_URL') || ''
    }

    // Determine redirect URL
    // Never use localhost - it won't work from email clients
    let redirectTo: string
    if (APP_DEEP_LINK_SCHEME) {
      // Use deep link scheme for mobile app
      redirectTo = `${APP_DEEP_LINK_SCHEME}auth/reset-password`
    } else if (APP_URL) {
      // Use configured app URL
      redirectTo = `${APP_URL}/auth/reset-password`
    } else {
      // Fallback: always use public web URL (never localhost)
      // For mobile apps, configure APP_DEEP_LINK_SCHEME or APP_URL
      redirectTo = 'https://admin.asine.app/auth/reset-password'
    }

    console.log('Generating password reset link with redirect_to:', redirectTo)
    console.log('Email being sent to Auth API:', normalizedEmail)

    // Use Supabase Admin API to generate a password recovery link
    // NOTE: This requires the user to exist in auth.users, not just public.users
    const generateLinkResponse = await fetch(`${supabaseUrl}/auth/v1/admin/generate_link`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`
      },
      body: JSON.stringify({
        type: 'recovery',
        email: normalizedEmail,
        redirect_to: redirectTo,
      })
    })

    if (!generateLinkResponse.ok) {
      const errorData = await generateLinkResponse.json().catch(() => ({}))
      console.error('Error generating password reset link from Auth API:', errorData)
      console.error('This usually means the user exists in public.users but not in auth.users')
      console.error('User role:', userRole, 'User ID:', userData.id, 'Email:', normalizedEmail)
      
      // Try to check if user exists in auth.users by email
      // Note: We can't directly query auth.users, but we can try to get user by ID
      try {
        const getUserResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userData.id}`, {
          method: 'GET',
          headers: {
            'apikey': supabaseServiceKey,
            'Authorization': `Bearer ${supabaseServiceKey}`
          }
        })
        
        if (getUserResponse.ok) {
          const authUserData = await getUserResponse.json()
          console.log('User found in auth.users, email:', authUserData.email)
          console.log('Email match:', authUserData.email?.toLowerCase() === normalizedEmail)
        } else {
          console.error('User not found in auth.users (checked by ID)')
          console.error('User may need to be created in auth.users first, or IDs do not match')
        }
      } catch (checkError) {
        console.error('Error checking auth.users:', checkError)
      }
      
      // Still return success to prevent email enumeration
      return new Response(
        JSON.stringify({
          success: true,
          message: 'If an account exists with this email, a password reset link has been sent.',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const linkData = await generateLinkResponse.json()
    const actionLink = linkData.action_link || linkData.properties?.action_link || linkData.properties?.actionLink

    if (!actionLink) {
      console.error('No action_link found in generated link data. Full response:', JSON.stringify(linkData, null, 2))
      // Still return success to prevent email enumeration
      return new Response(
        JSON.stringify({
          success: true,
          message: 'If an account exists with this email, a password reset link has been sent.',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Found action_link:', actionLink.substring(0, 100) + '...')

    // Mailgun configuration
    const MAILGUN_DOMAIN = Deno.env.get('MAILGUN_DOMAIN') || ''
    const MAILGUN_API_KEY = Deno.env.get('MAILGUN_API_KEY') || ''
    const MAILGUN_REGION = Deno.env.get('MAILGUN_REGION') || 'us'

    if (!MAILGUN_DOMAIN || !MAILGUN_API_KEY) {
      console.error('Missing Mailgun configuration')
      // Still return success - Supabase may send default email
      return new Response(
        JSON.stringify({
          success: true,
          message: 'If an account exists with this email, a password reset link has been sent.',
          warning: 'Custom email service not configured. Supabase default email may be sent.',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (MAILGUN_API_KEY.startsWith('pubkey-')) {
      return new Response(
        JSON.stringify({ success: false, error: 'MAILGUN_API_KEY must be a private key' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Build email content
    const htmlBody = `
      <html>
        <body style="font-family: Arial, sans-serif; color: #1f2933; line-height: 1.6; padding: 24px;">
          <h2 style="color: #0f766e; margin-bottom: 20px;">Reset Your Password</h2>
          <p>Hi ${userName},</p>
          <p>We received a request to reset your password for your Asine account.</p>
          <p>Click the button below to reset your password:</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${actionLink}" 
              style="background: #0f766e; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; display: inline-block; font-weight: bold;">
              Reset Password
            </a>
          </div>

          <p style="color: #666; font-size: 14px; margin-top: 30px;">
            If you didn't request a password reset, you can safely ignore this email. Your password will not be changed.
          </p>

          <p style="color: #666; font-size: 14px;">
            This link will expire in 1 hour for security reasons.
          </p>

          <p style="margin-top: 32px;">Best regards,<br/>The Asine Team</p>
        </body>
      </html>
    `

    const textBody = `Hi ${userName},

We received a request to reset your password for your Asine account.

Click the link below to reset your password:
${actionLink}

If you didn't request a password reset, you can safely ignore this email. Your password will not be changed.

This link will expire in 1 hour for security reasons.

Best regards,
The Asine Team`

    // Send email via Mailgun
    const mailgunBaseUrl =
      MAILGUN_REGION === 'eu' ? 'https://api.eu.mailgun.net/v3' : 'https://api.mailgun.net/v3'
    const mailgunUrl = `${mailgunBaseUrl}/${MAILGUN_DOMAIN}/messages`
    const mailgunAuthHeader = `Basic ${btoa(`api:${MAILGUN_API_KEY}`)}`

    const formData = new FormData()
    formData.append('from', `Asine <noreply@${MAILGUN_DOMAIN}>`)
    formData.append('to', email.toLowerCase().trim())
    formData.append('subject', 'Reset Your Asine Password')
    formData.append('html', htmlBody)
    formData.append('text', textBody)

    console.log('Sending password reset email to:', email)

    const mailgunResponse = await fetch(mailgunUrl, {
      method: 'POST',
      headers: {
        Authorization: mailgunAuthHeader,
      },
      body: formData,
    })

    if (!mailgunResponse.ok) {
      const mailgunResult = await mailgunResponse.json().catch(() => ({}))
      console.error('Mailgun error sending password reset email:', mailgunResult)
      // Still return success to prevent email enumeration
      return new Response(
        JSON.stringify({
          success: true,
          message: 'If an account exists with this email, a password reset link has been sent.',
          warning: 'Email delivery may have failed. Please try again later.',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const mailgunResult = await mailgunResponse.json().catch(() => ({}))

    console.log('Password reset email sent successfully:', mailgunResult.id)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'If an account exists with this email, a password reset link has been sent.',
        mailgun_id: mailgunResult.id,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in forgot-password:', error)
    // Always return success to prevent email enumeration
    return new Response(
      JSON.stringify({
        success: true,
        message: 'If an account exists with this email, a password reset link has been sent.',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

