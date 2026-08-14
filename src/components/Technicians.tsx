import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  Wrench,
  Mail,
  Check,
  X as XIcon,
  Camera,
  Info,
  MapPin,
  Shield,
  Clock,
  Users,
  UserPlus,
  MailCheck,
} from 'lucide-react';
import { getAuthenticatedSupabase } from '../lib/supabase';
import { config } from '../config';
import { queryKeys } from '../lib/queryKeys';
import { fetchTechniciansQuery } from '../lib/pmQueries';
import { invalidateTechniciansData } from '../lib/invalidatePmData';
import AlertsBell from './AlertsBell';
import { toUserFacingError } from '../lib/userFacingError';
import {
  APPROVAL_STATUS,
  isApproved,
  isRejected,
  normalizeApprovalStatus,
  type ApprovalStatus,
} from '../lib/approvalStatus';

const PROFILE_PICTURES_BUCKET = 'profile-pictures';

interface Technician {
  id: string;
  name: string | null;
  email: string | null;
  role: string | null;
  approved: ApprovalStatus;
  created_at?: string;
  profile_picture_url?: string | null;
  property_name?: string | null;
  email_verified?: boolean | null;
  pending_invite?: boolean;
}

interface TechniciansProps {
  onNavigateToWorkOrder?: (workOrderId: string) => void;
  onNavigateToTechnicians?: () => void;
  onNavigateToTenants?: () => void;
}

