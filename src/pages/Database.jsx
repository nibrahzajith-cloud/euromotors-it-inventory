import { useState } from 'react';
import { Database as DatabaseIcon, AlertTriangle, Trash2, History } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import StorageOverview from '../components/Admin/StorageOverview';

const _rawApi = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const API_URL = _rawApi.endsWith('/api') ? _rawApi : `${_rawApi.replace(/\/$/, '')}/api`;

export default function Database() {
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const [isResetting, setIsResetting] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const handleClearActivity = async () => {
    const isConfirmed = await confirm({
      title: 'Clear Activity Logs',
      message: 'Are you sure you want to clear all Audit Logs and Asset Timelines? This cannot be undone.',
      confirmText: 'Clear Logs'
    });
    if (!isConfirmed) return;
    
    setIsClearing(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/database/clear-activity`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Failed to clear activity logs');
      
      showToast(data.message, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setIsClearing(false);
    }
  };

  const handleResetDatabase = async () => {
    const confirmText = await confirm({
      type: 'prompt',
      title: 'Wipe Database',
      message: "WARNING: This will delete ALL Inventory Data including Assets, Employees, Locations, Departments, and Logs! User accounts will remain. Type 'CONFIRM' to proceed.",
      inputPlaceholder: "Type 'CONFIRM'",
      confirmText: 'Wipe Database'
    });
    
    if (confirmText !== 'CONFIRM') {
      showToast("Database reset cancelled.", 'info');
      return;
    }

    setIsResetting(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/database/reset-all`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Failed to reset database');
      
      showToast(data.message, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Admin Storage Overview */}
      <StorageOverview />

      {/* Database Management & Danger Zone */}
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl">
            <DatabaseIcon className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Database Maintenance</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">Perform maintenance or destructive cleanup operations on the system database.</p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Clear Activity Logs Card */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 flex flex-col">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-lg">
                <History className="w-5 h-5" />
              </div>
              <h2 className="text-base font-semibold text-slate-800 dark:text-white">Clear Recent Activity</h2>
            </div>
            <p className="text-slate-600 dark:text-slate-400 text-xs mb-6 flex-1">
              This will permanently delete all Audit Logs and Asset Timeline entries to free up database space. Core inventory data will remain intact.
            </p>
            <button
              onClick={handleClearActivity}
              disabled={isClearing}
              className="w-full flex items-center justify-center gap-2 bg-amber-50 text-amber-600 hover:bg-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:hover:bg-amber-500/20 py-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
            >
              {isClearing ? 'Clearing...' : 'Clear Activity Logs'}
            </button>
          </div>

          {/* Reset Database Card */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-red-200 dark:border-red-900/30 p-6 flex flex-col relative overflow-hidden">
            <div className="absolute top-0 right-0 p-3 opacity-10 pointer-events-none">
              <AlertTriangle className="w-24 h-24 text-red-600" />
            </div>
            <div className="flex items-center gap-3 mb-4 relative z-10">
              <div className="p-2 bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 rounded-lg">
                <Trash2 className="w-5 h-5" />
              </div>
              <h2 className="text-base font-semibold text-red-600 dark:text-red-400">Wipe Database</h2>
            </div>
            <p className="text-slate-600 dark:text-slate-400 text-xs mb-6 flex-1 relative z-10">
              <strong>DANGER ZONE.</strong> This action will permanently delete all Assets, Employees, Locations, Departments, Support Tickets, and Logs. Only User accounts and Settings will remain.
            </p>
            <button
              onClick={handleResetDatabase}
              disabled={isResetting}
              className="relative z-10 w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
            >
              <AlertTriangle className="w-4 h-4" />
              {isResetting ? 'Wiping Database...' : 'Reset Entire Database'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
