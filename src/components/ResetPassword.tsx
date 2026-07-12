import { useEffect, useRef, useState } from 'react';
import { Lock, Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ResetPasswordProps {
  onComplete: () => void;
}

const MIN_PASSWORD_LENGTH = 8;

const ResetPassword = ({ onComplete }: ResetPasswordProps) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [hasValidSession, setHasValidSession] = useState<boolean | null>(null);
  // Holds the single verifyOtp() call so it runs exactly once even when React
  // StrictMode invokes this effect twice in development.
  const verifyPromiseRef = useRef<ReturnType<typeof supabase.auth.verifyOtp> | null>(null);

  // Establish the recovery session from the email link.
  //
  // The link can arrive in one of three shapes:
  //  1. ?token_hash=...&type=recovery  -> verify explicitly (scanner-safe flow)
  //  2. #access_token=...&type=recovery -> already handled by the Supabase
  //     client (detectSessionInUrl), so getSession() returns a session
  //  3. #error=...&error_description=... -> the link was invalid/expired
  useEffect(() => {
    let active = true;

    const establishSession = async () => {
      const searchParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));

      // If the verify endpoint reported an error, surface it directly.
      const urlError =
        searchParams.get('error_description') ||
        hashParams.get('error_description') ||
        searchParams.get('error') ||
        hashParams.get('error');
      if (urlError) {
        if (active) setHasValidSession(false);
        return;
      }

      const tokenHash = searchParams.get('token_hash') || hashParams.get('token_hash');

      if (tokenHash) {
        // A recovery token is single-use. StrictMode runs effects twice in dev,
        // so guard the call: both invocations await the SAME verifyOtp promise
        // instead of spending the token twice (the 2nd would fail and wrongly
        // mark a valid link as expired).
        if (!verifyPromiseRef.current) {
          verifyPromiseRef.current = supabase.auth.verifyOtp({
            type: 'recovery',
            token_hash: tokenHash,
          });
        }
        const { error } = await verifyPromiseRef.current;
        if (error) {
          console.error('Recovery token verification failed:', error);
        }
      }

      // Source of truth: did a recovery session actually get established?
      const { data } = await supabase.auth.getSession();
      if (active) setHasValidSession(!!data.session);
    };

    establishSession();

    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (password.length < MIN_PASSWORD_LENGTH) {
      setErrorMessage(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        console.error('Password reset failed:', error);
        setErrorMessage(error.message || 'Unable to reset your password. The link may have expired.');
        setIsSubmitting(false);
        return;
      }

      console.log('Password reset successful');
      setIsSuccess(true);

      // Sign out the temporary recovery session so the user logs in fresh
      await supabase.auth.signOut().catch((err) => console.warn('Sign out after reset failed:', err));

      // Return to login after a short confirmation delay
      setTimeout(() => {
        onComplete();
      }, 2500);
    } catch (error) {
      console.error('Password reset error:', error);
      setErrorMessage('An error occurred. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-xl shadow-sm p-8">
          <h1 className="text-2xl font-bold text-gray-800 mb-6 text-center">
            Reset your password
          </h1>

          {isSuccess ? (
            <div className="text-center">
              <CheckCircle className="w-12 h-12 text-emerald-600 mx-auto mb-4" />
              <p className="text-gray-700 mb-2">Your password has been updated.</p>
              <p className="text-sm text-gray-500">Redirecting you to sign in…</p>
            </div>
          ) : hasValidSession === false ? (
            <div className="text-center">
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <p className="text-gray-700 mb-2">This reset link is invalid or has expired.</p>
              <p className="text-sm text-gray-500 mb-6">Password reset links are valid for a limited time. Please request a new one.</p>
              <button
                onClick={onComplete}
                className="text-emerald-600 hover:text-emerald-700 font-medium text-sm transition-colors"
              >
                Back to sign in
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <p className="text-sm text-gray-500 text-center">
                Enter a new password for your account.
              </p>

              <div>
                <label htmlFor="new-password" className="block text-sm font-medium text-gray-700 mb-2">
                  New Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="new-password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (errorMessage) setErrorMessage('');
                    }}
                    required
                    className="w-full pl-12 pr-12 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-colors"
                    placeholder="Enter a new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 mb-2">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="confirm-password"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      if (errorMessage) setErrorMessage('');
                    }}
                    required
                    className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-colors"
                    placeholder="Re-enter your new password"
                  />
                </div>
              </div>

              {errorMessage && (
                <div className="text-red-600 text-sm text-center">
                  {errorMessage}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting || !password || !confirmPassword}
                className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium py-3 px-6 rounded-full transition-colors flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Updating…
                  </>
                ) : (
                  'Update Password'
                )}
              </button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={onComplete}
                  className="text-sm text-gray-500 hover:text-gray-700 hover:underline transition-colors"
                >
                  Back to sign in
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
