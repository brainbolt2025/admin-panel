import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, ChevronDown, Check, X as XIcon, User as UserIcon, Users as UsersIcon, Mail, Calendar, Camera, Info, MapPin, Shield, Clock, Bell, UserPlus } from 'lucide-react';
import { getAuthenticatedSupabase } from '../lib/supabase';
import { config } from '../config';
import InviteNewTenants from './InviteNewTenants';
import tenantsEmpty from '../assets/tenants-empty.png';
import { queryKeys } from '../lib/queryKeys';
import { fetchTenantsQuery } from '../lib/pmQueries';
import { invalidateTenantsData } from '../lib/invalidatePmData';
import {
  APPROVAL_STATUS,
  isApproved,
  isPending,
  isRejected,
  normalizeApprovalStatus,
  type ApprovalStatus,
} from '../lib/approvalStatus';
import { toUserFacingError } from '../lib/userFacingError';

const PROFILE_PICTURES_BUCKET = 'profile-pictures';

interface Tenant {
  id: string;
  name: string | null;
  email: string | null;
  role: string | null;
  approved: ApprovalStatus;
  created_at?: string;
  profile_picture_url?: string | null;
  unit_number?: string | null;
  property_name?: string | null;
  email_verified?: boolean | null;
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
        if (user.profile?.role) {
          return user.profile.role;
        }
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
  const queryClient = useQueryClient();

  const {
    data: tenantsData,
    isLoading: loadingTenants,
    error: tenantsQueryError,
  } = useQuery({
    queryKey: queryKeys.tenants,
    queryFn: fetchTenantsQuery,
    enabled: isPM,
  });

  const tenants = tenantsData?.tenants ?? [];
  const [profilePictureUrls, setProfilePictureUrls] = useState<Record<string, string>>({});
  const errorTenants = tenantsQueryError
    ? toUserFacingError(tenantsQueryError, 'Unable to load tenants. Please try again.')
    : null;

  useEffect(() => {
    if (tenantsData?.profilePictureUrls) {
      setProfilePictureUrls(tenantsData.profilePictureUrls);
    }
  }, [tenantsData?.profilePictureUrls]);

  // State for search and filters
  const [searchTerm, setSearchTerm] = useState(selectedTenantFilter || '');
  const [statusFilter, setStatusFilter] = useState('All');

