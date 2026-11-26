import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Loader2, User, MonitorSmartphone, Paperclip, Download, Eye,
  Clock, Send, CheckCircle2, XCircle, Star, Shield, Wrench, History, Lock, MessageSquare
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  apiFetch, downloadTicketAttachment, formatMinutes,
  isHelpDeskManager, isITStaff, BUSINESS_IMPACT_OPTIONS
} from '../../utils/helpdeskApi';
import { HelpDeskSubNav, NextStepsGuidance, PriorityBadge, SlaBadge, StatusBadge } from './HelpDeskShared';

export default function TicketDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [ticket, setTicket] = useState(null);
  const [options, setOptions] = useState({ categories: [], officers: [], settings: null });
  const [loading, setLoading] = useState(true);

  // IT Assignment state (Manager / Head of IT)
  const [assignForm, setAssignForm] = useState({
    assignedToId: '',
    priority: 'MEDIUM',
    categoryId: '',
    businessImpact: 'INDIVIDUAL_EMPLOYEE',
    note: '',
  });
  const [assigning, setAssigning] = useState(false);

  // IT Investigation & Resolution state (Section C)
  const [itForm, setItForm] = useState({
    status: 'IN_PROGRESS',
    pendingReason: '',
    investigationDetails: '',
    actionTaken: '',
    repairOrReplacementDetails: '',
    repairCost: '',
    internalRemarks: '',
    note: '',
  });
  const [savingIt, setSavingIt] = useState(false);
  const [resProofFiles, setResProofFiles] = useState([]);

  // Comment state
  const [commentMsg, setCommentMsg] = useState('');
  const [isInternalComment, setIsInternalComment] = useState(false);
  const [commentFiles, setCommentFiles] = useState([]);
  const [postingComment, setPostingComment] = useState(false);

  // Employee Confirmation state (Section D)
  const [confirmMode, setConfirmMode] = useState(true);
  const [rating, setRating] = useState(5);
  const [feedback, setFeedback] = useState('');
  const [remarks, setRemarks] = useState('');
  const [submittingConfirm, setSubmittingConfirm] = useState(false);

  const staff = isITStaff(user);
  const manager = isHelpDeskManager(user);

  const loadTicket = async () => {
    try {
      const [t, opts] = await Promise.all([
        apiFetch(`/helpdesk/tickets/${id}`),
        apiFetch('/helpdesk/form-options'),
      ]);
      setTicket(t);
      setOptions(opts);
      setAssignForm({
        assignedToId: t.assignedToId || '',
        priority: t.priority || 'MEDIUM',
        categoryId: t.categoryId || '',
        businessImpact: t.businessImpact || 'INDIVIDUAL_EMPLOYEE',
        note: '',
      });
      setItForm({
        status: t.status || 'IN_PROGRESS',
        pendingReason: t.pendingReason || '',
        investigationDetails: t.investigationDetails || '',
        actionTaken: t.actionTaken || '',
        repairOrReplacementDetails: t.repairOrReplacementDetails || '',
        repairCost: t.repairCost ?? '',
        internalRemarks: t.internalRemarks || '',
        note: '',
      });
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTicket();
  }, [id]);

  const handleAssignSubmit = async (e) => {
    e.preventDefault();
    setAssigning(true);
    try {
      await apiFetch(`/helpdesk/tickets/${id}/assign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(assignForm),
      });
      showToast('Ticket assignment and review updated.', 'success');
      await loadTicket();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setAssigning(false);
    }
  };

  const handleItStatusSubmit = async (e) => {
    e.preventDefault();
    setSavingIt(true);
    try {
      if (resProofFiles.length > 0) {
        const fd = new FormData();
        fd.append('isResolutionProof', 'true');
        resProofFiles.forEach((f) => fd.append('attachments', f));
        await apiFetch(`/helpdesk/tickets/${id}/attachments`, { method: 'POST', body: fd });
        setResProofFiles([]);
      }

      await apiFetch(`/helpdesk/tickets/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(itForm),
      });
      showToast('Ticket workflow and IT records updated.', 'success');
      await loadTicket();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSavingIt(false);
    }
  };

  const handlePostComment = async (e) => {
    e.preventDefault();
    if (!commentMsg.trim()) return;
    setPostingComment(true);
    try {
      const fd = new FormData();
      fd.append('message', commentMsg.trim());
      fd.append('isInternal', String(staff && isInternalComment));
      commentFiles.forEach((f) => fd.append('attachments', f));

      await apiFetch(`/helpdesk/tickets/${id}/comments`, { method: 'POST', body: fd });
      setCommentMsg('');
      setCommentFiles([]);
      setIsInternalComment(false);
      showToast('Update posted.', 'success');
      await loadTicket();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setPostingComment(false);
    }
  };

  const handleConfirmSubmit = async (e) => {
    e.preventDefault();
    setSubmittingConfirm(true);
    try {
      await apiFetch(`/helpdesk/tickets/${id}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirmed: confirmMode,
          satisfactionRating: confirmMode ? rating : null,
          employeeFeedback: feedback,
          employeeRemarks: remarks,
        }),
      });
      showToast(
        confirmMode ? 'Thank you! Ticket confirmed and closed.' : 'Ticket reopened and IT team notified.',
        confirmMode ? 'success' : 'warning'
      );
      await loadTicket();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSubmittingConfirm(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex h-72 items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="p-6 max-w-4xl mx-auto text-center space-y-4">
        <p className="text-sm text-rose-500 font-bold">Ticket not found or access denied.</p>
        <button onClick={() => navigate(-1)} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold">
          Go Back
        </button>
      </div>
    );
  }

  // Context-aware "What Should I Do Next?" guidance
  const getNextSteps = () => {
    if (ticket.status === 'RESOLVED') {
      if (!staff || ticket.requesterUserId === user?.id) {
        return [
          'Review the IT department resolution summary ("Action Taken") below.',
          'In Section D (Employee Confirmation), select "Yes" with a 1–5 star rating to close the ticket, or select "No" to reopen it automatically.',
        ];
      }
      return ['Awaiting employee confirmation and satisfaction rating. An automatic reminder is tracked if unresolved.'];
    }
    if (ticket.status === 'OPEN' || ticket.status === 'REOPENED') {
      return manager
        ? [
            'Verify the Category, Priority, and Business Impact in the IT Manager Review panel.',
            'Assign an available IT Officer to transition this ticket to Assigned and start tracking SLA response.',
          ]
        : ['Your request has been logged. An IT Manager will review and assign an IT Officer shortly.'];
    }
    if (ticket.status === 'ASSIGNED' || ticket.status === 'IN_PROGRESS') {
      return staff
        ? [
            'Review the issue description, attachments, and any linked Asset History.',
            'Update status to In Progress while investigating, or Pending (with a reason) if waiting on employee/vendor/parts.',
            'Once fixed, fill in Investigation Details + Action Taken and change status to Resolved.',
          ]
        : ['An IT Officer is actively investigating your issue. Use the Comment section below to share any additional details.'];
    }
    if (ticket.status === 'PENDING') {
      return [
        `Ticket is currently Paused (${ticket.pendingReason || 'Pending dependency'}).`,
        staff ? 'Resume status to In Progress once the pending dependency is cleared.' : 'Please respond via Comments if IT requested additional information from you.',
      ];
    }
    return ['This ticket is closed and archived. All metrics and asset support history have been updated.'];
  };

  const pauseReasons = options.settings?.allowedPauseReasons || [
    'Awaiting Employee Response',
    'Awaiting Vendor / Third-Party',
    'Awaiting Spare Parts',
    'Awaiting Management Approval',
  ];

  const isRequesterOrEmployee =
    ticket.requesterUserId === user?.id ||
    (user?.employeeId && ticket.employeeId === user.employeeId) ||
    !staff;

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6 pb-24 md:pb-8">
      <HelpDeskSubNav />

      {/* Top Title Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-[#0d1424] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-mono font-extrabold text-blue-600 dark:text-blue-400">{ticket.ticketCode}</span>
              <PriorityBadge priority={ticket.priority} />
              <StatusBadge status={ticket.status} />
              <SlaBadge slaInfo={ticket.slaInfo} />
            </div>
            <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white mt-1.5">{ticket.subject}</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {ticket.category?.name || 'General'} • {ticket.requestType?.replace('_', ' ')} • Impact: {ticket.businessImpact?.replace(/_/g, ' ')}
            </p>
          </div>
        </div>
      </div>

      {/* What Should I Do Next? */}
      <NextStepsGuidance steps={getNextSteps()} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Left 2 Columns */}
        <div className="lg:col-span-2 space-y-6">
          {/* Section A & B Details */}
          <div className="bg-white dark:bg-[#0d1424] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-5 shadow-sm">
            <h2 className="text-sm font-extrabold text-slate-800 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3">
              Request & Inquiry Details
            </h2>
            <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
              {ticket.description}
            </p>
            {ticket.businessImpactDetails && (
              <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-500/20 text-xs">
                <strong className="text-amber-800 dark:text-amber-300">Business Impact Details: </strong>
                <span className="text-amber-700 dark:text-amber-200">{ticket.businessImpactDetails}</span>
              </div>
            )}

            {/* Attachments */}
            {ticket.attachments?.length > 0 && (
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Paperclip className="w-3.5 h-3.5" /> Attachments ({ticket.attachments.length})
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {ticket.attachments.map((att) => (
                    <div key={att.id} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800 text-xs">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">{att.fileName}</p>
                        <p className="text-[10px] text-slate-400">
                          {(att.fileSize / 1024).toFixed(1)} KB {att.isResolutionProof ? '• Resolution Proof' : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => downloadTicketAttachment(att.id, att.fileName, true)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg cursor-pointer"
                          title="Preview"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => downloadTicketAttachment(att.id, att.fileName, false)}
                          className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
                          title="Download"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Resolution Summary visible to Employee once provided */}
            {(ticket.investigationDetails || ticket.actionTaken) && (
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  IT Investigation & Resolution Summary
                </h3>
                {ticket.investigationDetails && (
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 text-xs">
                    <span className="font-bold text-slate-500 block mb-1">Investigation Details</span>
                    <p className="text-slate-800 dark:text-slate-200 whitespace-pre-wrap">{ticket.investigationDetails}</p>
                  </div>
                )}
                {ticket.actionTaken && (
                  <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-500/20 text-xs">
                    <span className="font-bold text-emerald-700 dark:text-emerald-400 block mb-1">Action Taken</span>
                    <p className="text-slate-800 dark:text-slate-200 whitespace-pre-wrap">{ticket.actionTaken}</p>
                  </div>
                )}
                {ticket.repairOrReplacementDetails && (
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 text-xs">
                    <span className="font-bold text-slate-500 block mb-1">Repair / Replacement Details</span>
                    <p className="text-slate-800 dark:text-slate-200">{ticket.repairOrReplacementDetails}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Section D: Employee Confirmation (Shown when RESOLVED) */}
          {ticket.status === 'RESOLVED' && isRequesterOrEmployee && (
            <form onSubmit={handleConfirmSubmit} className="bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-500/30 rounded-2xl p-5 sm:p-6 space-y-4">
              <h2 className="text-sm font-extrabold text-emerald-900 dark:text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5" />
                Section D — Employee Resolution Confirmation
              </h2>
              <p className="text-xs text-emerald-800 dark:text-emerald-200">
                Please confirm whether your issue has been resolved satisfactorily.
              </p>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setConfirmMode(true)}
                  className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold border flex items-center justify-center gap-2 cursor-pointer ${
                    confirmMode
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" /> Yes — Issue Resolved
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmMode(false)}
                  className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold border flex items-center justify-center gap-2 cursor-pointer ${
                    !confirmMode
                      ? 'bg-rose-600 text-white border-rose-600'
                      : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <XCircle className="w-4 h-4" /> No — Reopen Ticket
                </button>
              </div>

              {confirmMode && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Satisfaction Rating (1–5 Stars)
                  </label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setRating(s)}
                        className={`p-2 rounded-xl border transition-all cursor-pointer ${
                          s <= rating
                            ? 'bg-amber-400/20 border-amber-400 text-amber-500'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-400'
                        }`}
                      >
                        <Star className={`w-5 h-5 ${s <= rating ? 'fill-amber-400' : ''}`} />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {confirmMode ? 'Employee Feedback' : 'Reason Issue Remains Unresolved (Required)'}
                </label>
                <textarea
                  required={!confirmMode}
                  rows={3}
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder={confirmMode ? 'Share feedback about the IT support experience...' : 'Explain what is still not working...'}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Additional Remarks (Optional)</label>
                <input
                  type="text"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={submittingConfirm}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold text-white cursor-pointer flex items-center gap-2 ${
                  confirmMode ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {submittingConfirm && <Loader2 className="w-4 h-4 animate-spin" />}
                {confirmMode ? 'Confirm Resolution & Close Ticket' : 'Submit & Reopen Ticket'}
              </button>
            </form>
          )}

          {/* Section C: IT Department Use Only (NEVER visible to normal employees) */}
          {staff && (
            <div className="bg-white dark:bg-[#0d1424] border border-blue-200 dark:border-blue-500/30 rounded-2xl p-5 sm:p-6 space-y-6 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h2 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <Shield className="w-4 h-4 text-blue-600" />
                  Section C — IT Department Use Only
                </h2>
                <span className="text-[10px] font-bold uppercase px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Restricted to IT
                </span>
              </div>

              {/* Manager Assignment & Priority Review */}
              {manager && (
                <form onSubmit={handleAssignSubmit} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-3">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    IT Manager Review & Officer Assignment
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-1">Assign IT Officer</label>
                      <select
                        value={assignForm.assignedToId}
                        onChange={(e) => setAssignForm((p) => ({ ...p, assignedToId: e.target.value }))}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-2 text-xs"
                      >
                        <option value="">-- Unassigned --</option>
                        {options.officers?.map((o) => (
                          <option key={o.id} value={o.id}>{o.fullName} ({o.role})</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-1">Adjust Priority</label>
                      <select
                        value={assignForm.priority}
                        onChange={(e) => setAssignForm((p) => ({ ...p, priority: e.target.value }))}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-2 text-xs"
                      >
                        <option value="LOW">Low</option>
                        <option value="MEDIUM">Medium</option>
                        <option value="HIGH">High</option>
                        <option value="CRITICAL">Critical</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-1">Category</label>
                      <select
                        value={assignForm.categoryId}
                        onChange={(e) => setAssignForm((p) => ({ ...p, categoryId: e.target.value }))}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-2 text-xs"
                      >
                        {options.categories?.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-1">Business Impact</label>
                      <select
                        value={assignForm.businessImpact}
                        onChange={(e) => setAssignForm((p) => ({ ...p, businessImpact: e.target.value }))}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-2 text-xs"
                      >
                        {BUSINESS_IMPACT_OPTIONS.map((b) => (
                          <option key={b.value} value={b.value}>{b.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={assigning}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1.5"
                    >
                      {assigning && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      Save Assignment & Review
                    </button>
                  </div>
                </form>
              )}

              {/* Investigation, Workflow Status & Resolution */}
              <form onSubmit={handleItStatusSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Ticket Status</label>
                    <select
                      value={itForm.status}
                      onChange={(e) => setItForm((p) => ({ ...p, status: e.target.value }))}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs"
                    >
                      <option value="OPEN">Open</option>
                      <option value="ASSIGNED">Assigned</option>
                      <option value="IN_PROGRESS">In Progress</option>
                      <option value="PENDING">Pending (Requires Reason)</option>
                      <option value="RESOLVED">Resolved</option>
                      {manager && <option value="CLOSED">Closed</option>}
                      <option value="REOPENED">Reopened</option>
                    </select>
                  </div>

                  {itForm.status === 'PENDING' && (
                    <div>
                      <label className="block text-xs font-bold text-amber-600 mb-1">
                        Pending Reason <span className="text-rose-500">*</span>
                      </label>
                      <select
                        required
                        value={itForm.pendingReason}
                        onChange={(e) => setItForm((p) => ({ ...p, pendingReason: e.target.value }))}
                        className="w-full bg-amber-50 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-500/40 rounded-xl px-3 py-2 text-xs"
                      >
                        <option value="">-- Select Pending Reason --</option>
                        {pauseReasons.map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Investigation Details</label>
                  <textarea
                    rows={3}
                    value={itForm.investigationDetails}
                    onChange={(e) => setItForm((p) => ({ ...p, investigationDetails: e.target.value }))}
                    placeholder="Root cause, diagnostic findings..."
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Action Taken {itForm.status === 'RESOLVED' && <span className="text-rose-500">*</span>}
                  </label>
                  <textarea
                    rows={3}
                    value={itForm.actionTaken}
                    onChange={(e) => setItForm((p) => ({ ...p, actionTaken: e.target.value }))}
                    placeholder="Steps performed to fix the issue..."
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Repair / Replacement Details</label>
                    <input
                      type="text"
                      value={itForm.repairOrReplacementDetails}
                      onChange={(e) => setItForm((p) => ({ ...p, repairOrReplacementDetails: e.target.value }))}
                      placeholder="Parts replaced or external vendor..."
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Repair Cost (LKR, if applicable)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={itForm.repairCost}
                      onChange={(e) => setItForm((p) => ({ ...p, repairCost: e.target.value }))}
                      placeholder="0.00"
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-rose-600 dark:text-rose-400 mb-1">
                    Internal IT Remarks (Hidden from Employees)
                  </label>
                  <textarea
                    rows={2}
                    value={itForm.internalRemarks}
                    onChange={(e) => setItForm((p) => ({ ...p, internalRemarks: e.target.value }))}
                    placeholder="Internal IT team remarks..."
                    className="w-full bg-rose-50/40 dark:bg-rose-950/15 border border-rose-200 dark:border-rose-500/30 rounded-xl px-3.5 py-2 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Supporting / Resolution Proof Files (Optional)
                  </label>
                  <input
                    type="file"
                    multiple
                    onChange={(e) => setResProofFiles(Array.from(e.target.files || []).slice(0, 5))}
                    className="text-xs text-slate-500"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={savingIt}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer"
                  >
                    {savingIt && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Save IT Update
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Conversation & Comments */}
          <div className="bg-white dark:bg-[#0d1424] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4 shadow-sm">
            <h2 className="text-sm font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-blue-600" />
              Updates & Additional Information ({ticket.comments?.length || 0})
            </h2>

            <div className="space-y-3 max-h-80 overflow-y-auto custom-scrollbar">
              {ticket.comments?.map((c) => (
                <div
                  key={c.id}
                  className={`p-3.5 rounded-xl border text-xs ${
                    c.isInternal
                      ? 'bg-amber-50/70 dark:bg-amber-950/20 border-amber-200 dark:border-amber-500/30'
                      : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200/70 dark:border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-slate-800 dark:text-white">
                      {c.authorName} <span className="text-[10px] font-normal text-slate-400">({c.authorRole})</span>
                    </span>
                    <div className="flex items-center gap-2">
                      {c.isInternal && (
                        <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300">
                          Internal Note
                        </span>
                      )}
                      <span className="text-[10px] text-slate-400">{new Date(c.createdAt).toLocaleString()}</span>
                    </div>
                  </div>
                  <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{c.message}</p>
                </div>
              ))}
            </div>

            <form onSubmit={handlePostComment} className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <textarea
                rows={2}
                value={commentMsg}
                onChange={(e) => setCommentMsg(e.target.value)}
                placeholder="Add a comment or additional information..."
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-4">
                  <input
                    type="file"
                    multiple
                    onChange={(e) => setCommentFiles(Array.from(e.target.files || []).slice(0, 5))}
                    className="text-[11px] text-slate-500 max-w-[200px]"
                  />
                  {staff && (
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isInternalComment}
                        onChange={(e) => setIsInternalComment(e.target.checked)}
                      />
                      Internal IT Note only
                    </label>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={postingComment}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" /> Post Update
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right Sidebar Column: Metadata, SLA Metrics, Linked Asset, Lifecycle Timeline */}
        <div className="space-y-6">
          {/* Requester & SLA Metrics */}
          <div className="bg-white dark:bg-[#0d1424] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3 text-xs shadow-sm">
            <h3 className="font-extrabold text-slate-800 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
              <User className="w-4 h-4 text-blue-600" />
              Requester & SLA Telemetry
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between"><span className="text-slate-400">Employee</span><strong>{ticket.requesterName || '—'}</strong></div>
              <div className="flex justify-between"><span className="text-slate-400">Employee ID</span><strong className="font-mono">{ticket.requesterEmployeeCode || '—'}</strong></div>
              <div className="flex justify-between"><span className="text-slate-400">Department</span><strong>{ticket.department?.name || '—'}</strong></div>
              <div className="flex justify-between"><span className="text-slate-400">Branch</span><strong>{ticket.location?.name || '—'}</strong></div>
              <div className="flex justify-between"><span className="text-slate-400">Contact</span><strong>{ticket.contactNumber || '—'}</strong></div>
              <div className="flex justify-between"><span className="text-slate-400">Assigned Officer</span><strong>{ticket.assignedTo?.fullName || 'Unassigned'}</strong></div>
              <div className="flex justify-between"><span className="text-slate-400">Date Assigned</span><strong>{ticket.assignedAt ? new Date(ticket.assignedAt).toLocaleString() : '—'}</strong></div>
              <div className="flex justify-between pt-2 border-t border-slate-100 dark:border-slate-800"><span className="text-slate-400">First Response</span><strong>{formatMinutes(ticket.firstResponseMinutes)}</strong></div>
              <div className="flex justify-between"><span className="text-slate-400">Resolution Time</span><strong>{formatMinutes(ticket.resolutionMinutes)}</strong></div>
              <div className="flex justify-between"><span className="text-slate-400">Resolution Due</span><strong>{ticket.resolutionDueAt ? new Date(ticket.resolutionDueAt).toLocaleString() : '—'}</strong></div>
              <div className="flex justify-between"><span className="text-slate-400">Paused Time</span><strong>{formatMinutes(ticket.slaTotalPausedMinutes || 0)}</strong></div>
              {ticket.satisfactionRating != null && (
                <div className="flex justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400">Employee Rating</span>
                  <strong className="text-amber-500">{'★'.repeat(ticket.satisfactionRating)} ({ticket.satisfactionRating}/5)</strong>
                </div>
              )}
            </div>
          </div>

          {/* Linked Asset Card + Asset History for IT */}
          {ticket.asset && (
            <div className="bg-white dark:bg-[#0d1424] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3 text-xs shadow-sm">
              <h3 className="font-extrabold text-slate-800 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
                <MonitorSmartphone className="w-4 h-4 text-blue-600" />
                Linked IT Asset
              </h3>
              <div className="space-y-1.5">
                <div className="flex justify-between"><span className="text-slate-400">Asset ID</span><strong className="font-mono text-blue-600">{ticket.asset.assetCode}</strong></div>
                <div className="flex justify-between"><span className="text-slate-400">Type / Brand</span><strong>{ticket.asset.deviceType} / {ticket.asset.brand || '—'}</strong></div>
                <div className="flex justify-between"><span className="text-slate-400">Model</span><strong>{ticket.asset.model || '—'}</strong></div>
                <div className="flex justify-between"><span className="text-slate-400">Serial No</span><strong className="font-mono">{ticket.asset.serialNumber || '—'}</strong></div>
                <div className="flex justify-between"><span className="text-slate-400">Warranty</span><strong>{ticket.asset.warrantyStatus}</strong></div>
              </div>
              {staff && (
                <button
                  onClick={() => navigate(`/assets/${ticket.asset.assetCode}`)}
                  className="w-full py-2 mt-2 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold hover:bg-blue-100 cursor-pointer"
                >
                  Open Asset Profile
                </button>
              )}
              {staff && ticket.assetHistory?.pastTickets?.length > 0 && (
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                  <p className="text-[10px] font-bold uppercase text-slate-400">Previous Asset Tickets</p>
                  {ticket.assetHistory.pastTickets.slice(0, 4).map((pt) => (
                    <div key={pt.id} onClick={() => navigate(`/helpdesk/tickets/${pt.id}`)} className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900/60 cursor-pointer hover:bg-slate-100">
                      <span className="font-mono font-bold text-blue-600">{pt.ticketCode}</span> — {pt.subject}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Visual Lifecycle Timeline (Section 11) */}
          <div className="bg-white dark:bg-[#0d1424] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 shadow-sm">
            <h3 className="text-xs font-extrabold text-slate-800 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
              <History className="w-4 h-4 text-blue-600" />
              Ticket Lifecycle Timeline
            </h3>
            <div className="relative pl-5 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
              {ticket.statusHistory?.map((h) => (
                <div key={h.id} className="relative text-xs">
                  <span className="absolute -left-[17px] top-1 w-2.5 h-2.5 rounded-full bg-blue-600 ring-4 ring-white dark:ring-[#0d1424]" />
                  <p className="font-bold text-slate-800 dark:text-white">
                    {h.fromStatus ? `${h.fromStatus} → ` : ''}{h.toStatus}
                  </p>
                  {h.reason && <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">{h.reason}</p>}
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {h.changedByName || 'System'} • {new Date(h.createdAt).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
