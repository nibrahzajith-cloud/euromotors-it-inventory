import { useEffect, useState, useMemo } from 'react';
import { 
  History, Search, User, Tag, Loader2, RefreshCw, Calendar, Download, 
  ShieldAlert, CheckCircle2, XCircle, AlertTriangle, ChevronDown, ChevronRight, 
  Filter, Eye, Laptop, ArrowRight, ShieldCheck, Activity, Key, 
  FileSpreadsheet, Lock, UserCheck, Check, Info, ArrowUpRight, Clock,
  Globe, Monitor, Hash, Database
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../context/ToastContext';

const _rawApi = import.meta.env.VITE_API_URL || '/api';
const API_URL = _rawApi.endsWith('/api') ? _rawApi : `${_rawApi.replace(/\/$/, '')}/api`;

// Format UTC timestamp to Sri Lanka Time (Asia/Colombo / UTC+05:30)
const formatSriLankaTime = (isoString) => {
  if (!isoString) return '-';
  try {
    const d = new Date(isoString);
    const dateStr = d.toLocaleDateString('en-GB', {
      timeZone: 'Asia/Colombo',
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
    const timeStr = d.toLocaleTimeString('en-US', {
      timeZone: 'Asia/Colombo',
      hour12: true,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    return { date: dateStr, time: timeStr, full: `${dateStr} ${timeStr}` };
  } catch (_) {
    return { date: '-', time: '-', full: '-' };
  }
};

export default function AuditLogs() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState('logs'); // 'logs' | 'security' | 'coverage'
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [securityAlerts, setSecurityAlerts] = useState([]);
  const [coverageData, setCoverageData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  // Pagination
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 1 });

  // Expanded log row for before/after diffs & metadata
  const [expandedLogId, setExpandedLogId] = useState(null);
  const [selectedDetailLog, setSelectedDetailLog] = useState(null);

  // Filter matrix
  const [filters, setFilters] = useState({
    search: '',
    module: '',
    action: '',
    status: '',
    severity: '',
    startDate: '',
    endDate: ''
  });

  // Fetch Summary Stats
  const fetchStats = async () => {
    setStatsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/audit-logs/stats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Failed to load audit stats:', err);
    } finally {
      setStatsLoading(false);
    }
  };

  // Fetch Main Logs
  const fetchLogs = async (page = 1) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      if (filters.search) params.append('search', filters.search);
      if (filters.module) params.append('module', filters.module);
      if (filters.action) params.append('action', filters.action);
      if (filters.status) params.append('status', filters.status);
      if (filters.severity) params.append('severity', filters.severity);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      params.append('page', page.toString());
      params.append('limit', '50');

      const res = await fetch(`${API_URL}/audit-logs?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to retrieve audit records');
      const data = await res.json();
      setLogs(data.logs || []);
      setPagination({
        page: data.page || 1,
        limit: data.limit || 50,
        total: data.total || 0,
        totalPages: data.totalPages || 1
      });
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Fetch Security Alerts
  const fetchSecurityAlerts = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/audit-logs/security-alerts`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSecurityAlerts(data.alerts || []);
      }
    } catch (err) {
      console.error('Failed to load security alerts:', err);
    }
  };

  // Fetch Audit Coverage Data
  const fetchCoverage = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/audit-logs/coverage`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCoverageData(data);
      }
    } catch (err) {
      console.error('Failed to load coverage monitor:', err);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchLogs(1);
    fetchSecurityAlerts();
    fetchCoverage();
  }, []);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchLogs(1);
  };

  const resetFilters = () => {
    setFilters({
      search: '',
      module: '',
      action: '',
      status: '',
      severity: '',
      startDate: '',
      endDate: ''
    });
    setTimeout(() => fetchLogs(1), 0);
  };

  // Export CSV in Sri Lanka Time
  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      if (filters.search) params.append('search', filters.search);
      if (filters.module) params.append('module', filters.module);
      if (filters.action) params.append('action', filters.action);
      if (filters.status) params.append('status', filters.status);
      if (filters.severity) params.append('severity', filters.severity);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);

      const res = await fetch(`${API_URL}/audit-logs/export?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Export generation failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Enterprise_Audit_Trail_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      showToast('Audit trail exported successfully (SLT Timestamps)', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setExporting(false);
    }
  };

  const getActionBadge = (action) => {
    switch (action) {
      case 'CREATE':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'UPDATE':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
      case 'DELETE':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
      case 'ASSIGN':
        return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30';
      case 'RETURN':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
      case 'LOGIN':
        return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30';
      case 'LOGIN_FAILED':
        return 'bg-red-500/20 text-red-300 border-red-500/40 font-bold';
      case 'PERMISSION_REVOKED':
      case 'ROLE_CHANGED':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  const getSeverityBadge = (severity) => {
    switch (severity) {
      case 'CRITICAL':
        return 'bg-red-500/20 text-red-400 border-red-500/40 font-bold';
      case 'HIGH':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'MEDIUM':
        return 'bg-blue-500/15 text-blue-400 border-blue-500/20';
      default:
        return 'bg-slate-800/80 text-slate-400 border-slate-700/60';
    }
  };

  return (
    <div className="min-h-screen bg-[#070b12] text-slate-200 p-4 md:p-8 space-y-6 antialiased">
      
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                Enterprise Audit & Governance Center
              </h1>
              <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                <span>Tamper-evident system activity trail & accountability governance</span>
                <span className="text-slate-600">•</span>
                <span className="text-slate-400 font-mono text-[11px]">Timezone: Asia/Colombo (UTC+05:30)</span>
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button 
            onClick={() => { fetchStats(); fetchLogs(pagination.page); }}
            className="p-2 bg-[#0e1524] hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-lg text-xs font-medium transition-colors"
            title="Refresh Ledger"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-400' : ''}`} />
          </button>

          <button
            onClick={handleExportCSV}
            disabled={exporting}
            className="px-3.5 py-2 bg-[#0e1524] hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all shadow-sm disabled:opacity-60"
          >
            {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />}
            Export CSV
          </button>
        </div>
      </div>

      {/* PHASE 5.1: AUDIT SUMMARY CARDS (6 Metrics) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3.5">
        <div className="p-4 rounded-xl bg-[#0e1524] border border-slate-800/80 hover:border-blue-500/30 transition-all">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Audit Events</span>
            <Activity className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <p className="text-xl font-bold font-mono text-slate-100">
            {statsLoading ? '...' : (stats?.totalEvents ?? stats?.totalLogs ?? 0).toLocaleString()}
          </p>
          <span className="text-[10px] text-slate-500 mt-1 block">Lifetime records</span>
        </div>

        <div className="p-4 rounded-xl bg-[#0e1524] border border-slate-800/80 hover:border-emerald-500/30 transition-all">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Active Operators</span>
            <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <p className="text-xl font-bold font-mono text-slate-100">
            {statsLoading ? '...' : (stats?.activeUsers ?? 0).toLocaleString()}
          </p>
          <span className="text-[10px] text-slate-500 mt-1 block">Authenticated users</span>
        </div>

        <div className="p-4 rounded-xl bg-[#0e1524] border border-slate-800/80 hover:border-rose-500/30 transition-all">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Failed Logins</span>
            <Lock className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <p className={`text-xl font-bold font-mono ${(stats?.failedLogins || 0) > 0 ? 'text-rose-400' : 'text-slate-100'}`}>
            {statsLoading ? '...' : (stats?.failedLogins ?? 0).toLocaleString()}
          </p>
          <span className="text-[10px] text-slate-500 mt-1 block">Security anomalies</span>
        </div>

        <div className="p-4 rounded-xl bg-[#0e1524] border border-slate-800/80 hover:border-indigo-500/30 transition-all">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Asset Modifications</span>
            <Laptop className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <p className="text-xl font-bold font-mono text-slate-100">
            {statsLoading ? '...' : (stats?.assetModifications ?? 0).toLocaleString()}
          </p>
          <span className="text-[10px] text-slate-500 mt-1 block">Creates, edits, returns</span>
        </div>

        <div className="p-4 rounded-xl bg-[#0e1524] border border-slate-800/80 hover:border-amber-500/30 transition-all">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Permission Events</span>
            <Key className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <p className="text-xl font-bold font-mono text-slate-100">
            {statsLoading ? '...' : (stats?.permissionChanges ?? 0).toLocaleString()}
          </p>
          <span className="text-[10px] text-slate-500 mt-1 block">Role & access changes</span>
        </div>

        <div className="p-4 rounded-xl bg-[#0e1524] border border-slate-800/80 hover:border-red-500/30 transition-all">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Critical Incidents</span>
            <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
          </div>
          <p className={`text-xl font-bold font-mono ${(stats?.criticalSecurityEvents ?? stats?.criticalEvents ?? 0) > 0 ? 'text-red-400' : 'text-slate-100'}`}>
            {statsLoading ? '...' : (stats?.criticalSecurityEvents ?? stats?.criticalEvents ?? 0).toLocaleString()}
          </p>
          <span className="text-[10px] text-slate-500 mt-1 block">Elevated risk events</span>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-slate-800 gap-2">
        <button
          onClick={() => setActiveTab('logs')}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 flex items-center gap-2 transition-all ${
            activeTab === 'logs'
              ? 'border-blue-500 text-blue-400 bg-blue-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <History className="w-4 h-4" />
          Audit Trail Ledger ({pagination.total})
        </button>

        <button
          onClick={() => setActiveTab('security')}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 flex items-center gap-2 transition-all ${
            activeTab === 'security'
              ? 'border-amber-500 text-amber-400 bg-amber-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          Security Anomaly Center ({securityAlerts.length})
        </button>

        <button
          onClick={() => setActiveTab('coverage')}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 flex items-center gap-2 transition-all ${
            activeTab === 'coverage'
              ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Database className="w-4 h-4" />
          Audit Coverage Matrix ({coverageData?.coveragePercentage || 100}%)
        </button>
      </div>

      {/* TAB 1: AUDIT TRAIL LEDGER */}
      {activeTab === 'logs' && (
        <div className="space-y-4">
          
          {/* Advanced Search & Filtering Matrix */}
          <div className="p-4 rounded-xl bg-[#0e1524] border border-slate-800/80">
            <form onSubmit={handleSearchSubmit} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
                
                {/* Search Bar */}
                <div className="lg:col-span-4 relative">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-3" />
                  <input
                    type="text"
                    name="search"
                    placeholder="Search by keyword, asset code, user name, IP..."
                    value={filters.search}
                    onChange={handleFilterChange}
                    className="w-full bg-[#070b12] border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/60"
                  />
                </div>

                {/* Module */}
                <div className="lg:col-span-2">
                  <select
                    name="module"
                    value={filters.module}
                    onChange={handleFilterChange}
                    className="w-full bg-[#070b12] border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-slate-300 focus:outline-none focus:border-blue-500/60"
                  >
                    <option value="">All Modules</option>
                    <option value="ASSETS">Assets</option>
                    <option value="ASSIGNMENTS">Assignments</option>
                    <option value="MAINTENANCE">Maintenance</option>
                    <option value="EMPLOYEES">Employees</option>
                    <option value="DEPARTMENTS">Departments</option>
                    <option value="LOCATIONS">Locations</option>
                    <option value="AUTH">Authentication</option>
                    <option value="PERMISSIONS">Permissions</option>
                  </select>
                </div>

                {/* Action */}
                <div className="lg:col-span-2">
                  <select
                    name="action"
                    value={filters.action}
                    onChange={handleFilterChange}
                    className="w-full bg-[#070b12] border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-slate-300 focus:outline-none focus:border-blue-500/60"
                  >
                    <option value="">All Actions</option>
                    <option value="CREATE">CREATE</option>
                    <option value="UPDATE">UPDATE</option>
                    <option value="DELETE">DELETE</option>
                    <option value="ASSIGN">ASSIGN</option>
                    <option value="RETURN">RETURN</option>
                    <option value="LOGIN">LOGIN</option>
                    <option value="LOGIN_FAILED">LOGIN_FAILED</option>
                    <option value="PERMISSION_REVOKED">PERMISSION_REVOKED</option>
                  </select>
                </div>

                {/* Severity */}
                <div className="lg:col-span-2">
                  <select
                    name="severity"
                    value={filters.severity}
                    onChange={handleFilterChange}
                    className="w-full bg-[#070b12] border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-slate-300 focus:outline-none focus:border-blue-500/60"
                  >
                    <option value="">All Severities</option>
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                </div>

                {/* Status */}
                <div className="lg:col-span-2">
                  <select
                    name="status"
                    value={filters.status}
                    onChange={handleFilterChange}
                    className="w-full bg-[#070b12] border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-slate-300 focus:outline-none focus:border-blue-500/60"
                  >
                    <option value="">All Statuses</option>
                    <option value="SUCCESS">Success Only</option>
                    <option value="FAILED">Failed Only</option>
                  </select>
                </div>
              </div>

              {/* Date Filters & Controls */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/60 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 text-[11px] font-medium">Filter Range:</span>
                  <input
                    type="date"
                    name="startDate"
                    value={filters.startDate}
                    onChange={handleFilterChange}
                    className="bg-[#070b12] border border-slate-800 rounded-md px-2 py-1 text-slate-300 text-xs focus:outline-none focus:border-blue-500"
                  />
                  <span className="text-slate-600">to</span>
                  <input
                    type="date"
                    name="endDate"
                    value={filters.endDate}
                    onChange={handleFilterChange}
                    className="bg-[#070b12] border border-slate-800 rounded-md px-2 py-1 text-slate-300 text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="px-3 py-1 bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white rounded-md text-xs transition-colors"
                  >
                    Clear Filters
                  </button>
                  <button
                    type="submit"
                    className="px-3.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-xs font-semibold transition-all shadow-sm flex items-center gap-1.5"
                  >
                    <Filter className="w-3 h-3" /> Apply Filter
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* Table Container */}
          <div className="bg-[#0e1524] rounded-xl border border-slate-800/80 overflow-hidden shadow-md">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#0a0f1a] border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4 w-8"></th>
                    <th className="py-3 px-4">Sri Lanka Time (Asia/Colombo)</th>
                    <th className="py-3 px-4">Authenticated Actor</th>
                    <th className="py-3 px-4">Module / Action</th>
                    <th className="py-3 px-4">Entity Record</th>
                    <th className="py-3 px-4">Activity Description</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Context</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-sans">
                  {loading ? (
                    <tr>
                      <td colSpan="8" className="py-16 text-center">
                        <Loader2 className="w-6 h-6 animate-spin text-blue-500 mx-auto mb-2" />
                        <p className="text-slate-400 text-xs font-medium">Querying enterprise audit records...</p>
                      </td>
                    </tr>
                  ) : logs.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="py-16 text-center">
                        <History className="w-10 h-10 text-slate-700 mx-auto mb-2" />
                        <p className="text-slate-300 font-semibold text-sm">No audit events match your filter criteria.</p>
                        <p className="text-slate-500 text-xs mt-1">Try resetting dates or broadening search terms.</p>
                      </td>
                    </tr>
                  ) : (
                    logs.map((log) => {
                      const timeData = formatSriLankaTime(log.createdAt);
                      const isExpanded = expandedLogId === log.id;
                      const hasDiff = Array.isArray(log.changedFields) && log.changedFields.length > 0;

                      return (
                        <>
                          <tr 
                            key={log.id} 
                            onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                            className={`hover:bg-slate-800/40 transition-colors cursor-pointer group ${
                              isExpanded ? 'bg-slate-800/50' : ''
                            }`}
                          >
                            <td className="py-3 px-4 text-center" onClick={(e) => { e.stopPropagation(); setExpandedLogId(isExpanded ? null : log.id); }}>
                              {isExpanded ? (
                                <ChevronDown className="w-3.5 h-3.5 text-blue-400" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-300" />
                              )}
                            </td>

                            {/* Timestamp in Asia/Colombo */}
                            <td className="py-3 px-4 whitespace-nowrap">
                              <div className="flex flex-col">
                                <span className="font-mono text-slate-200 text-xs font-semibold">{timeData.date}</span>
                                <span className="font-mono text-[11px] text-slate-400">{timeData.time}</span>
                              </div>
                            </td>

                            {/* Authenticated Actor (PHASE 3) */}
                            <td className="py-3 px-4 whitespace-nowrap">
                              <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-xs uppercase shrink-0">
                                  {log.userName?.charAt(0) || 'U'}
                                </div>
                                <div className="flex flex-col">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-semibold text-slate-100">{log.userName || 'System Service'}</span>
                                    {log.activityType === 'DELEGATED' && (
                                      <span className="text-[9px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-1 rounded">
                                        Delegated
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[10px] text-slate-400 truncate max-w-[140px]">
                                    {log.userEmail || (log.userRole ? `${log.userRole}` : 'System Account')}
                                  </span>
                                </div>
                              </div>
                            </td>

                            {/* Module & Action */}
                            <td className="py-3 px-4 whitespace-nowrap">
                              <div className="flex flex-col gap-1">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                  {log.module}
                                </span>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border w-fit ${getActionBadge(log.action)}`}>
                                  {log.action}
                                </span>
                              </div>
                            </td>

                            {/* Entity Record */}
                            <td className="py-3 px-4 whitespace-nowrap">
                              {log.entityCode ? (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (log.module === 'ASSETS' || log.entityType === 'ASSET') {
                                      navigate(`/assets/${log.entityId || log.entityCode}`);
                                    } else if (log.module === 'EMPLOYEES' || log.entityType === 'EMPLOYEE') {
                                      navigate(`/employees?code=${log.entityCode}`);
                                    }
                                  }}
                                  className="inline-flex items-center gap-1 font-mono text-[11px] text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 px-2 py-0.5 rounded transition-colors"
                                  title="Inspect Record"
                                >
                                  <Tag className="w-3 h-3 text-blue-400" />
                                  <span>{log.entityCode}</span>
                                  <ArrowUpRight className="w-2.5 h-2.5 ml-0.5" />
                                </button>
                              ) : log.entityId ? (
                                <span className="font-mono text-[10px] text-slate-500">
                                  #{log.entityId.slice(-8)}
                                </span>
                              ) : (
                                <span className="text-slate-600">-</span>
                              )}
                            </td>

                            {/* Description */}
                            <td className="py-3 px-4">
                              <p className="text-slate-300 max-w-sm truncate" title={log.description}>
                                {log.description}
                              </p>
                            </td>

                            {/* Status & Severity */}
                            <td className="py-3 px-4 whitespace-nowrap text-center">
                              <div className="inline-flex items-center gap-1">
                                {log.status === 'SUCCESS' ? (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                ) : (
                                  <XCircle className="w-3.5 h-3.5 text-rose-400" />
                                )}
                                <span className={`px-1.5 py-0.2 rounded text-[9px] font-semibold border ${getSeverityBadge(log.severity)}`}>
                                  {log.severity || 'LOW'}
                                </span>
                              </div>
                            </td>

                            {/* Context & Detail */}
                            <td className="py-3 px-4 whitespace-nowrap text-right">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedDetailLog(log);
                                }}
                                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
                                title="Open Event Inspector"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>

                          {/* EXPANDABLE DIFF & EXECUTION ROW (PHASE 4) */}
                          {isExpanded && (
                            <tr className="bg-[#0b101c] border-y border-slate-800">
                              <td colSpan="8" className="p-4 pl-12 space-y-4">
                                
                                {/* Before / After Comparison */}
                                {hasDiff ? (
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                      <span className="text-[11px] font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                                        <Activity className="w-3.5 h-3.5" />
                                        Field Changes ({log.changedFields.length} Modified)
                                      </span>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                      {log.changedFields.map((change, idx) => (
                                        <div key={idx} className="p-2.5 rounded-lg bg-[#070b14] border border-slate-800/80 space-y-1">
                                          <div className="flex justify-between items-center">
                                            <span className="text-[10px] font-mono font-bold text-slate-300 uppercase">
                                              {change.field}
                                            </span>
                                          </div>
                                          <div className="flex items-center gap-2 text-xs">
                                            <span className="font-mono text-rose-400/90 line-through text-[11px] bg-rose-500/10 px-1 rounded truncate max-w-[120px]">
                                              {change.from !== null && change.from !== undefined ? String(change.from) : 'null'}
                                            </span>
                                            <ArrowRight className="w-3 h-3 text-slate-500 shrink-0" />
                                            <span className="font-mono text-emerald-400 text-[11px] bg-emerald-500/10 px-1 rounded truncate max-w-[120px]">
                                              {change.to !== null && change.to !== undefined ? String(change.to) : 'null'}
                                            </span>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="text-slate-400 text-xs italic">
                                    No granular field mutations recorded for this operation type.
                                  </div>
                                )}

                                {/* Technical Telemetry Footer */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-800/60 text-[11px]">
                                  <div>
                                    <span className="text-slate-500 block text-[10px] uppercase">Client IP Address</span>
                                    <span className="font-mono text-slate-300">{log.ipAddress || 'Internal / Local'}</span>
                                  </div>
                                  <div>
                                    <span className="text-slate-500 block text-[10px] uppercase">User Agent / Client</span>
                                    <span className="text-slate-300 truncate block max-w-xs" title={log.userAgent}>
                                      {log.userAgent || 'REST API Client'}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-slate-500 block text-[10px] uppercase">Activity Mode</span>
                                    <span className="font-mono text-slate-300">{log.activityType || 'HUMAN'}</span>
                                  </div>
                                  <div>
                                    <span className="text-slate-500 block text-[10px] uppercase">Correlation ID</span>
                                    <span className="font-mono text-slate-400 truncate block">{log.correlationId || log.id}</span>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="p-3 bg-[#0a0f1a] border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span>
                Showing page <span className="font-bold text-slate-200">{pagination.page}</span> of{' '}
                <span className="font-bold text-slate-200">{pagination.totalPages}</span> ({pagination.total} total events)
              </span>

              <div className="flex items-center gap-1.5">
                <button
                  disabled={pagination.page <= 1}
                  onClick={() => fetchLogs(pagination.page - 1)}
                  className="px-2.5 py-1 rounded bg-[#0e1524] border border-slate-800 hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none text-slate-300"
                >
                  Previous
                </button>
                <button
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => fetchLogs(pagination.page + 1)}
                  className="px-2.5 py-1 rounded bg-[#0e1524] border border-slate-800 hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none text-slate-300"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SECURITY ANOMALY MONITOR */}
      {activeTab === 'security' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-[#0e1524] border border-slate-800/80">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              Real-time Security Incidents & Threat Telemetry
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Automated anomaly detection flagging unauthorized access attempts, failed authentication bursts, role tampering, and high-risk operations.
            </p>
          </div>

          <div className="bg-[#0e1524] rounded-xl border border-slate-800/80 overflow-hidden">
            {securityAlerts.length === 0 ? (
              <div className="p-12 text-center">
                <ShieldCheck className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
                <h4 className="text-sm font-bold text-slate-200">Zero Critical Security Anomalies</h4>
                <p className="text-xs text-slate-500 mt-1">All audit trails indicate compliant operator activity.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-800/80">
                {securityAlerts.map((alert) => {
                  const time = formatSriLankaTime(alert.createdAt);
                  return (
                    <div key={alert.id} className="p-4 hover:bg-slate-800/30 transition-colors flex items-start gap-4">
                      <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 shrink-0">
                        <ShieldAlert className="w-5 h-5" />
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-red-400 uppercase tracking-wider">
                            {alert.action} • {alert.module}
                          </span>
                          <span className="font-mono text-xs text-slate-400">{time.full}</span>
                        </div>
                        <p className="text-xs text-slate-200 font-medium">{alert.description}</p>
                        <div className="flex items-center gap-3 text-[10px] text-slate-500 font-mono pt-1">
                          <span>Actor: {alert.userName || 'Unknown'}</span>
                          <span>IP: {alert.ipAddress || 'Internal'}</span>
                          <span>Severity: {alert.severity}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: AUDIT COVERAGE MONITOR (PHASE 8) */}
      {activeTab === 'coverage' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-[#0e1524] border border-slate-800/80 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Database className="w-4 h-4 text-emerald-400" />
                Auditable Operations Registry & Telemetry Coverage
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Monitors all registered business operations to guarantee zero untracked state mutations.
              </p>
            </div>
            <div className="text-right">
              <span className="text-2xl font-bold font-mono text-emerald-400">
                {coverageData?.coveragePercentage || 100}%
              </span>
              <span className="block text-[10px] uppercase font-bold text-slate-500">Coverage Score</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {(coverageData?.operations || []).map((op, idx) => (
              <div key={idx} className="p-3.5 rounded-xl bg-[#0e1524] border border-slate-800/80 hover:border-slate-700 transition-all flex items-start gap-3">
                <div className={`p-2 rounded-lg shrink-0 ${
                  op.healthy 
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                }`}>
                  {op.healthy ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                </div>
                <div className="overflow-hidden flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">{op.module}</span>
                    <span className="text-[9px] font-mono text-slate-500">{op.method}</span>
                  </div>
                  <h4 className="text-xs font-semibold text-slate-200 truncate mt-0.5">{op.operation}</h4>
                  <p className="text-[10px] text-slate-400 font-mono truncate mt-0.5">{op.route}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* EVENT DETAIL INSPECTOR MODAL */}
      {selectedDetailLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#0e1524] border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-[#0a0f1a]">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-blue-400" />
                <h3 className="text-sm font-bold text-white">Audit Event Inspector</h3>
              </div>
              <button 
                onClick={() => setSelectedDetailLog(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs font-sans">
              <div className="grid grid-cols-2 gap-3 p-3 bg-[#070b12] rounded-xl border border-slate-800">
                <div>
                  <span className="text-slate-500 text-[10px] uppercase block">Audit ID</span>
                  <span className="font-mono text-slate-300">{selectedDetailLog.id}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] uppercase block">Timestamp (Asia/Colombo)</span>
                  <span className="font-mono text-slate-300">{formatSriLankaTime(selectedDetailLog.createdAt).full}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] uppercase block">Responsible Operator</span>
                  <span className="text-slate-200 font-semibold">{selectedDetailLog.userName || 'System'}</span>
                  <span className="text-[10px] text-slate-400 block">{selectedDetailLog.userEmail}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] uppercase block">Role & Department</span>
                  <span className="text-slate-300 font-mono">{selectedDetailLog.userRole || 'SYSTEM'} • {selectedDetailLog.departmentName || 'Global'}</span>
                </div>
              </div>

              <div>
                <span className="text-slate-400 text-[11px] font-bold uppercase block mb-1">Description</span>
                <p className="p-3 bg-[#070b12] rounded-xl border border-slate-800 text-slate-200 leading-relaxed">
                  {selectedDetailLog.description}
                </p>
              </div>

              {Array.isArray(selectedDetailLog.changedFields) && selectedDetailLog.changedFields.length > 0 && (
                <div>
                  <span className="text-slate-400 text-[11px] font-bold uppercase block mb-1">State Mutation Diffs</span>
                  <div className="space-y-1.5">
                    {selectedDetailLog.changedFields.map((change, idx) => (
                      <div key={idx} className="p-2.5 rounded-lg bg-[#070b12] border border-slate-800 flex items-center justify-between">
                        <span className="font-mono font-bold text-slate-300 text-[11px]">{change.field}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-rose-400 line-through text-[11px] bg-rose-500/10 px-1.5 py-0.5 rounded">
                            {change.from !== null && change.from !== undefined ? String(change.from) : 'null'}
                          </span>
                          <ArrowRight className="w-3 h-3 text-slate-500" />
                          <span className="font-mono text-emerald-400 text-[11px] bg-emerald-500/10 px-1.5 py-0.5 rounded">
                            {change.to !== null && change.to !== undefined ? String(change.to) : 'null'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <span className="text-slate-400 text-[11px] font-bold uppercase block mb-1">Client Execution Context</span>
                <div className="p-3 bg-[#070b12] rounded-xl border border-slate-800 font-mono text-[11px] space-y-1 text-slate-400">
                  <div><span className="text-slate-600">IP:</span> {selectedDetailLog.ipAddress || 'Internal'}</div>
                  <div><span className="text-slate-600">User Agent:</span> {selectedDetailLog.userAgent || 'REST API Client'}</div>
                  <div><span className="text-slate-600">Correlation ID:</span> {selectedDetailLog.correlationId || selectedDetailLog.id}</div>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-800 bg-[#0a0f1a] flex justify-end">
              <button
                onClick={() => setSelectedDetailLog(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-semibold text-xs transition-colors"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
