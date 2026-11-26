import { useState, useEffect } from 'react';
import { Users, Loader2, Star, ShieldCheck, AlertTriangle } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { apiFetch, formatMinutes } from '../../utils/helpdeskApi';
import { HelpDeskSubNav } from './HelpDeskShared';

export default function TechnicianPerformancePage() {
  const { showToast } = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch('/helpdesk/technicians/performance')
      .then(setRows)
      .catch((err) => showToast(err.message, 'error'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 pb-24 md:pb-8">
      <HelpDeskSubNav />

      <div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2.5">
          <Users className="w-6 h-6 text-blue-600" />
          Technician Performance Dashboard
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Evaluates IT officers across SLA compliance, complexity & business-impact weighted workload, satisfaction rating, and response speed.
        </p>
      </div>

      {loading ? (
        <div className="flex h-60 items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : (
        <div className="bg-white dark:bg-[#0d1424] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900/70 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3.5">IT Officer</th>
                  <th className="px-4 py-3.5">Total Assigned</th>
                  <th className="px-4 py-3.5">Completed</th>
                  <th className="px-4 py-3.5">In Progress</th>
                  <th className="px-4 py-3.5">Pending</th>
                  <th className="px-4 py-3.5">Overdue</th>
                  <th className="px-4 py-3.5">Avg Response</th>
                  <th className="px-4 py-3.5">Avg Resolution</th>
                  <th className="px-4 py-3.5">SLA %</th>
                  <th className="px-4 py-3.5">Rating</th>
                  <th className="px-4 py-3.5">Reopened</th>
                  <th className="px-4 py-3.5">Workload / Complexity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                {rows.map((r) => (
                  <tr key={r.officer.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3.5">
                      <p className="font-bold text-slate-800 dark:text-white">{r.officer.fullName}</p>
                      <p className="text-[10px] text-slate-400">{r.officer.role}</p>
                    </td>
                    <td className="px-4 py-3.5 font-bold">{r.totalAssigned}</td>
                    <td className="px-4 py-3.5 text-emerald-600 font-bold">{r.completed}</td>
                    <td className="px-4 py-3.5 text-blue-600 font-bold">{r.inProgress}</td>
                    <td className="px-4 py-3.5 text-amber-600 font-bold">{r.pending}</td>
                    <td className="px-4 py-3.5">
                      <span className={`font-bold ${r.overdue > 0 ? 'text-rose-600' : 'text-slate-500'}`}>{r.overdue}</span>
                    </td>
                    <td className="px-4 py-3.5">{formatMinutes(r.avgResponseMinutes)}</td>
                    <td className="px-4 py-3.5">{formatMinutes(r.avgResolutionMinutes)}</td>
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center gap-1 font-bold text-emerald-600">
                        <ShieldCheck className="w-3.5 h-3.5" /> {r.slaComplianceRate}%
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center gap-1 font-bold text-amber-500">
                        <Star className="w-3.5 h-3.5 fill-amber-400" /> {r.satisfactionRating || 'N/A'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 font-bold text-orange-600">{r.reopenedCount}</td>
                    <td className="px-4 py-3.5">
                      <span className="font-bold text-slate-800 dark:text-white">{r.currentWorkload} active</span>
                      <span className="text-[10px] text-slate-400 block">Impact Score: {r.weightedComplexityScore}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
