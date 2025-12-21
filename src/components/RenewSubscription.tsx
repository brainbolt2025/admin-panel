import { useEffect, useState } from 'react';
import { Check, CreditCard, AlertCircle, LogOut } from 'lucide-react';
import { config } from '../config';
import { getAuthenticatedSupabase } from '../lib/supabase';

interface RenewSubscriptionProps {
  onSuccess?: () => void;
  onLogout?: () => void;
}

const RenewSubscription = ({ onSuccess, onLogout }: RenewSubscriptionProps) => {
  const [selectedPlan, setSelectedPlan] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [stripeCustomerId, setStripeCustomerId] = useState<string>('');

  useEffect(() => {
    const loadUserInfo = async () => {
      try {
        const supabaseClient = getAuthenticatedSupabase();
        const { data: { user } } = await supabaseClient.auth.getUser();
        
        if (user) {
          // Get user profile with stripe_customer_id
          const { data: profile } = await supabaseClient
            .from('users')
            .select('stripe_customer_id')
            .eq('id', user.id)
            .single();
          
          if (profile) {
            setStripeCustomerId(profile.stripe_customer_id || '');
          }
        }
      } catch (error) {
        console.error('Error loading user info:', error);
      }
    };

    loadUserInfo();
  }, []);

  const plans = [
    {
      id: 'monthly',
      name: 'Monthly Plan',
      price: '$149',
      period: '/month',
      features: [
        'Approve or reject pending signups',
        'Receive notifications for new access requests',
        'Create, edit, or delete tenant accounts',
        'Assign technicians to tenant work orders',
        'View tenant maintenance history',
        'Add or remove technicians',
        'Assign work orders to specific technicians',
        'View work order statistics'
      ],
      popular: false
    },
    {
      id: 'yearly',
      name: 'Yearly Plan',
      price: '$1,429',
      period: '/year',
      originalPrice: '$1,788',
      discount: '20% OFF',
      features: [
        'Approve or reject pending signups',
        'Receive notifications for new access requests',
        'Create, edit, or delete tenant accounts',
        'Assign technicians to tenant work orders',
        'View tenant maintenance history',
        'Add or remove technicians',
        'Assign work orders to specific technicians',
        'View work order statistics',
        'Save $359 per year'
      ],
      popular: true
    }
  ];

  const handlePlanSelect = (planId: string) => {
    setSelectedPlan(planId);
    setErrorMessage('');
  };

  const handleRenew = async () => {
    if (!selectedPlan) {
      setErrorMessage('Please select a plan to continue');
      return;
    }

    if (!stripeCustomerId) {
      setErrorMessage('Unable to find your customer information. Please contact support.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      // Get Supabase session for authentication
      const supabaseClient = getAuthenticatedSupabase();
      const { data: { session } } = await supabaseClient.auth.getSession();
      
      if (!session) {
        setErrorMessage('You must be logged in to renew your subscription.');
        setIsSubmitting(false);
        return;
      }

      // Update existing subscription instead of creating a new one
      const renewResponse = await fetch(config.api.renewSubscription, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          plan: selectedPlan as 'monthly' | 'yearly'
        })
      });

      if (!renewResponse.ok) {
        const errorData = await renewResponse.json();
        throw new Error(errorData.error || 'Failed to renew subscription');
      }

      const renewData = await renewResponse.json();
      
      if (renewData.success) {
        if (renewData.requires_payment && renewData.checkout_url) {
          // Redirect to Stripe Checkout to collect payment
          window.location.href = renewData.checkout_url;
        } else {
          // Subscription updated successfully without payment
          // Call onSuccess to reload the profile and show dashboard
          if (onSuccess) {
            onSuccess();
          }
        }
      } else {
        throw new Error(renewData.error || 'Failed to renew subscription');
      }
    } catch (error: any) {
      console.error('Error renewing subscription:', error);
      setErrorMessage(error.message || 'Failed to renew subscription. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-orange-600" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Your Subscription Has Expired
          </h1>
          <p className="text-lg text-gray-600">
            Renew your subscription to continue using Asine and manage your properties.
          </p>
        </div>

        {/* Error Message */}
        {errorMessage && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800 text-sm">{errorMessage}</p>
          </div>
        )}

        {/* Pricing Plans */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {plans.map((plan) => (
            <div
              key={plan.id}
              onClick={() => handlePlanSelect(plan.id)}
              className={`
                relative bg-white rounded-xl shadow-sm p-6 cursor-pointer transition-all
                ${selectedPlan === plan.id 
                  ? 'ring-2 ring-teal-500 shadow-md' 
                  : 'hover:shadow-md'
                }
                ${plan.popular ? 'border-2 border-teal-500' : 'border border-gray-200'}
              `}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <span className="bg-teal-500 text-white text-xs font-semibold px-3 py-1 rounded-full">
                    {plan.discount}
                  </span>
                </div>
              )}
              
              <div className="text-center mb-4">
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{plan.name}</h3>
                <div className="flex items-baseline justify-center">
                  <span className="text-4xl font-bold text-gray-900">{plan.price}</span>
                  <span className="text-gray-600 ml-2">{plan.period}</span>
                </div>
                {plan.originalPrice && (
                  <p className="text-sm text-gray-500 mt-1 line-through">
                    {plan.originalPrice}{plan.period}
                  </p>
                )}
              </div>

              <ul className="space-y-3 mb-6">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-start">
                    <Check className="w-5 h-5 text-teal-600 mr-3 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-700">{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handlePlanSelect(plan.id);
                }}
                className={`
                  w-full py-3 px-4 rounded-lg font-medium transition-colors
                  ${selectedPlan === plan.id
                    ? 'bg-teal-600 text-white hover:bg-teal-700'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }
                `}
              >
                {selectedPlan === plan.id ? 'Selected' : 'Select Plan'}
              </button>
            </div>
          ))}
        </div>

        {/* Renew Button */}
        <div className="text-center">
          <button
            onClick={handleRenew}
            disabled={!selectedPlan || isSubmitting}
            className="inline-flex items-center gap-2 bg-teal-600 text-white px-8 py-4 rounded-lg font-semibold text-lg hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CreditCard className="w-5 h-5" />
            {isSubmitting ? 'Processing...' : 'Renew Subscription'}
          </button>
          <p className="text-sm text-gray-500 mt-4">
            You'll be redirected to Stripe to complete your payment securely
          </p>
          
          {/* Logout Button - Only shown for renewal */}
          {onLogout && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <button
                onClick={onLogout}
                className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors text-sm font-medium"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RenewSubscription;

