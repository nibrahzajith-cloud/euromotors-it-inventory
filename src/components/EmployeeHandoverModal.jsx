import { useState, useEffect, useRef } from 'react';
import { Printer, Download, X, CheckSquare, Square, Loader2, ShieldCheck, AlertCircle, Laptop } from 'lucide-react';
import { downloadEmployeeHandoverPdf } from '../utils/pdfGenerator';
import { computeEmployeeValuationSummary } from '../utils/marketValuation';

const _rawApi = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || '/api';
const API_URL = _rawApi.endsWith('/api') ? _rawApi : `${_rawApi.replace(/\/$/, '')}/api`;

export default function EmployeeHandoverModal({ employeeId, initialEmployee, initialAssignedAssets = [], onClose }) {
  const printAreaRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [handoverData, setHandoverData] = useState(null);

  useEffect(() => {
    let isMounted = true;
    async function fetchHandoverData() {
      try {
        setLoading(true);
        setError('');
        const token = localStorage.getItem('token');
        const id = employeeId || initialEmployee?.id;
        if (!id) throw new Error('No employee identifier provided.');

        const res = await fetch(`${API_URL}/employees/${id}/handover`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) {
          // If the backend endpoint fails (e.g. Render server has not yet deployed the new route),
          // fallback gracefully using the employee data and assigned assets
          const emp = initialEmployee || {};
          const fallbackAssets = Array.isArray(initialAssignedAssets) ? initialAssignedAssets : [];
          const valuationSummary = computeEmployeeValuationSummary(fallbackAssets);
          const now = new Date();
          const dateCode = now.toISOString().slice(0, 10).replace(/-/g, '');
          const cleanEmpCode = (emp.employeeCode || 'EMP').replace(/[^A-Za-z0-9]/g, '');

          const fallbackData = {
            employee: emp,
            assignedAssets: valuationSummary.enrichedAssets,
            assetCount: valuationSummary.totalAssignedAssets,
            valuationSummary,
            handoverReference: `EM-HO-${cleanEmpCode}-${dateCode}`,
            generatedAt: now.toISOString()
          };

          if (isMounted) {
            setHandoverData(fallbackData);
            setLoading(false);
            return;
          }
        }

        const data = await res.json();
        if (isMounted) {
          setHandoverData(data);
        }
      } catch (err) {
        if (isMounted) {
          // Fallback if network or endpoint threw
          if (initialEmployee) {
            const fallbackAssets = Array.isArray(initialAssignedAssets) ? initialAssignedAssets : [];
            const valuationSummary = computeEmployeeValuationSummary(fallbackAssets);
            const now = new Date();
            const dateCode = now.toISOString().slice(0, 10).replace(/-/g, '');
            const cleanEmpCode = (initialEmployee.employeeCode || 'EMP').replace(/[^A-Za-z0-9]/g, '');

            setHandoverData({
              employee: initialEmployee,
              assignedAssets: valuationSummary.enrichedAssets,
              assetCount: valuationSummary.totalAssignedAssets,
              valuationSummary,
              handoverReference: `EM-HO-${cleanEmpCode}-${dateCode}`,
              generatedAt: now.toISOString()
            });
          } else {
            setError(err.message || 'Error initializing employee handover document.');
          }
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchHandoverData();
    return () => { isMounted = false; };
  }, [employeeId, initialEmployee, initialAssignedAssets]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    if (downloadingPdf || !handoverData) return;
    try {
      setDownloadingPdf(true);
      const emp = handoverData?.employee || initialEmployee || {};
      const filename = `EuroMotors_Handover_${emp.employeeCode || 'Employee'}_${(emp.fullName || 'Staff').replace(/\s+/g, '_')}`;

      // 1. Primary Vector PDF Generation
      try {
        downloadEmployeeHandoverPdf(handoverData, filename);
        return;
      } catch (vectorErr) {
        console.warn('Primary vector PDF generation encountered an issue, trying high-definition canvas fallback:', vectorErr);
      }

      // 2. High-Definition Multi-Page Canvas Fallback
      const printSheet = printAreaRef.current || document.getElementById('employee-handover-sheet');
      if (printSheet) {
        const html2canvasModule = await import('html2canvas');
        const html2canvas = html2canvasModule.default || html2canvasModule;
        const { jsPDF } = await import('jspdf');

        const canvas = await html2canvas(printSheet, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff'
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4'
        });

        const pageWidth = 210;
        const pageHeight = 297;
        const imgHeight = (canvas.height * pageWidth) / canvas.width;
        let heightLeft = imgHeight;
        let position = 0;

        pdf.addImage(imgData, 'JPEG', 0, position, pageWidth, imgHeight);
        heightLeft -= pageHeight;

        while (heightLeft > 0) {
          position = heightLeft - imgHeight;
          pdf.addPage();
          pdf.addImage(imgData, 'JPEG', 0, position, pageWidth, imgHeight);
          heightLeft -= pageHeight;
        }

        pdf.save(`${filename}.pdf`);
      } else {
        throw new Error('Handover print template element not available.');
      }
    } catch (err) {
      console.error('All PDF generation methods failed:', err);
      alert('Unable to generate PDF automatically: ' + (err.message || 'Unknown error') + '\n\nPlease click the "Print Handover Form" button and choose "Save as PDF" as your printer destination.');
    } finally {
      setDownloadingPdf(false);
    }
  };

  const emp = handoverData?.employee || initialEmployee || {};
  const assets = handoverData?.assignedAssets || [];
  const valSummary = handoverData?.valuationSummary || {
    totalValueLKR: 0,
    formattedTotalLKR: 'LKR 0',
    pendingCount: 0,
    valuedCount: 0,
    isCompleteValuation: true,
    totalLabel: 'TOTAL IT ASSET VALUE'
  };
  const handoverRef = handoverData?.handoverReference || `EM-HO-${emp.employeeCode || 'EMP'}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`;
  const generatedDate = handoverData?.generatedAt 
    ? new Date(handoverData.generatedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  // Consolidate accessories issued across all assets
  const allIssuedAccessories = [];
  assets.forEach(a => {
    if (Array.isArray(a.accessories)) {
      a.accessories.forEach(acc => {
        const name = typeof acc === 'string' ? acc : acc.name;
        const sn = typeof acc === 'object' ? acc.serialNumber : '';
        if (name) {
          allIssuedAccessories.push({
            name,
            serialNumber: sn,
            assetCode: a.assetCode
          });
        }
      });
    }
  });

  const standardChecklist = [
    'Charger',
    'Adapter',
    'Backpack / Laptop Bag',
    'Mouse',
    'Keyboard',
    'Docking Station',
    'Headset',
    'Tempered Glass'
  ];

  // Include any custom accessories
  allIssuedAccessories.forEach(item => {
    if (!standardChecklist.some(c => c.toLowerCase() === item.name.toLowerCase())) {
      standardChecklist.push(item.name);
    }
  });

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-y-auto print:p-0 print:bg-white print:static">
      {/* CSS for Multi-Page Print Layout */}
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
          #employee-handover-sheet, #employee-handover-sheet * {
            visibility: visible;
          }
          #employee-handover-sheet {
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
          .page-break-inside-avoid {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>

      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden border border-slate-200 dark:border-slate-800 my-6 print:my-0 print:border-none print:shadow-none print:max-w-none">
        
        {/* Modal Toolbar (hidden when printing) */}
        <div className="no-print p-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap justify-between items-center gap-3 bg-slate-50 dark:bg-slate-800/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800 dark:text-white">
                Employee IT Asset Handover & Acknowledgment
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Official Euro Motors equipment custody document for {emp.fullName || 'selected employee'}.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              type="button"
              disabled={loading || !!error}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm disabled:opacity-50"
              title="Print handover form"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Handover Form</span>
            </button>
            <button
              onClick={handleDownloadPdf}
              type="button"
              disabled={loading || !!error || downloadingPdf}
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm disabled:opacity-50"
              title="Download official PDF document"
            >
              {downloadingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              <span>{downloadingPdf ? 'Generating PDF...' : 'Download PDF'}</span>
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

        {/* Modal Body */}
        {loading ? (
          <div className="p-16 flex flex-col items-center justify-center space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <p className="text-sm text-slate-500 font-medium">Loading employee IT asset custody registry...</p>
          </div>
        ) : error ? (
          <div className="p-10 flex flex-col items-center text-center space-y-3">
            <AlertCircle className="w-10 h-10 text-red-500" />
            <h3 className="text-base font-bold text-slate-800 dark:text-white">Failed to Generate Handover Form</h3>
            <p className="text-xs text-red-600 dark:text-red-400 max-w-md">{error}</p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold mt-2"
            >
              Close
            </button>
          </div>
        ) : (
          <div className="overflow-y-auto max-h-[82vh] p-4 sm:p-6 bg-slate-100 dark:bg-[#070b12]">
            
            {/* Printable Document Sheet (Pure White Background) */}
            <div 
              id="employee-handover-sheet"
              ref={printAreaRef}
              className="bg-white text-slate-900 p-8 sm:p-10 rounded-xl shadow-md border border-slate-200 font-sans space-y-6 mx-auto"
              style={{ maxWidth: '820px', width: '100%', boxSizing: 'border-box' }}
            >
              
              {/* Euro Motors Corporate Header */}
              <div className="space-y-3 pb-3 border-b-2 border-slate-900">
                {/* Top Row: Left Branding & Right Metadata Box */}
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-black tracking-wider text-slate-950 font-sans">EURO MOTORS</span>
                      <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500 border-l border-slate-300 pl-2">Private Limited</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Information Technology Department • Enterprise IT Asset Custody Division
                    </p>
                  </div>
                  
                  <div className="text-right shrink-0">
                    <div className="text-xs font-mono font-bold bg-slate-50 text-slate-900 px-3 py-1.5 rounded-lg border border-slate-300 shadow-sm inline-block">
                      REF: {handoverRef}
                    </div>
                    <div className="text-[11px] text-slate-600 mt-1 space-x-2">
                      <span>Issue Date: <strong>{generatedDate}</strong></span>
                      <span>•</span>
                      <span>Assigned Assets: <strong>{assets.length} Item{assets.length === 1 ? '' : 's'}</strong></span>
                    </div>
                  </div>
                </div>

                {/* Second Row: Full-Width Document Title Banner (Zero Overlap!) */}
                <div className="bg-slate-100 p-2.5 rounded-lg border border-slate-200 text-left">
                  <h1 className="text-sm sm:text-base font-extrabold tracking-tight text-slate-900 uppercase">
                    EMPLOYEE IT ASSET HANDOVER & ACKNOWLEDGMENT FORM
                  </h1>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Official Hardware Custody Issuance, Valuation (LKR) & Responsibility Agreement
                  </p>
                </div>
              </div>

              {/* Section 1: Employee Information */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/60 page-break-inside-avoid">
                <div className="flex justify-between items-center border-b border-slate-200 pb-2 mb-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                    1. Recipient Employee Information
                  </h3>
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">
                    Status: <strong className="text-emerald-700">{emp.status || 'ACTIVE'}</strong>
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-2 gap-x-4 text-xs">
                  <div>
                    <span className="text-slate-500 block text-[11px] font-medium">Employee Name</span>
                    <span className="font-bold text-slate-900">{emp.fullName || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px] font-medium">Employee ID / Code</span>
                    <span className="font-mono font-semibold text-slate-900">{emp.employeeCode || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px] font-medium">Designation</span>
                    <span className="text-slate-800 font-medium">{emp.designation || 'Staff Member'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px] font-medium">Department</span>
                    <span className="text-slate-800 font-medium">{emp.department?.name || 'General Operations'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px] font-medium">Base Location</span>
                    <span className="text-slate-800 font-medium">{emp.location?.name || 'Head Office'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px] font-medium">Corporate Email</span>
                    <span className="text-slate-800 font-mono text-[11px]">{emp.email || 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* Section 2: All Assets Currently Assigned */}
              <div className="border border-slate-200 rounded-xl p-4 space-y-3 page-break-inside-avoid">
                <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                    2. All IT Hardware Assets Currently Assigned & Valuation (LKR)
                  </h3>
                  <span className="text-[11px] text-slate-600 font-medium">
                    Verified Active Assets: <strong>{assets.length}</strong>
                  </span>
                </div>

                {assets.length === 0 ? (
                  <div className="py-6 text-center text-slate-500 bg-slate-50 rounded-lg border border-dashed border-slate-300">
                    <Laptop className="w-8 h-8 text-slate-400 mx-auto mb-1 opacity-60" />
                    <p className="text-xs font-semibold text-slate-700">No hardware assets currently assigned to this employee.</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">All previously assigned assets have been returned to Store inventory stock.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-300 bg-slate-100 text-slate-700 font-bold">
                          <th className="py-2 px-2 text-center w-8">#</th>
                          <th className="py-2 px-2">Asset Code</th>
                          <th className="py-2 px-2">Category</th>
                          <th className="py-2 px-2">Make & Model</th>
                          <th className="py-2 px-2">Serial Number</th>
                          <th className="py-2 px-2 text-center">Condition</th>
                          <th className="py-2 px-2 text-center">Assigned Date</th>
                          <th className="py-2 px-2 text-right">Asset Value (LKR)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {assets.map((ast, idx) => {
                          const asgDate = ast.assignedDate 
                            ? new Date(ast.assignedDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                            : '—';
                          
                          const valObj = ast.valuation || {};
                          const formattedVal = valObj.formattedValue || (ast.estimatedValue ? `LKR ${Number(ast.estimatedValue).toLocaleString('en-LK')}` : 'Valuation Pending');
                          const valSource = valObj.source || ast.valuationSource || 'Recorded Value';

                          return (
                            <tr key={ast.id || idx} className="hover:bg-slate-50/50 page-break-inside-avoid">
                              <td className="py-2.5 px-2 text-center text-slate-500 font-mono text-[11px]">{idx + 1}</td>
                              <td className="py-2.5 px-2 font-mono font-bold text-slate-900 whitespace-nowrap">{ast.assetCode}</td>
                              <td className="py-2.5 px-2 text-slate-800 font-medium whitespace-nowrap">{ast.deviceType}</td>
                              <td className="py-2.5 px-2 text-slate-800 font-medium">{ast.brand} {ast.model}</td>
                              <td className="py-2.5 px-2 font-mono text-slate-700 text-[11px] whitespace-nowrap">{ast.serialNumber || 'N/A'}</td>
                              <td className="py-2.5 px-2 text-center">
                                <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-800 border border-slate-200">
                                  {ast.condition || 'Good'}
                                </span>
                              </td>
                              <td className="py-2.5 px-2 text-center text-slate-600 text-[11px] whitespace-nowrap">{asgDate}</td>
                              <td className="py-2.5 px-2 text-right whitespace-nowrap">
                                <span className="font-bold text-slate-900 font-mono text-xs">{formattedVal}</span>
                                {valObj.isPending ? (
                                  <span className="block text-[9px] text-amber-600 font-medium">Pending Review</span>
                                ) : (
                                  <span className="block text-[9px] text-slate-400 font-normal">({valSource})</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Section 2B: TOTAL IT ASSET VALUE ALLOCATED TO EMPLOYEE */}
              <div className="border-2 border-slate-900/20 bg-slate-50 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 page-break-inside-avoid shadow-sm">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                    TOTAL IT ASSET VALUE ALLOCATED TO EMPLOYEE
                  </h4>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    Employee: <strong>{emp.fullName || 'N/A'}</strong> ({emp.employeeCode || 'N/A'}) • Total Assigned Hardware: <strong>{assets.length}</strong>
                  </p>
                  {valSummary.pendingCount > 0 ? (
                    <p className="text-[10px] text-amber-700 font-semibold mt-1 flex items-center gap-1">
                      <span>⚠️ Incomplete Valuation: {valSummary.pendingCount} asset(s) pending valuation. Shown amount is Known Total.</span>
                    </p>
                  ) : (
                    <p className="text-[10px] text-emerald-700 font-medium mt-1">
                      ✓ Valuation Status: Complete & Verified as of {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                  )}
                </div>

                <div className="text-left sm:text-right shrink-0 bg-white sm:bg-transparent p-3 sm:p-0 rounded-lg border sm:border-none border-slate-200 w-full sm:w-auto">
                  <span className="block text-[10px] uppercase font-bold tracking-wider text-slate-500">
                    {valSummary.totalLabel || 'Total Asset Value (LKR)'}
                  </span>
                  <span className="text-lg sm:text-xl font-black text-slate-950 font-mono">
                    {valSummary.formattedTotalLKR || (valSummary.totalValueLKR ? `LKR ${Number(valSummary.totalValueLKR).toLocaleString('en-LK')}` : 'LKR 0')}
                  </span>
                </div>
              </div>

              {/* Section 3: Consolidated Accessories Checklist */}
              {assets.length > 0 && (
                <div className="border border-slate-200 rounded-xl p-4 space-y-2.5 page-break-inside-avoid">
                  <div className="flex justify-between items-center border-b border-slate-200 pb-1.5">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                      3. Accessories & Peripherals Custody Checklist
                    </h3>
                    <span className="text-[10px] text-slate-500 italic">
                      Consolidated physical handover verification
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                    {standardChecklist.map((item, idx) => {
                      const issuedMatch = allIssuedAccessories.find(
                        a => a.name.toLowerCase() === item.toLowerCase()
                      );
                      const isIssued = !!issuedMatch;

                      return (
                        <div
                          key={idx}
                          className={`p-2 rounded-lg border text-xs flex items-start gap-2 ${
                            isIssued
                              ? 'bg-slate-50 border-slate-400 text-slate-900 font-semibold'
                              : 'bg-white border-slate-200 text-slate-400'
                          }`}
                        >
                          <div className="mt-0.5 shrink-0">
                            {isIssued ? (
                              <CheckSquare className="w-3.5 h-3.5 text-slate-900" />
                            ) : (
                              <Square className="w-3.5 h-3.5 text-slate-300" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <span className="block truncate text-[11px]">{item}</span>
                            {isIssued && (
                              <span className="text-[9px] text-slate-500 font-mono block">
                                {issuedMatch.serialNumber ? `S/N: ${issuedMatch.serialNumber}` : `Asset: ${issuedMatch.assetCode}`}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Section 4: Employee Acknowledgment */}
              <div className="border border-slate-200 rounded-xl p-4 text-[11px] text-slate-700 space-y-2 bg-slate-50/50 page-break-inside-avoid">
                <h4 className="font-bold text-slate-900 uppercase tracking-wide text-xs">
                  4. Employee Acknowledgment & Responsibility Statement
                </h4>
                <ul className="list-disc list-inside space-y-1 leading-relaxed text-[11px]">
                  <li>I hereby confirm receipt of the company IT equipment and accessories listed in Section 2 above, in full working condition.</li>
                  <li>I understand and accept full personal custody and responsibility for the physical safety, security, and proper care of these assets.</li>
                  <li>I agree to operate all equipment in strict compliance with Euro Motors IT Governance and Cyber Security Acceptable Use Policies.</li>
                  <li>In the event of hardware malfunction, accidental damage, loss, or theft, I will notify the Euro Motors IT Helpdesk within 24 hours.</li>
                  <li>I undertake to return all equipment, components, power supplies, and accessories in good condition upon demand, transfer, or termination of employment.</li>
                </ul>
              </div>

              {/* Section 5: Signatures */}
              <div className="grid grid-cols-2 gap-8 pt-4 page-break-inside-avoid">
                <div className="border-t-2 border-slate-400 pt-2.5">
                  <p className="text-xs font-bold text-slate-900">Employee Acknowledgment & Signature</p>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    Name: <span className="font-semibold text-slate-900">{emp.fullName || '________________________'}</span>
                  </p>
                  <p className="text-[10px] text-slate-500">Employee ID: <span className="font-mono">{emp.employeeCode || '____________'}</span></p>
                  <div className="h-10"></div>
                  <p className="text-[10px] text-slate-500">Signature Date: ________________________</p>
                </div>

                <div className="border-t-2 border-slate-400 pt-2.5">
                  <p className="text-xs font-bold text-slate-900">Authorized IT Department Handover</p>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    Officer Name: <span className="font-semibold text-slate-900">IT Department Custodian</span>
                  </p>
                  <p className="text-[10px] text-slate-500">Euro Motors IT Operations & Asset Control</p>
                  <div className="h-10"></div>
                  <p className="text-[10px] text-slate-500">Handover Date: {generatedDate}</p>
                </div>
              </div>

              {/* Footer Note */}
              <div className="pt-2 border-t border-slate-200 text-center text-[10px] text-slate-400 no-print">
                Euro Motors Private Limited • Standard IT Custody Agreement • Document Reference: {handoverRef}
              </div>

            </div>

          </div>
        )}

      </div>
    </div>
  );
}

