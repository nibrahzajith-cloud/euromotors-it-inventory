import { useRef } from 'react';
import { Printer, X, CheckSquare, Square, Building2, MapPin, User, ShieldCheck } from 'lucide-react';
import { STANDARD_ACCESSORIES } from '../constants/assetOptions';

export default function HandoverPrintModal({ assignment, onClose }) {
  if (!assignment) return null;

  const printAreaRef = useRef(null);

  const asset = assignment.asset || {};
  const employee = assignment.employee || {};
  const assignedDate = assignment.assignedDate ? new Date(assignment.assignedDate).toLocaleDateString() : new Date().toLocaleDateString();

  // Normalize issued accessories
  const issuedList = Array.isArray(assignment.accessories) ? assignment.accessories : [];
  const issuedNames = issuedList.map(a => (typeof a === 'string' ? a : a.name).toLowerCase());

  // Standard checklist items to display with check/uncheck status
  const checklistItems = [
    'Charger',
    'Adapter',
    'Backpack / Laptop Bag',
    'Tempered Glass',
    'Mouse',
    'Keyboard',
    'Docking Station',
    'Headset'
  ];

  // Add any custom accessory from this assignment that isn't in standard list
  issuedList.forEach(item => {
    const name = typeof item === 'string' ? item : item.name;
    if (name && !checklistItems.some(c => c.toLowerCase() === name.toLowerCase())) {
      checklistItems.push(name);
    }
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      {/* CSS for Print View */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #handover-print-sheet, #handover-print-sheet * {
            visibility: visible;
          }
          #handover-print-sheet {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 24px;
            background: white !important;
            color: black !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden border border-slate-200 dark:border-slate-800 my-8">
        
        {/* Modal Toolbar (hidden in print) */}
        <div className="no-print p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/60">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-bold text-slate-800 dark:text-white">Print Asset Handover Document</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Document</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Sheet */}
        <div id="handover-print-sheet" ref={printAreaRef} className="p-8 bg-white text-slate-900 font-sans space-y-6">
          
          {/* Header */}
          <div className="flex justify-between items-start border-b-2 border-slate-900 pb-5">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-extrabold tracking-wider text-slate-900">EURO MOTORS</span>
                <span className="text-xs uppercase tracking-widest text-slate-500">Private Limited</span>
              </div>
              <h1 className="text-lg font-bold tracking-tight text-slate-800 mt-1">
                IT EQUIPMENT HANDOVER & ACKNOWLEDGMENT FORM
              </h1>
              <p className="text-xs text-slate-500">Information Technology Department • Asset Control Center</p>
            </div>
            <div className="text-right">
              <div className="text-xs font-mono font-bold bg-slate-100 px-3 py-1 rounded border border-slate-300 inline-block">
                REF: {asset.assetCode || 'N/A'}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Handover Date: <strong>{assignedDate}</strong></p>
            </div>
          </div>

          {/* Details 2-Column Grid */}
          <div className="grid grid-cols-2 gap-6">
            
            {/* Employee Information */}
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 border-b border-slate-200 pb-1.5">
                1. Recipient Details
              </h3>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Employee Name:</span>
                  <span className="font-bold text-slate-800">{employee.fullName || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Employee ID:</span>
                  <span className="font-mono font-semibold text-slate-800">{employee.employeeCode || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Designation:</span>
                  <span className="text-slate-800">{employee.designation || 'Staff'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Department:</span>
                  <span className="text-slate-800">{employee.department?.name || asset.department?.name || 'General'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Location:</span>
                  <span className="text-slate-800">{employee.location?.name || asset.location?.name || 'Head Office'}</span>
                </div>
              </div>
            </div>

            {/* Hardware Asset Information */}
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 border-b border-slate-200 pb-1.5">
                2. Main Hardware Asset
              </h3>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Asset Tag / Code:</span>
                  <span className="font-mono font-bold text-slate-900">{asset.assetCode}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Device Category:</span>
                  <span className="font-semibold text-slate-800">{asset.deviceType || 'Hardware'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Make & Model:</span>
                  <span className="text-slate-800">{asset.brand} {asset.model}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Serial Number:</span>
                  <span className="font-mono text-slate-800">{asset.serialNumber || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Physical Condition:</span>
                  <span className="text-slate-800">{asset.condition || 'Good / Operational'}</span>
                </div>
              </div>
            </div>

          </div>

          {/* Section 3: Accessories & Other Assets Issued */}
          <div className="border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex justify-between items-center border-b border-slate-200 pb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                3. Accessories & Other Assets Issued
              </h3>
              <span className="text-[11px] text-slate-500 italic">
                Verified at physical handover
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
              {checklistItems.map((item, idx) => {
                const isIssued = issuedNames.includes(item.toLowerCase());
                const matchingObj = issuedList.find(a => (typeof a === 'string' ? a : a.name).toLowerCase() === item.toLowerCase());
                const sn = typeof matchingObj === 'object' ? matchingObj?.serialNumber : '';

                return (
                  <div
                    key={idx}
                    className={`p-2.5 rounded-lg border text-xs flex items-start gap-2 ${
                      isIssued
                        ? 'bg-slate-50 border-slate-400 text-slate-900 font-semibold'
                        : 'bg-white border-slate-200 text-slate-400'
                    }`}
                  >
                    <div className="mt-0.5">
                      {isIssued ? (
                        <CheckSquare className="w-4 h-4 text-slate-900" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-300" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <span className="block truncate">{item}</span>
                      {isIssued && sn && (
                        <span className="text-[10px] text-slate-500 font-mono block">S/N: {sn}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {assignment.remarks && (
              <div className="pt-2 text-xs text-slate-600 bg-slate-50 p-2.5 rounded border border-slate-200">
                <span className="font-bold text-slate-700">Remarks:</span> {assignment.remarks}
              </div>
            )}
          </div>

          {/* Section 4: Terms & Acknowledgment */}
          <div className="border border-slate-200 rounded-xl p-4 text-[11px] text-slate-600 space-y-2 bg-slate-50/30">
            <h4 className="font-bold text-slate-800 uppercase tracking-wide">4. Employee Acknowledgment & Responsibility</h4>
            <ul className="list-disc list-inside space-y-1 leading-relaxed">
              <li>I hereby acknowledge receipt of the IT asset and accessories listed above in good working condition.</li>
              <li>I agree to use the equipment solely for official company duties in compliance with Euro Motors IT Security Policies.</li>
              <li>I undertake to safeguard the hardware and all issued accessories against loss, damage, or theft.</li>
              <li>I agree to return all equipment and accessories immediately upon demand, transfer, or termination of employment.</li>
            </ul>
          </div>

          {/* Section 5: Signature Blocks */}
          <div className="grid grid-cols-2 gap-8 pt-4">
            
            <div className="border-t-2 border-slate-400 pt-3">
              <p className="text-xs font-bold text-slate-900">Employee Signature & Date</p>
              <p className="text-[11px] text-slate-500 mt-1">Name: {employee.fullName || '_________________________'}</p>
              <div className="h-10"></div>
              <p className="text-[10px] text-slate-400">Date: ________________________</p>
            </div>

            <div className="border-t-2 border-slate-400 pt-3">
              <p className="text-xs font-bold text-slate-900">Authorized IT Officer Handover</p>
              <p className="text-[11px] text-slate-500 mt-1">Name: _________________________</p>
              <div className="h-10"></div>
              <p className="text-[10px] text-slate-400">Date: {assignedDate}</p>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}

