import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  Activity, MonitorSmartphone, UserCheck, CheckCircle2, 
  Wrench, ShieldCheck, Database, Server, Clock, History, 
  ChevronRight, PlusCircle, QrCode, FileText, ArrowRight,
  TrendingUp, TrendingDown, Building2, MapPin, AlertTriangle, Sparkles,
  RefreshCw, Layers, ShieldAlert, Cpu, ArrowUpRight
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, PieChart, Pie, Cell, Sector
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const _rawApi = import.meta.env.VITE_API_URL || '/api';
const API_URL = _rawApi.endsWith('/api') ? _rawApi : `${_rawApi.replace(/\/$/, '')}/api`;

const useCountUp = (end, duration = 1600) => {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let startTimestamp = null;
    const endVal = Number(end) || 0;
    if (endVal === 0) {
      setCount(0);
      return;
    }
    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      setCount(Math.floor(progress * endVal));
      if (progress < 1) {
        window.requestAnimationFrame(step);
      } else {
        setCount(endVal);
      }
    };
    window.requestAnimationFrame(step);
  }, [end, duration]);
  return count;
};

// Enterprise Surface Container
const EnterpriseCard = ({ children, className = '', onClick, hoverGlow = false }) => (
  <motion.div 
    whileHover={onClick ? { y: -2, transition: { duration: 0.2 } } : {}}
    onClick={onClick}
    className={`relative bg-[#0d131f]/90 dark:bg-[#0c121e]/95 backdrop-blur-md border border-slate-800/80 hover:border-slate-700/80 rounded-xl overflow-hidden shadow-lg shadow-black/20 transition-all duration-200 ${onClick ? 'cursor-pointer' : ''} ${className}`}
  >
    <div className="relative z-10 p-5">
      {children}
    </div>
  </motion.div>
);

// Enterprise KPI Card
const ModernKPICard = ({ title, value, trend, type, icon: Icon, accentColor, onClick }) => {
  const animatedValue = useCountUp(value);

  // Calibrated enterprise accent themes
  const colorMap = {
    blue: {
      border: 'hover:border-blue-500/40',
      badge: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
      iconBox: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
      glow: 'from-blue-600/10',
    },
    emerald: {
      border: 'hover:border-emerald-500/40',
      badge: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
      iconBox: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
      glow: 'from-emerald-600/10',
    },
    indigo: {
      border: 'hover:border-indigo-500/40',
      badge: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
      iconBox: 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20',
      glow: 'from-indigo-600/10',
    },
    purple: {
      border: 'hover:border-purple-500/40',
      badge: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
      iconBox: 'bg-purple-500/10 text-purple-400 border border-purple-500/20',
      glow: 'from-purple-600/10',
    },
    cyan: {
      border: 'hover:border-cyan-500/40',
      badge: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
      iconBox: 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20',
      glow: 'from-cyan-600/10',
    },
    teal: {
      border: 'hover:border-teal-500/40',
      badge: 'text-teal-400 bg-teal-500/10 border-teal-500/20',
      iconBox: 'bg-teal-500/10 text-teal-400 border border-teal-500/20',
      glow: 'from-teal-600/10',
    },
    amber: {
      border: 'hover:border-amber-500/40',
      badge: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
      iconBox: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
      glow: 'from-amber-600/10',
    },
    rose: {
      border: 'hover:border-rose-500/40',
      badge: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
      iconBox: 'bg-rose-500/10 text-rose-400 border border-rose-500/20',
      glow: 'from-rose-600/10',
    }
  };

  const currentTheme = colorMap[accentColor] || colorMap.blue;

  return (
    <motion.div 
      whileHover={onClick ? { y: -2, transition: { duration: 0.15 } } : {}}
      onClick={onClick}
      className={`group relative bg-[#0e1524] border border-slate-800/80 ${currentTheme.border} rounded-xl p-5 shadow-sm hover:shadow-md transition-all duration-200 ${onClick ? 'cursor-pointer' : ''}`}
    >
      <div className={`absolute inset-0 bg-gradient-to-b ${currentTheme.glow} to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-xl`} />
      
      <div className="relative z-10">
        <div className="flex justify-between items-start mb-3">
          <div className={`p-2.5 rounded-lg ${currentTheme.iconBox}`}>
            <Icon className="w-4 h-4" />
          </div>
          <div className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md border ${
            type === 'up' 
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
              : type === 'down' 
              ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' 
              : 'bg-slate-800 text-slate-400 border-slate-700/60'
          }`}>
            {type === 'up' ? <TrendingUp className="w-3 h-3" /> : type === 'down' ? <TrendingDown className="w-3 h-3" /> : null}
            <span>{trend}</span>
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">{title}</p>
          <div className="flex items-baseline justify-between">
            <h3 className="text-2xl font-bold tracking-tight text-slate-100 font-mono">
              {animatedValue.toLocaleString()}
            </h3>
            <ArrowUpRight className="w-3.5 h-3.5 text-slate-600 opacity-0 group-hover:opacity-100 group-hover:text-slate-400 transition-all duration-150" />
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// Donut Active Shape Component
const renderActiveDonutShape = (props) => {
  const RADIAN = Math.PI / 180;
  const { cx, cy, midAngle, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent, value } = props;
  const sin = Math.sin(-midAngle * RADIAN);
  const cos = Math.cos(-midAngle * RADIAN);
  const sx = cx + (outerRadius + 8) * cos;
  const sy = cy + (outerRadius + 8) * sin;
  const mx = cx + (outerRadius + 20) * cos;
  const my = cy + (outerRadius + 20) * sin;
  const ex = mx + (cos >= 0 ? 1 : -1) * 16;
  const ey = my;
  const textAnchor = cos >= 0 ? 'start' : 'end';

  return (
    <g>
      <Sector 
        cx={cx} 
        cy={cy} 
        innerRadius={innerRadius} 
        outerRadius={outerRadius + 4} 
        startAngle={startAngle} 
        endAngle={endAngle} 
        fill={fill} 
      />
      <Sector 
        cx={cx} 
        cy={cy} 
        startAngle={startAngle} 
        endAngle={endAngle} 
        innerRadius={outerRadius + 6} 
        outerRadius={outerRadius + 8} 
        fill={fill} 
        fillOpacity={0.4}
      />
      <path d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`} stroke={fill} fill="none" strokeWidth={1.5} />
      <circle cx={ex} cy={ey} r={2.5} fill={fill} stroke="none" />
      <text x={ex + (cos >= 0 ? 1 : -1) * 8} y={ey} textAnchor={textAnchor} fill="#cbd5e1" className="text-xs font-semibold">
        {`${value} Units`}
      </text>
      <text x={ex + (cos >= 0 ? 1 : -1) * 8} y={ey} dy={14} textAnchor={textAnchor} fill="#94a3b8" className="text-[10px]">
        {`(${(percent * 100).toFixed(1)}%)`}
      </text>
    </g>
  );
};

