import { useState, useEffect } from 'react';
import { Search, Filter, Download, Eye, Edit, Trash2, Loader2, AlertCircle, FileText, CheckSquare, XSquare } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import { exportToCSV, exportToPDF } from '../utils/exportUtils';
import { AnimatePresence, motion } from 'framer-motion';

const _rawApi = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const API_URL = _rawApi.endsWith('/api') ? _rawApi : `${_rawApi.replace(/\/$/, '')}/api`;

export default function Assets() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { confirm } = useConfirm();

  const [assets, setAssets] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [locations, setLocations] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filtering States
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [employeeFilter, setEmployeeFilter] = useState('');

  // Bulk Selection
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);

  const canCreateEdit = user?.role === 'ADMIN' || user?.role === 'IT_OFFICER';
  const canDelete = user?.role === 'ADMIN';

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error("Authentication required");
      const headers = { 'Authorization': `Bearer ${token}` };

      const [astRes, empRes, deptRes, locRes] = await Promise.all([
        fetch(`${API_URL}/assets`, { headers }),
        fetch(`${API_URL}/employees`, { headers }),
        fetch(`${API_URL}/departments`, { headers }),
        fetch(`${API_URL}/locations`, { headers })
      ]);

      if (!astRes.ok || !empRes.ok || !deptRes.ok || !locRes.ok) throw new Error("Failed to fetch relational collections");

      const [astData, empData, deptData, locData] = await Promise.all([
        astRes.json(), empRes.json(), deptRes.json(), locRes.json()
      ]);

      setAssets(astData);
      setEmployees(empData);
      setDepartments(deptData);
      setLocations(locData);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Initialize filters from URL
  useEffect(() => {
    const locId = searchParams.get('locationId');
    const deptId = searchParams.get('departmentId');
    const status = searchParams.get('status');
    const empId = searchParams.get('employeeId');

    if (locId) setLocationFilter(locId);
    if (deptId) setDepartmentFilter(deptId);
    if (status) setStatusFilter(status);
    if (empId) setEmployeeFilter(empId);
  }, [searchParams]);

  const handleDelete = async (id) => {
    const confirmed = await confirm({
      title: 'Delete Asset',
      message: 'Are you absolutely sure you want to delete this asset?',
      confirmText: 'Delete Asset'
    });
    if (!confirmed) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/assets/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Deletion failed');
      setAssets(assets.filter(asset => asset.id !== id));
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      showToast('Asset successfully deleted from inventory matrix.', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleBulkDelete = async () => {
    const confirmed = await confirm({
      title: 'Bulk Delete',
      message: `Are you sure you want to delete ${selectedIds.size} assets? This action is irreversible.`,
      confirmText: 'Delete All'
    });
    if (!confirmed) return;
    
    // In a real implementation we would call a bulk DELETE API
    // For now we simulate sequential deletion
    try {
      const token = localStorage.getItem('token');
      let successCount = 0;
      
      for (const id of selectedIds) {
        const res = await fetch(`${API_URL}/assets/${id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) successCount++;
      }
      
      setAssets(assets.filter(asset => !selectedIds.has(asset.id)));
      setSelectedIds(new Set());
      showToast(`Successfully deleted ${successCount} assets.`, 'success');
    } catch (err) {
      showToast('Failed to delete some assets.', 'error');
    }
  };

  // Advanced Filtering Engine
  const filteredAssets = assets.filter(asset => {
    const q = searchTerm.toLowerCase();
    const textMatch =
      (asset.assetCode?.toLowerCase().includes(q)) ||
      (asset.serialNumber?.toLowerCase().includes(q)) ||
      (asset.deviceType?.toLowerCase().includes(q));

    const statusMatch = statusFilter ? asset.status === statusFilter : true;
    const locationMatch = locationFilter ? asset.locationId === locationFilter : true;
    const departmentMatch = departmentFilter ? asset.departmentId === departmentFilter : true;
    const employeeMatch = employeeFilter ? asset.assignedEmployeeId === employeeFilter : true;

    return textMatch && statusMatch && locationMatch && departmentMatch && employeeMatch;
  });

  const toggleSelection = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === filteredAssets.length && filteredAssets.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredAssets.map(a => a.id)));
    }
  };

  const prepareExportData = () => {
    return filteredAssets.map(a => ({
      'Asset Code': a.assetCode,
      'Type': a.deviceType,
      'Model': a.model,
      'Serial Number': a.serialNumber,
      'Status': a.status,
      'IP Address': a.ipAddress || 'DHCP/None',
      'MAC Address': a.macAddress || 'N/A',
      'Purchase Date': new Date(a.purchaseDate).toLocaleDateString(),
      'Location': locations.find(l => l.id === a.locationId)?.name || 'Unmapped',
      'Department': departments.find(d => d.id === a.departmentId)?.name || 'Not Scoped',
      'Assigned Employee': employees.find(e => e.id === a.assignedEmployeeId)?.fullName || 'None'
    }));
  };

  const handleExportCSV = () => {
    setExportDropdownOpen(false);
    exportToCSV(prepareExportData(), 'Assets_Inventory');
  };

  const handleExportPDF = () => {
    setExportDropdownOpen(false);
    exportToPDF(prepareExportData(), 'Assets_Inventory');
  };

  if (loading) {
    return (
      <div className="flex h-64 flex-col items-center justify-center space-y-4">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
        <p className="text-slate-500 font-medium">Synchronizing Asset Pipeline...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col h-[50vh] items-center justify-center p-8 bg-red-50 border border-red-100 rounded-3xl">
        <AlertCircle className="h-14 w-14 text-red-500 mb-4" />
        <h2 className="text-xl font-bold text-red-600">Sync Failure</h2>
        <p className="text-red-500 text-center mt-2 max-w-md">{error}</p>
        <button onClick={fetchData} className="mt-6 px-6 py-2 bg-red-600 text-white rounded-xl shadow-sm hover:bg-red-700 transition">Retry Request</button>
      </div>
    );
  }

  return (
    <div className="space-y-6 relative pb-24">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Assets Management</h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">View, track, and manage all cross-departmental IT assets.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <button 
              onClick={() => setExportDropdownOpen(!exportDropdownOpen)}
              className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 px-4 py-2 rounded-xl text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
            {exportDropdownOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 z-20 py-2">
                <button onClick={handleExportCSV} className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-green-600" /> Export as CSV
                </button>
                <button onClick={handleExportPDF} className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-red-600" /> Export as PDF
                </button>
              </div>
            )}
          </div>
          {canCreateEdit && (
            <Link to="/assets/add" className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm shadow-blue-600/20">
              Add Asset
            </Link>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800/50 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700/50 overflow-hidden">
        {/* Dynamic Filters */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-700/50 space-y-4">
          <div className="relative w-full">
            <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search explicitly by Code, type, or valid serial..."
              className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-sm rounded-xl focus:ring-2 focus:ring-blue-500 block pl-10 p-2.5 outline-none transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-sm rounded-xl outline-none p-2 focus:ring-2 focus:ring-blue-500">
              <option value="">All Statuses</option>
              <option value="AVAILABLE">Available</option>
              <option value="ASSIGNED">Assigned</option>
              <option value="UNDER_REPAIR">Under Repair</option>
              <option value="RETIRED">Retired</option>
            </select>
            <select value={locationFilter} onChange={e => setLocationFilter(e.target.value)} className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-sm rounded-xl outline-none p-2 focus:ring-2 focus:ring-blue-500">
              <option value="">All Locations</option>
              {locations.map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
            </select>
            <select value={departmentFilter} onChange={e => setDepartmentFilter(e.target.value)} className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-sm rounded-xl outline-none p-2 focus:ring-2 focus:ring-blue-500">
              <option value="">All Departments</option>
              {departments.map(dept => <option key={dept.id} value={dept.id}>{dept.name}</option>)}
            </select>
            <select value={employeeFilter} onChange={e => setEmployeeFilter(e.target.value)} className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-sm rounded-xl outline-none p-2 focus:ring-2 focus:ring-blue-500">
              <option value="">All Employees</option>
              {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.fullName}</option>)}
            </select>
          </div>
        </div>

        {/* Table */}
        <div id="assets-table" className="overflow-x-auto min-h-[400px]">
          <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400">
            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-300 font-medium">
              <tr>
                <th className="px-5 py-4 w-12">
                  <input 
                    type="checkbox" 
                    checked={filteredAssets.length > 0 && selectedIds.size === filteredAssets.length}
                    onChange={toggleAll}
                    className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500"
                  />
                </th>
                <th className="px-5 py-4">Asset Matrix</th>
                <th className="px-5 py-4">User</th>
                <th className="px-5 py-4">Placement</th>
                <th className="px-5 py-4">Device Status</th>
                <th className="px-5 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {filteredAssets.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-5 py-10 text-center text-slate-500 dark:text-slate-400">No assets detected matching filter state.</td>
                </tr>
              ) : filteredAssets.map((asset) => {
                const locName = locations.find(l => l.id === asset.locationId)?.name || 'Unmapped';
                const deptName = departments.find(d => d.id === asset.departmentId)?.name || 'Not Scoped';
                const empName = employees.find(e => e.id === asset.assignedEmployeeId)?.fullName || 'System Stock';
                const isSelected = selectedIds.has(asset.id);

                return (
                  <tr key={asset.id} className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors group ${isSelected ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}>
                    <td className="px-5 py-4 w-12">
                      <input 
                        type="checkbox" 
                        checked={isSelected}
                        onChange={() => toggleSelection(asset.id)}
                        className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-col">
                        <Link to={`/assets/${encodeURIComponent(asset.assetCode)}`} className="font-bold text-blue-600 hover:underline">{asset.assetCode}</Link>
                        <span className="text-sm font-medium text-slate-800 dark:text-slate-200 mt-1">{asset.model || asset.deviceType}</span>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">S/N: {asset.serialNumber}</span>
                          {asset.ipAddress && (
                            <span className="text-[10px] font-mono text-purple-600 bg-purple-50 dark:bg-purple-900/30 px-1.5 py-0.5 rounded">IP: {asset.ipAddress}</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 font-medium text-slate-700 dark:text-slate-300">{empName}</td>
                    <td className="px-5 py-4">
                      <p className="text-slate-800 dark:text-slate-200">{locName}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{deptName}</p>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] uppercase font-bold tracking-wider ${asset.status === 'AVAILABLE' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                          asset.status === 'ASSIGNED' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                            asset.status === 'UNDER_REPAIR' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                              'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        }`}>
                        {asset.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                        <Link to={`/assets/${asset.assetCode}`} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-700 rounded-lg transition-colors">
                          <Eye className="w-4 h-4" />
                        </Link>
                        {canCreateEdit && (
                          <button onClick={() => navigate(`/assets/edit/${asset.id}`)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-700 rounded-lg transition-colors">
                            <Edit className="w-4 h-4" />
                          </button>
                        )}
                        {canDelete && (
                          <button onClick={() => handleDelete(asset.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-slate-700 rounded-lg transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Floating Bulk Action Bar */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-6 z-50 border border-slate-800"
          >
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-xs font-bold">{selectedIds.size}</span>
              <span className="font-semibold text-sm">Assets Selected</span>
            </div>
            
            <div className="h-6 w-px bg-slate-700"></div>
            
            <div className="flex items-center gap-3">
              <button 
                className="text-sm font-medium hover:text-red-400 transition-colors flex items-center gap-1.5"
                onClick={handleBulkDelete}
              >
                <Trash2 className="w-4 h-4" /> Delete All
              </button>
              <button 
                className="text-sm font-medium hover:text-slate-300 transition-colors flex items-center gap-1.5"
                onClick={() => setSelectedIds(new Set())}
              >
                <XSquare className="w-4 h-4" /> Clear
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
