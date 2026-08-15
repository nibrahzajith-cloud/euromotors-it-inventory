import { useState, useEffect } from 'react';
import { Shield, ShieldAlert, ShieldCheck, Edit, Check, X, Loader2, Save } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const _rawApi = import.meta.env.VITE_API_URL || '/api';
const API_URL = _rawApi.endsWith('/api') ? _rawApi : `${_rawApi.replace(/\/$/, '')}/api`;

const PERMISSION_GROUPS = {
  'Asset Management': ['VIEW_ASSETS', 'CREATE_ASSETS', 'EDIT_ASSETS', 'DELETE_ASSETS', 'ASSIGN_ASSETS', 'TRANSFER_ASSETS'],
  'Asset Media & Documents': ['UPLOAD_ASSET_IMAGES', 'REPLACE_ASSET_IMAGES', 'DELETE_ASSET_IMAGES', 'UPLOAD_ASSET_DOCUMENTS', 'DOWNLOAD_ASSET_DOCUMENTS', 'DELETE_ASSET_DOCUMENTS'],
  'System Data': ['BULK_IMPORT_ASSETS', 'EXPORT_REPORTS', 'VIEW_STORAGE_STATS'],
  'Organization': ['MANAGE_EMPLOYEES', 'MANAGE_DEPARTMENTS', 'MANAGE_LOCATIONS'],
  'Administration': ['MANAGE_USERS', 'MANAGE_ROLES', 'VIEW_AUDIT_LOG', 'EXPORT_AUDIT_LOG', 'CONFIGURE_SYSTEM']
};

export default function RolePermissions() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [matrix, setMatrix] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [editingRole, setEditingRole] = useState(null);
  const [editPermissions, setEditPermissions] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchPermissions();
  }, []);

  const fetchPermissions = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/permissions`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch permissions');
      const data = await res.json();
      setMatrix(data);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEditRole = (role) => {
    setEditingRole(role);
    setEditPermissions({ ...matrix[role] });
  };

  const togglePermission = (perm) => {
    setEditPermissions(prev => ({
      ...prev,
      [perm]: !prev[perm]
    }));
  };

  const handleSavePermissions = async () => {
    setIsSaving(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/permissions/${editingRole}`, {
        method: 'PUT',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ permissions: editPermissions })
      });
      
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to save permissions');
      }
      
      showToast('Permissions updated successfully', 'success');
      setMatrix(prev => ({ ...prev, [editingRole]: editPermissions }));
      setEditingRole(null);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 border-t border-slate-100 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
      </div>
    );
  }

  const roleConfigs = [
    { id: 'ADMIN', name: 'Administrator', desc: 'Full access to all system modules, configurations, and exports.' },
    { id: 'IT_OFFICER', name: 'IT Support', desc: 'Can manage assets, log maintenance, and assign equipment.' },
    { id: 'VIEWER', name: 'Viewer', desc: 'Read-only access to Dashboards and Reports.' }
  ];

  return (
    <div className="p-6 border-t border-slate-100">
      <h2 className="text-lg font-semibold text-slate-800 dark:text-white mb-6 border-b border-slate-100 pb-2">User Roles & Permissions</h2>
      
      <div className="space-y-4">
        {roleConfigs.map(role => (
          <div key={role.id} className="flex flex-col p-4 bg-slate-50 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-slate-800 dark:text-white flex items-center gap-2">
                  {role.id === 'ADMIN' && <ShieldCheck className="w-4 h-4 text-purple-600" />}
                  {role.id === 'IT_OFFICER' && <Shield className="w-4 h-4 text-blue-600" />}
                  {role.id === 'VIEWER' && <ShieldAlert className="w-4 h-4 text-slate-600" />}
                  {role.name}
                </h3>
                <p className="text-sm text-slate-500">{role.desc}</p>
              </div>
              <button 
                onClick={() => handleEditRole(role.id)}
                className="text-blue-600 hover:text-blue-700 font-medium text-sm flex items-center gap-1 bg-white px-3 py-1.5 rounded-lg border border-blue-100 shadow-sm transition-all"
              >
                <Edit className="w-3.5 h-3.5" /> Edit Role
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Editing Modal */}
      {editingRole && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex justify-center items-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl my-8 overflow-hidden">
            <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-slate-50">
              <div>
                <h3 className="font-bold text-xl text-slate-800">Edit Permissions: {editingRole}</h3>
                <p className="text-sm text-slate-500">Configure access levels and capabilities for this role.</p>
              </div>
              <button onClick={() => setEditingRole(null)} className="text-slate-400 hover:text-slate-600 bg-white p-2 rounded-lg shadow-sm">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 max-h-[60vh] overflow-y-auto bg-slate-50/50">
              <div className="space-y-6">
                {Object.entries(PERMISSION_GROUPS).map(([groupName, perms]) => (
                  <div key={groupName} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                    <div className="bg-slate-100 px-4 py-2 border-b border-slate-200">
                      <h4 className="font-semibold text-slate-700 text-sm uppercase tracking-wider">{groupName}</h4>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {perms.map(perm => {
                        const isOn = editPermissions[perm] || false;
                        const isCriticalAdmin = editingRole === 'ADMIN' && ['MANAGE_USERS', 'MANAGE_ROLES', 'VIEW_AUDIT_LOG', 'CONFIGURE_SYSTEM'].includes(perm);
                        
                        return (
                          <div key={perm} className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors">
                            <div>
                              <span className="font-medium text-slate-800">{perm.replace(/_/g, ' ')}</span>
                              {isCriticalAdmin && <p className="text-xs text-purple-600 mt-1">Required for Administrator</p>}
                            </div>
                            <button
                              onClick={() => !isCriticalAdmin && togglePermission(perm)}
                              disabled={isCriticalAdmin}
                              className={`relative inline-flex h-7 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 ${
                                isOn ? 'bg-emerald-500' : 'bg-slate-300'
                              } ${isCriticalAdmin ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                              <span className="sr-only">Toggle {perm}</span>
                              <span
                                className={`pointer-events-none flex h-6 w-6 items-center justify-center rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                  isOn ? 'translate-x-7' : 'translate-x-0'
                                }`}
                              >
                                {isOn ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <X className="w-3.5 h-3.5 text-slate-400" />}
                              </span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="p-5 border-t border-slate-100 bg-white flex justify-end gap-3">
              <button 
                onClick={() => setEditingRole(null)}
                className="px-5 py-2.5 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl font-medium transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleSavePermissions}
                disabled={isSaving}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium flex items-center gap-2 transition-colors disabled:opacity-50 shadow-sm"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Permissions
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
