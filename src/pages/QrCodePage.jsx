import { useState, useEffect, useRef } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { QrCode, ScanLine, Printer, ArrowRight, Download, CheckSquare, Square, Layers, Loader2 } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import QRCard from '../components/QRCard';
import { downloadQRCard } from '../utils/qrUtils';
import jsPDF from 'jspdf';

const _rawApi = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const API_URL = _rawApi.endsWith('/api') ? _rawApi : `${_rawApi.replace(/\/$/, '')}/api`;

export default function QrCodePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const presetCode = location.state?.presetCode;
  
  const [activeTab, setActiveTab] = useState(presetCode ? 'generate' : 'scan');
  
  // Single Scanner/Generator State
  const [scanInput, setScanInput] = useState('');
  const [generateInput, setGenerateInput] = useState(presetCode || 'AST-2023-001');

  // Bulk Generator State
  const [assets, setAssets] = useState([]);
  const [selectedCodes, setSelectedCodes] = useState([]);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  useEffect(() => {
    if (activeTab === 'bulk') {
       fetchAssets();
    }
  }, [activeTab]);

  const fetchAssets = async () => {
    setLoadingAssets(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/assets`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAssets(data);
      }
    } catch (err) {
      showToast('Failed to load assets', 'error');
    } finally {
      setLoadingAssets(false);
    }
  };

  const handleScanSubmit = (e) => {
    e.preventDefault();
    if (scanInput.trim()) {
      showToast(`Redirecting to profile for ${scanInput.trim()}...`, 'info');
      navigate(`/assets/${scanInput.trim()}`);
    } else {
      showToast('Please enter an Asset Code to scan.', 'warning');
    }
  };

  const downloadSingleQR = () => {
    const result = downloadQRCard(generateInput.trim());
    if (result.success) {
       showToast('QR Code downloaded successfully.', 'success');
    } else {
       showToast(`PNG Error: ${result.error}`, 'error');
    }
  };

  const handlePrintSingle = () => {
     window.print();
  };

  // Bulk Operations
  const handleSelectAll = () => setSelectedCodes(assets.map(a => a.assetCode));
  const handleClearSelection = () => setSelectedCodes([]);
  const toggleSelection = (code) => {
    setSelectedCodes(prev => prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]);
  };

  const downloadA4Sheet = () => {
    if (selectedCodes.length === 0) return showToast('Please select at least one asset.', 'warning');
    
    setIsDownloadingPdf(true);
    showToast('Generating PDF, please wait...', 'info');
    
    try {
       const pdf = new jsPDF('p', 'mm', 'a4');
       
       for (let p = 0; p < chunkedCodes.length; p++) {
          if (p > 0) pdf.addPage();
          const pageCodes = chunkedCodes[p];
          
          const marginX = 12;
          const marginY = 15;
          const cellW = 37;
          const cellH = 45;
          
          for (let i = 0; i < pageCodes.length; i++) {
             const code = pageCodes[i];
             const row = Math.floor(i / 5);
             const col = i % 5;
             
             const x = marginX + (col * cellW);
             const y = marginY + (row * cellH);
             
             // Box
             pdf.setDrawColor(226, 232, 240); // #e2e8f0
             pdf.setFillColor(255, 255, 255);
             pdf.roundedRect(x, y, 32, 38, 3, 3, 'FD');
             
             // QR Code
             const qrContainer = document.getElementById(`pdf-qr-${code}`);
             if (qrContainer) {
                const qrCanvas = qrContainer.querySelector('canvas');
                if (qrCanvas) {
                   const qrData = qrCanvas.toDataURL('image/png');
                   pdf.addImage(qrData, 'PNG', x + 4, y + 4, 24, 24);
                }
             }
             
             // Text
             pdf.setFontSize(8);
             pdf.setFont("monospace", "bold");
             pdf.setTextColor(15, 23, 42); // slate-800
             const textWidth = pdf.getStringUnitWidth(code) * pdf.internal.getFontSize() / pdf.internal.scaleFactor;
             const textOffset = (32 - textWidth) / 2;
             pdf.text(code, x + textOffset, y + 34);
          }
       }
       
       pdf.save('EuroMotors_Bulk_QR_Labels.pdf');
       showToast('A4 Sheet PDF downloaded successfully.', 'success');
    } catch(err) {
       showToast(`PDF Error: ${err.message}`, 'error');
    } finally {
       setIsDownloadingPdf(false);
    }
  };

  const handleBulkPrint = () => {
    if (selectedCodes.length === 0) return showToast('Please select at least one asset.', 'warning');
    window.print();
  };

  // Helper to chunk selected codes into arrays of 30 for A4 pages (5 columns x 6 rows)
  const chunkedCodes = [];
  const itemsPerPage = 30;
  const targetCodes = activeTab === 'bulk' ? selectedCodes : [generateInput.trim()];
  for (let i = 0; i < targetCodes.length; i += itemsPerPage) {
    chunkedCodes.push(targetCodes.slice(i, i + itemsPerPage));
  }

  return (
    <>
      <style>{`
        @media print {
           body * { visibility: hidden; }
           .print-visible, .print-visible * { visibility: visible; }
           .print-visible { position: absolute; left: 0; top: 0; width: 100%; margin: 0; padding: 0; }
           @page { margin: 0; size: A4 portrait; }
           body { background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
           .a4-print-page { page-break-after: always; width: 210mm; height: 297mm; padding: 15mm; background: white; margin: 0 auto; }
        }
      `}</style>

      <div className="max-w-6xl mx-auto space-y-6 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">QR Code Center</h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">Generate labels, simulate scanning, or bulk export A4 sheets.</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden text-center md:text-left flex flex-col md:flex-row min-h-[600px]">
          
          {/* Sidebar Nav */}
          <div className="md:w-64 border-b md:border-b-0 md:border-r border-slate-100 flex flex-row md:flex-col bg-slate-50">
            <button 
              onClick={() => setActiveTab('scan')}
              className={`flex-1 md:flex-none p-4 text-sm font-medium transition-colors flex items-center justify-center md:justify-start gap-3 ${activeTab === 'scan' ? 'bg-white text-blue-600 border-l-4 border-blue-600 shadow-sm' : 'text-slate-500 hover:bg-slate-100 border-l-4 border-transparent'}`}
            >
              <ScanLine className="w-5 h-5" />
              Scanner Simulation
            </button>
            <button 
              onClick={() => setActiveTab('generate')}
              className={`flex-1 md:flex-none p-4 text-sm font-medium transition-colors flex items-center justify-center md:justify-start gap-3 ${activeTab === 'generate' ? 'bg-white text-indigo-600 border-l-4 border-indigo-600 shadow-sm' : 'text-slate-500 hover:bg-slate-100 border-l-4 border-transparent'}`}
            >
              <QrCode className="w-5 h-5" />
              Single Generator
            </button>
            <button 
              onClick={() => setActiveTab('bulk')}
              className={`flex-1 md:flex-none p-4 text-sm font-medium transition-colors flex items-center justify-center md:justify-start gap-3 ${activeTab === 'bulk' ? 'bg-white text-purple-600 border-l-4 border-purple-600 shadow-sm' : 'text-slate-500 hover:bg-slate-100 border-l-4 border-transparent'}`}
            >
              <Layers className="w-5 h-5" />
              Bulk Print (A4)
            </button>
          </div>

          <div className="flex-1 p-6 md:p-8">
            {/* SCAN TAB */}
            {activeTab === 'scan' && (
              <div className="max-w-md mx-auto space-y-6 flex flex-col items-center text-center mt-10">
                <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mb-2 shadow-inner">
                  <ScanLine className="w-12 h-12 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-slate-800 dark:text-white">Simulate QR Scan</h2>
                  <p className="text-slate-600 dark:text-slate-400 text-sm mt-1 mb-6">Enter an Asset Code manually to simulate scanning its physical QR tag via USB Scanner.</p>
                </div>
                <form onSubmit={handleScanSubmit} className="w-full space-y-4">
                  <input 
                    type="text" 
                    value={scanInput}
                    onChange={(e) => setScanInput(e.target.value)}
                    placeholder="e.g., AST-2023-001"
                    className="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 text-center font-mono placeholder:font-sans"
                  />
                  <button type="submit" className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white rounded-xl py-3 font-medium hover:bg-blue-700 transition-colors shadow-sm shadow-blue-600/20">
                    Scan & View Profile
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              </div>
            )}

            {/* GENERATE SINGLE TAB */}
            {activeTab === 'generate' && (
              <div className="max-w-md mx-auto space-y-6 flex flex-col items-center text-center mt-4">
                <div>
                  <h2 className="text-xl font-semibold text-slate-800 dark:text-white">Generate Single Label</h2>
                  <p className="text-slate-600 dark:text-slate-400 text-sm mt-1 mb-6">Input an Asset Code to generate a high-quality printable QR card.</p>
                </div>
                
                <input 
                  type="text" 
                  value={generateInput}
                  onChange={(e) => setGenerateInput(e.target.value)}
                  placeholder="Asset Code..."
                  className="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500 text-center font-mono placeholder:font-sans"
                />

                <div className="bg-slate-50 p-8 rounded-3xl w-full border border-slate-100 flex flex-col items-center justify-center min-h-[300px]">
                  {generateInput.trim() ? (
                    <>
                       {/* High Quality Rounded Card Preview */}
                       <QRCard assetCode={generateInput.trim()} />
                    </>
                  ) : (
                    <div className="text-slate-400 flex flex-col items-center">
                      <QrCode className="w-12 h-12 mb-2 opacity-50" />
                      Waiting for input...
                    </div>
                  )}
                </div>

                <div className="flex w-full gap-3">
                  <button 
                    onClick={downloadSingleQR}
                    disabled={!generateInput.trim()}
                    className="flex-1 bg-white border border-slate-200 text-slate-700 rounded-xl py-2.5 font-medium hover:bg-slate-50 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Download className="w-4 h-4" />
                    Download PNG
                  </button>
                  <button 
                    onClick={handlePrintSingle}
                    disabled={!generateInput.trim()}
                    className="flex-1 bg-indigo-600 text-white rounded-xl py-2.5 font-medium hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm shadow-indigo-600/20"
                  >
                    <Printer className="w-4 h-4" />
                    Print Card
                  </button>
                </div>
              </div>
            )}

            {/* BULK TAB */}
            {activeTab === 'bulk' && (
              <div className="space-y-6 h-full flex flex-col">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                   <div>
                     <h2 className="text-xl font-semibold text-slate-800 dark:text-white">Bulk A4 Generation</h2>
                     <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">Select assets to generate 3x4 grid A4 pages for label printing.</p>
                   </div>
                   <div className="flex flex-wrap gap-2">
                      <button onClick={downloadA4Sheet} disabled={isDownloadingPdf} className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-xl text-sm font-medium hover:bg-slate-50 transition flex items-center gap-2 disabled:opacity-50">
                         {isDownloadingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                         Download A4 PDF
                      </button>
                      <button onClick={handleBulkPrint} className="bg-purple-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-purple-700 transition shadow-sm shadow-purple-600/20 flex items-center gap-2">
                         <Printer className="w-4 h-4" />
                         Print A4 Sheet
                      </button>
                   </div>
                </div>

                <div className="flex items-center gap-4 bg-purple-50 px-4 py-3 rounded-xl border border-purple-100">
                   <div className="flex gap-2">
                      <button onClick={handleSelectAll} className="text-sm font-medium text-purple-700 hover:text-purple-800 bg-white px-3 py-1.5 rounded-lg border border-purple-200 shadow-sm">Select All</button>
                      <button onClick={handleClearSelection} className="text-sm font-medium text-slate-600 hover:text-slate-800 dark:text-white bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">Clear</button>
                   </div>
                   <span className="text-sm font-medium text-slate-600 ml-auto">Selected: <span className="text-purple-700 font-bold">{selectedCodes.length}</span> labels</span>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden flex-1 max-h-[500px] overflow-y-auto shadow-sm">
                   {loadingAssets ? (
                      <div className="p-10 flex justify-center"><Loader2 className="w-8 h-8 text-purple-600 animate-spin" /></div>
                   ) : (
                      <table className="w-full text-left text-sm text-slate-600">
                         <thead className="bg-slate-50 text-slate-500 font-medium sticky top-0 border-b border-slate-200 shadow-sm">
                           <tr>
                             <th className="px-4 py-3 w-10"></th>
                             <th className="px-4 py-3">Asset Code</th>
                             <th className="px-4 py-3">Device & Model</th>
                             <th className="px-4 py-3">Assignment</th>
                             <th className="px-4 py-3">Department</th>
                           </tr>
                         </thead>
                         <tbody className="divide-y divide-slate-100">
                           {assets.map(asset => {
                             const isSelected = selectedCodes.includes(asset.assetCode);
                             return (
                               <tr key={asset.id} onClick={() => toggleSelection(asset.assetCode)} className={`hover:bg-slate-50 cursor-pointer transition-colors ${isSelected ? 'bg-purple-50/30' : ''}`}>
                                  <td className="px-4 py-3">
                                     {isSelected ? <CheckSquare className="w-5 h-5 text-purple-600" /> : <Square className="w-5 h-5 text-slate-300" />}
                                  </td>
                                  <td className="px-4 py-3 font-mono font-medium text-slate-800 dark:text-white">{asset.assetCode}</td>
                                  <td className="px-4 py-3">
                                     <div className="flex flex-col">
                                       <span className="font-medium text-slate-700">{asset.deviceType}</span>
                                       <span className="text-xs text-slate-500">{asset.model}</span>
                                     </div>
                                  </td>
                                  <td className="px-4 py-3">{asset.assignedEmployee?.fullName || <span className="text-slate-400 italic">Unassigned</span>}</td>
                                  <td className="px-4 py-3">{asset.department?.name || '-'}</td>
                               </tr>
                             );
                           })}
                           {assets.length === 0 && (
                              <tr><td colSpan="5" className="p-6 text-center text-slate-500">No assets available.</td></tr>
                           )}
                         </tbody>
                      </table>
                   )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ========================================= */}
      {/* NATIVE BROWSER PRINT CONTAINER (A4 GRID)  */}
      {/* ========================================= */}
      <div className="hidden print-visible">
         {chunkedCodes.map((pageAssets, pageIndex) => (
           <div key={pageIndex} className="a4-print-page">
              <div className="grid grid-cols-5 grid-rows-6 gap-[4mm] h-full w-full px-[8mm] py-[10mm]">
                 {pageAssets.map(code => (
                    <div key={code} className="flex justify-center items-center">
                       <div className="border border-slate-300 rounded-[8px] flex flex-col items-center justify-center p-[2mm] w-[32mm] h-[38mm] bg-white text-center">
                          <QRCodeCanvas value={code} size={85} level="H" includeMargin={false} />
                          <span className="mt-[2mm] font-bold font-mono text-black text-[9px] leading-none block w-full">{code}</span>
                       </div>
                    </div>
                 ))}
                 {/* Empty placeholders to preserve grid structure if page isn't full */}
                 {Array.from({ length: 30 - pageAssets.length }).map((_, i) => (
                    <div key={`empty-${i}`} className="flex justify-center items-center"></div>
                 ))}
              </div>
           </div>
         ))}
      </div>

      {/* ========================================= */}
      {/* PDF HTML2CANVAS CAPTURE CONTAINER         */}
      {/* Hidden absolutely off-screen for capture  */}
      {/* ========================================= */}
      <div id="pdf-capture-container" className="absolute left-[9999px] top-[9999px] pointer-events-none opacity-0">
         {chunkedCodes.map((pageAssets) => (
             pageAssets.map(code => (
                <div key={code} id={`pdf-qr-${code}`}>
                   <QRCodeCanvas value={code} size={160} level="H" includeMargin={false} />
                </div>
             ))
         ))}
      </div>
    </>
  );
}
