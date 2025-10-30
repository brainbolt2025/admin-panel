import { useState } from 'react';
import { User, Mail, Lock, Eye, EyeOff, Check, CreditCard, ArrowRight } from 'lucide-react';
import { config } from '../config';

interface SubscriptionProps {
  onSuccess?: () => void;
}

const Subscription = ({ onSuccess }: SubscriptionProps) => {
  const [step, setStep] = useState<'pricing' | 'form' | 'success'>('pricing');
  const [selectedPlan, setSelectedPlan] = useState<string>('');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    propertyName: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    if (errorMessage) {
      setErrorMessage('');
    }
  };

  const handlePlanSelect = (planId: string) => {
    setSelectedPlan(planId);
    setStep('form');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage('');

    try {
      // Step 1: Create user account and profile via Edge Function
      const userResponse = await fetch(config.api.createUser, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.supabase.anonKey}`
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          name: formData.name,
          property_name: formData.propertyName
        })
      });

      if (!userResponse.ok) {
        const errorData = await userResponse.json();
        throw new Error(errorData.error || 'Failed to create user account');
      }

      const userData = await userResponse.json();
      const userId = userData.user_id;
      console.log('User created successfully:', userId);

      // Step 2: Create Stripe customer
      const customerResponse = await fetch(config.api.createStripeCustomer, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.supabase.anonKey}`
        },
        body: JSON.stringify({
          email: formData.email,
          name: formData.name,
          property_name: formData.propertyName
        })
      });

      if (!customerResponse.ok) {
        const errorData = await customerResponse.json();
        throw new Error(errorData.error || 'Failed to create customer');
      }

      const customerData = await customerResponse.json();
      const stripeCustomerId = customerData.customer_id;

      // Step 3: Create subscription checkout session
      const subscriptionResponse = await fetch(config.api.createSubscription, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.supabase.anonKey}`
        },
        body: JSON.stringify({
          user_id: userId, // Use the actual user ID from account creation
          email: formData.email,
          stripe_customer_id: stripeCustomerId,
          plan: selectedPlan as 'monthly' | 'yearly'
        })
      });

      if (!subscriptionResponse.ok) {
        const errorData = await subscriptionResponse.json();
        throw new Error(errorData.error || 'Failed to create subscription');
      }

      const subscriptionData = await subscriptionResponse.json();
      
      // Redirect to Stripe Checkout
      if (subscriptionData.success && subscriptionData.url) {
        window.location.href = subscriptionData.url;
      } else {
        throw new Error('No checkout URL received');
      }

    } catch (error) {
      console.error('Subscription error:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Payment processing failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderPricingStep = () => (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="text-center mb-12">
        <div className="flex items-center justify-center mb-6">
          <div className="w-12 h-12 bg-teal-600 rounded-xl flex items-center justify-center mr-4">
            <span className="text-white font-bold text-xl">A</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-800">Asine</h1>
        </div>
        <h2 className="text-2xl font-semibold text-gray-700 mb-2">Activate your account</h2>
        <p className="text-gray-500">Choose the perfect plan for your property management needs</p>
      </div>

      {/* Pricing Cards */}
      <div className="grid md:grid-cols-2 gap-8 mb-12 max-w-4xl mx-auto">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className={`relative bg-white rounded-2xl shadow-sm border-2 p-8 transition-all duration-300 hover:shadow-lg ${
              plan.popular 
                ? 'border-teal-500 ring-2 ring-teal-100' 
                : 'border-gray-200 hover:border-teal-300'
            }`}
          >
            {plan.popular && (
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                <span className="bg-teal-500 text-white px-4 py-1 rounded-full text-sm font-medium">
                  {plan.discount}
                </span>
              </div>
            )}
            
            <div className="text-center mb-6">
              <h3 className="text-xl font-semibold text-gray-800 mb-2">{plan.name}</h3>
              <div className="flex items-baseline justify-center">
                <span className="text-4xl font-bold text-gray-900">{plan.price}</span>
                <span className="text-gray-500 ml-1">{plan.period}</span>
              </div>
              {plan.originalPrice && (
                <div className="mt-2">
                  <span className="text-lg text-gray-400 line-through mr-2">{plan.originalPrice}</span>
                  <span className="text-sm text-teal-600 font-medium">{plan.discount}</span>
                </div>
              )}
            </div>

            <ul className="space-y-3 mb-8">
              {plan.features.map((feature, index) => (
                <li key={index} className="flex items-center">
                  <Check className="w-5 h-5 text-teal-500 mr-3 flex-shrink-0" />
                  <span className={`text-gray-600 ${feature.includes('Save') ? 'font-medium text-teal-600' : ''}`}>
                    {feature}
                  </span>
                </li>
              ))}
            </ul>

            <button
              onClick={() => handlePlanSelect(plan.id)}
              className={`w-full py-3 px-6 rounded-xl font-medium transition-colors ${
                plan.popular
                  ? 'bg-teal-600 hover:bg-teal-700 text-white'
                  : 'bg-gray-100 hover:bg-teal-50 text-gray-700 hover:text-teal-700'
              }`}
            >
              Select Plan
            </button>
          </div>
        ))}
      </div>
    </div>
  );

  const renderFormStep = () => (
    <div className="max-w-md mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center mb-4">
          <div className="w-10 h-10 bg-teal-600 rounded-lg flex items-center justify-center mr-3">
            <span className="text-white font-bold text-lg">A</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Asine</h1>
        </div>
        <h2 className="text-xl font-semibold text-gray-700 mb-2">Complete your registration</h2>
        <p className="text-gray-500">Fill in your details to activate your account</p>
      </div>

      {/* Registration Form */}
      <div className="bg-white rounded-2xl shadow-sm p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Name Field */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
              Full Name
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                required
                className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-colors"
                placeholder="Enter your full name"
              />
            </div>
          </div>

          {/* Property Name Field */}
          <div>
            <label htmlFor="propertyName" className="block text-sm font-medium text-gray-700 mb-2">
              Property Name
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                id="propertyName"
                name="propertyName"
                value={formData.propertyName}
                onChange={handleInputChange}
                required
                className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-colors"
                placeholder="Enter your property name"
              />
            </div>
          </div>

          {/* Email Field */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                required
                className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-colors"
                placeholder="Enter your email address"
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
                className="w-full pl-12 pr-12 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-colors"
                placeholder="Create a secure password"
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
            <div className="text-red-600 text-sm text-center bg-red-50 p-3 rounded-xl">
              {errorMessage}
            </div>
          )}

          {/* Subscribe Button */}
          <button
            type="submit"
            disabled={isSubmitting || !formData.name || !formData.propertyName || !formData.email || !formData.password}
            className="w-full bg-teal-600 hover:bg-teal-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium py-3 px-6 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Processing...
              </>
            ) : (
              <>
                Subscribe & Activate Account
                <CreditCard className="w-5 h-5" />
              </>
            )}
          </button>
        </form>

        {/* Back Button */}
        <div className="mt-6 text-center">
          <button
            onClick={() => setStep('pricing')}
            className="text-gray-500 hover:text-teal-600 transition-colors flex items-center justify-center gap-2 mx-auto"
          >
            <ArrowRight className="w-4 h-4 rotate-180" />
            Back to plans
          </button>
        </div>
      </div>
    </div>
  );

  const renderSuccessStep = () => (
    <div className="max-w-md mx-auto text-center">
      {/* Success Animation */}
      <div className="mb-8">
        <div className="w-20 h-20 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <Check className="w-10 h-10 text-teal-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Welcome to Asine!</h2>
        <p className="text-gray-600 mb-8">
          Your account has been successfully activated. You can now start managing your properties.
        </p>
      </div>

      {/* Success Card */}
      <div className="bg-white rounded-2xl shadow-sm p-8">
        <div className="space-y-4">
          <div className="flex items-center justify-center gap-3">
            <div className="w-8 h-8 bg-teal-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">A</span>
            </div>
            <span className="font-semibold text-gray-800">Account Activated</span>
          </div>
          
          <div className="text-sm text-gray-500">
            <p>Plan: {plans.find(p => p.id === selectedPlan)?.name}</p>
            <p>Email: {formData.email}</p>
            <p>Property: {formData.propertyName}</p>
          </div>

          <div className="pt-4">
            <div className="w-full bg-teal-50 rounded-xl p-4">
              <p className="text-sm text-teal-700">
                Redirecting you to the dashboard in a few seconds...
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full">
        {step === 'pricing' && renderPricingStep()}
        {step === 'form' && renderFormStep()}
        {step === 'success' && renderSuccessStep()}
      </div>
    </div>
  );
};

export default Subscription;
