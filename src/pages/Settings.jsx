import { useState, useEffect } from 'react';
import { Save, User, Building2, Server, Globe, DownloadCloud, Activity, UploadCloud, Play, FileText, CheckCircle2, AlertCircle, Eye, Download, Search } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useNavigate } from 'react-router-dom';
import * as ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

const _rawApi = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const API_URL = _rawApi.endsWith('/api') ? _rawApi : `${_rawApi.replace(/\/$/, '')}/api`;

export default function Settings() {
  const { showToast } = useToast();
  const navigate = useNavigate();
  
  const [csvData, setCsvData] = useState([]);
  const [importStatus, setImportStatus] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isImporting, setIsImporting] = useState(false);
  const [validationReport, setValidationReport] = useState(null);
  const [selectedFileInfo, setSelectedFileInfo] = useState(null);
  
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
     
     const csvContent = "data:text/csv;charset=utf-8," + csvRows.join("\\n");
     const encodedUri = encodeURI(csvContent);
     const link = document.createElement("a");
     link.setAttribute("href", encodedUri);
     link.setAttribute("download", "validation_error_report.csv");
     document.body.appendChild(link);
     link.click();
     document.body.removeChild(link);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setValidationReport(null);
    setSelectedFileInfo(null);
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
               body: JSON.stringify({ assets: chunk, rowOffset })
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
         setImportStatus(aggregatedResults);
      } catch (err) {
         setImportStatus({ fatal: err.message });
      } finally {
         setIsImporting(false);
      }
  };

  const handleDownloadExcelTemplate = async () => {
     const headers = ["assignmentType", "locationName", "departmentName", "employeeCode", "employeeName", "email", "phone", "designation", "employeeStatus", "deviceType", "model", "serialNumber", "assetCode", "processor", "ram", "storage", "operatingSystem", "vendor", "purchaseDate", "warrantyExpiryDate", "status", "brand", "condition", "remarks"];
     const sampleRows = [
        ["EMPLOYEE", "Head Office", "IT", "EMP001", "John Silva", "john.silva@euromotors.lk", "0771234567", "IT Executive", "Active", "Laptop", "Dell Latitude 5450", "DL54501234", "LAP001", "Intel Core i5", "16GB", "512GB SSD", "Windows 11 Pro", "Dell", "2025-01-10", "2028-01-10", "Active", "Dell", "Excellent", "Assigned to employee"],
        ["DEPARTMENT", "Head Office", "Finance", "", "", "", "", "", "", "Photocopier", "Canon IR 2630", "CN26304567", "PH001", "", "", "", "", "Canon", "2024-05-12", "2027-05-12", "Active", "Canon", "Good", "Finance department photocopier"],
        ["LOCATION", "Kaduwela Showroom", "", "", "", "", "", "", "", "Router", "Cisco ISR 1100", "CS11001234", "RT001", "", "", "", "Cisco IOS", "Cisco", "2025-02-20", "2030-02-20", "Active", "Cisco", "Excellent", "Installed in showroom"],
        ["SHARED", "Head Office", "Administration", "", "", "", "", "", "", "Projector", "Epson EB-X06", "EPX061234", "PJ001", "", "", "", "", "Epson", "2024-08-15", "2027-08-15", "Active", "Epson", "Good", "Shared meeting room projector"],
        ["STORE", "Central Warehouse", "IT Store", "", "", "", "", "", "", "Laptop", "HP ProBook 450 G10", "HP4505678", "ST001", "Intel Core i7", "16GB", "512GB SSD", "Windows 11 Pro", "HP", "2025-04-18", "2028-04-18", "In Stock", "HP", "New", "Available in IT Store"]
     ];

     const workbook = new ExcelJS.Workbook();
     const worksheet = workbook.addWorksheet('Asset Import Template');

     worksheet.views = [ { state: 'frozen', ySplit: 1 } ];

     const headerRow = worksheet.addRow(headers);
     
     headerRow.eachCell((cell, colNumber) => {
       cell.fill = {
         type: 'pattern',
         pattern: 'solid',
         fgColor: { argb: 'FF2563EB' } // Tailwind blue-600
       };
       cell.font = {
         color: { argb: 'FFFFFFFF' },
         bold: true
       };
     });

     sampleRows.forEach(row => {
        worksheet.addRow(row);
     });

     for (let i = 2; i <= 1000; i++) {
        worksheet.getCell(`A${i}`).dataValidation = {
           type: 'list',
           allowBlank: false,
           formulae: ['"EMPLOYEE,DEPARTMENT,LOCATION,SHARED,STORE"']
        };
     }

     worksheet.columns.forEach(column => {
        let maxLength = 0;
        column["eachCell"]({ includeEmpty: true }, (cell) => {
           let columnLength = cell.value ? cell.value.toString().length : 10;
           if (columnLength > maxLength) {
              maxLength = columnLength;
           }
        });
        column.width = maxLength < 10 ? 10 : maxLength + 2;
     });

     const buffer = await workbook.xlsx.writeBuffer();
     saveAs(new Blob([buffer]), 'asset_bulk_import_template.xlsx');
  };

  const handleDownloadCsvTemplate = () => {
     const headers = ["assignmentType", "locationName", "departmentName", "employeeCode", "employeeName", "email", "phone", "designation", "employeeStatus", "deviceType", "model", "serialNumber", "assetCode", "processor", "ram", "storage", "operatingSystem", "vendor", "purchaseDate", "warrantyExpiryDate", "status", "brand", "condition", "remarks"];
     const sampleRows = [
        ["EMPLOYEE", "Head Office", "IT", "EMP001", "John Silva", "john.silva@euromotors.lk", "0771234567", "IT Executive", "Active", "Laptop", "Dell Latitude 5450", "DL54501234", "LAP001", "Intel Core i5", "16GB", "512GB SSD", "Windows 11 Pro", "Dell", "2025-01-10", "2028-01-10", "Active", "Dell", "Excellent", "Assigned to employee"],
        ["DEPARTMENT", "Head Office", "Finance", "", "", "", "", "", "", "Photocopier", "Canon IR 2630", "CN26304567", "PH001", "", "", "", "", "Canon", "2024-05-12", "2027-05-12", "Active", "Canon", "Good", "Finance department photocopier"],
        ["LOCATION", "Kaduwela Showroom", "", "", "", "", "", "", "", "Router", "Cisco ISR 1100", "CS11001234", "RT001", "", "", "", "Cisco IOS", "Cisco", "2025-02-20", "2030-02-20", "Active", "Cisco", "Excellent", "Installed in showroom"],
        ["SHARED", "Head Office", "Administration", "", "", "", "", "", "", "Projector", "Epson EB-X06", "EPX061234", "PJ001", "", "", "", "", "Epson", "2024-08-15", "2027-08-15", "Active", "Epson", "Good", "Shared meeting room projector"],
        ["STORE", "Central Warehouse", "IT Store", "", "", "", "", "", "", "Laptop", "HP ProBook 450 G10", "HP4505678", "ST001", "Intel Core i7", "16GB", "512GB SSD", "Windows 11 Pro", "HP", "2025-04-18", "2028-04-18", "In Stock", "HP", "New", "Available in IT Store"]
     ];
     const csvContent = headers.join(",") + "\n" + sampleRows.map(e => e.join(",")).join("\n");
     const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
     const link = document.createElement("a");
     const url = URL.createObjectURL(blob);
     link.setAttribute("href", url);
     link.setAttribute("download", "asset_bulk_import_template.csv");
     link.style.visibility = 'hidden';
     document.body.appendChild(link);
     link.click();
     document.body.removeChild(link);
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
                  <button onClick={handleDownloadExcelTemplate} className="cursor-pointer inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-green-50 border border-green-200 text-green-700 font-medium rounded-xl hover:bg-green-100 transition-colors shadow-sm">
                     <FileText className="w-4 h-4 text-green-600" />
                     Download Excel Template (.xlsx)
                  </button>
                  <button onClick={handleDownloadCsvTemplate} className="cursor-pointer inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-50 border border-blue-200 text-blue-700 font-medium rounded-xl hover:bg-blue-100 transition-colors shadow-sm">
                     <FileText className="w-4 h-4 text-blue-600" />
                     Download CSV Template (.csv)
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
                           onClick={() => { setSelectedFileInfo(null); setCsvData([]); }}
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
                     <button 
                        onClick={() => downloadValidationReport(validationReport)}
                        className="px-3 py-1.5 bg-white text-red-700 border border-red-200 rounded-lg hover:bg-red-50 flex items-center gap-2 text-sm font-semibold shadow-sm transition-colors"
                     >
                        <Download className="w-4 h-4" /> Download Report
                     </button>
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
                    <span className="text-slate-800 font-bold text-xl">Uploading Assets...</span>
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
                  <div className="text-indigo-700 font-bold text-lg">{uploadProgress}% Complete</div>
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

                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-6">
                           <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-center col-span-2 lg:col-span-1">
                              <span className="text-2xl font-black text-slate-700">{importStatus.totalRows}</span>
                              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Parsed</p>
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
                           <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 text-center">
                              <span className="text-2xl font-black text-blue-700">{importStatus.updatedEmployees || 0}</span>
                              <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mt-1">Staff Upd</p>
                           </div>
                           <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 text-center">
                              <span className="text-2xl font-black text-emerald-700">{importStatus.createdAssets}</span>
                              <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mt-1">Assets</p>
                           </div>
                           <div className="bg-green-50 p-4 rounded-xl border border-green-100 text-center">
                              <span className="text-2xl font-black text-green-700">{importStatus.createdAssignments}</span>
                              <p className="text-[10px] font-bold text-green-600 uppercase tracking-widest mt-1">Bound</p>
                           </div>
                           <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 text-center">
                              <span className="text-2xl font-black text-orange-700">{importStatus.skippedRows}</span>
                              <p className="text-[10px] font-bold text-orange-600 uppercase tracking-widest mt-1">Failed</p>
                           </div>
                        </div>

                        {importStatus.errors && importStatus.errors.length > 0 && (
                           <div className="bg-orange-50 border border-orange-200 rounded-xl overflow-hidden mt-4">
                              <div className="bg-orange-100/50 px-4 py-3 border-b border-orange-200 flex items-center justify-between">
                                 <span className="text-sm font-bold text-orange-800 flex items-center gap-2">
                                   <AlertCircle className="w-4 h-4" /> Error Boundary Details ({importStatus.errors.length})
                                 </span>
                                 <button 
                                    onClick={() => {
                                        const csvContent = "data:text/csv;charset=utf-8,Error\\n" + importStatus.errors.join("\\n");
                                        const encodedUri = encodeURI(csvContent);
                                        const link = document.createElement("a");
                                        link.setAttribute("href", encodedUri);
                                        link.setAttribute("download", "bulk_upload_error_report.csv");
                                        document.body.appendChild(link);
                                        link.click();
                                        document.body.removeChild(link);
                                    }}
                                    className="px-3 py-1.5 bg-white text-orange-700 border border-orange-200 rounded-lg hover:bg-orange-100 flex items-center gap-2 text-xs font-bold shadow-sm transition-colors"
                                 >
                                    <DownloadCloud className="w-3.5 h-3.5" /> Download Error Report
                                 </button>
                              </div>
                              <div className="p-4 max-h-48 overflow-y-auto space-y-2">
                                 {importStatus.errors.map((err, dx) => (
                                    <div key={dx} className="bg-white px-3 py-2 rounded border border-orange-100 text-xs text-orange-700 font-mono shadow-sm flex items-start gap-2">
                                       <span className="text-orange-400 mt-0.5 shrink-0">•</span>
                                       <span>{err}</span>
                                    </div>
                                 ))}
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
