import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LineChart as LineChartIcon, 
  Activity, 
  MonitorSmartphone, 
  UserCheck, 
  CheckCircle2, 
  Wrench, 
  ShieldCheck, 
  Database, 
  Server, 
  Clock, 
  History, 
  ChevronRight, 
  PlusCircle, 
  QrCode, 
  FileText, 
  ArrowUpRight, 
  AlertTriangle, 
  Sparkles,
  TrendingUp,
  TrendingDown,
  Building2,
  MapPin,
  ArrowRight
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  Sector
} from 'recharts';
import { useNavigate } from 'react-router-dom';

const _rawApi = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const API_URL = _rawApi.endsWith('/api') ? _rawApi : `${_rawApi.replace(/\/$/, '')}/api`;

// --- Custom Hooks ---

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

// --- Components ---

const GlassCard = ({ children, className = '', glowColor = 'rgba(59, 130, 246, 0.5)', onClick }) => (
  <motion.div 
    whileHover={{ y: -6, scale: 1.02 }}
    onClick={onClick}
    className={`relative group bg-white/10 dark:bg-slate-900/40 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-3xl overflow-hidden shadow-2xl transition-all duration-300 ${className}`}
  >
    <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
    <div 
      className="absolute -inset-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-[26px] blur-xl pointer-events-none"
      style={{ background: `radial-gradient(circle at center, ${glowColor} 0%, transparent 70%)` }}
    />
    <div className="relative z-10 p-6">
      {children}
    </div>
  </motion.div>
);

