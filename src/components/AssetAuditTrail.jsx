import React from 'react';
import { ShieldCheck, Loader2, User, ArrowRight } from 'lucide-react';

export default function AssetAuditTrail({ auditLogs, loading }) {
  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-12 text-center">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-2" />
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading asset governance audit trail...</p>
      </div>
    );
  }

  if (!auditLogs || auditLogs.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-12 text-center">
        <ShieldCheck className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
        <h3 className="text-base font-bold text-slate-800 dark:text-white mb-1">No Audit Records Yet</h3>
        <p className="text-slate-500 dark:text-slate-400 text-xs">All lifecycle modifications and actor actions on this asset will be permanently recorded here.</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
      <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/40">
        <div>
          <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-blue-500" />
            Asset Lifecycle Governance Trail
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Tamper-evident chronological audit of all modifications, assignments, and transfers.
          </p>
        </div>
        <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-full bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
          {auditLogs.length} Events
        </span>
      </div>

      <div className="p-6 space-y-4">
        {auditLogs.map((log) => {
          const d = new Date(log.createdAt);
          const slt = d.toLocaleString('en-GB', {
            timeZone: 'Asia/Colombo',
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
          });

          return (
            <div 
              key={log.id} 
              className="p-4 rounded-xl bg-slate-50/80 dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-700/80 space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold border ${
                    log.action === 'CREATE' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800' :
                    log.action === 'UPDATE' ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border-blue-300 dark:border-blue-800' :
                    log.action === 'ASSIGN' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400 border-indigo-300 dark:border-indigo-800' :
                    log.action === 'RETURN' ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400 border-purple-300 dark:border-purple-800' :
                    'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-600'
                  }`}>
                    {log.action}
                  </span>
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {log.description}
                  </span>
                </div>
                <span className="font-mono text-xs text-slate-500 dark:text-slate-400 shrink-0">
                  {slt} (SLT)
                </span>
              </div>

              {/* Before/After Field Diffs */}
              {Array.isArray(log.changedFields) && log.changedFields.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Recorded Changes ({log.changedFields.length})
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {log.changedFields.map((change, idx) => (
                      <div key={idx} className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs">
                        <span className="font-mono font-bold text-slate-700 dark:text-slate-300 uppercase text-[10px] block">
                          {change.field}
                        </span>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="font-mono text-rose-600 dark:text-rose-400 line-through text-[11px] bg-rose-50 dark:bg-rose-950/40 px-1 rounded truncate max-w-[140px]">
                            {change.from !== null && change.from !== undefined ? String(change.from) : 'null'}
                          </span>
                          <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="font-mono text-emerald-600 dark:text-emerald-400 text-[11px] bg-emerald-50 dark:bg-emerald-950/40 px-1 rounded truncate max-w-[140px]">
                            {change.to !== null && change.to !== undefined ? String(change.to) : 'null'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actor & Technical Footprint */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-700/60 text-[11px] text-slate-500 dark:text-slate-400">
                <div className="flex items-center gap-2">
                  <User className="w-3.5 h-3.5 text-blue-500" />
                  <span>
                    Performed by: <strong className="text-slate-700 dark:text-slate-200">{log.userName || 'System Service'}</strong>
                    {log.userRole && <span className="ml-1 uppercase text-[10px] text-slate-400">({log.userRole})</span>}
                  </span>
                  {log.activityType && (
                    <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                      {log.activityType}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 font-mono text-[10px]">
                  <span>IP: {log.ipAddress || 'Internal'}</span>
                  <span>Correlation: {log.correlationId ? log.correlationId.slice(-8) : log.id.slice(-8)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
