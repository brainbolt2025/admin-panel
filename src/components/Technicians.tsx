import { useState, useEffect, useCallback } from 'react';
import { Search, Wrench, Mail, Check, X as XIcon, Calendar, ChevronDown } from 'lucide-react';
import { getAuthenticatedSupabase } from '../lib/supabase';
import { config } from '../config';
import { usePendingWorkOrders } from '../context/PendingWorkOrdersContext';

interface Technician {
  id: string;
  name: string | null;
  email: string | null;
  role: string | null;
  approved: boolean | null;
  created_at?: string;
}

const Technicians = () => {
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

  // State for technicians
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [loadingTechnicians, setLoadingTechnicians] = useState(false);
  const [errorTechnicians, setErrorTechnicians] = useState<string | null>(null);

  // State for search
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  // State for confirmation modal
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'approve' | 'reject' | null>(null);
  const [selectedTechnician, setSelectedTechnician] = useState<Technician | null>(null);

  const { setPendingTechniciansCount, refreshPendingTechniciansCount } = usePendingWorkOrders();

  const fetchTechnicians = useCallback(async () => {
    if (!isPM) {
      setPendingTechniciansCount(0);
      return;
    }

    setLoadingTechnicians(true);
    setErrorTechnicians(null);

    try {
      const supabaseClient = getAuthenticatedSupabase();
      
      console.log('Fetching technicians for PM...');
      
      // Get PM's property_id
      const { data: userData } = await supabaseClient.auth.getUser();
      
      if (!userData.user) {
        throw new Error('User not found');
      }

      const { data: pmData, error: pmError } = await supabaseClient
        .from('users')
        .select('property_id, name, property_name')
        .eq('id', userData.user.id)
        .eq('role', 'pm')
        .single();

      if (pmError) throw pmError;
      if (!pmData?.property_id) {
        console.log('No property assigned to PM');
        setTechnicians([]);
        return;
      }

      // Fetch all technicians from the same property
      const { data: techniciansData, error: techniciansError } = await supabaseClient
        .from('users')
        .select('id, name, email, role, approved, created_at')
        .eq('property_id', pmData.property_id)
        .eq('role', 'technician')
        .order('created_at', { ascending: false });

      if (techniciansError) throw techniciansError;

      console.log('Technicians fetched:', techniciansData);

      if (!techniciansData || techniciansData.length === 0) {
        console.log('No technicians found in database');
        setTechnicians([]);
        setPendingTechniciansCount(0);
        return;
      }

      const transformedData: Technician[] = techniciansData.map((technician: any) => ({
        id: technician.id,
        name: technician.name,
        email: technician.email,
        role: technician.role,
        approved: technician.approved,
        created_at: technician.created_at,
      }));

      setTechnicians(transformedData);
      const pendingCount = transformedData.filter((tech) => !tech.approved).length;
      setPendingTechniciansCount(pendingCount);
    } catch (err: any) {
      console.error('Error fetching technicians:', err);
      setErrorTechnicians(err.message || 'Failed to load technicians');
    } finally {
      setLoadingTechnicians(false);
    }
  }, [isPM, setPendingTechniciansCount]);

  // Fetch technicians from database
  useEffect(() => {
    if (!isPM) return; // Only fetch for PM users
    fetchTechnicians();
  }, [isPM, fetchTechnicians]);

  // Filter technicians based on search
  const filteredTechnicians = technicians.filter((technician) => {
    const matchesSearch = 
      technician.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      technician.email?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'All' || 
      (statusFilter === 'Approved' && technician.approved) ||
      (statusFilter === 'Pending' && !technician.approved);
    
    return matchesSearch && matchesStatus;
  });

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

  const handleApproveClick = (technician: Technician) => {
    setSelectedTechnician(technician);
    setConfirmAction('approve');
    setConfirmModalOpen(true);
  };

  const handleRejectClick = (technician: Technician) => {
    setSelectedTechnician(technician);
    setConfirmAction('reject');
    setConfirmModalOpen(true);
  };

  const handleApproveTechnician = async () => {
    if (!selectedTechnician) return;

    try {
      const supabaseClient = getAuthenticatedSupabase();

      const { error } = await supabaseClient
        .from('users')
        .update({ approved: true })
        .eq('id', selectedTechnician.id);

      if (error) {
        console.error('Update error details:', error);
        throw error;
      }

      await fetchTechnicians();
      await refreshPendingTechniciansCount();

      const { data: userData } = await supabaseClient.auth.getUser();

      if (userData.user) {
        const { data: pmData, error: pmError } = await supabaseClient
          .from('users')
          .select('property_id, property_name, name')
          .eq('id', userData.user.id)
          .eq('role', 'pm')
          .single();

        if (pmError) {
          console.error('Error fetching PM info for technician approval email:', pmError);
        } else if (selectedTechnician.email) {
          try {
            const accessToken = localStorage.getItem('access_token');
            const response = await fetch(
              `${config.supabase.url}/functions/v1/notify-technician-approval`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: accessToken
                    ? `Bearer ${accessToken}`
                    : `Bearer ${config.supabase.anonKey}`,
                  apikey: config.supabase.anonKey,
                },
                body: JSON.stringify({
                  email: selectedTechnician.email,
                  name: selectedTechnician.name || undefined,
                  propertyName: pmData?.property_name || undefined,
                  approvedBy: pmData?.name || undefined,
                }),
              }
            );

            if (!response.ok) {
              const errorData = await response.json().catch(() => ({}));
              console.error('Failed to send technician approval email:', errorData);
            }
          } catch (emailError) {
            console.error('Error calling notify-technician-approval function:', emailError);
          }
        }
      }

      setConfirmModalOpen(false);
      setSelectedTechnician(null);
      setConfirmAction(null);
    } catch (err: any) {
      console.error('Error approving technician:', err);
      alert('Failed to approve technician. Please try again.');
    }
  };

  const handleRejectTechnician = async () => {
    if (!selectedTechnician) return;

    try {
      const supabaseClient = getAuthenticatedSupabase();

      const { error } = await supabaseClient
        .from('users')
        .update({ approved: false })
        .eq('id', selectedTechnician.id);

      if (error) {
        console.error('Update error details:', error);
        throw error;
      }

      await fetchTechnicians();
      await refreshPendingTechniciansCount();
      setConfirmModalOpen(false);
      setSelectedTechnician(null);
      setConfirmAction(null);
    } catch (err: any) {
      console.error('Error updating technician approval:', err);
      alert('Failed to update technician approval. Please try again.');
    }
  };

  const handleCloseModal = () => {
    setConfirmModalOpen(false);
    setSelectedTechnician(null);
    setConfirmAction(null);
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Technicians</h1>

      {/* Search and Filters */}
      <div className="mb-6 space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search technicians..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          />
        </div>

        {/* Filters */}
        <div className="flex gap-4">
          <div className="relative flex-1 max-w-xs">
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

      {/* Technicians Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loadingTechnicians ? (
          <div className="text-center py-12">
            <div className="w-12 h-12 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-500">Loading technicians...</p>
          </div>
        ) : errorTechnicians ? (
          <div className="text-center py-12">
            <p className="text-red-500">{errorTechnicians}</p>
          </div>
        ) : filteredTechnicians.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">
              {technicians.length === 0 ? 'No technicians found' : 'No technicians match your filters'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left py-4 px-6 text-xs font-semibold text-gray-500 uppercase">Technician</th>
                  <th className="text-left py-4 px-6 text-xs font-semibold text-gray-500 uppercase">Email</th>
                  <th className="text-left py-4 px-6 text-xs font-semibold text-gray-500 uppercase">Status</th>
                  <th className="text-left py-4 px-6 text-xs font-semibold text-gray-500 uppercase">Date Added</th>
                  <th className="text-left py-4 px-6 text-xs font-semibold text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredTechnicians.map((technician) => (
                  <tr key={technician.id} className="hover:bg-gray-50">
                    <td className="py-4 px-6">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center mr-3">
                          <Wrench className="w-5 h-5 text-teal-600" />
                        </div>
                        <div className="text-sm font-medium text-gray-900">
                          {technician.name || 'N/A'}
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-sm text-gray-600">
                      <div className="flex items-center">
                        <Mail className="w-4 h-4 mr-2 text-gray-400" />
                        {technician.email || 'N/A'}
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      {technician.approved ? (
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
                      {formatDate(technician.created_at)}
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex gap-2">
                        {!technician.approved ? (
                          <>
                            <button
                              onClick={() => handleApproveClick(technician)}
                              className="inline-flex items-center gap-1 text-xs px-3 py-1 bg-green-600 text-white hover:bg-green-700 rounded transition-colors"
                            >
                              <Check className="w-3 h-3" />
                              Approve
                            </button>
                            <button
                              onClick={() => handleRejectClick(technician)}
                              className="inline-flex items-center gap-1 text-xs px-3 py-1 bg-red-600 text-white hover:bg-red-700 rounded transition-colors"
                            >
                              <XIcon className="w-3 h-3" />
                              Reject
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => handleRejectClick(technician)}
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
                {confirmAction === 'approve' ? 'Approve Technician' : 'Reject Technician'}
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
                  ? 'Approve this technician so they can start receiving assignments.'
                  : 'Rejecting will prevent this technician from being assigned work orders.'}
              </p>
              {selectedTechnician && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center mb-2">
                    <Wrench className="w-5 h-5 text-teal-600 mr-2" />
                    <span className="font-medium text-gray-900">
                      {selectedTechnician.name || 'N/A'}
                    </span>
                  </div>
                  <div className="flex items-center">
                    <Mail className="w-4 h-4 text-gray-400 mr-2" />
                    <span className="text-sm text-gray-600">
                      {selectedTechnician.email || 'N/A'}
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
                onClick={confirmAction === 'approve' ? handleApproveTechnician : handleRejectTechnician}
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

export default Technicians;
