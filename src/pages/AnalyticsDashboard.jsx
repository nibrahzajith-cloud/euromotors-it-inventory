import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  Activity, MonitorSmartphone, UserCheck, CheckCircle2, 
  Wrench, ShieldCheck, Database, Server, Clock, History, 
  ChevronRight, PlusCircle, QrCode, FileText, ArrowRight,
  TrendingUp, TrendingDown, Building2, MapPin, AlertTriangle, Sparkles
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, PieChart, Pie, Cell, Sector
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import StorageOverview from '../components/Admin/StorageOverview';

const _rawApi = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const API_URL = _rawApi.endsWith('/api') ? _rawApi : `${_rawApi.replace(/\/$/, '')}/api`;

const useCountUp = (end, duration = 2000) => {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let startTimestamp = null;
    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      setCount(Math.floor(progress * end));
      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };
    window.requestAnimationFrame(step);
  }, [end, duration]);
  return count;
};

const GlassCard = ({ children, className = '', glowColor = 'rgba(59, 130, 246, 0.5)', onClick }) => (
  <motion.div 
    whileHover={onClick ? { y: -6, scale: 1.02 } : {}}
    onClick={onClick}
    className={`relative group bg-white dark:bg-slate-900/40 dark:backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm dark:shadow-2xl transition-all duration-300 ${onClick ? 'cursor-pointer' : ''} ${className}`}
  >
    <div className="absolute inset-0 bg-gradient-to-br from-white/50 dark:from-white/5 to-transparent pointer-events-none" />
    <div 
      className="absolute -inset-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-[26px] blur-xl pointer-events-none"
      style={{ background: `radial-gradient(circle at center, ${glowColor} 0%, transparent 70%)` }}
    />
    <div className="relative z-10 p-5">
      {children}
    </div>
  </motion.div>
);

const KPICard = ({ title, value, trend, type, icon: Icon, colorClass, glowColor, onClick }) => {
  const animatedValue = useCountUp(value);
  
  return (
    <GlassCard glowColor={glowColor} onClick={onClick}>
      <div className="flex justify-between items-start mb-3">
        <div className={`p-2.5 rounded-xl ${colorClass} bg-opacity-10 dark:bg-opacity-100 shadow-sm dark:shadow-lg dark:shadow-black/10 flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${colorClass.replace('bg-', 'text-')} dark:text-white`} />
        </div>
        <div className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${type === 'up' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' : type === 'down' ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400' : 'bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-400'}`}>
          {type === 'up' ? <TrendingUp className="w-3 h-3" /> : type === 'down' ? <TrendingDown className="w-3 h-3" /> : null}
          {trend}
        </div>
      </div>
      <div>
        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">{title}</p>
        <h3 className="text-2xl font-bold text-slate-800 dark:text-white">{animatedValue.toLocaleString()}</h3>
      </div>
    </GlassCard>
  );
};

const renderActiveShape = (props) => {
  const RADIAN = Math.PI / 180;
  const { cx, cy, midAngle, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent, value } = props;
  const sin = Math.sin(-midAngle * RADIAN);
  const cos = Math.cos(-midAngle * RADIAN);
  const sx = cx + (outerRadius + 10) * cos;
  const sy = cy + (outerRadius + 10) * sin;
  const mx = cx + (outerRadius + 30) * cos;
  const my = cy + (outerRadius + 30) * sin;
  const ex = mx + (cos >= 0 ? 1 : -1) * 22;
  const ey = my;
  const textAnchor = cos >= 0 ? 'start' : 'end';

  return (
    <g>
      <text x={cx} y={cy} dy={8} textAnchor="middle" fill={fill} className="text-lg font-bold dark:fill-white">
        {payload.name}
      </text>
      <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius} startAngle={startAngle} endAngle={endAngle} fill={fill} />
      <Sector cx={cx} cy={cy} startAngle={startAngle} endAngle={endAngle} innerRadius={outerRadius + 6} outerRadius={outerRadius + 10} fill={fill} />
      <path d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`} stroke={fill} fill="none" />
      <circle cx={ex} cy={ey} r={2} fill={fill} stroke="none" />
      <text x={ex + (cos >= 0 ? 1 : -1) * 12} y={ey} textAnchor={textAnchor} fill="#888" className="text-sm font-medium dark:fill-[#ccc]">{`${value} Units`}</text>
      <text x={ex + (cos >= 0 ? 1 : -1) * 12} y={ey} dy={18} textAnchor={textAnchor} fill="#aaa" className="text-xs dark:fill-[#999]">
        {`(${(percent * 100).toFixed(1)}%)`}
      </text>
    </g>
  );
};

