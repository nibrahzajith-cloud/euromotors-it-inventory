import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
    HardDrive, Database as DatabaseIcon, Server, RefreshCw, AlertTriangle, 
    CheckCircle2, Info, ChevronRight, Settings, 
    FileText, Image as ImageIcon, Layers, Loader2, Sparkles, X, 
    ShieldAlert, Search, Trash2, History, Cpu, ArrowUpRight, Lock
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';

const _rawApi = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const API_URL = _rawApi.endsWith('/api') ? _rawApi : `${_rawApi.replace(/\/$/, '')}/api`;

function formatBytes(bytes, decimals = 2) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function getUsageStatus(percentage) {
    if (percentage >= 95) {
        return {
            label: 'Critical Usage',
            color: 'rose',
            badgeBg: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
            barGradient: 'from-rose-500 to-red-600',
            pulseColor: 'bg-rose-500',
        };
    }
    if (percentage >= 85) {
        return {
            label: 'High Usage',
            color: 'orange',
            badgeBg: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
            barGradient: 'from-orange-500 to-amber-600',
            pulseColor: 'bg-orange-500',
        };
    }
    if (percentage >= 70) {
        return {
            label: 'Warning Level',
            color: 'amber',
            badgeBg: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
            barGradient: 'from-amber-500 to-yellow-500',
            pulseColor: 'bg-amber-500',
        };
    }
    return {
        label: 'Optimal Capacity',
        color: 'emerald',
        badgeBg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
        barGradient: 'from-emerald-500 to-teal-500',
        pulseColor: 'bg-emerald-500',
    };
}

