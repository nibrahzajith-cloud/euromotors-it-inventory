import React, { useState, useEffect } from 'react';
import { Shield, Save, Check, X, Loader2 } from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/$/, '');

const PERMISSION_GROUPS = [
  {
    name: 'Assets',
    permissions: [
      { id: 'VIEW_ASSETS', label: 'View Assets' },
      { id: 'CREATE_ASSETS', label: 'Create Assets' },
      { id: 'EDIT_ASSETS', label: 'Edit Assets' },
      { id: 'DELETE_ASSETS', label: 'Delete Assets' },
      { id: 'ASSIGN_ASSETS', label: 'Assign Assets' },
      { id: 'TRANSFER_ASSETS', label: 'Transfer Assets' },
      { id: 'BULK_IMPORT_ASSETS', label: 'Bulk Import Assets' },
    ]
  },
  {
    name: 'Media & Documents',
    permissions: [
      { id: 'UPLOAD_ASSET_IMAGES', label: 'Upload Asset Images' },
      { id: 'REPLACE_ASSET_IMAGES', label: 'Replace Asset Images' },
      { id: 'DELETE_ASSET_IMAGES', label: 'Delete Asset Images' },
      { id: 'UPLOAD_ASSET_DOCUMENTS', label: 'Upload Asset Documents' },
      { id: 'DOWNLOAD_ASSET_DOCUMENTS', label: 'Download Asset Documents' },
      { id: 'DELETE_ASSET_DOCUMENTS', label: 'Delete Asset Documents' },
    ]
  },
  {
    name: 'Reports & Telemetry',
    permissions: [
      { id: 'EXPORT_REPORTS', label: 'Export Reports' },
      { id: 'VIEW_STORAGE_STATS', label: 'View Storage Statistics' },
    ]
  },
  {
    name: 'Organization Management',
    permissions: [
      { id: 'MANAGE_EMPLOYEES', label: 'Manage Employees' },
      { id: 'MANAGE_DEPARTMENTS', label: 'Manage Departments' },
      { id: 'MANAGE_LOCATIONS', label: 'Manage Locations' },
    ]
  },
  {
    name: 'System Administration',
    permissions: [
      { id: 'MANAGE_USERS', label: 'Manage Users' },
      { id: 'MANAGE_ROLES', label: 'Manage Roles & Permissions' },
      { id: 'VIEW_AUDIT_LOG', label: 'View Audit Log' },
      { id: 'EXPORT_AUDIT_LOG', label: 'Export Audit Log' },
      { id: 'CONFIGURE_SYSTEM', label: 'Configure System' },
    ]
  }
];

const ROLES = [
  { id: 'ADMIN', label: 'System Admin' },
  { id: 'IT_OFFICER', label: 'IT Officer' },
  { id: 'VIEWER', label: 'Viewer' }
];

export default function RolePermissions() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [matrix, setMatrix] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (user?.role !== 'ADMIN') {
      navigate('/');
      return;
    }
    fetchPermissions();
  }, [user, navigate]);

  const fetchPermissions = async () => {
    try {
      const res = await fetch(`${API_URL}/permissions`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMatrix(data);
      }
    } catch (err) {
      console.error('Failed to fetch permissions', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (role, permissionId) => {
    // Prevent locking out ADMIN from critical permissions
    if (role === 'ADMIN' && ['MANAGE_ROLES', 'VIEW_AUDIT_LOG', 'CONFIGURE_SYSTEM'].includes(permissionId)) {
      return;
    }

    setMatrix(prev => ({
      ...prev,
      [role]: {
        ...prev[role],
        [permissionId]: !prev[role]?.[permissionId]
      }
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const role of ROLES) {
        await fetch(`${API_URL}/permissions/${role.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({ permissions: matrix[role.id] })
        });
      }
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to save permissions', err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-800 dark:text-white">Role & Permissions</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Configure granular access control matrix for system roles.</p>
        </div>
        
        <button 
          onClick={handleSave}
          disabled={saving}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg shadow-blue-500/20 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : (success ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />)}
          {saving ? 'Saving...' : (success ? 'Saved' : 'Save Changes')}
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900/40 rounded-2xl border border-slate-200 dark:border-white/10 overflow-hidden shadow-sm dark:shadow-2xl !p-0 overflow-hidden border-slate-200 dark:border-white/10">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-white/5 border-b border-slate-200 dark:border-white/10">
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Permission Module</th>
                {ROLES.map(role => (
                  <th key={role.id} className="px-6 py-4 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <Shield className={`w-5 h-5 ${role.id === 'ADMIN' ? 'text-purple-500' : role.id === 'IT_OFFICER' ? 'text-blue-500' : 'text-slate-400'}`} />
                      <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{role.label}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERMISSION_GROUPS.map((group, idx) => (
                <React.Fragment key={group.name}>
                  <tr className="bg-slate-50/50 dark:bg-white/5 border-b border-slate-200 dark:border-white/10">
                    <td colSpan={ROLES.length + 1} className="px-6 py-3 text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-white/10">
                      {group.name}
                    </td>
                  </tr>
                  {group.permissions.map(perm => (
                    <tr key={perm.id} className="border-b border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4">
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{perm.label}</span>
                      </td>
                      {ROLES.map(role => {
                        const isChecked = !!matrix[role.id]?.[perm.id];
                        const isCriticalAdmin = role.id === 'ADMIN' && ['MANAGE_ROLES', 'VIEW_AUDIT_LOG', 'CONFIGURE_SYSTEM'].includes(perm.id);
                        return (
                          <td key={`${role.id}-${perm.id}`} className="px-6 py-4 text-center">
                            <label className={`relative inline-flex items-center ${isCriticalAdmin ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
                              <input 
                                type="checkbox" 
                                className="sr-only peer" 
                                checked={isChecked}
                                disabled={isCriticalAdmin}
                                onChange={() => handleToggle(role.id, perm.id)}
                              />
                              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-blue-600"></div>
                            </label>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
