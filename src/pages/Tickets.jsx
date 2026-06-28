import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { 
  Ticket, Plus, Search, Loader2, AlertCircle, ArrowRight,
  CheckCircle2, Clock, Wrench, XCircle, LayoutGrid, List, UserCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const _rawApi = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const API_URL = _rawApi.endsWith('/api') ? _rawApi : `${_rawApi.replace(/\/$/, '')}/api`;

export default function Tickets() {
  const { user } = useAuth();
  const { showToast } = useToast();
  
  const [tickets, setTickets] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    subject: '',
    description: '',
    priority: 'MEDIUM',
    employeeId: '',
    assetId: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      const [ticketsRes, empRes, assetsRes] = await Promise.all([
        fetch(`${API_URL}/tickets`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_URL}/employees`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_URL}/assets`, { headers: { 'Authorization': `Bearer ${token}` } })
      ]);
      
      if (!ticketsRes.ok || !empRes.ok || !assetsRes.ok) throw new Error('Failed to fetch data');
      
      const [ticketsData, empData, assetsData] = await Promise.all([
        ticketsRes.json(), empRes.json(), assetsRes.json()
      ]);
      
      setTickets(ticketsData);
      setEmployees(empData);
      setAssets(assetsData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!formData.employeeId) {
      showToast('Please select an employee', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const payload = {
        ...formData,
        assetId: formData.assetId || null
      };
      const res = await fetch(`${API_URL}/tickets`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Failed to create ticket');
      showToast('Support ticket created successfully', 'success');
      setShowForm(false);
      setFormData({ subject: '', description: '', priority: 'MEDIUM', employeeId: '', assetId: '' });
      fetchData();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusUpdate = async (id, newStatus) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/tickets/${id}/status`, {
        method: 'PATCH',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newStatus })
      });
      if (!res.ok) throw new Error('Failed to update status');
      showToast('Ticket status updated', 'success');
      fetchData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const filteredTickets = tickets.filter(t => {
    const matchSearch = t.subject.toLowerCase().includes(search.toLowerCase()) || t.ticketCode.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'ALL' || t.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const StatusIcon = ({ status }) => {
    switch(status) {
      case 'OPEN': return <AlertCircle className="w-4 h-4 text-rose-500" />;
      case 'IN_PROGRESS': return <Wrench className="w-4 h-4 text-blue-500" />;
      case 'RESOLVED': return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'CLOSED': return <XCircle className="w-4 h-4 text-slate-500" />;
      default: return <Clock className="w-4 h-4 text-slate-500" />;
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 flex-col items-center justify-center space-y-4">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
        <p className="text-slate-500 font-medium">Loading Support Matrix...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-3">
            <Ticket className="w-7 h-7 text-blue-600" /> Support Desk
          </h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">Manage employee technical support requests.</p>
        </div>
        <button 
          onClick={() => setShowForm(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-all shadow-sm shadow-blue-600/20 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> New Ticket
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search tickets by subject or code..." 
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full sm:w-auto px-4 py-2.5 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="OPEN">Open</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="RESOLVED">Resolved</option>
            <option value="CLOSED">Closed</option>
          </select>
          <div className="flex p-1 bg-slate-100 dark:bg-slate-700/50 rounded-xl hidden sm:flex">
             <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-slate-600 shadow-sm text-blue-600' : 'text-slate-400'}`}><LayoutGrid className="w-4 h-4"/></button>
             <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white dark:bg-slate-600 shadow-sm text-blue-600' : 'text-slate-400'}`}><List className="w-4 h-4"/></button>
          </div>
        </div>
      </div>

      {filteredTickets.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-12 text-center border border-slate-100 dark:border-slate-700">
           <Ticket className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
           <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200">No Tickets Found</h3>
           <p className="text-slate-500 mt-2 text-sm max-w-sm mx-auto">There are currently no support tickets matching your filters.</p>
        </div>
      ) : (
        <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' : 'space-y-4'}>
          {filteredTickets.map(ticket => (
            <div key={ticket.id} className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 hover:border-blue-500/30 group p-6 relative overflow-hidden transition-all">
               <div className="flex justify-between items-start mb-4">
                  <div>
                    <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">{ticket.ticketCode}</span>
                    <h3 className="text-sm font-bold text-slate-800 dark:text-white mt-1 group-hover:text-blue-600 transition-colors">{ticket.subject}</h3>
                  </div>
                  <div className={`px-2.5 py-1 rounded-full border text-[10px] font-bold flex items-center gap-1.5 ${
                    ticket.status === 'OPEN' ? 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-500/10 dark:border-rose-500/20' :
                    ticket.status === 'IN_PROGRESS' ? 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-500/10 dark:border-blue-500/20' :
                    ticket.status === 'RESOLVED' ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/20' :
                    'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-400'
                  }`}>
                    <StatusIcon status={ticket.status} /> {ticket.status.replace('_', ' ')}
                  </div>
               </div>
               
               <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-4 leading-relaxed">{ticket.description}</p>
               
               <div className="flex items-center gap-2 mb-4 p-2.5 bg-slate-50 dark:bg-slate-700/30 rounded-xl">
                 <UserCircle className="w-8 h-8 text-slate-400" />
                 <div>
                   <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{ticket.employee?.fullName || 'Unknown Employee'}</p>
                   <p className="text-[10px] text-slate-500 dark:text-slate-400">
                     {ticket.asset ? `Device: ${ticket.asset.model} (${ticket.asset.assetCode})` : 'No specific device linked'}
                   </p>
                 </div>
               </div>

               <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-100 dark:border-slate-700/50">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-bold text-slate-400 uppercase">Priority</span>
                    <span className={`text-xs font-bold ${
                      ticket.priority === 'CRITICAL' ? 'text-rose-500' :
                      ticket.priority === 'HIGH' ? 'text-amber-500' :
                      ticket.priority === 'MEDIUM' ? 'text-blue-500' : 'text-slate-500'
                    }`}>{ticket.priority}</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[9px] font-bold text-slate-400 uppercase">Created</span>
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{new Date(ticket.createdAt).toLocaleDateString()}</span>
                  </div>
               </div>

               {/* Admin Status Controls (Visible on hover) */}
               <div className="absolute inset-x-0 bottom-0 p-4 opacity-0 group-hover:opacity-100 bg-gradient-to-t from-white via-white to-transparent dark:from-slate-800 dark:via-slate-800 transition-opacity flex justify-end gap-2 translate-y-2 group-hover:translate-y-0">
                  {ticket.status === 'OPEN' && (
                    <button onClick={() => handleStatusUpdate(ticket.id, 'IN_PROGRESS')} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-[10px] font-bold hover:bg-blue-700 transition-colors shadow-sm">Start Work</button>
                  )}
                  {ticket.status === 'IN_PROGRESS' && (
                    <button onClick={() => handleStatusUpdate(ticket.id, 'RESOLVED')} className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-[10px] font-bold hover:bg-emerald-700 transition-colors shadow-sm">Mark Resolved</button>
                  )}
                  {(ticket.status === 'RESOLVED' || ticket.status === 'OPEN') && (
                    <button onClick={() => handleStatusUpdate(ticket.id, 'CLOSED')} className="px-3 py-1.5 bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 rounded-lg text-[10px] font-bold transition-colors">Close</button>
                  )}
               </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Ticket Modal */}
      <AnimatePresence>
        {showForm && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100 dark:border-slate-700"
            >
              <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  <Ticket className="w-5 h-5 text-blue-600" /> Open New Ticket
                </h2>
                <button onClick={() => setShowForm(false)} className="p-2 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors">
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleCreate} className="p-6 space-y-5">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Subject</label>
                  <input required type="text" value={formData.subject} onChange={e => setFormData(p => ({...p, subject: e.target.value}))} className="w-full bg-white dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="Brief summary of the issue..." />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description</label>
                  <textarea required value={formData.description} onChange={e => setFormData(p => ({...p, description: e.target.value}))} className="w-full bg-white dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 min-h-[120px] resize-none" placeholder="Provide detailed information about the problem..." />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Employee (Required)</label>
                    <select required value={formData.employeeId} onChange={e => {
                        setFormData(p => ({...p, employeeId: e.target.value, assetId: ''}));
                      }} className="w-full bg-white dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">Select an Employee...</option>
                      {employees.map(emp => (
                        <option key={emp.id} value={emp.id}>{emp.fullName} ({emp.employeeCode})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Related Asset (Optional)</label>
                    <select 
                      value={formData.assetId} 
                      onChange={e => setFormData(p => ({...p, assetId: e.target.value}))} 
                      className="w-full bg-white dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                      disabled={!formData.employeeId}
                    >
                      <option value="">{formData.employeeId ? "No specific asset..." : "Select an employee first..."}</option>
                      {assets.filter(a => a.assignedEmployeeId === formData.employeeId).map(asset => (
                        <option key={asset.id} value={asset.id}>{asset.assetCode} - {asset.model}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Priority</label>
                  <select value={formData.priority} onChange={e => setFormData(p => ({...p, priority: e.target.value}))} className="w-full bg-white dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="LOW">Low - Minimal impact</option>
                    <option value="MEDIUM">Medium - Standard issue</option>
                    <option value="HIGH">High - Urgent problem</option>
                    <option value="CRITICAL">Critical - System down</option>
                  </select>
                </div>
                <div className="pt-4 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-3">
                  <button type="button" onClick={() => setShowForm(false)} className="px-5 py-2.5 text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors">Cancel</button>
                  <button type="submit" disabled={submitting} className="px-5 py-2.5 bg-blue-600 text-white font-medium hover:bg-blue-700 rounded-xl transition-colors flex items-center gap-2 shadow-sm shadow-blue-600/20 disabled:opacity-50">
                    {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                    Submit Ticket
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
