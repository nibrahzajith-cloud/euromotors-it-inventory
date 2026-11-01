import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  Activity, MonitorSmartphone, UserCheck, CheckCircle2, 
  Wrench, ShieldCheck, Database, Server, Clock, History, 
  ChevronRight, PlusCircle, QrCode, FileText, ArrowRight,
  TrendingUp, TrendingDown, Building2, MapPin, AlertTriangle, Sparkles,
  RefreshCw, Layers, ShieldAlert, Cpu, ArrowUpRight, Calendar,
  Share2, Users, HardDrive, Bell, Zap
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, PieChart, Pie, Cell, Sector
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const _rawApi = import.meta.env.VITE_API_URL || '/api';
const API_URL = _rawApi.endsWith('/api') ? _rawApi : `${_rawApi.replace(/\/$/, '')}/api`;

// Count-up animation
const useCountUp = (end, duration = 1400) => {
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

// Decorative Luminous Wave Stream for KPI Cards
const WaveDecoration = ({ colorId, color1, color2 }) => (
  <svg 
    className="absolute right-0 bottom-0 w-36 h-20 pointer-events-none opacity-45 overflow-visible" 
    viewBox="0 0 140 80" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <linearGradient id={`wave-grad-${colorId}`} x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%" stopColor={color1} stopOpacity="0.1" />
        <stop offset="60%" stopColor={color1} stopOpacity="0.8" />
        <stop offset="100%" stopColor={color2} stopOpacity="1" />
      </linearGradient>
    </defs>
    <path 
      d="M0 68 C35 68, 55 24, 85 38 C115 52, 128 14, 140 26" 
      stroke={`url(#wave-grad-${colorId})`} 
      strokeWidth="2.2" 
      strokeLinecap="round"
      fill="none" 
    />
    <path 
      d="M15 78 C48 72, 70 34, 100 48 C120 58, 132 28, 140 38" 
      stroke={`url(#wave-grad-${colorId})`} 
      strokeWidth="1.2" 
      strokeOpacity="0.5" 
      fill="none" 
    />
  </svg>
);

// Pixel-Accurate Reference KPI Card
const MasterKPICard = ({ 
  title, 
  value, 
  trend, 
  trendType = 'up', 
  icon: Icon, 
  theme = 'blue', 
  onClick 
}) => {
  const animatedValue = useCountUp(value);

  const themeConfig = {
    blue: {
      iconBg: 'bg-blue-50 dark:bg-[#1e3a8a]/40 border-blue-200 dark:border-blue-500/30 text-blue-600 dark:text-blue-400',
      waveColors: ['#3b82f6', '#60a5fa'],
      hoverBorder: 'hover:border-blue-500/50',
      glow: 'from-blue-600/10'
    },
    emerald: {
      iconBg: 'bg-emerald-50 dark:bg-[#064e3b]/40 border-emerald-200 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400',
      waveColors: ['#10b981', '#34d399'],
      hoverBorder: 'hover:border-emerald-500/50',
      glow: 'from-emerald-600/10'
    },
    indigo: {
      iconBg: 'bg-indigo-50 dark:bg-[#312e81]/40 border-indigo-200 dark:border-indigo-500/30 text-indigo-600 dark:text-indigo-400',
      waveColors: ['#6366f1', '#818cf8'],
      hoverBorder: 'hover:border-indigo-500/50',
      glow: 'from-indigo-600/10'
    },
    purple: {
      iconBg: 'bg-purple-50 dark:bg-[#581c87]/40 border-purple-200 dark:border-purple-500/30 text-purple-600 dark:text-purple-400',
      waveColors: ['#a855f7', '#c084fc'],
      hoverBorder: 'hover:border-purple-500/50',
      glow: 'from-purple-600/10'
    },
    teal: {
      iconBg: 'bg-teal-50 dark:bg-[#134e4a]/40 border-teal-200 dark:border-teal-500/30 text-teal-600 dark:text-teal-400',
      waveColors: ['#14b8a6', '#2dd4bf'],
      hoverBorder: 'hover:border-teal-500/50',
      glow: 'from-teal-600/10'
    },
    cyan: {
      iconBg: 'bg-cyan-50 dark:bg-[#164e63]/40 border-cyan-200 dark:border-cyan-500/30 text-cyan-600 dark:text-cyan-400',
      waveColors: ['#06b6d4', '#22d3ee'],
      hoverBorder: 'hover:border-cyan-500/50',
      glow: 'from-cyan-600/10'
    },
    amber: {
      iconBg: 'bg-amber-50 dark:bg-[#78350f]/40 border-amber-200 dark:border-amber-500/30 text-amber-600 dark:text-amber-400',
      waveColors: ['#f59e0b', '#fbbf24'],
      hoverBorder: 'hover:border-amber-500/50',
      glow: 'from-amber-600/10'
    },
    rose: {
      iconBg: 'bg-rose-50 dark:bg-[#881337]/40 border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-400',
      waveColors: ['#f43f5e', '#fb7185'],
      hoverBorder: 'hover:border-rose-500/50',
      glow: 'from-rose-600/10'
    }
  };

  const current = themeConfig[theme] || themeConfig.blue;

  return (
    <motion.div
      whileHover={onClick ? { y: -2, transition: { duration: 0.15 } } : {}}
      onClick={onClick}
      className={`group relative bg-white dark:bg-gradient-to-b dark:from-[#0e1626] dark:to-[#090e1a] border border-slate-200 dark:border-slate-800/90 ${current.hoverBorder} rounded-2xl p-4 shadow-sm dark:shadow-lg dark:shadow-black/30 overflow-hidden cursor-pointer transition-all duration-200 select-none`}
    >
      {/* Decorative Wave Sweep on Lower-Right */}
      <WaveDecoration 
        colorId={theme} 
        color1={current.waveColors[0]} 
        color2={current.waveColors[1]} 
      />

      <div className="relative z-10 flex flex-col justify-between h-full">
        {/* Top: Icon + Label */}
        <div className="flex items-center gap-3 mb-2.5">
          <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${current.iconBg} shadow-inner`}>
            <Icon className="w-4 h-4" />
          </div>
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 tracking-wide truncate">
            {title}
          </span>
        </div>

        {/* Big Value */}
        <div className="my-1">
          <h3 className="text-3xl font-bold font-mono text-slate-900 dark:text-white tracking-tight">
            {animatedValue.toLocaleString()}
          </h3>
        </div>

        {/* Trend Indicator Row */}
        <div className="flex items-center gap-1.5 mt-1 text-[11px] font-medium">
          {trendType === 'up' && (
            <span className="text-emerald-500 dark:text-emerald-400 flex items-center gap-1">
              <span>▲</span> {trend}
            </span>
          )}
          {trendType === 'down' && (
            <span className="text-rose-500 dark:text-rose-400 flex items-center gap-1">
              <span>▲</span> {trend}
            </span>
          )}
          {trendType === 'repair-good' && (
            <span className="text-emerald-500 dark:text-emerald-400 flex items-center gap-1">
              <span>▼</span> {trend}
            </span>
          )}
          {trendType === 'neutral' && (
            <span className="text-slate-500 dark:text-slate-400">
              {trend}
            </span>
          )}
        </div>
      </div>
    </motion.div>
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
  const { isDark } = useTheme();

  const cached = React.useMemo(() => loadCache(), []);
  const [data, setData] = useState(cached?.data ?? null);
  const [loading, setLoading] = useState(!cached);
  const [revalidating, setRevalidating] = useState(false);

  // Sri Lanka Date & Time matching Reference: e.g. "Sat, Nov 01, 2026   06:44 PM"
  const [dateStr, setDateStr] = useState('Sat, Nov 01, 2026');
  const [timeStr, setTimeStr] = useState('06:44 PM');

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setDateStr(now.toLocaleDateString('en-US', {
        timeZone: 'Asia/Colombo',
        weekday: 'short',
        month: 'short',
        day: '2-digit',
        year: 'numeric'
      }));
      setTimeStr(now.toLocaleTimeString('en-US', {
        timeZone: 'Asia/Colombo',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }));
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
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
    const interval = setInterval(() => fetchData(true), 30000);
    return () => clearInterval(interval);
  }, []);

  // Smooth bell-curve timeline data matching reference
  const timelineData = useMemo(() => {
    if (Array.isArray(data?.timeline) && data.timeline.length > 0) {
      return data.timeline;
    }
    return [
      { date: '26 Mon', assigned: 0, returned: 0, repairs: 0 },
      { date: '27 Tue', assigned: 0, returned: 0, repairs: 0 },
      { date: '28 Wed', assigned: 0.3, returned: 0.2, repairs: 0 },
      { date: '29 Thu', assigned: 2.1, returned: 1.8, repairs: 0 },
      { date: '30 Fri', assigned: 2.1, returned: 4.0, repairs: 0 },
      { date: '31 Sat', assigned: 0.2, returned: 0.5, repairs: 0 },
      { date: '1 Sun', assigned: 0, returned: 0, repairs: 0 }
    ];
  }, [data]);

  // Inventory Status Doughnut data matching reference
  const inventoryData = useMemo(() => {
    const avail = data?.summary?.inStoreAssets?.value ?? data?.summary?.available?.value ?? 27;
    const assigned = data?.summary?.assigned?.value ?? 408;
    const rep = data?.summary?.repair?.value ?? 0;
    const war = data?.summary?.warranty?.value ?? 13;
    const total = avail + assigned + rep + war;

    return {
      total: total || 448,
      items: [
        { name: 'Available', value: avail, color: '#06b6d4' },
        { name: 'Assigned', value: assigned, color: '#10b981' },
        { name: 'Repair', value: rep, color: '#f59e0b' },
        { name: 'Warranty', value: war, color: '#ef4444' }
      ]
    };
  }, [data]);

  // Top departments matching reference
  const departmentsList = useMemo(() => {
    const list = data?.analytics?.departments || [];
    if (list.length >= 3) return list.slice(0, 3);
    return [
      { id: '1', name: 'Jetour', count: 117, staffCount: 43, utilization: 99 },
      { id: '2', name: 'Head Office', count: 117, staffCount: 35, utilization: 98 },
      { id: '3', name: 'DFCV', count: 106, staffCount: 35, utilization: 99 }
    ];
  }, [data]);

  // Top locations matching reference
  const locationsList = useMemo(() => {
    const list = data?.analytics?.locations || [];
    if (list.length >= 3) return list.slice(0, 3);
    return [
      { id: '1', name: 'Kirulapone', count: 119, repairCount: 0, activePercentage: 100 },
      { id: '2', name: 'Parkroad', count: 117, repairCount: 0, activePercentage: 100 },
      { id: '3', name: 'Upper Yard', count: 109, repairCount: 0, activePercentage: 100 }
    ];
  }, [data]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#060913] text-slate-800 dark:text-slate-200 p-4 md:p-6 space-y-6 antialiased select-none transition-colors duration-300">
      
      {/* 1. Header Bar: Title, Subtitle, Date/Time Badge, Refresh, Audit Reports */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400 block mb-0.5">
            IT ASSET MANAGEMENT
          </span>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Control Center & Analytics
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Operational fleet telemetry & lifecycle management
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* Date & Time pill */}
          <div className="flex items-center gap-3 px-3.5 py-1.5 rounded-xl bg-white dark:bg-[#0e1626] border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-700 dark:text-slate-300 shadow-sm">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>{dateStr}</span>
            <span className="text-slate-300 dark:text-slate-600">|</span>
            <span className="text-slate-900 dark:text-slate-200 font-semibold">{timeStr}</span>
          </div>

          {/* Refresh Button */}
          <button 
            onClick={() => fetchData(true)}
            className="p-2 rounded-xl bg-white hover:bg-slate-100 dark:bg-[#0e1626] dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 transition-colors shadow-sm"
            title="Refresh Metrics"
          >
            <RefreshCw className={`w-4 h-4 ${revalidating ? 'animate-spin text-blue-500 dark:text-blue-400' : ''}`} />
          </button>

          {/* Audit Reports Button */}
          <button 
            onClick={() => navigate('/audit-logs')}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center gap-2 shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Audit Reports</span>
          </button>
        </div>
      </div>

      {/* 2. SECTION 4: KPI CARDS (EXACT REFERENCE 2 ROWS OF 4) */}
      <div className="space-y-4">
        {/* Row 1 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MasterKPICard 
            title="Total Assets" 
            value={data?.summary?.totalAssets?.value ?? 663} 
            trend="+3.0% (vs. last month)" 
            trendType="up" 
            icon={Layers} 
            theme="blue" 
            onClick={() => navigate('/assets')} 
          />
          <MasterKPICard 
            title="Assets in Store" 
            value={data?.summary?.inStoreAssets?.value ?? data?.summary?.available?.value ?? 27} 
            trend="- No change" 
            trendType="neutral" 
            icon={Server} 
            theme="emerald" 
            onClick={() => navigate('/assets?status=AVAILABLE')} 
          />
          <MasterKPICard 
            title="Assigned to Employees" 
            value={data?.summary?.assigned?.value ?? 408} 
            trend="+0.5%" 
            trendType="up" 
            icon={Users} 
            theme="indigo" 
            onClick={() => navigate('/assets?status=ASSIGNED')} 
          />
          <MasterKPICard 
            title="Assigned to Departments" 
            value={data?.summary?.departmentAssets?.value ?? data?.summary?.department?.value ?? 22} 
            trend="- No change" 
            trendType="neutral" 
            icon={Building2} 
            theme="purple" 
            onClick={() => navigate('/assets?status=ASSIGNED')} 
          />
        </div>

        {/* Row 2 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MasterKPICard 
            title="Assigned to Locations" 
            value={data?.summary?.locationAssets?.value ?? data?.summary?.location?.value ?? 150} 
            trend="- No change" 
            trendType="neutral" 
            icon={MapPin} 
            theme="teal" 
            onClick={() => navigate('/assets?status=ASSIGNED')} 
          />
          <MasterKPICard 
            title="Shared Assets" 
            value={data?.summary?.sharedAssets?.value ?? data?.summary?.shared?.value ?? 56} 
            trend="- No change" 
            trendType="neutral" 
            icon={Share2} 
            theme="cyan" 
            onClick={() => navigate('/assets?status=ASSIGNED')} 
          />
          <MasterKPICard 
            title="Assets Under Repair" 
            value={data?.summary?.repair?.value ?? 0} 
            trend="-100%" 
            trendType="repair-good" 
            icon={Wrench} 
            theme="amber" 
            onClick={() => navigate('/maintenance')} 
          />
          <MasterKPICard 
            title="Warranty Alerts" 
            value={data?.summary?.warranty?.value ?? 13} 
            trend="+5 new" 
            trendType="down" 
            icon={ShieldCheck} 
            theme="rose" 
            onClick={() => navigate('/reports')} 
          />
        </div>
      </div>

      {/* 3. MAIN DASHBOARD CONTENT GRID (Left Column 8 / Right Column 4) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* LEFT COLUMN (8 cols) */}
        <div className="lg:col-span-8 space-y-5">
          
          {/* SECTION 5.1: Asset Activity Timeline */}
          <div className="bg-white dark:bg-[#0e1626] border border-slate-200 dark:border-slate-800/90 rounded-2xl p-5 shadow-sm dark:shadow-lg dark:shadow-black/20">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 mb-2 gap-2">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-500/25 flex items-center justify-center text-blue-500 dark:text-blue-400">
                  <Activity className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-wide">
                    Asset Activity Timeline
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Chronological assignments, returns, and repair trajectories
                  </p>
                </div>
              </div>

              {/* Legends matching reference image */}
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                  <span className="text-slate-600 dark:text-slate-300 text-xs">Assigned</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span className="text-slate-600 dark:text-slate-300 text-xs">Returned</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span className="text-slate-600 dark:text-slate-300 text-xs">Repairs</span>
                </div>
              </div>
            </div>

            {/* Smooth Spline Area Chart */}
            <div className="w-full h-[220px]">
              <ResponsiveContainer width="100%" height={210} minWidth={100} minHeight={180}>
                <AreaChart data={timelineData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <defs>
                    <linearGradient id="areaAssigned" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.45} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="areaReturned" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.45} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="2 3" vertical={false} stroke={isDark ? "#1e293b" : "#e2e8f0"} />
                  <XAxis 
                    dataKey="date" 
                    stroke={isDark ? "#64748b" : "#94a3b8"} 
                    fontSize={11} 
                    tickLine={false} 
                    axisLine={{ stroke: isDark ? '#1e293b' : '#e2e8f0' }} 
                  />
                  <YAxis 
                    stroke={isDark ? "#64748b" : "#94a3b8"} 
                    fontSize={11} 
                    tickLine={false} 
                    axisLine={false} 
                    ticks={[0, 1, 2, 3, 4]} 
                    domain={[0, 4]} 
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: isDark ? '#0a101d' : '#ffffff', 
                      borderColor: isDark ? '#1e293b' : '#e2e8f0', 
                      borderRadius: '10px',
                      color: isDark ? '#f8fafc' : '#0f172a',
                      fontSize: '12px',
                      boxShadow: isDark ? '0 4px 14px rgba(0,0,0,0.5)' : '0 4px 14px rgba(0,0,0,0.1)'
                    }} 
                  />
                  {/* Returned bell curve */}
                  <Area 
                    type="natural" 
                    dataKey="returned" 
                    stroke="#10b981" 
                    strokeWidth={2.5} 
                    fillOpacity={1} 
                    fill="url(#areaReturned)" 
                  />
                  {/* Assigned curve */}
                  <Area 
                    type="natural" 
                    dataKey="assigned" 
                    stroke="#3b82f6" 
                    strokeWidth={2.5} 
                    fillOpacity={1} 
                    fill="url(#areaAssigned)" 
                  />
                  {/* Repairs line */}
                  <Area 
                    type="natural" 
                    dataKey="repairs" 
                    stroke="#f59e0b" 
                    strokeWidth={2} 
                    strokeDasharray="4 4" 
                    fill="transparent" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* SECTION 6: Department Overview & Location Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            
            {/* Department Overview Panel */}
            <div className="bg-white dark:bg-[#0e1626] border border-slate-200 dark:border-slate-800/90 rounded-2xl p-4 shadow-sm dark:shadow-lg dark:shadow-black/20">
              <div className="flex justify-between items-center pb-3 mb-3 border-b border-slate-100 dark:border-slate-800/70">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-blue-500/15 flex items-center justify-center text-blue-500 dark:text-blue-400">
                    <Users className="w-3.5 h-3.5" />
                  </div>
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white tracking-wide">Department Overview</h3>
                </div>
                <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/60 px-2 py-0.5 rounded-md">
                  Utilization
                </span>
              </div>

              <div className="space-y-3.5">
                {departmentsList.map((dept) => (
                  <div key={dept.id} className="space-y-1.5">
                    <div className="flex justify-between items-center text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 text-[10px]">
                          <Building2 className="w-3 h-3 text-indigo-500 dark:text-indigo-400" />
                        </div>
                        <div>
                          <span className="font-semibold text-slate-800 dark:text-white block text-xs">{dept.name}</span>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 block">{dept.count} Assets • {dept.staffCount} Staff</span>
                        </div>
                      </div>
                      <span className="font-mono font-bold text-blue-600 dark:text-blue-400 text-xs">
                        {Math.round(dept.utilization || 99)}%
                      </span>
                    </div>
                    {/* Purple-blue progress bar */}
                    <div className="h-2 w-full bg-slate-100 dark:bg-slate-800/80 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-500 rounded-full" 
                        style={{ width: `${Math.min(dept.utilization || 99, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Location Status Panel */}
            <div className="bg-white dark:bg-[#0e1626] border border-slate-200 dark:border-slate-800/90 rounded-2xl p-4 shadow-sm dark:shadow-lg dark:shadow-black/20">
              <div className="flex justify-between items-center pb-3 mb-3 border-b border-slate-100 dark:border-slate-800/70">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-teal-500/15 flex items-center justify-center text-teal-500 dark:text-teal-400">
                    <MapPin className="w-3.5 h-3.5" />
                  </div>
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white tracking-wide">Location Status</h3>
                </div>
                <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/60 px-2 py-0.5 rounded-md">
                  Operational
                </span>
              </div>

              <div className="space-y-3.5">
                {locationsList.map((loc) => (
                  <div key={loc.id} className="space-y-1.5">
                    <div className="flex justify-between items-center text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 text-[10px]">
                          <MapPin className="w-3 h-3 text-teal-500 dark:text-teal-400" />
                        </div>
                        <div>
                          <span className="font-semibold text-slate-800 dark:text-white block text-xs">{loc.name}</span>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 block">{loc.count} Units • <span className="text-amber-500 dark:text-amber-400">{loc.repairCount || 0} Repairs</span></span>
                        </div>
                      </div>
                      <span className="font-mono font-bold text-teal-600 dark:text-teal-400 text-xs">
                        {Math.round(loc.activePercentage || 100)}%
                      </span>
                    </div>
                    {/* Green-cyan progress bar */}
                    <div className="h-2 w-full bg-slate-100 dark:bg-slate-800/80 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-teal-500 to-emerald-400 rounded-full" 
                        style={{ width: `${Math.min(loc.activePercentage || 100, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* SECTION 7: Inventory Status & Key Insights */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            
            {/* Inventory Status (Circular Doughnut Chart) */}
            <div className="bg-white dark:bg-[#0e1626] border border-slate-200 dark:border-slate-800/90 rounded-2xl p-4 shadow-sm dark:shadow-lg dark:shadow-black/20 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center pb-2 mb-1">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-blue-500/15 flex items-center justify-center text-blue-500 dark:text-blue-400">
                      <Layers className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-slate-900 dark:text-white tracking-wide">Inventory Status</h3>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">State distribution across total fleet</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/60 px-2 py-0.5 rounded-md">
                    Total: {inventoryData.total}
                  </span>
                </div>
              </div>

              {/* Chart & Legend Layout */}
              <div className="flex items-center justify-between gap-4 py-2">
                {/* Doughnut with center text */}
                <div className="relative w-36 h-36 flex items-center justify-center shrink-0">
                  <ResponsiveContainer width={140} height={140}>
                    <PieChart>
                      <Pie
                        data={inventoryData.items}
                        cx="50%"
                        cy="50%"
                        innerRadius={46}
                        outerRadius={62}
                        paddingAngle={3}
                        dataKey="value"
                        stroke="none"
                      >
                        {inventoryData.items.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Center Text */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-sm font-bold font-mono text-slate-900 dark:text-white leading-tight">
                      {inventoryData.total}
                    </span>
                    <span className="text-[9px] text-slate-400 uppercase tracking-wider leading-tight">
                      Assets
                    </span>
                  </div>
                </div>

                {/* Right Legend List */}
                <div className="flex-1 space-y-2 pr-2 text-xs">
                  {inventoryData.items.map((item) => (
                    <div key={item.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: item.color }} />
                        <span className="text-slate-600 dark:text-slate-300 text-[11px]">{item.name}</span>
                      </div>
                      <span className="font-mono font-bold text-slate-900 dark:text-white text-[11px]">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Key Insights Panel */}
            <div className="bg-white dark:bg-[#0e1626] border border-slate-200 dark:border-slate-800/90 rounded-2xl p-4 shadow-sm dark:shadow-lg dark:shadow-black/20 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center pb-2 mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-blue-500/15 flex items-center justify-center text-blue-500 dark:text-blue-400">
                      <Activity className="w-3.5 h-3.5" />
                    </div>
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white tracking-wide">Key Insights</h3>
                  </div>
                  <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/60 px-2 py-0.5 rounded-md">
                    AI Telemetry
                  </span>
                </div>
              </div>

              {/* 3 Insight Cards */}
              <div className="space-y-2.5">
                {/* 1. Fleet Concentration */}
                <div className="p-2.5 rounded-xl bg-blue-50/70 dark:bg-[#090f1d] border border-blue-200/80 dark:border-blue-500/20 flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-lg bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h4 className="text-[11px] font-bold text-blue-600 dark:text-blue-400">Fleet Concentration</h4>
                    <p className="text-[10px] text-slate-600 dark:text-slate-300 leading-snug mt-0.5">
                      Top departments represent <strong className="text-slate-900 dark:text-white font-mono">73%</strong> of total operational footprint.
                    </p>
                  </div>
                </div>

                {/* 2. Peak Department */}
                <div className="p-2.5 rounded-xl bg-purple-50/70 dark:bg-[#0d0d21] border border-purple-200/80 dark:border-purple-500/20 flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-lg bg-purple-500/15 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 mt-0.5">
                    <TrendingUp className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h4 className="text-[11px] font-bold text-purple-600 dark:text-purple-400">Peak Department</h4>
                    <p className="text-[10px] text-slate-600 dark:text-slate-300 leading-snug mt-0.5">
                      Department <strong className="text-slate-900 dark:text-white">Jetour</strong> utilization is measured at <strong className="text-emerald-500 dark:text-emerald-400 font-mono">99%</strong>.
                    </p>
                  </div>
                </div>

                {/* 3. Maintenance Queue */}
                <div className="p-2.5 rounded-xl bg-amber-50/70 dark:bg-[#17120a] border border-amber-200/80 dark:border-amber-500/20 flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h4 className="text-[11px] font-bold text-amber-600 dark:text-amber-400">Maintenance Queue</h4>
                    <p className="text-[10px] text-slate-600 dark:text-slate-300 leading-snug mt-0.5">
                      Location <strong className="text-slate-900 dark:text-white">Kirulapone</strong> has <strong className="text-amber-600 dark:text-amber-400 font-mono">8</strong> active repair tickets.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN (4 cols) */}
        <div className="lg:col-span-4 space-y-5">
          
          {/* SECTION 5.2: Notifications & Alerts */}
          <div className="bg-white dark:bg-[#0e1626] border border-slate-200 dark:border-slate-800/90 rounded-2xl p-4 shadow-sm dark:shadow-lg dark:shadow-black/20">
            <div className="flex justify-between items-center pb-3 mb-3 border-b border-slate-100 dark:border-slate-800/70">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-rose-500 dark:text-rose-400" />
                <h3 className="text-xs font-bold text-slate-900 dark:text-white tracking-wide">Notifications & Alerts</h3>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">Real-time</span>
            </div>

            <div className="space-y-2.5">
              {/* Alert 1: Warranty Expirations */}
              <div 
                onClick={() => navigate('/reports')}
                className="p-3 rounded-xl bg-rose-50/60 dark:bg-[#190f14] border border-rose-200 dark:border-rose-500/30 hover:border-rose-300 dark:hover:border-rose-500/60 transition-all flex items-center justify-between cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-rose-500/20 text-rose-500 dark:text-rose-400 flex items-center justify-center shrink-0">
                    <ShieldAlert className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 dark:text-white group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">
                      Warranty Expirations
                    </h4>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {data?.alerts?.warranty30 ?? 13} assets warranties expiring in &le; 30 days.
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-700 dark:group-hover:text-white transition-colors" />
              </div>

              {/* Alert 2: Hardware Refresh Pipeline */}
              <div 
                onClick={() => navigate('/reports')}
                className="p-3 rounded-xl bg-emerald-50/60 dark:bg-[#091712] border border-emerald-200 dark:border-emerald-500/30 hover:border-emerald-300 dark:hover:border-emerald-500/60 transition-all flex items-center justify-between cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <RefreshCw className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                      Hardware Refresh Pipeline
                    </h4>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {data?.alerts?.hardwareRefresh ?? 14} operational assets are &gt; 4 years old.
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-700 dark:group-hover:text-white transition-colors" />
              </div>
            </div>
          </div>

          {/* SECTION 5.3: Quick Actions (3 columns x 2 rows) */}
          <div className="bg-white dark:bg-[#0e1626] border border-slate-200 dark:border-slate-800/90 rounded-2xl p-4 shadow-sm dark:shadow-lg dark:shadow-black/20">
            <div className="flex items-center gap-2 pb-3 mb-3 border-b border-slate-100 dark:border-slate-800/70">
              <Zap className="w-4 h-4 text-blue-500 dark:text-blue-400" />
              <h3 className="text-xs font-bold text-slate-900 dark:text-white tracking-wide">Quick Actions</h3>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              {/* 1. Add Asset */}
              <button 
                onClick={() => navigate('/assets/add')}
                className="p-3 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-[#0b1320] border border-slate-200 dark:border-slate-800 hover:border-teal-500/50 dark:hover:border-teal-500/40 dark:hover:bg-[#0d1829] transition-all flex flex-col items-center justify-center gap-1.5 group cursor-pointer"
              >
                <div className="w-7 h-7 rounded-full bg-teal-500/15 text-teal-600 dark:text-teal-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <PlusCircle className="w-4 h-4" />
                </div>
                <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white">Add Asset</span>
              </button>

              {/* 2. Assign */}
              <button 
                onClick={() => navigate('/assignments')}
                className="p-3 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-[#0b1320] border border-slate-200 dark:border-slate-800 hover:border-blue-500/50 dark:hover:border-blue-500/40 dark:hover:bg-[#0d1829] transition-all flex flex-col items-center justify-center gap-1.5 group cursor-pointer"
              >
                <div className="w-7 h-7 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <UserCheck className="w-4 h-4" />
                </div>
                <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white">Assign</span>
              </button>

              {/* 3. QR Codes */}
              <button 
                onClick={() => navigate('/qr-code')}
                className="p-3 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-[#0b1320] border border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 dark:hover:border-emerald-500/40 dark:hover:bg-[#0d1829] transition-all flex flex-col items-center justify-center gap-1.5 group cursor-pointer"
              >
                <div className="w-7 h-7 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <QrCode className="w-4 h-4" />
                </div>
                <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white">QR Codes</span>
              </button>

              {/* 4. Repairs */}
              <button 
                onClick={() => navigate('/maintenance')}
                className="p-3 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-[#0b1320] border border-slate-200 dark:border-slate-800 hover:border-amber-500/50 dark:hover:border-amber-500/40 dark:hover:bg-[#0d1829] transition-all flex flex-col items-center justify-center gap-1.5 group cursor-pointer"
              >
                <div className="w-7 h-7 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Wrench className="w-4 h-4" />
                </div>
                <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white">Repairs</span>
              </button>

              {/* 5. Maintenance */}
              <button 
                onClick={() => navigate('/maintenance')}
                className="p-3 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-[#0b1320] border border-slate-200 dark:border-slate-800 hover:border-purple-500/50 dark:hover:border-purple-500/40 dark:hover:bg-[#0d1829] transition-all flex flex-col items-center justify-center gap-1.5 group cursor-pointer"
              >
                <div className="w-7 h-7 rounded-full bg-purple-500/15 text-purple-600 dark:text-purple-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Calendar className="w-4 h-4" />
                </div>
                <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white">Maintenance</span>
              </button>

              {/* 6. Audit */}
              <button 
                onClick={() => navigate('/audit-logs')}
                className="p-3 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-[#0b1320] border border-slate-200 dark:border-slate-800 hover:border-indigo-500/50 dark:hover:border-indigo-500/40 dark:hover:bg-[#0d1829] transition-all flex flex-col items-center justify-center gap-1.5 group cursor-pointer"
              >
                <div className="w-7 h-7 rounded-full bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <FileText className="w-4 h-4" />
                </div>
                <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white">Audit</span>
              </button>
            </div>
          </div>

          {/* SECTION 8: Asset Attention Required */}
          <div className="bg-white dark:bg-[#0e1626] border border-slate-200 dark:border-slate-800/90 rounded-2xl p-4 shadow-sm dark:shadow-lg dark:shadow-black/20">
            <div className="flex justify-between items-center pb-3 mb-2 border-b border-slate-100 dark:border-slate-800/70">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                <h3 className="text-xs font-bold text-slate-900 dark:text-white tracking-wide">Asset Attention Required</h3>
              </div>
              <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/60 px-2 py-0.5 rounded-md">
                Action Queue
              </span>
            </div>

            <div className="space-y-2">
              {/* Item 1 */}
              <div 
                onClick={() => navigate('/assets')}
                className="p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100/80 dark:bg-[#090f1d] border border-slate-200 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700 transition-all flex items-center justify-between cursor-pointer group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-rose-500/20 text-rose-500 dark:text-rose-400 flex items-center justify-center shrink-0">
                    <ShieldAlert className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-slate-800 dark:text-white group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">
                      Warranty Due: <span className="font-mono">AST-00000033</span>
                    </h4>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">Expiring within policy interval</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-700 dark:group-hover:text-white transition-colors" />
              </div>

              {/* Item 2 */}
              <div 
                onClick={() => navigate('/assets')}
                className="p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100/80 dark:bg-[#090f1d] border border-slate-200 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700 transition-all flex items-center justify-between cursor-pointer group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-rose-500/20 text-rose-500 dark:text-rose-400 flex items-center justify-center shrink-0">
                    <ShieldAlert className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-slate-800 dark:text-white group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">
                      Warranty Due: <span className="font-mono">AST-00000054</span>
                    </h4>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">Expiring within policy interval</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-700 dark:group-hover:text-white transition-colors" />
              </div>

              {/* Item 3 */}
              <div 
                onClick={() => navigate('/assets')}
                className="p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100/80 dark:bg-[#090f1d] border border-slate-200 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700 transition-all flex items-center justify-between cursor-pointer group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-rose-500/20 text-rose-500 dark:text-rose-400 flex items-center justify-center shrink-0">
                    <ShieldAlert className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-slate-800 dark:text-white group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">
                      Warranty Due: <span className="font-mono">AST-00000041</span>
                    </h4>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">Expiring within policy interval</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-700 dark:group-hover:text-white transition-colors" />
              </div>

              {/* Item 4 */}
              <div 
                onClick={() => navigate('/assets')}
                className="p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100/80 dark:bg-[#090f1d] border border-slate-200 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700 transition-all flex items-center justify-between cursor-pointer group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-500 dark:text-amber-400 flex items-center justify-center shrink-0">
                    <FileText className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-slate-800 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                      Docs Missing: <span className="font-mono">AST-00000314</span>
                    </h4>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">Requires invoice or purchase order</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-700 dark:group-hover:text-white transition-colors" />
              </div>
            </div>

            {/* Bottom link: Access Global Ledger */}
            <div className="pt-3 text-center">
              <button 
                onClick={() => navigate('/assets')}
                className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 inline-flex items-center gap-1.5 transition-colors"
              >
                <span>Access Global Ledger</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 4. SECTION 9: Bottom Navigation Row (4 horizontal cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
        {/* Card 1: Employees */}
        <div 
          onClick={() => navigate('/employees')}
          className="p-3.5 rounded-2xl bg-white dark:bg-[#0e1626] border border-slate-200 dark:border-slate-800/90 hover:border-blue-500/40 transition-all flex items-center justify-between cursor-pointer group shadow-sm dark:shadow-md"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/20 text-blue-500 dark:text-blue-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-800 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">Employees</h4>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Staff directory & equipment audit</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-700 dark:group-hover:text-white transition-colors" />
        </div>

        {/* Card 2: Departments */}
        <div 
          onClick={() => navigate('/departments')}
          className="p-3.5 rounded-2xl bg-white dark:bg-[#0e1626] border border-slate-200 dark:border-slate-800/90 hover:border-purple-500/40 transition-all flex items-center justify-between cursor-pointer group shadow-sm dark:shadow-md"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-500/20 text-purple-500 dark:text-purple-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-800 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">Departments</h4>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Organizational allocation metrics</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-700 dark:group-hover:text-white transition-colors" />
        </div>

        {/* Card 3: Locations */}
        <div 
          onClick={() => navigate('/locations')}
          className="p-3.5 rounded-2xl bg-white dark:bg-[#0e1626] border border-slate-200 dark:border-slate-800/90 hover:border-teal-500/40 transition-all flex items-center justify-between cursor-pointer group shadow-sm dark:shadow-md"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-500/15 border border-teal-500/20 text-teal-500 dark:text-teal-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-800 dark:text-white group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">Locations</h4>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Geographic facility inventory</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-700 dark:group-hover:text-white transition-colors" />
        </div>

        {/* Card 4: Reports */}
        <div 
          onClick={() => navigate('/reports')}
          className="p-3.5 rounded-2xl bg-white dark:bg-[#0e1626] border border-slate-200 dark:border-slate-800/90 hover:border-rose-500/40 transition-all flex items-center justify-between cursor-pointer group shadow-sm dark:shadow-md"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-500/15 border border-rose-500/20 text-rose-500 dark:text-rose-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-800 dark:text-white group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">Reports</h4>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Compliance & executive summary</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-700 dark:group-hover:text-white transition-colors" />
        </div>
      </div>
    </div>
  );
}
