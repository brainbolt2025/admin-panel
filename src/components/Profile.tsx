import { useState, useEffect } from 'react';
import { User, Mail, Shield, Building, Calendar, LogOut, XCircle, AlertCircle, Check, AlertTriangle } from 'lucide-react';
import { getAuthenticatedSupabase } from '../lib/supabase';
import { config } from '../config';

interface UserProfile {
  id: string;
  name: string | null;
  email: string | null;
  role: string | null;
  property_id: string | null;
  property_name?: string | null;
  created_at?: string | null;
}

interface ProfileProps {
  onLogout?: () => void;
}

const Profile = ({ onLogout }: ProfileProps = {}) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);
  const [subscriptionPlan, setSubscriptionPlan] = useState<string | null>(null);
  const [cancelAt, setCancelAt] = useState<string | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [reactivating, setReactivating] = useState(false);
  const [reactivateError, setReactivateError] = useState<string | null>(null);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const supabaseClient = getAuthenticatedSupabase();
        
        // Get current user
        const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
        
        if (userError || !user) {
          throw new Error('Failed to get user');
        }

        // Get user profile from users table
        const { data: userProfile, error: profileError } = await supabaseClient
          .from('users')
          .select('id, name, email, role, property_id, created_at, subscription_status, plan, cancel_at')
          .eq('id', user.id)
          .single();

        if (profileError) {
          throw profileError;
        }

        // Set subscription info
        if (userProfile) {
          setSubscriptionStatus(userProfile.subscription_status);
          setSubscriptionPlan(userProfile.plan);
          setCancelAt(userProfile.cancel_at || null);
        }

        // If user has a property_id, get property name
        let propertyName = null;
        if (userProfile?.property_id) {
          const { data: property } = await supabaseClient
            .from('properties')
            .select('name')
            .eq('id', userProfile.property_id)
            .single();
          
          propertyName = property?.name || null;
        }

        setProfile({
          ...userProfile,
          property_name: propertyName,
        } as UserProfile);
      } catch (err) {
        console.error('Error loading profile:', err);
        setError(err instanceof Error ? err.message : 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, []);

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Loading profile...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">Error: {error}</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800">No profile data found</p>
        </div>
      </div>
    );
  }

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    } catch {
      return dateString;
    }
  };

  const getRoleLabel = (role: string | null) => {
    switch (role) {
      case 'pm':
        return 'Property Manager';
      case 'tenant':
        return 'Tenant';
      case 'technician':
        return 'Technician';
      case 'super_admin':
        return 'Super Admin';
      default:
        return role || 'N/A';
    }
  };

  const handleCancelSubscription = async (cancelImmediately: boolean) => {
    setCancelling(true);
    setCancelError(null);

    try {
      const supabaseClient = getAuthenticatedSupabase();
      const { data: { session } } = await supabaseClient.auth.getSession();
      
      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`${config.supabase.url}/functions/v1/cancel-subscription`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          cancel_immediately: cancelImmediately,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to cancel subscription');
      }

      // Update local state
      setSubscriptionStatus(cancelImmediately ? 'canceled' : 'active');
      setCancelAt(null); // Will be set by reload
      setShowCancelModal(false);
      
      // Reload page to refresh subscription info
      window.location.reload();
    } catch (err) {
      console.error('Error cancelling subscription:', err);
      setCancelError(err instanceof Error ? err.message : 'Failed to cancel subscription');
    } finally {
      setCancelling(false);
    }
  };

  const handleReactivateSubscription = async () => {
    setReactivating(true);
    setReactivateError(null);

    try {
      const supabaseClient = getAuthenticatedSupabase();
      const { data: { session } } = await supabaseClient.auth.getSession();
      
      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(config.api.reactivateSubscription, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to reactivate subscription');
      }

      // Update local state
      setCancelAt(null);
      
      // Reload page to refresh subscription info
      window.location.reload();
    } catch (err) {
      console.error('Error reactivating subscription:', err);
      setReactivateError(err instanceof Error ? err.message : 'Failed to reactivate subscription');
    } finally {
      setReactivating(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-600 to-teal-700 px-6 py-8">
          <div className="flex items-center space-x-4">
            <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-lg">
              <User className="w-10 h-10 text-teal-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">
                {profile.name || 'No Name'}
              </h1>
              <p className="text-teal-100 mt-1">{getRoleLabel(profile.role)}</p>
            </div>
          </div>
        </div>

        {/* Profile Details */}
        <div className="p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-6">Profile Information</h2>
          
          <div className="space-y-4">
            {/* Email */}
            <div className="flex items-start space-x-4 p-4 bg-gray-50 rounded-lg">
              <div className="p-2 bg-teal-100 rounded-lg">
                <Mail className="w-5 h-5 text-teal-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-500 mb-1">Email Address</p>
                <p className="text-gray-800 font-medium">{profile.email || 'N/A'}</p>
              </div>
            </div>

            {/* Role */}
            <div className="flex items-start space-x-4 p-4 bg-gray-50 rounded-lg">
              <div className="p-2 bg-teal-100 rounded-lg">
                <Shield className="w-5 h-5 text-teal-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-500 mb-1">Role</p>
                <p className="text-gray-800 font-medium">{getRoleLabel(profile.role)}</p>
              </div>
            </div>

            {/* Property (if applicable) */}
            {profile.property_name && (
              <div className="flex items-start space-x-4 p-4 bg-gray-50 rounded-lg">
                <div className="p-2 bg-teal-100 rounded-lg">
                  <Building className="w-5 h-5 text-teal-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-500 mb-1">Property</p>
                  <p className="text-gray-800 font-medium">{profile.property_name}</p>
                </div>
              </div>
            )}

            {/* Account Created */}
            <div className="flex items-start space-x-4 p-4 bg-gray-50 rounded-lg">
              <div className="p-2 bg-teal-100 rounded-lg">
                <Calendar className="w-5 h-5 text-teal-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-500 mb-1">Account Created</p>
                <p className="text-gray-800 font-medium">{formatDate(profile.created_at)}</p>
              </div>
            </div>

            {/* Subscription Status (only for PMs) */}
            {profile.role === 'pm' && subscriptionStatus && (
              <>
                {/* Cancellation Warning Message (persistent) */}
                {cancelAt && (
                  <div className="flex items-start space-x-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg mb-4">
                    <div className="p-2 bg-yellow-100 rounded-lg">
                      <AlertTriangle className="w-5 h-5 text-yellow-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-yellow-800 mb-1">
                        Subscription Scheduled for Cancellation
                      </p>
                      <p className="text-sm text-yellow-700 mb-3">
                        Your subscription will be cancelled on{' '}
                        <strong>{formatDate(cancelAt)}</strong>. You'll continue to have access to all features until then.
                      </p>
                      {reactivateError && (
                        <div className="mb-3 bg-red-50 border border-red-200 rounded-lg p-2">
                          <p className="text-red-800 text-sm">{reactivateError}</p>
                        </div>
                      )}
                      <button
                        onClick={handleReactivateSubscription}
                        disabled={reactivating}
                        className="bg-teal-600 hover:bg-teal-700 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                      >
                        {reactivating ? 'Reactivating...' : 'Reactivate Subscription'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Subscription Status Card */}
                <div className="flex items-start space-x-4 p-4 bg-gray-50 rounded-lg">
                  <div className={`p-2 rounded-lg ${
                    cancelAt 
                      ? 'bg-yellow-100' 
                      : subscriptionStatus === 'active' 
                        ? 'bg-green-100' 
                        : 'bg-red-100'
                  }`}>
                    {cancelAt ? (
                      <AlertTriangle className="w-5 h-5 text-yellow-600" />
                    ) : subscriptionStatus === 'active' ? (
                      <Check className="w-5 h-5 text-green-600" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-600" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-gray-500 mb-1">Subscription Status</p>
                    <p className="text-gray-800 font-medium capitalize">
                      {cancelAt 
                        ? 'Active (Scheduled for Cancellation)'
                        : subscriptionStatus === 'active' 
                          ? 'Active' 
                          : subscriptionStatus}
                    </p>
                    {subscriptionPlan && (
                      <p className="text-sm text-gray-500 mt-1">Plan: {subscriptionPlan}</p>
                    )}
                    {subscriptionStatus === 'active' && !cancelAt && (
                      <button
                        onClick={() => setShowCancelModal(true)}
                        className="mt-3 text-red-600 hover:text-red-700 text-sm font-medium"
                      >
                        Cancel Subscription
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Logout Button */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <button
              onClick={onLogout}
              className="w-full bg-red-600 text-white px-6 py-3 rounded-lg flex items-center justify-center gap-2 font-medium hover:bg-red-700 transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </div>

      {/* Cancel Subscription Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center mb-4">
              <AlertCircle className="w-6 h-6 text-red-600 mr-2" />
              <h3 className="text-lg font-semibold text-gray-800">Cancel Subscription</h3>
            </div>
            
            <p className="text-gray-600 mb-6">
              Are you sure you want to cancel your subscription? Your subscription will remain active 
              until the end of your current billing period, and you'll continue to have access to all 
              features until then.
            </p>

            {cancelError && (
              <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-red-800 text-sm">{cancelError}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowCancelModal(false);
                  setCancelError(null);
                }}
                disabled={cancelling}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Keep Subscription
              </button>
              <button
                onClick={() => handleCancelSubscription(false)}
                disabled={cancelling}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {cancelling ? 'Cancelling...' : 'Cancel at Period End'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;

