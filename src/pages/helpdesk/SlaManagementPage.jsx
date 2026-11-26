import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Timer, ShieldAlert, Clock, Loader2, Settings, CheckCircle2 } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { apiFetch, formatMinutes } from '../../utils/helpdeskApi';
import { HelpDeskSubNav, PriorityBadge, SlaBadge, StatusBadge } from './HelpDeskShared';

export default function SlaManagementPage() {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch('/helpdesk/sla/overview')
      .then(setData)
      .catch((err) => showToast(err.message, 'error'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-6 flex h-72 items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const rules = data?.rules || [];
  const monitored = data?.monitoredTickets || [];
  const breachLogs = data?.breachLogs || [];
  const wh = data?.settings?.workingHours || {};

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 pb-24 md:pb-8">
      <HelpDeskSubNav />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2.5">
            <Timer className="w-6 h-6 text-blue-600" />
            SLA Management & Escalation Monitor
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Working Hours: {wh.start || '08:30'} – {wh.end || '17:30'} • Holidays Configured: {data?.settings?.holidays?.length || 0}
          </p>
        </div>
        <button
          onClick={() => navigate('/helpdesk/settings')}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
        >
          <Settings className="w-4 h-4" /> Configure SLA Rules
        </button>
      </div>

      {/* SLA Rules Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {rules.map((r) => (
          <div key={r.id} className="bg-white dark:bg-[#0d1424] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-2 shadow-sm">
            <div className="flex items-center justify-between">
              <PriorityBadge priority={r.priority} />
              <span className="text-[10px] font-bold text-slate-400">Warn @ {r.warningThresholdPercent}%</span>
            </div>
            <div className="pt-2 space-y-1 text-xs">
              <div className="flex justify-between"><span className="text-slate-500">First Response:</span><strong>{formatMinutes(r.firstResponseMinutes)}</strong></div>
              <div className="flex justify-between"><span className="text-slate-500">Target Resolution:</span><strong>{formatMinutes(r.resolutionMinutes)}</strong></div>
              <div className="flex justify-between"><span className="text-slate-500">Escalation Delay:</span><strong>{formatMinutes(r.escalateAfterBreachMinutes)}</strong></div>
            </div>
          </div>
        ))}
      </div>

      {/* Active SLA Monitored Queue */}
      <div className="bg-white dark:bg-[#0d1424] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-sm font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-600" />
            Active Tickets SLA Watch ({monitored.length})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-900/70 text-[10px] font-bold uppercase text-slate-500 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3">Ticket #</th>
                <th className="px-4 py-3">Subject</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">SLA Status</th>
                <th className="px-4 py-3">Resolution Due</th>
                <th className="px-4 py-3">Assigned Officer</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
              {monitored.length === 0 ? (
                <tr><td colSpan={7} className="p-6 text-center text-slate-400">No active tickets under SLA monitoring.</td></tr>
              ) : (
                monitored.map((t) => (
                  <tr key={t.id} onClick={() => navigate(`/helpdesk/tickets/${t.id}`)} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer">
                    <td className="px-4 py-3 font-mono font-bold text-blue-600">{t.ticketCode}</td>
                    <td className="px-4 py-3 font-semibold text-slate-800 dark:text-white max-w-xs truncate">{t.subject}</td>
                    <td className="px-4 py-3"><PriorityBadge priority={t.priority} /></td>
                    <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                    <td className="px-4 py-3"><SlaBadge slaInfo={t.slaInfo} /></td>
                    <td className="px-4 py-3 text-slate-500">{t.resolutionDueAt ? new Date(t.resolutionDueAt).toLocaleString() : '—'}</td>
                    <td className="px-4 py-3">{t.assignedTo?.fullName || 'Unassigned'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SLA Breach History */}
      <div className="bg-white dark:bg-[#0d1424] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-sm font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-500" />
            SLA Breach & Escalation History ({breachLogs.length})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-900/70 text-[10px] font-bold uppercase text-slate-500 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3">Ticket #</th>
                <th className="px-4 py-3">Breach Type</th>
                <th className="px-4 py-3">Due At</th>
                <th className="px-4 py-3">Breached At</th>
                <th className="px-4 py-3">Overdue</th>
                <th className="px-4 py-3">Escalated To</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
              {breachLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-emerald-600 font-semibold">
                    <CheckCircle2 className="w-5 h-5 inline mr-1.5" /> Zero SLA breaches recorded!
                  </td>
                </tr>
              ) : (
                breachLogs.map((b) => (
                  <tr key={b.id} onClick={() => navigate(`/helpdesk/tickets/${b.ticketId}`)} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer">
                    <td className="px-4 py-3 font-mono font-bold text-blue-600">{b.ticket?.ticketCode || '—'}</td>
                    <td className="px-4 py-3 font-semibold">{b.breachType}</td>
                    <td className="px-4 py-3">{new Date(b.dueAt).toLocaleString()}</td>
                    <td className="px-4 py-3">{new Date(b.breachedAt).toLocaleString()}</td>
                    <td className="px-4 py-3 font-bold text-rose-600">{formatMinutes(b.overdueMinutes)}</td>
                    <td className="px-4 py-3">{b.escalatedToName || 'Head of IT'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