const KPICard = ({ title, value, trend, type, icon: Icon, color, glowColor, onClick }) => {
  const animatedValue = useCountUp(value);
  
  return (
    <GlassCard glowColor={glowColor} className="cursor-pointer" onClick={onClick}>
      <div className="flex justify-between items-start mb-4">
        <div className={`p-3 rounded-2xl ${color} shadow-lg shadow-black/5 flex items-center justify-center`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        <div className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full ${type === 'up' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
          {type === 'up' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {trend}
        </div>
      </div>
      <div>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{title}</p>
        <h3 className="text-3xl font-bold text-slate-800 dark:text-white tracking-tight">{animatedValue.toLocaleString()}</h3>
      </div>
    </GlassCard>
  );
};

const SystemStatusDot = ({ status }) => {
  const colorMap = {
    Optimal: 'bg-emerald-500',
    Warning: 'bg-amber-500',
    Critical: 'bg-rose-500',
    Connected: 'bg-emerald-500'
  };
  return (
    <div className="relative flex h-2 w-2">
      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${colorMap[status] || 'bg-slate-400'}`}></span>
      <span className={`relative inline-flex rounded-full h-2 w-2 ${colorMap[status] || 'bg-slate-400'}`}></span>
    </div>
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
      <text x={cx} y={cy} dy={8} textAnchor="middle" fill={fill} className="text-xl font-bold dark:fill-white">
        {payload.name}
      </text>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius}
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
        outerRadius={outerRadius + 10}
        fill={fill}
      />
      <path d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`} stroke={fill} fill="none" />
      <circle cx={ex} cy={ey} r={2} fill={fill} stroke="none" />
      <text x={ex + (cos >= 0 ? 1 : -1) * 12} y={ey} textAnchor={textAnchor} fill="#333" className="text-xs font-bold dark:fill-slate-300">{`${value} Units`}</text>
      <text x={ex + (cos >= 0 ? 1 : -1) * 12} y={ey} dy={18} textAnchor={textAnchor} fill="#999" className="text-[10px] dark:fill-slate-500">
        {`(${(percent * 100).toFixed(1)}%)`}
      </text>
    </g>
  );
};

// --- Intelligence Tooltip Component ---

const IntelligenceTooltip = ({ title, stats, icon: Icon, color }) => (
  <motion.div 
    initial={{ opacity: 0, y: 10, scale: 0.95 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    className="absolute bottom-full left-0 mb-4 w-64 bg-slate-900/95 backdrop-blur-2xl border border-white/10 rounded-2xl p-4 shadow-2xl z-[100] pointer-events-none"
  >
    <div className="flex items-center gap-3 mb-3 pb-2 border-b border-white/5">
      <div className={`p-2 rounded-lg ${color}/20`}>
        <Icon className={`w-4 h-4 ${color.replace('bg-', 'text-')}`} />
      </div>
      <h4 className="text-xs font-black uppercase tracking-widest text-white">{title}</h4>
    </div>
    <div className="space-y-2">
      {stats.map((stat, i) => (
        <div key={i} className="flex justify-between items-center text-[10px] font-bold">
          <span className="text-slate-500 uppercase tracking-tighter">{stat.label}</span>
          <span className="text-white">{stat.value}</span>
        </div>
      ))}
    </div>
    <div className="mt-3 flex items-center gap-2">
      <div className="h-1 flex-1 bg-white/5 rounded-full overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: '70%' }} />
      </div>
      <span className="text-[8px] font-black text-slate-500 uppercase">Efficiency Optima</span>
    </div>
  </motion.div>
);

export default function AnalyticsDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [hoveredDept, setHoveredDept] = useState(null);
  const [hoveredLoc, setHoveredLoc] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [densityMode, setDensityMode] = useState('high'); // high or comfort
  const [opMode, setOpMode] = useState('standard'); // standard or audit

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/dashboard/advanced`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await res.json();
        setData(result);
      } catch (err) {
        console.error('Failed to fetch analytics:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
    let interval;
    if (autoRefresh) {
      interval = setInterval(fetchData, 30000); // 30s refresh
    }
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const chartData = useMemo(() => {
    if (!data) return [];
    return [
      { name: 'Available', value: data.summary.available.value, color: '#10b981' },
      { name: 'Assigned', value: data.summary.assigned.value, color: '#3b82f6' },
      { name: 'Repair', value: data.summary.repair.value, color: '#f59e0b' },
      { name: 'Warranty Risk', value: data.summary.warranty.value, color: '#ef4444' }
    ];
  }, [data]);

  if (loading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center space-y-6 bg-[#0f172a]">
        <motion.div 
          animate={{ rotate: 360, scale: [1, 1.2, 1] }} 
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full shadow-[0_0_20px_rgba(59,130,246,0.5)]" 
        />
        <p className="text-blue-400 font-bold uppercase tracking-[0.3em] text-sm animate-pulse">Initializing Control Core</p>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-[#0f172a] text-slate-300 p-4 ${densityMode === 'high' ? 'md:p-6' : 'md:p-10'} space-y-8 overflow-hidden relative transition-all duration-500`}>
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 blur-[120px] rounded-full" />
      </div>

      {/* Header */}
      <div className="relative z-10 flex flex-col xl:flex-row xl:items-center justify-between gap-6">
        <div className="flex flex-col md:flex-row md:items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-600 rounded-2xl shadow-lg shadow-blue-600/30">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-white tracking-tighter uppercase italic">Control <span className="text-blue-500">Center</span></h1>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1 flex items-center gap-2">
                <ShieldCheck className={`w-3 h-3 ${opMode === 'audit' ? 'text-amber-500' : 'text-emerald-500'}`} /> 
                {opMode === 'audit' ? 'Audit Reconnaissance Mode' : 'Operational Intelligence Protocol Active'}
              </p>
            </div>
          </div>

          <div className="h-10 w-[1px] bg-slate-800 hidden md:block" />

          {/* Operational Toggles */}
          <div className="flex items-center gap-2 p-1 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl">
            <button 
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${autoRefresh ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}
            >
              Live Pulse {autoRefresh ? 'ON' : 'OFF'}
            </button>
            <button 
              onClick={() => setDensityMode(densityMode === 'high' ? 'comfort' : 'high')}
              className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${densityMode === 'comfort' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}
            >
              {densityMode === 'high' ? 'Compact' : 'Comfort'}
            </button>
            <button 
              onClick={() => setOpMode(opMode === 'standard' ? 'audit' : 'standard')}
              className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${opMode === 'audit' ? 'bg-amber-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}
            >
              {opMode === 'audit' ? 'Audit Active' : 'Standard'}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
           {/* Deep Dashboard Access */}
           <button 
             onClick={() => navigate('/dashboard/deep/main')}
             className="group relative px-6 py-3 bg-white/5 hover:bg-blue-600/20 border border-white/10 hover:border-blue-500/50 rounded-2xl transition-all duration-300 overflow-hidden"
           >
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative flex items-center gap-3">
                 <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg shadow-blue-600/20">
                    <History className="w-4 h-4 text-white" />
                 </div>
                 <div className="text-left">
                    <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest leading-none mb-1">Legacy Intelligence</p>
                    <p className="text-xs font-bold text-white uppercase tracking-tight">Access Deep Dashboard</p>
                 </div>
                 <ArrowRight className="w-4 h-4 text-blue-500 group-hover:translate-x-1 transition-transform ml-2" />
              </div>
           </button>

           <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-3 flex items-center gap-6 px-6">
              <div className="flex items-center gap-2">
                <SystemStatusDot status="Optimal" />
                <span className="text-[10px] font-bold uppercase text-slate-400">Database</span>
              </div>
              <div className="w-[1px] h-4 bg-slate-700" />
              <div className="flex items-center gap-2">
                <SystemStatusDot status="Optimal" />
                <span className="text-[10px] font-bold uppercase text-slate-400">API Core</span>
              </div>
              <div className="w-[1px] h-4 bg-slate-700" />
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-white">{new Date().toLocaleTimeString()}</span>
              </div>
           </div>
        </div>
      </div>

      {/* KPI Section */}
      <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-5">
        <KPICard 
          title="Total Assets" value={data.summary.totalAssets.value} trend={`+${data.summary.totalAssets.trend} wk`} type="up" 
          icon={MonitorSmartphone} color="bg-blue-600" glowColor="rgba(59, 130, 246, 0.4)" onClick={() => navigate('/assets')} 
        />
        <KPICard 
          title="Assigned" value={data.summary.assigned.value} trend={`+${data.summary.assigned.trend} day`} type="up" 
          icon={UserCheck} color="bg-indigo-600" glowColor="rgba(79, 70, 229, 0.4)" onClick={() => navigate('/assets?status=ASSIGNED')} 
        />
        <KPICard 
          title="Available" value={data.summary.available.value} trend={`+${data.summary.available.trend} rtr`} type="up" 
          icon={CheckCircle2} color="bg-emerald-600" glowColor="rgba(16, 185, 129, 0.4)" onClick={() => navigate('/assets?status=AVAILABLE')} 
        />
        <KPICard 
          title="In Repair" value={data.summary.repair.value} trend={`${data.summary.repair.trend} mnt`} type="neutral" 
          icon={Wrench} color="bg-amber-600" glowColor="rgba(245, 158, 11, 0.4)" onClick={() => navigate('/maintenance')} 
        />
        <KPICard 
          title="Warranty Risk" value={data.summary.warranty.value} trend={`${data.summary.warranty.trend} rsk`} type="down" 
          icon={ShieldCheck} color="bg-rose-600" glowColor="rgba(225, 29, 72, 0.4)" onClick={() => navigate('/reports')} 
        />
        <KPICard 
          title="Total Staff" value={data.analytics.departments.reduce((acc, curr) => acc + curr.staffCount, 0)} trend={`+12 mth`} type="up" 
          icon={UserCheck} color="bg-purple-600" glowColor="rgba(147, 51, 234, 0.4)" onClick={() => navigate('/employees')} 
        />
      </div>

      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Main Analytics Area */}
        <div className="lg:col-span-8 space-y-8">
          
          {/* Timeline Chart */}
          <GlassCard className="h-[400px]">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-500" /> Asset Activity Timeline
              </h3>
              <div className="flex gap-4">
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-blue-500" /> <span className="text-[10px] font-bold">Assigned</span></div>
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500" /> <span className="text-[10px] font-bold">Returned</span></div>
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-amber-500" /> <span className="text-[10px] font-bold">Repairs</span></div>
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
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="date" stroke="#64748b" fontSize={10} axisLine={false} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={10} axisLine={false} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                    itemStyle={{ fontSize: '10px', fontWeight: 'bold' }}
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
             {/* Department Intelligence */}
             <GlassCard className="min-h-[450px]">
                <div className="flex justify-between items-center mb-8 pb-4 border-b border-white/5">
                   <h3 className="text-sm font-black uppercase tracking-[0.25em] text-white flex items-center gap-2">
                     <Building2 className="w-4 h-4 text-indigo-500" /> Department Intelligence
                   </h3>
                   <span className="text-[9px] font-bold text-slate-500 uppercase">Top Performers</span>
                </div>
                <div className="space-y-8">
                   {data.analytics.departments.map((dept, idx) => (
                      <div 
                        key={dept.id} 
                        className="relative"
                        onMouseEnter={() => setHoveredDept(dept.id)}
                        onMouseLeave={() => setHoveredDept(null)}
                      >
                         <div className="flex justify-between items-center mb-2">
                            <div className="flex items-center gap-3">
                               <div className="w-8 h-8 rounded-xl bg-indigo-600/10 flex items-center justify-center border border-indigo-500/20 group-hover:bg-indigo-600/30 transition-colors">
                                  <Building2 className="w-4 h-4 text-indigo-400" />
                               </div>
                               <div>
                                  <h4 className="text-[11px] font-black uppercase text-white tracking-wide">{dept.name}</h4>
                                  <div className="flex gap-2 text-[9px] font-bold text-slate-500">
                                     <span>{dept.count} Assets</span>
                                     <span>•</span>
                                     <span>{dept.staffCount} Staff</span>
                                  </div>
                               </div>
                            </div>
                            <div className="text-right">
                               <span className="text-[11px] font-black text-indigo-400">{Math.round(dept.utilization)}%</span>
                               <p className="text-[8px] font-bold text-slate-600 uppercase tracking-tighter">Utilization</p>
                            </div>
                         </div>
                         <div className="h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/5">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${dept.utilization}%` }}
                              transition={{ duration: 1.5, delay: idx * 0.1 }}
                              className="h-full bg-gradient-to-r from-indigo-600 to-purple-500 rounded-full"
                            />
                         </div>

                         {/* Hover Tooltip */}
                         <AnimatePresence>
                           {hoveredDept === dept.id && (
                             <IntelligenceTooltip 
                               title={`${dept.name} Analytics`}
                               color="bg-indigo-500"
                               icon={Building2}
                               stats={[
                                 { label: 'Assigned Assets', value: dept.assigned },
                                 { label: 'Available Inventory', value: dept.available },
                                 { label: 'Operational Staff', value: dept.staffCount },
                                 { label: 'Density Index', value: (dept.count / (dept.staffCount || 1)).toFixed(1) }
                               ]}
                             />
                           )}
                         </AnimatePresence>
                      </div>
                   ))}
                </div>
             </GlassCard>

             {/* Location Intelligence */}
             <GlassCard className="min-h-[450px]">
                <div className="flex justify-between items-center mb-8 pb-4 border-b border-white/5">
                   <h3 className="text-sm font-black uppercase tracking-[0.25em] text-white flex items-center gap-2">
                     <MapPin className="w-4 h-4 text-emerald-500" /> Location Intelligence
                   </h3>
                   <span className="text-[9px] font-bold text-slate-500 uppercase">Asset Heatmap</span>
                </div>
                <div className="space-y-8">
                   {data.analytics.locations.map((loc, idx) => (
                      <div 
                        key={loc.id} 
                        className="relative"
                        onMouseEnter={() => setHoveredLoc(loc.id)}
                        onMouseLeave={() => setHoveredLoc(null)}
                      >
                         <div className="flex justify-between items-center mb-2">
                            <div className="flex items-center gap-3">
                               <div className="w-8 h-8 rounded-xl bg-emerald-600/10 flex items-center justify-center border border-emerald-500/20">
                                  <MapPin className="w-4 h-4 text-emerald-400" />
                               </div>
                               <div>
                                  <h4 className="text-[11px] font-black uppercase text-white tracking-wide">{loc.name}</h4>
                                  <div className="flex gap-2 text-[9px] font-bold text-slate-500">
                                     <span>{loc.count} Units</span>
                                     <span className="text-amber-500/80">{loc.repairCount} Repairs</span>
                                  </div>
                               </div>
                            </div>
                            <div className="text-right">
                               <span className="text-[11px] font-black text-emerald-400">{Math.round(loc.activePercentage)}%</span>
                               <p className="text-[8px] font-bold text-slate-600 uppercase tracking-tighter">Active Protocol</p>
                            </div>
                         </div>
                         <div className="h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/5">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${loc.activePercentage}%` }}
                              transition={{ duration: 1.5, delay: idx * 0.1 }}
                              className="h-full bg-gradient-to-r from-emerald-600 to-blue-500 rounded-full"
                            />
                         </div>

                         {/* Hover Tooltip */}
                         <AnimatePresence>
                           {hoveredLoc === loc.id && (
                             <IntelligenceTooltip 
                               title={`${loc.name} Pulse`}
                               color="bg-emerald-500"
                               icon={MapPin}
                               stats={[
                                 { label: 'Active Asset Pool', value: loc.activeCount },
                                 { label: 'Stationed Employees', value: loc.staffCount },
                                 { label: 'Maintenance Queue', value: loc.repairCount },
                                 { label: 'Health Index', value: `${Math.round(loc.activePercentage)}%` }
                               ]}
                             />
                           )}
                         </AnimatePresence>
                      </div>
                   ))}
                </div>
             </GlassCard>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Status Donut */}
            <GlassCard className="h-[400px] flex flex-col">
              <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-white mb-4">Inventory Composition</h3>
              <div className="flex-1 w-full min-h-[300px]">
                <ResponsiveContainer width="100%" height="100%" minHeight={300}>
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
                      animationBegin={0}
                      animationDuration={1500}
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

            {/* AI Insights Card (formerly Department Density) */}
            <GlassCard className="h-[400px]">
              <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-white mb-6">Intelligent Forecasting</h3>
              <div className="space-y-6">
                 <div className="p-4 bg-blue-600/10 border border-blue-500/20 rounded-2xl flex items-center gap-4">
                    <Sparkles className="w-6 h-6 text-blue-400 shrink-0" />
                    <div>
                      <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Global Density</p>
                      <p className="text-xs text-slate-300 font-medium leading-relaxed">
                        Top 5 departments represent <span className="text-white font-bold">{Math.round(data.analytics.departments.reduce((a,b) => a+b.percentage, 0))}%</span> of total operational footprint.
                      </p>
                    </div>
                 </div>
                 <div className="p-4 bg-purple-600/10 border border-purple-500/20 rounded-2xl flex items-center gap-4">
                    <TrendingUp className="w-6 h-6 text-purple-400 shrink-0" />
                    <div>
                      <p className="text-[10px] font-bold text-purple-400 uppercase tracking-widest">Protocol Optimization</p>
                      <p className="text-xs text-slate-300 font-medium leading-relaxed">
                        Department <span className="text-white font-bold">{data.analytics.departments[0]?.name}</span> utilization is at <span className="text-emerald-400 font-bold">{Math.round(data.analytics.departments[0]?.utilization)}%</span>.
                      </p>
                    </div>
                 </div>
                 <div className="p-4 bg-amber-600/10 border border-amber-500/20 rounded-2xl flex items-center gap-4">
                    <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0" />
                    <div>
                      <p className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">Maintenance Latency</p>
                      <p className="text-xs text-slate-300 font-medium leading-relaxed">
                        Location <span className="text-white font-bold">{data.analytics.locations.sort((a,b) => b.repairCount - a.repairCount)[0]?.name}</span> requires attention with <span className="text-amber-400 font-bold">{data.analytics.locations.sort((a,b) => b.repairCount - a.repairCount)[0]?.repairCount}</span> active repairs.
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
            <h2 className="text-xs font-black uppercase tracking-[0.3em] text-slate-500 flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-500" /> Intelligence Alerts
            </h2>
            <AnimatePresence>
              {data.alerts.longRepair.length > 0 && (
                <GlassCard glowColor="rgba(245, 158, 11, 0.4)" className="!p-4 border-amber-500/20">
                  <div className="flex gap-4">
                    <div className="p-2 bg-amber-500/20 rounded-xl"><Wrench className="w-5 h-5 text-amber-500" /></div>
                    <div>
                      <p className="text-xs font-bold text-white uppercase tracking-tight">Repair Latency Detected</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{data.alerts.longRepair.length} assets exceeding 5-day technical queue.</p>
                      <button onClick={() => navigate('/maintenance')} className="mt-3 text-[10px] font-black text-amber-500 flex items-center gap-1 hover:gap-2 transition-all">
                        INITIATE AUDIT <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </GlassCard>
              )}
              {data.alerts.warranty30 > 0 && (
                <GlassCard glowColor="rgba(239, 68, 68, 0.4)" className="!p-4 border-rose-500/20">
                  <div className="flex gap-4">
                    <div className="p-2 bg-rose-500/20 rounded-xl"><ShieldCheck className="w-5 h-5 text-rose-500" /></div>
                    <div>
                      <p className="text-xs font-bold text-white uppercase tracking-tight">Critical Warranty Risk</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{data.alerts.warranty30} assets entering EOL status in 30 days.</p>
                      <button onClick={() => navigate('/reports')} className="mt-3 text-[10px] font-black text-rose-500 flex items-center gap-1 hover:gap-2 transition-all">
                        PROTECTION PROTOCOL <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </GlassCard>
              )}
              {data.alerts.hardwareRefresh > 0 && (
                <GlassCard glowColor="rgba(16, 185, 129, 0.4)" className="!p-4 border-emerald-500/20">
                  <div className="flex gap-4">
                    <div className="p-2 bg-emerald-500/20 rounded-xl"><Sparkles className="w-5 h-5 text-emerald-500" /></div>
                    <div>
                      <p className="text-xs font-bold text-white uppercase tracking-tight">Hardware Refresh Cycle</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{data.alerts.hardwareRefresh} operational assets are &gt;4 years old.</p>
                      <button onClick={() => navigate('/reports')} className="mt-3 text-[10px] font-black text-emerald-500 flex items-center gap-1 hover:gap-2 transition-all">
                        VIEW UPGRADE PIPELINE <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </GlassCard>
              )}
            </AnimatePresence>
          </div>

          {/* Quick Operations */}
          <GlassCard className="!p-0">
            <div className="p-6 border-b border-white/10 flex justify-between items-center">
              <h3 className="text-xs font-black uppercase tracking-[0.3em] text-white">Quick Operations</h3>
              <PlusCircle className="w-4 h-4 text-slate-500" />
            </div>
            <div className="grid grid-cols-2">
              <button onClick={() => navigate('/assets/add')} className="p-6 border-r border-b border-white/10 hover:bg-white/5 transition-all flex flex-col items-center gap-2">
                <div className="p-2 bg-blue-500/20 rounded-xl"><PlusCircle className="w-5 h-5 text-blue-500" /></div>
                <span className="text-[9px] font-bold uppercase text-slate-400 tracking-widest">Add Asset</span>
              </button>
              <button onClick={() => navigate('/assignments')} className="p-6 border-b border-white/10 hover:bg-white/5 transition-all flex flex-col items-center gap-2">
                <div className="p-2 bg-indigo-500/20 rounded-xl"><UserCheck className="w-5 h-5 text-indigo-500" /></div>
                <span className="text-[9px] font-bold uppercase text-slate-400 tracking-widest">Assign</span>
              </button>
              <button onClick={() => navigate('/qr-code')} className="p-6 border-r border-white/10 hover:bg-white/5 transition-all flex flex-col items-center gap-2">
                <div className="p-2 bg-emerald-500/20 rounded-xl"><QrCode className="w-5 h-5 text-emerald-500" /></div>
                <span className="text-[9px] font-bold uppercase text-slate-400 tracking-widest">QR Matrix</span>
              </button>
              <button onClick={() => navigate('/maintenance')} className="p-6 hover:bg-white/5 transition-all flex flex-col items-center gap-2">
                <div className="p-2 bg-amber-500/20 rounded-xl"><Wrench className="w-5 h-5 text-amber-500" /></div>
                <span className="text-[9px] font-bold uppercase text-slate-400 tracking-widest">Repair Log</span>
              </button>
            </div>
          </GlassCard>

          {/* Global Activity Pulse */}
          <GlassCard className="!p-0">
            <div className="p-6 border-b border-white/10 flex justify-between items-center">
              <h3 className="text-xs font-black uppercase tracking-[0.3em] text-white">Activity Pulse</h3>
              <History className="w-4 h-4 text-slate-500" />
            </div>
            <div className="p-4 space-y-1 max-h-[300px] overflow-y-auto custom-scrollbar">
              {data.activityFeed.length === 0 ? (
                <p className="text-[10px] text-slate-500 text-center italic py-8">No recent system pulse detected.</p>
              ) : data.activityFeed.slice(0, 10).map((log, idx) => (
                <div key={log.id} className="group flex gap-3 p-2 rounded-xl hover:bg-white/5 transition-all cursor-pointer" onClick={() => navigate('/audit-logs')}>
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                    log.action.includes('CREATE') ? 'bg-emerald-500/20 text-emerald-400' :
                    log.action.includes('DELETE') ? 'bg-rose-500/20 text-rose-400' :
                    'bg-blue-500/20 text-blue-400'
                  }`}>
                    <Activity className="w-3 h-3" />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-slate-300 group-hover:text-white leading-tight transition-colors">{log.description}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">{log.userName}</span>
                      <span className="text-slate-700">•</span>
                      <span className="text-[9px] font-bold text-slate-600 italic">{new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <button 
              onClick={() => navigate('/audit-logs')}
              className="w-full p-4 text-[10px] font-black text-blue-500 hover:bg-blue-600/10 transition-all uppercase border-t border-white/10 flex items-center justify-center gap-2"
            >
              Analyze Full Matrix <ChevronRight className="w-3 h-3" />
            </button>
          </GlassCard>

          {/* Environment Health Widget */}
          <GlassCard className="bg-slate-900/60 border-white/5">
            <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-6">Environment Health</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Database className="w-4 h-4 text-emerald-500" />
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-tight">ERP Database</span>
                </div>
                <div className="flex items-center gap-2">
                   <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                   <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Optimal</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Server className="w-4 h-4 text-blue-500" />
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-tight">Compute Core</span>
                </div>
                <div className="flex items-center gap-2">
                   <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                   <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Stable</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="w-4 h-4 text-purple-500" />
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-tight">Vault Protocol</span>
                </div>
                <div className="flex items-center gap-2">
                   <div className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                   <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Active</span>
                </div>
              </div>
            </div>
          </GlassCard>

        </div>
      </div>

      {/* Primary Section Anchors */}
      <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Employee Directory', icon: UserCheck, color: 'text-blue-400', nav: '/employees', desc: 'Manage staff & identity matrix' },
          { label: 'Department Section', icon: Building2, color: 'text-indigo-400', nav: '/departments', desc: 'Operational division intelligence' },
          { label: 'Location Section', icon: MapPin, color: 'text-emerald-400', nav: '/locations', desc: 'Geographic asset distribution' },
          { label: 'Report Engine', icon: FileText, color: 'text-rose-400', nav: '/reports', desc: 'Audit exports & data analysis' }
        ].map(btn => (
          <GlassCard key={btn.label} className="cursor-pointer group" onClick={() => navigate(btn.nav)}>
             <div className="flex items-start gap-4">
               <div className={`p-3 rounded-2xl bg-white/5 group-hover:bg-white/10 transition-colors`}>
                 <btn.icon className={`w-5 h-5 ${btn.color}`} />
               </div>
               <div>
                 <h4 className="text-xs font-black uppercase tracking-widest text-white">{btn.label}</h4>
                 <p className="text-[10px] text-slate-500 mt-1">{btn.desc}</p>
                 <div className="mt-3 flex items-center gap-2 text-[9px] font-black text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">
                    INITIALIZE VIEW <ChevronRight className="w-3 h-3" />
                 </div>
               </div>
             </div>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}
