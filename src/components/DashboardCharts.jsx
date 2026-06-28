import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Sector } from 'recharts';
import { useTheme } from '../context/ThemeContext';
import { MonitorSmartphone, Users } from 'lucide-react';

// Professional color palettes
const ASSET_COLORS = ['#22c55e', '#6366f1', '#f97316', '#ef4444'];
const DEPT_COLORS = ['#6366f1', '#8b5cf6', '#06b6d4', '#f59e0b', '#ec4899', '#10b981', '#f43f5e', '#3b82f6'];

// Custom active shape for 3D hover effect
const renderActiveShape = (props) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent, value } = props;
  return (
    <g>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius - 2}
        outerRadius={outerRadius + 8}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        style={{
          filter: `drop-shadow(0 4px 12px ${fill}66)`,
          transition: 'all 0.3s ease',
        }}
      />
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={outerRadius + 10}
        outerRadius={outerRadius + 14}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        opacity={0.4}
      />
    </g>
  );
};

// Glassmorphic tooltip
const ChartTooltip = ({ active, payload, isDark }) => {
  if (!active || !payload?.length) return null;
  const data = payload[0];
  return (
    <div
      className="px-4 py-3 rounded-xl text-sm"
      style={{
        background: isDark
          ? 'linear-gradient(145deg, rgba(17, 24, 39, 0.95), rgba(30, 41, 59, 0.95))'
          : 'linear-gradient(145deg, rgba(255, 255, 255, 0.97), rgba(248, 250, 252, 0.97))',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
        backdropFilter: 'blur(12px)',
        boxShadow: isDark
          ? '0 12px 30px rgba(0,0,0,0.5)'
          : '0 12px 30px rgba(0,0,0,0.12)',
      }}
    >
      <div className="flex items-center gap-2 mb-1">
        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: data.payload.fill || data.color }} />
        <span className={`font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>{data.name}</span>
      </div>
      <div className="flex items-center gap-3 mt-1">
        <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          {data.value} units
        </span>
        <span className="text-xs font-semibold text-purple-400">
          {((data.payload.percent || 0) * 100).toFixed(1)}%
        </span>
      </div>
    </div>
  );
};

export function AssetStatusChart({ data }) {
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [activeIndex, setActiveIndex] = useState(-1);

  const chartData = useMemo(() => {
    if (!data?.counts) return [];
    const total = (data.counts.available || 0) + (data.counts.assigned || 0) + (data.counts.repair || 0) + (data.counts.warranty || 0);
    return [
      { name: 'Available', value: data.counts.available || 0, fill: ASSET_COLORS[0], link: '/assets?status=AVAILABLE', percent: total ? (data.counts.available || 0) / total : 0 },
      { name: 'Assigned', value: data.counts.assigned || 0, fill: ASSET_COLORS[1], link: '/assets?status=ASSIGNED', percent: total ? (data.counts.assigned || 0) / total : 0 },
      { name: 'Under Repair', value: data.counts.repair || 0, fill: ASSET_COLORS[2], link: '/maintenance', percent: total ? (data.counts.repair || 0) / total : 0 },
      { name: 'Warranty Risk', value: data.counts.warranty || 0, fill: ASSET_COLORS[3], link: '/reports', percent: total ? (data.counts.warranty || 0) / total : 0 },
    ].filter(d => d.value > 0);
  }, [data]);

  const total = useMemo(() => chartData.reduce((sum, d) => sum + d.value, 0), [chartData]);

  const handleClick = useCallback((entry) => {
    if (entry?.link) navigate(entry.link);
  }, [navigate]);

  if (chartData.length === 0) return null;

  return (
    <div
      className="chart-animate-in rounded-2xl p-5 relative overflow-hidden"
      style={{
        background: isDark
          ? 'linear-gradient(145deg, rgba(17, 24, 39, 0.8), rgba(15, 23, 42, 0.9))'
          : 'linear-gradient(145deg, rgba(255, 255, 255, 0.9), rgba(248, 250, 252, 0.95))',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
        boxShadow: isDark
          ? '0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)'
          : '0 4px 24px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.8)',
        backdropFilter: 'blur(16px)',
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 mb-4">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDark ? 'bg-indigo-500/15' : 'bg-indigo-50'}`}>
          <MonitorSmartphone className="w-4 h-4 text-indigo-500" />
        </div>
        <div>
          <h3 className={`text-sm font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-800'}`}>Asset Status</h3>
          <p className={`text-[10px] uppercase tracking-widest font-semibold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Distribution Overview</p>
        </div>
      </div>

      {/* Chart */}
      <div className="relative" style={{ height: 220, minWidth: 200 }}>
        <ResponsiveContainer width="100%" height="100%" minWidth={200} minHeight={200}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={62}
              outerRadius={90}
              paddingAngle={3}
              dataKey="value"
              activeIndex={activeIndex}
              activeShape={renderActiveShape}
              onMouseEnter={(_, index) => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(-1)}
              onClick={(_, index) => handleClick(chartData[index])}
              style={{ cursor: 'pointer', outline: 'none' }}
              stroke="none"
              animationBegin={200}
              animationDuration={1000}
              animationEasing="ease-out"
            >
              {chartData.map((entry, index) => (
                <Cell key={index} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip isDark={isDark} />} />
          </PieChart>
        </ResponsiveContainer>
        {/* Center label with inner shadow */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center pointer-events-none"
          style={{
            width: 100, height: 100, borderRadius: '50%',
            background: isDark ? 'rgba(15, 23, 42, 0.7)' : 'rgba(255, 255, 255, 0.7)',
            boxShadow: `inset 0 4px 12px ${isDark ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.08)'}`,
          }}
        >
          <span className={`text-2xl font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>{total}</span>
          <span className={`text-[9px] font-bold uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Assets</span>
        </div>
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 gap-2 mt-3">
        {chartData.map((entry, idx) => (
          <button
            key={idx}
            onClick={() => handleClick(entry)}
            onMouseEnter={() => setActiveIndex(idx)}
            onMouseLeave={() => setActiveIndex(-1)}
            className={`flex items-center gap-2 p-2 rounded-lg text-left transition-all duration-200 ${
              activeIndex === idx
                ? isDark ? 'bg-white/[0.06]' : 'bg-slate-100'
                : 'hover:bg-white/[0.04] dark:hover:bg-white/[0.04]'
            }`}
          >
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.fill, boxShadow: activeIndex === idx ? `0 0 8px ${entry.fill}80` : 'none' }} />
            <div className="min-w-0">
              <p className={`text-[11px] font-semibold truncate ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{entry.name}</p>
              <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{entry.value} units</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export function EmployeeDistributionChart({ data }) {
  const { isDark } = useTheme();
  const [activeIndex, setActiveIndex] = useState(-1);

  const chartData = useMemo(() => {
    if (!data?.distribution?.departments) return [];
    const depts = data.distribution.departments
      .filter(d => d.employeeCount > 0)
      .sort((a, b) => b.employeeCount - a.employeeCount)
      .slice(0, 8);
    const total = depts.reduce((sum, d) => sum + d.employeeCount, 0);
    return depts.map((dept, i) => ({
      name: dept.name,
      value: dept.employeeCount,
      fill: DEPT_COLORS[i % DEPT_COLORS.length],
      percent: total ? dept.employeeCount / total : 0,
    }));
  }, [data]);

  const total = useMemo(() => chartData.reduce((sum, d) => sum + d.value, 0), [chartData]);

  if (chartData.length === 0) return null;

  return (
    <div
      className="chart-animate-in-delay rounded-2xl p-5 relative overflow-hidden"
      style={{
        background: isDark
          ? 'linear-gradient(145deg, rgba(17, 24, 39, 0.8), rgba(15, 23, 42, 0.9))'
          : 'linear-gradient(145deg, rgba(255, 255, 255, 0.9), rgba(248, 250, 252, 0.95))',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
        boxShadow: isDark
          ? '0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)'
          : '0 4px 24px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.8)',
        backdropFilter: 'blur(16px)',
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 mb-4">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDark ? 'bg-purple-500/15' : 'bg-purple-50'}`}>
          <Users className="w-4 h-4 text-purple-500" />
        </div>
        <div>
          <h3 className={`text-sm font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-800'}`}>Staff by Department</h3>
          <p className={`text-[10px] uppercase tracking-widest font-semibold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Employee Distribution</p>
        </div>
      </div>

      {/* Chart */}
      <div className="relative" style={{ height: 220, minWidth: 200 }}>
        <ResponsiveContainer width="100%" height="100%" minWidth={200} minHeight={200}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={62}
              outerRadius={90}
              paddingAngle={2}
              dataKey="value"
              activeIndex={activeIndex}
              activeShape={renderActiveShape}
              onMouseEnter={(_, index) => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(-1)}
              style={{ cursor: 'pointer', outline: 'none' }}
              stroke="none"
              animationBegin={400}
              animationDuration={1000}
              animationEasing="ease-out"
            >
              {chartData.map((entry, index) => (
                <Cell key={index} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip isDark={isDark} />} />
          </PieChart>
        </ResponsiveContainer>
        {/* Center label */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center pointer-events-none"
          style={{
            width: 100, height: 100, borderRadius: '50%',
            background: isDark ? 'rgba(15, 23, 42, 0.7)' : 'rgba(255, 255, 255, 0.7)',
            boxShadow: `inset 0 4px 12px ${isDark ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.08)'}`,
          }}
        >
          <span className={`text-2xl font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>{total}</span>
          <span className={`text-[9px] font-bold uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Staff</span>
        </div>
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 gap-2 mt-3">
        {chartData.slice(0, 6).map((entry, idx) => (
          <div
            key={idx}
            onMouseEnter={() => setActiveIndex(idx)}
            onMouseLeave={() => setActiveIndex(-1)}
            className={`flex items-center gap-2 p-2 rounded-lg transition-all duration-200 ${
              activeIndex === idx
                ? isDark ? 'bg-white/[0.06]' : 'bg-slate-100'
                : ''
            }`}
          >
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.fill, boxShadow: activeIndex === idx ? `0 0 8px ${entry.fill}80` : 'none' }} />
            <div className="min-w-0">
              <p className={`text-[11px] font-semibold truncate ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{entry.name}</p>
              <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{entry.value} staff</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