const CACHE_KEY = 'analyticsDashboardCache';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

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

  // Stale-while-revalidate: load cached data instantly on mount
  const cached = React.useMemo(() => loadCache(), []);
  const [data, setData] = useState(cached?.data ?? null);
  // Only show skeleton if there's NO cache at all — otherwise render cached data immediately
  const [loading, setLoading] = useState(!cached);
  const [revalidating, setRevalidating] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    const fetchData = async (isBackground = false) => {
      // Background revalidation: show a subtle indicator instead of blocking the UI
      if (isBackground) setRevalidating(true);

      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/dashboard/advanced`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
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

    // If cache exists but is fresh, still revalidate silently in the background
    // If cache is stale or missing, fetch normally
    if (cached && !cached.isStale) {
      // Data is fresh — background revalidate quietly
      fetchData(true);
    } else {
      // No cache or stale cache — fetch (shows skeleton only if no cache)
      fetchData(false);
    }

    let interval;
    if (autoRefresh) {
      interval = setInterval(() => fetchData(true), 30000);
    }
    return () => clearInterval(interval);
  }, [autoRefresh]);



  const chartData = useMemo(() => {
    if (!data || !data.summary) return [];
    return [
      { name: 'Available', value: data.summary.available?.value || 0, color: '#10b981' },
      { name: 'Assigned', value: data.summary.assigned?.value || 0, color: '#3b82f6' },
      { name: 'Repair', value: data.summary.repair?.value || 0, color: '#f59e0b' },
      { name: 'Warranty Risk', value: data.summary.warranty?.value || 0, color: '#ef4444' }
    ];
  }, [data]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#0f172a] p-4 md:p-8 space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="h-8 w-64 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse" />
            <div className="h-4 w-96 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse" />
          </div>
          <div className="flex gap-3">
             <div className="h-10 w-32 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse" />
             <div className="h-10 w-32 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
           {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
             <div key={i} className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 h-32 animate-pulse">
                <div className="flex justify-between items-start mb-4">
                   <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-700" />
                   <div className="w-16 h-6 rounded-full bg-slate-200 dark:bg-slate-700" />
                </div>
                <div className="w-24 h-4 bg-slate-200 dark:bg-slate-700 rounded mb-2" />
                <div className="w-16 h-8 bg-slate-200 dark:bg-slate-700 rounded" />
             </div>
           ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
           <div className="lg:col-span-8 h-[400px] bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 animate-pulse" />
           <div className="lg:col-span-4 h-[400px] bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0f172a] text-slate-800 dark:text-slate-300 p-4 md:p-8 space-y-8 relative overflow-hidden transition-colors duration-300">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden z-0 hidden dark:block">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 blur-[120px] rounded-full" />
      </div>

      <div className="relative z-10 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
               Analytics Dashboard
               {revalidating && (
                 <span className="flex items-center gap-1.5 text-xs font-medium text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700 rounded-full px-2.5 py-0.5 ml-1">
                   <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                   Refreshing
                 </span>
               )}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
               Overview of system performance, assets, and operational metrics.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-sm font-medium dark:backdrop-blur-sm">
               <span className={`w-2 h-2 rounded-full ${autoRefresh ? 'bg-emerald-500 dark:shadow-[0_0_8px_#10b981]' : 'bg-slate-300 dark:bg-slate-500'}`} />
               Auto Refresh {autoRefresh ? 'ON' : 'OFF'}
               <button onClick={() => setAutoRefresh(!autoRefresh)} className="ml-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300">Toggle</button>
            </div>
            <button 
               onClick={() => navigate('/reports')}
               className="px-4 py-2 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/10 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors dark:backdrop-blur-sm"
            >
               <History className="w-4 h-4 text-slate-500 dark:text-slate-400" />
               View Reports
            </button>
          </div>
        </div>

        {/* KPI Section */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <KPICard title="Total Assets" value={data?.summary?.totalAssets?.value || 0} trend={`+${data?.summary?.totalAssets?.trend || 0} wk`} type="up" icon={MonitorSmartphone} colorClass="bg-blue-100 text-blue-600 dark:bg-blue-600" glowColor="rgba(59, 130, 246, 0.4)" onClick={() => navigate('/assets')} />
          <KPICard title="Assets in Store" value={data?.summary?.inStoreAssets?.value || data?.summary?.available?.value || 0} trend={`+${data?.summary?.inStoreAssets?.trend || data?.summary?.available?.trend || 0} rtr`} type="up" icon={Server} colorClass="bg-emerald-100 text-emerald-600 dark:bg-emerald-600" glowColor="rgba(16, 185, 129, 0.4)" onClick={() => navigate('/assets?status=AVAILABLE')} />
          <KPICard title="Assigned to Employees" value={data?.summary?.assigned?.value || 0} trend={`+${data?.summary?.assigned?.trend || 0} day`} type="up" icon={UserCheck} colorClass="bg-indigo-100 text-indigo-600 dark:bg-indigo-600" glowColor="rgba(79, 70, 229, 0.4)" onClick={() => navigate('/assets?status=ASSIGNED')} />
          <KPICard title="Assigned to Departments" value={data?.summary?.departmentAssets?.value || data?.summary?.department?.value || 0} trend={`+${data?.summary?.departmentAssets?.trend || data?.summary?.department?.trend || 0} mnt`} type="up" icon={Building2} colorClass="bg-purple-100 text-purple-600 dark:bg-purple-600" glowColor="rgba(147, 51, 234, 0.4)" onClick={() => navigate('/assets?status=ASSIGNED')} />
          <KPICard title="Assigned to Locations" value={data?.summary?.locationAssets?.value || data?.summary?.location?.value || 0} trend={`+${data?.summary?.locationAssets?.trend || data?.summary?.location?.trend || 0} mnt`} type="neutral" icon={MapPin} colorClass="bg-cyan-100 text-cyan-600 dark:bg-cyan-600" glowColor="rgba(6, 182, 212, 0.4)" onClick={() => navigate('/assets?status=ASSIGNED')} />
          <KPICard title="Shared Assets" value={data?.summary?.sharedAssets?.value || data?.summary?.shared?.value || 0} trend={`+${data?.summary?.sharedAssets?.trend || data?.summary?.shared?.trend || 0} mnt`} type="neutral" icon={Activity} colorClass="bg-pink-100 text-pink-600 dark:bg-pink-600" glowColor="rgba(236, 72, 153, 0.4)" onClick={() => navigate('/assets?status=ASSIGNED')} />
          <KPICard title="Assets Under Repair" value={data?.summary?.repair?.value || 0} trend={`${data?.summary?.repair?.trend || 0} mnt`} type="neutral" icon={Wrench} colorClass="bg-amber-100 text-amber-600 dark:bg-amber-600" glowColor="rgba(245, 158, 11, 0.4)" onClick={() => navigate('/maintenance')} />
          <KPICard title="Warranty Alerts" value={data?.summary?.warranty?.value || 0} trend={`${data?.summary?.warranty?.trend || 0} rsk`} type="down" icon={ShieldCheck} colorClass="bg-rose-100 text-rose-600 dark:bg-rose-600" glowColor="rgba(225, 29, 72, 0.4)" onClick={() => navigate('/reports')} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Main Analytics Area */}
          <div className="lg:col-span-8 space-y-8">
            
            {/* Timeline Chart */}
            <GlassCard className="h-[400px]">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-white">Asset Activity Timeline</h3>
                <div className="flex gap-4">
                  <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded bg-blue-500" /> <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Assigned</span></div>
                  <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded bg-emerald-500" /> <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Returned</span></div>
                  <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded border-2 border-dashed border-amber-500 bg-transparent" /> <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Repairs</span></div>
                </div>
              </div>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.timeline}>
                    <defs>
                      <linearGradient id="colorAssigned" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorReturned" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-grid, rgba(148, 163, 184, 0.2))" />
                    <XAxis dataKey="date" stroke="#64748b" fontSize={11} axisLine={false} tickLine={false} />
                    <YAxis stroke="#64748b" fontSize={11} axisLine={false} tickLine={false} />
                    <Tooltip 
                      contentStyle={{ background: 'var(--color-bg, #fff)', border: '1px solid var(--color-border, #e2e8f0)', borderRadius: '8px' }}
                      itemStyle={{ fontSize: '12px', fontWeight: '500', color: 'var(--color-text, #1e293b)' }}
                    />
                    <Area type="monotone" dataKey="assigned" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorAssigned)" />
                    <Area type="monotone" dataKey="returned" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorReturned)" />
                    <Area type="monotone" dataKey="repairs" stroke="#f59e0b" strokeWidth={3} fill="transparent" strokeDasharray="5 5" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </GlassCard>

            {/* Department and Location Intelligence Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               {/* Department Stats */}
               <GlassCard className="min-h-[400px]">
                  <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-100 dark:border-white/10">
                     <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-white">Department Overview</h3>
                     <span className="text-xs font-semibold text-slate-500 uppercase">Utilization</span>
                  </div>
                  <div className="space-y-6">
                     {(data?.analytics?.departments || []).map((dept) => (
                        <div key={dept.id}>
                           <div className="flex justify-between items-center mb-2">
                              <div className="flex items-center gap-3">
                                 <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                                    <Building2 className="w-4 h-4" />
                                 </div>
                                 <div>
                                    <h4 className="text-sm font-semibold text-slate-800 dark:text-white">{dept.name}</h4>
                                    <div className="text-xs text-slate-500">
                                       {dept.count} Assets • {dept.staffCount} Staff
                                    </div>
                                 </div>
                              </div>
                              <div className="text-right">
                                 <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{Math.round(dept.utilization)}%</span>
                              </div>
                           </div>
                           <div className="h-2 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 dark:from-indigo-600 dark:to-purple-500 rounded-full"
                                style={{ width: `${dept.utilization}%` }}
                              />
                           </div>
                        </div>
                     ))}
                  </div>
               </GlassCard>

               {/* Location Stats */}
               <GlassCard className="min-h-[400px]">
                  <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-100 dark:border-white/10">
                     <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-white">Location Status</h3>
                     <span className="text-xs font-semibold text-slate-500 uppercase">Active Rate</span>
                  </div>
                  <div className="space-y-6">
                     {(data?.analytics?.locations || []).map((loc) => (
                        <div key={loc.id}>
                           <div className="flex justify-between items-center mb-2">
                              <div className="flex items-center gap-3">
                                 <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                                    <MapPin className="w-4 h-4" />
                                 </div>
                                 <div>
                                    <h4 className="text-sm font-semibold text-slate-800 dark:text-white">{loc.name}</h4>
                                    <div className="text-xs text-slate-500">
                                       {loc.count} Units <span className="mx-1">•</span> <span className="text-amber-500/80">{loc.repairCount} Repairs</span>
                                    </div>
                                 </div>
                              </div>
                              <div className="text-right">
                                 <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{Math.round(loc.activePercentage)}%</span>
                              </div>
                           </div>
                           <div className="h-2 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-gradient-to-r from-emerald-500 to-blue-500 dark:from-emerald-600 dark:to-blue-500 rounded-full"
                                style={{ width: `${loc.activePercentage}%` }}
                              />
                           </div>
                        </div>
                     ))}
                  </div>
               </GlassCard>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Status Donut */}
              <GlassCard className="h-[380px] flex flex-col">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-white mb-2">Inventory Status</h3>
                <div className="flex-1 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        activeIndex={activeIndex}
                        activeShape={renderActiveShape}
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                        onMouseEnter={(_, index) => setActiveIndex(index)}
                        onClick={(data) => {
                          let status = '';
                          if (data.name === 'Available') status = 'AVAILABLE';
                          else if (data.name === 'Assigned') status = 'ASSIGNED';
                          else if (data.name === 'Repair') status = 'REPAIR';
                          if (status) navigate(`/assets?status=${status}`);
                        }}
                        className="cursor-pointer outline-none"
                      >
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </GlassCard>

              {/* Insights Card */}
              <GlassCard className="h-[380px]">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-white mb-6">Key Insights</h3>
                <div className="space-y-4">
                   <div className="p-4 bg-blue-50 border border-blue-100 dark:bg-blue-600/10 dark:border-blue-500/20 rounded-xl flex gap-4">
                      <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400">Density</p>
                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                          Top 5 departments represent <span className="font-bold text-slate-800 dark:text-white">{Math.round((data?.analytics?.departments || []).reduce((a,b) => a+b.percentage, 0))}%</span> of total operational footprint.
                        </p>
                      </div>
                   </div>
                   <div className="p-4 bg-purple-50 border border-purple-100 dark:bg-purple-600/10 dark:border-purple-500/20 rounded-xl flex gap-4">
                      <TrendingUp className="w-5 h-5 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-bold uppercase tracking-widest text-purple-600 dark:text-purple-400">Optimization</p>
                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                          Department <span className="font-bold text-slate-800 dark:text-white">{data?.analytics?.departments?.[0]?.name || 'N/A'}</span> utilization is at <span className="text-emerald-600 dark:text-emerald-400 font-bold">{Math.round(data?.analytics?.departments?.[0]?.utilization || 0)}%</span>.
                        </p>
                      </div>
                   </div>
                   <div className="p-4 bg-amber-50 border border-amber-100 dark:bg-amber-600/10 dark:border-amber-500/20 rounded-xl flex gap-4">
                      <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400">Maintenance</p>
                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                          Location <span className="font-bold text-slate-800 dark:text-white">{(data?.analytics?.locations || []).sort((a,b) => b.repairCount - a.repairCount)[0]?.name || 'N/A'}</span> requires attention with <span className="text-amber-600 dark:text-amber-400 font-bold">{(data?.analytics?.locations || []).sort((a,b) => b.repairCount - a.repairCount)[0]?.repairCount || 0}</span> active repairs.
                        </p>
                      </div>
                   </div>
                </div>
              </GlassCard>
            </div>
          </div>

          {/* Right Sidebar Widgets */}
          <div className="lg:col-span-4 space-y-8">
            
            {/* Smart Alerts */}
            <div className="space-y-4">
              <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" /> Notifications & Alerts
              </h2>
              
              {(data?.alerts?.longRepair || []).length > 0 && (
                <GlassCard glowColor="rgba(245, 158, 11, 0.4)" className="!p-4 bg-amber-50 dark:bg-transparent border-amber-200 dark:border-amber-500/20">
                  <div className="flex gap-4">
                    <div className="p-2 bg-white dark:bg-amber-500/20 rounded-lg text-amber-600 dark:text-amber-500 border border-amber-100 dark:border-none"><Wrench className="w-5 h-5" /></div>
                    <div>
                      <p className="text-sm font-bold text-slate-800 dark:text-white">Pending Repairs</p>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{(data?.alerts?.longRepair || []).length} assets exceeding 5-day queue.</p>
                      <button onClick={() => navigate('/maintenance')} className="mt-2 text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-500 flex items-center gap-1 hover:gap-2 transition-all">
                        View Repairs <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </GlassCard>
              )}
              {(data?.alerts?.warranty30 || 0) > 0 && (
                <GlassCard glowColor="rgba(225, 29, 72, 0.4)" className="!p-4 bg-rose-50 dark:bg-transparent border-rose-200 dark:border-rose-500/20">
                  <div className="flex gap-4">
                    <div className="p-2 bg-white dark:bg-rose-500/20 rounded-lg text-rose-600 dark:text-rose-500 border border-rose-100 dark:border-none"><ShieldCheck className="w-5 h-5" /></div>
                    <div>
                      <p className="text-sm font-bold text-slate-800 dark:text-white">Warranty Expirations</p>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{data?.alerts?.warranty30 || 0} assets expiring in 30 days.</p>
                      <button onClick={() => navigate('/reports')} className="mt-2 text-xs font-bold uppercase tracking-wider text-rose-700 dark:text-rose-500 flex items-center gap-1 hover:gap-2 transition-all">
                        View Report <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </GlassCard>
              )}
              {(data?.alerts?.hardwareRefresh || 0) > 0 && (
                <GlassCard glowColor="rgba(16, 185, 129, 0.4)" className="!p-4 bg-emerald-50 dark:bg-transparent border-emerald-200 dark:border-emerald-500/20">
                  <div className="flex gap-4">
                    <div className="p-2 bg-white dark:bg-emerald-500/20 rounded-lg text-emerald-600 dark:text-emerald-500 border border-emerald-100 dark:border-none"><Sparkles className="w-5 h-5" /></div>
                    <div>
                      <p className="text-sm font-bold text-slate-800 dark:text-white">Hardware Refresh</p>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{data?.alerts?.hardwareRefresh || 0} assets are &gt;4 years old.</p>
                      <button onClick={() => navigate('/reports')} className="mt-2 text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-500 flex items-center gap-1 hover:gap-2 transition-all">
                        View Pipeline <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </GlassCard>
              )}
              {((data?.alerts?.longRepair || []).length === 0 && (data?.alerts?.warranty30 || 0) === 0 && (data?.alerts?.hardwareRefresh || 0) === 0) && (
                <GlassCard className="!p-4 border-slate-200 dark:border-white/10">
                   <p className="text-sm text-slate-500 text-center py-2">No active alerts at this time.</p>
                </GlassCard>
              )}
            </div>

            {/* Quick Actions */}
            <GlassCard className="!p-0 overflow-hidden border-slate-200 dark:border-white/10">
              <div className="p-5 border-b border-slate-100 dark:border-white/10 flex justify-between items-center bg-slate-50 dark:bg-white/5">
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-800 dark:text-white">Quick Actions</h3>
              </div>
              <div className="grid grid-cols-2">
                <button onClick={() => navigate('/assets/add')} className="p-5 border-r border-b border-slate-100 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/10 transition-colors flex flex-col items-center gap-2">
                  <div className="p-2 bg-blue-50 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-lg"><PlusCircle className="w-5 h-5" /></div>
                  <span className="text-[10px] uppercase tracking-widest font-bold text-slate-500 dark:text-slate-400">Add Asset</span>
                </button>
                <button onClick={() => navigate('/assignments')} className="p-5 border-b border-slate-100 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/10 transition-colors flex flex-col items-center gap-2">
                  <div className="p-2 bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-lg"><UserCheck className="w-5 h-5" /></div>
                  <span className="text-[10px] uppercase tracking-widest font-bold text-slate-500 dark:text-slate-400">Assign</span>
                </button>
                <button onClick={() => navigate('/qr-code')} className="p-5 border-r border-slate-100 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/10 transition-colors flex flex-col items-center gap-2">
                  <div className="p-2 bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-lg"><QrCode className="w-5 h-5" /></div>
                  <span className="text-[10px] uppercase tracking-widest font-bold text-slate-500 dark:text-slate-400">QR Codes</span>
                </button>
                <button onClick={() => navigate('/maintenance')} className="p-5 hover:bg-slate-50 dark:hover:bg-white/10 transition-colors flex flex-col items-center gap-2">
                  <div className="p-2 bg-amber-50 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-lg"><Wrench className="w-5 h-5" /></div>
                  <span className="text-[10px] uppercase tracking-widest font-bold text-slate-500 dark:text-slate-400">Repairs</span>
                </button>
              </div>
            </GlassCard>

            {/* Recent Activity */}
            <GlassCard className="!p-0 overflow-hidden border-slate-200 dark:border-white/10">
              <div className="p-5 border-b border-slate-100 dark:border-white/10 flex justify-between items-center bg-slate-50 dark:bg-white/5">
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-800 dark:text-white">Recent Activity</h3>
              </div>
              <div className="p-3 space-y-1 max-h-[300px] overflow-y-auto">
                {data.activityFeed.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-6">No recent activity found.</p>
                ) : data.activityFeed.slice(0, 8).map((log) => (
                  <div key={log.id} className="flex gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-white/10 transition-colors cursor-pointer group" onClick={() => navigate('/audit-logs')}>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      log.action.includes('CREATE') ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' :
                      log.action.includes('DELETE') ? 'bg-rose-50 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400' :
                      'bg-blue-50 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400'
                    }`}>
                      <Activity className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-slate-700 dark:text-slate-300 dark:group-hover:text-white transition-colors leading-snug">{log.description}</p>
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-500">
                        <span className="font-semibold">{log.userName}</span>
                        <span>•</span>
                        <span>{new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <button 
                onClick={() => navigate('/audit-logs')}
                className="w-full p-4 text-xs font-bold uppercase tracking-widest text-blue-600 dark:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors border-t border-slate-100 dark:border-white/10 flex items-center justify-center gap-2"
              >
                View Full Logs <ChevronRight className="w-3 h-3" />
              </button>
            </GlassCard>
          </div>
        </div>

        {/* Admin Storage Overview (Admin Only) */}
        {user?.role === 'ADMIN' && (
          <div className="pt-2">
            <StorageOverview embedded={true} />
          </div>
        )}

        {/* Quick Links Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {[
            { label: 'Employees', icon: UserCheck, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-500/20', nav: '/employees', desc: 'Manage staff records' },
            { label: 'Departments', icon: Building2, color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-500/20', nav: '/departments', desc: 'View department stats' },
            { label: 'Locations', icon: MapPin, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/20', nav: '/locations', desc: 'Asset distribution' },
            { label: 'Reports', icon: FileText, color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-500/20', nav: '/reports', desc: 'Generate system reports' }
          ].map(btn => (
            <GlassCard key={btn.label} className="cursor-pointer" glowColor="rgba(255,255,255,0.1)" onClick={() => navigate(btn.nav)}>
               <div className="flex items-center gap-4">
                 <div className={`p-3 rounded-xl ${btn.bg} ${btn.color}`}>
                   <btn.icon className="w-5 h-5" />
                 </div>
                 <div>
                   <h4 className="text-sm font-bold text-slate-800 dark:text-white">{btn.label}</h4>
                   <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{btn.desc}</p>
                 </div>
               </div>
            </GlassCard>
          ))}
        </div>
      </div>
    </div>
  );
}
