import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, Download, X } from 'lucide-react';
import { getAuthenticatedSupabase } from '../lib/supabase';
import { queryKeys } from '../lib/queryKeys';
import { fetchReportsQuery, type PmReport, type ReportStatus } from '../lib/pmQueries';
import { invalidateReportsData } from '../lib/invalidatePmData';
import { toUserFacingError } from '../lib/userFacingError';
import AlertsBell from './AlertsBell';

interface ReportsProps {
  onNavigateToWorkOrder?: (workOrderId: string) => void;
  onNavigateToTechnicians?: () => void;
  onNavigateToTenants?: () => void;
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatReportId(n: number) {
  return String(n).padStart(5, '0');
}

function formatWorkOrderRef(id: string | null) {
  if (!id) return '—';
  return id.slice(0, 8).toUpperCase();
}

function titleCase(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function statusLabel(status: ReportStatus) {
  if (status === 'completed') return 'Reviewed';
  return 'Open';
}

function StatusPill({ status }: { status: ReportStatus }) {
  const reviewed = status === 'completed';
  return (
    <span
      className={`inline-flex px-2 py-1 rounded-md text-xs font-medium ${
        reviewed ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
      }`}
    >
      {statusLabel(status)}
    </span>
  );
}

function roleLabel(role: string | null | undefined) {
  if (role === 'technician') return 'Technician';
  if (role === 'tenant') return 'Tenant';
  return '';
}

const Reports = ({
  onNavigateToWorkOrder,
  onNavigateToTechnicians,
  onNavigateToTenants,
}: ReportsProps) => {
  const queryClient = useQueryClient();
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [direction, setDirection] = useState<'all' | 'tenant_to_tech' | 'tech_to_tenant'>('all');
  const [complaintType, setComplaintType] = useState('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<PmReport | null>(null);

  const {
    data: reports = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.reports,
    queryFn: fetchReportsQuery,
  });

  const errorMessage = error
    ? toUserFacingError(error, 'Unable to load reports. Please try again.')
    : null;

  const filtered = useMemo(() => {
    return reports.filter((report) => {
      const created = new Date(report.created_at);
      if (fromDate && created < new Date(`${fromDate}T00:00:00`)) return false;
      if (toDate && created > new Date(`${toDate}T23:59:59`)) return false;
      if (direction === 'tenant_to_tech' && report.reporter_role !== 'tenant') return false;
      if (direction === 'tech_to_tenant' && report.reporter_role !== 'technician') return false;
      if (complaintType !== 'all' && report.category !== complaintType) return false;
      return true;
    });
  }, [reports, fromDate, toDate, direction, complaintType]);

  const openCount = filtered.filter((r) => r.status !== 'completed').length;
  const tenantToTech = filtered.filter((r) => r.reporter_role === 'tenant').length;
  const techToTenant = filtered.filter((r) => r.reporter_role === 'technician').length;

  const types = useMemo(() => {
    return [...new Set(reports.map((r) => r.category))].sort();
  }, [reports]);

  const markReviewed = async (report: PmReport) => {
    setUpdatingId(report.id);
    try {
      const supabaseClient = getAuthenticatedSupabase();
      const { error: updateError } = await supabaseClient
        .from('reports')
        .update({ status: 'completed', resolved_at: new Date().toISOString() })
        .eq('id', report.id);
      if (updateError) throw updateError;
      invalidateReportsData(queryClient);
    } catch (err) {
      console.error('Failed to update report:', err);
    } finally {
      setUpdatingId(null);
    }
  };

  const exportCsv = () => {
    const rows = [
      [
        'Date',
        'Report ID',
        'Reported by',
        'Reporter role',
        'Reported',
        'Reported role',
        'Type',
        'Status',
        'Work order',
        'Description',
      ],
      ...filtered.map((r) => [
        formatDate(r.created_at),
        formatReportId(r.display_number),
        r.reporter_name || '',
        r.reporter_role,
        r.subject_name || '',
        r.subject_role || '',
        r.category,
        statusLabel(r.status),
        r.work_order_id || '',
        r.description.replace(/\s+/g, ' '),
      ]),
    ];
    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `asine-reports-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6">
      <div className="bg-white rounded-xl shadow-sm">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <FileText className="w-6 h-6 text-teal-600" />
            <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          </div>
          {onNavigateToWorkOrder && onNavigateToTechnicians && onNavigateToTenants && (
            <AlertsBell
              onNavigateToWorkOrder={onNavigateToWorkOrder}
              onNavigateToTechnicians={onNavigateToTechnicians}
              onNavigateToTenants={onNavigateToTenants}
            />
          )}
        </div>

        <div className="px-6 pb-6">
          <p className="text-sm text-gray-500 mb-4">
            Conduct complaints from tenants about technicians, and from technicians about tenants.
          </p>

          <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-3 px-4 py-3 border border-gray-200 rounded-xl bg-gray-50/50">
            <div>
              <label className="block text-xs text-gray-500 mb-1" htmlFor="report-from">
                From date
              </label>
              <input
                id="report-from"
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1" htmlFor="report-to">
                To date
              </label>
              <input
                id="report-to"
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1" htmlFor="report-direction">
                Direction
              </label>
              <select
                id="report-direction"
                value={direction}
                onChange={(e) =>
                  setDirection(e.target.value as 'all' | 'tenant_to_tech' | 'tech_to_tenant')
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
              >
                <option value="all">All</option>
                <option value="tenant_to_tech">Tenant → Technician</option>
                <option value="tech_to_tenant">Technician → Tenant</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1" htmlFor="report-type">
                Type
              </label>
              <select
                id="report-type"
                value={complaintType}
                onChange={(e) => setComplaintType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
              >
                <option value="all">All</option>
                {types.map((t) => (
                  <option key={t} value={t}>
                    {titleCase(t)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-10 h-10 border-4 border-teal-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : errorMessage ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">{errorMessage}</div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-3 max-w-2xl">
                <div className="rounded-lg bg-amber-50 px-4 py-3">
                  <p className="text-xs text-amber-800">Open</p>
                  <p className="text-2xl font-bold text-amber-900">{openCount}</p>
                </div>
                <div className="rounded-lg bg-teal-50 px-4 py-3">
                  <p className="text-xs text-teal-800">Tenant → Technician</p>
                  <p className="text-2xl font-bold text-teal-900">{tenantToTech}</p>
                </div>
                <div className="rounded-lg bg-gray-50 px-4 py-3">
                  <p className="text-xs text-gray-500">Technician → Tenant</p>
                  <p className="text-2xl font-bold text-gray-900">{techToTenant}</p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Date</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">ID</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Reported by</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Reported</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Type</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Description</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Work order</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Status</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-10 text-center text-gray-500 text-sm">
                          No reports yet.
                        </td>
                      </tr>
                    ) : (
                      filtered.map((report) => (
                        <tr key={report.id} className="hover:bg-gray-50">
                          <td className="py-3 px-4 text-sm text-gray-700">{formatDate(report.created_at)}</td>
                          <td className="py-3 px-4 text-sm font-medium">
                            <button
                              type="button"
                              onClick={() => setSelectedReport(report)}
                              className="text-teal-700 hover:underline font-medium"
                            >
                              {formatReportId(report.display_number)}
                            </button>
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-800">
                            {report.reporter_name || '—'}
                            <span className="block text-xs text-gray-500">{roleLabel(report.reporter_role)}</span>
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-800">
                            {report.subject_name || '—'}
                            <span className="block text-xs text-gray-500">{roleLabel(report.subject_role)}</span>
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-700">{titleCase(report.category)}</td>
                          <td
                            className="py-3 px-4 text-sm text-gray-600 max-w-xs truncate"
                            title={report.description}
                          >
                            {report.description}
                          </td>
                          <td className="py-3 px-4 text-sm">
                            {report.work_order_id && onNavigateToWorkOrder ? (
                              <button
                                type="button"
                                onClick={() => onNavigateToWorkOrder(report.work_order_id as string)}
                                className="text-teal-700 hover:underline font-medium"
                              >
                                {formatWorkOrderRef(report.work_order_id)}
                              </button>
                            ) : (
                              <span className="text-gray-500">{formatWorkOrderRef(report.work_order_id)}</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <StatusPill status={report.status} />
                          </td>
                          <td className="py-3 px-4">
                            {report.status !== 'completed' && (
                              <button
                                type="button"
                                disabled={updatingId === report.id}
                                onClick={() => void markReviewed(report)}
                                className="text-xs px-3 py-1 bg-teal-600 text-white rounded hover:bg-teal-700 disabled:opacity-50"
                              >
                                Mark reviewed
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={exportCsv}
                  disabled={filtered.length === 0}
                  className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  Export as CSV
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {selectedReport && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedReport(null)}
        >
          <div
            className="bg-white rounded-xl shadow-lg max-w-lg w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                Report {formatReportId(selectedReport.display_number)}
              </h2>
              <button
                type="button"
                onClick={() => setSelectedReport(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Close"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-3">
              <p className="text-sm text-gray-500">
                {selectedReport.reporter_name || '—'} → {selectedReport.subject_name || '—'} ·{' '}
                {titleCase(selectedReport.category)}
              </p>
              <p className="text-sm text-gray-800 whitespace-pre-wrap">
                {selectedReport.description}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;
