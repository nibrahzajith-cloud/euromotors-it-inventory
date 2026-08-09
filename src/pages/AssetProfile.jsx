import { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import { 
  ArrowLeft, Printer, Download, MonitorSmartphone, Wrench, UserCheck, 
  CheckCircle2, Loader2, AlertCircle, History, Calendar, User, ArrowRight,
  Pencil, Save, X
} from 'lucide-react';
import QRCard from '../components/QRCard';
import { downloadQRCard } from '../utils/qrUtils';
import AssetImage from '../components/AssetMedia/AssetImage';
import AssetDocuments from '../components/AssetMedia/AssetDocuments';

const _rawApi = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const API_URL = _rawApi.endsWith('/api') ? _rawApi : `${_rawApi.replace(/\/$/, '')}/api`;

export default function AssetProfile() {
  const { id: assetCode } = useParams();
  const { showToast } = useToast();
  const [asset, setAsset] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('details');

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editData, setEditData] = useState({});
  const [locations, setLocations] = useState([]);
  const [departments, setDepartments] = useState([]);

  const fetchAssetProfile = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`\${API_URL}/assets/code/\${encodeURIComponent(assetCode)}`, {
        headers: { 'Authorization': `Bearer \${token}` }
      });
      
      if (!res.ok) {
         if (res.status === 404) throw new Error("Asset Code not found in database.");
         throw new Error("Failed fetching asset logic bounds.");
      }
      
      const data = await res.json();
      setAsset(data);

      // Fetch Timeline
      const timelineRes = await fetch(`\${API_URL}/assets/\${data.id}/timeline`, { headers: { 'Authorization': `Bearer \${token}` } });
      if (timelineRes.ok) setTimeline(await timelineRes.json());

      // Fetch locations & departments for dropdowns
      const [locRes, deptRes] = await Promise.all([
        fetch(`\${API_URL}/locations`, { headers: { 'Authorization': `Bearer \${token}` } }),
        fetch(`\${API_URL}/departments`, { headers: { 'Authorization': `Bearer \${token}` } })
      ]);
      if (locRes.ok) setLocations(await locRes.json());
      if (deptRes.ok) setDepartments(await deptRes.json());

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssetProfile();
  }, [assetCode]);

  const startEditing = () => {
    setEditData({
      deviceType: asset.deviceType || '',
      brand: asset.brand || '',
      model: asset.model || '',
      serialNumber: asset.serialNumber || '',
      processor: asset.processor || '',
      ram: asset.ram || '',
      storage: asset.storage || '',
      operatingSystem: asset.operatingSystem || '',
      vendor: asset.vendor || '',
      condition: asset.condition || '',
      warrantyStatus: asset.warrantyStatus || '',
      warrantyExpiryDate: asset.warrantyExpiryDate ? asset.warrantyExpiryDate.split('T')[0] : '',
      locationId: asset.locationId || '',
      departmentId: asset.departmentId || '',
      remarks: asset.remarks || '',
      macAddress: asset.macAddress || '',
      ipAddress: asset.ipAddress || '',
    });
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditData({});
  };

  const handleFieldChange = (field, value) => {
    setEditData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const payload = { ...editData };
      
      // Convert empty strings to null for optional fields
      Object.keys(payload).forEach(key => {
        if (payload[key] === '') payload[key] = null;
      });

      // Convert date string
      if (payload.warrantyExpiryDate) {
        payload.warrantyExpiryDate = new Date(payload.warrantyExpiryDate).toISOString();
      }

      const res = await fetch(`${API_URL}/assets/${asset.id}`, {
        method: 'PUT',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to update asset.');
      }

      // Re-fetch updated asset
      const updatedRes = await fetch(`${API_URL}/assets/code/${assetCode}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (updatedRes.ok) {
        setAsset(await updatedRes.json());
      }

      setIsEditing(false);
      showToast('Asset profile updated successfully.', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => window.print();
  
  const handleDownload = () => {
    const result = downloadQRCard(assetCode, "asset-profile-qr");
    if (result.success) {
       showToast('QR Code downloaded successfully.', 'success');
    } else {
       showToast(`PNG Error: ${result.error}`, 'error');
    }
  };

  // Reusable edit field renderer
  const EditableField = ({ label, field, type = 'text', options }) => {
    if (!isEditing) {
      let displayVal = asset[field] || '-';
      if (field === 'warrantyExpiryDate' && asset[field]) {
        displayVal = new Date(asset[field]).toLocaleDateString();
      }
      if (field === 'locationId') displayVal = asset.location?.name || 'Unassigned';
      if (field === 'departmentId') displayVal = asset.department?.name || 'Unassigned';
      return (
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{label}</p>
          <p className="font-medium text-slate-800 dark:text-slate-200">{displayVal}</p>
        </div>
      );
    }

    const inputClass = "w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-800 dark:text-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all";

    if (type === 'select' && options) {
      return (
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{label}</p>
          <select className={inputClass} value={editData[field] || ''} onChange={(e) => handleFieldChange(field, e.target.value)}>
            <option value="">-- Select --</option>
            {options.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      );
    }

    if (type === 'textarea') {
      return (
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{label}</p>
          <textarea className={`${inputClass} min-h-[80px] resize-none`} value={editData[field] || ''} onChange={(e) => handleFieldChange(field, e.target.value)} />
        </div>
      );
    }

    return (
      <div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{label}</p>
        <input type={type} className={inputClass} value={editData[field] || ''} onChange={(e) => handleFieldChange(field, e.target.value)} />
      </div>
    );
  };

  if (loading) return (
     <div className="flex h-96 flex-col items-center justify-center space-y-4">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
     </div>
  );

  if (error || !asset) return (
     <div className="flex flex-col h-[50vh] items-center justify-center p-8 bg-red-50 border border-red-100 rounded-3xl max-w-lg mx-auto mt-12">
        <AlertCircle className="h-14 w-14 text-red-500 mb-4" />
        <h2 className="text-xl font-bold text-red-600">Profile Not Found</h2>
        <p className="text-red-500 text-center mt-2 max-w-md">{error}</p>
        <Link to="/assets" className="mt-6 px-6 py-2 bg-red-600 text-white rounded-xl shadow-sm hover:bg-red-700 transition">
          Return to Ledger
        </Link>
     </div>
  );

  return (
    <>
      <div className="max-w-5xl mx-auto space-y-6 print:hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/assets" className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors text-slate-500">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Asset Profile</h1>
              <p className="text-slate-600 dark:text-slate-400 text-sm mt-1 font-mono uppercase">{asset.assetCode}</p>
            </div>
          </div>
          <div className="flex gap-3">
            {isEditing ? (
              <>
                <button onClick={cancelEditing} className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-medium flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm transition-colors">
                  <X className="w-4 h-4" /> Cancel
                </button>
                <button onClick={handleSave} disabled={saving} className="px-5 py-2 bg-blue-600 text-white rounded-xl font-medium flex items-center gap-2 hover:bg-blue-700 shadow-sm shadow-blue-600/20 transition-all disabled:opacity-60">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </>
            ) : (
              <button onClick={startEditing} className="px-4 py-2 bg-blue-600 text-white rounded-xl font-medium flex items-center gap-2 hover:bg-blue-700 shadow-sm shadow-blue-600/20 transition-all">
                <Pencil className="w-4 h-4" /> Edit Asset
              </button>
            )}
          </div>
        </div>

        {/* Edit Mode Banner */}
        {isEditing && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-4 flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/40 rounded-lg flex items-center justify-center">
              <Pencil className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-blue-800 dark:text-blue-300">Edit Mode Active</p>
              <p className="text-xs text-blue-600 dark:text-blue-400">Modify the fields below and click "Save Changes" to update the asset profile.</p>
            </div>
          </div>
        )}

        {/* Tab Switcher */}
        <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl w-fit">
          <button 
            onClick={() => setActiveTab('details')}
            className={`px-6 py-2 rounded-xl text-sm font-semibold transition-all ${activeTab === 'details' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
          >
            Asset Details
          </button>
          <button 
            onClick={() => setActiveTab('timeline')}
            className={`px-6 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${activeTab === 'timeline' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
          >
            <History className="w-4 h-4" />
            Asset Timeline
          </button>
        </div>

        {activeTab === 'details' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Left Column: QR and Quick Status */}
            <div className="space-y-6">
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-6 flex flex-col items-center text-center">
                <div className="mb-6 w-full">
                  <QRCard assetCode={assetCode} id="asset-profile-qr" size={130} />
                </div>
                <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">{asset.brand} {asset.model}</p>
                
                <div className="flex gap-2 mt-6 w-full">
                  <button onClick={handlePrint} className="flex-1 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors">
                    <Printer className="w-4 h-4" /> Print
                  </button>
                  <button onClick={handleDownload} className="flex-1 px-4 py-2 bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600 rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors">
                    <Download className="w-4 h-4" /> Download
                  </button>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-6">
                <h3 className="font-semibold text-slate-800 dark:text-white border-b border-slate-100 dark:border-slate-700 pb-3 mb-4">Current Status</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500 dark:text-slate-400">Status</span>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium border flex items-center gap-1 ${
                      asset.status === 'AVAILABLE' ? 'bg-green-100 text-green-700 border-green-200' :
                      asset.status === 'ASSIGNED' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                      'bg-orange-100 text-orange-700 border-orange-200'
                    }`}>
                      <CheckCircle2 className="w-3 h-3" />
                      {asset.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500 dark:text-slate-400">Condition</span>
                    {isEditing ? (
                      <select 
                        className="bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-800 dark:text-slate-200 rounded-lg px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-blue-500"
                        value={editData.condition || ''}
                        onChange={(e) => handleFieldChange('condition', e.target.value)}
                      >
                        {['New', 'Good', 'Fair', 'Poor', 'Damaged'].map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    ) : (
                      <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-full text-xs font-medium border border-slate-200 dark:border-slate-600">
                        {asset.condition}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between border-t border-slate-50 dark:border-slate-700 pt-4 mt-4">
                    <div className="flex flex-col">
                      <span className="text-xs text-slate-400 dark:text-slate-500 font-medium uppercase tracking-wider mb-1">Assigned To ({asset.assignmentType || 'EMPLOYEE'})</span>
                      <span className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        {(!asset.assignmentType || asset.assignmentType === 'EMPLOYEE') ? (asset.assignedEmployee?.fullName || 'Not Assigned') :
                         asset.assignmentType === 'DEPARTMENT' ? (asset.department?.name || 'Not Assigned') :
                         (asset.assignmentType === 'LOCATION' || asset.assignmentType === 'STORE') ? (asset.location?.name || 'Not Assigned') :
                         asset.assignmentType === 'SHARED' ? (asset.department?.name || asset.location?.name || 'Not Assigned') :
                         'Not Assigned'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Asset Details */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-6">
                <h3 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-700 pb-3 mb-4">
                  <MonitorSmartphone className="w-5 h-5 text-blue-600" />
                  Hardware Specifications
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
                  <EditableField label="Device Type" field="deviceType" />
                  <EditableField label="Brand" field="brand" />
                  <EditableField label="Model" field="model" />
                  <EditableField label="Serial Number" field="serialNumber" />
                  <EditableField label="Processor" field="processor" />
                  <EditableField label="Memory (RAM)" field="ram" />
                  <EditableField label="Storage" field="storage" />
                  <EditableField label="Operating System" field="operatingSystem" />
                  <EditableField label="Vendor" field="vendor" />
                  <EditableField label="MAC Address" field="macAddress" />
                  <EditableField label="IP Address" field="ipAddress" />
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-6">
                <h3 className="font-semibold text-slate-800 dark:text-white border-b border-slate-100 dark:border-slate-700 pb-3 mb-4">Lifecycle & Tracking</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
                  <EditableField label="Location" field="locationId" type="select" options={locations.map(l => ({ value: l.id, label: l.name }))} />
                  <EditableField label="Department" field="departmentId" type="select" options={departments.map(d => ({ value: d.id, label: d.name }))} />
                  <EditableField label="Warranty Status" field="warrantyStatus" type="select" options={[{ value: 'Active', label: 'Active' }, { value: 'Expired', label: 'Expired' }, { value: 'N/A', label: 'N/A' }]} />
                  <EditableField label="Warranty Expiry" field="warrantyExpiryDate" type="date" />
                  <div className="col-span-2 sm:col-span-3">
                    <EditableField label="Remarks" field="remarks" type={isEditing ? 'textarea' : 'text'} />
                    {!isEditing && !asset.remarks && (
                      <p className="text-sm text-slate-700 dark:text-slate-400 bg-slate-50 dark:bg-slate-700 p-3 rounded-xl border border-slate-100 dark:border-slate-600 mt-1">No remarks provided.</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Asset Image Card */}
              <AssetImage asset={asset} onUpdate={fetchAssetProfile} />

              {/* Asset Documents Card */}
              <AssetDocuments asset={asset} onUpdate={fetchAssetProfile} />
            </div>
          </div>
        ) : (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 max-w-3xl mx-auto w-full">
            <AssetTimeline timeline={timeline} />
          </div>
        )}
      </div>

      {/* Print only container */}
      <div className="hidden print:flex fixed inset-0 bg-white items-center justify-center z-[9999]">
         <div className="w-full flex justify-center">
            <QRCard assetCode={assetCode} id="asset-profile-qr-print" size={200} />
         </div>
      </div>
    </>
  );
}

function AssetTimeline({ timeline }) {
  if (!timeline || timeline.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-12 text-center">
        <div className="w-16 h-16 bg-slate-50 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
          <History className="w-8 h-8 text-slate-300 dark:text-slate-500" />
        </div>
        <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-1">No History Yet</h3>
        <p className="text-slate-500 dark:text-slate-400 text-sm">No lifecycle events have been recorded for this asset.</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
      <div className="p-6 border-b border-slate-100 dark:border-slate-700">
        <h3 className="font-bold text-slate-800 dark:text-white">Lifecycle History</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Chronological record of all actions performed on this asset.</p>
      </div>
      <div className="p-8">
        <div className="relative space-y-8 before:absolute before:inset-0 before:ml-5 before:h-full before:w-0.5 before:bg-slate-100 dark:before:bg-slate-700">
          {timeline.map((item) => (
            <div key={item.id} className="relative flex items-start gap-6 group">
              <div className={`absolute left-0 mt-1 w-10 h-10 rounded-full border-4 border-white dark:border-slate-800 shadow-sm flex items-center justify-center z-10 ${
                item.eventType === 'CREATED' ? 'bg-green-500' :
                item.eventType === 'ASSIGNED' ? 'bg-blue-600' :
                item.eventType === 'RETURNED' ? 'bg-indigo-500' :
                item.eventType.includes('MAINTENANCE') ? 'bg-orange-500' :
                'bg-slate-500'
              }`}>
                {item.eventType === 'CREATED' ? <CheckCircle2 className="w-5 h-5 text-white" /> :
                 item.eventType === 'ASSIGNED' ? <UserCheck className="w-5 h-5 text-white" /> :
                 item.eventType === 'RETURNED' ? <ArrowLeft className="w-5 h-5 text-white" /> :
                 <History className="w-5 h-5 text-white" />
                }
              </div>
              <div className="ml-12 flex-1">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-1 gap-1">
                  <h4 className="font-bold text-slate-800 dark:text-white">{item.title}</h4>
                  <span className="text-[10px] font-bold text-slate-400 bg-slate-50 dark:bg-slate-700 px-2 py-0.5 rounded border border-slate-100 dark:border-slate-600">
                    {new Date(item.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                  </span>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-3">{item.description}</p>
                
                <div className="flex flex-wrap gap-3">
                  {item.oldStatus && item.newStatus && (
                    <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-700 px-2 py-1 rounded-lg border border-slate-100 dark:border-slate-600">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Status</span>
                      <span className="text-xs text-slate-500 line-through opacity-50">{item.oldStatus}</span>
                      <ArrowRight className="w-3 h-3 text-slate-300" />
                      <span className="text-xs font-bold text-blue-600 dark:text-blue-400">{item.newStatus}</span>
                    </div>
                  )}
                  {item.performedByName && (
                    <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-700 px-2 py-1 rounded-lg border border-slate-100 dark:border-slate-600">
                      <User className="w-3 h-3 text-slate-400" />
                      <span className="text-[10px] font-medium text-slate-600 dark:text-slate-400">By {item.performedByName}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
