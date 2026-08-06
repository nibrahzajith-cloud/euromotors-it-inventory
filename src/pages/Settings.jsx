import { useState, useEffect } from 'react';
import { Save, User, Building2, Server, Globe, DownloadCloud, Activity, UploadCloud, Play, FileText, CheckCircle2, AlertCircle, Eye, Download, Search, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useNavigate } from 'react-router-dom';
import * as ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

const _rawApi = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const API_URL = _rawApi.endsWith('/api') ? _rawApi : `${_rawApi.replace(/\/$/, '')}/api`;

export default function Settings() {
  const { showToast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [csvData, setCsvData] = useState([]);
  const [importStatus, setImportStatus] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isImporting, setIsImporting] = useState(false);
  const [transferredCount, setTransferredCount] = useState(0);
  const [validationReport, setValidationReport] = useState(null);
  const [selectedFileInfo, setSelectedFileInfo] = useState(null);
  const [pendingUpload, setPendingUpload] = useState(null);
  const [forceUploadFlag, setForceUploadFlag] = useState(false);
  
  const [assetCodePrefix, setAssetCodePrefix] = useState('AST');
  const [warrantyPeriod, setWarrantyPeriod] = useState(12);

  useEffect(() => {
    const fetchSettings = async () => {
       try {
          const token = localStorage.getItem('token');
          const res = await fetch(`${API_URL}/settings`, { headers: { 'Authorization': `Bearer ${token}` } });
          if(res.ok) {
             const data = await res.json();
             if(data && data.assetCodePrefix) {
                setAssetCodePrefix(data.assetCodePrefix);
                setWarrantyPeriod(data.warrantyPeriod);
             }
          }
       } catch(e) {}
    };
    fetchSettings();
  }, []);

  const handleSaveSettings = async () => {
     try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/settings`, {
           method: 'PUT',
           headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
           body: JSON.stringify({ assetCodePrefix, warrantyPeriod })
        });
        if(!res.ok) throw new Error('Failed to save settings');
        showToast('Settings Saved Successfully!', 'success');
     } catch(err) {
        showToast(err.message, 'error');
     }
  };

  function parseCSV(text) {
      let ret = [];
      let row = [];
      let val = '';
      let quote = false;
      for (let i = 0; i < text.length; i++) {
          let cc = text[i], nc = text[i+1];
          if (cc === '"' && quote && nc === '"') { 
              val += '"'; 
              i++; 
          } else if (cc === '"') { 
              quote = !quote; 
          } else if (cc === ',' && !quote) { 
              row.push(val.trim()); 
              val = ''; 
          } else if (cc === '\n' && !quote) {
              row.push(val.trim());
              ret.push(row);
              row = [];
              val = '';
          } else if (cc === '\r' && !quote) {
              // ignore \r
          } else { 
              val += cc; 
          }
      }
      if (val || row.length > 0) {
          row.push(val.trim());
          ret.push(row);
      }
      return ret;
  }

  const processParsedAssets = (parsedAssets, file) => {
      if (parsedAssets.length === 0) {
         showToast('No valid data rows found to import.', 'warning');
         return;
      }
      setCsvData(parsedAssets);
      if (file) {
          setSelectedFileInfo({
              name: file.name,
              size: (file.size / 1024).toFixed(2) + ' KB',
              count: parsedAssets.length
          });
      }
      setImportStatus(null); // reset UI block
  };

  const downloadValidationReport = (report) => {
     if (!report || report.length === 0) return;
     const headers = ["Row Number", "Column Name", "Current Value", "Suggested Fix"];
     const csvRows = [headers.join(",")];
     
     report.forEach(err => {
         const rowNum = err.duplicateRow || err.row || '';
         const colName = err.type || err.column || '';
         const curValue = (err.value || '').toString().replace(/,/g, '');
         let fix = err.fix || '';
         if (err.firstRow) {
             fix = `Matches Row ${err.firstRow} (${err.asset1Context}). Must be unique.`;
         }
         fix = fix.replace(/,/g, '');
         csvRows.push([rowNum, colName, curValue, fix].join(","));
     });
     
     const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
     const url = URL.createObjectURL(blob);
     const link = document.createElement("a");
     link.setAttribute("href", url);
     link.setAttribute("download", "bulk_validation_report.csv");
     document.body.appendChild(link);
     link.click();
     document.body.removeChild(link);
     URL.revokeObjectURL(url);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setValidationReport(null);
    setSelectedFileInfo(null);
    setPendingUpload(null);
    setCsvData([]);

    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(arrayBuffer);
        const worksheet = workbook.getWorksheet(1);
        
        let parsedAssets = [];
        let headers = [];
        
        worksheet.eachRow((row, rowNumber) => {
           if (rowNumber === 1) {
              headers = row.values.slice(1).map(h => h ? h.toString().trim() : '');
           } else {
              const assetObj = {};
              headers.forEach((h, index) => {
                 let val = row.values[index + 1];
                 if (val === undefined || val === '') val = null;
                 else if (val && typeof val === 'object' && val.text) val = val.text;
                 else if (val && val instanceof Date) val = val.toISOString().split('T')[0];
                 else val = val.toString().trim();
                 assetObj[h] = val;
              });
              parsedAssets.push(assetObj);
           }
        });
        processParsedAssets(parsedAssets, file);
      } catch (err) {
        showToast('Failed to parse Excel file', 'error');
      }
      e.target.value = null;
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      const rows = parseCSV(text).filter(r => r.length > 1 || (r.length === 1 && r[0] !== ''));
      if(rows.length < 2) return showToast('Invalid CSV: requires header row and data.', 'error');
      
      const headers = rows[0];
      let parsedAssets = [];
      
      for (let i = 1; i < rows.length; i++) {
        const values = rows[i];
        const assetObj = {};
        headers.forEach((h, index) => {
          let val = values[index];
          if (val === '' || val === undefined) val = null;
          assetObj[h] = val;
        });
        parsedAssets.push(assetObj);
      }

      // Pre-flight check for duplicates in the file itself
      const codesInFile = new Map();
      const serialsInFile = new Map();
      let fileErrors = [];

      for (let i = 0; i < parsedAssets.length; i++) {
         const asset = parsedAssets[i];
         const rowNum = i + 2; // +1 for header, +1 for 1-index
         const getContext = () => `${asset.deviceType || 'Unknown'} - ${asset.assignmentType === 'EMPLOYEE' ? asset.employeeName || asset.employeeCode : asset.departmentName || asset.locationName || 'Unknown'}`;

         if (asset.assetCode) {
            if (codesInFile.has(asset.assetCode)) {
               const first = codesInFile.get(asset.assetCode);
               fileErrors.push({
                   type: 'Duplicate Asset Code',
                   value: asset.assetCode,
                   firstRow: first.rowNum,
                   duplicateRow: rowNum,
                   asset1Context: first.context,
                   asset2Context: getContext()
               });
            } else {
               codesInFile.set(asset.assetCode, { rowNum, context: getContext() });
            }
         }
         if (asset.serialNumber && asset.serialNumber.trim() !== '' && asset.serialNumber.trim().toLowerCase() !== 'no serial') {
            if (serialsInFile.has(asset.serialNumber)) {
               const first = serialsInFile.get(asset.serialNumber);
               fileErrors.push({
                   type: 'Duplicate Serial Number',
                   value: asset.serialNumber,
                   firstRow: first.rowNum,
                   duplicateRow: rowNum,
                   asset1Context: first.context,
                   asset2Context: getContext()
               });
            } else {
               serialsInFile.set(asset.serialNumber, { rowNum, context: getContext() });
            }
         }
      }

      if (fileErrors.length > 0) {
         setValidationReport(fileErrors);
         setPendingUpload({ parsedAssets, file });
         showToast(`Validation Failed: Found ${fileErrors.length} duplicates in your file.`, 'error');
         e.target.value = null;
         return;
      }
      
      processParsedAssets(parsedAssets, file);
    };
    reader.readAsText(file);
    e.target.value = null; // reset allowing same upload binding securely
  };

  const handleBulkImport = async () => {
      if(!csvData || csvData.length === 0) return;
      setIsImporting(true);
      setImportStatus(null);
      setUploadProgress(0);
      setTransferredCount(0);
      const startTime = performance.now();
      
      try {
         const token = localStorage.getItem('token');
         const chunkSize = 100;
         const totalChunks = Math.ceil(csvData.length / chunkSize);
         
         let aggregatedResults = {
           totalRows: 0,
           createdLocations: 0,
           createdDepartments: 0,
           createdEmployees: 0,
           updatedEmployees: 0,
           createdAssets: 0,
           createdAssignments: 0,
           skippedRows: 0,
           errors: []
         };

         for (let i = 0; i < totalChunks; i++) {
            const chunk = csvData.slice(i * chunkSize, (i + 1) * chunkSize);
            const rowOffset = (i * chunkSize) + 2; // +2 because Excel rows start at 1 and Row 1 is header

            const res = await fetch(`${API_URL}/assets/bulk`, {
               method: 'POST',
               headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
               body: JSON.stringify({ assets: chunk, rowOffset, forceUpload: forceUploadFlag })
            });
            
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Server rejected CSV pipeline');

            aggregatedResults.totalRows += data.totalRows || 0;
            aggregatedResults.createdLocations += data.createdLocations || 0;
            aggregatedResults.createdDepartments += data.createdDepartments || 0;
            aggregatedResults.createdEmployees += data.createdEmployees || 0;
            aggregatedResults.updatedEmployees += data.updatedEmployees || 0;
            aggregatedResults.createdAssets += data.createdAssets || 0;
            aggregatedResults.createdAssignments += data.createdAssignments || 0;
            aggregatedResults.skippedRows += data.skippedRows || 0;
            
            if (data.errors && data.errors.length > 0) {
                aggregatedResults.errors.push(...data.errors);
            }
            
            setTransferredCount(Math.min((i + 1) * chunkSize, csvData.length));
            setUploadProgress(Math.round(((i + 1) / totalChunks) * 100));
         }

         // Pre-fetch Dashboard APIs so it's ready in cache
         try {
           const dbRes = await fetch(`${API_URL}/dashboard/advanced`, { headers: { 'Authorization': `Bearer ${token}` } });
           if (dbRes.ok) {
             const result = await dbRes.json();
             localStorage.setItem('analyticsDashboardCache', JSON.stringify(result));
           }
         } catch (e) {
           console.error("Dashboard cache pre-warm failed", e);
         }

         const endTime = performance.now();
         aggregatedResults.processingTime = ((endTime - startTime) / 1000).toFixed(2);
         
         // If there are fatal errors or we want to show validation, we could set status
         // But per requirements, on success navigate immediately to dashboard
         if (aggregatedResults.errors.length > 0) {
            setImportStatus(aggregatedResults);
         } else {
            console.log('Successfully transferred assets to database.');
            console.log('Upload Summary:', aggregatedResults);
            showToast('Bulk import completed successfully!', 'success');
            navigate('/dashboard');
         }
      } catch (err) {
         setImportStatus({ fatal: err.message });
      } finally {
         setIsImporting(false);
         setForceUploadFlag(false);
      }
  };

  const handleDownloadExcelTemplate = async () => {
     try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/assets/template/download`, {
           headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        if (!res.ok) throw new Error('Failed to download master template');
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'Templates.xlsx';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
     } catch (err) {
        showToast(err.message, 'error');
     }
  };

  const handleExportInventoryExcel = async () => {
     try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/assets/export/excel`, {
           headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to export inventory Excel');
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const dateString = new Date().toISOString().split('T')[0];
        a.download = `Current_IT_Inventory_${dateString}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
     } catch (err) {
        showToast(err.message, 'error');
     }
  };

  const handleDownloadGuide = async () => {
     try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/assets/guide/download`, {
           headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        if (!res.ok) throw new Error('Failed to download bulk upload guide');
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'Bulk Upload Guide.xlsx';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
     } catch (err) {
        showToast(err.message, 'error');
     }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">System Settings</h1>
        <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">Configure global application settings and preferences.</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-white mb-6 border-b border-slate-100 pb-2">Asset Configuration</h2>
          
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Asset Code Prefix</label>
              <div className="flex gap-4">
                <input 
                  type="text" 
                  className="w-1/2 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 font-mono"
                  value={assetCodePrefix}
                  onChange={e => setAssetCodePrefix(e.target.value)}
                />
                <select className="w-1/2 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 text-slate-700">
                  <option>Year Format (-YYYY-)</option>
                  <option>Month-Year (-MMYY-)</option>
                  <option>No Date Formatting</option>
                </select>
              </div>
              <p className="text-xs text-slate-500 mt-2">Example of generated code: <strong>AST-2024-001</strong></p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Default Warranty Period (Months)</label>
              <input 
                type="number" 
                className="w-full md:w-1/2 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 text-slate-700"
                value={warrantyPeriod}
                onChange={e => setWarrantyPeriod(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-slate-100 bg-slate-50/30">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-white mb-6 border-b border-slate-100 pb-2 flex items-center gap-2">
             <UploadCloud className="w-5 h-5 text-blue-600" />
             Bulk Asset Initialization (CSV Pipeline)
          </h2>
          
          <div className="space-y-6">
            {/* STEP 1: Download Templates */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
               <h3 className="text-base font-bold text-slate-800 flex items-center gap-2 mb-4">
                  <span className="bg-blue-100 text-blue-700 w-6 h-6 rounded-full flex items-center justify-center text-xs">1</span>
                  Download Sample Template
               </h3>
               <div className="flex flex-wrap gap-4">
                  <button onClick={handleDownloadExcelTemplate} className="cursor-pointer inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-50 border border-emerald-200 text-emerald-700 font-medium rounded-xl hover:bg-emerald-100 transition-colors shadow-sm">
                     <FileText className="w-4 h-4 text-emerald-600" />
                     Download Sample Template
                  </button>
                  <button onClick={handleExportInventoryExcel} className="cursor-pointer inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-50 border border-indigo-200 text-indigo-700 font-medium rounded-xl hover:bg-indigo-100 transition-colors shadow-sm">
                     <DownloadCloud className="w-4 h-4 text-indigo-600" />
                     Download Current Inventory
                  </button>
                  <button onClick={handleDownloadGuide} className="cursor-pointer inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-50 border border-blue-200 text-blue-700 font-medium rounded-xl hover:bg-blue-100 transition-colors shadow-sm">
                     <FileText className="w-4 h-4 text-blue-600" />
                     Download Bulk Upload Guide
                  </button>
               </div>
            </div>

            {/* STEP 2: Instructions */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
               <h3 className="text-base font-bold text-slate-800 flex items-center gap-2 mb-4">
                  <span className="bg-blue-100 text-blue-700 w-6 h-6 rounded-full flex items-center justify-center text-xs">2</span>
                  Read the Upload Instructions
               </h3>
               <div className="text-sm text-slate-600 space-y-2">
                  <p>Follow these steps to ensure a successful upload:</p>
                  <ol className="list-decimal pl-5 space-y-1">
                     <li>Download the sample template above.</li>
                     <li>Keep the column names exactly as they are in the header row. Do not modify or delete the header row.</li>
                     <li>Fill in your asset information. Delete the sample rows before saving.</li>
                     <li>Select the correct <strong>assignmentType</strong> (EMPLOYEE, DEPARTMENT, LOCATION, SHARED, STORE).</li>
                     <li>Ensure the <strong>Asset Code</strong> is unique for every row.</li>
                     <li>If a <strong>Serial Number</strong> is available, it must be unique across all records.</li>
                     <li>Save the file as a CSV or Excel (.xlsx) file.</li>
                     <li>Click "Select File" below to upload.</li>
                     <li>Review any validation errors and correct them in your file before re-uploading.</li>
                  </ol>
               </div>
            </div>

            {/* STEP 3: Upload */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
               <h3 className="text-base font-bold text-slate-800 flex items-center gap-2 mb-4">
                  <span className="bg-blue-100 text-blue-700 w-6 h-6 rounded-full flex items-center justify-center text-xs">3</span>
                  Upload Your Completed File
               </h3>
               
               {!selectedFileInfo && (
                  <label className="cursor-pointer inline-flex items-center justify-center gap-2 px-6 py-3 bg-indigo-50 border border-indigo-200 text-indigo-700 font-medium rounded-xl hover:bg-indigo-100 transition-colors shadow-sm">
                     <UploadCloud className="w-5 h-5 text-indigo-600" />
                     Select File (.csv, .xlsx)
                     <input type="file" accept=".csv, .xlsx, .xls" onChange={handleFileUpload} className="hidden" />
                  </label>
               )}

               {selectedFileInfo && !importStatus && !validationReport && (
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex flex-col md:flex-row items-center justify-between gap-4">
                     <div>
                        <p className="text-sm text-slate-500 font-medium">Selected File:</p>
                        <p className="text-lg font-bold text-slate-800">{selectedFileInfo.name}</p>
                        <p className="text-sm text-slate-600">{selectedFileInfo.count} Records • {selectedFileInfo.size}</p>
                     </div>
                     <div className="flex gap-3">
                        <button 
                           onClick={() => { setSelectedFileInfo(null); setCsvData([]); setForceUploadFlag(false); }}
                           disabled={isImporting}
                           className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                           Cancel
                        </button>
                        <button 
                           onClick={handleBulkImport}
                           disabled={isImporting}
                           className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 flex items-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                           <Play className="w-4 h-4" /> {isImporting ? 'Uploading...' : 'Upload Assets'}
                        </button>
                     </div>
                  </div>
               )}
            </div>

            {/* VALIDATION REPORT */}
            {validationReport && (
               <div className="bg-red-50 border border-red-200 rounded-xl overflow-hidden shadow-sm animate-in fade-in duration-300">
                  <div className="bg-red-100/50 px-4 py-3 border-b border-red-200 flex justify-between items-center">
                     <h3 className="text-red-800 font-bold flex items-center gap-2">
                        <AlertCircle className="w-5 h-5" /> 
                        Validation Failed: {validationReport.length} Duplicates Found
                     </h3>
                     <div className="flex gap-2">
                        {user?.role === 'ADMIN' && pendingUpload && (
                           <button 
                              onClick={() => {
                                 setForceUploadFlag(true);
                                 processParsedAssets(pendingUpload.parsedAssets, pendingUpload.file);
                                 setValidationReport(null);
                                 setPendingUpload(null);
                              }}
                              className="px-3 py-1.5 bg-red-600 text-white border border-red-700 rounded-lg hover:bg-red-700 flex items-center gap-2 text-sm font-semibold shadow-sm transition-colors"
                           >
                              <Play className="w-4 h-4" /> Force Upload
                           </button>
                        )}
                        <button 
                           onClick={() => downloadValidationReport(validationReport)}
                           className="px-3 py-1.5 bg-white text-red-700 border border-red-200 rounded-lg hover:bg-red-50 flex items-center gap-2 text-sm font-semibold shadow-sm transition-colors"
                        >
                           <Download className="w-4 h-4" /> Download Report
                        </button>
                     </div>
                  </div>
                  <div className="overflow-x-auto max-h-80 overflow-y-auto">
                     <table className="w-full text-sm text-left">
                        <thead className="bg-red-50 text-red-800 sticky top-0 shadow-sm">
                           <tr>
                              <th className="px-4 py-2.5 font-semibold">Row Number</th>
                              <th className="px-4 py-2.5 font-semibold">Column Name</th>
                              <th className="px-4 py-2.5 font-semibold">Current Value</th>
                              <th className="px-4 py-2.5 font-semibold">Suggested Fix</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-red-100">
                           {validationReport.map((err, idx) => (
                              <tr key={idx} className="bg-white text-slate-700 hover:bg-red-50/30 transition-colors">
                                 <td className="px-4 py-3 font-bold text-red-700">Row {err.duplicateRow || err.row}</td>
                                 <td className="px-4 py-3 font-medium">{err.type || err.column}</td>
                                 <td className="px-4 py-3 font-mono text-xs">{err.value}</td>
                                 <td className="px-4 py-3 text-xs">
                                    {err.firstRow ? (
                                        <>Matches Row {err.firstRow} ({err.asset1Context}). Must be unique.</>
                                    ) : (
                                        err.fix
                                    )}
                                 </td>
                              </tr>
                           ))}
                        </tbody>
                     </table>
                  </div>
               </div>
            )}

            {/* IMPORTING PROGRESS MODAL */}
            {isImporting && (
               <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
                 <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-2xl flex flex-col items-center justify-center space-y-6 max-w-md w-full mx-4">
                  <div className="flex flex-col items-center gap-3">
                    <div className="p-4 bg-indigo-50 rounded-full">
                       <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
                    </div>
                    <span className="text-slate-800 font-bold text-xl">Transferring assets to database...</span>
                    <span className="text-slate-500 text-sm text-center">
                       Processing {selectedFileInfo?.count || csvData.length} records.<br/>
                       Please do not close or refresh this window.
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden border border-slate-200 shadow-inner relative">
                    <div 
                      className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full rounded-full transition-all duration-300 ease-out flex items-center justify-end pr-2"
                      style={{ width: `${Math.max(uploadProgress, 2)}%` }}
                    >
                    </div>
                  </div>
                  <div className="text-indigo-700 font-bold text-lg flex flex-col items-center">
                     <span>{uploadProgress}% Complete</span>
                     <span className="text-sm font-medium text-slate-500 mt-1">{transferredCount} out of {csvData.length} transferred</span>
                  </div>
                 </div>
               </div>
            )}

            {importStatus && (
               <div className={`mt-6 p-6 rounded-2xl border shadow-sm ${importStatus.fatal ? 'bg-red-50 border-red-200' : 'bg-white border-emerald-200'}`}>
                  {importStatus.fatal ? (
                     <div className="flex items-start gap-3">
                        <AlertCircle className="w-6 h-6 text-red-500 shrink-0" />
                        <div>
                           <h3 className="font-bold text-red-700 block">FATAL SYSTEM REJECTION</h3>
                           <p className="text-sm text-red-600 mt-1">{importStatus.fatal}</p>
                        </div>
                     </div>
                  ) : (
                     <div className="animate-in fade-in zoom-in-95 duration-500">
                        <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
                           <h3 className="text-xl font-bold text-slate-800 flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                                <CheckCircle2 className="w-6 h-6" />
                              </div>
                              Pipeline Transaction Complete
                           </h3>
                           <div className="flex items-center gap-3">
                             {importStatus.processingTime && (
                                <span className="bg-slate-100 text-slate-600 px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5">
                                   <Activity className="w-3.5 h-3.5" />
                                   {importStatus.processingTime}s
                                </span>
                             )}
                             <button onClick={() => navigate('/')} className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-indigo-700 shadow-sm flex items-center gap-2 transition-all hover:scale-105 active:scale-95">
                               Go to Dashboard
                             </button>
                           </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-9 gap-3 mb-6">
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-center">
                               <span className="text-2xl font-black text-slate-700">{importStatus.totalRows}</span>
                               <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Parsed</p>
                            </div>
                            <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 text-center">
                               <span className="text-2xl font-black text-emerald-700">{importStatus.imported ?? importStatus.createdAssets ?? 0}</span>
                               <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mt-1">Imported</p>
                            </div>
                            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 text-center">
                               <span className="text-2xl font-black text-blue-700">{importStatus.updated ?? importStatus.updatedAssets ?? 0}</span>
                               <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mt-1">Updated</p>
                            </div>
                            <div className="bg-cyan-50 p-4 rounded-xl border border-cyan-100 text-center">
                               <span className="text-2xl font-black text-cyan-700">{importStatus.createdLocations}</span>
                               <p className="text-[10px] font-bold text-cyan-600 uppercase tracking-widest mt-1">Locations</p>
                            </div>
                            <div className="bg-purple-50 p-4 rounded-xl border border-purple-100 text-center">
                               <span className="text-2xl font-black text-purple-700">{importStatus.createdDepartments}</span>
                               <p className="text-[10px] font-bold text-purple-600 uppercase tracking-widest mt-1">Depts</p>
                            </div>
                            <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 text-center">
                               <span className="text-2xl font-black text-indigo-700">{importStatus.createdEmployees}</span>
                               <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest mt-1">Staff New</p>
                            </div>
                            <div className="bg-green-50 p-4 rounded-xl border border-green-100 text-center">
                               <span className="text-2xl font-black text-green-700">{importStatus.createdAssignments}</span>
                               <p className="text-[10px] font-bold text-green-600 uppercase tracking-widest mt-1">Bound</p>
                            </div>
                            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-center">
                               <span className="text-2xl font-black text-gray-700">{importStatus.skipped ?? 0}</span>
                               <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest mt-1">Skipped</p>
                            </div>
                            <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 text-center">
                               <span className="text-2xl font-black text-orange-700">{importStatus.failed ?? (importStatus.errors ? importStatus.errors.length : 0)}</span>
                               <p className="text-[10px] font-bold text-orange-600 uppercase tracking-widest mt-1">Failed</p>
                            </div>
                         </div>

                        {importStatus.errors && importStatus.errors.length > 0 && (
                           <div className="bg-orange-50 border border-orange-200 rounded-xl overflow-hidden mt-6 shadow-sm">
                              <div className="bg-orange-100/80 px-4 py-3 border-b border-orange-200 flex items-center justify-between">
                                 <span className="text-sm font-bold text-orange-800 flex items-center gap-2">
                                   <AlertCircle className="w-4 h-4" /> Import Report: {importStatus.errors.length} Failed Records
                                 </span>
                                 <button                                      onClick={() => {
                                        if (!importStatus.errors.length) return;
                                        
                                        const headers = ['Row Number', 'Asset Code', 'Column Name', 'Current Value', 'Failure Reason'];
                                        const csvRows = [headers.join(',')];
                                        
                                        importStatus.errors.forEach(err => {
                                           const rowNum = err.row || '';
                                           const assetCode = err.assetCode || '';
                                           const colName = err.column || '';
                                           const curValue = (err.value || '').toString().replace(/"/g, '""');
                                           const fix = (err.fix || '').toString().replace(/"/g, '""');
                                           
                                           csvRows.push(`"${rowNum}","${assetCode}","${colName}","${curValue}","${fix}"`);
                                        });
                                        
                                        const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
                                        const url = URL.createObjectURL(blob);
                                        const link = document.createElement("a");
                                        link.setAttribute("href", url);
                                        link.setAttribute("download", "bulk_upload_error_report.csv");
                                        document.body.appendChild(link);
                                        link.click();
                                        document.body.removeChild(link);
                                        URL.revokeObjectURL(url);
                                    }}
                                    className="px-4 py-2 bg-white text-orange-700 border border-orange-200 rounded-lg hover:bg-orange-50 flex items-center gap-2 text-xs font-bold shadow-sm transition-colors"
                                 >
                                    <DownloadCloud className="w-4 h-4" /> Download Error Report (CSV)
                                 </button>
                              </div>
                              <div className="overflow-x-auto max-h-64 overflow-y-auto">
                                 <table className="w-full text-sm text-left">
                                    <thead className="bg-orange-100/50 text-orange-800 sticky top-0 shadow-sm">
                                       <tr>
                                          <th className="px-4 py-2.5 font-semibold">Row</th>
                                          <th className="px-4 py-2.5 font-semibold">Asset Code</th>
                                          <th className="px-4 py-2.5 font-semibold">Status</th>
                                          <th className="px-4 py-2.5 font-semibold">Failure Reason</th>
                                       </tr>
                                    </thead>
                                    <tbody className="divide-y divide-orange-100">
                                       {importStatus.errors.map((err, idx) => (
                                          <tr key={idx} className="bg-white text-slate-700 hover:bg-orange-50/30 transition-colors">
                                             <td className="px-4 py-3 font-bold text-orange-700">{err.row}</td>
                                             <td className="px-4 py-3 font-medium text-slate-900">{err.assetCode}</td>
                                             <td className="px-4 py-3 font-bold text-red-600">Failed</td>
                                             <td className="px-4 py-3 text-xs text-orange-800">{err.fix}</td>
                                          </tr>
                                       ))}
                                    </tbody>
                                 </table>
                              </div>
                           </div>
                        )}
                     </div>
                  )}
               </div>
            )}
          </div>
        </div>

        <div className="p-6 border-t border-slate-100">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-white mb-6 border-b border-slate-100 pb-2">User Roles & Permissions</h2>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <h3 className="font-medium text-slate-800 dark:text-white">Administrator</h3>
                <p className="text-sm text-slate-500">Full access to all system modules, configurations, and exports.</p>
              </div>
              <button className="text-blue-600 hover:text-blue-700 font-medium text-sm">Edit Role</button>
            </div>
            
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <h3 className="font-medium text-slate-800 dark:text-white">IT Support</h3>
                <p className="text-sm text-slate-500">Can manage assets, log maintenance, and assign equipment.</p>
              </div>
              <button className="text-blue-600 hover:text-blue-700 font-medium text-sm">Edit Role</button>
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <h3 className="font-medium text-slate-800 dark:text-white">Viewer</h3>
                <p className="text-sm text-slate-500">Read-only access to Dashboards and Reports.</p>
              </div>
              <button className="text-blue-600 hover:text-blue-700 font-medium text-sm">Edit Role</button>
            </div>
          </div>
        </div>

        <div className="bg-slate-50 p-4 border-t border-slate-100 flex justify-end gap-4">
          <button type="button" className="px-6 py-2 border border-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-100 transition-colors">
            Discard Changes
          </button>
          <button 
            type="button" 
            onClick={handleSaveSettings}
            className="px-6 py-2 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}
