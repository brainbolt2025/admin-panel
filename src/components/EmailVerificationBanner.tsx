import { AlertCircle, Mail } from 'lucide-react';
import { useState } from 'react';
import { getAuthenticatedSupabase } from '../lib/supabase';
import { config } from '../config';

interface EmailVerificationBannerProps {
  email: string | null;
  emailVerified: boolean;
  userName?: string | null;
  userId?: string;
}

const EmailVerificationBanner = ({ email, emailVerified, userName, userId }: EmailVerificationBannerProps) => {
  const [isSending, setIsSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (emailVerified) return null;

  const handleResendVerification = async () => {
    if (!email || !userId) return;

    setIsSending(true);
    setMessage(null);

    try {
      const supabaseClient = getAuthenticatedSupabase();
      const { data: { session } } = await supabaseClient.auth.getSession();

      if (!session) {
        setMessage('You must be logged in to resend verification email.');
        setIsSending(false);
        return;
      }

      // Get user's name if not provided
      let userDisplayName = userName || 'Property Manager';
      if (!userDisplayName) {
        const { data: userData } = await supabaseClient
          .from('users')
          .select('name')
          .eq('id', userId)
          .single();
        
        if (userData?.name) {
          userDisplayName = userData.name;
        }
      }

      // Generate a new verification token
      const verificationToken = crypto.randomUUID();

      // Update the user record with the new token
      await supabaseClient
        .from('users')
        .update({
          verification_token: verificationToken,
          verification_token_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
        })
        .eq('id', userId);

      // Call send-verification-email Edge Function
      const response = await fetch(`${config.supabase.url}/functions/v1/send-verification-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          email: email,
          name: userDisplayName,
          token: verificationToken,
          subject: 'Verify your Asine account',
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setMessage('Verification email sent! Please check your inbox.');
      } else {
        setMessage(data.error || 'Failed to send verification email. Please try again.');
      }
    } catch (error) {
      console.error('Error sending verification email:', error);
      setMessage('An error occurred. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="bg-orange-50 border-b border-orange-200 px-6 py-3">
      <div className="flex items-center space-x-3 max-w-7xl mx-auto">
        <div className="flex-shrink-0">
          <AlertCircle className="w-5 h-5 text-orange-600" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-orange-800">
            Email Verification Required
          </p>
          <p className="text-sm text-orange-700">
            Please verify your email address ({email}) to continue using all features. 
            Check your inbox for the verification link.
          </p>
          {message && (
            <p className={`text-xs mt-1 ${message.includes('sent') ? 'text-green-700' : 'text-red-700'}`}>
              {message}
            </p>
          )}
        </div>
        <div className="flex-shrink-0">
          <button
            onClick={handleResendVerification}
            disabled={isSending}
            className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Mail className="w-4 h-4" />
            {isSending ? 'Sending...' : 'Resend Email'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EmailVerificationBanner;

