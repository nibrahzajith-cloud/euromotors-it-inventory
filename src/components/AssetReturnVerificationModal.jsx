import { useState } from 'react';
import { X, CheckCircle2, AlertTriangle, XCircle, RotateCcw, PackageCheck, ShieldAlert } from 'lucide-react';

const RETURN_STATUSES = [
  { value: 'Returned', label: 'Returned', color: 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800' },
  { value: 'Missing', label: 'Missing', color: 'bg-red-50 text-red-700 border-red-300 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800' },
  { value: 'Damaged', label: 'Damaged', color: 'bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800' },
  { value: 'Not Returned', label: 'Not Returned', color: 'bg-orange-50 text-orange-700 border-orange-300 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-800' }
];

export default function AssetReturnVerificationModal({ assignment, onClose, onConfirm }) {
  if (!assignment) return null;

  const asset = assignment.asset || {};
  const employee = assignment.employee || {};

  // Normalize originally issued accessories
  const originalAccessories = (Array.isArray(assignment.accessories) && assignment.accessories.length > 0)
    ? assignment.accessories.map(acc => {
        const name = typeof acc === 'string' ? acc : acc.name;
        const sn = typeof acc === 'object' ? acc.serialNumber : '';
        return { name, serialNumber: sn, status: 'Returned', notes: '' };
      })
    : [
        { name: 'Charger', serialNumber: '', status: 'Returned', notes: '' },
        { name: 'Laptop Backpack / Bag', serialNumber: '', status: 'Returned', notes: '' }
      ];

  const [accessoryStatuses, setAccessoryStatuses] = useState(originalAccessories);
  const [returnRemarks, setReturnRemarks] = useState('');
  const [condition, setCondition] = useState(asset.condition || 'Good');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleStatusChange = (index, newStatus) => {
    setAccessoryStatuses(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], status: newStatus };
      return copy;
    });
  };

  const handleNotesChange = (index, notes) => {
    setAccessoryStatuses(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], notes };
      return copy;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onConfirm({
        assignmentId: assignment.id,
        assetId: asset.id,
        returnAccessories: accessoryStatuses,
        condition,
        remarks: returnRemarks
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasMissingOrDamaged = accessoryStatuses.some(
    a => a.status === 'Missing' || a.status === 'Damaged' || a.status === 'Not Returned'
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 dark:border-slate-800 my-6 animate-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/80 dark:bg-slate-800/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <PackageCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800 dark:text-white">Asset Return & Accessories Verification</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Inspect equipment and verify all issued accessories.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          
          {/* Summary Banner */}
          <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/80 rounded-xl p-4 flex flex-col sm:flex-row justify-between gap-3 text-xs">
            <div>
              <span className="text-slate-400 block font-medium">Device Returning:</span>
              <span className="font-bold text-slate-800 dark:text-slate-100 text-sm">{asset.assetCode}</span>
              <span className="text-slate-500 ml-1.5">({asset.brand} {asset.model})</span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Returning Employee:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-100">{employee.fullName || 'System Stock'}</span>
              {employee.employeeCode && <span className="font-mono text-slate-500 ml-1">[{employee.employeeCode}]</span>}
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Handover Date:</span>
              <span className="text-slate-700 dark:text-slate-300">
                {assignment.assignedDate ? new Date(assignment.assignedDate).toLocaleDateString() : 'N/A'}
              </span>
            </div>
          </div>

          {/* Accessories Verification Checklist */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Verify Issued Accessories ({accessoryStatuses.length})
              </h3>
              <span className="text-[11px] text-slate-400">
                Select status for each component
              </span>
            </div>

            <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
              {accessoryStatuses.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl space-y-2"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        {item.name}
                      </span>
                      {item.serialNumber && (
                        <span className="text-[10px] font-mono bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-500">
                          S/N: {item.serialNumber}
                        </span>
                      )}
                    </div>

                    {/* Status Pill Selectors */}
                    <div className="flex flex-wrap items-center gap-1">
                      {RETURN_STATUSES.map(st => (
                        <button
                          key={st.value}
                          type="button"
                          onClick={() => handleStatusChange(idx, st.value)}
                          className={`px-2 py-1 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${
                            item.status === st.value
                              ? `${st.color} shadow-xs font-bold scale-[1.02]`
                              : 'bg-slate-100/70 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 border-transparent hover:bg-slate-200/60 dark:hover:bg-slate-700'
                          }`}
                        >
                          {st.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Note input if missing or damaged */}
                  {(item.status === 'Missing' || item.status === 'Damaged' || item.status === 'Not Returned') && (
                    <input
                      type="text"
                      value={item.notes || ''}
                      onChange={(e) => handleNotesChange(idx, e.target.value)}
                      placeholder={`Notes for ${item.name} (${item.status.toLowerCase()} reason, condition details)...`}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-red-200 dark:border-red-900/40 rounded-lg px-2.5 py-1 text-xs text-slate-800 dark:text-slate-200 outline-none focus:ring-1 focus:ring-red-400"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Condition Warning if missing or damaged */}
          {hasMissingOrDamaged && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-xl flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-300">
              <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Accessory discrepancy noted.</span>
                <p className="text-[11px] mt-0.5 text-amber-700 dark:text-amber-400/90">
                  Missing or damaged accessories will be recorded in the permanent return audit trail.
                </p>
              </div>
            </div>
          )}

          {/* Device Return Condition & Remarks */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Asset Physical Condition Upon Return
              </label>
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 outline-none"
              >
                <option value="Good">Good / Inspected</option>
                <option value="Fair">Fair / Minor Wear</option>
                <option value="Damaged">Damaged / Requires Repair</option>
                <option value="Poor">Poor Condition</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Return Inspection Remarks
              </label>
              <input
                type="text"
                value={returnRemarks}
                onChange={(e) => setReturnRemarks(e.target.value)}
                placeholder="e.g. Returned upon project completion, tested operational"
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 outline-none"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Processing Return...' : 'Confirm Return & Check-in'}</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}

