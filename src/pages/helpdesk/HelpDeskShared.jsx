import { NavLink, useNavigate } from 'react-router-dom';
import {
  AlertCircle, CheckCircle2, Clock, PauseCircle, RefreshCw, UserCheck,
  Wrench, ShieldAlert, Compass, LifeBuoy, PlusCircle, ListTodo,
  BarChart3, Users, Timer, FileBarChart, Settings, Inbox, UserCog, ArrowRightLeft
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { hasModuleAccess, isHelpDeskManager, isITStaff, STATUS_LABELS, formatMinutes } from '../../utils/helpdeskApi';

export function StatusBadge({ status }) {
  const styles = {
    OPEN: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30',
    ASSIGNED: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-500/15 dark:text-indigo-300 dark:border-indigo-500/30',
    IN_PROGRESS: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30',
    PENDING: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30',
    RESOLVED: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30',
    CLOSED: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-700/60 dark:text-slate-300 dark:border-slate-600',
    REOPENED: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-500/15 dark:text-orange-300 dark:border-orange-500/30',
  };
  const icons = {
    OPEN: AlertCircle,
    ASSIGNED: UserCheck,
    IN_PROGRESS: Wrench,
    PENDING: PauseCircle,
    RESOLVED: CheckCircle2,
    CLOSED: CheckCircle2,
    REOPENED: RefreshCw,
  };
  const Icon = icons[status] || Clock;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${styles[status] || styles.OPEN}`}>
      <Icon className="w-3.5 h-3.5" />
      {STATUS_LABELS[status] || status}
    </span>
  );
}

export function PriorityBadge({ priority }) {
  const styles = {
    CRITICAL: 'bg-rose-600 text-white border-rose-700 shadow-sm shadow-rose-600/20',
    HIGH: 'bg-amber-500/15 text-amber-700 border-amber-300 dark:text-amber-300 dark:border-amber-500/40',
    MEDIUM: 'bg-blue-500/10 text-blue-700 border-blue-200 dark:text-blue-300 dark:border-blue-500/30',
    LOW: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider border ${styles[priority] || styles.MEDIUM}`}>
      {priority}
    </span>
  );
}

export function SlaBadge({ slaInfo }) {
  if (!slaInfo) return null;
  const { slaStatus, remainingMinutes, overdueMinutes } = slaInfo;
  const styles = {
    MET: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30',
    ON_TRACK: 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-500/15 dark:text-cyan-300 dark:border-cyan-500/30',
    APPROACHING: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30',
    PAUSED: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-700/60 dark:text-slate-300 dark:border-slate-600',
    BREACHED: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30',
  };

  let text = slaStatus.replace('_', ' ');
  if (slaStatus === 'BREACHED' && overdueMinutes > 0) text = `OVERDUE ${formatMinutes(overdueMinutes)}`;
  else if ((slaStatus === 'ON_TRACK' || slaStatus === 'APPROACHING') && remainingMinutes != null) {
    text = `${slaStatus === 'APPROACHING' ? 'DUE SOON' : 'SLA'} ${formatMinutes(remainingMinutes)}`;
  }

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${styles[slaStatus] || styles.ON_TRACK}`}>
      {slaStatus === 'BREACHED' ? <ShieldAlert className="w-3 h-3" /> : <Timer className="w-3 h-3" />}
      {text}
    </span>
  );
}

export function NextStepsGuidance({ title = 'What Should I Do Next?', steps = [] }) {
  if (!steps.length) return null;
  return (
    <div className="bg-gradient-to-r from-blue-50 via-indigo-50/60 to-white dark:from-blue-950/30 dark:via-indigo-950/20 dark:to-slate-900/40 border border-blue-200/80 dark:border-blue-500/20 rounded-2xl p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-xl bg-blue-600 text-white shrink-0 shadow-sm shadow-blue-600/20">
          <Compass className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-blue-700 dark:text-blue-300">
            {title}
          </h3>
          <ul className="mt-2 space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
            {steps.map((s, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                  {idx + 1}
                </span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export function HelpDeskSubNav() {
  const { user, switchEmployee } = useAuth();
  const navigate = useNavigate();
  const manager = isHelpDeskManager(user);
  const staff = isITStaff(user);

  const items = [
    { name: 'Employee Portal', path: '/helpdesk/employee', icon: LifeBuoy, show: hasModuleAccess(user, 'HELP_DESK_EMPLOYEE_DASHBOARD') },
    { name: 'New Request', path: '/helpdesk/new', icon: PlusCircle, show: true },
    { name: 'My Requests', path: '/helpdesk/my-requests', icon: ListTodo, show: true },
    { name: 'Management', path: '/helpdesk/management', icon: BarChart3, show: manager },
    { name: 'All Tickets', path: '/helpdesk/tickets', icon: Inbox, show: manager },
    { name: 'Unassigned', path: '/helpdesk/unassigned', icon: AlertCircle, show: manager },
    { name: 'My Assigned', path: '/helpdesk/my-assigned', icon: UserCheck, show: staff },
    { name: 'Pending', path: '/helpdesk/pending', icon: PauseCircle, show: staff },
    { name: 'Resolved & Closed', path: '/helpdesk/resolved-closed', icon: CheckCircle2, show: staff },
    { name: 'Technicians', path: '/helpdesk/technicians', icon: Users, show: manager },
    { name: 'SLA Monitor', path: '/helpdesk/sla', icon: Timer, show: manager },
    { name: 'Reports', path: '/helpdesk/reports', icon: FileBarChart, show: manager || hasModuleAccess(user, 'MANAGEMENT_REPORTS') },
    { name: 'Settings', path: '/helpdesk/settings', icon: Settings, show: ['ADMIN', 'HEAD_OF_IT'].includes(user?.role) || hasModuleAccess(user, 'SYSTEM_SETTINGS') },
  ].filter((i) => i.show);

  return (
    <div className="bg-white dark:bg-[#0d1424] border border-slate-200 dark:border-slate-800 rounded-2xl p-1.5 flex items-center justify-between gap-2 overflow-x-auto custom-scrollbar">
      <div className="flex items-center gap-1">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all shrink-0 ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/20'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70'
                }`
              }
            >
              <Icon className="w-3.5 h-3.5" />
              {item.name}
            </NavLink>
          );
        })}
      </div>
      {user?.isPortalSession && (
        <button
          type="button"
          onClick={async () => {
            const target = await switchEmployee();
            navigate(target);
          }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap bg-amber-50 hover:bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:hover:bg-amber-500/25 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30 transition-all shrink-0 cursor-pointer"
        >
          <ArrowRightLeft className="w-3.5 h-3.5" />
          Switch Employee
        </button>
      )}
    </div>
  );
}
