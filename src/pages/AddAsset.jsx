import { useState, useEffect, useRef } from 'react';
import { Save, QrCode, ArrowLeft, Loader2, AlertCircle, X, ShieldAlert, Cpu } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import CreatableSelect from '../components/CreatableSelect';
import {
  STANDARD_DEVICE_TYPES,
  STANDARD_BRANDS,
  STANDARD_CONDITIONS,
  STANDARD_WARRANTY_STATUSES,
  STANDARD_PROCESSORS,
  STANDARD_RAM_OPTIONS,
  STANDARD_STORAGE_OPTIONS,
  STANDARD_OS_OPTIONS,
  REQUIRES_MODEL_TYPES,
  isPeripheralDevice,
  isValidMacAddress,
  isValidIpv4
} from '../constants/assetOptions';

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
        className="w-full bg-white dark:bg-[#0c1322] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 outline-none focus-within:ring-2 focus-within:ring-teal-500 flex items-center justify-between cursor-pointer"
        onClick={() => setIsOpen(true)}
      >
        <div className="flex-1">
          {isOpen ? (
            <input 
              autoFocus
              type="text" 
              className="w-full outline-none bg-transparent text-slate-800 dark:text-slate-200" 
              placeholder="Search by name, ID, email..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          ) : (
            <div className={`text-sm ${value ? 'text-slate-800 dark:text-slate-200 font-medium' : 'text-slate-500'}`}>
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
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-[#0c1322] border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg max-h-60 overflow-y-auto">
          <div 
            className="px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer text-sm text-slate-500"
            onClick={() => { onChange(''); setIsOpen(false); setSearch(''); }}
          >
            System Stock (No explicit user)
          </div>
          {filteredEmployees.map(emp => (
            <div 
              key={emp.id}
              className="px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer border-t border-slate-50 dark:border-slate-800"
              onClick={() => { onChange(emp.id); setIsOpen(false); setSearch(''); }}
            >
              <div className="font-medium text-sm text-slate-800 dark:text-slate-200">{emp.fullName}</div>
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
  const [savedAssetCode, setSavedAssetCode] = useState(null);
  const [isDirty, setIsDirty] = useState(false);
  const [showCustomBrand, setShowCustomBrand] = useState(false);

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
          fetch(`${API_URL}/employees?status=ACTIVE`, { headers }).then(r => r.json()),
          fetch(`${API_URL}/departments`, { headers }).then(r => r.json()),
          fetch(`${API_URL}/locations`, { headers }).then(r => r.json())
        ];

        // If editing, pull specific asset data directly by ID (much faster than fetching all)
        if (id) {
          fetchPromises.push(fetch(`${API_URL}/assets/${id}`, { headers }).then(r => r.json()));
        }

        const results = await Promise.all(fetchPromises);
        setEmployees(Array.isArray(results[0]) ? results[0] : []);
        setDepartments(Array.isArray(results[1]) ? results[1] : []);
        setLocations(Array.isArray(results[2]) ? results[2] : []);

        if (id) {
          const assets = results[3];
          // When fetching by /assets/:id, response is a single asset object
          const target = Array.isArray(assets) ? assets.find(a => a.id === id) : assets;
          if (target) {
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

            if (target.brand && !STANDARD_BRANDS.includes(target.brand)) {
              setShowCustomBrand(true);
            }
          }
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
    setIsDirty(true);
    setFormData(prev => {
      const newData = { ...prev, [field]: value };
      
      // Smart peripheral auto-handling
      if (field === 'deviceType') {
        if (isPeripheralDevice(value)) {
          newData.processor = 'N/A';
          newData.ram = 'N/A';
          newData.storage = 'N/A';
          newData.operatingSystem = 'N/A';
        } else if (isPeripheralDevice(prev.deviceType) && !isPeripheralDevice(value)) {
          if (newData.processor === 'N/A') newData.processor = '';
          if (newData.ram === 'N/A') newData.ram = '';
          if (newData.storage === 'N/A') newData.storage = '';
          if (newData.operatingSystem === 'N/A') newData.operatingSystem = '';
        }
      }

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

    // Strict client-side validation
    if (!formData.deviceType || !formData.deviceType.trim()) {
      setSubmitError('Device Type is mandatory. Please select a valid category from the list.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (REQUIRES_MODEL_TYPES.includes(formData.deviceType) && (!formData.model || !formData.model.trim())) {
      setSubmitError(`Hardware Model is mandatory for device category: ${formData.deviceType}`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (formData.macAddress && !isValidMacAddress(formData.macAddress)) {
      setSubmitError('Invalid MAC Address format. Example: 00:1B:44:11:3A:B7 or 00-1B-44-11-3A-B7');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (formData.ipAddress && !isValidIpv4(formData.ipAddress)) {
      setSubmitError('Invalid Static IP Address format. Example: 192.168.1.50');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      const url = id ? `${API_URL}/assets/${id}` : `${API_URL}/assets`;
      
      const payload = { ...formData };
      
      // Clean up empty strings wrapping to null for backend
      Object.keys(payload).forEach(k => {
        if (typeof payload[k] === 'string') payload[k] = payload[k].trim();
        if (payload[k] === '') payload[k] = null;
      });
      
      // Enforce date mapping structure for Prisma
      if (payload.warrantyExpiryDate) {
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
      
      if (!id) {
        // Scroll to top to show success or QR option
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        navigate(`/assets/code/${data.assetCode || formData.assetCode}`);
      }
    } catch (err) {
      if (err.message.includes('assetCode')) {
        setSubmitError('The Asset Code provided already exists in the system. Use a unique identifier.');
      } else if (err.message.includes('serialNumber')) {
        setSubmitError('The Serial Number provided overlaps with an existing secure asset. Hardware serial maps must be unique.');
      } else {
        setSubmitError(err.message);
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 flex-col items-center justify-center space-y-4">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
        <p className="text-slate-500 font-medium">Loading hardware registries...</p>
      </div>
    );
  }

  const isPeripheral = isPeripheralDevice(formData.deviceType);

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <div className="flex items-center gap-4">
        <Link to="/assets" className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-500">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">{id ? 'Edit System Asset' : 'Register New Asset'}</h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">{id ? 'Modify hardware state and deployment bindings.' : 'Standardized enterprise IT hardware registration.'}</p>
        </div>
      </div>

      {submitError && (
        <div className="bg-red-50 dark:bg-red-950/30 border-l-4 border-red-500 p-4 rounded-r-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
          <p className="text-red-700 dark:text-red-400 font-medium text-sm">{submitError}</p>
        </div>
      )}

      {savedAssetCode && (
        <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-green-800 dark:text-green-300">Asset Registered Successfully!</h3>
            <p className="text-sm text-green-700 dark:text-green-400 font-mono mt-0.5">Asset Code: {savedAssetCode}</p>
          </div>
          <div className="flex gap-2">
            <Link to={`/qr-code`} state={{ presetCode: savedAssetCode }} className="px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 transition flex items-center gap-2">
              <QrCode className="w-4 h-4" /> View / Print QR Profile
            </Link>
            <Link to={`/assets/code/${savedAssetCode}`} className="px-4 py-2 border border-green-600 text-green-700 dark:text-green-300 rounded-xl text-sm font-medium hover:bg-green-100 dark:hover:bg-green-900/40 transition">
              View Profile
            </Link>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-[#0c1322] rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden relative">
        <form className="p-6 space-y-8" onSubmit={handleSubmit}>
          
          {/* Core Identification */}
          <div className="bg-slate-50/70 dark:bg-[#080d18] p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800/80">
            <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-5 flex items-center gap-2">
              <div className="w-2 h-6 bg-blue-600 rounded-full"></div> Core Identification
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Asset Code</label>
                <input 
                  type="text" 
                  value={formData.assetCode} 
                  readOnly 
                  className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 rounded-xl px-4 py-2.5 outline-none font-mono text-sm cursor-not-allowed" 
                  placeholder="Auto-generated upon save" 
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Serial Number *</label>
                <input 
                  required 
                  type="text" 
                  value={formData.serialNumber} 
                  onChange={e => handleChange('serialNumber', e.target.value)} 
                  className="w-full bg-white dark:bg-[#0c1322] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm uppercase placeholder:text-slate-400 dark:placeholder:text-slate-500" 
                  placeholder="e.g. 5CD234ABC1"
                />
              </div>

              {/* Standardized Device Type / Category */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Device Type / Category *</label>
                <CreatableSelect
                  field="deviceType"
                  defaults={STANDARD_DEVICE_TYPES}
                  value={formData.deviceType}
                  onChange={(val) => handleChange('deviceType', val)}
                  placeholder="Select or add device category..."
                  required
                />
              </div>

              {/* Standardized Brand / Manufacturer */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Brand / Manufacturer *</label>
                <CreatableSelect
                  field="brand"
                  defaults={STANDARD_BRANDS}
                  value={formData.brand}
                  onChange={(val) => handleChange('brand', val)}
                  placeholder="Select or add brand..."
                  required
                />
              </div>

              {/* Hardware Model */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Hardware Model {REQUIRES_MODEL_TYPES.includes(formData.deviceType) ? '*' : '(Optional)'}
                </label>
                <CreatableSelect
                  field="model"
                  defaults={[
                    'Latitude 5420',
                    'Latitude 5520',
                    'ThinkPad T14 Gen 3',
                    'ThinkPad X1 Carbon',
                    'EliteBook 840 G8',
                    'ProBook 450 G9',
                    'MacBook Pro 14"',
                    'MacBook Air M2',
                    'OptiPlex 7090',
                    'Vivobook X1504VA',
                    'LaserJet Pro M404n',
                    'Standard / Optical',
                    'N/A'
                  ]}
                  value={formData.model}
                  onChange={(val) => handleChange('model', val)}
                  placeholder={REQUIRES_MODEL_TYPES.includes(formData.deviceType) ? "Select or add model (e.g. Latitude 5420)..." : "Select or add model..."}
                  required={REQUIRES_MODEL_TYPES.includes(formData.deviceType)}
                />
              </div>

              {/* Standardized Physical Condition */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Physical Condition *</label>
                <select
                  required
                  value={formData.condition}
                  onChange={e => handleChange('condition', e.target.value)}
                  className="w-full bg-white dark:bg-[#0c1322] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 font-sans text-sm cursor-pointer"
                >
                  {STANDARD_CONDITIONS.map(cond => (
                    <option key={cond} value={cond}>{cond}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Internal Specifications */}
          <div className="bg-slate-50/70 dark:bg-[#080d18] p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800/80">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-5">
              <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <div className="w-2 h-6 bg-indigo-500 rounded-full"></div> Specifications
              </h2>
              {isPeripheral && (
                <span className="text-xs font-medium px-3 py-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 rounded-lg inline-flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  Peripheral device ({formData.deviceType}) — Specifications set to N/A
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Processor (CPU)</label>
                <CreatableSelect
                  field="processor"
                  defaults={STANDARD_PROCESSORS}
                  value={formData.processor || (isPeripheral ? 'N/A' : '')}
                  onChange={(val) => handleChange('processor', val)}
                  placeholder="Select or add CPU..."
                  disabled={isPeripheral}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">System Memory (RAM)</label>
                <CreatableSelect
                  field="ram"
                  defaults={STANDARD_RAM_OPTIONS}
                  value={formData.ram || (isPeripheral ? 'N/A' : '')}
                  onChange={(val) => handleChange('ram', val)}
                  placeholder="Select or add RAM..."
                  disabled={isPeripheral}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Storage Array</label>
                <CreatableSelect
                  field="storage"
                  defaults={STANDARD_STORAGE_OPTIONS}
                  value={formData.storage || (isPeripheral ? 'N/A' : '')}
                  onChange={(val) => handleChange('storage', val)}
                  placeholder="Select or add Storage..."
                  disabled={isPeripheral}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Operating OS</label>
                <CreatableSelect
                  field="operatingSystem"
                  defaults={STANDARD_OS_OPTIONS}
                  value={formData.operatingSystem || (isPeripheral ? 'N/A' : '')}
                  onChange={(val) => handleChange('operatingSystem', val)}
                  placeholder="Select or add OS..."
                  disabled={isPeripheral}
                />
              </div>
            </div>
          </div>

          {/* Allocation Bindings */}
          <div className="bg-slate-50/70 dark:bg-[#080d18] p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800/80">
            <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-5 flex items-center gap-2">
              <div className="w-2 h-6 bg-teal-500 rounded-full"></div> Allocation & Deployment Bindings
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Assignment Type</label>
                <select 
                  value={formData.assignmentType} 
                  onChange={e => handleChange('assignmentType', e.target.value)} 
                  className="w-full bg-white dark:bg-[#0c1322] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-teal-500 font-sans text-sm cursor-pointer"
                >
                   <option value="EMPLOYEE">Employee Asset</option>
                   <option value="DEPARTMENT">Department Asset</option>
                   <option value="LOCATION">Location Asset</option>
                   <option value="SHARED">Shared Asset</option>
                   <option value="STORE">Store Asset</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Current Status</label>
                <select 
                  value={formData.status} 
                  onChange={e => handleChange('status', e.target.value)} 
                  className="w-full bg-white dark:bg-[#0c1322] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-teal-500 font-sans text-sm cursor-pointer"
                >
                   <option value="AVAILABLE">Available</option>
                   <option value="ASSIGNED">Assigned</option>
                   <option value="UNDER_REPAIR">Under Repair</option>
                   <option value="RETIRED">Retired</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Base Location</label>
                <select 
                  value={formData.locationId} 
                  onChange={e => handleChange('locationId', e.target.value)} 
                  className="w-full bg-white dark:bg-[#0c1322] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-teal-500 font-sans text-sm cursor-pointer"
                >
                   <option value="">Unassigned Location</option>
                   {locations.map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Assigned Department</label>
                <select 
                  value={formData.departmentId} 
                  onChange={e => handleChange('departmentId', e.target.value)} 
                  className="w-full bg-white dark:bg-[#0c1322] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-teal-500 font-sans text-sm cursor-pointer"
                >
                   <option value="">Unaffiliated Dept</option>
                   {departments.map(dept => <option key={dept.id} value={dept.id}>{dept.name}</option>)}
                </select>
              </div>

              {formData.assignmentType === 'EMPLOYEE' && (
                <div className="md:col-span-2 transition-all">
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Direct Employee Allocation</label>
                  <EmployeeSearchDropdown
                    employees={employees}
                    value={formData.assignedEmployeeId}
                    onChange={(val) => handleChange('assignedEmployeeId', val)}
                  />
                </div>
              )}

            </div>
          </div>
          
          {/* IPAM Information with strict format validation */}
          <div className="bg-slate-50/70 dark:bg-[#080d18] p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800/80">
            <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-5 flex items-center gap-2">
              <div className="w-2 h-6 bg-purple-500 rounded-full"></div> IPAM & Network Identity
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">MAC Address</label>
                <input 
                  type="text" 
                  value={formData.macAddress} 
                  onChange={e => handleChange('macAddress', e.target.value)} 
                  className={`w-full bg-white dark:bg-[#0c1322] border ${formData.macAddress && !isValidMacAddress(formData.macAddress) ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 dark:border-slate-700 focus:ring-purple-500'} text-slate-900 dark:text-white rounded-xl px-4 py-2.5 outline-none focus:ring-2 font-mono text-sm uppercase placeholder:text-slate-400 dark:placeholder:text-slate-500`} 
                  placeholder="e.g. 00:1B:44:11:3A:B7" 
                />
                {formData.macAddress && !isValidMacAddress(formData.macAddress) ? (
                  <p className="text-xs text-red-500 mt-1 font-medium">Invalid MAC format. Standard format: XX:XX:XX:XX:XX:XX or XX-XX-XX-XX-XX-XX</p>
                ) : (
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Optional. Standard format: 00:1B:44:11:3A:B7</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Static IP Address</label>
                <input 
                  type="text" 
                  value={formData.ipAddress} 
                  onChange={e => handleChange('ipAddress', e.target.value)} 
                  className={`w-full bg-white dark:bg-[#0c1322] border ${formData.ipAddress && !isValidIpv4(formData.ipAddress) ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 dark:border-slate-700 focus:ring-purple-500'} text-slate-900 dark:text-white rounded-xl px-4 py-2.5 outline-none focus:ring-2 font-mono text-sm placeholder:text-slate-400 dark:placeholder:text-slate-500`} 
                  placeholder="e.g. 192.168.1.50" 
                />
                {formData.ipAddress && !isValidIpv4(formData.ipAddress) ? (
                  <p className="text-xs text-red-500 mt-1 font-medium">Invalid IPv4 address format (e.g. 192.168.1.50)</p>
                ) : (
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Optional. Standard IPv4 format: 0.0.0.0 to 255.255.255.255</p>
                )}
              </div>
            </div>
          </div>

          {/* Warranty Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6">
             <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Warranty Term Validity *</label>
                <select
                  required
                  value={formData.warrantyStatus}
                  onChange={e => handleChange('warrantyStatus', e.target.value)}
                  className="w-full bg-white dark:bg-[#0c1322] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-slate-500 font-sans text-sm cursor-pointer"
                >
                  {STANDARD_WARRANTY_STATUSES.map(ws => (
                    <option key={ws} value={ws}>{ws}</option>
                  ))}
                </select>
             </div>

             <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Warranty End Date</label>
                <input 
                  type="date" 
                  value={formData.warrantyExpiryDate} 
                  onChange={e => handleChange('warrantyExpiryDate', e.target.value)} 
                  className="w-full bg-white dark:bg-[#0c1322] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-slate-500 font-sans text-sm" 
                />
             </div>
          </div>

          {/* Form Actions */}
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-6 border-t border-slate-100 dark:border-slate-800 mt-8">
            <Link to="/assets" className="px-6 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-center shadow-sm">
              Cancel
            </Link>

            <button type="submit" className="px-8 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 shadow-sm shadow-blue-600/20">
              <Save className="w-4 h-4" />
              {id ? 'Update Hardware Registry' : 'Save & Register Asset'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
