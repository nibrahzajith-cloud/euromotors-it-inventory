import { useState, useEffect, useRef } from 'react';
import { Save, QrCode, ArrowLeft, Loader2, AlertCircle, X } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import DynamicSelect from '../components/DynamicSelect';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';

const _rawApi = import.meta.env.VITE_API_URL || '/api';
const API_URL = _rawApi.endsWith('/api') ? _rawApi : `${_rawApi.replace(/\/$/, '')}/api`;

const EmployeeSearchDropdown = ({ employees, value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef(null);

  const selectedEmp = employees.find(e => e.id === value);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredEmployees = employees.filter(emp => {
    const q = search.toLowerCase();
    return (
      (emp.fullName || '').toLowerCase().includes(q) ||
      (emp.employeeCode || '').toLowerCase().includes(q) ||
      (emp.email || '').toLowerCase().includes(q) ||
      (emp.department?.name || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <div 
        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus-within:ring-2 focus-within:ring-teal-500 flex items-center justify-between cursor-pointer"
        onClick={() => setIsOpen(true)}
      >
        <div className="flex-1">
          {isOpen ? (
            <input 
              autoFocus
              type="text" 
              className="w-full outline-none bg-transparent" 
              placeholder="Search by name, ID, email..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          ) : (
            <div className={`text-sm ${value ? 'text-slate-800' : 'text-slate-500'}`}>
              {selectedEmp ? `${selectedEmp.employeeCode} - ${selectedEmp.fullName}` : 'System Stock (No explicit user)'}
            </div>
          )}
        </div>
        {value && !isOpen && (
          <button 
            type="button" 
            className="text-slate-400 hover:text-red-500 px-2"
            onClick={(e) => { e.stopPropagation(); onChange(''); }}
          >
            <X className="w-4 h-4" />
          </button>
        )}
        <div className="text-slate-400 pointer-events-none text-xs">▼</div>
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
          <div 
            className="px-4 py-2 hover:bg-slate-50 cursor-pointer text-sm text-slate-500"
            onClick={() => { onChange(''); setIsOpen(false); setSearch(''); }}
          >
            System Stock (No explicit user)
          </div>
          {filteredEmployees.map(emp => (
            <div 
              key={emp.id}
              className="px-4 py-2 hover:bg-slate-50 cursor-pointer border-t border-slate-50"
              onClick={() => { onChange(emp.id); setIsOpen(false); setSearch(''); }}
            >
              <div className="font-medium text-sm text-slate-800">{emp.fullName}</div>
              <div className="text-xs text-slate-500">{emp.employeeCode} {emp.department?.name ? `• ${emp.department.name}` : ''} {emp.email ? `• ${emp.email}` : ''}</div>
            </div>
          ))}
          {filteredEmployees.length === 0 && (
            <div className="px-4 py-3 text-sm text-slate-500 text-center">No employees found</div>
          )}
        </div>
      )}
    </div>
  );
};

export default function AddAsset() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [locations, setLocations] = useState([]);

  const [loading, setLoading] = useState(true);
  const [submitError, setSubmitError] = useState('');
  const [uidSuccess, setUidSuccess] = useState(false);
  const [savedAssetCode, setSavedAssetCode] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    assetCode: '',
    deviceType: '',
    brand: '',
    model: '',
    serialNumber: '',
    condition: 'New',
    processor: '',
    ram: '',
    storage: '',
    operatingSystem: '',
    vendor: '',
    warrantyStatus: 'Active',
    warrantyExpiryDate: '',
    status: 'AVAILABLE',
    locationId: '',
    departmentId: '',
    assignedEmployeeId: '',
    assignmentType: 'EMPLOYEE',
    remarks: '',
    macAddress: '',
    ipAddress: ''
  });

  useEffect(() => {
    const initForm = async () => {
      try {
        const token = localStorage.getItem('token');
        const headers = { 'Authorization': `Bearer ${token}` };

        const fetchPromises = [
          fetch(`${API_URL}/employees`, { headers }).then(r => r.json()),
          fetch(`${API_URL}/departments`, { headers }).then(r => r.json()),
          fetch(`${API_URL}/locations`, { headers }).then(r => r.json())
        ];

        // If editing, pull specific asset data
        if (id) {
          fetchPromises.push(fetch(`${API_URL}/assets`, { headers }).then(r => r.json()));
        }

        const results = await Promise.all(fetchPromises);
        setEmployees(results[0]);
        setDepartments(results[1]);
        setLocations(results[2]);

        if (id) {
          // Find logic since backend findMany() array returned
          const assets = results[3];
          const target = assets.find(a => a.id === id);
          if(target) {
             setFormData({
               assetCode: target.assetCode || '',
               deviceType: target.deviceType || '',
               brand: target.brand || '',
               model: target.model || '',
               serialNumber: target.serialNumber || '',
               condition: target.condition || 'New',
               processor: target.processor || '',
               ram: target.ram || '',
               storage: target.storage || '',
               operatingSystem: target.operatingSystem || '',
               vendor: target.vendor || '',
               warrantyStatus: target.warrantyStatus || 'Active',
               warrantyExpiryDate: target.warrantyExpiryDate ? target.warrantyExpiryDate.split('T')[0] : '',
               status: target.status || 'AVAILABLE',
               assignmentType: target.assignmentType || 'EMPLOYEE',
               locationId: target.locationId || '',
               departmentId: target.departmentId || '',
               assignedEmployeeId: target.assignedEmployeeId || '',
               remarks: target.remarks || '',
               macAddress: target.macAddress || '',
               ipAddress: target.ipAddress || ''
             });
          }
        } else {
           setFormData(prev => ({
             ...prev,
             assetCode: ''
           }));
        }
      } catch (err) {
         setSubmitError("Failed to initialize remote registries.");
      } finally {
        setLoading(false);
      }
    };
    initForm();
  }, [id]);

  const handleChange = (field, value) => {
    setFormData(prev => {
      const newData = { ...prev, [field]: value };
      
      // Auto-update status when assigning an employee or department
      if ((field === 'assignedEmployeeId' || field === 'departmentId' || field === 'locationId') && value) {
         if (newData.status === 'AVAILABLE' && newData.assignmentType !== 'STORE') {
            newData.status = 'ASSIGNED';
         }
      }
      // If assignment type changes to STORE, set status back to AVAILABLE
      if (field === 'assignmentType' && value === 'STORE') {
         if (newData.status === 'ASSIGNED') {
            newData.status = 'AVAILABLE';
         }
      }

      return newData;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');
    
    try {
      const token = localStorage.getItem('token');
      const url = id ? `${API_URL}/assets/${id}` : `${API_URL}/assets`;
      
      const payload = { ...formData };
      
      // Clean up empty strings wrapping to null for backend
      Object.keys(payload).forEach(k => {
         if(typeof payload[k] === 'string') payload[k] = payload[k].trim();
         if(payload[k] === '') payload[k] = null;
      });
      
      // Enforce date mapping structure for Prisma
      if(payload.warrantyExpiryDate) {
         payload.warrantyExpiryDate = new Date(payload.warrantyExpiryDate).toISOString();
      }

      const res = await fetch(url, {
        method: id ? 'PUT' : 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to sync asset payload');
      }

      setSubmitError('');
      setSavedAssetCode(data.assetCode);
      showToast('Asset Saved Successfully!', 'success');
    } catch (err) {
       // Look for unique constraint violations mapping out of Prisma
       if(err.message.includes('assetCode')) {
          setSubmitError('The Asset Code provided already exists in the system. Use a unique identifier.');
       } else if(err.message.includes('serialNumber')) {
          setSubmitError('The Serial Number provided overlaps with an existing secure asset. Hardware serial maps must be unique.');
       } else {
          setSubmitError(err.message);
       }
       window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleGenerateUID = async () => {
    if (formData.assetCode?.trim().length > 0) {
      const confirmed = await confirm({ 
        title: "Confirm Overwrite", 
        message: "Are you sure you want to overwrite the existing Asset Code?",
        confirmText: "Overwrite"
      });
      if(!confirmed) return;
    }
    
    let prefix = 'OTH';
    const type = formData.deviceType?.toLowerCase() || '';
    if (type.includes('laptop')) prefix = 'LAP';
    else if (type.includes('desktop')) prefix = 'DES';
    else if (type.includes('printer')) prefix = 'PRN';
    else if (type.includes('monitor')) prefix = 'MON';
    else if (type.includes('ups')) prefix = 'UPS';
    else if (type.includes('mobile') || type.includes('phone')) prefix = 'MOB';
    else if (type.includes('tablet')) prefix = 'TAB';
    
    const randomSuffix = Math.floor(Math.random() * 9000 + 1000);
    handleChange('assetCode', `EM-IT-${prefix}-${randomSuffix}`);
    setUidSuccess(true);
    setTimeout(() => setUidSuccess(false), 2500);
  };

  if (loading) {
    return (
      <div className="flex h-64 flex-col items-center justify-center space-y-4">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
        <p className="text-slate-500 font-medium">Hydrating Edit Matrix Forms...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <div className="flex items-center gap-4">
        <Link to="/assets" className="p-2 hover:bg-slate-200 rounded-lg transition-colors text-slate-500">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">{id ? 'Edit System Asset' : 'Register New Asset'}</h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">{id ? 'Modify hardware state and deployment bindings.' : 'Enter the complete hardware identifiers and system allocations.'}</p>
        </div>
      </div>

      {submitError && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
          <p className="text-red-700 font-medium">{submitError}</p>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden relative">
        <form className="p-6 space-y-8" onSubmit={handleSubmit}>
          
          {/* Basic Information */}
          <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100">
            <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-5 flex items-center gap-2">
              <div className="w-2 h-6 bg-blue-600 rounded-full"></div> Core Identification
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Asset Code</label>
                <input type="text" value={formData.assetCode} readOnly className="w-full bg-slate-100 border border-slate-200 text-slate-500 rounded-xl px-4 py-2.5 outline-none font-mono text-sm cursor-not-allowed" placeholder="Auto-generated upon save" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Serial Number *</label>
                <input required type="text" value={formData.serialNumber} onChange={e => handleChange('serialNumber', e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm uppercase" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Device Type *</label>
                <DynamicSelect value={formData.deviceType} onChange={v => handleChange('deviceType', v)} optionsKey="deviceTypes" defaultOptions={['Laptop', 'Desktop', 'Monitor', 'Mobile Phone', 'Tablet', 'Printer']} placeholder="Device category..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Brand/Vendor</label>
                <input type="text" value={formData.brand} onChange={e => handleChange('brand', e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. Dell" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Hardware Model *</label>
                <input required type="text" value={formData.model} onChange={e => handleChange('model', e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. Latitude 5420" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Physical Condition *</label>
                <DynamicSelect value={formData.condition} onChange={v => handleChange('condition', v)} optionsKey="conditions" defaultOptions={['New', 'Good', 'Fair', 'Poor']} placeholder="Condition..." />
              </div>
            </div>
          </div>

          {/* Internal Specifications */}
          <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100">
            <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-5 flex items-center gap-2">
              <div className="w-2 h-6 bg-indigo-500 rounded-full"></div> Specifications
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Processor (CPU)</label>
                <input type="text" value={formData.processor} onChange={e => handleChange('processor', e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500" placeholder="e.g. Intel i7" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">System Memory</label>
                <input type="text" value={formData.ram} onChange={e => handleChange('ram', e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500" placeholder="e.g. 16GB Array" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Storage Array</label>
                <input type="text" value={formData.storage} onChange={e => handleChange('storage', e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500" placeholder="e.g. 512GB NVMe" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Operating OS</label>
                <input type="text" value={formData.operatingSystem} onChange={e => handleChange('operatingSystem', e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500" placeholder="e.g. Win 11 Pro" />
              </div>
            </div>
          </div>

          {/* Allocation Bindings */}
          <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100">
            <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-5 flex items-center gap-2">
              <div className="w-2 h-6 bg-teal-500 rounded-full"></div> Network Bindings & Registration
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Assignment Type</label>
                <select value={formData.assignmentType} onChange={e => handleChange('assignmentType', e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-teal-500">
                   <option value="EMPLOYEE">Employee Asset</option>
                   <option value="DEPARTMENT">Department Asset</option>
                   <option value="LOCATION">Location Asset</option>
                   <option value="SHARED">Shared Asset</option>
                   <option value="STORE">Store Asset</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Current Status</label>
                <select value={formData.status} onChange={e => handleChange('status', e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-teal-500">
                   <option value="AVAILABLE">Available</option>
                   <option value="ASSIGNED">Assigned</option>
                   <option value="UNDER_REPAIR">Under Repair</option>
                   <option value="RETIRED">Retired</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Base Location</label>
                <select value={formData.locationId} onChange={e => handleChange('locationId', e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-teal-500">
                   <option value="">Unassigned Location</option>
                   {locations.map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Assigned Department</label>
                <select value={formData.departmentId} onChange={e => handleChange('departmentId', e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-teal-500">
                   <option value="">Unaffiliated Dept</option>
                   {departments.map(dept => <option key={dept.id} value={dept.id}>{dept.name}</option>)}
                </select>
              </div>

              {formData.assignmentType === 'EMPLOYEE' && (
                <div className="md:col-span-3 border-t border-slate-200 pt-5 mt-2 transition-all">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Direct Employee Allocation</label>
                  <EmployeeSearchDropdown
                    employees={employees}
                    value={formData.assignedEmployeeId}
                    onChange={(val) => handleChange('assignedEmployeeId', val)}
                  />
                </div>
              )}

            </div>
          </div>
          
          {/* IPAM Information */}
          <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100">
            <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-5 flex items-center gap-2">
              <div className="w-2 h-6 bg-purple-500 rounded-full"></div> IPAM & Network Identity
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">MAC Address</label>
                <input type="text" value={formData.macAddress} onChange={e => handleChange('macAddress', e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-purple-500 font-mono text-sm uppercase" placeholder="e.g. 00:1B:44:11:3A:B7" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Static IP Address</label>
                <input type="text" value={formData.ipAddress} onChange={e => handleChange('ipAddress', e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-purple-500 font-mono text-sm" placeholder="e.g. 192.168.1.50" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6">
             <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Warranty Term Validity</label>
                <DynamicSelect value={formData.warrantyStatus} onChange={v => handleChange('warrantyStatus', v)} optionsKey="warrantyStatuses" defaultOptions={['Active', 'Expired', 'None', 'Extended']} placeholder="Status..." />
             </div>
             <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Warranty End Date</label>
                <input type="date" value={formData.warrantyExpiryDate} onChange={e => handleChange('warrantyExpiryDate', e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-slate-500 text-slate-700" />
             </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-6 border-t border-slate-100 mt-8">
            <Link to="/assets" className="px-6 py-2.5 border border-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-colors text-center shadow-sm">
              Dashboard
            </Link>
            
            {savedAssetCode && (
               <Link to={`/qr-code`} state={{ presetCode: savedAssetCode }} className="px-6 py-2.5 bg-green-50 text-green-700 border border-green-200 rounded-xl font-medium hover:bg-green-100 transition-colors flex items-center justify-center gap-2">
                 <QrCode className="w-4 h-4" />
                 View / Print QR Profile
               </Link>
            )}

            <button type="submit" className="px-8 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 shadow-sm shadow-blue-600/20">
              <Save className="w-4 h-4" />
              {id ? 'Update Setup' : 'Save & Register Asset'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
