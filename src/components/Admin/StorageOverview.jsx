import { useState, useEffect, useCallback } from 'react';
import { 
    HardDrive, Database, Server, RefreshCw, AlertTriangle, 
    CheckCircle2, Info, ChevronRight, Settings, 
    FileText, Image as ImageIcon, Layers, Loader2, Sparkles, X, ShieldAlert
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

const _rawApi = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const API_URL = _rawApi.endsWith('/api') ? _rawApi : `${_rawApi.replace(/\/$/, '')}/api`;

export default function StorageOverview({ embedded = false }) {
    const { user } = useAuth();
    const { showToast } = useToast();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [stats, setStats] = useState(null);
    const [error, setError] = useState(null);

    // DB Capacity Modal State
    const [showConfigModal, setShowConfigModal] = useState(false);
    const [capacityInput, setCapacityInput] = useState('');
    const [capacityUnit, setCapacityUnit] = useState('MB'); // 'MB' | 'GB'
    const [savingCapacity, setSavingCapacity] = useState(false);

    const isAdmin = user?.role === 'ADMIN';

    const fetchStorageStats = useCallback(async (forceRefresh = false) => {
        if (!isAdmin) return;
        if (forceRefresh) setRefreshing(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/uploads/storage/stats${forceRefresh ? '?refresh=true' : ''}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!res.ok) {
                if (res.status === 403) throw new Error('Access denied: Admin role required for storage monitoring.');
                throw new Error('Failed to load storage statistics.');
            }

            const data = await res.json();
            setStats(data);
            setError(null);
        } catch (err) {
            console.error(err);
            setError(err.message);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [isAdmin]);

    useEffect(() => {
        if (isAdmin) {
            fetchStorageStats();
        }
    }, [isAdmin, fetchStorageStats]);

    const formatBytes = (bytes, decimals = 2) => {
        if (!+bytes) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
    };

    const getStatusLevel = (percentage) => {
        if (percentage >= 95) return { label: 'Critical', color: 'rose', bg: 'bg-rose-500', text: 'text-rose-600 dark:text-rose-400', badge: 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/40' };
        if (percentage >= 85) return { label: 'High', color: 'orange', bg: 'bg-orange-500', text: 'text-orange-600 dark:text-orange-400', badge: 'bg-orange-50 dark:bg-orange-950/40 border-orange-200 dark:border-orange-800/40' };
        if (percentage >= 70) return { label: 'Warning', color: 'amber', bg: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400', badge: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/40' };
        return { label: 'Normal', color: 'emerald', bg: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', badge: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/40' };
    };

    const handleSaveDbCapacity = async () => {
        setSavingCapacity(true);
        try {
            let finalMB = null;
            if (capacityInput.trim() !== '') {
                const val = parseFloat(capacityInput);
                if (isNaN(val) || val <= 0) {
                    throw new Error('Please enter a valid positive number for capacity.');
                }
                finalMB = capacityUnit === 'GB' ? Math.round(val * 1024) : Math.round(val);
            }

            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/uploads/storage/db-capacity`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ capacityMB: finalMB })
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to update database reference capacity');
            }

            showToast(finalMB ? `Database reference capacity set to ${finalMB >= 1024 ? (finalMB / 1024).toFixed(1) + ' GB' : finalMB + ' MB'}` : 'Database reference capacity cleared', 'success');
            setShowConfigModal(false);
            fetchStorageStats(true);
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            setSavingCapacity(false);
        }
    };

    if (!isAdmin) {
        return null;
    }

    if (loading) {
        return (
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-6 flex flex-col items-center justify-center min-h-[220px]">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-3" />
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Calculating Live Storage Usage...</p>
            </div>
        );
    }

    if (error || !stats) {
        return (
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-6">
                <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400 mb-2">
                    <ShieldAlert className="w-5 h-5" />
                    <h3 className="font-semibold text-sm">Storage Monitoring Unavailable</h3>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">{error || 'Unable to connect to storage metrics service.'}</p>
                <button
                    onClick={() => fetchStorageStats(true)}
                    className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition flex items-center gap-1.5"
                >
                    <RefreshCw className="w-3.5 h-3.5" /> Retry
                </button>
            </div>
        );
    }

    const { r2, database } = stats;

    // R2 Metrics
    const r2ReferenceBytes = r2?.referenceLimitBytes || 10 * 1024 * 1024 * 1024; // 10 GB Reference Allowance
    const r2UsedBytes = r2?.totalBytes || 0;
    const r2UsedPercent = Math.min(100, Math.max(0, (r2UsedBytes / r2ReferenceBytes) * 100));
    const r2RemainingBytes = Math.max(0, r2ReferenceBytes - r2UsedBytes);
    const r2Status = getStatusLevel(r2UsedPercent);

    // Database Metrics
    const dbUsedBytes = database?.totalBytes || 0;
    const dbRefMB = database?.configuredReferenceLimitMB;
    const hasDbReference = typeof dbRefMB === 'number' && dbRefMB > 0;
    const dbReferenceBytes = hasDbReference ? dbRefMB * 1024 * 1024 : null;
    const dbUsedPercent = hasDbReference ? Math.min(100, Math.max(0, (dbUsedBytes / dbReferenceBytes) * 100)) : null;
    const dbRemainingBytes = hasDbReference ? Math.max(0, dbReferenceBytes - dbUsedBytes) : null;
    const dbStatus = hasDbReference ? getStatusLevel(dbUsedPercent) : null;

    return (
        <div className={`space-y-6 ${embedded ? '' : 'max-w-7xl mx-auto'}`}>
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-100 dark:border-slate-700 shadow-sm">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800/40">
                            <Server className="w-5 h-5" />
                        </span>
                        <div>
                            <h2 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                Storage Overview
                                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                                    Admin Only
                                </span>
                            </h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                Live storage metrics measured directly from Cloudflare R2 and PostgreSQL
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => fetchStorageStats(true)}
                        disabled={refreshing}
                        className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition flex items-center gap-1.5 disabled:opacity-50"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                        {refreshing ? 'Refreshing...' : 'Refresh Storage'}
                    </button>
                </div>
            </div>

            {/* Storage Cards Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 1. CLOUDFLARE R2 STORAGE CARD */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-6 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3 mb-4">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200/50 dark:border-amber-800/30">
                                    <HardDrive className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-slate-800 dark:text-white">Cloudflare R2 Storage</h3>
                                    <p className="text-[11px] text-slate-400">Private Asset Media &amp; Documents</p>
                                </div>
                            </div>
                            <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${r2Status.badge} ${r2Status.text}`}>
                                {r2Status.label}
                            </span>
                        </div>

                        {/* Gauge & Progress Bar */}
                        <div className="bg-slate-50/80 dark:bg-slate-900/40 rounded-xl p-4 border border-slate-100 dark:border-slate-700/50 mb-5">
                            <div className="flex items-end justify-between mb-2">
                                <div>
                                    <span className="text-2xl font-black text-slate-800 dark:text-white">
                                        {formatBytes(r2UsedBytes)}
                                    </span>
                                    <span className="text-xs text-slate-400 font-medium ml-1.5">
                                        / 10 GB (Reference Allowance)
                                    </span>
                                </div>
                                <span className={`text-sm font-bold ${r2Status.text}`}>
                                    {r2UsedPercent.toFixed(1)}%
                                </span>
                            </div>

                            {/* Progress bar */}
                            <div className="w-full bg-slate-200 dark:bg-slate-700/60 rounded-full h-2.5 overflow-hidden">
                                <div 
                                    className={`h-full rounded-full transition-all duration-500 ${r2Status.bg}`} 
                                    style={{ width: `${Math.max(2, r2UsedPercent)}%` }} 
                                />
                            </div>

                            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mt-2.5">
                                <span>Total Files: <strong className="text-slate-700 dark:text-slate-200">{r2.totalCount.toLocaleString()}</strong></span>
                                <span>Remaining: <strong className="text-slate-700 dark:text-slate-200">{formatBytes(r2RemainingBytes)}</strong></span>
                            </div>
                        </div>

                        {/* R2 Object Breakdown */}
                        <div className="grid grid-cols-3 gap-3">
                            <div className="p-3 bg-slate-50 dark:bg-slate-900/30 rounded-xl border border-slate-100 dark:border-slate-700/50 text-center">
                                <div className="flex items-center justify-center gap-1 text-blue-600 dark:text-blue-400 mb-1">
                                    <ImageIcon className="w-4 h-4" />
                                    <span className="text-[11px] font-bold">Images</span>
                                </div>
                                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{formatBytes(r2.breakdown?.images?.bytes || 0)}</p>
                                <p className="text-[10px] text-slate-400">{r2.breakdown?.images?.count || 0} files</p>
                            </div>

                            <div className="p-3 bg-slate-50 dark:bg-slate-900/30 rounded-xl border border-slate-100 dark:border-slate-700/50 text-center">
                                <div className="flex items-center justify-center gap-1 text-indigo-600 dark:text-indigo-400 mb-1">
                                    <Layers className="w-4 h-4" />
                                    <span className="text-[11px] font-bold">Thumbnails</span>
                                </div>
                                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{formatBytes(r2.breakdown?.thumbnails?.bytes || 0)}</p>
                                <p className="text-[10px] text-slate-400">{r2.breakdown?.thumbnails?.count || 0} files</p>
                            </div>

                            <div className="p-3 bg-slate-50 dark:bg-slate-900/30 rounded-xl border border-slate-100 dark:border-slate-700/50 text-center">
                                <div className="flex items-center justify-center gap-1 text-emerald-600 dark:text-emerald-400 mb-1">
                                    <FileText className="w-4 h-4" />
                                    <span className="text-[11px] font-bold">Documents</span>
                                </div>
                                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{formatBytes(r2.breakdown?.documents?.bytes || 0)}</p>
                                <p className="text-[10px] text-slate-400">{r2.breakdown?.documents?.count || 0} files</p>
                            </div>
                        </div>
                    </div>

                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-4 border-t border-slate-100 dark:border-slate-700/40 pt-2.5">
                        * 10 GB represents the monitoring reference level for Cloudflare R2 Free Tier allowance.
                    </p>
                </div>

                {/* 2. DATABASE STORAGE CARD */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-6 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3 mb-4">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200/50 dark:border-blue-800/30">
                                    <Database className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-slate-800 dark:text-white">PostgreSQL Database Storage</h3>
                                    <p className="text-[11px] text-slate-400">PostgreSQL Schema &amp; Inventory Tables</p>
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    setCapacityInput(hasDbReference ? (dbRefMB >= 1024 ? (dbRefMB / 1024).toString() : dbRefMB.toString()) : '');
                                    setCapacityUnit(hasDbReference && dbRefMB >= 1024 ? 'GB' : 'MB');
                                    setShowConfigModal(true);
                                }}
                                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 transition flex items-center gap-1"
                            >
                                <Settings className="w-3.5 h-3.5" />
                                {hasDbReference ? 'Configure Reference' : 'Set Reference'}
                            </button>
                        </div>

                        {/* Database Size Display */}
                        <div className="bg-slate-50/80 dark:bg-slate-900/40 rounded-xl p-4 border border-slate-100 dark:border-slate-700/50 mb-5">
                            <div className="flex items-end justify-between mb-2">
                                <div>
                                    <span className="text-2xl font-black text-slate-800 dark:text-white">
                                        {formatBytes(dbUsedBytes)}
                                    </span>
                                    <span className="text-xs text-slate-400 font-medium ml-1.5">
                                        Used
                                    </span>
                                </div>
                                {hasDbReference ? (
                                    <span className={`text-sm font-bold ${dbStatus.text}`}>
                                        {dbUsedPercent.toFixed(1)}% of Ref
                                    </span>
                                ) : (
                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400">
                                        Plan Capacity: Not Configured
                                    </span>
                                )}
                            </div>

                            {/* Show Progress Bar only when reference capacity is explicitly configured */}
                            {hasDbReference ? (
                                <>
                                    <div className="w-full bg-slate-200 dark:bg-slate-700/60 rounded-full h-2.5 overflow-hidden">
                                        <div 
                                            className={`h-full rounded-full transition-all duration-500 ${dbStatus.bg}`} 
                                            style={{ width: `${Math.max(2, dbUsedPercent)}%` }} 
                                        />
                                    </div>
                                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mt-2.5">
                                        <span>Configured Ref: <strong className="text-slate-700 dark:text-slate-200">{formatBytes(dbReferenceBytes)}</strong></span>
                                        <span>Remaining: <strong className="text-slate-700 dark:text-slate-200">{formatBytes(dbRemainingBytes)}</strong></span>
                                    </div>
                                </>
                            ) : (
                                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-2">
                                    Actual database usage is measured directly from PostgreSQL. Plan capacity is not assumed.
                                </p>
                            )}
                        </div>

                        {/* Major Table Sizes Breakdown */}
                        <div>
                            <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">Major Table Breakdown</p>
                            <div className="max-h-32 overflow-y-auto space-y-1.5 pr-1">
                                {(database.tables || []).slice(0, 6).map((tbl) => (
                                    <div key={tbl.tableName} className="flex items-center justify-between text-xs p-1.5 rounded-lg bg-slate-50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-700/40">
                                        <span className="font-medium text-slate-700 dark:text-slate-300">{tbl.tableName}</span>
                                        <span className="text-slate-500 dark:text-slate-400 font-semibold">{tbl.prettyTotalSize}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-4 border-t border-slate-100 dark:border-slate-700/40 pt-2.5">
                        * Measured directly from PostgreSQL pg_database_size and relation functions.
                    </p>
                </div>
            </div>

            {/* Configure Reference Capacity Modal */}
            {showConfigModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-700 pb-3 mb-4">
                            <h3 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                <Settings className="w-4 h-4 text-blue-600" /> Database Reference Capacity
                            </h3>
                            <button onClick={() => setShowConfigModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="bg-blue-50 dark:bg-blue-950/40 p-3 rounded-xl border border-blue-100 dark:border-blue-800/40 mb-4 text-xs text-blue-800 dark:text-blue-300 flex items-start gap-2">
                            <Info className="w-4 h-4 shrink-0 mt-0.5" />
                            <p>
                                <strong>Monitoring Reference Only:</strong> This value is used strictly for dashboard usage gauges. It does not alter your cloud hosting plan limit.
                            </p>
                        </div>

                        <div className="space-y-3 mb-6">
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                                Reference Storage Capacity:
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="number"
                                    min="1"
                                    step="any"
                                    value={capacityInput}
                                    onChange={(e) => setCapacityInput(e.target.value)}
                                    placeholder={hasDbReference ? dbRefMB.toString() : "e.g. 500 or 1"}
                                    className="flex-1 px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                <select
                                    value={capacityUnit}
                                    onChange={(e) => setCapacityUnit(e.target.value)}
                                    className="px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
                                >
                                    <option value="MB">MB</option>
                                    <option value="GB">GB</option>
                                </select>
                            </div>
                            <p className="text-[11px] text-slate-400">
                                Leave blank and click &quot;Save Capacity&quot; to clear the reference configuration.
                            </p>
                        </div>

                        <div className="flex gap-2">
                            <button
                                onClick={() => setShowConfigModal(false)}
                                className="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 transition"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveDbCapacity}
                                disabled={savingCapacity}
                                className="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition flex items-center justify-center gap-1.5 shadow-sm shadow-blue-600/20 disabled:opacity-50"
                            >
                                {savingCapacity ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Save Capacity'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
