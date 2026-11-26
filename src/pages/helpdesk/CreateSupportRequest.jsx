import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Send, Paperclip, X, Loader2, MonitorSmartphone, User, AlertTriangle, CheckCircle2
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import {
  apiFetch, BUSINESS_IMPACT_OPTIONS, REQUEST_TYPE_OPTIONS, isHelpDeskManager, isITStaff
} from '../../utils/helpdeskApi';
import { useAuth } from '../../context/AuthContext';
import { HelpDeskSubNav, NextStepsGuidance } from './HelpDeskShared';

export default function CreateSupportRequest() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedAssetId = searchParams.get('assetId') || '';

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [profile, setProfile] = useState(null);
  const [options, setOptions] = useState({ categories: [], settings: null, employees: [] });
  const [files, setFiles] = useState([]);

  const [form, setForm] = useState({
    employeeId: '',
    contactNumber: '',
    categoryId: '',
    requestType: 'INCIDENT',
    priority: 'MEDIUM',
    subject: '',
    description: '',
    businessImpact: 'INDIVIDUAL_EMPLOYEE',
    businessImpactDetails: '',
    assetId: preselectedAssetId,
  });

  useEffect(() => {
    Promise.all([
      apiFetch('/helpdesk/my-profile'),
      apiFetch('/helpdesk/form-options'),
    ])
      .then(([prof, opts]) => {
        setProfile(prof);
        setOptions(opts);
        setForm((prev) => ({
          ...prev,
          employeeId: prof.employee?.id || '',
          contactNumber: prof.employee?.phone || '',
          categoryId: opts.categories?.[0]?.id || '',
          assetId: preselectedAssetId || prev.assetId,
        }));
      })
      .catch((err) => showToast(err.message, 'error'))
      .finally(() => setLoading(false));
  }, [preselectedAssetId]);

  const selectedCategory = options.categories?.find((c) => c.id === form.categoryId);
  const selectedAsset = profile?.assignedAssets?.find((a) => a.id === form.assetId);

  const selectedEmployeeObj = (isITStaff(user) || isHelpDeskManager(user)) && form.employeeId && form.employeeId !== profile?.employee?.id
    ? options.employees?.find((e) => e.id === form.employeeId)
    : profile?.employee;

  const nextTicketPreview = options.settings
    ? `${options.settings.ticketPrefix || 'HD'}-${new Date().getFullYear()}-${String(options.settings.nextSequenceNumber || 1).padStart(6, '0')} (Auto-assigned)`
    : 'Auto-generated on submit';

  const handleFileChange = (e) => {
    const chosen = Array.from(e.target.files || []);
    const merged = [...files, ...chosen].slice(0, 5);
    const oversized = merged.find((f) => f.size > 5 * 1024 * 1024);
    if (oversized) {
      showToast(`File "${oversized.name}" exceeds the 5 MB size limit.`, 'error');
      return;
    }
    setFiles(merged);
    e.target.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    if (!form.subject.trim() || !form.description.trim()) {
      showToast('Please enter both Subject and Issue Description.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => {
        if (v !== null && v !== undefined && v !== '') fd.append(k, v);
      });
      files.forEach((f) => fd.append('attachments', f));

      const created = await apiFetch('/helpdesk/tickets', {
        method: 'POST',
        body: fd,
      });

      showToast(`Support request ${created.ticketCode} submitted successfully!`, 'success');
      navigate(`/helpdesk/tickets/${created.id}`);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex h-72 items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6 pb-24 md:pb-8">
      <HelpDeskSubNav />

      <div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">
          Submit IT Support Request
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Complete the inquiry details below. Your employee profile information is automatically populated.
        </p>
      </div>

      <NextStepsGuidance
        steps={[
          'Verify your auto-populated employee contact details in Section A.',
          'Choose the most accurate Category, Priority, and Business Impact in Section B, and attach screenshots or error documents if available.',
          'After submission, you will receive a unique ticket number (e.g., HD-2026-000001) and live notifications as IT investigates and resolves your request.',
        ]}
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section A: Employee Information */}
        <div className="bg-white dark:bg-[#0d1424] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h2 className="text-sm font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
              <User className="w-4 h-4 text-blue-600" />
              Section A — Employee Information
            </h2>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400">
              Auto-Populated
            </span>
          </div>

          {(isITStaff(user) || isHelpDeskManager(user)) && options.employees?.length > 0 && (
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                Submitting On Behalf Of (IT Department Option — Audited)
              </label>
              <select
                value={form.employeeId}
                onChange={(e) => {
                  const emp = options.employees.find((x) => x.id === e.target.value);
                  setForm((p) => ({
                    ...p,
                    employeeId: e.target.value,
                    contactNumber: emp?.phone || p.contactNumber,
                  }));
                }}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">My Own Profile ({user?.fullName})</option>
                {options.employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.fullName} ({emp.employeeCode}) — {emp.department?.name || 'No Dept'}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800">
              <span className="text-[10px] font-bold uppercase text-slate-400">Ticket Number</span>
              <p className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400 mt-1">{nextTicketPreview}</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800">
              <span className="text-[10px] font-bold uppercase text-slate-400">Request Date & Time</span>
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-1">{new Date().toLocaleString()}</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800">
              <span className="text-[10px] font-bold uppercase text-slate-400">Employee Name</span>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-1">
                {selectedEmployeeObj?.fullName || user?.fullName || '—'}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800">
              <span className="text-[10px] font-bold uppercase text-slate-400">Employee ID</span>
              <p className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200 mt-1">
                {selectedEmployeeObj?.employeeCode || 'Not Linked'}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800">
              <span className="text-[10px] font-bold uppercase text-slate-400">Department</span>
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-1">
                {selectedEmployeeObj?.departmentName || selectedEmployeeObj?.department?.name || 'N/A'}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800">
              <span className="text-[10px] font-bold uppercase text-slate-400">Branch / Location</span>
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-1">
                {selectedEmployeeObj?.locationName || selectedEmployeeObj?.location?.name || 'N/A'}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800">
              <span className="text-[10px] font-bold uppercase text-slate-400">Email Address</span>
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-1 truncate">
                {selectedEmployeeObj?.email || user?.email || '—'}
              </p>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Contact Number</label>
              <input
                type="text"
                value={form.contactNumber}
                onChange={(e) => setForm((p) => ({ ...p, contactNumber: e.target.value }))}
                placeholder="e.g. 077-1234567"
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Section B: Inquiry Details */}
        <div className="bg-white dark:bg-[#0d1424] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-5 shadow-sm">
          <h2 className="text-sm font-extrabold text-slate-800 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3">
            Section B — Inquiry Details
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Request Category <span className="text-rose-500">*</span>
              </label>
              <select
                required
                value={form.categoryId}
                onChange={(e) => setForm((p) => ({ ...p, categoryId: e.target.value }))}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              >
                {options.categories?.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
              {selectedCategory?.examples && (
                <p className="text-[11px] text-slate-400 mt-1">Examples: {selectedCategory.examples}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Request Type <span className="text-rose-500">*</span>
              </label>
              <select
                required
                value={form.requestType}
                onChange={(e) => setForm((p) => ({ ...p, requestType: e.target.value }))}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              >
                {REQUEST_TYPE_OPTIONS.map((rt) => (
                  <option key={rt.value} value={rt.value}>{rt.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Priority <span className="text-rose-500">*</span>
              </label>
              <select
                required
                value={form.priority}
                onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value }))}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="LOW">Low — Minor / General</option>
                <option value="MEDIUM">Medium — Standard Issue</option>
                <option value="HIGH">High — Urgent Issue</option>
                <option value="CRITICAL">Critical — Severe Outage</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Subject <span className="text-rose-500">*</span>
            </label>
            <input
              required
              type="text"
              maxLength={180}
              value={form.subject}
              onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))}
              placeholder="Short, clear summary of your technical issue or request..."
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Issue Description <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              rows={5}
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="Describe what happened, any error messages displayed, when it started, and steps you already tried..."
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Business Impact
              </label>
              <select
                value={form.businessImpact}
                onChange={(e) => setForm((p) => ({ ...p, businessImpact: e.target.value }))}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              >
                {BUSINESS_IMPACT_OPTIONS.map((b) => (
                  <option key={b.value} value={b.value}>{b.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Impact Additional Details (Optional)
              </label>
              <input
                type="text"
                value={form.businessImpactDetails}
                onChange={(e) => setForm((p) => ({ ...p, businessImpactDetails: e.target.value }))}
                placeholder="e.g. Blocking showroom invoicing..."
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Optional Related IT Asset */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-800 space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                <MonitorSmartphone className="w-4 h-4 text-blue-600" />
                Related IT Asset (Optional — leave empty for Email, Network, ERP, or Software inquiries)
              </label>
              <select
                value={form.assetId}
                onChange={(e) => setForm((p) => ({ ...p, assetId: e.target.value }))}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">No physical IT asset linked</option>
                {profile?.assignedAssets?.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.assetCode} — {a.deviceType} ({a.brand} {a.model})
                  </option>
                ))}
              </select>
            </div>

            {selectedAsset && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-200 dark:border-slate-800 text-xs">
                <div><span className="text-slate-400 block text-[10px]">Asset ID</span><strong>{selectedAsset.assetCode}</strong></div>
                <div><span className="text-slate-400 block text-[10px]">Type / Brand</span><strong>{selectedAsset.deviceType} / {selectedAsset.brand || '-'}</strong></div>
                <div><span className="text-slate-400 block text-[10px]">Model / Serial</span><strong>{selectedAsset.model || '-'} / {selectedAsset.serialNumber || '-'}</strong></div>
                <div><span className="text-slate-400 block text-[10px]">Warranty</span><strong className="text-emerald-600">{selectedAsset.warrantyStatus}</strong></div>
              </div>
            )}
          </div>

          {/* Attachments */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
              Attachments — Screenshots / Images / Documents (Max 5 files, 5 MB each)
            </label>
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-5 cursor-pointer hover:border-blue-500 transition-colors bg-slate-50/50 dark:bg-slate-900/30">
              <Paperclip className="w-5 h-5 text-blue-600 mb-1.5" />
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Click to upload screenshots, PDFs, or supporting files
              </span>
              <span className="text-[11px] text-slate-400 mt-0.5">JPG, PNG, WEBP, PDF, DOC/DOCX, XLS/XLSX, TXT</span>
              <input
                type="file"
                multiple
                accept=".jpg,.jpeg,.png,.webp,.gif,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>

            {files.length > 0 && (
              <div className="mt-3 space-y-2">
                {files.map((f, idx) => (
                  <div key={idx} className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs">
                    <span className="truncate font-medium">{f.name} ({(f.size / 1024).toFixed(1)} KB)</span>
                    <button
                      type="button"
                      onClick={() => setFiles((prev) => prev.filter((_, i) => i !== idx))}
                      className="text-rose-500 hover:text-rose-700 p-1 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row justify-end gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {submitting ? 'Submitting Request...' : 'Submit Support Request'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
