import { useState, useEffect } from 'react';
import { Search, Plus, Mail, Loader2, AlertCircle, Edit, Trash2, X, Phone, Briefcase, MapPin, MonitorSmartphone, ExternalLink } from 'lucide-react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';

const _rawApi = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const API_URL = _rawApi.endsWith('/api') ? _rawApi : `${_rawApi.replace(/\/$/, '')}/api`;

export default function Employees() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const navigate = useNavigate();
  
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [locations, setLocations] = useState([]);
  const [assets, setAssets] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchParams] = useSearchParams();
  const [locationFilter, setLocationFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');

  // Asset picker modal state
  const [assetPickerModal, setAssetPickerModal] = useState({ open: false, empName: '', assets: [] });

  const canCreateEdit = user?.role === 'ADMIN' || user?.role === 'IT_OFFICER';
  const canDelete = user?.role === 'ADMIN';

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmp, setEditingEmp] = useState(null);
  const [formData, setFormData] = useState({
    employeeCode: '',
    fullName: '',
    email: '',
    designation: '',
    phone: '',
    departmentId: '',
    locationId: '',
    status: 'ACTIVE'
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

    if (locId) setLocationFilter(locId);
    if (deptId) setDepartmentFilter(deptId);
  }, [searchParams]);

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
        status: emp.status || 'ACTIVE'
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
        status: 'ACTIVE'
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingEmp(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
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
          email: formData.email.trim() === '' ? null : formData.email,
          phone: formData.phone.trim() === '' ? null : formData.phone
        })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to save employee');
      }

      await fetchData();
      showToast('Employee successfully saved to registry.', 'success');
      closeModal();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleDelete = async (id) => {
    const confirmed = await confirm({
      title: 'Delete Employee',
      message: 'Are you sure you want to permanently delete this employee?',
      confirmText: 'Delete Employee'
    });
    if (!confirmed) return;
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
      setAssetPickerModal({ open: true, empName: emp.fullName, assets: assigned });
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
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Employees</h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">Manage employee records and view their assigned assets.</p>
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

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Search by name, email, or exact code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-xl focus:ring-2 focus:ring-blue-500 block pl-10 p-2.5 outline-none transition-all"
            />
          </div>
          <div className="flex gap-4">
            <select value={departmentFilter} onChange={e => setDepartmentFilter(e.target.value)} className="bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-xl outline-none px-4 py-2 focus:ring-2 focus:ring-blue-500 min-w-[150px]">
              <option value="">All Departments</option>
              {departments.map(dept => <option key={dept.id} value={dept.id}>{dept.name}</option>)}
            </select>
            <select value={locationFilter} onChange={e => setLocationFilter(e.target.value)} className="bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-xl outline-none px-4 py-2 focus:ring-2 focus:ring-blue-500 min-w-[150px]">
              <option value="">All Locations</option>
              {locations.map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-500 font-medium whitespace-nowrap">
              <tr>
                <th className="px-5 py-4">Employee</th>
                <th className="px-5 py-4">Department & Role</th>
                <th className="px-5 py-4">Base Location</th>
                <th className="px-5 py-4 text-center">Status</th>
                <th className="px-5 py-4 text-center">Assigned Assets</th>
                <th className="px-5 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
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
                  <tr key={emp.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-800 dark:text-white">{emp.fullName}</span>
                        <span className="text-xs font-mono text-slate-500 mt-1">{emp.employeeCode}</span>
                        {emp.email && <span className="text-xs text-slate-500 flex items-center gap-1 mt-0.5"><Mail className="w-3 h-3"/> {emp.email}</span>}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-slate-800 dark:text-white font-medium">{dept?.name || 'Unassigned'}</p>
                      <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5"><Briefcase className="w-3 h-3"/> {emp.designation}</p>
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-1"><MapPin className="w-4 h-4 text-slate-400"/> {loc?.name || 'Unassigned'}</span>
                    </td>
                    <td className="px-5 py-4 text-center">
                       <span className={`px-2.5 py-1 rounded-full text-[10px] uppercase font-bold tracking-wider ${
                          emp.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'
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
                            onClick={() => handleAssetBadgeClick(emp)}
                            title={count === 0 ? 'No assets assigned' : `View ${count} assigned asset${count > 1 ? 's' : ''}`}
                            className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-xs shadow-sm border transition-all duration-200
                              ${count === 0
                                ? 'bg-slate-50 border-slate-200 text-slate-400 cursor-default hover:bg-slate-100'
                                : 'bg-blue-50 border-blue-100 text-blue-700 cursor-pointer hover:bg-blue-600 hover:text-white hover:border-blue-600 hover:scale-110'
                              }`}
                          >
                            {count}
                          </button>
                        );
                      })()}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {canCreateEdit && (
                          <button onClick={() => openModal(emp)} className="p-1.5 text-slate-400 hover:text-blue-600 rounded-md hover:bg-slate-100 transition-colors" title="Edit Employee">
                            <Edit className="w-4 h-4" />
                          </button>
                        )}
                        {canDelete && (
                          <button onClick={() => handleDelete(emp.id)} className="p-1.5 text-slate-400 hover:text-red-600 rounded-md hover:bg-red-50 transition-colors" title="Delete Employee">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                        {!canCreateEdit && <span className="text-xs text-slate-400">View Only</span>}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-xl my-8 relative">
            <div className="sticky top-0 bg-white z-10 flex justify-between items-center p-5 border-b border-slate-100 rounded-t-2xl">
              <h3 className="font-bold text-lg text-slate-800 dark:text-white">{editingEmp ? 'Edit' : 'Add'} Employee</h3>
              <button type="button" onClick={closeModal} className="text-slate-400 hover:text-slate-600 rounded-lg p-1 hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Employee Code *</label>
                  <input 
                    required type="text" value={formData.employeeCode} onChange={e => setFormData({...formData, employeeCode: e.target.value})}
                    placeholder="e.g. EMP-2023-01"
                    className="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 p-2.5 outline-none transition-all placeholder:text-slate-400"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Full Name *</label>
                  <input 
                    required type="text" value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})}
                    placeholder="John Doe"
                    className="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 p-2.5 outline-none transition-all placeholder:text-slate-400"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input 
                      type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})}
                      placeholder="john.doe@euromotors.com"
                      className="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 pl-9 p-2.5 outline-none transition-all placeholder:text-slate-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number</label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input 
                      type="tel" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})}
                      placeholder="+1 (555) 000-0000"
                      className="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 pl-9 p-2.5 outline-none transition-all placeholder:text-slate-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Designation *</label>
                  <input 
                    required type="text" value={formData.designation} onChange={e => setFormData({...formData, designation: e.target.value})}
                    placeholder="e.g. Senior Developer"
                    className="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 p-2.5 outline-none transition-all placeholder:text-slate-400"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                  <select 
                    value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 p-2.5 outline-none transition-all"
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive / Former</option>
                  </select>
                </div>

                <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-5 pt-4 border-t border-slate-100">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Department assignment *</label>
                    <select 
                      required value={formData.departmentId} onChange={e => setFormData({...formData, departmentId: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 p-2.5 outline-none transition-all"
                    >
                      <option value="" disabled>Select Department...</option>
                      {departments.map(dept => (
                        <option key={dept.id} value={dept.id}>{dept.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Base Location *</label>
                    <select 
                      required value={formData.locationId} onChange={e => setFormData({...formData, locationId: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 p-2.5 outline-none transition-all"
                    >
                      <option value="" disabled>Select Location...</option>
                      {locations.map(loc => (
                        <option key={loc.id} value={loc.id}>{loc.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="pt-8 flex justify-end gap-3 flex-wrap">
                <button type="button" onClick={closeModal} className="px-5 py-2.5 font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50">Cancel</button>
                <button type="submit" className="px-5 py-2.5 font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 shadow-sm shadow-blue-600/20">{editingEmp ? 'Save Employee Profile' : 'Register Employee'}</button>
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
            className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50">
              <div>
                <h3 className="font-bold text-slate-800 dark:text-white text-sm">Assigned Assets</h3>
                <p className="text-xs text-slate-500 mt-0.5">{assetPickerModal.empName} · {assetPickerModal.assets.length} assets</p>
              </div>
              <button
                onClick={() => setAssetPickerModal({ open: false, empName: '', assets: [] })}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Asset List */}
            <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
              {assetPickerModal.assets.map(asset => (
                <button
                  key={asset.id}
                  onClick={() => {
                    setAssetPickerModal({ open: false, empName: '', assets: [] });
                    navigate(`/assets/${asset.assetCode}`);
                  }}
                  className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-blue-50 transition-colors text-left group"
                >
                  <div className="p-2 bg-slate-100 group-hover:bg-blue-100 rounded-xl transition-colors shrink-0">
                    <MonitorSmartphone className="w-4 h-4 text-slate-500 group-hover:text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-800 dark:text-white text-xs uppercase tracking-wide">{asset.assetCode}</p>
                    <p className="text-xs text-slate-500 truncate">{asset.deviceType} · {asset.model}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider
                      ${asset.status === 'ASSIGNED' ? 'bg-blue-100 text-blue-700'
                        : asset.status === 'AVAILABLE' ? 'bg-green-100 text-green-700'
                        : asset.status === 'UNDER_REPAIR' ? 'bg-orange-100 text-orange-700'
                        : 'bg-slate-100 text-slate-600'}`}
                    >
                      {asset.status}
                    </span>
                    <ExternalLink className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-500 transition-colors" />
                  </div>
                </button>
              ))}
            </div>

            <div className="px-5 py-3 bg-slate-50 border-t border-slate-100">
              <p className="text-[10px] text-slate-400 text-center">Click an asset to open its profile</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
