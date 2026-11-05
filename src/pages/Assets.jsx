import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, Filter, Download, Eye, Edit, Trash2, Loader2, AlertCircle, FileText, 
  CheckSquare, XSquare, Image as ImageIcon, ArrowLeft, History, Laptop, Monitor, 
  Printer, Smartphone, Wifi, Server, ChevronDown, ChevronUp, Clock, Calendar, 
  Building, MapPin, User, ExternalLink, Layers, CheckCircle2, ArrowRight
} from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import { exportToCSV, exportToPDF } from '../utils/exportUtils';
import CopyButton from '../components/CopyButton';
import AssetUsageHistoryModal from '../components/AssetUsageHistoryModal';
import { safeSetItem, safeGetItem, purgeBulkyCaches } from '../utils/storage';
import { AnimatePresence, motion } from 'framer-motion';

const _rawApi = import.meta.env.VITE_API_URL || '/api';
const API_URL = _rawApi.endsWith('/api') ? _rawApi : `${_rawApi.replace(/\/$/, '')}/api`;

export const DEVICE_CATEGORIES = [
  { key: 'ALL', label: 'All Available', icon: Layers },
  { key: 'LAPTOP', label: 'Laptops', icon: Laptop },
  { key: 'DESKTOP', label: 'Desktops', icon: Server },
  { key: 'MONITOR', label: 'Monitors', icon: Monitor },
  { key: 'PRINTER', label: 'Printers', icon: Printer },
  { key: 'MOBILE_MIFI', label: 'Mobile / MiFi', icon: Smartphone },
  { key: 'NETWORK_OTHER', label: 'Network / Other', icon: Wifi }
];

export function getDeviceCategoryKey(deviceType = '') {
  const dt = (deviceType || '').toLowerCase().trim();
  if (dt.includes('laptop') || dt.includes('notebook') || dt.includes('macbook')) return 'LAPTOP';
  if (dt.includes('desktop') || dt.includes('workstation') || dt.includes('all-in-one') || dt.includes('pc')) return 'DESKTOP';
  if (dt.includes('monitor') || dt.includes('screen') || dt.includes('display')) return 'MONITOR';
  if (dt.includes('printer') || dt.includes('scanner') || dt.includes('photocopier')) return 'PRINTER';
  if (dt.includes('mifi') || dt.includes('mobile') || dt.includes('phone') || dt.includes('tablet') || dt.includes('cellular')) return 'MOBILE_MIFI';
  return 'NETWORK_OTHER';
}

export function getAssetUsageHistory(asset, employees = []) {
  if (!asset) return { hasHistory: false, previousAssignment: null, allAssignments: [], totalAssignments: 0 };
  const allAssignments = Array.isArray(asset?.assignments) ? [...asset.assignments] : [];
  
  const employeeAssignments = allAssignments
    .map(a => {
      if (!a) return null;
      let emp = a.employee || null;
      if (!emp && a.employeeId && Array.isArray(employees)) {
        emp = employees.find(e => e.id === a.employeeId) || null;
      }
      if (!emp && (a.employeeName || a.assignedTo)) {
        emp = { fullName: a.employeeName || a.assignedTo, employeeCode: a.employeeCode || '' };
      }
      return {
        ...a,
        employee: emp
      };
    })
    .filter(a => a && a.employee && a.employee.fullName);

  employeeAssignments.sort((a, b) => {
    const dateA = new Date(a.returnedDate || a.assignedDate || 0).getTime();
    const dateB = new Date(b.returnedDate || b.assignedDate || 0).getTime();
    return dateB - dateA;
  });

  const hasHistory = employeeAssignments.length > 0;
  const previousAssignment = hasHistory ? employeeAssignments[0] : null;
  return {
    hasHistory,
    previousAssignment,
    allAssignments: employeeAssignments,
    totalAssignments: employeeAssignments.length
  };
}

function AssetRowThumb({ asset }) {
  const [failed, setFailed] = useState(false);
  const src = asset.thumbnailUrl || (asset.imageUrl ? `/api/uploads/image/${asset.id}/thumb` : null);

  if (!src || failed) {
    return (
      <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800/80 flex items-center justify-center shrink-0 text-blue-600 dark:text-blue-400" title="Asset Photo Attached">
        <ImageIcon className="w-4 h-4" />
      </div>
    );
  }

  return (
    <div className="w-9 h-9 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shrink-0 bg-slate-100 dark:bg-slate-800">
      <img
        src={src}
        alt={asset.assetCode}
        loading="lazy"
        onError={() => setFailed(true)}
        className="w-full h-full object-cover"
      />
    </div>
  );
}

