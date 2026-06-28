import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Plus, MonitorSmartphone, Users, Loader2, AlertCircle, Edit, Trash2, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';

const _rawApi = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const API_URL = _rawApi.endsWith('/api') ? _rawApi : `${_rawApi.replace(/\/$/, '')}/api`;

const PreviewTooltip = ({ title, items, count, type, visible }) => {
  if (!visible) return null;
  
  return (
    <div className="absolute bottom-full left-0 mb-2 w-64 bg-white rounded-xl shadow-xl border border-slate-100 p-4 z-40 animate-in fade-in slide-in-from-bottom-2 duration-200">
      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex justify-between">
        {title}
        <span className="text-blue-600">{count} total</span>
      </h4>
      <div className="space-y-2">
        {items.length === 0 ? (
          <p className="text-xs text-slate-400 italic">No records found</p>
        ) : (
          items.map((item, idx) => (
            <div key={idx} className="text-xs border-l-2 border-blue-500 pl-2 py-0.5 text-left">
              {type === 'personnel' ? (
                <>
                  <p className="font-bold text-slate-700">{item.fullName}</p>
                  <p className="text-slate-500">{item.designation || 'Staff'} • {item.status}</p>
                </>
              ) : (
                <>
                  <p className="font-bold text-slate-700">{item.assetCode}</p>
                  <p className="text-slate-500">{item.deviceType} • {item.model}</p>
                </>
              )}
            </div>
          ))
        )}
        {count > 5 && (
          <p className="text-[10px] text-center text-blue-500 font-medium pt-1">
            + {count - 5} more in location...
          </p>
        )}
      </div>
      <div className="absolute -bottom-1.5 left-6 w-3 h-3 bg-white border-r border-b border-slate-100 rotate-45"></div>
    </div>
  );
};

