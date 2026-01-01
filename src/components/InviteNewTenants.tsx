import { useState } from 'react';
import { Mail, UserPlus, X, ArrowLeft, Plus } from 'lucide-react';
import { config } from '../config';

interface NewTenant {
  email: string;
  name: string;
  unit_number: string;
}

interface InviteNewTenantsProps {
  onBack: () => void;
}

const InviteNewTenants = ({ onBack }: InviteNewTenantsProps) => {
  const [tenants, setTenants] = useState<NewTenant[]>([
    { email: '', name: '', unit_number: '' }
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInputChange = (index: number, field: keyof NewTenant, value: string) => {
    const updated = [...tenants];
    updated[index] = { ...updated[index], [field]: value };
    setTenants(updated);
  };

  const addTenantRow = () => {
    setTenants([...tenants, { email: '', name: '', unit_number: '' }]);
  };

  const removeTenantRow = (index: number) => {
    if (tenants.length > 1) {
      setTenants(tenants.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const accessToken = localStorage.getItem('access_token');
      
      if (!accessToken) {
        alert('You are not authenticated. Please log in again.');
        return;
      }

      // Filter out empty rows and validate
      const validTenants = tenants.filter(t => t.email.trim() !== '');
      
      if (validTenants.length === 0) {
        alert('Please enter at least one tenant email address.');
        return;
      }

      // Validate email formats
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      for (const tenant of validTenants) {
        if (!emailRegex.test(tenant.email)) {
          alert(`Invalid email format: ${tenant.email}`);
          return;
        }
      }

      const response = await fetch(
        `${config.supabase.url}/functions/v1/invite-new-tenants`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
            'apikey': config.supabase.anonKey
          },
          body: JSON.stringify({
            tenants: validTenants.map(t => ({
              email: t.email.trim(),
              name: t.name.trim() || undefined,
              unit_number: t.unit_number.trim() || undefined
            }))
          })
        }
      );

      const data = await response.json();

      if (response.ok && data.success) {
        alert(`✅ ${data.message}`);
        // Reset form
        setTenants([{ email: '', name: '', unit_number: '' }]);
      } else {
        alert(data.message || 'Failed to send invitations. Please try again.');
      }
    } catch (error) {
      console.error('Error sending tenant invitations:', error);
      alert('An error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6">
      {/* Back Button */}
      <div className="mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Tenants
        </button>
      </div>

      {/* Invite New Tenants Form */}
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm p-8">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <UserPlus className="w-8 h-8 text-teal-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Invite New Tenants</h1>
            <p className="text-gray-600">Send invitation emails to tenants who aren't yet in the system. They'll receive app download links and signup instructions.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Tenant Rows */}
            <div className="space-y-4">
              {tenants.map((tenant, index) => (
                <div key={index} className="grid grid-cols-12 gap-4 items-start p-4 border border-gray-200 rounded-lg">
                  <div className="col-span-12 md:col-span-5">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email Address <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="email"
                        value={tenant.email}
                        onChange={(e) => handleInputChange(index, 'email', e.target.value)}
                        required
                        className="w-full pl-12 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                        placeholder="tenant@example.com"
                      />
                    </div>
                  </div>

                  <div className="col-span-12 md:col-span-3">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Name (Optional)
                    </label>
                    <input
                      type="text"
                      value={tenant.name}
                      onChange={(e) => handleInputChange(index, 'name', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      placeholder="John Doe"
                    />
                  </div>

                  <div className="col-span-12 md:col-span-3">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Unit Number (Optional)
                    </label>
                    <input
                      type="text"
                      value={tenant.unit_number}
                      onChange={(e) => handleInputChange(index, 'unit_number', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      placeholder="A101"
                    />
                  </div>

                  <div className="col-span-12 md:col-span-1 flex items-end">
                    {tenants.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeTenantRow(index)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Add Another Tenant Button */}
            <button
              type="button"
              onClick={addTenantRow}
              className="flex items-center gap-2 text-teal-600 hover:text-teal-700 font-medium"
            >
              <Plus className="w-5 h-5" />
              Add Another Tenant
            </button>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting || tenants.filter(t => t.email.trim()).length === 0}
              className="w-full bg-teal-600 hover:bg-teal-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Sending Invitations...
                </>
              ) : (
                <>
                  <Mail className="w-5 h-5" />
                  Send Invitation Emails
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default InviteNewTenants;