export default function Assets() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { confirm } = useConfirm();

  // Purge any bloated legacy cache on initial load to prevent quota exhaustion
  try {
    purgeBulkyCaches();
  } catch (_) {}

  const [assets, setAssets] = useState([]);
  const [employees, setEmployees] = useState(() => safeGetItem('employeesCache', []));
  const [departments, setDepartments] = useState(() => safeGetItem('departmentsCache', []));
  const [locations, setLocations] = useState(() => safeGetItem('locationsCache', []));

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Pagination States
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Filtering States
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [locationFilter, setLocationFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [employeeFilter, setEmployeeFilter] = useState('');
  const [assignmentTypeFilter, setAssignmentTypeFilter] = useState('');

  // Expandable Rows and Usage Modal
  const [expandedRowIds, setExpandedRowIds] = useState(new Set());
  const [selectedHistoryAsset, setSelectedHistoryAsset] = useState(null);

  // Bulk Selection
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);

  const canCreateEdit = user?.role === 'ADMIN' || user?.role === 'IT_OFFICER';
  const canDelete = user?.role === 'ADMIN';

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        window.dispatchEvent(new CustomEvent('auth:expired'));
        return;
      }
      const headers = { 'Authorization': `Bearer ${token}` };

      const [astRes, empRes, deptRes, locRes, asgRes] = await Promise.all([
        fetch(`${API_URL}/assets`, { headers }),
        fetch(`${API_URL}/employees`, { headers }).catch(() => ({ ok: false })),
        fetch(`${API_URL}/departments`, { headers }).catch(() => ({ ok: false })),
        fetch(`${API_URL}/locations`, { headers }).catch(() => ({ ok: false })),
        fetch(`${API_URL}/assignments`, { headers }).catch(() => ({ ok: false }))
      ]);

      // Check if session has expired
      if ([astRes, empRes, deptRes, locRes, asgRes].some(r => r && (r.status === 401 || r.status === 403))) {
        window.dispatchEvent(new CustomEvent('auth:expired'));
        return;
      }

      if (!astRes.ok) {
        throw new Error("Failed to fetch assets repository");
      }

      const astData = await astRes.json();
      const empData = empRes && empRes.ok ? await empRes.json().catch(() => employees) : employees;
      const deptData = deptRes && deptRes.ok ? await deptRes.json().catch(() => departments) : departments;
      const locData = locRes && locRes.ok ? await locRes.json().catch(() => locations) : locations;
      const asgData = asgRes && asgRes.ok ? await asgRes.json().catch(() => []) : [];

      // Index assignments by assetId and assetCode for resilient mapping
      const assignmentsByAssetId = {};
      const assignmentsByAssetCode = {};

      if (Array.isArray(asgData)) {
        asgData.forEach(asg => {
          if (!asg) return;
          // Hydrate employee reference if missing
          if (!asg.employee && asg.employeeId && Array.isArray(empData)) {
            asg.employee = empData.find(e => e.id === asg.employeeId) || null;
          }

          const aId = asg.assetId || asg.asset?.id;
          const aCode = asg.asset?.assetCode;

          if (aId) {
            if (!assignmentsByAssetId[aId]) assignmentsByAssetId[aId] = [];
            assignmentsByAssetId[aId].push(asg);
          }
          if (aCode) {
            if (!assignmentsByAssetCode[aCode]) assignmentsByAssetCode[aCode] = [];
            assignmentsByAssetCode[aCode].push(asg);
          }
        });
      }

      const mergedAssets = astData.map(a => {
        const existing = Array.isArray(a.assignments) && a.assignments.length > 0 ? a.assignments : [];
        const fromId = assignmentsByAssetId[a.id] || [];
        const fromCode = a.assetCode ? (assignmentsByAssetCode[a.assetCode] || []) : [];

        // Deduplicate assignments by ID or composite key
        const map = new Map();
        [...existing, ...fromId, ...fromCode].forEach(item => {
          if (item) {
            const key = item.id || `${item.employeeId}_${item.assignedDate}`;
            map.set(key, item);
          }
        });

        return {
          ...a,
          assignments: Array.from(map.values())
        };
      });

      setAssets(mergedAssets);
      setEmployees(empData);
      setDepartments(deptData);
      setLocations(locData);
      setError('');

      // Safe, isolated cache writes for lightweight lookups only (never write mergedAssets to localStorage)
      safeSetItem('employeesCache', empData);
      safeSetItem('departmentsCache', deptData);
      safeSetItem('locationsCache', locData);
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
    const cat = searchParams.get('category');

    if (locId) setLocationFilter(locId);
    if (deptId) setDepartmentFilter(deptId);
    if (status) setStatusFilter(status);
    if (empId) setEmployeeFilter(empId);
    if (cat) setCategoryFilter(cat.toUpperCase());
    const aType = searchParams.get('assignmentType') || searchParams.get('type');
    if (aType) setAssignmentTypeFilter(aType);
    const qParam = searchParams.get('search') || searchParams.get('q');
    if (qParam) setSearchTerm(qParam);
  }, [searchParams]);

  const handleDelete = async (id) => {
    if (user?.role !== 'ADMIN') {
      showToast('Action Restricted: Please ask Super Admin to delete this entry.', 'error');
      return;
    }
    const input = await confirm({
      type: 'prompt',
      title: 'Delete Asset',
      message: 'Are you absolutely sure you want to delete this asset? This action is irreversible. Type "DELETE" to confirm.',
      inputPlaceholder: 'DELETE',
      confirmText: 'Delete Asset'
    });
    if (input !== 'DELETE') {
      if (input !== null) showToast('Deletion cancelled. You must type "DELETE".', 'info');
      return;
    }
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
    if (user?.role !== 'ADMIN') {
      showToast('Action Restricted: Please ask Super Admin to delete these entries.', 'error');
      return;
    }
    const input = await confirm({
      type: 'prompt',
      title: 'Bulk Delete',
      message: `Are you sure you want to delete ${selectedIds.size} assets? This action is irreversible. Type "DELETE" to confirm.`,
      inputPlaceholder: 'DELETE',
      confirmText: 'Delete All'
    });
    if (input !== 'DELETE') {
      if (input !== null) showToast('Deletion cancelled. You must type "DELETE".', 'info');
      return;
    }
    
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

  // Live Category Counts for Available Assets
  const availableAssetsList = useMemo(() => {
    return assets.filter(a => a.status === 'AVAILABLE');
  }, [assets]);

  const categoryCounts = useMemo(() => {
    const counts = { ALL: availableAssetsList.length };
    DEVICE_CATEGORIES.forEach(cat => {
      if (cat.key !== 'ALL') {
        counts[cat.key] = availableAssetsList.filter(a => getDeviceCategoryKey(a.deviceType) === cat.key).length;
      }
    });
    return counts;
  }, [availableAssetsList]);

  // Advanced Filtering Engine
  const filteredAssets = assets.filter(asset => {
    const q = searchTerm.toLowerCase();
    const textMatch =
      (asset.assetCode?.toLowerCase().includes(q)) ||
      (asset.serialNumber?.toLowerCase().includes(q)) ||
      (asset.deviceType?.toLowerCase().includes(q)) ||
      (asset.model?.toLowerCase().includes(q)) ||
      (asset.brand?.toLowerCase().includes(q));

    const statusMatch = statusFilter ? asset.status === statusFilter : true;
    const categoryMatch = (!categoryFilter || categoryFilter === 'ALL') 
      ? true 
      : getDeviceCategoryKey(asset.deviceType) === categoryFilter;
    const locationMatch = locationFilter ? asset.locationId === locationFilter : true;
    const departmentMatch = departmentFilter ? asset.departmentId === departmentFilter : true;
    const employeeMatch = employeeFilter ? asset.assignedEmployeeId === employeeFilter : true;
    const assignmentTypeMatch = assignmentTypeFilter ? asset.assignmentType === assignmentTypeFilter : true;

    return textMatch && statusMatch && categoryMatch && locationMatch && departmentMatch && employeeMatch && assignmentTypeMatch;
  });

  // Pagination calculation
  const totalPages = pageSize === 0 ? 1 : Math.ceil(filteredAssets.length / pageSize) || 1;
  const paginatedAssets = useMemo(() => {
    if (pageSize === 0) return filteredAssets;
    const start = (currentPage - 1) * pageSize;
    return filteredAssets.slice(start, start + pageSize);
  }, [filteredAssets, currentPage, pageSize]);

  // Reset to page 1 whenever filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, categoryFilter, locationFilter, departmentFilter, employeeFilter, assignmentTypeFilter]);

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

  const toggleRowExpand = (id) => {
    setExpandedRowIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const prepareExportData = () => {
    return filteredAssets.map(a => {
      const { previousAssignment } = getAssetUsageHistory(a, employees);
      const prevUserText = a.status === 'AVAILABLE' 
        ? (previousAssignment?.employee ? `${previousAssignment.employee.fullName} (${previousAssignment.employee.employeeCode || 'EMP'})` : 'No Previous Assignment')
        : (employees.find(e => e.id === a.assignedEmployeeId)?.fullName || 'None');

      return {
        'Asset Code': a.assetCode,
        'Device Category': getDeviceCategoryKey(a.deviceType),
        'Type': a.deviceType,
        'Model': a.model || 'N/A',
        'Serial Number': a.serialNumber || 'N/A',
        'Status': a.status,
        'Current / Previous User': prevUserText,
        'Previous Return Date': previousAssignment?.returnedDate ? new Date(previousAssignment.returnedDate).toLocaleDateString() : 'N/A',
        'Return Remarks / Condition': previousAssignment?.remarks || a.condition || 'N/A',
        'IP Address': a.ipAddress || 'DHCP/None',
        'MAC Address': a.macAddress || 'N/A',
        'Purchase Date': a.purchaseDate ? new Date(a.purchaseDate).toLocaleDateString() : 'N/A',
        'Location': locations.find(l => l.id === a.locationId)?.name || 'Unmapped',
        'Department': departments.find(d => d.id === a.departmentId)?.name || 'Not Scoped'
      };
    });
  };

  const handleExportCSV = () => {
    setExportDropdownOpen(false);
    exportToCSV(prepareExportData(), 'Assets_Inventory');
  };

  const handleExportPDF = () => {
    setExportDropdownOpen(false);
    exportToPDF(prepareExportData(), 'Assets_Inventory');
  };

  const handleExportExcel = async () => {
    setExportDropdownOpen(false);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/assets/export/excel`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to export official Excel inventory');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'EuroMotors_IT_Inventory_Export.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      showToast(err.message, 'error');
    }
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
      <div className="flex flex-col h-[50vh] items-center justify-center p-8 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-3xl text-center">
        <AlertCircle className="h-14 w-14 text-red-500 dark:text-red-400 mb-4" />
        <h2 className="text-xl font-bold text-red-600 dark:text-red-400">Sync Failure</h2>
        <p className="text-red-600/90 dark:text-red-300 text-center mt-2 max-w-md text-sm">{error}</p>
        <div className="flex items-center gap-3 mt-6">
          <button 
            onClick={fetchData} 
            className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-sm text-sm font-semibold transition cursor-pointer"
          >
            Retry Request
          </button>
          <button 
            onClick={() => {
              localStorage.removeItem('token');
              localStorage.removeItem('authUser');
              window.location.href = '/login';
            }} 
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-sm font-semibold transition cursor-pointer"
          >
            Sign In Again
          </button>
        </div>
      </div>
    );
  }

  const isAvailableView = statusFilter === 'AVAILABLE';

  return (
    <div className="space-y-6 relative pb-24">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <button
            onClick={() => {
              if (window.history.length > 1) {
                navigate(-1);
              } else {
                navigate('/');
              }
            }}
            className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-blue-600 dark:hover:text-blue-400 transition-all shadow-sm flex items-center justify-center shrink-0 group mr-1"
            title="Back to Dashboard"
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
          </button>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
                {isAvailableView ? 'Available Assets Inventory' : 'Assets Management'}
              </h1>
              {isAvailableView && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300/60 dark:border-emerald-800/60">
                  {availableAssetsList.length} In Store
                </span>
              )}
            </div>
            <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">
              {isAvailableView 
                ? 'Browse available equipment in store, previous employee usage history, and category breakdowns.'
                : 'View, track, and manage all cross-departmental IT assets.'}
            </p>
          </div>
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
              <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 z-20 py-2">
                <button onClick={handleExportExcel} className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center gap-2 font-medium">
                  <FileText className="w-4 h-4 text-emerald-600" /> Export Official Excel (.xlsx)
                </button>
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

      {/* Available Assets Category Selector Tabs */}
      {isAvailableView && (
        <div className="bg-white dark:bg-slate-800/80 rounded-2xl p-4 shadow-sm border border-slate-200/80 dark:border-slate-700/80 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Organize By Device Category
              </span>
              <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">
                • Select a category to inspect available store stock
              </span>
            </div>
            {categoryFilter !== 'ALL' && (
              <button
                onClick={() => setCategoryFilter('ALL')}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 self-start sm:self-auto cursor-pointer"
              >
                Reset to All ({availableAssetsList.length})
              </button>
            )}
          </div>

          <div className="flex items-center gap-2.5 overflow-x-auto pb-1 scrollbar-thin">
            {DEVICE_CATEGORIES.map(cat => {
              const count = categoryCounts[cat.key] || 0;
              const isActive = categoryFilter === cat.key;
              const Icon = cat.icon;

              return (
                <button
                  key={cat.key}
                  onClick={() => setCategoryFilter(cat.key)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all shadow-sm cursor-pointer ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-blue-600/20 ring-2 ring-blue-500/30'
                      : 'bg-slate-50 dark:bg-slate-900/60 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700/80 hover:bg-slate-100 dark:hover:bg-slate-750'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`} />
                  <span>{cat.label}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    isActive
                      ? 'bg-blue-700 text-white'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Asset Table Card */}
      <div className="bg-white dark:bg-slate-800/50 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700/50 overflow-hidden">
        {/* Dynamic Filters */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-700/50 space-y-4">
          <div className="relative w-full">
            <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search explicitly by Code, model, device type, brand, or valid serial..."
              className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-sm rounded-xl focus:ring-2 focus:ring-blue-500 block pl-10 p-2.5 outline-none transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <select 
              value={statusFilter} 
              onChange={e => setStatusFilter(e.target.value)} 
              className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl outline-none p-2.5 focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Statuses</option>
              <option value="AVAILABLE">Available (In Store)</option>
              <option value="ASSIGNED">Assigned</option>
              <option value="UNDER_REPAIR">Under Repair</option>
              <option value="RETIRED">Retired</option>
            </select>

            <select 
              value={categoryFilter} 
              onChange={e => setCategoryFilter(e.target.value)} 
              className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl outline-none p-2.5 focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Categories</option>
              <option value="LAPTOP">Laptops ({categoryCounts.LAPTOP || 0})</option>
              <option value="DESKTOP">Desktops ({categoryCounts.DESKTOP || 0})</option>
              <option value="MONITOR">Monitors ({categoryCounts.MONITOR || 0})</option>
              <option value="PRINTER">Printers ({categoryCounts.PRINTER || 0})</option>
              <option value="MOBILE_MIFI">Mobile / MiFi ({categoryCounts.MOBILE_MIFI || 0})</option>
              <option value="NETWORK_OTHER">Network / Other ({categoryCounts.NETWORK_OTHER || 0})</option>
            </select>

            <select 
              value={assignmentTypeFilter} 
              onChange={e => setAssignmentTypeFilter(e.target.value)} 
              className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl outline-none p-2.5 focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Allocations</option>
              <option value="EMPLOYEE">Direct Employee</option>
              <option value="DEPARTMENT">Departmental</option>
              <option value="LOCATION">Branch/Location</option>
              <option value="SHARED">Shared Pool</option>
              <option value="STORE">Store Stock</option>
            </select>

            <select 
              value={locationFilter} 
              onChange={e => setLocationFilter(e.target.value)} 
              className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl outline-none p-2.5 focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Locations</option>
              {locations.map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
            </select>

            <select 
              value={departmentFilter} 
              onChange={e => setDepartmentFilter(e.target.value)} 
              className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl outline-none p-2.5 focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Departments</option>
              {departments.map(dept => <option key={dept.id} value={dept.id}>{dept.name}</option>)}
            </select>

            <select 
              value={employeeFilter} 
              onChange={e => setEmployeeFilter(e.target.value)} 
              className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl outline-none p-2.5 focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Employees</option>
              {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.fullName}</option>)}
            </select>
          </div>

          {(Boolean(statusFilter) || Boolean(categoryFilter !== 'ALL') || Boolean(assignmentTypeFilter) || Boolean(locationFilter) || Boolean(departmentFilter) || Boolean(employeeFilter) || Boolean(searchTerm)) && (
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Filtering: <strong className="text-slate-800 dark:text-white">{filteredAssets.length}</strong> matching of {assets.length} total
                {categoryFilter !== 'ALL' && ` (${categoryFilter})`}
              </span>
              <button
                onClick={() => {
                  setStatusFilter('');
                  setCategoryFilter('ALL');
                  setAssignmentTypeFilter('');
                  setLocationFilter('');
                  setDepartmentFilter('');
                  setEmployeeFilter('');
                  setSearchTerm('');
                }}
                className="text-xs text-blue-600 dark:text-blue-400 font-bold hover:underline cursor-pointer"
              >
                Clear all filters
              </button>
            </div>
          )}
        </div>

        {/* Table */}
        <div id="assets-table" className="overflow-x-auto min-h-[400px]">
          <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400">
            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-300 font-medium">
              <tr>
                <th className="px-3 py-4 w-10 text-center">
                  <input 
                    type="checkbox" 
                    checked={filteredAssets.length > 0 && selectedIds.size === filteredAssets.length}
                    onChange={toggleAll}
                    className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500"
                  />
                </th>
                <th className="px-2 py-4 w-8 text-center" title="Expand Past Usage">
                  <span className="sr-only">Expand</span>
                </th>
                <th className="px-5 py-4">Asset Matrix</th>
                <th className="px-5 py-4">User / Usage History</th>
                <th className="px-5 py-4">Placement</th>
                <th className="px-5 py-4">Device Status</th>
                <th className="px-5 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {filteredAssets.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-5 py-12 text-center text-slate-500 dark:text-slate-400">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <AlertCircle className="w-8 h-8 text-slate-400" />
                      <p className="font-semibold text-slate-700 dark:text-slate-300">No assets detected matching filter state.</p>
                      <p className="text-xs text-slate-400">Try adjusting your category selection, search keyword, or status filter.</p>
                    </div>
                  </td>
                </tr>
              ) : paginatedAssets.map((asset) => {
                const locName = locations.find(l => l.id === asset.locationId)?.name || 'Unmapped';
                const deptName = departments.find(d => d.id === asset.departmentId)?.name || 'Not Scoped';
                const empName = employees.find(e => e.id === asset.assignedEmployeeId)?.fullName || 'System Stock';
                const isSelected = selectedIds.has(asset.id);
                const isExpanded = expandedRowIds.has(asset.id);

                const { hasHistory, previousAssignment, allAssignments } = getAssetUsageHistory(asset, employees);

                return (
                  <React.Fragment key={asset.id}>
                    <tr className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors group ${isSelected ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''} ${isExpanded ? 'bg-slate-50/90 dark:bg-slate-800/60' : ''}`}>
                      {/* Checkbox */}
                      <td className="px-3 py-4 w-10 text-center">
                        <input 
                          type="checkbox" 
                          checked={isSelected}
                          onChange={() => toggleSelection(asset.id)}
                          className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500"
                        />
                      </td>

                      {/* Expand / Collapse Button */}
                      <td className="px-2 py-4 w-8 text-center">
                        <button
                          type="button"
                          onClick={() => toggleRowExpand(asset.id)}
                          className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                          title={isExpanded ? 'Collapse usage details' : 'Expand usage details'}
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4 text-blue-600 dark:text-blue-400" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </td>

                      {/* Asset Matrix */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          {Boolean(asset.imageUrl || asset.imageStorageKey) ? (
                            <AssetRowThumb asset={asset} />
                          ) : null}
                          <div className="flex flex-col">
                            <div className="flex items-center gap-1.5">
                              <Link to={`/assets/${encodeURIComponent(asset.assetCode)}`} className="font-bold text-blue-600 hover:underline">
                                {asset.assetCode}
                              </Link>
                              <CopyButton text={asset.assetCode} label="Asset Code" iconSize="w-2.5 h-2.5" className="opacity-0 group-hover:opacity-100 p-0.5" />
                            </div>
                            <span className="text-sm font-medium text-slate-800 dark:text-slate-200 mt-0.5">
                              {asset.model || asset.deviceType}
                            </span>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[10px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded flex items-center gap-1">
                                S/N: {asset.serialNumber || 'N/A'}
                                {asset.serialNumber && <CopyButton text={asset.serialNumber} label="Serial Number" iconSize="w-2.5 h-2.5" className="p-0.5" />}
                              </span>
                              {asset.ipAddress && (
                                <span className="text-[10px] font-mono text-purple-600 bg-purple-50 dark:bg-purple-900/30 px-1.5 py-0.5 rounded">
                                  IP: {asset.ipAddress}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* User / Usage History Column */}
                      <td className="px-5 py-4">
                        {asset.status === 'AVAILABLE' ? (
                          hasHistory && previousAssignment?.employee ? (
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/60 px-1.5 py-0.5 rounded-md inline-flex items-center gap-1">
                                  <History className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400" />
                                  Previously Used By:
                                </span>
                                {allAssignments.length > 1 && (
                                  <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/40 px-1.5 py-0.5 rounded-md" title={`${allAssignments.length} total assignment cycles`}>
                                    {allAssignments.length}x
                                  </span>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedHistoryAsset(asset);
                                }}
                                className="text-left font-semibold text-slate-800 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 text-sm flex items-center gap-1.5 group/btn cursor-pointer"
                                title="Click to view complete assignment history"
                              >
                                <span>{previousAssignment.employee.fullName}</span>
                                <ExternalLink className="w-3 h-3 text-slate-400 group-hover/btn:text-blue-500 transition-colors shrink-0" />
                              </button>
                              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                                <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500">
                                  {previousAssignment.employee.employeeCode || 'N/A'}
                                </span>
                                {previousAssignment.returnedDate && (
                                  <>
                                    <span>•</span>
                                    <span>Ret: {new Date(previousAssignment.returnedDate).toLocaleDateString()}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                              <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span>No Previous Assignment</span>
                            </div>
                          )
                        ) : (
                          <div className="flex flex-col">
                            <span className="font-medium text-slate-800 dark:text-white">
                              {empName}
                            </span>
                            {asset.assignedEmployee?.employeeCode && (
                              <span className="text-[11px] font-mono text-slate-400">
                                {asset.assignedEmployee.employeeCode}
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Placement */}
                      <td className="px-5 py-4">
                        <p className="text-slate-800 dark:text-slate-200">{locName}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{deptName}</p>
                      </td>

                      {/* Device Status */}
                      <td className="px-5 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] uppercase font-bold tracking-wider ${
                          asset.status === 'AVAILABLE' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                          asset.status === 'ASSIGNED' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                          asset.status === 'UNDER_REPAIR' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                          'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        }`}>
                          {asset.status.replace('_', ' ')}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                          {asset.status === 'AVAILABLE' && (
                            <button
                              type="button"
                              onClick={() => setSelectedHistoryAsset(asset)}
                              className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                              title="View Past Usage & Handover History"
                            >
                              <History className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                            </button>
                          )}
                          <Link 
                            to={`/assets/${encodeURIComponent(asset.assetCode)}`} 
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-700 rounded-lg transition-colors"
                            title="View Asset Profile"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>
                          {canCreateEdit && (
                            <button 
                              onClick={() => navigate(`/assets/edit/${asset.id}`)} 
                              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-700 rounded-lg transition-colors"
                              title="Edit Asset"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                          )}
                          {canDelete && (
                            <button 
                              onClick={() => handleDelete(asset.id)} 
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-slate-700 rounded-lg transition-colors"
                              title="Delete Asset"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Expandable Row for Usage History Details */}
                    {isExpanded && (
                      <tr className="bg-slate-50/70 dark:bg-slate-900/70 border-b border-slate-200/80 dark:border-slate-800">
                        <td colSpan="7" className="px-6 py-5">
                          <div className="bg-white dark:bg-slate-850 p-5 rounded-2xl border border-slate-200 dark:border-slate-750 shadow-sm space-y-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                              <div className="flex items-center gap-2">
                                <History className="w-4 h-4 text-amber-500" />
                                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-white">
                                  Historical Usage Breakdown — {asset.assetCode}
                                </h4>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setSelectedHistoryAsset(asset)}
                                  className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                                >
                                  Open Detailed History Dialog
                                  <ExternalLink className="w-3 h-3" />
                                </button>
                              </div>
                            </div>

                            {hasHistory && previousAssignment?.employee ? (
                              <div className="space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-750">
                                  <div>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Previous Employee</span>
                                    <span className="text-xs font-semibold text-slate-800 dark:text-white block mt-0.5">
                                      {previousAssignment.employee.fullName}
                                    </span>
                                    <span className="text-[10px] font-mono text-slate-500">
                                      ID: {previousAssignment.employee.employeeCode || 'N/A'}
                                    </span>
                                  </div>

                                  <div>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Assigned / Returned</span>
                                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300 block mt-0.5">
                                      From: {new Date(previousAssignment.assignedDate).toLocaleDateString()}
                                    </span>
                                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 block">
                                      To: {previousAssignment.returnedDate ? new Date(previousAssignment.returnedDate).toLocaleDateString() : 'N/A'}
                                    </span>
                                  </div>

                                  <div>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Department & Location</span>
                                    <span className="text-xs text-slate-700 dark:text-slate-300 block mt-0.5">
                                      {previousAssignment.employee.department?.name || 'Euro Motors'}
                                    </span>
                                    <span className="text-[11px] text-slate-500 block">
                                      {previousAssignment.employee.location?.name || 'Head Office'}
                                    </span>
                                  </div>

                                  <div>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Condition upon Return</span>
                                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300 block mt-0.5">
                                      {asset.condition || 'GOOD'}
                                    </span>
                                    <span className="text-[11px] text-slate-500 italic block truncate" title={previousAssignment.remarks || 'Standard store return'}>
                                      "{previousAssignment.remarks || 'Standard store return'}"
                                    </span>
                                  </div>
                                </div>

                                {allAssignments.length > 1 && (
                                  <div className="pt-2">
                                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-2">
                                      Prior Handover Cycles ({allAssignments.length} total assignments recorded):
                                    </span>
                                    <div className="space-y-1.5">
                                      {allAssignments.slice(1).map((asg, idx) => (
                                        <div key={asg.id || idx} className="text-xs bg-slate-100/70 dark:bg-slate-800/40 p-2.5 rounded-lg flex flex-wrap items-center justify-between gap-2">
                                          <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-bold text-slate-400">Cycle #{idx + 2}</span>
                                            <span className="font-semibold text-slate-800 dark:text-white">{asg.employee?.fullName}</span>
                                            <span className="font-mono text-[10px] text-slate-500">({asg.employee?.employeeCode || 'EMP'})</span>
                                          </div>
                                          <div className="text-[11px] font-mono text-slate-500">
                                            {new Date(asg.assignedDate).toLocaleDateString()} &rarr; {asg.returnedDate ? new Date(asg.returnedDate).toLocaleDateString() : 'N/A'}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="py-6 text-center space-y-2">
                                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-semibold">
                                  <Clock className="w-3.5 h-3.5" />
                                  No Previous Assignment
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                  This asset is in store stock and has not yet been assigned to any employee.
                                </p>
                              </div>
                            )}

                            <div className="flex items-center justify-end gap-3 pt-2">
                              {asset.status === 'AVAILABLE' && (
                                <Link
                                  to={`/assignments?assetId=${asset.id}`}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors shadow-sm"
                                >
                                  Assign to Employee
                                  <ArrowRight className="w-3 h-3" />
                                </Link>
                              )}
                              <button
                                type="button"
                                onClick={() => toggleRowExpand(asset.id)}
                                className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                              >
                                Collapse
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {filteredAssets.length > 0 && (
          <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-900/40">
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span>Showing</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">
                {pageSize === 0 ? 1 : Math.min((currentPage - 1) * pageSize + 1, filteredAssets.length)}
              </span>
              <span>to</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">
                {pageSize === 0 ? filteredAssets.length : Math.min(currentPage * pageSize, filteredAssets.length)}
              </span>
              <span>of</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">{filteredAssets.length}</span>
              <span>assets</span>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <span>Per page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 outline-none cursor-pointer"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={0}>All ({filteredAssets.length})</option>
                </select>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  >
                    Previous
                  </button>
                  <span className="px-2 text-xs font-bold text-slate-600 dark:text-slate-300">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
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
            
            <div className="h-6 w-px bg-slate-700" />
            
            <div className="flex items-center gap-3">
              {canDelete && (
                <button 
                  className="text-sm font-medium hover:text-red-400 transition-colors flex items-center gap-1.5 cursor-pointer"
                  onClick={handleBulkDelete}
                >
                  <Trash2 className="w-4 h-4" /> Delete All
                </button>
              )}
              <button 
                className="text-sm font-medium hover:text-slate-300 transition-colors flex items-center gap-1.5 cursor-pointer"
                onClick={() => setSelectedIds(new Set())}
              >
                <XSquare className="w-4 h-4" /> Clear
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Usage History Modal */}
      <AssetUsageHistoryModal
        asset={selectedHistoryAsset}
        isOpen={Boolean(selectedHistoryAsset)}
        onClose={() => setSelectedHistoryAsset(null)}
      />
    </div>
  );
}
