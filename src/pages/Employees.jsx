import { useState, useEffect, useRef } from 'react';
import { Search, Plus, Mail, Loader2, AlertCircle, Edit, Trash2, X, Phone, Briefcase, MapPin, MonitorSmartphone, ExternalLink, XSquare, ArrowLeft, Upload, User, Camera, Image as ImageIcon, History, Tag, ArrowRight, ShieldCheck, CheckCircle2 } from 'lucide-react';
import imageCompression from 'browser-image-compression';
import { AnimatePresence, motion } from 'framer-motion';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import CopyButton from '../components/CopyButton';
import { returnAssetToStore } from '../utils/assetReturn';
import { safeSetItem } from '../utils/storage';

const _rawApi = import.meta.env.VITE_API_URL || '/api';
const API_URL = _rawApi.endsWith('/api') ? _rawApi : `${_rawApi.replace(/\/$/, '')}/api`;

const getAvatarUrl = (url) => {
  if (!url) return null;
  if (url.startsWith('data:') || url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:')) {
    return url;
  }
  const cleanPath = url.startsWith('/api') ? url.replace(/^\/api/, '') : url;
  return `${API_URL}${cleanPath.startsWith('/') ? '' : '/'}${cleanPath}`;
};

export default function Employees({ defaultOpenAdd = false }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [employees, setEmployees] = useState(() => {
    try {
      const cached = localStorage.getItem('employeesCache');
      return cached ? JSON.parse(cached) : [];
    } catch (e) {
      return [];
    }
  });
  const [departments, setDepartments] = useState(() => {
    try {
      const cached = localStorage.getItem('departmentsCache');
      return cached ? JSON.parse(cached) : [];
    } catch (e) {
      return [];
    }
  });
  const [locations, setLocations] = useState(() => {
    try {
      const cached = localStorage.getItem('locationsCache');
      return cached ? JSON.parse(cached) : [];
    } catch (e) {
      return [];
    }
  });
  const [assets, setAssets] = useState(() => {
    try {
      const cached = localStorage.getItem('assetsCache');
      return cached ? JSON.parse(cached) : [];
    } catch (e) {
      return [];
    }
  });
  const [loading, setLoading] = useState(employees.length === 0);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchParams] = useSearchParams();
  const [locationFilter, setLocationFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');

  // Asset picker modal state
  const [assetPickerModal, setAssetPickerModal] = useState({ open: false, empName: '', employeeId: '', assets: [], assignments: [] });
  const [auditModal, setAuditModal] = useState({ open: false, employee: null, logs: [], loading: false, stats: null });

  const openEmployeeAudit = async (emp) => {
    setAuditModal({ open: true, employee: emp, logs: [], loading: true, stats: null });
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/audit-logs/employees/${emp.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAuditModal({
          open: true,
          employee: emp,
          logs: data.timeline || data.logs || [],
          loading: false,
          stats: data.stats || data.summary || null
        });
      } else {
        setAuditModal(prev => ({ ...prev, loading: false }));
      }
    } catch (err) {
      setAuditModal(prev => ({ ...prev, loading: false }));
    }
  };

  // Bulk Selection
  const [selectedIds, setSelectedIds] = useState(new Set());

  const userRole = (user?.role || '').toUpperCase();
  const canCreateEdit = !userRole || userRole === 'ADMIN' || userRole === 'IT_OFFICER' || user?.permissions?.MANAGE_EMPLOYEES !== false;
  const canDelete = !userRole || userRole === 'ADMIN' || user?.permissions?.MANAGE_EMPLOYEES !== false;

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmp, setEditingEmp] = useState(null);
  const avatarInputRef = useRef(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    employeeCode: '',
    fullName: '',
    email: '',
    designation: '',
    phone: '',
    departmentId: '',
    locationId: '',
    status: 'ACTIVE',
    avatarUrl: ''
  });

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error("Authentication required");
      
      const headers = { 'Authorization': `Bearer ${token}` };

      const [empsRes, deptsRes, locsRes, assetsRes] = await Promise.all([
        fetch(`${API_URL}/employees`, { headers }),
        fetch(`${API_URL}/departments`, { headers }),
        fetch(`${API_URL}/locations`, { headers }),
        fetch(`${API_URL}/assets`, { headers })
      ]);

      if (!empsRes.ok || !deptsRes.ok || !locsRes.ok || !assetsRes.ok) {
        throw new Error('Failed to load employee directory components');
      }

      const [empsData, deptsData, locsData, assetsData] = await Promise.all([
        empsRes.json(),
        deptsRes.json(),
        locsRes.json(),
        assetsRes.json()
      ]);

      setEmployees(empsData);
      setDepartments(deptsData);
      setLocations(locsData);
      setAssets(assetsData);
      safeSetItem('employeesCache', empsData);
      safeSetItem('departmentsCache', deptsData);
      safeSetItem('locationsCache', locsData);
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

  // Initialize filters and action from URL
  useEffect(() => {
    const locId = searchParams.get('locationId');
    const deptId = searchParams.get('departmentId');
    const action = searchParams.get('action');

    if (locId) setLocationFilter(locId);
    if (deptId) setDepartmentFilter(deptId);

    if (defaultOpenAdd || action === 'add' || location.pathname.endsWith('/add')) {
      openModal();
    }
  }, [searchParams, defaultOpenAdd, location.pathname]);

  const openModal = (emp = null) => {
    if (emp) {
      setEditingEmp(emp);
      setFormData({
        employeeCode: emp.employeeCode || '',
        fullName: emp.fullName || '',
        email: emp.email || '',
        designation: emp.designation || '',
        phone: emp.phone || '',
        departmentId: emp.departmentId || '',
        locationId: emp.locationId || '',
        status: emp.status || 'ACTIVE',
        avatarUrl: emp.avatarUrl || ''
      });
    } else {
      setEditingEmp(null);
      setFormData({
        employeeCode: '',
        fullName: '',
        email: '',
        designation: '',
        phone: '',
        departmentId: departments.length > 0 ? departments[0].id : '',
        locationId: locations.length > 0 ? locations[0].id : '',
        status: 'ACTIVE',
    avatarUrl: ''
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (submitting) return;
    setIsModalOpen(false);
    setEditingEmp(null);
    if (searchParams.get('action') === 'add' || location.pathname.endsWith('/add')) {
      navigate('/employees', { replace: true });
    }
  };

  const handleAvatarSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingAvatar(true);
      let compressedFile = file;
      try {
        compressedFile = await imageCompression(file, {
          maxSizeMB: 0.4,
          maxWidthOrHeight: 500,
          useWebWorker: false,
          fileType: 'image/webp',
          initialQuality: 0.85
        });
      } catch (cErr) {
        console.warn('Image compression skipped:', cErr);
      }

      const token = localStorage.getItem('token');
      const avatarFormData = new FormData();
      avatarFormData.append('avatar', new File([compressedFile], `avatar_${Date.now()}.webp`, { type: 'image/webp' }));

      let uploadedUrl = null;
      try {
        const uploadRes = await fetch(`${API_URL}/uploads/avatar`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: avatarFormData
        });
        if (uploadRes.ok) {
          const resData = await uploadRes.json();
          uploadedUrl = resData.url;
        }
      } catch (uErr) {
        console.warn('Backend avatar upload endpoint unreachable, falling back to direct attachment:', uErr);
      }

      if (uploadedUrl) {
        setFormData(prev => ({ ...prev, avatarUrl: uploadedUrl }));
        showToast('Profile photo uploaded successfully!', 'success');
      } else {
        // Fallback to base64 Data URL so user never gets blocked
        const reader = new FileReader();
        reader.onloadend = () => {
          setFormData(prev => ({ ...prev, avatarUrl: reader.result }));
          setUploadingAvatar(false);
          showToast('Profile photo attached!', 'success');
        };
        reader.readAsDataURL(compressedFile);
        return;
      }
    } catch (err) {
      showToast(err.message || 'Failed to process avatar', 'error');
    } finally {
      setUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting || uploadingAvatar) return;

    try {
      setSubmitting(true);
      const token = localStorage.getItem('token');
      const url = editingEmp 
        ? `${API_URL}/employees/${editingEmp.id}` 
        : `${API_URL}/employees`;
      const method = editingEmp ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({
          ...formData,
          email: formData.email?.trim() === '' ? null : formData.email?.trim(),
          phone: formData.phone?.trim() === '' ? null : formData.phone?.trim(),
          departmentId: formData.departmentId && formData.departmentId.trim() !== '' ? formData.departmentId : null,
          locationId: formData.locationId && formData.locationId.trim() !== '' ? formData.locationId : null,
          avatarUrl: formData.avatarUrl ? formData.avatarUrl.trim() : null
        })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to save employee');
      }

      const savedEmp = await res.json();

      // Immediately update local cache and state with zero lag
      if (editingEmp) {
        setEmployees(prev => {
          const updated = prev.map(emp => emp.id === savedEmp.id ? { ...emp, ...savedEmp } : emp);
          try { localStorage.setItem('employeesCache', JSON.stringify(updated)); } catch (e) {}
          return updated;
        });
      } else {
        setEmployees(prev => {
          const updated = [savedEmp, ...prev];
          try { localStorage.setItem('employeesCache', JSON.stringify(updated)); } catch (e) {}
          return updated;
        });
      }

      showToast(editingEmp ? 'Employee profile updated!' : 'Employee registered successfully!', 'success');
      closeModal();

      // Background sync to ensure fresh relation metrics
      fetchData();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (user?.role !== 'ADMIN') {
      showToast('Action Restricted: Please ask Super Admin to delete this entry.', 'error');
      return;
    }
    const input = await confirm({
      type: 'prompt',
      title: 'Delete Employee',
      message: 'Are you sure you want to permanently delete this employee? Type "DELETE" to confirm.',
      inputPlaceholder: 'DELETE',
      confirmText: 'Delete Employee'
    });
    if (input !== 'DELETE') {
      if (input !== null) showToast('Deletion cancelled. You must type "DELETE".', 'info');
      return;
    }
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/employees/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to delete employee');
      await fetchData();
      showToast('Employee permanently removed from registry.', 'success');
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
      message: `Are you sure you want to permanently delete ${selectedIds.size} employees? Type "DELETE" to confirm.`,
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
        const res = await fetch(`${API_URL}/employees/${id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) successCount++;
      }
      
      await fetchData();
      setSelectedIds(new Set());
      showToast(`Successfully deleted ${successCount} employees.`, 'success');
    } catch (err) {
      showToast('Failed to delete some employees.', 'error');
    }
  };

  // --- Assigned Assets Badge Click Logic ---
  const getAssignedAssets = (emp) => {
    const direct = assets.filter(a => a.assignedEmployeeId === emp.id);
    const activeAssignmentAssetIds = (emp.assignments || [])
      .filter(a => a.status === 'ACTIVE')
      .map(a => a.assetId);
    const fromAssignments = assets.filter(a => activeAssignmentAssetIds.includes(a.id));
    // Merge and deduplicate by asset id
    const map = new Map();
    [...direct, ...fromAssignments].forEach(a => map.set(a.id, a));
    return Array.from(map.values());
  };

  const handleAssetBadgeClick = (emp) => {
    const assigned = getAssignedAssets(emp);
    if (assigned.length === 0) {
      showToast('No assigned assets for this employee.', 'info');
    } else if (assigned.length === 1) {
      navigate(`/assets/${assigned[0].assetCode}`);
    } else {
      setAssetPickerModal({ open: true, empName: emp.fullName, employeeId: emp.id, assets: assigned, assignments: emp.assignments || [] });
    }
  };

  const filteredEmployees = employees.filter(emp => {
    const q = searchQuery.toLowerCase();
    const textMatch = (
      (emp.fullName && emp.fullName.toLowerCase().includes(q)) ||
      (emp.employeeCode && emp.employeeCode.toLowerCase().includes(q)) ||
      (emp.email && emp.email.toLowerCase().includes(q))
    );

    const locationMatch = locationFilter ? emp.locationId === locationFilter : true;
    const departmentMatch = departmentFilter ? emp.departmentId === departmentFilter : true;

    return textMatch && locationMatch && departmentMatch;
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
    if (selectedIds.size === filteredEmployees.length && filteredEmployees.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredEmployees.map(emp => emp.id)));
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 flex-col items-center justify-center space-y-4">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
        <p className="text-slate-500 font-medium">Synchronizing Secure Personnel Database...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col h-[50vh] items-center justify-center p-8 bg-red-50 border border-red-100 rounded-3xl">
        <AlertCircle className="h-14 w-14 text-red-500 mb-4" />
        <h2 className="text-xl font-bold text-red-600">Error Loading Data</h2>
        <p className="text-red-500 text-center mt-2 max-w-md">{error}</p>
        <button onClick={fetchData} className="mt-6 px-6 py-2 bg-red-600 text-white rounded-xl shadow-sm hover:bg-red-700 transition">
          Retry Connection
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
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
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Employees</h1>
            <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">Manage employee records and view their assigned assets.</p>
          </div>
        </div>
        {canCreateEdit && (
          <button 
            onClick={() => openModal()}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm shadow-blue-600/20"
          >
            <Plus className="w-4 h-4" />
            Add Employee
          </button>
        )}
      </div>

      <div className="bg-white dark:bg-slate-800/50 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700/50 overflow-hidden">
        <div className="p-5 border-b border-slate-100 dark:border-slate-700/50 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Search by name, email, or exact code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-sm rounded-xl focus:ring-2 focus:ring-blue-500 block pl-10 p-2.5 outline-none transition-all"
            />
          </div>
          <div className="flex gap-4">
            <select value={departmentFilter} onChange={e => setDepartmentFilter(e.target.value)} className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-sm rounded-xl outline-none px-4 py-2 focus:ring-2 focus:ring-blue-500 min-w-[150px]">
              <option value="">All Departments</option>
              {departments.map(dept => <option key={dept.id} value={dept.id}>{dept.name}</option>)}
            </select>
            <select value={locationFilter} onChange={e => setLocationFilter(e.target.value)} className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-sm rounded-xl outline-none px-4 py-2 focus:ring-2 focus:ring-blue-500 min-w-[150px]">
              <option value="">All Locations</option>
              {locations.map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400">
            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-300 font-medium whitespace-nowrap">
              <tr>
                <th className="px-5 py-4 w-12">
                  <input 
                    type="checkbox" 
                    checked={filteredEmployees.length > 0 && selectedIds.size === filteredEmployees.length}
                    onChange={toggleAll}
                    className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500"
                  />
                </th>
                <th className="px-5 py-4">Employee</th>
                <th className="px-5 py-4">Department & Role</th>
                <th className="px-5 py-4">Base Location</th>
                <th className="px-5 py-4 text-center">Status</th>
                <th className="px-5 py-4 text-center">Assigned Assets</th>
                <th className="px-5 py-4 text-right sticky right-0 bg-slate-50 dark:bg-slate-800 z-10 shadow-[-4px_0_6px_rgba(0,0,0,0.04)]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-5 py-10 text-center text-slate-500">
                    No employees matching your criteria were found.
                  </td>
                </tr>
              ) : filteredEmployees.map((emp) => {
                const dept = departments.find(d => d.id === emp.departmentId);
                const loc = locations.find(l => l.id === emp.locationId);
                
                return (
                  <tr 
                    key={emp.id} 
                    onClick={() => openModal(emp)}
                    className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group ${selectedIds.has(emp.id) ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}
                  >
                    <td className="px-5 py-4 w-12" onClick={(e) => e.stopPropagation()}>
                      <input 
                        type="checkbox" 
                        checked={selectedIds.has(emp.id)}
                        onChange={() => toggleSelection(emp.id)}
                        className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-tr from-blue-100 to-indigo-100 dark:from-slate-700 dark:to-slate-800 border border-slate-200 dark:border-slate-600 shrink-0 flex items-center justify-center font-bold text-xs text-blue-600 dark:text-blue-400 shadow-sm">
                          {emp.avatarUrl ? (
                            <img 
                              src={getAvatarUrl(emp.avatarUrl)} 
                              alt={emp.fullName} 
                              className="w-full h-full object-cover"
                              onError={(e) => { 
                                e.target.style.display = 'none'; 
                              }}
                            />
                          ) : (
                            <span>{emp.fullName?.split(' ').map(n=>n[0]).slice(0,2).join('').toUpperCase() || 'EM'}</span>
                          )}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-800 dark:text-white">{emp.fullName}</span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-xs font-mono text-slate-500">{emp.employeeCode}</span>
                          <CopyButton text={emp.employeeCode} label="Employee Code" iconSize="w-2.5 h-2.5" className="opacity-0 group-hover:opacity-100 p-0.5" />
                        </div>
                          {emp.email && <span className="text-xs text-slate-500 flex items-center gap-1 mt-0.5"><Mail className="w-3 h-3"/> {emp.email}</span>}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-slate-800 dark:text-white font-medium">{dept?.name || 'Unassigned'}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5"><Briefcase className="w-3 h-3"/> {emp.designation}</p>
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-1"><MapPin className="w-4 h-4 text-slate-400"/> {loc?.name || 'Unassigned'}</span>
                    </td>
                    <td className="px-5 py-4 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] uppercase font-bold tracking-wider ${
                          emp.status === 'ACTIVE' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                        }`}>
                          {emp.status}
                        </span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      {(() => {
                        const assigned = getAssignedAssets(emp);
                        const count = assigned.length;
                        return (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleAssetBadgeClick(emp); }}
                            title={count === 0 ? 'No assets assigned' : `View ${count} assigned asset${count > 1 ? 's' : ''}`}
                            className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-xs shadow-sm border transition-all duration-200
                              ${count === 0
                                ? 'bg-slate-50 border-slate-200 text-slate-400 dark:bg-slate-800 dark:border-slate-700 cursor-default hover:bg-slate-100 dark:hover:bg-slate-700'
                                : 'bg-blue-50 border-blue-100 text-blue-700 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-400 cursor-pointer hover:bg-blue-600 hover:text-white hover:border-blue-600 hover:scale-110'
                              }`}
                          >
                            {count}
                          </button>
                        );
                      })()}
                    </td>
                    <td className="px-5 py-4 text-right sticky right-0 bg-white dark:bg-slate-900 z-10 shadow-[-4px_0_6px_rgba(0,0,0,0.04)] group-hover:bg-slate-50/70 dark:group-hover:bg-slate-800/50 transition-colors">
                      <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        <button 
                          onClick={() => openEmployeeAudit(emp)} 
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors shadow-sm cursor-pointer" 
                          title="View Employee Activity History & Audit Trail"
                        >
                          <History className="w-3.5 h-3.5 text-blue-500" />
                          <span className="hidden sm:inline">Audit</span>
                        </button>
                        {canCreateEdit && (
                          <button 
                            onClick={() => openModal(emp)} 
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 transition-colors shadow-sm cursor-pointer" 
                            title="Edit Employee"
                          >
                            <Edit className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>
                        )}
                        {canDelete && (
                          <button 
                            onClick={() => handleDelete(emp.id)} 
                            className="p-1.5 text-slate-400 hover:text-red-600 rounded-md hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors cursor-pointer" 
                            title="Delete Employee"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                        {!canCreateEdit && <span className="text-xs text-slate-400 dark:text-slate-500">View Only</span>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-3 sm:p-4 md:p-6 overflow-hidden">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="shrink-0 flex justify-between items-center px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
              <div>
                <h3 className="font-bold text-lg text-slate-900 dark:text-white">
                  {editingEmp ? 'Edit Employee Profile' : 'Add New Employee'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {editingEmp ? 'Update employee information and profile photo' : 'Fill in details to register a new employee into the system'}
                </p>
              </div>
              <button 
                type="button" 
                onClick={closeModal} 
                disabled={submitting}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Scrollable Form Body */}
            <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-6 overflow-y-auto flex-1">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Profile Picture Upload */}
                  <div className="md:col-span-2 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 flex flex-col sm:flex-row items-center gap-4">
                    <div className="relative group shrink-0">
                      <div className="w-20 h-20 rounded-full overflow-hidden bg-white dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600 shadow-sm flex items-center justify-center">
                        {formData.avatarUrl ? (
                          <img 
                            src={getAvatarUrl(formData.avatarUrl)} 
                            alt="Avatar preview" 
                            className="w-full h-full object-cover"
                            onError={(e) => { e.target.style.display = 'none'; }}
                          />
                        ) : (
                          <User className="w-9 h-9 text-slate-400 dark:text-slate-500" />
                        )}
                      </div>
                      {uploadingAvatar && (
                        <div className="absolute inset-0 bg-white/70 dark:bg-slate-900/70 rounded-full flex items-center justify-center">
                          <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 text-center sm:text-left">
                      <label className="block text-sm font-semibold text-slate-900 dark:text-white">Profile Photo</label>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Upload a picture for employee profile (JPEG, PNG, or WEBP, max 5MB)</p>
                      
                      <input 
                        type="file" 
                        ref={avatarInputRef} 
                        onChange={handleAvatarSelect} 
                        accept="image/png,image/jpeg,image/webp" 
                        className="hidden" 
                      />

                      <div className="flex items-center justify-center sm:justify-start gap-2.5 mt-2.5">
                        <button 
                          type="button" 
                          onClick={() => avatarInputRef.current?.click()}
                          disabled={uploadingAvatar || submitting}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/40 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                        >
                          <Camera className="w-3.5 h-3.5" />
                          {formData.avatarUrl ? 'Change Photo' : 'Upload Photo'}
                        </button>

                        {formData.avatarUrl && (
                          <button 
                            type="button" 
                            onClick={() => setFormData(prev => ({ ...prev, avatarUrl: '' }))}
                            disabled={uploadingAvatar || submitting}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Employee Code</label>
                    <input 
                      type="text" value={formData.employeeCode} readOnly
                      placeholder="Auto-generated upon save"
                      className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 rounded-xl px-4 py-2.5 outline-none font-mono cursor-not-allowed"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Full Name *</label>
                    <input 
                      required type="text" value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})}
                      placeholder="John Doe"
                      disabled={submitting}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-500 p-2.5 outline-none transition-all placeholder:text-slate-400"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email Address</label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input 
                        type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})}
                        placeholder="john.doe@euromotors.com"
                        disabled={submitting}
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-500 pl-9 p-2.5 outline-none transition-all placeholder:text-slate-400"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Phone Number</label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input 
                        type="tel" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})}
                        placeholder="+1 (555) 000-0000"
                        disabled={submitting}
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-500 pl-9 p-2.5 outline-none transition-all placeholder:text-slate-400"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Designation *</label>
                    <input 
                      required type="text" value={formData.designation} onChange={e => setFormData({...formData, designation: e.target.value})}
                      placeholder="e.g. Senior Developer"
                      disabled={submitting}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-500 p-2.5 outline-none transition-all placeholder:text-slate-400"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Status</label>
                    <select 
                      value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}
                      disabled={submitting}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-500 p-2.5 outline-none transition-all"
                    >
                      <option value="ACTIVE">Active</option>
                      <option value="INACTIVE">Inactive / Former</option>
                    </select>
                  </div>

                  <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-5 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Department assignment *</label>
                      <select 
                        required value={formData.departmentId} onChange={e => setFormData({...formData, departmentId: e.target.value})}
                        disabled={submitting}
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-500 p-2.5 outline-none transition-all"
                      >
                        <option value="" disabled>Select Department...</option>
                        {departments.map(dept => (
                          <option key={dept.id} value={dept.id}>{dept.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Base Location *</label>
                      <select 
                        required value={formData.locationId} onChange={e => setFormData({...formData, locationId: e.target.value})}
                        disabled={submitting}
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-500 p-2.5 outline-none transition-all"
                      >
                        <option value="" disabled>Select Location...</option>
                        {locations.map(loc => (
                          <option key={loc.id} value={loc.id}>{loc.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Fixed Footer */}
              <div className="shrink-0 px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/90 flex justify-end gap-3 flex-wrap">
                <button 
                  type="button" 
                  onClick={closeModal} 
                  disabled={submitting}
                  className="px-5 py-2.5 font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={submitting || uploadingAvatar}
                  className="inline-flex items-center gap-2 px-6 py-2.5 font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 shadow-sm shadow-blue-600/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-95"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>{editingEmp ? 'Save Employee Profile' : 'Register Employee'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Asset Picker Modal */}
      {assetPickerModal.open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4"
          onClick={() => setAssetPickerModal({ open: false, empName: '', assets: [] })}
        >
          <div
            className="bg-white dark:bg-[#0c1322] border border-slate-200 dark:border-slate-800 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800/80 bg-slate-50/80 dark:bg-[#080d18]">
              <div className="flex items-center gap-3.5">
                <h3 className="font-bold text-slate-800 dark:text-white text-sm">Assigned Assets</h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{assetPickerModal.empName} · {assetPickerModal.assets.length} assets</p>
              </div>
              <button
                onClick={() => setAssetPickerModal({ open: false, empName: '', assets: [] })}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Asset List */}
            <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-80 overflow-y-auto">
              {assetPickerModal.assets.map(asset => (
                <div
                  key={asset.id}
                  className="w-full flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <div
                    onClick={() => {
                      setAssetPickerModal({ open: false, empName: '', assets: [] });
                      navigate(`/assets/${asset.assetCode}`);
                    }}
                    className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer group"
                  >
                    <div className="p-2 bg-slate-100 dark:bg-slate-800 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/50 rounded-xl transition-colors shrink-0">
                      <MonitorSmartphone className="w-4 h-4 text-slate-500 group-hover:text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="font-extrabold text-slate-900 dark:text-white text-xs uppercase tracking-wide group-hover:text-blue-600 transition-colors">{asset.assetCode}</p>
                        <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-blue-500" />
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{asset.deviceType} · {asset.model}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider
                      ${asset.status === 'ASSIGNED' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400'
                        : asset.status === 'AVAILABLE' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
                        : asset.status === 'UNDER_REPAIR' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}
                    >
                      {asset.status}
                    </span>

                    {canCreateEdit && asset.status === 'ASSIGNED' && (
                      <button
                        type="button"
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (!await confirm({
                            title: 'Return Asset to Store',
                            message: `Return ${asset.assetCode} (${asset.model || asset.deviceType}) back to Store / Available stock?`,
                            confirmText: 'Check-in to Store'
                          })) return;

                          try {
                            await returnAssetToStore({
                              assetId: asset.id,
                              assetCode: asset.assetCode,
                              activeAssignments: assetPickerModal.assignments
                            });
                            showToast(`Asset ${asset.assetCode} returned to available store stock.`, 'success');
                            await fetchData();
                            setAssetPickerModal(prev => {
                              const remaining = prev.assets.filter(a => a.id !== asset.id);
                              if (remaining.length === 0) {
                                return { open: false, empName: '', employeeId: '', assets: [], assignments: [] };
                              }
                              return { ...prev, assets: remaining };
                            });
                          } catch (err) {
                            showToast(err.message || 'Return failed', 'error');
                          }
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 transition-colors cursor-pointer"
                        title="Check-in this asset back to Store / Available stock"
                      >
                        <ArrowLeft className="w-3 h-3" />
                        <span>Return</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="px-5 py-3 bg-slate-50/80 dark:bg-[#080d18] border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <p className="text-[10px] text-slate-400">Click asset to inspect profile or use Return to check-in</p>
              <button
                type="button"
                onClick={() => setAssetPickerModal({ open: false, empName: '', assets: [] })}
                className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

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
              <span className="font-semibold text-sm">Employees Selected</span>
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

      {/* Dedicated Employee Activity History Modal */}
      {auditModal.open && auditModal.employee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#0e1524] border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            {/* Header */}
            <div className="p-5 border-b border-slate-800 bg-[#0a0f1a] flex justify-between items-start">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-full overflow-hidden bg-gradient-to-tr from-blue-600 to-indigo-600 border border-blue-400/30 flex items-center justify-center text-white font-bold text-sm shadow-md shrink-0">
                  {auditModal.employee.avatarUrl ? (
                    <img 
                      src={getAvatarUrl(auditModal.employee.avatarUrl)} 
                      alt={auditModal.employee.fullName} 
                      className="w-full h-full object-cover" 
                    />
                  ) : (
                    <span>{auditModal.employee.fullName?.split(' ').map(n=>n[0]).slice(0,2).join('').toUpperCase()}</span>
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-white">{auditModal.employee.fullName}</h3>
                    <span className="font-mono text-xs text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded flex items-center gap-1.5">
                      {auditModal.employee.employeeCode}
                      <CopyButton text={auditModal.employee.employeeCode} label="Employee Code" iconSize="w-2.5 h-2.5" className="p-0.5" />
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {auditModal.employee.designation || 'Staff'} • {departments.find(d => d.id === auditModal.employee.departmentId)?.name || 'General'}
                  </p>
                </div>
              </div>

              <button 
                onClick={() => setAuditModal({ open: false, employee: null, logs: [], loading: false, stats: null })}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Sub-header / Metrics */}
            <div className="grid grid-cols-3 divide-x divide-slate-800 border-b border-slate-800 bg-[#070b12] text-center py-2.5 px-4 text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Audit Events</span>
                <span className="text-sm font-bold font-mono text-slate-200">
                  {auditModal.stats?.totalActions ?? auditModal.logs.length}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Assets Handled</span>
                <span className="text-sm font-bold font-mono text-blue-400">
                  {auditModal.stats?.assetsAssigned ?? 0}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Profile Modifications</span>
                <span className="text-sm font-bold font-mono text-emerald-400">
                  {auditModal.stats?.profileUpdates ?? 0}
                </span>
              </div>
            </div>

            {/* Activity Timeline List */}
            <div className="p-5 overflow-y-auto space-y-3 flex-1 text-xs">
              {auditModal.loading ? (
                <div className="py-16 text-center">
                  <Loader2 className="w-7 h-7 animate-spin text-blue-500 mx-auto mb-2" />
                  <p className="text-slate-400 text-xs font-medium">Fetching employee activity timeline...</p>
                </div>
              ) : auditModal.logs.length === 0 ? (
                <div className="py-12 text-center text-slate-500">
                  <History className="w-10 h-10 text-slate-700 mx-auto mb-2" />
                  <p className="font-semibold text-slate-300">No activity logs recorded for this employee yet.</p>
                  <p className="text-[11px] text-slate-500 mt-1">Actions performed by or targeting this employee will appear here.</p>
                </div>
              ) : (
                auditModal.logs.map((log) => {
                  const d = new Date(log.createdAt);
                  const slt = d.toLocaleString('en-GB', {
                    timeZone: 'Asia/Colombo',
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true
                  });

                  return (
                    <div 
                      key={log.id} 
                      className="p-3.5 rounded-xl bg-[#070b12] border border-slate-800/80 hover:border-slate-700 transition-colors space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            log.action === 'CREATE' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                            log.action === 'UPDATE' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                            log.action === 'ASSIGN' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' :
                            log.action === 'RETURN' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                            'bg-slate-800 text-slate-300 border-slate-700'
                          }`}>
                            {log.action}
                          </span>
                          <span className="text-[10px] font-bold text-slate-500 uppercase">{log.module}</span>
                        </div>
                        <span className="font-mono text-[11px] text-slate-400">{slt}</span>
                      </div>

                      <p className="text-slate-200 text-xs leading-relaxed">{log.description}</p>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800/50 text-[10px] text-slate-400">
                        <div className="flex items-center gap-2">
                          <span>Operator: <strong className="text-slate-300">{log.userName || 'System'}</strong></span>
                          <span>•</span>
                          <span>IP: <strong className="font-mono text-slate-400">{log.ipAddress || 'Internal'}</strong></span>
                        </div>

                        {/* Bidirectional Asset Link */}
                        {(log.entityCode?.startsWith('AST') || log.entityType === 'ASSET') && (
                          <button
                            onClick={() => {
                              setAuditModal({ open: false, employee: null, logs: [], loading: false, stats: null });
                              navigate(`/assets/${log.entityId || log.entityCode}`);
                            }}
                            className="inline-flex items-center gap-1 font-mono text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 px-2 py-0.5 rounded transition-colors"
                          >
                            <Tag className="w-3 h-3 text-blue-400" />
                            <span>Inspect Asset {log.entityCode || log.entityId}</span>
                            <ArrowRight className="w-3 h-3 ml-0.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="p-3.5 border-t border-slate-800 bg-[#0a0f1a] flex justify-end">
              <button 
                onClick={() => setAuditModal({ open: false, employee: null, logs: [], loading: false, stats: null })}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition-colors"
              >
                Close History
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
