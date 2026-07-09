import { useState, useEffect } from 'react';
import { User, Lock, LogIn, Eye, EyeOff } from 'lucide-react';
import { config } from '../config';
import { supabase } from '../lib/supabase';

interface LoginProps {
  onLogin: () => void;
  onShowSubscription?: () => void;
}

const Login = ({ onLogin, onShowSubscription }: LoginProps) => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [resetMessage, setResetMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // Check if user just completed payment
  const [showPaymentSuccess, setShowPaymentSuccess] = useState(false);
  // Check if user clicked verification link
  const [verificationToken, setVerificationToken] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationMessage, setVerificationMessage] = useState<string | null>(null);
  
  const handleVerification = async (token: string) => {
    setIsVerifying(true);
    setVerificationMessage(null);
    
    try {
      console.log('Verification token received:', token);
      
      // Call verify-email Edge Function to verify the token
      const response = await fetch(
        `${config.supabase.url}/functions/v1/verify-email?token=${token}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'apikey': config.supabase.anonKey,
          }
        }
      );
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        setVerificationMessage('Email verified successfully! You can now sign in with your credentials.');
        // Optionally auto-clear the message after a few seconds
        setTimeout(() => {
          setVerificationMessage(null);
          setVerificationToken(null);
        }, 5000);
      } else {
        // Show more detailed error message including hints
        const errorMsg = data.error || 'Verification failed. The link may be expired or invalid.';
        const hintMsg = data.hint ? `\n\nHint: ${data.hint}` : '';
        setVerificationMessage(errorMsg + hintMsg);
        console.error('Verification error details:', data);
      }
    } catch (error) {
      console.error('Verification error:', error);
      setVerificationMessage('An error occurred during verification. Please try again or contact support.');
    } finally {
      setIsVerifying(false);
    }
  };
  
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const paymentStatus = urlParams.get('payment');
    const sessionId = urlParams.get('session_id');
    const token = urlParams.get('token');
    
    console.log('Login component - paymentStatus:', paymentStatus, 'sessionId:', sessionId, 'token:', token);
    
    if (paymentStatus === 'success') {
      console.log('Setting showPaymentSuccess to true');
      setShowPaymentSuccess(true);
      // Clear the URL parameter
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    
    // Handle verification token
    if (token) {
      setVerificationToken(token);
      handleVerification(token);
      // Clear the URL parameter after processing
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error message when user starts typing
    if (errorMessage) {
      setErrorMessage('');
    }
    if (resetMessage) {
      setResetMessage(null);
    }
  };

  const handleForgotPassword = async () => {
    setResetMessage(null);
    setErrorMessage('');

    const email = formData.email.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!email) {
      setResetMessage({ type: 'error', text: 'Enter your email address above, then click "Forgot password?" again.' });
      return;
    }
    if (!emailRegex.test(email)) {
      setResetMessage({ type: 'error', text: 'Please enter a valid email address to reset your password.' });
      return;
    }

    setIsSendingReset(true);
    try {
      const response = await fetch(`${config.supabase.url}/functions/v1/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': config.supabase.anonKey,
          'Authorization': `Bearer ${config.supabase.anonKey}`,
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json().catch(() => ({}));
      console.log('Forgot password response:', { status: response.status, data });

      if (response.ok && data.success) {
        setResetMessage({
          type: 'success',
          text: data.message || 'If an account exists with this email, a password reset link has been sent.',
        });
      } else {
        setResetMessage({
          type: 'error',
          text: data.error || 'Unable to send the reset email. Please try again later.',
        });
      }
    } catch (error) {
      console.error('Forgot password error:', error);
      setResetMessage({ type: 'error', text: 'An error occurred. Please try again later.' });
    } finally {
      setIsSendingReset(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });

      // Check if we have a session first (even if there's an error)
      const session = data?.session;
      const user = data?.user;

      if (error) {
        console.error('Login failed:', error);

        // Allow login to proceed even if email is not confirmed
        // Only block on actual authentication failures if we don't have a session
        if (error.message?.toLowerCase().includes('email not confirmed')) {
          // If we have a session despite the error, proceed with login
          if (session && user) {
            console.warn('Email not confirmed, but session exists - allowing login to proceed');
          } else {
            // No session, so we need to manually confirm the email and retry
            // For now, try to use admin API to confirm email, but since we can't do that from client,
            // we'll show a message but still try to proceed
            console.warn('Email not confirmed and no session - attempting to proceed anyway');
          }
        } else if (error.message?.toLowerCase().includes('invalid login credentials')) {
          setErrorMessage('Invalid email or password. Please try again.');
          setIsSubmitting(false);
          return;
        } else if (error.message?.toLowerCase().includes('too many requests')) {
          setErrorMessage('Too many login attempts. Please try again later.');
          setIsSubmitting(false);
          return;
        } else if (!session) {
          // Only show error if we don't have a session
          setErrorMessage(error.message || 'Login failed. Please try again.');
          setIsSubmitting(false);
          return;
        }
      }

      // If we have a session, proceed with login regardless of any error
      if (session && user) {
        localStorage.setItem('access_token', session.access_token);
        if (session.refresh_token) {
          localStorage.setItem('refresh_token', session.refresh_token);
        }

        localStorage.setItem('user', JSON.stringify(user));

        console.log('Login successful:', { user, session });

        // Navigate to dashboard on success
        onLogin();
      } else {
        // No session and no handled error case - show generic error
        setErrorMessage('Unable to sign in. Please check your credentials and try again.');
        setIsSubmitting(false);
      }
    } catch (error) {
      console.error('Login error:', error);
      setErrorMessage('An error occurred during login. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Login Card */}
        <div className="bg-white rounded-xl shadow-sm p-8">
          {/* Title */}
          <h1 className="text-2xl font-bold text-gray-800 mb-6 text-center">
            Sign in
          </h1>

          {/* Payment Success Message */}
          {showPaymentSuccess && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <svg className="h-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-green-800">
                    Payment Successful!
                  </h3>
                  <div className="mt-2 text-sm text-green-700">
                    <p>Your subscription has been activated. You can now sign in with your credentials.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Email Verification Message */}
          {verificationToken && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  {isVerifying ? (
                    <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                <div className="ml-3 flex-1">
                  <h3 className="text-sm font-medium text-blue-800">
                    {isVerifying ? 'Verifying Email...' : 'Verification Link Received'}
                  </h3>
                  <div className="mt-2 text-sm text-blue-700">
                    {verificationMessage || 'Processing your verification request...'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email/Username Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email or Username
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-colors"
                  placeholder="Enter your email or username"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  required
                  className="w-full pl-12 pr-12 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-colors"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="text-red-600 text-sm text-center">
                {errorMessage}
              </div>
            )}

            {/* Forgot Password Link */}
            <div className="text-left">
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={isSendingReset}
                className="text-sm text-gray-500 hover:text-gray-700 hover:underline transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSendingReset ? 'Sending reset link...' : 'Forgot password?'}
              </button>
            </div>

            {/* Reset Password Message */}
            {resetMessage && (
              <div className={`text-sm text-center ${resetMessage.type === 'success' ? 'text-emerald-600' : 'text-red-600'}`}>
                {resetMessage.text}
              </div>
            )}

            {/* Sign In Button */}
            <button
              type="submit"
              disabled={isSubmitting || !formData.email || !formData.password}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium py-3 px-6 rounded-full transition-colors flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Signing in...
                </>
              ) : (
                <>
                  Sign In
                  <LogIn className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          {/* Additional Info */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500 mb-4">
              Test: mrjpjay2@gmail.com
            </p>
            
            {/* Subscription Link */}
            {onShowSubscription && (
              <div className="border-t pt-4">
                <p className="text-sm text-gray-500 mb-3">
                  New Property Manager?
                </p>
                <button
                  onClick={onShowSubscription}
                  className="text-teal-600 hover:text-teal-700 font-medium text-sm transition-colors"
                >
                  Create Account & Subscribe →
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            Super Admin Dashboard
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
