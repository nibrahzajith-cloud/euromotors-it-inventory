import React, { useEffect } from 'react';
import { 
  X, History, User, Building, MapPin, Calendar, Clock, 
  CheckCircle2, AlertCircle, ArrowRight, Laptop, Monitor, 
  Printer, Smartphone, Wifi, Server, ExternalLink, ShieldCheck, FileText
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import CopyButton from './CopyButton';

function formatDisplayDate(dateStr) {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'N/A';
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch (e) {
    return 'N/A';
  }
}

function calculateDuration(startDate, endDate) {
  if (!startDate) return null;
  const start = new Date(startDate).getTime();
  const end = endDate ? new Date(endDate).getTime() : Date.now();
  if (isNaN(start) || isNaN(end) || end < start) return null;
  const diffDays = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)));
  if (diffDays < 30) return `${diffDays} day${diffDays === 1 ? '' : 's'}`;
  const months = Math.floor(diffDays / 30);
  const remDays = diffDays % 30;
  return remDays > 0 ? `${months} mo ${remDays} d` : `${months} month${months === 1 ? '' : 's'}`;
}

export default function AssetUsageHistoryModal({ asset, isOpen, onClose }) {
  const navigate = useNavigate();

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen || !asset) return null;

  // Extract all employee assignments
  const rawAssignments = Array.isArray(asset.assignments) ? [...asset.assignments] : [];
  const assignments = rawAssignments.filter(a => a && a.employee);

  // Sort descending by return date or assign date (most recent first)
  assignments.sort((a, b) => {
    const dateA = new Date(a.returnedDate || a.assignedDate || 0).getTime();
    const dateB = new Date(b.returnedDate || b.assignedDate || 0).getTime();
    return dateB - dateA;
  });

  const hasHistory = assignments.length > 0;
  const latestAssignment = hasHistory ? assignments[0] : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity" 
        onClick={onClose} 
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-3xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-8 z-10 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 text-white border-b border-slate-800 flex items-start justify-between shrink-0">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-blue-500/20 text-blue-400 border border-blue-500/30">
                Euro Motors DMS
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                {asset.status === 'AVAILABLE' ? 'Available In Store' : asset.status}
              </span>
            </div>
            <div className="flex items-center gap-3 pt-1">
              <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                <History className="w-5 h-5 text-blue-400" />
                Asset Usage & Handover History
              </h2>
            </div>
            <p className="text-xs text-slate-400">
              Complete historical record of employee allocations and returns for this device.
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            title="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Asset Summary Banner */}
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-200/70 dark:border-slate-750 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-600/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center justify-center font-bold text-lg shrink-0">
                {asset.deviceType?.[0] || 'A'}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-base text-slate-900 dark:text-white">
                    {asset.assetCode}
                  </span>
                  <CopyButton text={asset.assetCode} label="Asset Code" iconSize="w-3 h-3" className="p-1" />
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                  {asset.model || asset.deviceType} • {asset.brand || 'Euro Motors Asset'}
                </p>
                <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                  S/N: {asset.serialNumber || 'No serial'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs text-slate-600 dark:text-slate-400">
              <div className="text-right">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Total Uses</span>
                <span className="font-bold text-slate-800 dark:text-white text-sm">
                  {assignments.length} {assignments.length === 1 ? 'assignment' : 'assignments'}
                </span>
              </div>
              <div className="h-8 w-px bg-slate-200 dark:bg-slate-700" />
              <div className="text-right">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Current State</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                  Store Stock ({asset.condition || 'GOOD'})
                </span>
              </div>
            </div>
          </div>

          {/* Previous Usage Details */}
          {hasHistory ? (
            <div className="space-y-6">
              {/* Highlighted Most Recent Previous User */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                    Most Recent User (Previously Used By)
                  </h3>
                  <span className="text-[11px] font-medium text-slate-400">
                    Cycle 1 of {assignments.length}
                  </span>
                </div>

                <div className="bg-gradient-to-br from-amber-50/50 via-white to-amber-50/20 dark:from-amber-950/20 dark:via-slate-850 dark:to-slate-850 border border-amber-200/80 dark:border-amber-800/50 rounded-2xl p-5 shadow-sm space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-amber-100 dark:border-amber-900/30">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center justify-center font-bold">
                        {latestAssignment.employee.fullName?.[0] || 'U'}
                      </div>
                      <div>
                        <h4 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                          {latestAssignment.employee.fullName}
                          <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-amber-100/80 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 font-semibold">
                            {latestAssignment.employee.employeeCode || 'N/A'}
                          </span>
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {latestAssignment.employee.designation || 'Staff Member'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        Returned to Store
                      </span>
                    </div>
                  </div>

                  {/* Grid details */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-1">
                    <div className="space-y-1">
                      <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5">
                        <Building className="w-3.5 h-3.5 text-slate-400" /> Department
                      </span>
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        {latestAssignment.employee.department?.name || asset.department?.name || 'Euro Motors'}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" /> Location / Branch
                      </span>
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        {latestAssignment.employee.location?.name || asset.location?.name || 'Head Office'}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400" /> Duration of Usage
                      </span>
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        {calculateDuration(latestAssignment.assignedDate, latestAssignment.returnedDate) || 'Completed'}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" /> Assigned Date
                      </span>
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        {formatDisplayDate(latestAssignment.assignedDate)}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-emerald-500" /> Returned Date
                      </span>
                      <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                        {formatDisplayDate(latestAssignment.returnedDate)}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-slate-400" /> Return Condition
                      </span>
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        {asset.condition || 'GOOD / Inspected'}
                      </p>
                    </div>
                  </div>

                  {/* Return Remarks / Handover Notes */}
                  <div className="bg-white/80 dark:bg-slate-900/60 p-3 rounded-xl border border-amber-200/50 dark:border-amber-900/30 space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Condition & Return Remarks
                    </span>
                    <p className="text-xs text-slate-700 dark:text-slate-300 italic">
                      "{latestAssignment.remarks || 'Standard return to central store inventory upon completion of project / handover.'}"
                    </p>
                  </div>
                </div>
              </div>

              {/* Full Assignment History Timeline if multiple */}
              {assignments.length > 1 && (
                <div className="space-y-3 pt-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
                    <History className="w-3.5 h-3.5" />
                    Complete Historical Timeline ({assignments.length} Cycles)
                  </h3>

                  <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
                    {assignments.map((asg, idx) => {
                      const isLatest = idx === 0;
                      return (
                        <div key={asg.id || idx} className="relative group">
                          {/* Dot indicator */}
                          <div className={`absolute -left-6 top-1.5 w-3 h-3 rounded-full border-2 ${
                            isLatest 
                              ? 'bg-amber-500 border-white dark:border-slate-900 ring-2 ring-amber-400/30' 
                              : 'bg-slate-400 border-white dark:border-slate-900'
                          }`} />

                          <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200/60 dark:border-slate-800 space-y-2 hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-xs text-slate-900 dark:text-white">
                                  {asg.employee?.fullName || 'Unknown Employee'}
                                </span>
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-semibold">
                                  {asg.employee?.employeeCode || 'EMP'}
                                </span>
                                {isLatest && (
                                  <span className="text-[9px] font-bold uppercase tracking-wider bg-amber-500 text-white px-1.5 py-0.2 rounded">
                                    Most Recent
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] font-mono text-slate-400">
                                {formatDisplayDate(asg.assignedDate)} &rarr; {formatDisplayDate(asg.returnedDate)}
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                              <span>Dept: <strong className="text-slate-700 dark:text-slate-300">{asg.employee?.department?.name || 'N/A'}</strong></span>
                              <span>•</span>
                              <span>Location: <strong className="text-slate-700 dark:text-slate-300">{asg.employee?.location?.name || 'N/A'}</strong></span>
                              <span>•</span>
                              <span>Duration: <strong className="text-slate-700 dark:text-slate-300">{calculateDuration(asg.assignedDate, asg.returnedDate) || 'Completed'}</strong></span>
                            </div>

                            {asg.remarks && (
                              <p className="text-[11px] text-slate-600 dark:text-slate-400 bg-white/60 dark:bg-slate-900/40 p-2 rounded-lg border border-slate-150 dark:border-slate-800/80 italic">
                                Remarks: {asg.remarks}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Empty State: No Previous Assignment */
            <div className="py-12 px-6 text-center bg-slate-50/50 dark:bg-slate-800/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/60 flex items-center justify-center mx-auto">
                <Clock className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
                No Previous Assignment
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                This asset has never been assigned to any employee. It is newly added store stock and is immediately ready for deployment.
              </p>
              <div className="pt-2">
                <Link
                  to={`/assignments?assetId=${asset.id}`}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition shadow-sm"
                >
                  Assign to Employee Now
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 bg-slate-50 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <Link
              to={`/assets/${encodeURIComponent(asset.assetCode)}`}
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              View Full Asset Profile
            </Link>
          </div>

          <div className="flex items-center gap-3">
            {asset.status === 'AVAILABLE' && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  navigate(`/assignments?assetId=${asset.id}`);
                }}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors shadow-sm"
              >
                Assign Asset
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shadow-sm"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
