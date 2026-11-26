import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search, PlusCircle, Loader2, Ticket, ArrowUpDown, Filter, RefreshCw, UserCheck, Clock
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { apiFetch, isHelpDeskManager, STATUS_LABELS } from '../../utils/helpdeskApi';
import { HelpDeskSubNav, PriorityBadge, SlaBadge, StatusBadge } from './HelpDeskShared';

export default function TicketListPage({ queue = 'all', title = 'Help Desk Tickets', subtitle = 'Track and manage IT support tickets.' }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [tickets, setTickets] = useState([]);
  const [options, setOptions] = useState({ categories: [], departments: [], locations: [], officers: [] });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'ALL');
  const [priorityFilter, setPriorityFilter] = useState(searchParams.get('priority') || 'ALL');
  const [categoryFilter, setCategoryFilter] = useState(searchParams.get('categoryId') || 'ALL');
  const [deptFilter, setDeptFilter] = useState(searchParams.get('departmentId') || 'ALL');
  const [branchFilter, setBranchFilter] = useState(searchParams.get('locationId') || 'ALL');
  const [officerFilter, setOfficerFilter] = useState(searchParams.get('assignedToId') || 'ALL');
  const [sortBy, setSortBy] = useState('newest');

  const manager = isHelpDeskManager(user);

  const loadTickets = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ queue });
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (priorityFilter !== 'ALL') params.set('priority', priorityFilter);
      if (categoryFilter !== 'ALL') params.set('categoryId', categoryFilter);
      if (deptFilter !== 'ALL') params.set('departmentId', deptFilter);
      if (branchFilter !== 'ALL') params.set('locationId', branchFilter);
      if (officerFilter !== 'ALL') params.set('assignedToId', officerFilter);
      if (search.trim()) params.set('search', search.trim());

      const [tRes, optRes] = await Promise.all([
        apiFetch(`/helpdesk/tickets?${params.toString()}`),
        apiFetch('/helpdesk/form-options'),
      ]);
      setTickets(tRes);
      setOptions(optRes);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setStatusFilter(searchParams.get('status') || 'ALL');
    setPriorityFilter(searchParams.get('priority') || 'ALL');
    setCategoryFilter(searchParams.get('categoryId') || 'ALL');
    setDeptFilter(searchParams.get('departmentId') || 'ALL');
    setBranchFilter(searchParams.get('locationId') || 'ALL');
    setOfficerFilter(searchParams.get('assignedToId') || 'ALL');
  }, [queue, searchParams]);

  useEffect(() => {
    loadTickets();
  }, [queue, statusFilter, priorityFilter, categoryFilter, deptFilter, branchFilter, officerFilter]);

  const sortedTickets = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = !q
      ? tickets
      : tickets.filter(
          (t) =>
            t.ticketCode?.toLowerCase().includes(q) ||
            t.subject?.toLowerCase().includes(q) ||
            t.requesterName?.toLowerCase().includes(q) ||
            t.asset?.assetCode?.toLowerCase().includes(q)
        );

    const priorityRank = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
    return [...filtered].sort((a, b) => {
      if (sortBy === 'oldest') return new Date(a.createdAt) - new Date(b.createdAt);
      if (sortBy === 'priority') return (priorityRank[b.priority] || 0) - (priorityRank[a.priority] || 0);
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  }, [tickets, search, sortBy]);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-5 pb-24 md:pb-8">
      <HelpDeskSubNav />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2.5">
            <Ticket className="w-6 h-6 text-blue-600" />
            {title}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadTickets}
            className="px-3.5 py-2 rounded-xl bg-white dark:bg-[#0d1424] border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
          <button
            onClick={() => navigate('/helpdesk/new')}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm shadow-blue-600/20 flex items-center gap-1.5 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" /> New Request
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white dark:bg-[#0d1424] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3 shadow-sm">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Ticket #, Subject, Employee, or Asset ID..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none"
            >
              <option value="ALL">All Statuses</option>
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none"
            >
              <option value="ALL">All Priorities</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none"
            >
              <option value="ALL">All Categories</option>
              {options.categories?.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            {manager && (
              <>
                <select
                  value={deptFilter}
                  onChange={(e) => setDeptFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none"
                >
                  <option value="ALL">All Departments</option>
                  {options.departments?.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
                <select
                  value={branchFilter}
                  onChange={(e) => setBranchFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none"
                >
                  <option value="ALL">All Branches</option>
                  {options.locations?.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
                <select
                  value={officerFilter}
                  onChange={(e) => setOfficerFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none"
                >
                  <option value="ALL">All IT Officers</option>
                  {options.officers?.map((o) => (
                    <option key={o.id} value={o.id}>{o.fullName}</option>
                  ))}
                </select>
              </>
            )}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none"
            >
              <option value="newest">Sort: Newest</option>
              <option value="oldest">Sort: Oldest</option>
              <option value="priority">Sort: Highest Priority</option>
            </select>
          </div>
        </div>
      </div>

      {/* Ticket Cards / Table */}
      {loading ? (
        <div className="flex h-60 items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : sortedTickets.length === 0 ? (
        <div className="bg-white dark:bg-[#0d1424] border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center">
          <Ticket className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800 dark:text-white">No Tickets Found</h3>
          <p className="text-xs text-slate-500 mt-1">Adjust your search or filters, or submit a new support request.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-[#0d1424] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900/70 text-slate-500 dark:text-slate-400 uppercase text-[10px] font-bold tracking-wider border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3.5">Ticket #</th>
                  <th className="px-4 py-3.5">Subject & Category</th>
                  <th className="px-4 py-3.5">Requester</th>
                  <th className="px-4 py-3.5">Priority</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">SLA</th>
                  <th className="px-4 py-3.5">Assigned To</th>
                  <th className="px-4 py-3.5">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                {sortedTickets.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => navigate(`/helpdesk/tickets/${t.id}`)}
                    className="hover:bg-blue-50/40 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3.5 font-mono font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                      {t.ticketCode}
                    </td>
                    <td className="px-4 py-3.5 max-w-xs">
                      <p className="font-bold text-slate-800 dark:text-white truncate">{t.subject}</p>
                      <p className="text-[11px] text-slate-500 truncate">
                        {t.category?.name || 'Other'} • {t.requestType?.replace('_', ' ')}
                        {t.asset ? ` • ${t.asset.assetCode}` : ''}
                      </p>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <p className="font-semibold text-slate-700 dark:text-slate-200">{t.requesterName || t.employee?.fullName || '—'}</p>
                      <p className="text-[10px] text-slate-400">{t.department?.name || 'No Dept'} • {t.location?.name || 'No Branch'}</p>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap"><PriorityBadge priority={t.priority} /></td>
                    <td className="px-4 py-3.5 whitespace-nowrap"><StatusBadge status={t.status} /></td>
                    <td className="px-4 py-3.5 whitespace-nowrap"><SlaBadge slaInfo={t.slaInfo} /></td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-slate-700 dark:text-slate-300">
                      {t.assignedTo?.fullName || <span className="text-amber-600 font-semibold">Unassigned</span>}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-slate-500">
                      {new Date(t.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
