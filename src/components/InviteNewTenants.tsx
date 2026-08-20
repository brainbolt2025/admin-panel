import { useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Download,
  FileSpreadsheet,
  Upload,
  UserPlus,
} from 'lucide-react';
import AlertsBell from './AlertsBell';
import ScanQr from './ScanQr';
import { queryKeys } from '../lib/queryKeys';
import { fetchTenantsQuery } from '../lib/pmQueries';
import { invalidateTenantsData } from '../lib/invalidatePmData';
import { createTenantInvites, tenantInviteQrLink, type TenantInviteResult } from '../lib/tenantInvitesApi';
import { downloadQrPng, printQr } from '../lib/qrImage';

interface InviteNewTenantsProps {
  onBack: () => void;
  onNavigateToWorkOrder?: (workOrderId: string) => void;
  onNavigateToTechnicians?: () => void;
  onNavigateToTenants?: () => void;
}

type RowStatus = 'valid' | 'duplicate' | 'invalid_email' | 'missing' | 'failed';

interface CsvRow {
  email: string;
  name: string;
  unit_number: string;
  phone: string;
  status: RowStatus;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CSV_TEMPLATE = 'name,email,unit_number,phone\nJane Tenant,jane@example.com,A101,555-0100\n';

function parseCsv(text: string): CsvRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];

  const header = lines[0].toLowerCase().split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
  const idx = {
    name: header.findIndex((h) => h === 'name' || h === 'full_name'),
    email: header.findIndex((h) => h === 'email'),
    unit: header.findIndex((h) => h === 'unit_number' || h === 'unit' || h === 'unit #'),
    phone: header.findIndex((h) => h === 'phone' || h === 'phone_number'),
  };

  const start = header.includes('email') ? 1 : 0;
  const seen = new Set<string>();
  const rows: CsvRow[] = [];

  for (let i = start; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
    const email = (idx.email >= 0 ? cols[idx.email] : cols[0]) || '';
    const name = (idx.name >= 0 ? cols[idx.name] : cols[1]) || '';
    const unit_number = (idx.unit >= 0 ? cols[idx.unit] : cols[2]) || '';
    const phone = (idx.phone >= 0 ? cols[idx.phone] : cols[3]) || '';
    const key = email.toLowerCase();
    let status: RowStatus = 'valid';
    if (!email || !name || !unit_number) status = 'missing';
    else if (!EMAIL_RE.test(email)) status = 'invalid_email';
    else if (seen.has(key)) status = 'duplicate';
    if (key) seen.add(key);
    rows.push({ email, name, unit_number, phone, status });
  }
  return rows;
}

function markExisting(rows: CsvRow[], existingEmails: Set<string>): CsvRow[] {
  return rows.map((row) => {
    if (row.status === 'valid' && existingEmails.has(row.email.trim().toLowerCase())) {
      return { ...row, status: 'duplicate' as const };
    }
    return row;
  });
}

function statusLabel(status: RowStatus) {
  if (status === 'valid') return 'Valid';
  if (status === 'duplicate') return 'Duplicate';
  if (status === 'invalid_email') return 'Invalid email';
  if (status === 'failed') return 'Failed';
  return 'Missing fields';
}

