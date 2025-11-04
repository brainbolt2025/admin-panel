import { useState, useEffect } from 'react';
import { Search, ChevronDown, Check, X as XIcon, User as UserIcon, Mail, Calendar } from 'lucide-react';
import { getAuthenticatedSupabase } from '../lib/supabase';

interface Tenant {
  id: string;
  name: string | null;
  email: string | null;
  role: string | null;
  approved: boolean | null;
  created_at?: string;
}

interface UsersProps {
  selectedTenantFilter?: string | null;
  onClearTenantFilter?: () => void;
}

const Users = ({ selectedTenantFilter, onClearTenantFilter }: UsersProps) => {
  // Get user role from localStorage
  const getUserRole = () => {
    try {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        if (user.user_metadata?.role) {
          return user.user_metadata.role;
        }
        if (user.raw_user_meta_data?.role) {
          return user.raw_user_meta_data.role;
        }
      }
    } catch (error) {
      console.error('Error parsing user data:', error);
    }
    return 'super_admin';
  };

  const userRole = getUserRole();
  const isPM = userRole === 'pm';

  // State for tenants
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loadingTenants, setLoadingTenants] = useState(false);
  const [errorTenants, setErrorTenants] = useState<string | null>(null);

  // State for search and filters
  const [searchTerm, setSearchTerm] = useState(selectedTenantFilter || '');
  const [statusFilter, setStatusFilter] = useState('All');

  // State for confirmation modal
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'approve' | 'reject' | null>(null);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);

  // Update search term when selectedTenantFilter prop changes
  useEffect(() => {
    if (selectedTenantFilter) {
      setSearchTerm(selectedTenantFilter);
      // Clear the filter after it's been applied
      if (onClearTenantFilter) {
        // Small delay to ensure the search term is set first
        setTimeout(() => {
          onClearTenantFilter();
        }, 100);
      }
    }
  }, [selectedTenantFilter, onClearTenantFilter]);

  // Fetch tenants from database
  useEffect(() => {
    if (!isPM) return; // Only fetch for PM users

    const fetchTenants = async () => {
      setLoadingTenants(true);
      setErrorTenants(null);

      try {
        const supabaseClient = getAuthenticatedSupabase();
        
        console.log('Fetching tenants for PM...');
        
        // Get PM's property_id
        const { data: userData } = await supabaseClient.auth.getUser();
        
        if (!userData.user) {
          throw new Error('User not found');
        }

        const { data: pmData, error: pmError } = await supabaseClient
          .from('users')
          .select('property_id')
          .eq('id', userData.user.id)
          .eq('role', 'pm')
          .single();

        if (pmError) throw pmError;
        if (!pmData.property_id) {
          console.log('No property assigned to PM');
          setTenants([]);
          return;
        }

        // Fetch all tenants from the same property
        const { data: tenantsData, error: tenantsError } = await supabaseClient
          .from('users')
          .select('id, name, email, role, approved, created_at')
          .eq('property_id', pmData.property_id)
          .eq('role', 'tenant')
          .order('created_at', { ascending: false });

        if (tenantsError) throw tenantsError;

        console.log('Tenants fetched:', tenantsData);

        if (!tenantsData || tenantsData.length === 0) {
          console.log('No tenants found in database');
          setTenants([]);
          return;
        }

        const transformedData: Tenant[] = tenantsData.map((tenant: any) => ({
          id: tenant.id,
          name: tenant.name,
          email: tenant.email,
          role: tenant.role,
          approved: tenant.approved,
          created_at: tenant.created_at,
        }));

        setTenants(transformedData);
      } catch (err: any) {
        console.error('Error fetching tenants:', err);
        setErrorTenants(err.message || 'Failed to load tenants');
      } finally {
        setLoadingTenants(false);
      }
    };

    fetchTenants();
  }, [isPM]);

  // Filter tenants based on search and filters
  const filteredTenants = tenants
    .filter((tenant) => {
      const matchesSearch = 
        tenant.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tenant.email?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'All' || 
        (statusFilter === 'Approved' && tenant.approved) ||
        (statusFilter === 'Pending' && !tenant.approved);

      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      // If there's a search term, prioritize exact or close matches
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const aNameMatch = a.name?.toLowerCase().startsWith(searchLower) ? 1 : 0;
        const bNameMatch = b.name?.toLowerCase().startsWith(searchLower) ? 1 : 0;
        
        // Exact start matches first
        if (aNameMatch !== bNameMatch) {
          return bNameMatch - aNameMatch;
        }
        
        // Then exact name matches
        const aExactMatch = a.name?.toLowerCase() === searchLower ? 1 : 0;
        const bExactMatch = b.name?.toLowerCase() === searchLower ? 1 : 0;
        if (aExactMatch !== bExactMatch) {
          return bExactMatch - aExactMatch;
        }
      }
      
      // Default: sort by created_at descending (newest first)
      const aDate = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bDate = b.created_at ? new Date(b.created_at).getTime() : 0;
      return bDate - aDate;
    });

  // Handle approve tenant click
  const handleApproveClick = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setConfirmAction('approve');
    setConfirmModalOpen(true);
  };

  // Handle reject tenant click
  const handleRejectClick = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setConfirmAction('reject');
    setConfirmModalOpen(true);
  };

  // Handle approve tenant
  const handleApproveTenant = async () => {
    if (!selectedTenant) return;

    try {
      const supabaseClient = getAuthenticatedSupabase();
      
      // Update tenant to approved
      const { error } = await supabaseClient
        .from('users')
        .update({ approved: true })
        .eq('id', selectedTenant.id);

      if (error) {
        console.error('Update error details:', error);
        throw error;
      }

      // Refresh tenants list
      const { data: userData } = await supabaseClient.auth.getUser();
      
      if (!userData.user) {
        throw new Error('User not found');
      }

      const { data: pmData, error: pmError } = await supabaseClient
        .from('users')
        .select('property_id')
        .eq('id', userData.user.id)
        .eq('role', 'pm')
        .single();

      if (pmError) throw pmError;
      
      const { data: tenantsData, error: tenantsError } = await supabaseClient
        .from('users')
        .select('id, name, email, role, approved, created_at')
        .eq('property_id', pmData.property_id)
        .eq('role', 'tenant')
        .order('created_at', { ascending: false });

      if (tenantsError) throw tenantsError;

      const transformedData: Tenant[] = tenantsData.map((t: any) => ({
        id: t.id,
        name: t.name,
        email: t.email,
        role: t.role,
        approved: t.approved,
        created_at: t.created_at,
      }));

      setTenants(transformedData);
      setConfirmModalOpen(false);
      setSelectedTenant(null);
      setConfirmAction(null);
    } catch (err: any) {
      console.error('Error approving tenant:', err);
      alert('Failed to approve tenant. Please try again.');
    }
  };

  // Handle reject tenant
  const handleRejectTenant = async () => {
    if (!selectedTenant) return;

    try {
      const supabaseClient = getAuthenticatedSupabase();
      
      // Update tenant to rejected (approved = false)
      const { error } = await supabaseClient
        .from('users')
        .update({ approved: false })
        .eq('id', selectedTenant.id);

      if (error) {
        console.error('Update error details:', error);
        throw error;
      }

      // Refresh tenants list
      const { data: userData } = await supabaseClient.auth.getUser();
      
      if (!userData.user) {
        throw new Error('User not found');
      }

      const { data: pmData, error: pmError } = await supabaseClient
        .from('users')
        .select('property_id')
        .eq('id', userData.user.id)
        .eq('role', 'pm')
        .single();

      if (pmError) throw pmError;
      
      const { data: tenantsData, error: tenantsError } = await supabaseClient
        .from('users')
        .select('id, name, email, role, approved, created_at')
        .eq('property_id', pmData.property_id)
        .eq('role', 'tenant')
        .order('created_at', { ascending: false });

      if (tenantsError) throw tenantsError;

      const transformedData: Tenant[] = tenantsData.map((t: any) => ({
        id: t.id,
        name: t.name,
        email: t.email,
        role: t.role,
        approved: t.approved,
        created_at: t.created_at,
      }));

      setTenants(transformedData);
      setConfirmModalOpen(false);
      setSelectedTenant(null);
      setConfirmAction(null);
    } catch (err: any) {
      console.error('Error rejecting tenant:', err);
      alert('Failed to reject tenant. Please try again.');
    }
  };

  // Close confirmation modal
  const handleCloseModal = () => {
    setConfirmModalOpen(false);
    setSelectedTenant(null);
    setConfirmAction(null);
  };

  // Format date
  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Users</h1>

      {/* Search and Filters */}
      <div className="mb-6 space-y-4">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search tenants..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          />
        </div>

        {/* Filters */}
        <div className="flex gap-4">
          <div className="relative flex-1">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="appearance-none w-full bg-white border border-gray-300 rounded-lg px-4 py-2 pr-8 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            >
              <option value="All">Status: All</option>
              <option value="Approved">Approved</option>
              <option value="Pending">Pending</option>
            </select>
            <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Tenants Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loadingTenants ? (
          <div className="text-center py-12">
            <div className="w-12 h-12 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-500">Loading tenants...</p>
          </div>
        ) : errorTenants ? (
          <div className="text-center py-12">
            <p className="text-red-500">{errorTenants}</p>
          </div>
        ) : filteredTenants.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">
              {tenants.length === 0 ? 'No tenants found' : 'No tenants match your filters'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left py-4 px-6 text-xs font-semibold text-gray-500 uppercase">Tenant</th>
                  <th className="text-left py-4 px-6 text-xs font-semibold text-gray-500 uppercase">Email</th>
                  <th className="text-left py-4 px-6 text-xs font-semibold text-gray-500 uppercase">Status</th>
                  <th className="text-left py-4 px-6 text-xs font-semibold text-gray-500 uppercase">Date Added</th>
                  <th className="text-left py-4 px-6 text-xs font-semibold text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredTenants.map((tenant) => (
                  <tr key={tenant.id} className="hover:bg-gray-50">
                    <td className="py-4 px-6">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center mr-3">
                          <UserIcon className="w-5 h-5 text-teal-600" />
                        </div>
                        <div className="text-sm font-medium text-gray-900">
                          {tenant.name || 'N/A'}
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-sm text-gray-600">
                      <div className="flex items-center">
                        <Mail className="w-4 h-4 mr-2 text-gray-400" />
                        {tenant.email || 'N/A'}
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      {tenant.approved ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-md text-xs font-medium">
                          <Check className="w-3 h-3" />
                          Approved
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 rounded-md text-xs font-medium">
                          <Calendar className="w-3 h-3" />
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-sm text-gray-600">
                      {formatDate(tenant.created_at)}
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex gap-2">
                        {!tenant.approved ? (
                          <>
                            <button 
                              onClick={() => handleApproveClick(tenant)}
                              className="inline-flex items-center gap-1 text-xs px-3 py-1 bg-green-600 text-white hover:bg-green-700 rounded transition-colors"
                            >
                              <Check className="w-3 h-3" />
                              Approve
                            </button>
                            <button 
                              onClick={() => handleRejectClick(tenant)}
                              className="inline-flex items-center gap-1 text-xs px-3 py-1 bg-red-600 text-white hover:bg-red-700 rounded transition-colors"
                            >
                              <XIcon className="w-3 h-3" />
                              Reject
                            </button>
                          </>
                        ) : (
                          <button 
                            onClick={() => handleRejectClick(tenant)}
                            className="inline-flex items-center gap-1 text-xs px-3 py-1 bg-red-600 text-white hover:bg-red-700 rounded transition-colors"
                          >
                            <XIcon className="w-3 h-3" />
                            Revoke
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {confirmModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full mx-4 p-6">
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">
                {confirmAction === 'approve' ? 'Approve Tenant' : 'Reject Tenant'}
              </h2>
              <button
                onClick={handleCloseModal}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="mb-6">
              <p className="text-gray-700 mb-4">
                {confirmAction === 'approve' 
                  ? 'Are you sure you want to approve this tenant? They will have access to the system.'
                  : 'Are you sure you want to reject this tenant? They will not have access to the system.'
                }
              </p>
              {selectedTenant && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center mb-2">
                    <UserIcon className="w-5 h-5 text-teal-600 mr-2" />
                    <span className="font-medium text-gray-900">
                      {selectedTenant.name || 'N/A'}
                    </span>
                  </div>
                  <div className="flex items-center">
                    <Mail className="w-4 h-4 text-gray-400 mr-2" />
                    <span className="text-sm text-gray-600">
                      {selectedTenant.email || 'N/A'}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex gap-3">
              <button
                onClick={handleCloseModal}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmAction === 'approve' ? handleApproveTenant : handleRejectTenant}
                className={`flex-1 px-4 py-2 text-white rounded-lg transition-colors ${
                  confirmAction === 'approve'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {confirmAction === 'approve' ? (
                  <>
                    <Check className="w-4 h-4 inline mr-2" />
                    Approve
                  </>
                ) : (
                  <>
                    <XIcon className="w-4 h-4 inline mr-2" />
                    Reject
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Users;