export default function Database() {
    const { user } = useAuth();
    const { showToast } = useToast();
    const { confirm } = useConfirm();

    // Storage telemetry state
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [stats, setStats] = useState(null);
    const [error, setError] = useState(null);

    // Filter & search for tables
    const [tableSearch, setTableSearch] = useState('');

    // Reference Capacity Modal State
    const [showConfigModal, setShowConfigModal] = useState(false);
    const [capacityInput, setCapacityInput] = useState('');
    const [capacityUnit, setCapacityUnit] = useState('MB');
    const [savingCapacity, setSavingCapacity] = useState(false);

    // Maintenance Actions State
    const [isClearing, setIsClearing] = useState(false);
    const [isResetting, setIsResetting] = useState(false);

    const isAdmin = user?.role === 'ADMIN';

    // Fetch storage telemetry with safe fallback
    const fetchStorageStats = useCallback(async (forceRefresh = false) => {
        if (!isAdmin) return;
        if (forceRefresh) setRefreshing(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/uploads/storage/stats${forceRefresh ? '?refresh=true' : ''}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!res.ok) {
                if (res.status === 403) throw new Error('Access denied: Admin permissions required.');
                throw new Error('Could not establish telemetry link with storage backend.');
            }

            const data = await res.json();
            setStats(data);
            setError(null);
        } catch (err) {
            console.error('Storage Telemetry Fetch Error:', err);
            setError(err.message || 'Telemetry unavailable');
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

    // Save or Clear Reference Capacity
    const handleSaveCapacity = async (e) => {
        if (e) e.preventDefault();
        setSavingCapacity(true);
        try {
            let capacityMB = null;
            if (capacityInput.trim() !== '') {
                const parsed = Number(capacityInput);
                if (isNaN(parsed) || parsed <= 0) {
                    showToast('Please enter a valid positive capacity value.', 'error');
                    setSavingCapacity(false);
                    return;
                }
                capacityMB = capacityUnit === 'GB' ? Math.round(parsed * 1024) : Math.round(parsed);
            }

            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/uploads/storage/db-capacity`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ capacityMB })
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || 'Failed to update reference capacity');
            }

            showToast(
                capacityMB 
                    ? `Database reference monitoring capacity set to ${capacityMB} MB.`
                    : 'Reference capacity unconfigured. System will display unconfigured status.',
                'success'
            );

            setShowConfigModal(false);
            fetchStorageStats(true);
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            setSavingCapacity(false);
        }
    };

    // Clear Activity Logs
    const handleClearActivity = async () => {
        const isConfirmed = await confirm({
            title: 'Purge Operational Logs',
            message: 'Are you sure you want to permanently clear all Audit Logs and Asset Timeline history? Core inventory records (Assets, Employees, Locations, Settings) will remain intact.',
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
            fetchStorageStats(true);
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            setIsClearing(false);
        }
    };

    // Wipe Database
    const handleResetDatabase = async () => {
        const confirmText = await confirm({
            type: 'prompt',
            title: 'Factory Reset System Database',
            message: "CRITICAL ACTION: This will permanently delete ALL Inventory Data including Assets, Employees, Locations, Departments, Support Tickets, and Logs. Administrator accounts and system configuration settings will be preserved. Type 'CONFIRM' to proceed.",
            inputPlaceholder: "Type 'CONFIRM'",
            confirmText: 'Wipe Database'
        });
        
        if (confirmText !== 'CONFIRM') {
            showToast("Database reset operation cancelled.", 'info');
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
            fetchStorageStats(true);
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            setIsResetting(false);
        }
    };

    // Calculate Database Metrics
    const dbMetrics = useMemo(() => {
        if (!stats?.database) return null;
        const totalBytes = stats.database.totalBytes || 0;
        const totalMB = totalBytes / (1024 * 1024);
        const refLimitMB = stats.database.configuredReferenceLimitMB;
        
        let percentage = null;
        let remainingMB = null;
        let status = null;

        if (refLimitMB && refLimitMB > 0) {
            percentage = Math.min(100, Math.round((totalMB / refLimitMB) * 100 * 10) / 10);
            remainingMB = Math.max(0, refLimitMB - totalMB);
            status = getUsageStatus(percentage);
        }

        return {
            totalBytes,
            totalMB,
            prettySize: stats.database.prettySize || formatBytes(totalBytes),
            refLimitMB,
            percentage,
            remainingMB,
            status,
            tables: stats.database.tables || [],
        };
    }, [stats]);

    // Calculate R2 Metrics
    const r2Metrics = useMemo(() => {
        if (!stats?.r2) return null;
        const totalBytes = stats.r2.totalBytes || 0;
        const refLimitBytes = stats.r2.referenceLimitBytes || (10 * 1024 * 1024 * 1024);
        const percentage = Math.min(100, Math.round((totalBytes / refLimitBytes) * 100 * 10) / 10);
        const remainingBytes = Math.max(0, refLimitBytes - totalBytes);
        const status = getUsageStatus(percentage);

        return {
            isConfigured: stats.r2.isConfigured !== false,
            totalBytes,
            totalCount: stats.r2.totalCount || 0,
            breakdown: stats.r2.breakdown || {
                images: { count: 0, bytes: 0 },
                thumbnails: { count: 0, bytes: 0 },
                documents: { count: 0, bytes: 0 },
                other: { count: 0, bytes: 0 },
            },
            refLimitBytes,
            percentage,
            remainingBytes,
            status,
        };
    }, [stats]);

    // Filtered tables for exploration
    const filteredTables = useMemo(() => {
        if (!dbMetrics?.tables) return [];
        if (!tableSearch.trim()) return dbMetrics.tables;
        const query = tableSearch.toLowerCase();
        return dbMetrics.tables.filter(t => t.tableName.toLowerCase().includes(query));
    }, [dbMetrics, tableSearch]);

    if (!isAdmin) {
        return (
            <div className="max-w-4xl mx-auto p-8 text-center bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-3xl shadow-2xl">
                <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto mb-4" />
                <h2 className="text-xl font-bold text-white mb-2">Restricted Administrative Area</h2>
                <p className="text-sm text-slate-400">Database telemetry and maintenance tools require Administrator role permissions.</p>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-300">
            {/* Top Command Center Header */}
            <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800/80 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
                <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="space-y-2">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-gradient-to-br from-blue-500/20 to-indigo-500/20 text-blue-400 border border-blue-500/30 rounded-2xl shadow-inner">
                                <DatabaseIcon className="w-6 h-6" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h1 className="text-2xl font-black tracking-tight text-white">Database & Storage Center</h1>
                                    <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                        Telemetry Live
                                    </span>
                                </div>
                                <p className="text-xs sm:text-sm text-slate-400">
                                    PostgreSQL relational engine metrics, Cloudflare R2 media statistics, and maintenance controls.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 self-start md:self-auto">
                        <button
                            onClick={() => {
                                if (dbMetrics?.refLimitMB) {
                                    setCapacityInput(String(dbMetrics.refLimitMB));
                                    setCapacityUnit('MB');
                                } else {
                                    setCapacityInput('');
                                }
                                setShowConfigModal(true);
                            }}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-750 text-slate-200 hover:text-white border border-slate-700/80 text-xs font-semibold shadow-sm transition-all duration-200 cursor-pointer active:scale-95"
                        >
                            <Settings className="w-4 h-4 text-blue-400" />
                            <span>Set DB Threshold</span>
                        </button>

                        <button
                            onClick={() => fetchStorageStats(true)}
                            disabled={refreshing || loading}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-500/20 transition-all duration-200 cursor-pointer active:scale-95 disabled:opacity-50"
                        >
                            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                            <span>{refreshing ? 'Refreshing...' : 'Refresh Metrics'}</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Top Telemetry HUD: Neon PostgreSQL & Cloudflare R2 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 1. Neon PostgreSQL Telemetry Card */}
                <div className="relative overflow-hidden bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xl flex flex-col justify-between">
                    <div className="flex items-start justify-between gap-4 mb-6">
                        <div className="flex items-center gap-3.5">
                            <div className="p-3 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-2xl">
                                <Server className="w-6 h-6" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h2 className="text-base font-bold text-white">PostgreSQL Database Engine</h2>
                                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                        Neon Serverless
                                    </span>
                                </div>
                                <p className="text-xs text-slate-400">Live storage footprint across all tables & indices</p>
                            </div>
                        </div>

                        {dbMetrics?.status ? (
                            <span className={`px-2.5 py-1 text-[11px] font-bold rounded-full border ${dbMetrics.status.badgeBg}`}>
                                {dbMetrics.status.label}
                            </span>
                        ) : (
                            <span className="px-2.5 py-1 text-[11px] font-semibold rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                                Plan: Dynamic
                            </span>
                        )}
                    </div>

                    {/* Metric Display */}
                    <div className="space-y-4 mb-6">
                        <div className="flex items-baseline justify-between">
                            <div>
                                <span className="text-3xl sm:text-4xl font-black tracking-tight text-white">
                                    {loading ? '...' : (dbMetrics?.prettySize || '0 MB')}
                                </span>
                                <span className="text-xs text-slate-400 ml-2 font-medium">Used Space</span>
                            </div>

                            {dbMetrics?.refLimitMB ? (
                                <div className="text-right">
                                    <span className="text-xs font-bold text-slate-300">
                                        {dbMetrics.percentage}%
                                    </span>
                                    <span className="text-[11px] text-slate-500 block">
                                        of {dbMetrics.refLimitMB.toLocaleString()} MB Target
                                    </span>
                                </div>
                            ) : (
                                <div className="text-right">
                                    <span className="text-xs font-semibold text-slate-400 bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60">
                                        Plan Capacity: Not Configured
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Visual Progress Bar */}
                        {dbMetrics?.refLimitMB ? (
                            <div className="space-y-1.5">
                                <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700/50">
                                    <div 
                                        className={`h-full rounded-full bg-gradient-to-r ${dbMetrics.status?.barGradient || 'from-blue-500 to-indigo-500'} transition-all duration-500`}
                                        style={{ width: `${Math.min(100, Math.max(2, dbMetrics.percentage))}%` }}
                                    />
                                </div>
                                <div className="flex justify-between items-center text-[11px] text-slate-400 pt-0.5">
                                    <span>Used: {dbMetrics.totalMB.toFixed(2)} MB</span>
                                    <span>Remaining: {dbMetrics.remainingMB.toFixed(2)} MB</span>
                                </div>
                            </div>
                        ) : (
                            <div className="p-3 bg-slate-800/40 rounded-xl border border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
                                <span>No reference monitoring threshold configured.</span>
                                <button
                                    onClick={() => setShowConfigModal(true)}
                                    className="text-blue-400 hover:text-blue-300 font-bold transition-colors"
                                >
                                    Set Monitoring Limit →
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Monitoring Clarification Note */}
                    <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                        <div className="flex items-center gap-1.5">
                            <Info className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            <span>
                                {dbMetrics?.refLimitMB 
                                    ? 'Configured Reference Capacity (Monitoring Only - Not Neon Cloud Plan Limit)' 
                                    : 'Capacity limit not configured • Monitored dynamically'}
                            </span>
                        </div>
                        <span className="font-bold text-slate-300">
                            {dbMetrics?.tables?.length || 0} Tables Total
                        </span>
                    </div>
                </div>

                {/* 2. Cloudflare R2 Object Store Card */}
                <div className="relative overflow-hidden bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xl flex flex-col justify-between">
                    <div className="flex items-start justify-between gap-4 mb-6">
                        <div className="flex items-center gap-3.5">
                            <div className="p-3 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-2xl">
                                <HardDrive className="w-6 h-6" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h2 className="text-base font-bold text-white">Cloudflare R2 Object Store</h2>
                                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                                        Private Bucket
                                    </span>
                                </div>
                                <p className="text-xs text-slate-400">Asset images, thumbnails & procurement documentation</p>
                            </div>
                        </div>

                        {r2Metrics?.status && (
                            <span className={`px-2.5 py-1 text-[11px] font-bold rounded-full border ${r2Metrics.status.badgeBg}`}>
                                {r2Metrics.status.label}
                            </span>
                        )}
                    </div>

                    {/* Metric Display */}
                    <div className="space-y-4 mb-6">
                        <div className="flex items-baseline justify-between">
                            <div>
                                <span className="text-3xl sm:text-4xl font-black tracking-tight text-white">
                                    {loading ? '...' : formatBytes(r2Metrics?.totalBytes || 0)}
                                </span>
                                <span className="text-xs text-slate-400 ml-2 font-medium">Stored Media</span>
                            </div>

                            <div className="text-right">
                                <span className="text-xs font-bold text-slate-300">
                                    {r2Metrics?.percentage || 0}%
                                </span>
                                <span className="text-[11px] text-slate-500 block">
                                    of 10 GB Free Allowance
                                </span>
                            </div>
                        </div>

                        {/* 10 GB Free Tier Gauge */}
                        <div className="space-y-1.5">
                            <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700/50">
                                <div 
                                    className={`h-full rounded-full bg-gradient-to-r ${r2Metrics?.status?.barGradient || 'from-cyan-500 to-blue-500'} transition-all duration-500`}
                                    style={{ width: `${Math.min(100, Math.max(2, r2Metrics?.percentage || 0))}%` }}
                                />
                            </div>
                            <div className="flex justify-between items-center text-[11px] text-slate-400 pt-0.5">
                                <span>Total Files: {r2Metrics?.totalCount?.toLocaleString() || 0}</span>
                                <span>Remaining Free Allowance: {formatBytes(r2Metrics?.remainingBytes || 0)}</span>
                            </div>
                        </div>
                    </div>

                    {/* 3 Micro Category Breakdown Badges */}
                    <div className="grid grid-cols-3 gap-2 pt-4 border-t border-slate-800/80">
                        <div className="p-2.5 bg-slate-800/40 rounded-xl border border-slate-800 text-center">
                            <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-400 font-bold uppercase mb-1">
                                <ImageIcon className="w-3 h-3 text-blue-400" />
                                <span>Images</span>
                            </div>
                            <span className="text-xs font-bold text-slate-200 block">
                                {r2Metrics?.breakdown?.images?.count || 0}
                            </span>
                            <span className="text-[10px] text-slate-500 block">
                                {formatBytes(r2Metrics?.breakdown?.images?.bytes || 0)}
                            </span>
                        </div>

                        <div className="p-2.5 bg-slate-800/40 rounded-xl border border-slate-800 text-center">
                            <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-400 font-bold uppercase mb-1">
                                <Layers className="w-3 h-3 text-cyan-400" />
                                <span>Thumbs</span>
                            </div>
                            <span className="text-xs font-bold text-slate-200 block">
                                {r2Metrics?.breakdown?.thumbnails?.count || 0}
                            </span>
                            <span className="text-[10px] text-slate-500 block">
                                {formatBytes(r2Metrics?.breakdown?.thumbnails?.bytes || 0)}
                            </span>
                        </div>

                        <div className="p-2.5 bg-slate-800/40 rounded-xl border border-slate-800 text-center">
                            <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-400 font-bold uppercase mb-1">
                                <FileText className="w-3 h-3 text-amber-400" />
                                <span>Documents</span>
                            </div>
                            <span className="text-xs font-bold text-slate-200 block">
                                {r2Metrics?.breakdown?.documents?.count || 0}
                            </span>
                            <span className="text-[10px] text-slate-500 block">
                                {formatBytes(r2Metrics?.breakdown?.documents?.bytes || 0)}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* PostgreSQL Table Footprint & Diagnostics Explorer */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl backdrop-blur-xl space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-xl">
                            <Cpu className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-white">PostgreSQL Table Storage Explorer</h3>
                            <p className="text-xs text-slate-400">Detailed per-table data, indices, and total disk footprint</p>
                        </div>
                    </div>

                    {/* Search Input */}
                    <div className="relative w-full sm:w-64">
                        <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder="Filter table name..."
                            value={tableSearch}
                            onChange={(e) => setTableSearch(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-slate-800 text-slate-200 placeholder:text-slate-500 text-xs rounded-xl border border-slate-700/70 focus:outline-none focus:border-blue-500 transition-colors"
                        />
                    </div>
                </div>

                {/* Table Data Grid */}
                <div className="overflow-x-auto rounded-2xl border border-slate-800">
                    <table className="w-full text-left text-xs">
                        <thead className="bg-slate-800/80 text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-slate-800">
                            <tr>
                                <th className="py-3 px-4">Database Table</th>
                                <th className="py-3 px-4 text-right">Table Data</th>
                                <th className="py-3 px-4 text-right">Indexes Size</th>
                                <th className="py-3 px-4 text-right">Total Size</th>
                                <th className="py-3 px-4 text-right">DB Weight</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 font-medium">
                            {filteredTables.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="py-8 text-center text-slate-500">
                                        No database tables matching search criteria.
                                    </td>
                                </tr>
                            ) : (
                                filteredTables.map((tbl) => {
                                    const tableTotal = Number(tbl.totalBytes) || 0;
                                    const dbTotal = dbMetrics?.totalBytes || 1;
                                    const weight = Math.min(100, Math.round((tableTotal / dbTotal) * 100 * 10) / 10);

                                    return (
                                        <tr key={tbl.tableName} className="hover:bg-slate-800/50 transition-colors group">
                                            <td className="py-3.5 px-4">
                                                <span className="font-mono text-slate-200 font-bold group-hover:text-blue-400 transition-colors">
                                                    {tbl.tableName}
                                                </span>
                                            </td>
                                            <td className="py-3.5 px-4 text-right text-slate-400">
                                                {formatBytes(tbl.tableBytes)}
                                            </td>
                                            <td className="py-3.5 px-4 text-right text-slate-400">
                                                {formatBytes(tbl.indexBytes)}
                                            </td>
                                            <td className="py-3.5 px-4 text-right text-slate-200 font-bold">
                                                {tbl.prettyTotalSize || formatBytes(tbl.totalBytes)}
                                            </td>
                                            <td className="py-3.5 px-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <span className="text-[11px] text-slate-400 w-10 text-right">{weight}%</span>
                                                    <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                                        <div 
                                                            className="h-full bg-blue-500 rounded-full"
                                                            style={{ width: `${Math.max(4, weight)}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Database Maintenance & Administrative Actions */}
            <div className="space-y-4">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl">
                        <ShieldAlert className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-white">System Maintenance & Cleanup Suite</h2>
                        <p className="text-xs text-slate-400">Perform routine log clearing or factory database resets</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Clear Activity Logs Card */}
                    <div className="relative overflow-hidden bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xl flex flex-col justify-between group hover:border-amber-500/30 transition-all duration-300">
                        <div>
                            <div className="flex items-center gap-3.5 mb-4">
                                <div className="p-3 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-2xl">
                                    <History className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-white">Clear Operational Logs</h3>
                                    <span className="text-[11px] font-semibold text-amber-400/90">Reclaim DB Table Storage</span>
                                </div>
                            </div>
                            <p className="text-xs text-slate-400 leading-relaxed mb-6">
                                Safely purges historical Audit Logs and Asset Timeline entries to reduce database bloat. Core inventory records (Assets, Employees, Locations, Departments, Settings) remain 100% intact.
                            </p>
                        </div>

                        <button
                            onClick={handleClearActivity}
                            disabled={isClearing}
                            className="w-full flex items-center justify-center gap-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 py-3 rounded-2xl text-xs font-bold transition-all duration-200 cursor-pointer active:scale-95 disabled:opacity-50"
                        >
                            {isClearing ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>Purging Historical Logs...</span>
                                </>
                            ) : (
                                <>
                                    <History className="w-4 h-4" />
                                    <span>Clear Activity Logs</span>
                                </>
                            )}
                        </button>
                    </div>

                    {/* Factory Reset Database Card */}
                    <div className="relative overflow-hidden bg-slate-900/90 border border-red-900/40 rounded-3xl p-6 sm:p-7 shadow-xl flex flex-col justify-between group hover:border-red-500/50 transition-all duration-300">
                        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none group-hover:opacity-10 transition-opacity">
                            <AlertTriangle className="w-32 h-32 text-red-500" />
                        </div>

                        <div>
                            <div className="flex items-center gap-3.5 mb-4 relative z-10">
                                <div className="p-3 bg-red-500/10 text-red-400 border border-red-500/30 rounded-2xl">
                                    <Trash2 className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-white">Factory Reset System Database</h3>
                                    <span className="text-[11px] font-bold text-red-400">Irreversible Action</span>
                                </div>
                            </div>
                            <p className="text-xs text-slate-400 leading-relaxed mb-6 relative z-10">
                                DANGER ZONE: This permanently wipes all Assets, Staff, Locations, Departments, Support Tickets, and Logs. Administrator user accounts and system configuration settings will remain intact.
                            </p>
                        </div>

                        <button
                            onClick={handleResetDatabase}
                            disabled={isResetting}
                            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold py-3 rounded-2xl text-xs shadow-lg shadow-red-600/30 transition-all duration-200 cursor-pointer active:scale-95 disabled:opacity-50 relative z-10"
                        >
                            {isResetting ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>Resetting Entire Database...</span>
                                </>
                            ) : (
                                <>
                                    <AlertTriangle className="w-4 h-4" />
                                    <span>Wipe Database</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Configure Reference Capacity Modal */}
            {showConfigModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200">
                    <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-800/50">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-xl">
                                    <Settings className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-white">Configure Reference Capacity</h3>
                                    <p className="text-xs text-slate-400">Set monitoring target for Neon PostgreSQL</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowConfigModal(false)}
                                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <form onSubmit={handleSaveCapacity} className="p-6 space-y-6">
                            <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300 leading-relaxed flex items-start gap-3">
                                <Info className="w-4 h-4 shrink-0 text-blue-400 mt-0.5" />
                                <span>
                                    <strong>Monitoring Reference Only:</strong> This setting configures visual gauge thresholds on this dashboard. It does not alter your Neon cloud server plan or enforce physical database write limits.
                                </span>
                            </div>

                            <div className="space-y-3">
                                <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block">
                                    Target Capacity Value
                                </label>
                                <div className="flex gap-3">
                                    <input
                                        type="number"
                                        min="1"
                                        step="1"
                                        placeholder="e.g. 1024 (Leave blank to unconfigure)"
                                        value={capacityInput}
                                        onChange={(e) => setCapacityInput(e.target.value)}
                                        className="flex-1 px-4 py-3 bg-slate-800 text-white rounded-2xl border border-slate-700 focus:outline-none focus:border-blue-500 text-sm font-semibold placeholder:text-slate-500"
                                    />
                                    <select
                                        value={capacityUnit}
                                        onChange={(e) => setCapacityUnit(e.target.value)}
                                        className="px-4 py-3 bg-slate-800 text-white rounded-2xl border border-slate-700 focus:outline-none focus:border-blue-500 text-sm font-bold cursor-pointer"
                                    >
                                        <option value="MB">MB</option>
                                        <option value="GB">GB</option>
                                    </select>
                                </div>
                            </div>

                            {/* Quick Preset Buttons */}
                            <div className="space-y-2">
                                <span className="text-[11px] font-bold text-slate-400 block uppercase tracking-wider">Quick Presets</span>
                                <div className="grid grid-cols-4 gap-2">
                                    {[
                                        { label: '500 MB', val: '500', unit: 'MB' },
                                        { label: '1 GB', val: '1', unit: 'GB' },
                                        { label: '2 GB', val: '2', unit: 'GB' },
                                        { label: '5 GB', val: '5', unit: 'GB' },
                                    ].map(p => (
                                        <button
                                            type="button"
                                            key={p.label}
                                            onClick={() => {
                                                setCapacityInput(p.val);
                                                setCapacityUnit(p.unit);
                                            }}
                                            className="px-3 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700 text-xs font-bold rounded-xl transition-all"
                                        >
                                            {p.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Modal Footer Buttons */}
                            <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setCapacityInput('');
                                        handleSaveCapacity();
                                    }}
                                    disabled={savingCapacity}
                                    className="px-4 py-2.5 text-xs font-bold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-xl transition-colors disabled:opacity-50"
                                >
                                    Unconfigure Limit
                                </button>

                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setShowConfigModal(false)}
                                        className="px-4 py-2.5 text-xs font-semibold text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={savingCapacity}
                                        className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-600/30 transition-all active:scale-95 disabled:opacity-50"
                                    >
                                        {savingCapacity ? 'Saving...' : 'Save Configuration'}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Footer Attribution */}
            <div className="text-center pt-4 pb-6">
                <p className="text-xs text-slate-500">
                    Euro Motors IT Asset Management &bull; Developed by <span className="font-semibold text-slate-400">Nibrahz Ajith, Ph.D</span>
                </p>
            </div>
        </div>
    );
}