function StatusChip({ status }: { status: RowStatus }) {
  const styles =
    status === 'valid'
      ? 'bg-green-100 text-green-800'
      : status === 'duplicate'
        ? 'bg-amber-100 text-amber-800'
        : 'bg-red-100 text-red-800';
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-medium ${styles}`}>
      {statusLabel(status)}
    </span>
  );
}

function Banner({ tone, children }: { tone: 'success' | 'error'; children: string }) {
  const styles =
    tone === 'success'
      ? 'text-teal-800 bg-teal-50'
      : 'text-red-800 bg-red-50';
  return <p className={`text-sm rounded-lg px-3 py-2 ${styles}`}>{children}</p>;
}

const InviteNewTenants = ({
  onBack,
  onNavigateToWorkOrder,
  onNavigateToTechnicians,
  onNavigateToTenants,
}: InviteNewTenantsProps) => {
  const queryClient = useQueryClient();
  const { data: tenantsData } = useQuery({
    queryKey: queryKeys.tenants,
    queryFn: fetchTenantsQuery,
  });
  const existingEmails = useMemo(() => {
    return new Set(
      (tenantsData?.tenants ?? [])
        .filter((tenant) => !tenant.pending_invite)
        .map((tenant) => tenant.email?.trim().toLowerCase())
        .filter((email): email is string => Boolean(email)),
    );
  }, [tenantsData?.tenants]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [csvRows, setCsvRows] = useState<CsvRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [csvNotice, setCsvNotice] = useState<string | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [csvSaving, setCsvSaving] = useState(false);

  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [unitNumber, setUnitNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [generateQr, setGenerateQr] = useState(true);
  const [manualNotice, setManualNotice] = useState<string | null>(null);
  const [manualError, setManualError] = useState<string | null>(null);
  const [manualSaving, setManualSaving] = useState(false);
  const [createdInvite, setCreatedInvite] = useState<TenantInviteResult | null>(null);

  const readyCount = csvRows.filter((r) => r.status === 'valid').length;

  const applyFile = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setCsvError('Please upload a .csv file.');
      setCsvNotice(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '');
      setCsvRows(markExisting(parseCsv(text), existingEmails));
      setFileName(file.name);
      setCsvNotice(null);
      setCsvError(null);
    };
    reader.readAsText(file);
  };

  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'asine-tenant-invite-template.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleValidateCsv = () => {
    setCsvRows((rows) => markExisting(rows, existingEmails));
    setCsvError(null);
    setCsvNotice('Rows re-checked against required fields and existing tenants.');
  };

  const handleAddFromCsv = async () => {
    const ready = csvRows.filter((r) => r.status === 'valid');
    if (ready.length === 0) return;
    if (ready.length > 100) {
      setCsvError('Add at most 100 tenants at a time.');
      setCsvNotice(null);
      return;
    }

    setCsvSaving(true);
    setCsvError(null);
    setCsvNotice(null);
    try {
      const data = await createTenantInvites(
        ready.map((row) => ({
          name: row.name,
          email: row.email,
          unit_number: row.unit_number,
          phone: row.phone || undefined,
        })),
      );

      const failedByEmail = new Map(
        (data.results ?? [])
          .filter((result) => result.error && result.email)
          .map((result) => [result.email!.toLowerCase(), result.error as string]),
      );

      invalidateTenantsData(queryClient);

      const created = data.created ?? 0;
      const failed = data.failed ?? failedByEmail.size;
      if (created === 0) {
        setCsvRows((rows) =>
          rows.map((row) => {
            const fail = failedByEmail.get(row.email.trim().toLowerCase());
            return fail ? { ...row, status: 'failed' as const } : row;
          }),
        );
        setCsvError(data.error || [...failedByEmail.values()][0] || 'Could not add tenants.');
        return;
      }

      if (failed > 0) {
        setCsvRows((rows) =>
          rows.filter((row) => failedByEmail.has(row.email.trim().toLowerCase())).map((row) => ({
            ...row,
            status: 'failed' as const,
          })),
        );
        setCsvNotice(`${created} tenant${created === 1 ? '' : 's'} added. ${failed} skipped — see rows below.`);
        setCsvError([...failedByEmail.values()][0] || null);
        return;
      }

      setCsvRows([]);
      setFileName('');
      setCsvNotice(
        `${created} tenant${created === 1 ? '' : 's'} added. Show QR from the Tenants list.`,
      );
    } catch (err) {
      setCsvError(err instanceof Error ? err.message : 'Could not add tenants. Please try again.');
    } finally {
      setCsvSaving(false);
    }
  };

  const handleCreateSingle = async (e: React.FormEvent) => {
    e.preventDefault();
    setManualError(null);
    setManualNotice(null);
    if (!EMAIL_RE.test(email.trim()) || !firstName.trim() || !unitNumber.trim()) {
      setManualError('Email, first name, and unit are required.');
      return;
    }

    setManualSaving(true);
    try {
      const data = await createTenantInvites([
        {
          email: email.trim(),
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          unit_number: unitNumber.trim(),
          phone: phone.trim() || undefined,
        },
      ]);
      const result = data.results?.[0];
      if (!data.success || result?.error) {
        setManualError(result?.error || data.error || 'Could not create invitation.');
        return;
      }

      invalidateTenantsData(queryClient);
      const qrLink = result ? tenantInviteQrLink(result) : '';
      if (generateQr && qrLink) {
        setCreatedInvite(result);
        setManualNotice('Invitation created. Have the tenant scan this QR after installing the app.');
      } else {
        setEmail('');
        setFirstName('');
        setLastName('');
        setUnitNumber('');
        setPhone('');
        setCreatedInvite(null);
        setManualNotice('Invitation created. You can show the QR later from the Tenants list.');
      }
    } catch (err) {
      setManualError(err instanceof Error ? err.message : 'Could not create invitation. Please try again.');
    } finally {
      setManualSaving(false);
    }
  };

  const resetSingleForm = () => {
    setEmail('');
    setFirstName('');
    setLastName('');
    setUnitNumber('');
    setPhone('');
    setCreatedInvite(null);
    setManualNotice(null);
    setManualError(null);
  };

  const inviteQrData = createdInvite ? tenantInviteQrLink(createdInvite) : '';

  return (
    <div className="p-6">
      <div className="bg-white rounded-xl shadow-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Tenants
          </button>
          {onNavigateToWorkOrder && onNavigateToTechnicians && onNavigateToTenants && (
            <AlertsBell
              onNavigateToWorkOrder={onNavigateToWorkOrder}
              onNavigateToTechnicians={onNavigateToTechnicians}
              onNavigateToTenants={onNavigateToTenants}
            />
          )}
        </div>

        <div className="px-6 py-5">
          <div className="flex items-center gap-2 mb-1">
            <UserPlus className="w-6 h-6 text-teal-600" />
            <h1 className="text-2xl font-bold text-gray-900">Add tenants</h1>
          </div>
          <p className="text-sm text-gray-500 mb-6">
            Add one tenant or upload a CSV. No invitation emails are sent — use a QR to download the
            app or finish setup.
          </p>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <section className="border border-gray-200 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-4">Option 1: Bulk add via CSV</h2>

              {csvNotice && (
                <div className="mb-3">
                  <Banner tone="success">{csvNotice}</Banner>
                </div>
              )}
              {csvError && (
                <div className="mb-3">
                  <Banner tone="error">{csvError}</Banner>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                <div className="lg:col-span-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) applyFile(file);
                      e.target.value = '';
                    }}
                  />
                  <button
                    type="button"
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOver(true);
                    }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOver(false);
                      const file = e.dataTransfer.files[0];
                      if (file) applyFile(file);
                    }}
                    onClick={() => fileInputRef.current?.click()}
                    className={`w-full h-40 border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-2 px-4 text-center transition-colors ${
                      dragOver
                        ? 'border-teal-500 bg-teal-50'
                        : 'border-gray-300 hover:border-teal-400 hover:bg-gray-50'
                    }`}
                  >
                    <FileSpreadsheet className="w-10 h-10 text-teal-600" />
                    <p className="text-sm font-medium text-gray-800">Drag and drop or click to upload</p>
                    <p className="text-xs text-gray-500">
                      {fileName || 'Use the template format: name, email, unit_number, phone'}
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={downloadTemplate}
                    className="mt-3 inline-flex items-center gap-2 text-sm text-teal-700 hover:underline"
                  >
                    <Download className="w-4 h-4" />
                    Download template
                  </button>
                </div>

                <div className="lg:col-span-3 overflow-x-auto max-h-80 overflow-y-auto">
                  <p className="text-xs font-medium text-gray-500 mb-2">
                    Review & confirm {csvRows.length === 0 ? '(upload pending)' : `(${csvRows.length} rows)`}
                  </p>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-left text-xs uppercase text-gray-500">
                        <th className="py-2 pr-2">Email</th>
                        <th className="py-2 pr-2">Name</th>
                        <th className="py-2 pr-2">Unit</th>
                        <th className="py-2 pr-2">Phone</th>
                        <th className="py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {csvRows.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-gray-400 text-sm">
                            Upload a CSV to preview tenants here.
                          </td>
                        </tr>
                      ) : (
                        csvRows.map((row, i) => (
                          <tr key={`${row.email}-${i}`}>
                            <td className="py-2 pr-2 text-gray-800 truncate max-w-[8rem]">{row.email || '—'}</td>
                            <td className="py-2 pr-2 text-gray-700">{row.name || '—'}</td>
                            <td className="py-2 pr-2 text-gray-700">{row.unit_number || '—'}</td>
                            <td className="py-2 pr-2 text-gray-500">{row.phone || '—'}</td>
                            <td className="py-2">
                              <StatusChip status={row.status} />
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
                <span className="mr-auto text-xs text-gray-500">
                  {csvRows.length > 0 ? `${readyCount} ready · ${csvRows.length - readyCount} skipped` : ''}
                </span>
                <button
                  type="button"
                  disabled={csvRows.length === 0 || csvSaving}
                  onClick={handleValidateCsv}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                >
                  Validate data
                </button>
                <button
                  type="button"
                  disabled={readyCount === 0 || csvSaving}
                  onClick={() => void handleAddFromCsv()}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-40"
                >
                  <Upload className="w-4 h-4" />
                  {csvSaving ? 'Adding…' : `Add ${readyCount || ''} tenant${readyCount === 1 ? '' : 's'}`}
                </button>
              </div>
            </section>

            <section className="border border-gray-200 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-1">Option 2: Add one tenant</h2>
              <p className="text-sm text-gray-500 mb-4">Enter details to add a tenant</p>

              {manualNotice && (
                <div className="mb-4">
                  <Banner tone="success">{manualNotice}</Banner>
                </div>
              )}
              {manualError && (
                <div className="mb-4">
                  <Banner tone="error">{manualError}</Banner>
                </div>
              )}

              <form onSubmit={handleCreateSingle} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="invite-email">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="invite-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={Boolean(createdInvite)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:bg-gray-50"
                    placeholder="tenant@example.com"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="invite-first">
                      First name <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="invite-first"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      disabled={Boolean(createdInvite)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:bg-gray-50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="invite-last">
                      Last name
                    </label>
                    <input
                      id="invite-last"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      disabled={Boolean(createdInvite)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:bg-gray-50"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="invite-unit">
                      Unit # <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="invite-unit"
                      required
                      value={unitNumber}
                      onChange={(e) => setUnitNumber(e.target.value)}
                      disabled={Boolean(createdInvite)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:bg-gray-50"
                      placeholder="A101"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="invite-phone">
                      Phone
                    </label>
                    <input
                      id="invite-phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      disabled={Boolean(createdInvite)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:bg-gray-50"
                      placeholder="Optional"
                    />
                  </div>
                </div>

                <div className="flex items-start justify-between gap-4 pt-2">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <span className="text-sm font-medium text-gray-800">Generate invitation QR code?</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={generateQr}
                      onClick={() => setGenerateQr((v) => !v)}
                      disabled={Boolean(createdInvite)}
                      className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${
                        generateQr ? 'bg-teal-600' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-5 w-5 mt-0.5 rounded-full bg-white shadow transform transition ${
                          generateQr ? 'translate-x-5' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  </label>
                  {generateQr && inviteQrData && (
                    <ScanQr label="Scan to finish setup" data={inviteQrData} size={128} />
                  )}
                </div>

                {generateQr && inviteQrData && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void downloadQrPng(inviteQrData, `asine-invite-${email}`)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
                    >
                      Download PNG
                    </button>
                    <button
                      type="button"
                      onClick={() => printQr(inviteQrData, `Asine invite for ${email}`)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
                    >
                      Print
                    </button>
                  </div>
                )}

                {createdInvite ? (
                  <button
                    type="button"
                    onClick={resetSingleForm}
                    className="w-full bg-teal-600 hover:bg-teal-700 text-white font-medium py-2.5 rounded-lg transition-colors"
                  >
                    Add another tenant
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={manualSaving}
                    className="w-full bg-teal-600 hover:bg-teal-700 text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-40"
                  >
                    {manualSaving ? 'Creating…' : 'Create invitation'}
                  </button>
                )}
              </form>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InviteNewTenants;
