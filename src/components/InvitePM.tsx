import { useState } from 'react';
import { UserPlus, Mail, Calendar, CheckCircle, Clock, XCircle, ArrowLeft } from 'lucide-react';
import { config } from '../config';

interface Invitation {
  id: string;
  name: string;
  email: string;
  status: 'Sent' | 'Accepted' | 'Expired';
  dateSent: string;
  assignedProperties: string[];
}

interface InvitePMProps {
  onBack: () => void;
}

const InvitePM = ({ onBack }: InvitePMProps) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    assignedProperties: [] as string[]
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Mock data for recent invitations
  const recentInvitations: Invitation[] = [
    {
      id: '1',
      name: 'Sarah Johnson',
      email: 'sarah.johnson@pmcorp.com',
      status: 'Sent',
      dateSent: '2024-01-15',
      assignedProperties: ['Sunset Towers', 'Garden Plaza']
    },
    {
      id: '2',
      name: 'Michael Chen',
      email: 'michael.chen@pmcorp.com',
      status: 'Accepted',
      dateSent: '2024-01-12',
      assignedProperties: ['Downtown Complex', 'Riverside Apartments']
    },
    {
      id: '3',
      name: 'Emily Rodriguez',
      email: 'emily.rodriguez@pmcorp.com',
      status: 'Expired',
      dateSent: '2024-01-08',
      assignedProperties: ['Harbor View', 'Lakeside Oaks']
    }
  ];

  const availableProperties = [
    'Maple Residences',
    'Riverside North',
    'City Center',
    'Harbor View',
    'Lakeside Oaks',
    'Sunset Towers',
    'Garden Plaza',
    'Downtown Complex',
    'Riverside Apartments',
    'Midtown Plaza',
    'Park Lane'
  ];

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handlePropertyToggle = (property: string) => {
    setFormData(prev => ({
      ...prev,
      assignedProperties: prev.assignedProperties.includes(property)
        ? prev.assignedProperties.filter(p => p !== property)
        : [...prev.assignedProperties, property]
    }));
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

      const response = await fetch(
        `${config.supabase.url}/functions/v1/invite-pm`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
            'apikey': config.supabase.anonKey
          },
          body: JSON.stringify({
            email: formData.email,
            name: formData.name,
            role: 'pm'
          })
        }
      );

      const data = await response.json();

      if (response.ok && data.success) {
        console.log('User invited successfully:', data);
        alert('Invitation sent successfully!');
        
        // Reset form
        setFormData({
          name: '',
          email: '',
          assignedProperties: []
        });
      } else {
        console.error('Failed to invite user:', data);
        alert(data.error || 'Failed to send invitation. Please try again.');
      }
    } catch (error) {
      console.error('Error inviting user:', error);
      alert('An error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Sent':
        return <Clock className="w-4 h-4" />;
      case 'Accepted':
        return <CheckCircle className="w-4 h-4" />;
      case 'Expired':
        return <XCircle className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Sent':
        return 'bg-orange-100 text-orange-800';
      case 'Accepted':
        return 'bg-green-100 text-green-800';
      case 'Expired':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
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
          Back to Property Managers
        </button>
      </div>

      {/* Invite Property Manager Form */}
      <div className="max-w-2xl mx-auto mb-8">
        <div className="bg-white rounded-xl shadow-sm p-8">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <UserPlus className="w-8 h-8 text-teal-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Invite Property Manager</h1>
            <p className="text-gray-600">Send an invitation to a new property manager to join your team</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Name Field */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                Full Name
              </label>
              <div className="relative">
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="Enter full name"
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
                  className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="Enter email address"
                />
              </div>
            </div>

            {/* Assigned Properties */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Assigned Properties
              </label>
              <div className="border border-gray-300 rounded-lg p-4 max-h-48 overflow-y-auto">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {availableProperties.map((property) => (
                    <label
                      key={property}
                      className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-2 rounded"
                    >
                      <input
                        type="checkbox"
                        checked={formData.assignedProperties.includes(property)}
                        onChange={() => handlePropertyToggle(property)}
                        className="w-4 h-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500"
                      />
                      <span className="text-sm text-gray-700">{property}</span>
                    </label>
                  ))}
                </div>
              </div>
              {formData.assignedProperties.length > 0 && (
                <div className="mt-2">
                  <p className="text-sm text-gray-600">
                    Selected: {formData.assignedProperties.join(', ')}
                  </p>
                </div>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting || !formData.name || !formData.email}
              className="w-full bg-teal-600 hover:bg-teal-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Sending Invitation...
                </>
              ) : (
                <>
                  <UserPlus className="w-5 h-5" />
                  Send Invitation
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Recent Invitations Section */}
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Recent Invitations
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Name</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Email</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Assigned Properties</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Date Sent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {recentInvitations.map((invitation) => (
                  <tr key={invitation.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{invitation.name}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-600">{invitation.email}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        {invitation.assignedProperties.map((property, index) => (
                          <div key={index}>{property}</div>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(invitation.status)}`}>
                        {getStatusIcon(invitation.status)}
                        {invitation.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-600">{formatDate(invitation.dateSent)}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {recentInvitations.length === 0 && (
            <div className="text-center py-12">
              <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No recent invitations</p>
              <p className="text-sm text-gray-400 mt-2">Invitations will appear here once sent</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InvitePM;
