import { useState, useEffect } from 'react';
import { Wrench, Plus, CheckCircle2, Search, Loader2, AlertCircle, Edit, Trash2, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';

const _rawApi = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const API_URL = _rawApi.endsWith('/api') ? _rawApi : `${_rawApi.replace(/\/$/, '')}/api`;

export default function Maintenance() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  
  const [logs, setLogs] = useState([]);
  const [assets, setAssets] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [searchTerm, setSearchTerm] = useState('');
  
  // UI Display Control
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLog, setEditingLog] = useState(null);

  // Form Binding Data
  const [formData, setFormData] = useState({
    assetId: '',
    issueDescription: '',
    repairAction: '',
    vendor: '',
    repairCost: '',
    repairDate: new Date().toISOString().split('T')[0],
    status: 'OPEN',
    remarks: ''
  });

  const canCreateEdit = user?.role === 'ADMIN' || user?.role === 'IT_OFFICER';
  const canDelete = user?.role === 'ADMIN';

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      if(!token) throw new Error("Authentication missing");
      const headers = { 'Authorization': `Bearer ${token}` };

      const [astRes, mnRes] = await Promise.all([
        fetch(`${API_URL}/assets`, { headers }),
        fetch(`${API_URL}/maintenance`, { headers })
      ]);

      if (!astRes.ok || !mnRes.ok) throw new Error("Failed connecting to diagnostic pipelines.");

      const [astData, mnData] = await Promise.all([
        astRes.json(), mnRes.json()
      ]);

      setAssets(astData);
      setLogs(mnData);
      setError('');
    } catch(err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openForm = (log = null) => {
    if (log) {
      setEditingLog(log);
      setFormData({
        assetId: log.assetId || '',
        issueDescription: log.issueDescription || '',
        repairAction: log.repairAction || '',
        vendor: log.vendor || '',
        repairCost: log.repairCost ? log.repairCost.toString() : '',
        repairDate: log.repairDate ? log.repairDate.split('T')[0] : '',
        status: log.status || 'OPEN',
        remarks: log.remarks || ''
      });
    } else {
      setEditingLog(null);
      setFormData({
        assetId: '',
        issueDescription: '',
        repairAction: '',
        vendor: '',
        repairCost: '',
        repairDate: new Date().toISOString().split('T')[0],
        status: 'OPEN',
        remarks: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const payload = { ...formData };
      
      if(payload.repairCost) payload.repairCost = parseFloat(payload.repairCost);
      if(payload.repairDate) payload.repairDate = new Date(payload.repairDate).toISOString();

      const url = editingLog ? `${API_URL}/maintenance/${editingLog.id}` : `${API_URL}/maintenance`;
      const method = editingLog ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
         const errData = await res.json();
         throw new Error(errData.error || 'Server rejected diagnostic payload');
      }

      setIsModalOpen(false);
      showToast('Maintenance log saved successfully.', 'success');
      await fetchData(); // Force global reload reflecting underlying Asset constraints
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleDelete = async (id) => {
    const confirmed = await confirm({
      title: 'Delete Repair Log',
      message: 'Are you verifying the deletion of this historical repair log? This action cannot be undone.',
      confirmText: 'Delete Log'
    });
    if (!confirmed) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/maintenance/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Deletion failed targeting records map.');
      showToast('Log deleted successfully.', 'success');
      await fetchData();
    } catch(err) {
      showToast(err.message, 'error');
    }
  };

  const filteredLogs = logs.filter(log => {
      const q = searchTerm.toLowerCase();
      const codeMatches = log.asset?.assetCode?.toLowerCase().includes(q) || false;
      const vendorMatches = log.vendor?.toLowerCase().includes(q) || false;
      const statusMatches = log.status?.toLowerCase().includes(q) || false;
      return codeMatches || vendorMatches || statusMatches;
  }).sort((a,b) => new Date(b.repairDate) - new Date(a.repairDate));

  if (loading) {
    return (
      <div className="flex h-64 flex-col items-center justify-center space-y-4">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
        <p className="text-slate-500 font-medium">Downloading Network Diagnostics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col h-[50vh] items-center justify-center p-8 bg-red-50 border border-red-100 rounded-3xl">
        <AlertCircle className="h-14 w-14 text-red-500 mb-4" />
        <h2 className="text-xl font-bold text-red-600">Connection Error</h2>
        <p className="text-red-500 text-center mt-2 max-w-md">{error}</p>
        <button onClick={fetchData} className="mt-6 px-6 py-2 bg-red-600 text-white rounded-xl shadow-sm hover:bg-red-700 transition">
          Retry Logic
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">Maintenance & Diagnostics</h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">Audit tracking arrays covering physical repairs and cost analytics.</p>
        </div>
        {canCreateEdit && (
          <button onClick={() => openForm()} className="flex items-center gap-2 w-full sm:w-auto justify-center bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm shadow-blue-600/20">
            <Plus className="w-4 h-4" />
            File Diagnostic Log
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex justify-between items-center">
          <div className="relative w-full sm:w-96">
            <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Regex match by Asset, Vendor, or Status..."
              className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-xl focus:ring-2 focus:ring-blue-500 block pl-10 p-2.5 outline-none transition-all"
            />
          </div>
        </div>

        <div className="overflow-x-auto min-h-[400px]">
           {filteredLogs.length === 0 ? (
              <div className="p-10 text-center text-slate-500 mt-10">No diagnostic logs found matching current trace.</div>
           ) : (
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-slate-500 font-medium whitespace-nowrap border-b border-slate-100">
                  <tr>
                    <th className="px-5 py-4">Hardware Binding</th>
                    <th className="px-5 py-4">Diagnostic Assessment</th>
                    <th className="px-5 py-4">Vendor & Billing</th>
                    <th className="px-5 py-4">State Log</th>
                    <th className="px-5 py-4 text-center">Status Flag</th>
                    {canCreateEdit && <th className="px-5 py-4 text-right">Overrides</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredLogs.map((log) => {
                    const ticketDt = new Date(log.repairDate).toLocaleDateString();
                    return (
                      <tr key={log.id} className="hover:bg-slate-50/60 transition-colors group">
                        
                        <td className="px-5 py-4">
                           <div className="flex flex-col">
                              <span className="font-bold text-blue-600">{log.asset?.assetCode || 'DELETED'}</span>
                              <span className="text-xs text-slate-500 mt-0.5">{log.asset?.model || 'Link Corrupted'}</span>
                           </div>
                        </td>
                        
                        <td className="px-5 py-4 max-w-sm">
                           <p className="font-medium text-slate-800 dark:text-white line-clamp-1">{log.issueDescription}</p>
                           <p className="text-xs text-slate-500 mt-0.5 max-w-xs truncate">{log.repairAction || 'Pending...'}</p>
                        </td>

                        <td className="px-5 py-4">
                           <p className="text-slate-800 dark:text-white">{log.vendor || 'Internal Fix'}</p>
                           <p className="text-xs text-slate-500 mt-0.5">CHF {(log.repairCost || 0).toFixed(2)}</p>
                        </td>
                        
                        <td className="px-5 py-4 whitespace-nowrap">
                           {ticketDt}
                        </td>
                        
                        <td className="px-5 py-4 text-center">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] uppercase font-bold tracking-wider ${
                            log.status === 'RESOLVED' ? 'bg-green-100 text-green-700 shadow-sm border border-green-200' :
                            log.status === 'IN_PROGRESS' ? 'bg-orange-100 text-orange-700 border border-orange-200' :
                            'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}>
                            {log.status === 'RESOLVED' && <CheckCircle2 className="w-3 h-3 inline mr-1" />}
                            {log.status}
                          </span>
                        </td>
                        
                        {canCreateEdit && (
                          <td className="px-5 py-4 text-right whitespace-nowrap">
                             <div className="flex items-center justify-end gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => openForm(log)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                                   <Edit className="w-4 h-4" />
                                </button>
                                {canDelete && (
                                   <button onClick={() => handleDelete(log.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors ml-1">
                                      <Trash2 className="w-4 h-4" />
                                   </button>
                                )}
                             </div>
                          </td>
                        )}

                      </tr>
                    );
                  })}
                </tbody>
              </table>
           )}
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl ring-1 ring-slate-900/5">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 sticky top-0 bg-white z-10">
              <div className="flex items-center gap-3">
                 <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center border border-blue-100">
                    <Wrench className="w-5 h-5 text-blue-600" />
                 </div>
                 <div>
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white">{editingLog ? 'Modify Diagnostic Log' : 'File Maintenance Report'}</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Track repair pipelines globally across IT.</p>
                 </div>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 hover:bg-slate-50 p-2 rounded-xl transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleFormSubmit} className="p-6 space-y-6">
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Target Hardware Platform *</label>
                <select 
                  required value={formData.assetId} onChange={e => setFormData({...formData, assetId: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 p-2.5 outline-none transition-all"
                >
                  <option value="" disabled>Select Asset Matrix...</option>
                  {assets.map(ast => (
                    <option key={ast.id} value={ast.id}>{ast.assetCode} - {ast.model} ({ast.status})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                 <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Status Override *</label>
                    <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500">
                       <option value="OPEN">Open (Awaiting triage)</option>
                       <option value="IN_PROGRESS">In Progress (Vendor transit)</option>
                       <option value="RESOLVED">Resolved (Ticket closed)</option>
                    </select>
                 </div>
                 <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Execution Date</label>
                    <input type="date" value={formData.repairDate} onChange={e => setFormData({...formData, repairDate: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 text-slate-700" />
                 </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Diagnostic Issue Array *</label>
                <textarea required value={formData.issueDescription} onChange={e => setFormData({...formData, issueDescription: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400" rows="3" placeholder="Exact symptom behavior..."></textarea>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Repair Action Protocol</label>
                <textarea value={formData.repairAction} onChange={e => setFormData({...formData, repairAction: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400" rows="2" placeholder="Tasks undertaken..."></textarea>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                 <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Third-Party Vendor Entity</label>
                    <input type="text" value={formData.vendor} onChange={e => setFormData({...formData, vendor: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. Lenovo Auth Service" />
                 </div>
                 <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Billing Analytics (Cost)</label>
                    <input type="number" step="0.01" value={formData.repairCost} onChange={e => setFormData({...formData, repairCost: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500" placeholder="0.00" />
                 </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-100">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 text-slate-600 bg-white border border-slate-200 rounded-xl font-medium hover:bg-slate-50 transition-colors">
                  Cancel Matrix
                </button>
                <button type="submit" className="px-5 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors shadow-sm shadow-blue-600/20">
                  {editingLog ? 'Update Registry' : 'Save Diagnostic Route'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
