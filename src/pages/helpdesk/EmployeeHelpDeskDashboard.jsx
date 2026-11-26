import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PlusCircle, Ticket, AlertCircle, Wrench, PauseCircle, CheckCircle2,
  Archive, Bell, MonitorSmartphone, Star, ArrowRight, Loader2, ShieldCheck, ArrowRightLeft, LifeBuoy
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { API_URL, apiFetch } from '../../utils/helpdeskApi';
import { HelpDeskSubNav, NextStepsGuidance, PriorityBadge, SlaBadge, StatusBadge } from './HelpDeskShared';

function PortalAssetThumb({ asset }) {
  const [src, setSrc] = useState(null);
  useEffect(() => {
    let active = true;
    if (!asset?.id || (!asset.imageUrl && !asset.imageStorageKey)) return;
    const token = localStorage.getItem('token');
    fetch(`${API_URL}/uploads/image/${asset.id}/view`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (active && d?.url) {
          if (d.url.startsWith('http') || d.url.startsWith('/api')) {
            setSrc(d.url);
          } else {
            const base = API_URL.replace(/\/api$/, '');
            setSrc(`${base}${d.url.startsWith('/') ? '' : '/'}${d.url}`);
          }
        }
      })
      .catch(() => {});
    return () => { active = false; };
  }, [asset?.id, asset?.imageUrl, asset?.imageStorageKey]);

  if (!src) {
    return (
      <div className="w-11 h-11 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
        <MonitorSmartphone className="w-5 h-5" />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={asset.model || asset.deviceType}
      className="w-11 h-11 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0"
      onError={() => setSrc(null)}
    />
  );
}

