import { useEffect, useState } from 'react';
import { Mail, Search, Send, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import { getAuthenticatedSupabase } from '../lib/supabase';
import { config } from '../config';
import { toUserFacingError } from '../lib/userFacingError';

interface WaitlistEntry {
  id: string;
  email: string;
  property_name: string;
  created_at: string;
  notified_at: string | null;
  status: 'pending' | 'contacted' | 'approved' | 'declined';
}

interface BulkEmailResult {
  email: string;
  property_name: string;
  success: boolean;
  error?: string;
}

const Waitlist = () => {
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  // Bulk email state
  const [showBulkEmail, setShowBulkEmail] = useState(false);
  const [sending, setSending] = useState(false);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [bulkEmailStatus, setBulkEmailStatus] = useState<{
    success: boolean;
    message: string;
    total: number;
    sent: number;
    failed: number;
    results: BulkEmailResult[];
  } | null>(null);

  useEffect(() => {
    fetchWaitlistEntries();
  }, [statusFilter]);

  const fetchWaitlistEntries = async () => {
    setLoading(true);
    setError(null);

    try {
      const supabaseClient = getAuthenticatedSupabase();
      
      let query = supabaseClient
        .from('pm_waitlist')
        .select('*')
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        throw fetchError;
      }

      setEntries(data || []);
    } catch (err) {
      console.error('Error fetching waitlist:', err);
      setError(toUserFacingError(err, 'Unable to load waitlist. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const handleSendBulkEmail = async () => {
    if (!emailSubject.trim() || !emailMessage.trim()) {
      setError('Subject and message are required');
      return;
    }

    setSending(true);
    setError(null);
    setBulkEmailStatus(null);

    try {
      const supabaseClient = getAuthenticatedSupabase();
      const { data: { session } } = await supabaseClient.auth.getSession();
      
      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`${config.supabase.url}/functions/v1/send-bulk-waitlist-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          subject: emailSubject.trim(),
          message: emailMessage.trim(),
          status_filter: statusFilter === 'all' ? 'all' : statusFilter,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to send bulk email');
      }

      setBulkEmailStatus({
        success: result.success,
        message: result.message,
        total: result.total,
        sent: result.sent,
        failed: result.failed,
        results: result.results || [],
      });

      // Refresh waitlist entries
      await fetchWaitlistEntries();

      // Reset form
      setEmailSubject('');
      setEmailMessage('');
    } catch (err) {
      console.error('Error sending bulk email:', err);
      setError(toUserFacingError(err, 'Unable to send emails. Please try again.'));
    } finally {
      setSending(false);
    }
  };

  const filteredEntries = entries.filter((entry) => {
    const matchesSearch =
      entry.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.property_name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const getStatusBadge = (status: string) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800',
      contacted: 'bg-blue-100 text-blue-800',
      approved: 'bg-green-100 text-green-800',
      declined: 'bg-red-100 text-red-800',
    };
    return styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">PM Waitlist</h1>
          <p className="text-gray-600 mt-1">Manage Property Manager waitlist signups</p>
        </div>
        <button
          onClick={() => setShowBulkEmail(!showBulkEmail)}
          className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
        >
          <Mail className="w-5 h-5" />
          {showBulkEmail ? 'Hide Bulk Email' : 'Send Bulk Email'}
        </button>
      </div>

      {/* Bulk Email Form */}
      {showBulkEmail && (
        <div className="mb-6 p-6 bg-white border border-gray-200 rounded-lg shadow-sm">
          <h2 className="text-xl font-semibold mb-4">Send Bulk Email</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Subject *
              </label>
              <input
                type="text"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                placeholder="Enter email subject"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                disabled={sending}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Message *
              </label>
              <textarea
                value={emailMessage}
                onChange={(e) => setEmailMessage(e.target.value)}
                placeholder="Enter email message (supports line breaks)"
                rows={8}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                disabled={sending}
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleSendBulkEmail}
                disabled={sending || !emailSubject.trim() || !emailMessage.trim()}
                className="flex items-center gap-2 px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {sending ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    Send Email ({filteredEntries.length} recipients)
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  setShowBulkEmail(false);
                  setEmailSubject('');
                  setEmailMessage('');
                  setBulkEmailStatus(null);
                }}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                disabled={sending}
              >
                Cancel
              </button>
            </div>

            {bulkEmailStatus && (
              <div className={`p-4 rounded-lg ${
                bulkEmailStatus.success && bulkEmailStatus.failed === 0
                  ? 'bg-green-50 border border-green-200'
                  : bulkEmailStatus.failed > 0
                  ? 'bg-yellow-50 border border-yellow-200'
                  : 'bg-red-50 border border-red-200'
              }`}>
                <div className="flex items-start gap-3">
                  {bulkEmailStatus.failed === 0 ? (
                    <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <p className={`font-medium ${
                      bulkEmailStatus.failed === 0 ? 'text-green-800' : 'text-yellow-800'
                    }`}>
                      {bulkEmailStatus.message}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">
                      Total: {bulkEmailStatus.total} | Sent: {bulkEmailStatus.sent} | Failed: {bulkEmailStatus.failed}
                    </p>
                    {bulkEmailStatus.results.length > 0 && bulkEmailStatus.failed > 0 && (
                      <details className="mt-3">
                        <summary className="cursor-pointer text-sm text-gray-700 hover:text-gray-900">
                          View detailed results
                        </summary>
                        <div className="mt-2 space-y-2 max-h-48 overflow-y-auto">
                          {bulkEmailStatus.results.map((result, idx) => (
                            <div
                              key={idx}
                              className={`p-2 rounded text-sm ${
                                result.success ? 'bg-green-100' : 'bg-red-100'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                {result.success ? (
                                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                                ) : (
                                  <XCircle className="w-4 h-4 text-red-600" />
                                )}
                                <span className="font-medium">{result.email}</span>
                                <span className="text-gray-600">({result.property_name})</span>
                                {!result.success && (
                                  <span className="text-red-600 text-xs ml-auto">{result.error}</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="mb-6 flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search by email or property name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="contacted">Contacted</option>
          <option value="approved">Approved</option>
          <option value="declined">Declined</option>
        </select>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
          {error}
        </div>
      )}

      {/* Waitlist Table */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredEntries.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          No waitlist entries found
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Property Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Signed Up
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Notified
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredEntries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {entry.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {entry.property_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadge(entry.status)}`}>
                        {entry.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {new Date(entry.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {entry.notified_at
                        ? new Date(entry.notified_at).toLocaleDateString()
                        : 'Never'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 text-sm text-gray-600">
            Showing {filteredEntries.length} of {entries.length} entries
          </div>
        </div>
      )}
    </div>
  );
};

export default Waitlist;

