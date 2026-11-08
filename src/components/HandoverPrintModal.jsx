import { useState, useRef } from 'react';
import { Printer, Download, X, CheckSquare, Square, Loader2 } from 'lucide-react';
import { downloadAssignmentHandoverPdf } from '../utils/pdfGenerator';

export default function HandoverPrintModal({ assignment, onClose }) {
  if (!assignment) return null;

  const printAreaRef = useRef(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const asset = assignment.asset || {};
  const employee = assignment.employee || {};
  const assignedDate = assignment.assignedDate 
    ? new Date(assignment.assignedDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) 
    : new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  // Normalize issued accessories
  const issuedList = Array.isArray(assignment.accessories) ? assignment.accessories : [];
  const issuedNames = issuedList.map(a => (typeof a === 'string' ? a : a.name).toLowerCase());

  // Standard checklist items
  const checklistItems = [
    'Charger',
    'Adapter',
    'Backpack / Laptop Bag',
    'Mouse',
    'Keyboard',
    'Docking Station',
    'Headset',
    'Tempered Glass'
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

  const handleDownloadPdf = () => {
    if (downloadingPdf || !assignment) return;
    try {
      setDownloadingPdf(true);
      const filename = `EuroMotors_Handover_${asset.assetCode || 'Asset'}_${employee.employeeCode || 'Employee'}`;
      downloadAssignmentHandoverPdf(assignment, filename);
    } catch (err) {
      console.error('PDF generation error:', err);
      alert('Failed to generate PDF. Please use the Print Form button as a fallback.');
    } finally {
      setDownloadingPdf(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto print:p-0 print:bg-white print:static">
      {/* CSS for Print View */}
      <style>{`
        @page {
          size: A4 portrait;
          margin: 12mm 15mm 15mm 15mm;
        }
        @media print {
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
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
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            color: black !important;
            box-shadow: none !important;
            border: none !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden border border-slate-200 dark:border-slate-800 my-8 print:my-0 print:border-none print:shadow-none print:max-w-none">
        
        {/* Modal Toolbar (hidden in print) */}
        <div className="no-print p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/60">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-blue-600" />
            <div>
              <h2 className="text-sm font-bold text-slate-800 dark:text-white">IT Equipment Handover & Acknowledgment Form</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Print or download official Euro Motors handover agreement.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              type="button"
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
              title="Print handover form"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Form</span>
            </button>
            <button
              onClick={handleDownloadPdf}
              type="button"
              disabled={downloadingPdf}
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm disabled:opacity-50"
              title="Download as PDF"
            >
              {downloadingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              <span>{downloadingPdf ? 'Generating...' : 'Download PDF'}</span>
            </button>
            <button
              onClick={onClose}
              type="button"
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Sheet */}
        <div 
          id="handover-print-sheet" 
          ref={printAreaRef} 
          className="p-8 bg-white text-slate-900 font-sans space-y-5"
          style={{ width: '100%', boxSizing: 'border-box' }}
        >
          
          {/* Euro Motors Corporate Header */}
          <div className="space-y-3 pb-3 border-b-2 border-slate-900">
            <div className="flex justify-between items-start gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-black tracking-wider text-slate-950 font-sans">EURO MOTORS</span>
                  <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500 border-l border-slate-300 pl-2">Private Limited</span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">Information Technology Department • Enterprise Asset Control</p>
              </div>
              <div className="text-right shrink-0">
                <div className="text-xs font-mono font-bold bg-slate-50 text-slate-900 px-3 py-1.5 rounded border border-slate-300 shadow-sm inline-block">
                  REF: {asset.assetCode || 'N/A'}
                </div>
                <p className="text-[11px] text-slate-600 mt-1">Issue Date: <strong>{assignedDate}</strong></p>
              </div>
            </div>

            <div className="bg-slate-100 p-2.5 rounded-lg border border-slate-200 text-left">
              <h1 className="text-sm sm:text-base font-extrabold tracking-tight text-slate-900 uppercase">
                IT EQUIPMENT HANDOVER & ACKNOWLEDGMENT FORM
              </h1>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Official Hardware Custody Issuance, Valuation & Responsibility Agreement
              </p>
            </div>
          </div>

          {/* Details 2-Column Grid */}
          <div className="grid grid-cols-2 gap-5">
            
            {/* Section 1: Employee Information */}
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-1.5 flex justify-between">
                <span>1. Employee Information</span>
                <span className="text-[10px] text-slate-500 font-normal">Recipient</span>
              </h3>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Employee Name:</span>
                  <span className="font-bold text-slate-900">{employee.fullName || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Employee ID:</span>
                  <span className="font-mono font-semibold text-slate-900">{employee.employeeCode || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Designation:</span>
                  <span className="text-slate-800 font-medium">{employee.designation || 'Staff'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Department:</span>
                  <span className="text-slate-800 font-medium">{employee.department?.name || asset.department?.name || 'General'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Base Location:</span>
                  <span className="text-slate-800 font-medium">{employee.location?.name || asset.location?.name || 'Head Office'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Employment Status:</span>
                  <span className="font-semibold text-slate-800">{employee.status || 'ACTIVE'}</span>
                </div>
              </div>
            </div>

            {/* Section 2: Hardware Asset Information */}
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-1.5 flex justify-between">
                <span>2. Assigned Hardware Asset</span>
                <span className="text-[10px] text-slate-500 font-normal">Primary Device</span>
              </h3>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Asset Code:</span>
                  <span className="font-mono font-bold text-slate-950">{asset.assetCode}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Device Category:</span>
                  <span className="font-semibold text-slate-800">{asset.deviceType || 'Hardware'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Brand & Model:</span>
                  <span className="text-slate-800 font-medium">{asset.brand} {asset.model}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Serial Number:</span>
                  <span className="font-mono font-semibold text-slate-800">{asset.serialNumber || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Physical Condition:</span>
                  <span className="font-semibold text-slate-900">{asset.condition || 'New / Operational'}</span>
                </div>
                {asset.processor && asset.processor !== 'N/A' && (
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">Specifications:</span>
                    <span className="text-slate-700 text-[11px] truncate max-w-[180px]">{asset.processor} • {asset.ram || ''} • {asset.storage || ''}</span>
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Section 3: Accessories Checklist */}
          <div className="border border-slate-200 rounded-xl p-4 space-y-2.5">
            <div className="flex justify-between items-center border-b border-slate-200 pb-1.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                3. Issued Accessories & Peripherals Checklist
              </h3>
              <span className="text-[10px] text-slate-500 italic">
                Verified at physical handover
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
              {checklistItems.map((item, idx) => {
                const isIssued = issuedNames.includes(item.toLowerCase());
                const matchingObj = issuedList.find(a => (typeof a === 'string' ? a : a.name).toLowerCase() === item.toLowerCase());
                const sn = typeof matchingObj === 'object' ? matchingObj?.serialNumber : '';

                return (
                  <div
                    key={idx}
                    className={`p-2 rounded-lg border text-xs flex items-start gap-2 ${
                      isIssued
                        ? 'bg-slate-50 border-slate-400 text-slate-900 font-semibold'
                        : 'bg-white border-slate-200 text-slate-400'
                    }`}
                  >
                    <div className="mt-0.5">
                      {isIssued ? (
                        <CheckSquare className="w-3.5 h-3.5 text-slate-900" />
                      ) : (
                        <Square className="w-3.5 h-3.5 text-slate-300" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <span className="block truncate text-[11px]">{item}</span>
                      {isIssued && sn && (
                        <span className="text-[9px] text-slate-500 font-mono block">S/N: {sn}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {assignment.remarks && (
              <div className="pt-2 text-xs text-slate-700 bg-slate-50 p-2.5 rounded border border-slate-200">
                <span className="font-bold text-slate-900">Assignment Remarks:</span> {assignment.remarks}
              </div>
            )}
          </div>

          {/* Section 4: Terms & Acknowledgment */}
          <div className="border border-slate-200 rounded-xl p-4 text-[11px] text-slate-700 space-y-2 bg-slate-50/40">
            <h4 className="font-bold text-slate-900 uppercase tracking-wide text-xs">4. Employee Acknowledgment & Responsibility</h4>
            <ul className="list-disc list-inside space-y-1 leading-relaxed text-[11px]">
              <li>I hereby acknowledge receipt of the Euro Motors IT equipment and accessories listed above in good working condition.</li>
              <li>I undertake full responsibility for safeguarding this equipment against unauthorized access, loss, physical damage, or theft.</li>
              <li>I agree to use this hardware solely for legitimate official business duties in strict compliance with Euro Motors IT and Cyber Security Policies.</li>
              <li>In the event of damage, malfunction, or loss, I agree to immediately notify the Euro Motors IT Department and file an official incident report.</li>
              <li>I agree to return all issued equipment, cables, and accessories in good condition upon company demand, internal transfer, or employment cessation.</li>
            </ul>
          </div>

          {/* Section 5: Signature Blocks */}
          <div className="grid grid-cols-2 gap-8 pt-3">
            
            <div className="border-t-2 border-slate-400 pt-2.5">
              <p className="text-xs font-bold text-slate-900">Employee Acknowledgment & Signature</p>
              <p className="text-[11px] text-slate-600 mt-0.5">Name: <span className="font-semibold">{employee.fullName || '________________________'}</span></p>
              <div className="h-10"></div>
              <p className="text-[10px] text-slate-500">Date: ________________________</p>
            </div>

            <div className="border-t-2 border-slate-400 pt-2.5">
              <p className="text-xs font-bold text-slate-900">Authorized IT Department Handover</p>
              <p className="text-[11px] text-slate-600 mt-0.5">Name: <span className="font-semibold">IT Department Officer</span></p>
              <div className="h-10"></div>
              <p className="text-[10px] text-slate-500">Date: {assignedDate}</p>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