const CACHE_KEY = 'analyticsDashboardCache';
const CACHE_TTL_MS = 5 * 60 * 1000;

const loadCache = () => {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { data, timestamp } = JSON.parse(raw);
    return { data, timestamp, isStale: Date.now() - timestamp > CACHE_TTL_MS };
  } catch (_) { return null; }
};

const saveCache = (data) => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
  } catch (_) {}
};

export default function AnalyticsDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const cached = React.useMemo(() => loadCache(), []);
  const [data, setData] = useState(cached?.data ?? null);
  const [loading, setLoading] = useState(!cached);
  const [revalidating, setRevalidating] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [currentTime, setCurrentTime] = useState('');

  // Clock in Sri Lanka timezone
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleString('en-US', {
        timeZone: 'Asia/Colombo',
        hour12: true,
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }));
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchData = async (isBackground = false) => {
    if (isBackground) setRevalidating(true);

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/dashboard/advanced`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch dashboard metrics');
      const result = await res.json();
      setData(result);
      saveCache(result);
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
    } finally {
      setLoading(false);
      setRevalidating(false);
    }
  };

  useEffect(() => {
    if (cached && !cached.isStale) {
      fetchData(true);
    } else {
      fetchData(false);
    }

    let interval;
    if (autoRefresh) {
      interval = setInterval(() => fetchData(true), 30000);
    }
    return () => clearInterval(interval);
  }, [autoRefresh]);

  // Inventory Donut Data
  const chartData = useMemo(() => {
    if (!data || !data.summary) return [];
    return [
      { name: 'Available', value: data.summary.available?.value || 0, color: '#10b981' },
      { name: 'Assigned', value: data.summary.assigned?.value || 0, color: '#3b82f6' },
      { name: 'Repair', value: data.summary.repair?.value || 0, color: '#f59e0b' },
      { name: 'Warranty Risk', value: data.summary.warranty?.value || 0, color: '#ef4444' }
    ];
  }, [data]);

  const totalInventoryUnits = useMemo(() => {
    return chartData.reduce((acc, curr) => acc + (Number(curr.value) || 0), 0);
  }, [chartData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#070b12] text-slate-300 p-4 md:p-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="h-7 w-64 bg-slate-800/80 rounded-md animate-pulse" />
            <div className="h-4 w-96 bg-slate-800/50 rounded-md animate-pulse" />
          </div>
          <div className="flex gap-3">
            <div className="h-9 w-32 bg-slate-800/80 rounded-lg animate-pulse" />
            <div className="h-9 w-32 bg-slate-800/80 rounded-lg animate-pulse" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
            <div key={i} className="bg-[#0e1524] rounded-xl p-5 border border-slate-800/80 h-32 animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 h-[380px] bg-[#0e1524] rounded-xl border border-slate-800/80 animate-pulse" />
          <div className="lg:col-span-4 h-[380px] bg-[#0e1524] rounded-xl border border-slate-800/80 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070b12] text-slate-200 p-4 md:p-8 space-y-6 antialiased selection:bg-blue-600/30">
      
      {/* Top Header & Telemetry Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-800/60">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
              <Cpu className="w-6 h-6 text-blue-500" />
              IT Control Center & Analytics
            </h1>
            {revalidating && (
              <span className="flex items-center gap-1.5 text-[11px] font-medium text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded-full px-2.5 py-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                Live Sync
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1 flex items-center gap-2">
            <span>Operational fleet telemetry & lifecycle management</span>
            <span className="text-slate-600">•</span>
            <span className="text-slate-400 font-mono text-[11px]">SLT: {currentTime || 'Asia/Colombo'}</span>
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button 
            onClick={() => fetchData(true)}
            className="p-2 bg-[#0e1524] hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-lg text-xs font-medium transition-colors"
            title="Manual Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${revalidating ? 'animate-spin text-blue-400' : ''}`} />
          </button>
          
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#0e1524] border border-slate-800 rounded-lg text-xs font-medium text-slate-300">
            <span className={`w-2 h-2 rounded-full ${autoRefresh ? 'bg-emerald-400 shadow-[0_0_8px_#10b981]' : 'bg-slate-500'}`} />
            <span>Auto Refresh</span>
            <button 
              onClick={() => setAutoRefresh(!autoRefresh)} 
              className="ml-1 text-blue-400 hover:text-blue-300 font-semibold uppercase text-[10px]"
            >
              [{autoRefresh ? 'ON' : 'OFF'}]
            </button>
          </div>

          <button 
            onClick={() => navigate('/reports')}
            className="px-3.5 py-1.5 bg-blue-600/90 hover:bg-blue-600 border border-blue-500/50 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
          >
            <History className="w-3.5 h-3.5" />
            Audit Reports
          </button>
        </div>
      </div>

      {/* PHASE 2.2: ALL 8 KPI CARDS PRESERVED & REDESIGNED */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <ModernKPICard 
          title="Total Assets" 
          value={data?.summary?.totalAssets?.value || 0} 
          trend={`+${data?.summary?.totalAssets?.trend || 0} wk`} 
          type="up" 
          icon={MonitorSmartphone} 
          accentColor="blue" 
          onClick={() => navigate('/assets')} 
        />
        <ModernKPICard 
          title="Assets in Store" 
          value={data?.summary?.inStoreAssets?.value || data?.summary?.available?.value || 0} 
          trend={`+${data?.summary?.inStoreAssets?.trend || data?.summary?.available?.trend || 0} rtr`} 
          type="up" 
          icon={Server} 
          accentColor="emerald" 
          onClick={() => navigate('/assets?status=AVAILABLE')} 
        />
        <ModernKPICard 
          title="Assigned to Employees" 
          value={data?.summary?.assigned?.value || 0} 
          trend={`+${data?.summary?.assigned?.trend || 0} day`} 
          type="up" 
          icon={UserCheck} 
          accentColor="indigo" 
          onClick={() => navigate('/assets?status=ASSIGNED')} 
        />
        <ModernKPICard 
          title="Assigned to Departments" 
          value={data?.summary?.departmentAssets?.value || data?.summary?.department?.value || 0} 
          trend={`+${data?.summary?.departmentAssets?.trend || data?.summary?.department?.trend || 0} mnt`} 
          type="up" 
          icon={Building2} 
          accentColor="purple" 
          onClick={() => navigate('/assets?status=ASSIGNED')} 
        />
        <ModernKPICard 
          title="Assigned to Locations" 
          value={data?.summary?.locationAssets?.value || data?.summary?.location?.value || 0} 
          trend={`+${data?.summary?.locationAssets?.trend || data?.summary?.location?.trend || 0} mnt`} 
          type="neutral" 
          icon={MapPin} 
          accentColor="cyan" 
          onClick={() => navigate('/assets?status=ASSIGNED')} 
        />
        <ModernKPICard 
          title="Shared Assets" 
          value={data?.summary?.sharedAssets?.value || data?.summary?.shared?.value || 0} 
          trend={`+${data?.summary?.sharedAssets?.trend || data?.summary?.shared?.trend || 0} mnt`} 
          type="neutral" 
          icon={Activity} 
          accentColor="teal" 
          onClick={() => navigate('/assets?status=ASSIGNED')} 
        />
        <ModernKPICard 
          title="Assets Under Repair" 
          value={data?.summary?.repair?.value || 0} 
          trend={`${data?.summary?.repair?.trend || 0} mnt`} 
          type="neutral" 
          icon={Wrench} 
          accentColor="amber" 
          onClick={() => navigate('/maintenance')} 
        />
        <ModernKPICard 
          title="Warranty Alerts" 
          value={data?.summary?.warranty?.value || 0} 
          trend={`${data?.summary?.warranty?.trend || 0} rsk`} 
          type="down" 
          icon={ShieldCheck} 
          accentColor="rose" 
          onClick={() => navigate('/reports')} 
        />
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column (8 cols): Charts & Analytics */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Section 1: Asset Activity Timeline */}
          <EnterpriseCard className="h-[390px]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-4 border-b border-slate-800/80 gap-3">
              <div>
                <h3 className="text-sm font-bold tracking-wider text-slate-100 uppercase flex items-center gap-2">
                  <Activity className="w-4 h-4 text-blue-400" />
                  Asset Activity Timeline
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Chronological assignments, returns, and repair trajectories</p>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-sm bg-blue-500" />
                  <span className="text-slate-300 font-medium">Assigned</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                  <span className="text-slate-300 font-medium">Returned</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-sm border-2 border-dashed border-amber-500 bg-transparent" />
                  <span className="text-slate-300 font-medium">Repairs</span>
                </div>
              </div>
            </div>

            <div className="w-full h-[290px]">
              <ResponsiveContainer width="100%" height={280} minWidth={100} minHeight={200}>
                <AreaChart data={data?.timeline || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorAssigned" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.35}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0}/>
                    </linearGradient>
                    <linearGradient id="colorReturned" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.35}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                  <XAxis dataKey="date" stroke="#64748b" fontSize={11} tickLine={false} axisLine={{ stroke: '#1e293b' }} />
                  <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#0f172a', 
                      borderColor: '#334155', 
                      borderRadius: '8px',
                      color: '#f8fafc',
                      fontSize: '12px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
                    }}
                    itemStyle={{ color: '#e2e8f0', fontSize: '12px' }}
                  />
                  <Area type="monotone" dataKey="assigned" stroke="#3b82f6" strokeWidth={2.5} fillOpacity={1} fill="url(#colorAssigned)" />
                  <Area type="monotone" dataKey="returned" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorReturned)" />
                  <Area type="monotone" dataKey="repairs" stroke="#f59e0b" strokeWidth={2} fill="transparent" strokeDasharray="4 4" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </EnterpriseCard>

          {/* Section 2: Department & Location Intelligence */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Department Overview */}
            <EnterpriseCard className="min-h-[380px]">
              <div className="flex justify-between items-center pb-3 mb-4 border-b border-slate-800/80">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-100 flex items-center gap-2">
                    <Building2 className="w-3.5 h-3.5 text-indigo-400" />
                    Department Overview
                  </h3>
                  <p className="text-[10px] text-slate-400">Staff distribution & operational allocation</p>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded">
                  Utilization
                </span>
              </div>
              <div className="space-y-4 max-h-[280px] overflow-y-auto pr-1">
                {(data?.analytics?.departments || []).map((dept) => (
                  <div key={dept.id} className="p-2.5 rounded-lg bg-[#0e1626]/70 border border-slate-800/60 hover:border-slate-700/80 transition-colors">
                    <div className="flex justify-between items-center mb-1.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-6 h-6 rounded bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                          <Building2 className="w-3 h-3" />
                        </div>
                        <div>
                          <h4 className="text-xs font-semibold text-slate-200">{dept.name}</h4>
                          <span className="text-[10px] text-slate-400">
                            {dept.count} Assets • {dept.staffCount} Staff
                          </span>
                        </div>
                      </div>
                      <span className="text-xs font-mono font-bold text-indigo-400">
                        {Math.round(dept.utilization || 0)}%
                      </span>
                    </div>
                    <div className="h-1.5 bg-slate-800/80 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-indigo-500 to-blue-500 rounded-full"
                        style={{ width: `${Math.min(dept.utilization || 0, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </EnterpriseCard>

            {/* Location Status */}
            <EnterpriseCard className="min-h-[380px]">
              <div className="flex justify-between items-center pb-3 mb-4 border-b border-slate-800/80">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-100 flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-teal-400" />
                    Location Status
                  </h3>
                  <p className="text-[10px] text-slate-400">Branch deployments & active rates</p>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded">
                  Operational
                </span>
              </div>
              <div className="space-y-4 max-h-[280px] overflow-y-auto pr-1">
                {(data?.analytics?.locations || []).map((loc) => (
                  <div key={loc.id} className="p-2.5 rounded-lg bg-[#0e1626]/70 border border-slate-800/60 hover:border-slate-700/80 transition-colors">
                    <div className="flex justify-between items-center mb-1.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-6 h-6 rounded bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
                          <MapPin className="w-3 h-3" />
                        </div>
                        <div>
                          <h4 className="text-xs font-semibold text-slate-200">{loc.name}</h4>
                          <span className="text-[10px] text-slate-400">
                            {loc.count} Units • <span className="text-amber-400">{loc.repairCount || 0} Repairs</span>
                          </span>
                        </div>
                      </div>
                      <span className="text-xs font-mono font-bold text-teal-400">
                        {Math.round(loc.activePercentage || 0)}%
                      </span>
                    </div>
                    <div className="h-1.5 bg-slate-800/80 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-teal-500 to-emerald-500 rounded-full"
                        style={{ width: `${Math.min(loc.activePercentage || 0, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </EnterpriseCard>
          </div>

          {/* Section 3: Inventory Status (FIXED) & Key Insights */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Inventory Status (FIXED Recharts Donut) */}
            <EnterpriseCard className="h-[390px] flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center pb-3 mb-2 border-b border-slate-800/80">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-100 flex items-center gap-2">
                      <Layers className="w-3.5 h-3.5 text-blue-400" />
                      Inventory Status
                    </h3>
                    <p className="text-[10px] text-slate-400">State distribution across total fleet</p>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 bg-slate-800/90 px-2 py-0.5 rounded border border-slate-700/50">
                    Total: {totalInventoryUnits}
                  </span>
                </div>
              </div>

              {/* Robust Container with explicit height to prevent 0px Recharts bug */}
              <div className="w-full h-[250px] min-h-[250px] relative flex items-center justify-center">
                {totalInventoryUnits > 0 ? (
                  <ResponsiveContainer width="100%" height={240} minWidth={100} minHeight={200}>
                    <PieChart>
                      <Pie
                        activeIndex={activeIndex}
                        activeShape={renderActiveDonutShape}
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={75}
                        dataKey="value"
                        onMouseEnter={(_, index) => setActiveIndex(index)}
                        onClick={(entry) => {
                          let status = '';
                          if (entry.name === 'Available') status = 'AVAILABLE';
                          else if (entry.name === 'Assigned') status = 'ASSIGNED';
                          else if (entry.name === 'Repair') status = 'REPAIR';
                          if (status) navigate(`/assets?status=${status}`);
                        }}
                        className="cursor-pointer outline-none"
                      >
                        {chartData.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={entry.color} 
                            stroke="#0f172a" 
                            strokeWidth={2}
                          />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center p-6 space-y-2">
                    <Database className="w-8 h-8 text-slate-600 mx-auto" />
                    <p className="text-xs text-slate-400 font-medium">No inventory units currently registered.</p>
                  </div>
                )}
              </div>

              {/* Legend row */}
              <div className="grid grid-cols-4 gap-1 pt-2 border-t border-slate-800/60 text-center">
                {chartData.map((item) => (
                  <div 
                    key={item.name} 
                    className="p-1 rounded hover:bg-slate-800/40 cursor-pointer transition-colors"
                    onClick={() => {
                      if (item.name === 'Available') navigate('/assets?status=AVAILABLE');
                      else if (item.name === 'Assigned') navigate('/assets?status=ASSIGNED');
                      else if (item.name === 'Repair') navigate('/maintenance');
                      else if (item.name === 'Warranty Risk') navigate('/reports');
                    }}
                  >
                    <div className="flex items-center justify-center gap-1.5 mb-0.5">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-[10px] text-slate-400 truncate">{item.name}</span>
                    </div>
                    <span className="text-xs font-mono font-bold text-slate-200">{item.value}</span>
                  </div>
                ))}
              </div>
            </EnterpriseCard>

            {/* Key Insights */}
            <EnterpriseCard className="h-[390px] flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center pb-3 mb-4 border-b border-slate-800/80">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-100 flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                    Key Insights
                  </h3>
                  <span className="text-[10px] text-slate-500 font-mono uppercase">AI Telemetry</span>
                </div>
              </div>

              <div className="space-y-3 flex-1 flex flex-col justify-around">
                <div className="p-3 bg-[#0d1624] border border-blue-500/20 rounded-xl flex gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 shrink-0 h-fit">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-blue-400">Fleet Concentration</p>
                    <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                      Top departments represent <span className="font-bold text-white font-mono">{Math.round((data?.analytics?.departments || []).reduce((a,b) => a+b.percentage, 0))}%</span> of total operational footprint.
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-[#0d1624] border border-indigo-500/20 rounded-xl flex gap-3">
                  <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 shrink-0 h-fit">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-400">Peak Department</p>
                    <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                      Department <span className="font-bold text-white font-mono">{data?.analytics?.departments?.[0]?.name || 'N/A'}</span> utilization is measured at <span className="text-emerald-400 font-bold font-mono">{Math.round(data?.analytics?.departments?.[0]?.utilization || 0)}%</span>.
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-[#0d1624] border border-amber-500/20 rounded-xl flex gap-3">
                  <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 shrink-0 h-fit">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400">Maintenance Queue</p>
                    <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                      Location <span className="font-bold text-white font-mono">{(data?.analytics?.locations || []).sort((a,b) => b.repairCount - a.repairCount)[0]?.name || 'N/A'}</span> has <span className="text-amber-400 font-bold font-mono">{(data?.analytics?.locations || []).sort((a,b) => b.repairCount - a.repairCount)[0]?.repairCount || 0}</span> active repair tickets.
                    </p>
                  </div>
                </div>
              </div>
            </EnterpriseCard>
          </div>
        </div>

        {/* Right Column (4 cols): Alerts, Actions, Queues */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Section 4: Notifications & Alerts */}
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-1">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-300 flex items-center gap-2">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                Notifications & Alerts
              </h3>
              <span className="text-[10px] text-slate-500 font-mono">Real-time</span>
            </div>

            {(data?.alerts?.longRepair || []).length > 0 && (
              <div className="p-3.5 bg-[#14120b] border border-amber-500/30 rounded-xl transition-all">
                <div className="flex gap-3">
                  <div className="p-2 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-lg shrink-0">
                    <Wrench className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-bold text-slate-200">Pending Repairs Alert</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">{(data?.alerts?.longRepair || []).length} assets exceeding 5-day SLA queue.</p>
                    <button 
                      onClick={() => navigate('/maintenance')} 
                      className="mt-2 text-[10px] font-bold uppercase tracking-wider text-amber-400 hover:text-amber-300 flex items-center gap-1"
                    >
                      View Repairs Queue <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {(data?.alerts?.warranty30 || 0) > 0 && (
              <div className="p-3.5 bg-[#170e12] border border-rose-500/30 rounded-xl transition-all">
                <div className="flex gap-3">
                  <div className="p-2 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-lg shrink-0">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-bold text-slate-200">Warranty Expirations</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">{data?.alerts?.warranty30 || 0} asset warranties expiring in &le;30 days.</p>
                    <button 
                      onClick={() => navigate('/reports')} 
                      className="mt-2 text-[10px] font-bold uppercase tracking-wider text-rose-400 hover:text-rose-300 flex items-center gap-1"
                    >
                      Audit Warranty Schedule <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {(data?.alerts?.hardwareRefresh || 0) > 0 && (
              <div className="p-3.5 bg-[#0b1713] border border-emerald-500/30 rounded-xl transition-all">
                <div className="flex gap-3">
                  <div className="p-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg shrink-0">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-bold text-slate-200">Hardware Refresh Pipeline</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">{data?.alerts?.hardwareRefresh || 0} operational assets are &gt;4 years old.</p>
                    <button 
                      onClick={() => navigate('/reports')} 
                      className="mt-2 text-[10px] font-bold uppercase tracking-wider text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                    >
                      View Refresh Pipeline <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {((data?.alerts?.longRepair || []).length === 0 && (data?.alerts?.warranty30 || 0) === 0 && (data?.alerts?.hardwareRefresh || 0) === 0) && (
              <div className="p-4 bg-[#0e1524] border border-slate-800 rounded-xl text-center">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
                <p className="text-xs text-slate-400">All hardware and warranty thresholds healthy.</p>
              </div>
            )}
          </div>

          {/* Section 5: Quick Actions */}
          <EnterpriseCard className="!p-0 border-slate-800">
            <div className="p-3.5 border-b border-slate-800 bg-[#0e1626]/80 flex justify-between items-center">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-200">Quick Actions</h3>
              <span className="text-[10px] text-slate-500">Shortcuts</span>
            </div>
            <div className="grid grid-cols-2 divide-x divide-y divide-slate-800">
              <button 
                onClick={() => navigate('/assets/add')} 
                className="p-4 hover:bg-slate-800/40 transition-colors flex flex-col items-center gap-2 group"
              >
                <div className="p-2 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-lg group-hover:scale-105 transition-transform">
                  <PlusCircle className="w-4 h-4" />
                </div>
                <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-300 group-hover:text-white">Add Asset</span>
              </button>

              <button 
                onClick={() => navigate('/assignments')} 
                className="p-4 hover:bg-slate-800/40 transition-colors flex flex-col items-center gap-2 group"
              >
                <div className="p-2 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-lg group-hover:scale-105 transition-transform">
                  <UserCheck className="w-4 h-4" />
                </div>
                <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-300 group-hover:text-white">Assign</span>
              </button>

              <button 
                onClick={() => navigate('/qr-code')} 
                className="p-4 hover:bg-slate-800/40 transition-colors flex flex-col items-center gap-2 group"
              >
                <div className="p-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg group-hover:scale-105 transition-transform">
                  <QrCode className="w-4 h-4" />
                </div>
                <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-300 group-hover:text-white">QR Codes</span>
              </button>

              <button 
                onClick={() => navigate('/maintenance')} 
                className="p-4 hover:bg-slate-800/40 transition-colors flex flex-col items-center gap-2 group"
              >
                <div className="p-2 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-lg group-hover:scale-105 transition-transform">
                  <Wrench className="w-4 h-4" />
                </div>
                <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-300 group-hover:text-white">Repairs</span>
              </button>
            </div>
          </EnterpriseCard>

          {/* Section 6: Asset Attention Required */}
          <EnterpriseCard className="!p-0 border-slate-800">
            <div className="p-3.5 border-b border-slate-800 bg-[#0e1626]/80 flex justify-between items-center">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-200">Asset Attention Required</h3>
              <span className="text-[10px] text-slate-500">Action Queue</span>
            </div>
            
            <div className="p-3 space-y-2 max-h-[300px] overflow-y-auto pr-1">
              {(!Array.isArray(data?.attentionRequired?.unassigned) || data.attentionRequired.unassigned.length === 0) &&
               (!Array.isArray(data?.attentionRequired?.warrantyExpiring) || data.attentionRequired.warrantyExpiring.length === 0) &&
               (!Array.isArray(data?.attentionRequired?.missingDocuments) || data.attentionRequired.missingDocuments.length === 0) &&
               (!Array.isArray(data?.attentionRequired?.underRepair) || data.attentionRequired.underRepair.length === 0) ? (
                <p className="text-xs text-slate-500 text-center py-6">All assets within standard tolerances.</p>
              ) : (
                <>
                  {(Array.isArray(data?.attentionRequired?.unassigned) ? data.attentionRequired.unassigned : []).slice(0, 3).map((asset) => (
                    <div 
                      key={`u-${asset.id}`} 
                      className="flex gap-3 p-2.5 rounded-lg bg-[#0e1626]/60 border border-slate-800/60 hover:border-slate-700/80 transition-all cursor-pointer group" 
                      onClick={() => navigate(`/assets/${asset.id}`)}
                    >
                      <div className="w-7 h-7 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                        <MonitorSmartphone className="w-3.5 h-3.5" />
                      </div>
                      <div className="overflow-hidden">
                        <p className="text-xs font-semibold text-slate-200 group-hover:text-blue-400 transition-colors">
                          Unassigned: <span className="font-mono text-white">{asset.assetCode}</span>
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5">Available for deployment</p>
                      </div>
                    </div>
                  ))}

                  {(Array.isArray(data?.attentionRequired?.warrantyExpiring) ? data.attentionRequired.warrantyExpiring : []).slice(0, 3).map((asset) => (
                    <div 
                      key={`w-${asset.id}`} 
                      className="flex gap-3 p-2.5 rounded-lg bg-[#0e1626]/60 border border-slate-800/60 hover:border-slate-700/80 transition-all cursor-pointer group" 
                      onClick={() => navigate(`/assets/${asset.id}`)}
                    >
                      <div className="w-7 h-7 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                        <ShieldCheck className="w-3.5 h-3.5" />
                      </div>
                      <div className="overflow-hidden">
                        <p className="text-xs font-semibold text-slate-200 group-hover:text-rose-400 transition-colors">
                          Warranty Due: <span className="font-mono text-white">{asset.assetCode}</span>
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5">Expiring within policy interval</p>
                      </div>
                    </div>
                  ))}

                  {(Array.isArray(data?.attentionRequired?.missingDocuments) ? data.attentionRequired.missingDocuments : []).slice(0, 3).map((asset) => (
                    <div 
                      key={`d-${asset.id}`} 
                      className="flex gap-3 p-2.5 rounded-lg bg-[#0e1626]/60 border border-slate-800/60 hover:border-slate-700/80 transition-all cursor-pointer group" 
                      onClick={() => navigate(`/assets/${asset.id}`)}
                    >
                      <div className="w-7 h-7 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                        <FileText className="w-3.5 h-3.5" />
                      </div>
                      <div className="overflow-hidden">
                        <p className="text-xs font-semibold text-slate-200 group-hover:text-amber-400 transition-colors">
                          Docs Missing: <span className="font-mono text-white">{asset.assetCode}</span>
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5">Requires invoice or purchase order</p>
                      </div>
                    </div>
                  ))}

                  {(Array.isArray(data?.attentionRequired?.underRepair) ? data.attentionRequired.underRepair : []).slice(0, 3).map((asset) => (
                    <div 
                      key={`r-${asset.id}`} 
                      className="flex gap-3 p-2.5 rounded-lg bg-[#0e1626]/60 border border-slate-800/60 hover:border-slate-700/80 transition-all cursor-pointer group" 
                      onClick={() => navigate(`/assets/${asset.id}`)}
                    >
                      <div className="w-7 h-7 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                        <Wrench className="w-3.5 h-3.5" />
                      </div>
                      <div className="overflow-hidden">
                        <p className="text-xs font-semibold text-slate-200 group-hover:text-amber-400 transition-colors">
                          Maintenance: <span className="font-mono text-white">{asset.assetCode}</span>
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5">Under active technical service</p>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>

            <button 
              onClick={() => navigate('/assets')}
              className="w-full py-2.5 text-[11px] font-bold uppercase tracking-wider text-blue-400 hover:text-blue-300 hover:bg-slate-800/40 transition-colors border-t border-slate-800 flex items-center justify-center gap-1.5"
            >
              Access Global Ledger <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </EnterpriseCard>
        </div>
      </div>

      {/* Section 7: Quick Links Navigation Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
        {[
          { label: 'Employees', icon: UserCheck, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20', nav: '/employees', desc: 'Staff directory & equipment audit' },
          { label: 'Departments', icon: Building2, color: 'text-indigo-400', bg: 'bg-indigo-500/10 border-indigo-500/20', nav: '/departments', desc: 'Organizational allocation metrics' },
          { label: 'Locations', icon: MapPin, color: 'text-teal-400', bg: 'bg-teal-500/10 border-teal-500/20', nav: '/locations', desc: 'Geographic facility inventory' },
          { label: 'Reports', icon: FileText, color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/20', nav: '/reports', desc: 'Compliance & executive summaries' }
        ].map(btn => (
          <EnterpriseCard key={btn.label} className="cursor-pointer group" onClick={() => navigate(btn.nav)}>
            <div className="flex items-center gap-3.5">
              <div className={`p-2.5 rounded-lg border ${btn.bg} ${btn.color} group-hover:scale-105 transition-transform`}>
                <btn.icon className="w-4 h-4" />
              </div>
              <div className="overflow-hidden">
                <h4 className="text-xs font-bold text-slate-200 group-hover:text-white transition-colors">{btn.label}</h4>
                <p className="text-[11px] text-slate-400 truncate mt-0.5">{btn.desc}</p>
              </div>
            </div>
          </EnterpriseCard>
        ))}
      </div>
    </div>
  );
}