  // State for confirmation modal
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'approve' | 'reject' | null>(null);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);

  // State for details modal
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [tenantDetails, setTenantDetails] = useState<Tenant | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // State for profile picture upload
  const [uploadingProfilePicture, setUploadingProfilePicture] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State for invite new tenants form
  const [showInviteNewTenants, setShowInviteNewTenants] = useState(false);

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

  // Filter tenants based on search and filters
  const filteredTenants = tenants
    .filter((tenant) => {
      const matchesSearch = 
        tenant.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tenant.email?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'All' || 
        (statusFilter === 'Approved' && isApproved(tenant.approved)) ||
        (statusFilter === 'Pending' && isPending(tenant.approved)) ||
        (statusFilter === 'Rejected' && isRejected(tenant.approved));

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
        .update({ approved: APPROVAL_STATUS.approved })
        .eq('id', selectedTenant.id);

      if (error) {
        console.error('Update error details:', error);
        throw error;
      }

      const { data: userData } = await supabaseClient.auth.getUser();
      if (!userData.user) {
        throw new Error('User not found');
      }

      const { data: pmData, error: pmError } = await supabaseClient
        .from('users')
        .select('property_id, property_name, name')
        .eq('id', userData.user.id)
        .eq('role', 'pm')
        .single();

      if (pmError) throw pmError;

      invalidateTenantsData(queryClient);
      setConfirmModalOpen(false);
      setSelectedTenant(null);
      setConfirmAction(null);

      if (selectedTenant.email) {
        try {
          const accessToken = localStorage.getItem('access_token');
          const response = await fetch(
            `${config.supabase.url}/functions/v1/notify-tenant-approval`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': accessToken ? `Bearer ${accessToken}` : `Bearer ${config.supabase.anonKey}`,
                'apikey': config.supabase.anonKey,
              },
              body: JSON.stringify({
                email: selectedTenant.email,
                name: selectedTenant.name || undefined,
                propertyName: pmData?.property_name || undefined,
                approvedBy: pmData?.name || undefined,
              }),
            }
          );

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('Failed to send tenant approval email:', errorData);
          }
        } catch (emailError) {
          console.error('Error calling notify-tenant-approval function:', emailError);
        }
      }
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
      
      // Update tenant to rejected
      const { error } = await supabaseClient
        .from('users')
        .update({ approved: APPROVAL_STATUS.rejected })
        .eq('id', selectedTenant.id);

      if (error) {
        console.error('Update error details:', error);
        throw error;
      }

      invalidateTenantsData(queryClient);
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

  // Handle profile picture upload
  const handleProfilePictureUpload = async (tenantId: string, file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('Image size must be less than 5MB');
      return;
    }

    setUploadingProfilePicture(tenantId);

    try {
      const supabaseClient = getAuthenticatedSupabase();
      
      // Generate unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `tenant_${tenantId}_${Date.now()}.${fileExt}`;
      const filePath = fileName;

      // Upload to storage
      const { error: uploadError } = await supabaseClient.storage
        .from(PROFILE_PICTURES_BUCKET)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        throw uploadError;
      }

      // Update user record with profile picture URL
      const { error: updateError } = await supabaseClient
        .from('users')
        .update({ profile_picture_url: filePath })
        .eq('id', tenantId);

      if (updateError) {
        throw updateError;
      }

      // Get signed URL for the new image
      const { data: signedData, error: signedError } = await supabaseClient.storage
        .from(PROFILE_PICTURES_BUCKET)
        .createSignedUrl(filePath, 60 * 60 * 24);

      if (!signedError && signedData?.signedUrl) {
        setProfilePictureUrls((prev) => ({
          ...prev,
          [tenantId]: signedData.signedUrl,
        }));
      }

      invalidateTenantsData(queryClient);
    } catch (err: any) {
      console.error('Error uploading profile picture:', err);
      alert('Failed to upload profile picture. Please try again.');
    } finally {
      setUploadingProfilePicture(null);
    }
  };

  // Handle file input change
  const handleFileInputChange = (tenantId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleProfilePictureUpload(tenantId, file);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Handle view details
  const handleViewDetails = async (tenant: Tenant) => {
    setLoadingDetails(true);
    setDetailsModalOpen(true);
    
    try {
      const supabaseClient = getAuthenticatedSupabase();
      
      // Fetch full tenant details
      const { data: tenantData, error } = await supabaseClient
        .from('users')
        .select('id, name, email, role, approved, created_at, profile_picture_url, unit_number, property_name, email_verified')
        .eq('id', tenant.id)
        .single();

      if (error) throw error;

      const fullTenant: Tenant = {
        id: tenantData.id,
        name: tenantData.name,
        email: tenantData.email,
        role: tenantData.role,
        approved: normalizeApprovalStatus(tenantData.approved),
        created_at: tenantData.created_at,
        profile_picture_url: tenantData.profile_picture_url,
        unit_number: tenantData.unit_number,
        property_name: tenantData.property_name,
        email_verified: tenantData.email_verified,
      };

      // Get profile picture URL if available
      if (fullTenant.profile_picture_url) {
        try {
          const { data: signedData, error: signedError } = await supabaseClient.storage
            .from(PROFILE_PICTURES_BUCKET)
            .createSignedUrl(fullTenant.profile_picture_url, 60 * 60 * 24);

          if (!signedError && signedData?.signedUrl) {
            setProfilePictureUrls((prev) => ({
              ...prev,
              [fullTenant.id]: signedData.signedUrl,
            }));
          }
        } catch (err) {
          console.error('Error fetching profile picture:', err);
        }
      }

      setTenantDetails(fullTenant);
    } catch (err: any) {
      console.error('Error fetching tenant details:', err);
      alert('Failed to load tenant details. Please try again.');
      setDetailsModalOpen(false);
    } finally {
      setLoadingDetails(false);
    }
  };

  // Format date
  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Format date for details (full format)
  const formatDateFull = (dateString: string | undefined) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const pendingCount = tenants.filter((tenant) => isPending(tenant.approved)).length;

  // Show invite form if state is set
  if (showInviteNewTenants) {
    return <InviteNewTenants onBack={() => setShowInviteNewTenants(false)} />;
  }

  return (
    <div className="p-6">
      <div className="relative overflow-hidden bg-white rounded-xl shadow-sm">
        {/* Decorative blobs */}
        <div className="pointer-events-none absolute -top-10 -right-10 w-52 h-52 bg-teal-100/40 rounded-full blur-3xl" />
        <div className="pointer-events-none absolute -bottom-12 -left-12 w-60 h-60 bg-teal-100/30 rounded-full blur-3xl" />
        <div
          className="pointer-events-none absolute top-8 right-10 w-28 h-16 opacity-40"
          style={{ backgroundImage: 'radial-gradient(#99f6e4 1.5px, transparent 1.5px)', backgroundSize: '10px 10px' }}
        />
        <div
          className="pointer-events-none absolute bottom-8 left-10 w-28 h-16 opacity-40"
          style={{ backgroundImage: 'radial-gradient(#99f6e4 1.5px, transparent 1.5px)', backgroundSize: '10px 10px' }}
        />

        {/* Topbar - Search and Alerts */}
        <div className="relative flex items-center justify-between gap-4 px-6 py-4">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search all tenants, properties, or lease IDs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 bg-gray-50 border-0 rounded-full text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition-colors"
            />
          </div>

          {isPM && (
            <div className="flex items-center space-x-2 shrink-0">
              <div className="relative p-2 rounded-lg hover:bg-gray-100 cursor-pointer">
                <Bell className="w-5 h-5 text-gray-600" />
                {pendingCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-teal-600 text-white text-[10px] font-semibold rounded-full">
                    {pendingCount}
                  </span>
                )}
              </div>
              <span className="hidden sm:block text-sm font-medium text-gray-600">Alerts</span>
            </div>
          )}
        </div>

        {/* Content Section */}
        <div className="relative px-6 pb-6">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <UsersIcon className="w-6 h-6 text-teal-600" />
              <h1 className="text-2xl font-bold text-gray-900">Tenants</h1>
            </div>
            {isPM && (
              <button
                onClick={() => setShowInviteNewTenants(true)}
                className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
              >
                <UserPlus className="w-4 h-4" />
                Invite New Tenants
              </button>
            )}
          </div>

          {/* Status Filter */}
          <div className="mb-6 flex items-center gap-2">
            <span className="text-sm text-gray-500">Status:</span>
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className={`appearance-none rounded-lg px-4 py-1.5 pr-8 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-500 ${
                  statusFilter === 'All'
                    ? 'bg-teal-600 text-white border border-teal-600'
                    : 'bg-white border border-gray-300 text-gray-700'
                }`}
              >
                <option value="All">All</option>
                <option value="Approved">Approved</option>
                <option value="Pending">Pending</option>
                <option value="Rejected">Rejected</option>
              </select>
              <ChevronDown
                className={`absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${
                  statusFilter === 'All' ? 'text-white' : 'text-gray-400'
                }`}
              />
            </div>
          </div>

          {/* Tenants Table */}
          <div className="overflow-hidden">
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
          tenants.length === 0 ? (
            <div className="relative overflow-hidden py-12 px-6 text-center">
              <div className="relative max-w-lg mx-auto">
                <img
                  src={tenantsEmpty}
                  alt="No tenants"
                  className="w-44 h-auto mx-auto mb-5"
                />
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  It looks like you don&apos;t have any tenants yet!
                </h3>
                <p className="text-gray-500">
                  Start by inviting new tenants or checking your filters. If you believe this is an error, please contact support.
                </p>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500">No tenants match your filters</p>
            </div>
          )
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
                        <div className="relative group">
                          {profilePictureUrls[tenant.id] ? (
                            <img
                              src={profilePictureUrls[tenant.id]}
                              alt={tenant.name || 'Tenant'}
                              className="w-10 h-10 rounded-full object-cover mr-3"
                            />
                          ) : (
                            <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center mr-3">
                              <UserIcon className="w-5 h-5 text-teal-600" />
                            </div>
                          )}
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => handleFileInputChange(tenant.id, e)}
                            id={`profile-upload-${tenant.id}`}
                          />
                          <label
                            htmlFor={`profile-upload-${tenant.id}`}
                            className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-0 group-hover:bg-opacity-50 rounded-full cursor-pointer transition-opacity opacity-0 group-hover:opacity-100"
                            title="Upload profile picture"
                          >
                            {uploadingProfilePicture === tenant.id ? (
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                              <Camera className="w-4 h-4 text-white" />
                            )}
                          </label>
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
                      {isApproved(tenant.approved) ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-md text-xs font-medium">
                          <Check className="w-3 h-3" />
                          Approved
                        </span>
                      ) : isRejected(tenant.approved) ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-md text-xs font-medium">
                          <XIcon className="w-3 h-3" />
                          Rejected
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
                        <button 
                          onClick={() => handleViewDetails(tenant)}
                          className="inline-flex items-center gap-1 text-xs px-3 py-1 bg-blue-600 text-white hover:bg-blue-700 rounded transition-colors"
                        >
                          <Info className="w-3 h-3" />
                          Details
                        </button>
                        {isPending(tenant.approved) ? (
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
                        ) : isApproved(tenant.approved) ? (
                          <button 
                            onClick={() => handleRejectClick(tenant)}
                            className="inline-flex items-center gap-1 text-xs px-3 py-1 bg-red-600 text-white hover:bg-red-700 rounded transition-colors"
                          >
                            <XIcon className="w-3 h-3" />
                            Revoke
                          </button>
                        ) : (
                          <button 
                            onClick={() => handleApproveClick(tenant)}
                            className="inline-flex items-center gap-1 text-xs px-3 py-1 bg-green-600 text-white hover:bg-green-700 rounded transition-colors"
                          >
                            <Check className="w-3 h-3" />
                            Approve
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

      {/* Details Modal */}
      {detailsModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {loadingDetails ? (
              <div className="p-12 text-center">
                <div className="w-12 h-12 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-500">Loading details...</p>
              </div>
            ) : tenantDetails ? (
              <>
                {/* Modal Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                  <h2 className="text-2xl font-bold text-gray-900">Tenant Details</h2>
                  <button
                    onClick={() => {
                      setDetailsModalOpen(false);
                      setTenantDetails(null);
                    }}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <XIcon className="w-6 h-6" />
                  </button>
                </div>

                {/* Modal Content */}
                <div className="p-6">
                  <div className="flex flex-col md:flex-row gap-6 mb-6">
                    {/* Profile Picture */}
                    <div className="flex-shrink-0">
                      {profilePictureUrls[tenantDetails.id] ? (
                        <img
                          src={profilePictureUrls[tenantDetails.id]}
                          alt={tenantDetails.name || 'Tenant'}
                          className="w-32 h-32 rounded-full object-cover border-4 border-teal-100"
                        />
                      ) : (
                        <div className="w-32 h-32 bg-teal-100 rounded-full flex items-center justify-center border-4 border-teal-200">
                          <UserIcon className="w-16 h-16 text-teal-600" />
                        </div>
                      )}
                    </div>

                    {/* Basic Info */}
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold text-gray-900 mb-2">
                        {tenantDetails.name || 'N/A'}
                      </h3>
                      <div className="space-y-2">
                        <div className="flex items-center text-gray-600">
                          <Mail className="w-4 h-4 mr-2 text-gray-400" />
                          <span>{tenantDetails.email || 'N/A'}</span>
                          {tenantDetails.email_verified && (
                            <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded">
                              Verified
                            </span>
                          )}
                        </div>
                        <div className="flex items-center text-gray-600">
                          <Shield className="w-4 h-4 mr-2 text-gray-400" />
                          <span className="capitalize">{tenantDetails.role || 'N/A'}</span>
                        </div>
                        <div className="flex items-center">
                          {isApproved(tenantDetails.approved) ? (
                            <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-md text-sm font-medium">
                              <Check className="w-4 h-4" />
                              Approved
                            </span>
                          ) : isRejected(tenantDetails.approved) ? (
                            <span className="inline-flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 rounded-md text-sm font-medium">
                              <XIcon className="w-4 h-4" />
                              Rejected
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-3 py-1 bg-orange-100 text-orange-700 rounded-md text-sm font-medium">
                              <Calendar className="w-4 h-4" />
                              Pending Approval
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Detailed Information */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-6 border-t border-gray-200">
                    <div className="space-y-4">
                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
                          Unit Number
                        </label>
                        <div className="flex items-center text-gray-900">
                          <MapPin className="w-4 h-4 mr-2 text-gray-400" />
                          <span>{tenantDetails.unit_number || 'Not assigned'}</span>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
                          Property
                        </label>
                        <div className="flex items-center text-gray-900">
                          <MapPin className="w-4 h-4 mr-2 text-gray-400" />
                          <span>{tenantDetails.property_name || 'N/A'}</span>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
                          Account Created
                        </label>
                        <div className="flex items-center text-gray-900">
                          <Clock className="w-4 h-4 mr-2 text-gray-400" />
                          <span>{formatDateFull(tenantDetails.created_at)}</span>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
                          User ID
                        </label>
                        <div className="text-gray-900 font-mono text-sm break-all">
                          {tenantDetails.id}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
                  <button
                    onClick={() => {
                      setDetailsModalOpen(false);
                      setTenantDetails(null);
                    }}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Close
                  </button>
                  {!isApproved(tenantDetails.approved) && (
                    <button
                      onClick={() => {
                        setDetailsModalOpen(false);
                        handleApproveClick(tenantDetails);
                      }}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      <Check className="w-4 h-4 inline mr-2" />
                      Approve Tenant
                    </button>
                  )}
                  {!isRejected(tenantDetails.approved) && (
                    <button
                      onClick={() => {
                        setDetailsModalOpen(false);
                        handleRejectClick(tenantDetails);
                      }}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                    >
                      <XIcon className="w-4 h-4 inline mr-2" />
                      {isApproved(tenantDetails.approved) ? 'Revoke' : 'Reject'} Tenant
                    </button>
                  )}
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
        </div>
      </div>
    </div>
  );
};

export default Users;