const Technicians = ({
  onNavigateToWorkOrder,
  onNavigateToTechnicians,
  onNavigateToTenants,
}: TechniciansProps) => {
  const getUserRole = () => {
    try {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        if (user.user_metadata?.role) return user.user_metadata.role;
        if (user.raw_user_meta_data?.role) return user.raw_user_meta_data.role;
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
    data: techniciansData,
    isLoading: loadingTechnicians,
    error: techniciansQueryError,
  } = useQuery({
    queryKey: queryKeys.technicians,
    queryFn: fetchTechniciansQuery,
    enabled: isPM,
  });

  const technicians = techniciansData?.technicians ?? [];
  const [profilePictureUrls, setProfilePictureUrls] = useState<Record<string, string>>({});
  const errorTechnicians = techniciansQueryError
    ? toUserFacingError(techniciansQueryError, 'Unable to load technicians. Please try again.')
    : null;

  useEffect(() => {
    if (techniciansData?.profilePictureUrls) {
      setProfilePictureUrls(techniciansData.profilePictureUrls);
    }
  }, [techniciansData?.profilePictureUrls]);

  const [searchTerm, setSearchTerm] = useState('');
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [technicianDetails, setTechnicianDetails] = useState<Technician | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [uploadingProfilePicture, setUploadingProfilePicture] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteStep, setInviteStep] = useState<'form' | 'confirm'>('form');
  const [inviteForm, setInviteForm] = useState({ first_name: '', last_name: '', email: '' });
  const [invitePropertyName, setInvitePropertyName] = useState<string | null>(null);
  const [isInviting, setIsInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<Technician | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);
  const [notice, setNotice] = useState<{
    title: string;
    message: string;
    tone: 'success' | 'error';
  } | null>(null);

  const filteredTechnicians = technicians.filter((technician) => {
    const q = searchTerm.toLowerCase();
    return (
      technician.name?.toLowerCase().includes(q) ||
      technician.email?.toLowerCase().includes(q)
    );
  });

  const handleProfilePictureUpload = async (technicianId: string, file: File) => {
    setUploadingProfilePicture(technicianId);
    try {
      const supabaseClient = getAuthenticatedSupabase();
      const fileExt = file.name.split('.').pop();
      const fileName = `technician_${technicianId}_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabaseClient.storage
        .from(PROFILE_PICTURES_BUCKET)
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { error: updateError } = await supabaseClient
        .from('users')
        .update({ profile_picture_url: fileName })
        .eq('id', technicianId);

      if (updateError) throw updateError;

      const { data: signedData, error: signedError } = await supabaseClient.storage
        .from(PROFILE_PICTURES_BUCKET)
        .createSignedUrl(fileName, 60 * 60 * 24);

      if (!signedError && signedData?.signedUrl) {
        setProfilePictureUrls((prev) => ({
          ...prev,
          [technicianId]: signedData.signedUrl,
        }));
      }

      invalidateTechniciansData(queryClient);
    } catch (err) {
      console.error('Error uploading profile picture:', err);
      setNotice({
        title: 'Upload failed',
        message: 'Failed to upload profile picture. Please try again.',
        tone: 'error',
      });
    } finally {
      setUploadingProfilePicture(null);
    }
  };

  const handleFileInputChange = (technicianId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) handleProfilePictureUpload(technicianId, file);
    event.target.value = '';
  };

  const handleViewDetails = async (technician: Technician) => {
    setLoadingDetails(true);
    setDetailsModalOpen(true);

    try {
      const supabaseClient = getAuthenticatedSupabase();
      const { data: technicianData, error } = await supabaseClient
        .from('users')
        .select(
          'id, name, email, role, approved, created_at, profile_picture_url, property_name, email_verified',
        )
        .eq('id', technician.id)
        .single();

      if (error) throw error;

      const fullTechnician: Technician = {
        id: technicianData.id,
        name: technicianData.name,
        email: technicianData.email,
        role: technicianData.role,
        approved: normalizeApprovalStatus(technicianData.approved),
        created_at: technicianData.created_at,
        profile_picture_url: technicianData.profile_picture_url,
        property_name: technicianData.property_name,
        email_verified: technicianData.email_verified,
      };

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
    } catch (err) {
      console.error('Error fetching technician details:', err);
      setNotice({
        title: 'Unable to load details',
        message: 'Failed to load technician details. Please try again.',
        tone: 'error',
      });
      setDetailsModalOpen(false);
    } finally {
      setLoadingDetails(false);
    }
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatDateFull = (dateString: string | undefined) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const resetInviteModal = () => {
    setInviteModalOpen(false);
    setInviteStep('form');
    setInviteForm({ first_name: '', last_name: '', email: '' });
    setInvitePropertyName(null);
    setInviteError(null);
  };

  const openInviteModal = () => {
    setInviteError(null);
    setInviteStep('form');
    setInviteModalOpen(true);
  };

  /** Step 1 → confirm screen (no email sent yet). */
  const handleInviteFormContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError(null);

    const first = inviteForm.first_name.trim();
    const last = inviteForm.last_name.trim();
    const email = inviteForm.email.trim();
    if (!first || !last || !email) {
      setInviteError('First name, last name, and email are required.');
      return;
    }

    try {
      const supabaseClient = getAuthenticatedSupabase();
      const { data: userData } = await supabaseClient.auth.getUser();
      if (!userData.user) {
        setInviteError('User not found. Please log in again.');
        return;
      }

      const { data: pmData, error: pmError } = await supabaseClient
        .from('users')
        .select('property_id, property_name')
        .eq('id', userData.user.id)
        .eq('role', 'pm')
        .maybeSingle();

      if (pmError || !pmData?.property_id) {
        setInviteError('Could not resolve your property. Please try again.');
        return;
      }

      setInvitePropertyName(pmData.property_name || 'your property');
      setInviteStep('confirm');
    } catch (err) {
      console.error('Error preparing invite confirmation:', err);
      setInviteError('An error occurred. Please try again.');
    }
  };

  /** Step 2 → actually create + email. */
  const handleInviteConfirmSend = async () => {
    setInviteError(null);
    setIsInviting(true);

    try {
      const accessToken = localStorage.getItem('access_token');
      if (!accessToken) {
        setInviteError('You are not authenticated. Please log in again.');
        return;
      }

      const supabaseClient = getAuthenticatedSupabase();
      const { data: userData } = await supabaseClient.auth.getUser();
      if (!userData.user) {
        setInviteError('User not found. Please log in again.');
        return;
      }

      const { data: pmData, error: pmError } = await supabaseClient
        .from('users')
        .select('property_id, property_name')
        .eq('id', userData.user.id)
        .eq('role', 'pm')
        .maybeSingle();

      if (pmError || !pmData?.property_id) {
        setInviteError('Could not resolve your property. Please try again.');
        return;
      }

      const response = await fetch(`${config.supabase.url}/functions/v1/create-technician`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
          apikey: config.supabase.anonKey,
        },
        body: JSON.stringify({
          first_name: inviteForm.first_name.trim(),
          last_name: inviteForm.last_name.trim(),
          email: inviteForm.email.trim(),
          property_id: pmData.property_id,
          property_name: pmData.property_name || undefined,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        setInviteError(data.error || 'Failed to invite technician. Please try again.');
        setInviteStep('form');
        return;
      }

      resetInviteModal();
      invalidateTechniciansData(queryClient);

      if (data.email_sent === false) {
        setNotice({
          title: 'Invitation incomplete',
          message:
            'The invite was saved, but the email may not have been sent. ' +
            (data.email_error || 'Please contact support if they do not receive the set-password link.'),
          tone: 'error',
        });
      } else {
        setNotice({
          title: 'Invitation sent',
          message:
            'The technician will receive an email to create their password. Their account is created only after they set it.',
          tone: 'success',
        });
      }
    } catch (err) {
      console.error('Error inviting technician:', err);
      setInviteError('An error occurred. Please try again.');
      setInviteStep('form');
    } finally {
      setIsInviting(false);
    }
  };

  const handleRevokeTechnician = async () => {
    if (!revokeTarget) return;
    setIsRevoking(true);
    try {
      const supabaseClient = getAuthenticatedSupabase();
      const { error } = await supabaseClient
        .from('users')
        .update({ approved: APPROVAL_STATUS.rejected })
        .eq('id', revokeTarget.id)
        .eq('role', 'technician');

      if (error) throw error;

      setRevokeTarget(null);
      invalidateTechniciansData(queryClient);
      setNotice({
        title: 'Technician revoked',
        message: `${revokeTarget.name || 'This technician'} can no longer be assigned to work orders.`,
        tone: 'success',
      });
    } catch (err) {
      console.error('Error revoking technician:', err);
      setNotice({
        title: 'Revoke failed',
        message: 'Could not revoke this technician. Please try again.',
        tone: 'error',
      });
    } finally {
      setIsRevoking(false);
    }
  };

  const handleCancelInvite = async (invite: Technician) => {
    try {
      const supabaseClient = getAuthenticatedSupabase();
      const { error } = await supabaseClient
        .from('technician_invites')
        .delete()
        .eq('id', invite.id);

      if (error) throw error;

      invalidateTechniciansData(queryClient);
      setNotice({
        title: 'Invite cancelled',
        message: `The invitation to ${invite.email || 'this technician'} was cancelled.`,
        tone: 'success',
      });
    } catch (err) {
      console.error('Error cancelling invite:', err);
      setNotice({
        title: 'Cancel failed',
        message: 'Could not cancel this invitation. Please try again.',
        tone: 'error',
      });
    }
  };

  return (
    <div className="p-6">
      <div className="bg-white rounded-xl shadow-sm">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <Users className="w-6 h-6 text-teal-600" />
            <h1 className="text-2xl font-bold text-gray-900">Technicians</h1>
          </div>

          <div className="flex items-center gap-3">
            {isPM && (
              <button
                type="button"
                onClick={openInviteModal}
                className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 transition-colors"
              >
                <UserPlus className="w-4 h-4" />
                Invite Technician
              </button>
            )}
            {isPM && onNavigateToWorkOrder && onNavigateToTechnicians && onNavigateToTenants && (
              <AlertsBell
                onNavigateToWorkOrder={onNavigateToWorkOrder}
                onNavigateToTechnicians={onNavigateToTechnicians}
                onNavigateToTenants={onNavigateToTenants}
              />
            )}
          </div>
        </div>

        <div className="px-6 pb-6">
          <div className="relative mb-6">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search all technicians..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 bg-gray-50 border-0 rounded-full text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition-colors"
            />
          </div>

          <div className="overflow-hidden">
            {loadingTechnicians ? (
              <div className="text-center py-12">
                <div className="w-12 h-12 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-gray-500">Loading technicians...</p>
              </div>
            ) : errorTechnicians ? (
              <div className="text-center py-12">
                <p className="text-red-500">{errorTechnicians}</p>
              </div>
            ) : filteredTechnicians.length === 0 ? (
              technicians.length === 0 ? (
                <div className="relative overflow-hidden py-12 px-6">
                  <div className="relative max-w-xl mx-auto text-center">
                    <Wrench className="w-14 h-14 text-teal-600 mx-auto mb-4" />
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">No technicians yet</h3>
                    <p className="text-gray-500 mb-6">
                      Invite a technician with their name and email. They&apos;ll get a link to
                      open the Asine app and create their own password. The account is created
                      only after they set it.
                    </p>
                    {isPM && (
                      <button
                        type="button"
                        onClick={openInviteModal}
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white font-medium rounded-lg hover:bg-teal-700 transition-colors"
                      >
                        <UserPlus className="w-4 h-4" />
                        Invite Technician
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-500">No technicians match your search</p>
                </div>
              )
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="text-left py-4 px-6 text-xs font-semibold text-gray-500 uppercase">
                        Technician
                      </th>
                      <th className="text-left py-4 px-6 text-xs font-semibold text-gray-500 uppercase">
                        Email
                      </th>
                      <th className="text-left py-4 px-6 text-xs font-semibold text-gray-500 uppercase">
                        Email status
                      </th>
                      <th className="text-left py-4 px-6 text-xs font-semibold text-gray-500 uppercase">
                        Access
                      </th>
                      <th className="text-left py-4 px-6 text-xs font-semibold text-gray-500 uppercase">
                        Date Added
                      </th>
                      <th className="text-left py-4 px-6 text-xs font-semibold text-gray-500 uppercase">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredTechnicians.map((technician) => (
                      <tr key={technician.id} className="hover:bg-gray-50">
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <div className="relative group">
                              {profilePictureUrls[technician.id] ? (
                                <img
                                  src={profilePictureUrls[technician.id]}
                                  alt={technician.name || 'Technician'}
                                  className="w-10 h-10 rounded-full object-cover"
                                />
                              ) : (
                                <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center">
                                  <Wrench className="w-5 h-5 text-teal-600" />
                                </div>
                              )}
                              {!technician.pending_invite && (
                                <>
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
                                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <Camera className="w-4 h-4 text-white" />
                                )}
                              </label>
                                </>
                              )}
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
                          {technician.pending_invite ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-800 rounded-md text-xs font-medium">
                              <Mail className="w-3 h-3" />
                              Waiting for password
                            </span>
                          ) : technician.email_verified ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-md text-xs font-medium">
                              <MailCheck className="w-3 h-3" />
                              Verified
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-800 rounded-md text-xs font-medium">
                              <Mail className="w-3 h-3" />
                              Pending verify
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-6">
                          {technician.pending_invite ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded-md text-xs font-medium">
                              <Clock className="w-3 h-3" />
                              Invite pending
                            </span>
                          ) : isRejected(technician.approved) ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-md text-xs font-medium">
                              <XIcon className="w-3 h-3" />
                              Revoked
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-md text-xs font-medium">
                              <Check className="w-3 h-3" />
                              Active
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-6 text-sm text-gray-600">
                          {formatDate(technician.created_at)}
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex flex-wrap gap-2">
                            {technician.pending_invite ? (
                              <button
                                onClick={() => void handleCancelInvite(technician)}
                                className="inline-flex items-center gap-1 text-xs px-3 py-1 bg-red-600 text-white hover:bg-red-700 rounded transition-colors"
                              >
                                <XIcon className="w-3 h-3" />
                                Cancel invite
                              </button>
                            ) : (
                              <>
                                <button
                                  onClick={() => handleViewDetails(technician)}
                                  className="inline-flex items-center gap-1 text-xs px-3 py-1 bg-blue-600 text-white hover:bg-blue-700 rounded transition-colors"
                                >
                                  <Info className="w-3 h-3" />
                                  Details
                                </button>
                                {isApproved(technician.approved) && (
                                  <button
                                    onClick={() => setRevokeTarget(technician)}
                                    className="inline-flex items-center gap-1 text-xs px-3 py-1 bg-red-600 text-white hover:bg-red-700 rounded transition-colors"
                                  >
                                    <XIcon className="w-3 h-3" />
                                    Revoke
                                  </button>
                                )}
                              </>
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
        </div>
      </div>

      {/* Notice Modal */}
      {notice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6">
            <div className="flex items-start gap-3 mb-4">
              <div
                className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                  notice.tone === 'success' ? 'bg-teal-100 text-teal-700' : 'bg-red-100 text-red-700'
                }`}
              >
                {notice.tone === 'success' ? (
                  <Check className="w-5 h-5" />
                ) : (
                  <XIcon className="w-5 h-5" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-bold text-gray-900">{notice.title}</h2>
                <p className="mt-1 text-sm text-gray-600 leading-relaxed">{notice.message}</p>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setNotice(null)}
                className="px-5 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 transition-colors"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {inviteModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">
                {inviteStep === 'form' ? 'Invite Technician' : 'Confirm invitation'}
              </h2>
              <button
                type="button"
                onClick={() => !isInviting && resetInviteModal()}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            {inviteStep === 'form' ? (
              <>
                <p className="text-sm text-gray-600 mb-4">
                  We&apos;ll email them a link to open the app and create their own password for
                  your property.
                </p>
                <form onSubmit={handleInviteFormContinue} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        First name
                      </label>
                      <input
                        required
                        name="first_name"
                        value={inviteForm.first_name}
                        onChange={(e) =>
                          setInviteForm((prev) => ({ ...prev, first_name: e.target.value }))
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Last name
                      </label>
                      <input
                        required
                        name="last_name"
                        value={inviteForm.last_name}
                        onChange={(e) =>
                          setInviteForm((prev) => ({ ...prev, last_name: e.target.value }))
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      required
                      type="email"
                      name="email"
                      value={inviteForm.email}
                      onChange={(e) =>
                        setInviteForm((prev) => ({ ...prev, email: e.target.value }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                  {inviteError && <p className="text-sm text-red-600">{inviteError}</p>}
                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={resetInviteModal}
                      className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
                    >
                      Continue
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <>
                <p className="text-sm text-gray-600 mb-4">
                  Double-check these details before we send the invitation. They will set their own
                  password from the email.
                </p>
                <div className="rounded-lg border border-teal-100 bg-teal-50/60 p-4 space-y-2 mb-4">
                  <p className="text-sm text-gray-800">
                    <span className="font-medium text-gray-500">Name:</span>{' '}
                    {inviteForm.first_name.trim()} {inviteForm.last_name.trim()}
                  </p>
                  <p className="text-sm text-gray-800 break-all">
                    <span className="font-medium text-gray-500">Email:</span>{' '}
                    {inviteForm.email.trim()}
                  </p>
                  <p className="text-sm text-gray-800">
                    <span className="font-medium text-gray-500">Property:</span>{' '}
                    {invitePropertyName || 'your property'}
                  </p>
                </div>
                {inviteError && <p className="text-sm text-red-600 mb-3">{inviteError}</p>}
                <div className="flex gap-3">
                  <button
                    type="button"
                    disabled={isInviting}
                    onClick={() => {
                      setInviteError(null);
                      setInviteStep('form');
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    disabled={isInviting}
                    onClick={() => void handleInviteConfirmSend()}
                    className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50"
                  >
                    {isInviting ? 'Sending…' : 'Send invitation'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Revoke confirmation */}
      {revokeTarget && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Revoke technician</h2>
              <button
                type="button"
                disabled={isRevoking}
                onClick={() => setRevokeTarget(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              This removes{' '}
              <span className="font-medium text-gray-900">
                {revokeTarget.name || 'this technician'}
              </span>{' '}
              from your assignment list. They will no longer receive new work orders.
            </p>
            <div className="rounded-lg bg-gray-50 p-3 mb-4 text-sm text-gray-700">
              <div className="flex items-center gap-2 mb-1">
                <Wrench className="w-4 h-4 text-teal-600" />
                {revokeTarget.name || 'N/A'}
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-gray-400" />
                {revokeTarget.email || 'N/A'}
              </div>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                disabled={isRevoking}
                onClick={() => setRevokeTarget(null)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isRevoking}
                onClick={() => void handleRevokeTechnician()}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {isRevoking ? 'Revoking…' : 'Revoke'}
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
                <div className="w-12 h-12 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-gray-500">Loading details...</p>
              </div>
            ) : technicianDetails ? (
              <>
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

                <div className="p-6">
                  <div className="flex flex-col md:flex-row gap-6 mb-6">
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
                    <div className="flex-1 space-y-3">
                      <h3 className="text-xl font-bold text-gray-900">
                        {technicianDetails.name || 'N/A'}
                      </h3>
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
                      <div className="flex flex-wrap gap-2">
                        {technicianDetails.email_verified ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-md text-sm font-medium">
                            <Check className="w-4 h-4" />
                            Email verified
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-3 py-1 bg-amber-100 text-amber-800 rounded-md text-sm font-medium">
                            <Mail className="w-4 h-4" />
                            Awaiting email verification
                          </span>
                        )}
                        {isRejected(technicianDetails.approved) ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 rounded-md text-sm font-medium">
                            <XIcon className="w-4 h-4" />
                            Revoked
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-md text-sm font-medium">
                            <Check className="w-4 h-4" />
                            Active
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-6 border-t border-gray-200">
                    <div>
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
                        Property
                      </label>
                      <div className="flex items-center text-gray-900">
                        <MapPin className="w-4 h-4 mr-2 text-gray-400" />
                        <span>{technicianDetails.property_name || 'N/A'}</span>
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
                  {isApproved(technicianDetails.approved) && (
                    <button
                      onClick={() => {
                        setDetailsModalOpen(false);
                        setRevokeTarget(technicianDetails);
                      }}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                    >
                      Revoke technician
                    </button>
                  )}
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};

export default Technicians;
