import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Wrench, Mail, Check, X as XIcon, Calendar, ChevronDown, Camera, Info, MapPin, Shield, Clock, Bell } from 'lucide-react';
import { getAuthenticatedSupabase } from '../lib/supabase';
import { config } from '../config';
import { usePendingWorkOrders } from '../context/PendingWorkOrdersContext';

const PROFILE_PICTURES_BUCKET = 'profile-pictures';

interface Technician {
  id: string;
  name: string | null;
  email: string | null;
  role: string | null;
  approved: boolean | null;
  created_at?: string;
  profile_picture_url?: string | null;
  property_name?: string | null;
  email_verified?: boolean | null;
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

  // State for details modal
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [technicianDetails, setTechnicianDetails] = useState<Technician | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // State for profile picture upload
  const [uploadingProfilePicture, setUploadingProfilePicture] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [profilePictureUrls, setProfilePictureUrls] = useState<Record<string, string>>({});

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
        .select('id, name, email, role, approved, created_at, profile_picture_url, property_name, email_verified')
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
        profile_picture_url: technician.profile_picture_url,
        property_name: technician.property_name,
        email_verified: technician.email_verified,
      }));

      // Fetch profile picture URLs for technicians with profile pictures
      const urlsMap: Record<string, string> = {};
      await Promise.all(
        transformedData
          .filter((t) => t.profile_picture_url)
          .map(async (technician) => {
            try {
              const { data: signedData, error: signedError } = await supabaseClient.storage
                .from(PROFILE_PICTURES_BUCKET)
                .createSignedUrl(technician.profile_picture_url!, 60 * 60 * 24); // 24 hours

              if (!signedError && signedData?.signedUrl) {
                urlsMap[technician.id] = signedData.signedUrl;
              }
            } catch (err) {
              console.error(`Error fetching profile picture for technician ${technician.id}:`, err);
            }
          })
      );
      setProfilePictureUrls(urlsMap);
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

  // Handle profile picture upload
  const handleProfilePictureUpload = async (technicianId: string, file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('Image size must be less than 5MB');
      return;
    }

    setUploadingProfilePicture(technicianId);

    try {
      const supabaseClient = getAuthenticatedSupabase();
      
      // Generate unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `technician_${technicianId}_${Date.now()}.${fileExt}`;
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
        .eq('id', technicianId);

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
          [technicianId]: signedData.signedUrl,
        }));
      }

      // Refresh technicians list
      await fetchTechnicians();
    } catch (err: any) {
      console.error('Error uploading profile picture:', err);
      alert('Failed to upload profile picture. Please try again.');
    } finally {
      setUploadingProfilePicture(null);
    }
  };

  // Handle file input change
  const handleFileInputChange = (technicianId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleProfilePictureUpload(technicianId, file);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Handle view details
  const handleViewDetails = async (technician: Technician) => {
    setLoadingDetails(true);
    setDetailsModalOpen(true);
    
    try {
      const supabaseClient = getAuthenticatedSupabase();
      
      // Fetch full technician details
      const { data: technicianData, error } = await supabaseClient
        .from('users')
        .select('id, name, email, role, approved, created_at, profile_picture_url, property_name, email_verified')
        .eq('id', technician.id)
        .single();

      if (error) throw error;

      const fullTechnician: Technician = {
        id: technicianData.id,
        name: technicianData.name,
        email: technicianData.email,
        role: technicianData.role,
        approved: technicianData.approved,
        created_at: technicianData.created_at,
        profile_picture_url: technicianData.profile_picture_url,
        property_name: technicianData.property_name,
        email_verified: technicianData.email_verified,
      };

      // Get profile picture URL if available
      if (fullTechnician.profile_picture_url) {
        try {
          const { data: signedData, error: signedError } = await supabaseClient.storage
            .from(PROFILE_PICTURES_BUCKET)
            .createSignedUrl(fullTechnician.profile_picture_url, 60 * 60 * 24);

          if (!signedError && signedData?.signedUrl) {
            setProfilePictureUrls((prev) => ({
              ...prev,
              [fullTechnician.id]: signedData.signedUrl,
            }));
          }
        } catch (err) {
          console.error('Error fetching profile picture:', err);
        }
      }

      setTechnicianDetails(fullTechnician);
    } catch (err: any) {
      console.error('Error fetching technician details:', err);
      alert('Failed to load technician details. Please try again.');
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
      day: 'numeric' 
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

      // Send approval email
      if (!selectedTechnician.email) {
        console.warn('Technician has no email address, cannot send approval email');
        setConfirmModalOpen(false);
        setSelectedTechnician(null);
        setConfirmAction(null);
        return;
      }

      try {
        const { data: userData } = await supabaseClient.auth.getUser();

        if (!userData.user) {
          console.error('User not found, cannot send approval email');
          setConfirmModalOpen(false);
          setSelectedTechnician(null);
          setConfirmAction(null);
          return;
        }

        const { data: pmData, error: pmError } = await supabaseClient
          .from('users')
          .select('property_id, property_name, name')
          .eq('id', userData.user.id)
          .eq('role', 'pm')
          .single();

        if (pmError) {
          console.error('Error fetching PM info for technician approval email:', pmError);
          // Continue anyway with undefined values
        }

        console.log('Sending approval email to:', selectedTechnician.email);
        console.log('Email data:', {
          email: selectedTechnician.email,
          name: selectedTechnician.name,
          propertyName: pmData?.property_name,
          approvedBy: pmData?.name,
        });

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

        const responseData = await response.json().catch(() => ({}));
        console.log('Email service response:', response.status, responseData);

        if (!response.ok) {
          console.error('Failed to send technician approval email:', responseData);
          // Don't fail the approval if email fails, but log it
        } else {
          console.log('Technician approval email sent successfully');
        }
      } catch (emailError) {
        console.error('Error calling notify-technician-approval function:', emailError);
        // Don't fail the approval if email fails
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
      <div className="bg-white rounded-xl shadow-sm">
        {/* Topbar - Search and Alerts */}
        <div className="flex items-center justify-between px-6 py-4">
          {/* Left side - Search */}
          <div className="flex items-center space-x-4 flex-1">
            <div className="relative flex-1 max-w-md">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search technicians..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 bg-gray-50 border-0 rounded-full text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition-colors"
              />
            </div>
          </div>

          {/* Right side - Alerts (for PM only) */}
          {isPM && (
            <div className="flex items-center space-x-2">
              <div className="relative p-2 rounded-lg hover:bg-gray-100 cursor-pointer">
                <Bell className="w-4 h-4 text-gray-600" />
              </div>
              <span className="hidden sm:block text-sm font-medium text-gray-600">Alerts</span>
            </div>
          )}
        </div>

        {/* Content Section */}
        <div className="px-6 pb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Technicians</h1>

          {/* Filters */}
          <div className="mb-6 space-y-4">
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
          <div className="overflow-hidden">
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
                        <div className="relative group">
                          {profilePictureUrls[technician.id] ? (
                            <img
                              src={profilePictureUrls[technician.id]}
                              alt={technician.name || 'Technician'}
                              className="w-10 h-10 rounded-full object-cover mr-3"
                            />
                          ) : (
                            <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center mr-3">
                              <Wrench className="w-5 h-5 text-teal-600" />
                            </div>
                          )}
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => handleFileInputChange(technician.id, e)}
                            id={`profile-upload-${technician.id}`}
                          />
                          <label
                            htmlFor={`profile-upload-${technician.id}`}
                            className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-0 group-hover:bg-opacity-50 rounded-full cursor-pointer transition-opacity opacity-0 group-hover:opacity-100"
                            title="Upload profile picture"
                          >
                            {uploadingProfilePicture === technician.id ? (
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                              <Camera className="w-4 h-4 text-white" />
                            )}
                          </label>
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
                        <button 
                          onClick={() => handleViewDetails(technician)}
                          className="inline-flex items-center gap-1 text-xs px-3 py-1 bg-blue-600 text-white hover:bg-blue-700 rounded transition-colors"
                        >
                          <Info className="w-3 h-3" />
                          Details
                        </button>
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

      {/* Details Modal */}
      {detailsModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {loadingDetails ? (
              <div className="p-12 text-center">
                <div className="w-12 h-12 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-500">Loading details...</p>
              </div>
            ) : technicianDetails ? (
              <>
                {/* Modal Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                  <h2 className="text-2xl font-bold text-gray-900">Technician Details</h2>
                  <button
                    onClick={() => {
                      setDetailsModalOpen(false);
                      setTechnicianDetails(null);
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
                      {profilePictureUrls[technicianDetails.id] ? (
                        <img
                          src={profilePictureUrls[technicianDetails.id]}
                          alt={technicianDetails.name || 'Technician'}
                          className="w-32 h-32 rounded-full object-cover border-4 border-teal-100"
                        />
                      ) : (
                        <div className="w-32 h-32 bg-teal-100 rounded-full flex items-center justify-center border-4 border-teal-200">
                          <Wrench className="w-16 h-16 text-teal-600" />
                        </div>
                      )}
                    </div>

                    {/* Basic Info */}
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold text-gray-900 mb-2">
                        {technicianDetails.name || 'N/A'}
                      </h3>
                      <div className="space-y-2">
                        <div className="flex items-center text-gray-600">
                          <Mail className="w-4 h-4 mr-2 text-gray-400" />
                          <span>{technicianDetails.email || 'N/A'}</span>
                          {technicianDetails.email_verified && (
                            <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded">
                              Verified
                            </span>
                          )}
                        </div>
                        <div className="flex items-center text-gray-600">
                          <Shield className="w-4 h-4 mr-2 text-gray-400" />
                          <span className="capitalize">{technicianDetails.role || 'N/A'}</span>
                        </div>
                        <div className="flex items-center">
                          {technicianDetails.approved ? (
                            <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-md text-sm font-medium">
                              <Check className="w-4 h-4" />
                              Approved
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
                          Property
                        </label>
                        <div className="flex items-center text-gray-900">
                          <MapPin className="w-4 h-4 mr-2 text-gray-400" />
                          <span>{technicianDetails.property_name || 'N/A'}</span>
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
                          <span>{formatDateFull(technicianDetails.created_at)}</span>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
                          User ID
                        </label>
                        <div className="text-gray-900 font-mono text-sm break-all">
                          {technicianDetails.id}
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
                      setTechnicianDetails(null);
                    }}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Close
                  </button>
                  {!technicianDetails.approved && (
                    <button
                      onClick={() => {
                        setDetailsModalOpen(false);
                        handleApproveClick(technicianDetails);
                      }}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      <Check className="w-4 h-4 inline mr-2" />
                      Approve Technician
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

export default Technicians;