export default function EmployeeHelpDeskDashboard() {
  const { user, switchEmployee } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadSummary = async () => {
    try {
      const res = await apiFetch('/helpdesk/my-summary');
      setData(res);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSummary();
  }, []);

  if (loading) {
    return (
      <div className="p-6 flex h-72 flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <p className="text-xs font-medium text-slate-500">Loading your IT Help Desk portal...</p>
      </div>
    );
  }

  const counts = data?.counts || { total: 0, open: 0, inProgress: 0, pending: 0, resolved: 0, closed: 0 };
  const awaiting = data?.awaitingConfirmation || [];
  const recent = data?.recentTickets || [];
  const assignedAssets = data?.assignedAssets || [];
  const notifications = data?.notifications || [];
  const feedbackHistory = data?.feedbackHistory || [];

  const cards = [
    { label: 'My Total Requests', value: counts.total, icon: Ticket, color: 'text-blue-600 bg-blue-500/10', filter: '/helpdesk/my-requests' },
    { label: 'Open Requests', value: counts.open, icon: AlertCircle, color: 'text-rose-600 bg-rose-500/10', filter: '/helpdesk/my-requests?status=OPEN' },
    { label: 'In Progress', value: counts.inProgress, icon: Wrench, color: 'text-indigo-600 bg-indigo-500/10', filter: '/helpdesk/my-requests?status=IN_PROGRESS' },
    { label: 'Pending Requests', value: counts.pending, icon: PauseCircle, color: 'text-amber-600 bg-amber-500/10', filter: '/helpdesk/my-requests?status=PENDING' },
    { label: 'Resolved Requests', value: counts.resolved, icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-500/10', filter: '/helpdesk/my-requests?status=RESOLVED' },
    { label: 'Closed Requests', value: counts.closed, icon: Archive, color: 'text-slate-600 bg-slate-500/10', filter: '/helpdesk/my-requests?status=CLOSED' },
  ];

  const guidanceSteps = awaiting.length > 0
    ? [
        `You have ${awaiting.length} resolved request(s) awaiting your confirmation. Click a resolved ticket below to confirm whether the issue is fixed and submit your rating.`,
        'If the issue persists, select "No" to automatically reopen the ticket and alert the assigned IT officer and IT Manager.',
      ]
    : [
        'Need IT assistance? Click "Create New Support Request" to submit an incident, service request, or inquiry.',
        'For hardware issues, select your assigned device from "My Assigned IT Assets" to pre-link it automatically.',
        'Track live progress, add comments or screenshots, and receive notifications right here.',
      ];

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 pb-24 md:pb-8">
      <HelpDeskSubNav />

      {/* Hero Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-[#0d1424] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm">
        <div>
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-blue-600 dark:text-blue-400">
            Euro Motors IT Help Desk
          </span>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white mt-0.5">
            Welcome, {data?.employee?.fullName || user?.fullName}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {data?.employee
              ? `${data.employee.employeeCode} • ${data.employee.departmentName || 'Department N/A'} • ${data.employee.locationName || 'Branch N/A'}`
              : 'Submit support requests, track IT progress, and confirm resolutions.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            onClick={() => navigate('/helpdesk/new')}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-600/20 transition-all cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            General IT Support Request
          </button>
          {user?.isPortalSession && (
            <button
              onClick={async () => {
                const target = await switchEmployee();
                navigate(target);
              }}
              className="inline-flex items-center justify-center gap-2 px-4 py-3 bg-amber-50 hover:bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:hover:bg-amber-500/25 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30 rounded-xl text-sm font-bold transition-all cursor-pointer"
            >
              <ArrowRightLeft className="w-4 h-4" />
              Switch Employee
            </button>
          )}
        </div>
      </div>

      {/* What Should I Do Next? */}
      <NextStepsGuidance steps={guidanceSteps} />

      {/* Awaiting Employee Confirmation Alert */}
      {awaiting.length > 0 && (
        <div className="bg-emerald-50 dark:bg-emerald-950/25 border border-emerald-200 dark:border-emerald-500/30 rounded-2xl p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Requests Awaiting Your Confirmation ({awaiting.length})
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {awaiting.map((t) => (
              <div
                key={t.id}
                onClick={() => navigate(`/helpdesk/tickets/${t.id}`)}
                className="bg-white dark:bg-slate-900/70 border border-emerald-200/80 dark:border-emerald-500/20 rounded-xl p-3.5 flex items-center justify-between gap-3 cursor-pointer hover:border-emerald-400 transition-all"
              >
                <div className="min-w-0">
                  <span className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400">{t.ticketCode}</span>
                  <p className="text-xs font-bold text-slate-800 dark:text-white truncate">{t.subject}</p>
                  <p className="text-[11px] text-slate-500 truncate mt-0.5">
                    Action Taken: {t.actionTaken || 'Resolved by IT'}
                  </p>
                </div>
                <span className="px-3 py-1.5 bg-emerald-600 text-white text-[11px] font-bold rounded-lg shrink-0">
                  Confirm / Rate
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6 KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <button
              key={c.label}
              onClick={() => navigate(c.filter)}
              className="text-left bg-white dark:bg-[#0d1424] border border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-500/50 rounded-2xl p-4 transition-all cursor-pointer shadow-sm group"
            >
              <div className={`w-9 h-9 rounded-xl ${c.color} flex items-center justify-center mb-3`}>
                <Icon className="w-4 h-4" />
              </div>
              <p className="text-2xl font-extrabold text-slate-900 dark:text-white">{c.value}</p>
              <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                {c.label}
              </p>
            </button>
          );
        })}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Support Requests & Tracking */}
        <div className="lg:col-span-2 bg-white dark:bg-[#0d1424] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-extrabold text-slate-800 dark:text-white">Recent Support Requests</h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Live status tracking and SLA progress</p>
            </div>
            <button
              onClick={() => navigate('/helpdesk/my-requests')}
              className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              View All <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800/70">
            {recent.length === 0 ? (
              <div className="p-8 text-center">
                <Ticket className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-500">You have not submitted any support requests yet.</p>
              </div>
            ) : (
              recent.map((t) => (
                <div
                  key={t.id}
                  onClick={() => navigate(`/helpdesk/tickets/${t.id}`)}
                  className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-mono font-bold text-blue-600 dark:text-blue-400">{t.ticketCode}</span>
                      <PriorityBadge priority={t.priority} />
                      <StatusBadge status={t.status} />
                      <SlaBadge slaInfo={t.slaInfo} />
                    </div>
                    <p className="text-sm font-bold text-slate-800 dark:text-white truncate">{t.subject}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {t.category?.name || 'General'} • Assigned: {t.assignedTo?.fullName || 'Pending Assignment'} • {new Date(t.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400 shrink-0 hidden sm:block" />
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Assigned Assets, Notifications, Feedback */}
        <div className="space-y-6">
          {/* My Assigned IT Assets */}
          <div className="bg-white dark:bg-[#0d1424] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-sm font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
                <MonitorSmartphone className="w-4 h-4 text-blue-600" />
                My Assigned IT Assets ({assignedAssets.length})
              </h2>
            </div>
            <div className="p-3 space-y-2.5 max-h-80 overflow-y-auto custom-scrollbar">
              {assignedAssets.length === 0 ? (
                <div className="text-center py-5 space-y-2">
                  <p className="text-xs text-slate-500">No IT assets currently assigned to your profile.</p>
                  <button
                    onClick={() => navigate('/helpdesk/new')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 rounded-lg text-[11px] font-bold cursor-pointer"
                  >
                    <LifeBuoy className="w-3.5 h-3.5" />
                    Submit General IT Support Request
                  </button>
                </div>
              ) : (
                assignedAssets.map((a) => (
                  <div key={a.id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800 flex items-center justify-between gap-2.5">
                    <div className="flex items-center gap-3 min-w-0">
                      <PortalAssetThumb asset={a} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300">
                            {a.deviceType}
                          </span>
                          <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                            {a.status}
                          </span>
                        </div>
                        <p className="text-xs font-bold text-slate-800 dark:text-white truncate mt-1">
                          {[a.brand, a.model].filter(Boolean).join(' ') || a.deviceType}
                        </p>
                        <p className="text-[10px] font-mono text-slate-500 truncate">
                          ID: {a.assetCode} • S/N: {a.serialNumber || 'N/A'}
                        </p>
                        <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <ShieldCheck className="w-3 h-3 text-emerald-500" />
                          Allocation: {a.assignmentType || 'EMPLOYEE'} • Warranty: {a.warrantyStatus}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => navigate(`/helpdesk/new?assetId=${a.id}`)}
                      className="px-2.5 py-1.5 bg-blue-600 text-white hover:bg-blue-700 rounded-lg text-[10px] font-bold transition-colors shrink-0 cursor-pointer shadow-sm"
                    >
                      Report Issue
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Notifications */}
          <div className="bg-white dark:bg-[#0d1424] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-sm font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
                <Bell className="w-4 h-4 text-amber-500" />
                Notifications
              </h2>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800/70 max-h-56 overflow-y-auto custom-scrollbar">
              {notifications.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-5">No notifications yet.</p>
              ) : (
                notifications.slice(0, 6).map((n) => (
                  <div
                    key={n.id}
                    onClick={() => n.link && navigate(n.link)}
                    className={`p-3 text-xs cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 ${!n.isRead ? 'bg-blue-50/40 dark:bg-blue-950/20' : ''}`}
                  >
                    <p className="font-bold text-slate-800 dark:text-slate-200">{n.title}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{n.message}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recent Feedback */}
          {feedbackHistory.length > 0 && (
            <div className="bg-white dark:bg-[#0d1424] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-2.5">
              <h2 className="text-sm font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-500" />
                My Recent Feedback
              </h2>
              {feedbackHistory.map((f) => (
                <div key={f.id} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-blue-600">{f.ticketCode}</span>
                    <span className="text-amber-500 font-bold">{'★'.repeat(f.satisfactionRating || 0)}</span>
                  </div>
                  {f.employeeFeedback && <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{f.employeeFeedback}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
