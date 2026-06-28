import { useState, useEffect } from 'react';
import { Save, UploadCloud, AlertCircle, CheckCircle2, FileText, Loader2, Play } from 'lucide-react';
import { useToast } from '../context/ToastContext';

const _rawApi = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const API_URL = _rawApi.endsWith('/api') ? _rawApi : `${_rawApi.replace(/\/$/, '')}/api`;

export default function Settings() {
  const { showToast } = useToast();
  
  const [csvData, setCsvData] = useState([]);
  const [importStatus, setImportStatus] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  
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

  function parseCSVLine(text) {
      let ret = [], val = '', quote = false;
      for (let i = 0; i < text.length; i++) {
          let cc = text[i], nc = text[i+1];
          if (cc === '"' && quote && nc === '"') { val += '"'; i++; }
          else if (cc === '"') { quote = !quote; }
          else if (cc === ',' && !quote) { ret.push(val.trim()); val = ''; }
          else { val += cc; }
      }
      ret.push(val.trim());
      return ret;
  }

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      const rows = text.split('\n').map(r => r.trim()).filter(r => r);
      if(rows.length < 2) return showToast('Invalid CSV: requires header row and data.', 'error');
      
      const headers = parseCSVLine(rows[0]);
      const parsedAssets = [];
      
      for (let i = 1; i < rows.length; i++) {
        const values = parseCSVLine(rows[i]);
        const assetObj = {};
        headers.forEach((h, index) => {
          let val = values[index];
          if (val === '') val = null;
          assetObj[h] = val;
        });
        parsedAssets.push(assetObj);
      }
      setCsvData(parsedAssets);
      setImportStatus(null); // reset UI block
    };
    reader.readAsText(file);
    e.target.value = null; // reset allowing same upload binding securely
  };

  const handleBulkImport = async () => {
      if(!csvData || csvData.length === 0) return;
      setIsImporting(true);
      setImportStatus(null);
      
      try {
         const token = localStorage.getItem('token');
         const res = await fetch(`${API_URL}/assets/bulk`, {
             method: 'POST',
             headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
             },
             body: JSON.stringify({ assets: csvData })
         });
         
         const data = await res.json();
         if (!res.ok) throw new Error(data.error || 'Server rejected CSV pipeline');

         setImportStatus(data);
      } catch (err) {
         setImportStatus({ fatal: err.message });
      } finally {
         setIsImporting(false);
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
          
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row gap-4 items-start">
               <div className="flex-1">
                  <div className="text-sm text-slate-500 mb-4 space-y-2">
                     <p>Upload a `.csv` mapping payload for smart organizational parsing. Valid columns:</p>
                     <div className="flex flex-wrap gap-1.5 pb-2">
                         <span className="font-mono text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">locationName</span>
                         <span className="font-mono text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">departmentName</span>
                         <span className="font-mono text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">employeeName</span>
                         <span className="font-mono text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">employeeCode</span>
                         <span className="font-mono text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">email</span>
                         <span className="font-mono text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">phone</span>
                         <span className="font-mono text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">designation</span>
                         <span className="font-mono text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">employeeStatus</span>
                         <span className="font-mono text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">deviceType</span>
                         <span className="font-mono text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">model</span>
                         <span className="font-mono text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">serialNumber</span>
                         <span className="font-mono text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">assetCode</span>
                         <span className="font-mono text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">purchaseDate</span>
                         <span className="font-mono text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">warrantyExpiryDate</span>
                     </div>
                     <div className="bg-amber-50 border border-amber-200 text-amber-800 px-3 py-2 rounded-lg text-xs font-medium">
                        <span className="block mb-1"><strong>Required for Employee Creation:</strong></span>
                        <ul className="list-disc pl-4 space-y-0.5">
                           <li><code className="bg-amber-100 px-1 rounded">locationName</code> maps to the Staff's <strong>Base Location</strong>.</li>
                           <li><code className="bg-amber-100 px-1 rounded">departmentName</code> maps to the Staff's <strong>Department Assignment</strong>.</li>
                        </ul>
                     </div>
                  </div>
                  
                  <label className="cursor-pointer inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-white border border-slate-200 text-slate-700 font-medium rounded-xl hover:bg-slate-50 transition-colors shadow-sm">
                     <FileText className="w-4 h-4 text-slate-400" />
                     Select CSV File
                     <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
                  </label>
               </div>
            </div>

            {csvData.length > 0 && !importStatus && (
               <div className="mt-6 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                 <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex justify-between items-center">
                    <span className="text-sm font-semibold text-slate-700">Preview Layout (First 4 Rows) - Total: {csvData.length} records parsed</span>
                    <button 
                       onClick={handleBulkImport}
                       disabled={isImporting}
                       className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
                    >
                       {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                       {isImporting ? 'Processing Bounds...' : 'Start Integration Pipeline'}
                    </button>
                 </div>
                 <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-600">
                       <thead className="bg-slate-50/50 text-slate-400 whitespace-nowrap">
                          <tr>
                             {Object.keys(csvData[0]).slice(0,6).map(h => <th key={h} className="px-4 py-2 font-medium">{h}</th>)}
                             {Object.keys(csvData[0]).length > 6 && <th className="px-4 py-2 font-medium">...</th>}
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-100">
                          {csvData.slice(0, 4).map((row, i) => (
                             <tr key={i} className="hover:bg-slate-50/50">
                               {Object.keys(csvData[0]).slice(0,6).map(h => <td key={h} className="px-4 py-2">{row[h] || '-'}</td>)}
                               {Object.keys(csvData[0]).length > 6 && <td className="px-4 py-2 italic text-slate-400">hidden bounds</td>}
                             </tr>
                          ))}
                       </tbody>
                    </table>
                 </div>
               </div>
            )}

            {importStatus && (
               <div className={`mt-6 p-5 rounded-2xl border ${importStatus.fatal ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
                  {importStatus.fatal ? (
                     <div className="flex items-start gap-3">
                        <AlertCircle className="w-6 h-6 text-red-500 shrink-0" />
                        <div>
                           <h3 className="font-bold text-red-700 block">FATAL SYSTEM REJECTION</h3>
                           <p className="text-sm text-red-600 mt-1">{importStatus.fatal}</p>
                        </div>
                     </div>
                  ) : (
                     <div>
                        <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-4">
                           <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                           Pipeline Transaction Closed
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-4">
                           <div className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm text-center col-span-2 lg:col-span-1">
                              <span className="text-xl font-bold text-slate-700">{importStatus.totalRows}</span>
                              <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">Parsed</p>
                           </div>
                           <div className="bg-white p-3 rounded-lg border border-cyan-100 shadow-sm text-center">
                              <span className="text-xl font-bold text-cyan-600">{importStatus.createdLocations}</span>
                              <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">Locations</p>
                           </div>
                           <div className="bg-white p-3 rounded-lg border border-purple-100 shadow-sm text-center">
                              <span className="text-xl font-bold text-purple-600">{importStatus.createdDepartments}</span>
                              <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">Depts</p>
                           </div>
                           <div className="bg-white p-3 rounded-lg border border-indigo-100 shadow-sm text-center">
                              <span className="text-xl font-bold text-indigo-600">{importStatus.createdEmployees}</span>
                              <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">Staff New</p>
                           </div>
                           <div className="bg-white p-3 rounded-lg border border-blue-100 shadow-sm text-center">
                              <span className="text-xl font-bold text-blue-600">{importStatus.updatedEmployees || 0}</span>
                              <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">Staff Upd</p>
                           </div>
                           <div className="bg-white p-3 rounded-lg border border-emerald-100 shadow-sm text-center">
                              <span className="text-xl font-bold text-emerald-600">{importStatus.createdAssets}</span>
                              <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">Assets</p>
                           </div>
                           <div className="bg-white p-3 rounded-lg border border-green-100 shadow-sm text-center">
                              <span className="text-xl font-bold text-green-600">{importStatus.createdAssignments}</span>
                              <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">Bound</p>
                           </div>
                           <div className="bg-white p-3 rounded-lg border border-orange-100 shadow-sm text-center">
                              <span className="text-xl font-bold text-orange-600">{importStatus.skippedRows}</span>
                              <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">Failed</p>
                           </div>
                        </div>

                        {importStatus.errors && importStatus.errors.length > 0 && (
                           <div className="bg-white border border-orange-100 rounded-xl overflow-hidden mt-4">
                              <div className="bg-orange-50 px-3 py-2 border-b border-orange-100">
                                 <span className="text-xs font-bold text-orange-800 uppercase tracking-wide">Error Boundary Details</span>
                              </div>
                              <div className="p-3 max-h-48 overflow-y-auto space-y-1">
                                 {importStatus.errors.map((err, dx) => (
                                    <p key={dx} className="text-xs text-orange-700 font-mono flex items-start gap-2">
                                       <span className="text-orange-400 mt-0.5">•</span>
                                       {err}
                                    </p>
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
