import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts';
import {
  Ticket, AlertCircle, UserX, UserCheck, Wrench, PauseCircle, CheckCircle2,
  Archive, RefreshCw, ShieldAlert, Clock, Star, ShieldCheck, Loader2, BarChart3
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { apiFetch, formatMinutes } from '../../utils/helpdeskApi';
import { HelpDeskSubNav } from './HelpDeskShared';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];

export default function HelpDeskManagementDashboard() {
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [options, setOptions] = useState({ categories: [], departments: [], locations: [], officers: [] });
  const [loading, setLoading] = useState(true);

  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    departmentId: 'ALL',
    locationId: 'ALL',
    assignedToId: 'ALL',
    categoryId: 'ALL',
    priority: 'ALL',
    status: 'ALL',
  });

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => {
        if (v && v !== 'ALL') params.set(k, v);
      });
      const [dash, opts] = await Promise.all([
        apiFetch(`/helpdesk/management/dashboard?${params.toString()}`),
        apiFetch('/helpdesk/form-options'),
      ]);
      setData(dash);
      setOptions(opts);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, [filters]);

  const k = data?.kpis || {};
  const c = data?.charts || {};

  const kpiCards = [
    { label: 'Total Inquiries', value: k.totalInquiries ?? 0, icon: Ticket, color: 'text-blue-600 bg-blue-500/10', to: '/helpdesk/tickets' },
    { label: 'Open Tickets', value: k.openTickets ?? 0, icon: AlertCircle, color: 'text-rose-600 bg-rose-500/10', to: '/helpdesk/tickets?status=OPEN' },
    { label: 'Unassigned', value: k.unassignedTickets ?? 0, icon: UserX, color: 'text-orange-600 bg-orange-500/10', to: '/helpdesk/unassigned' },
    { label: 'Assigned', value: k.assignedTickets ?? 0, icon: UserCheck, color: 'text-indigo-600 bg-indigo-500/10', to: '/helpdesk/tickets?status=ASSIGNED' },
    { label: 'In Progress', value: k.inProgressTickets ?? 0, icon: Wrench, color: 'text-blue-600 bg-blue-500/10', to: '/helpdesk/tickets?status=IN_PROGRESS' },
    { label: 'Pending', value: k.pendingTickets ?? 0, icon: PauseCircle, color: 'text-amber-600 bg-amber-500/10', to: '/helpdesk/pending' },
    { label: 'Resolved', value: k.resolvedTickets ?? 0, icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-500/10', to: '/helpdesk/tickets?status=RESOLVED' },
    { label: 'Closed', value: k.closedTickets ?? 0, icon: Archive, color: 'text-slate-600 bg-slate-500/10', to: '/helpdesk/tickets?status=CLOSED' },
    { label: 'Reopened', value: k.reopenedTickets ?? 0, icon: RefreshCw, color: 'text-orange-600 bg-orange-500/10', to: '/helpdesk/tickets?status=REOPENED' },
    { label: 'Overdue (SLA)', value: k.overdueTickets ?? 0, icon: ShieldAlert, color: 'text-rose-600 bg-rose-500/10', to: '/helpdesk/sla' },
    { label: 'Avg First Response', value: formatMinutes(k.avgFirstResponseMinutes ?? 0), icon: Clock, color: 'text-cyan-600 bg-cyan-500/10', to: '/helpdesk/sla' },
    { label: 'Avg Resolution', value: formatMinutes(k.avgResolutionMinutes ?? 0), icon: Clock, color: 'text-indigo-600 bg-indigo-500/10', to: '/helpdesk/reports' },
    { label: 'Employee Rating', value: k.avgSatisfactionRating ? `${k.avgSatisfactionRating} / 5` : 'N/A', icon: Star, color: 'text-amber-500 bg-amber-500/10', to: '/helpdesk/reports?type=satisfaction' },
    { label: 'SLA Compliance', value: `${k.slaComplianceRate ?? 100}%`, icon: ShieldCheck, color: 'text-emerald-600 bg-emerald-500/10', to: '/helpdesk/sla' },
  ];

  const ChartCard = ({ title, children }) => (
    <div className="bg-white dark:bg-[#0d1424] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
      <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-200 mb-4">{title}</h3>
      <div className="h-64 w-full">{children}</div>
    </div>
  );

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 pb-24 md:pb-8">
      <HelpDeskSubNav />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2.5">
            <BarChart3 className="w-6 h-6 text-blue-600" />
            IT Help Desk Management Dashboard
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Real-time ticket KPIs, SLA compliance, technician workload, and operational analytics.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-[#0d1424] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5 shadow-sm">
        <input type="date" value={filters.dateFrom} onChange={(e) => setFilters((p) => ({ ...p, dateFrom: e.target.value }))} className="px-2.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs" title="From Date" />
        <input type="date" value={filters.dateTo} onChange={(e) => setFilters((p) => ({ ...p, dateTo: e.target.value }))} className="px-2.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs" title="To Date" />
        <select value={filters.departmentId} onChange={(e) => setFilters((p) => ({ ...p, departmentId: e.target.value }))} className="px-2.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs">
          <option value="ALL">All Depts</option>
          {options.departments?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select value={filters.locationId} onChange={(e) => setFilters((p) => ({ ...p, locationId: e.target.value }))} className="px-2.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs">
          <option value="ALL">All Branches</option>
          {options.locations?.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        <select value={filters.assignedToId} onChange={(e) => setFilters((p) => ({ ...p, assignedToId: e.target.value }))} className="px-2.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs">
          <option value="ALL">All Officers</option>
          {options.officers?.map((o) => <option key={o.id} value={o.id}>{o.fullName}</option>)}
        </select>
        <select value={filters.categoryId} onChange={(e) => setFilters((p) => ({ ...p, categoryId: e.target.value }))} className="px-2.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs">
          <option value="ALL">All Categories</option>
          {options.categories?.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
        </select>
        <select value={filters.priority} onChange={(e) => setFilters((p) => ({ ...p, priority: e.target.value }))} className="px-2.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs">
          <option value="ALL">All Priorities</option>
          <option value="CRITICAL">Critical</option>
          <option value="HIGH">High</option>
          <option value="MEDIUM">Medium</option>
          <option value="LOW">Low</option>
        </select>
        <select value={filters.status} onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))} className="px-2.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs">
          <option value="ALL">All Statuses</option>
          <option value="OPEN">Open</option>
          <option value="ASSIGNED">Assigned</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="PENDING">Pending</option>
          <option value="RESOLVED">Resolved</option>
          <option value="CLOSED">Closed</option>
          <option value="REOPENED">Reopened</option>
        </select>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : (
        <>
          {/* 14 Clickable KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {kpiCards.map((card) => {
              const Icon = card.icon;
              return (
                <button
                  key={card.label}
                  onClick={() => navigate(card.to)}
                  className="text-left bg-white dark:bg-[#0d1424] border border-slate-200 dark:border-slate-800 hover:border-blue-500/60 rounded-2xl p-3.5 transition-all cursor-pointer shadow-sm"
                >
                  <div className={`w-8 h-8 rounded-xl ${card.color} flex items-center justify-center mb-2.5`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <p className="text-lg font-extrabold text-slate-900 dark:text-white">{card.value}</p>
                  <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5 truncate">{card.label}</p>
                </button>
              );
            })}
          </div>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChartCard title="Ticket Status Distribution">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={c.statusDistribution || []} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3}>
                    {(c.statusDistribution || []).map((_, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Monthly Ticket Trends (Received vs Resolved)">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={c.monthlyTrends || []}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="received" name="Received" stroke="#3b82f6" strokeWidth={2.5} />
                  <Line type="monotone" dataKey="resolved" name="Resolved" stroke="#10b981" strokeWidth={2.5} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Category-wise Inquiries">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={c.categoryWise || []}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Priority-wise Inquiries">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={c.priorityWise || []}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Department-wise Inquiries">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={c.departmentWise || []}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Branch-wise IT Issues">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={c.branchWise || []}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#06b6d4" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="IT Officer-wise Performance (Assigned vs Resolved)">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={c.officerPerformance || []}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="assigned" name="Assigned" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="resolved" name="Resolved" fill="#10b981" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="SLA Compliance Analysis">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={c.slaAnalysis || []} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3}>
                    {(c.slaAnalysis || []).map((_, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Employee Satisfaction Analysis">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={c.satisfactionAnalysis || []}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#10b981" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Frequently Reported Asset Issues">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={c.frequentAssetIssues || []} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#ef4444" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        </>
      )}
    </div>
  );
}
