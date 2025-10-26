import { useState } from 'react';
import { Search, ChevronDown, ArrowUp, Check, Clock, Minus } from 'lucide-react';
import InvitePM from './InvitePM';

interface PropertyManager {
  id: string;
  name: string;
  email: string;
  avatar: string;
  assignedProperties: string[];
  region: string;
  status: 'Active' | 'Invite Sent' | 'Deactivated';
}

const PropertyManagers = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [regionFilter, setRegionFilter] = useState('Any');
  const [showInvitePM, setShowInvitePM] = useState(false);

  const handleBulkInviteClick = () => {
    setShowInvitePM(true);
  };

  // Mock data based on the image
  const propertyManagers: PropertyManager[] = [
    {
      id: '1',
      name: 'Alex Morgan',
      email: 'alex.morgan@pmcorp.com',
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=40&h=40&fit=crop&crop=face',
      assignedProperties: ['Maple Residences', 'Riverside North', 'City Center'],
      region: 'East',
      status: 'Active'
    },
    {
      id: '2',
      name: 'Sam Carter',
      email: 'sam.carter@pmcorp.com',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=40&h=40&fit=crop&crop=face',
      assignedProperties: ['Harbor View', 'Lakeside Oaks'],
      region: 'West',
      status: 'Invite Sent'
    },
    {
      id: '3',
      name: 'Diego Ramos',
      email: 'diego.ramos@pmcorp.com',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=40&h=40&fit=crop&crop=face',
      assignedProperties: ['City Center', 'Midtown Plaza', 'Park Lane'],
      region: 'Central',
      status: 'Deactivated'
    }
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Active':
        return <Check className="w-3 h-3" />;
      case 'Invite Sent':
        return <Clock className="w-3 h-3" />;
      case 'Deactivated':
        return <Minus className="w-3 h-3" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active':
        return 'bg-green-500 text-white';
      case 'Invite Sent':
        return 'bg-orange-500 text-white';
      case 'Deactivated':
        return 'bg-gray-400 text-white';
      default:
        return 'bg-gray-400 text-white';
    }
  };

  const filteredManagers = propertyManagers.filter(manager => {
    const matchesSearch = manager.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         manager.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'All' || manager.status === statusFilter;
    const matchesRegion = regionFilter === 'Any' || manager.region === regionFilter;
    
    return matchesSearch && matchesStatus && matchesRegion;
  });

  // Show InvitePM component if showInvitePM is true
  if (showInvitePM) {
    return <InvitePM onBack={() => setShowInvitePM(false)} />;
  }

  return (
    <div className="p-6">
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-6 gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Property Managers</h1>
        
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name or email"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-white w-64"
            />
          </div>

          {/* Status Filter */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="appearance-none bg-white border border-gray-300 rounded-lg px-4 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            >
              <option value="All">Status: All</option>
              <option value="Active">Active</option>
              <option value="Invite Sent">Invite Sent</option>
              <option value="Deactivated">Deactivated</option>
            </select>
            <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>

          {/* Region Filter */}
          <div className="relative">
            <select
              value={regionFilter}
              onChange={(e) => setRegionFilter(e.target.value)}
              className="appearance-none bg-white border border-gray-300 rounded-lg px-4 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            >
              <option value="Any">Region: Any</option>
              <option value="East">East</option>
              <option value="West">West</option>
              <option value="Central">Central</option>
            </select>
            <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>

          {/* Bulk Invite Button */}
          <button 
            disabled
            className="bg-gray-400 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors cursor-not-allowed"
          >
            <ArrowUp className="w-4 h-4" />
            Bulk Invite
          </button>
        </div>
      </div>

      {/* Property Managers Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">PM</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Assigned Properties</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Region</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Status</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredManagers.map((manager) => (
                <tr key={manager.id} className="hover:bg-gray-50">
                  {/* PM Column */}
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-3">
                      <img
                        src={manager.avatar}
                        alt={manager.name}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                      <div>
                        <div className="text-sm font-semibold text-gray-900">{manager.name}</div>
                        <div className="text-sm text-gray-500">{manager.email}</div>
                      </div>
                    </div>
                  </td>

                  {/* Assigned Properties Column */}
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">
                      {manager.assignedProperties.map((property, index) => (
                        <div key={index}>{property}</div>
                      ))}
                    </div>
                  </td>

                  {/* Region Column */}
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">{manager.region}</div>
                  </td>

                  {/* Status Column */}
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(manager.status)}`}>
                      {getStatusIcon(manager.status)}
                      {manager.status}
                    </span>
                  </td>

                  {/* Actions Column */}
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-2">
                      {manager.status === 'Active' && (
                        <>
                          <button className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-colors">
                            View
                          </button>
                          <button className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-colors">
                            Reset Password
                          </button>
                          <button className="px-3 py-1 text-sm bg-teal-600 text-white rounded-md hover:bg-teal-700 transition-colors">
                            Deactivate
                          </button>
                        </>
                      )}
                      {manager.status === 'Invite Sent' && (
                        <>
                          <button className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-colors">
                            Resend Invite
                          </button>
                          <button className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-colors">
                            Edit
                          </button>
                          <button className="px-3 py-1 text-sm bg-teal-600 text-white rounded-md hover:bg-teal-700 transition-colors">
                            Deactivate
                          </button>
                        </>
                      )}
                      {manager.status === 'Deactivated' && (
                        <>
                          <button className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-colors">
                            View
                          </button>
                          <button className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-colors">
                            Reactivate
                          </button>
                          <button className="px-3 py-1 text-sm bg-teal-600 text-white rounded-md hover:bg-teal-700 transition-colors">
                            Remove
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PropertyManagers;