export default function Locations() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const navigate = useNavigate();
  
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hoveredBadge, setHoveredBadge] = useState({ id: null, type: null });
  
  const canEdit = user?.role === 'ADMIN';

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLoc, setEditingLoc] = useState(null);
  const [formData, setFormData] = useState({ name: '', description: '', status: 'ACTIVE' });

  const fetchLocations = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/locations`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load locations');
      const data = await res.json();
      setLocations(data);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLocations();
  }, []);

  const openModal = (loc = null) => {
    if (loc) {
      setEditingLoc(loc);
      setFormData({ name: loc.name, description: loc.description || '', status: loc.status });
    } else {
      setEditingLoc(null);
      setFormData({ name: '', description: '', status: 'ACTIVE' });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingLoc(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const url = editingLoc 
        ? `${API_URL}/locations/${editingLoc.id}` 
        : `${API_URL}/locations`;
      const method = editingLoc ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify(formData)
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to save location');
      }

      showToast('Location successfully integrated into registry.', 'success');
      await fetchLocations();
      closeModal();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleDelete = async (id) => {
    const confirmed = await confirm({
      title: 'Delete Location',
      message: 'Are you sure you want to delete this location?',
      confirmText: 'Delete Location'
    });
    if (!confirmed) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/locations/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to delete');
      setLocations(locations.filter(l => l.id !== id));
      showToast('Location removed cleanly from matrix.', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 flex-col items-center justify-center space-y-4">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
        <p className="text-slate-500 font-medium">Loading locations...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col h-[50vh] items-center justify-center p-8 bg-red-50 border border-red-100 rounded-3xl">
        <AlertCircle className="h-14 w-14 text-red-500 mb-4" />
        <h2 className="text-xl font-bold text-red-600">Error Loading Data</h2>
        <p className="text-red-500 text-center mt-2 max-w-md">{error}</p>
        <button onClick={fetchLocations} className="mt-6 px-6 py-2 bg-red-600 text-white rounded-xl shadow-sm hover:bg-red-700 transition">
          Retry Connection
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Locations</h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">Manage physical locations and distribution of assets.</p>
        </div>
        {canEdit && (
          <button 
            onClick={() => openModal()}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm shadow-blue-600/20"
          >
            <Plus className="w-4 h-4" />
            Add Location
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {locations.length === 0 ? (
          <div className="col-span-full py-12 text-center bg-white rounded-2xl border border-slate-100">
            <p className="text-slate-500">No locations configured.</p>
          </div>
        ) : locations.map(loc => (
          <div key={loc.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow relative flex flex-col justify-between">
            <div>
              <div className="absolute top-6 right-6 flex items-center gap-2">
                {canEdit && (
                  <div className="flex bg-slate-50 rounded-lg p-1 mr-2 opacity-50 hover:opacity-100 transition-opacity">
                    <button onClick={() => openModal(loc)} className="p-1.5 text-slate-400 hover:text-blue-600 rounded-md hover:bg-white"><Edit className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleDelete(loc.id)} className="p-1.5 text-slate-400 hover:text-red-600 rounded-md hover:bg-white"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                )}
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${loc.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                  {loc.status}
                </span>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center shrink-0">
                  <MapPin className="w-6 h-6" />
                </div>
                <div className="pr-16">
                  <h3 className="font-bold text-lg text-slate-800 dark:text-white">{loc.name}</h3>
                  <p className="text-sm text-slate-500 mt-1">{loc.description || 'No address provided'}</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-6 mt-6 pt-6 border-t border-slate-100">
              <div 
                className="relative flex items-center gap-2 text-slate-600 hover:text-blue-600 transition-colors cursor-pointer"
                onMouseEnter={() => setHoveredBadge({ id: loc.id, type: 'assets' })}
                onMouseLeave={() => setHoveredBadge({ id: null, type: null })}
                onClick={() => navigate(`/assets?locationId=${loc.id}`)}
              >
                <MonitorSmartphone className="w-4 h-4 text-slate-400" />
                <span className="text-sm font-medium">{loc._count?.assets || 0} Assets</span>
                <PreviewTooltip 
                  title="Assets Preview" 
                  items={loc.assets || []} 
                  count={loc._count?.assets || 0} 
                  type="assets"
                  visible={hoveredBadge.id === loc.id && hoveredBadge.type === 'assets'} 
                />
              </div>
              <div 
                className="relative flex items-center gap-2 text-slate-600 hover:text-blue-600 transition-colors cursor-pointer"
                onMouseEnter={() => setHoveredBadge({ id: loc.id, type: 'personnel' })}
                onMouseLeave={() => setHoveredBadge({ id: null, type: null })}
                onClick={() => navigate(`/employees?locationId=${loc.id}`)}
              >
                <Users className="w-4 h-4 text-slate-400" />
                <span className="text-sm font-medium">{loc._count?.employees || 0} Personnel</span>
                <PreviewTooltip 
                  title="Personnel Preview" 
                  items={loc.employees || []} 
                  count={loc._count?.employees || 0} 
                  type="personnel"
                  visible={hoveredBadge.id === loc.id && hoveredBadge.type === 'personnel'} 
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden">
            <div className="flex justify-between items-center p-5 border-b border-slate-100">
              <h3 className="font-bold text-lg text-slate-800 dark:text-white">{editingLoc ? 'Edit' : 'Add'} Location</h3>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 rounded-lg p-1 hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Location Name *</label>
                <input 
                  required
                  type="text" 
                  value={formData.name} 
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 p-2.5 outline-none transition-all placeholder:text-slate-400"
                  placeholder="e.g. Manchester Branch"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Address / Description</label>
                <textarea 
                  value={formData.description} 
                  onChange={e => setFormData({...formData, description: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 p-2.5 outline-none transition-all placeholder:text-slate-400 min-h-[100px] resize-none"
                  placeholder="Full physical address or details"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                <select 
                  value={formData.status} 
                  onChange={e => setFormData({...formData, status: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 p-2.5 outline-none transition-all"
                >
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </div>
              
              <div className="pt-4 flex justify-end gap-3 flex-wrap">
                <button type="button" onClick={closeModal} className="px-4 py-2 font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50">Cancel</button>
                <button type="submit" className="px-4 py-2 font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 shadow-sm">{editingLoc ? 'Save Changes' : 'Create Location'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
