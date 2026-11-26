const _rawApi = import.meta.env.VITE_API_URL || '/api';
export const API_URL = _rawApi.endsWith('/api') ? _rawApi : `${_rawApi.replace(/\/$/, '')}/api`;

export const MODULE_DEFINITIONS = [
  { key: 'IT_INVENTORY', label: 'IT Inventory', desc: 'Access inventory assets, assignments, and maintenance' },
  { key: 'IT_HELP_DESK', label: 'IT Help Desk', desc: 'Submit and track IT support requests' },
  { key: 'INVENTORY_DASHBOARD', label: 'Inventory Dashboard', desc: 'View IT Control Center inventory analytics' },
  { key: 'HELP_DESK_EMPLOYEE_DASHBOARD', label: 'Help Desk Employee Dashboard', desc: 'Employee self-service Help Desk portal' },
  { key: 'HELP_DESK_MANAGEMENT_DASHBOARD', label: 'Help Desk Management Dashboard', desc: 'Manage all tickets, queues, SLA, and technicians' },
  { key: 'ASSET_MANAGEMENT', label: 'Asset Management', desc: 'Create, edit, assign, and maintain IT assets' },
  { key: 'MANAGEMENT_REPORTS', label: 'Management Reports', desc: 'Access executive inventory & Help Desk reports' },
  { key: 'USER_MANAGEMENT', label: 'User Management', desc: 'Create users and manage role/module access' },
  { key: 'SYSTEM_SETTINGS', label: 'System Settings', desc: 'Configure system and Help Desk settings' },
];

export const DEFAULT_ROLE_MODULES = {
  ADMIN: Object.fromEntries(MODULE_DEFINITIONS.map((m) => [m.key, true])),
  HEAD_OF_IT: Object.fromEntries(MODULE_DEFINITIONS.map((m) => [m.key, true])),
  IT_MANAGER: {
    IT_INVENTORY: true,
    IT_HELP_DESK: true,
    INVENTORY_DASHBOARD: true,
    HELP_DESK_EMPLOYEE_DASHBOARD: true,
    HELP_DESK_MANAGEMENT_DASHBOARD: true,
    ASSET_MANAGEMENT: true,
    MANAGEMENT_REPORTS: true,
    USER_MANAGEMENT: false,
    SYSTEM_SETTINGS: false,
  },
  IT_OFFICER: {
    IT_INVENTORY: true,
    IT_HELP_DESK: true,
    INVENTORY_DASHBOARD: true,
    HELP_DESK_EMPLOYEE_DASHBOARD: true,
    HELP_DESK_MANAGEMENT_DASHBOARD: false,
    ASSET_MANAGEMENT: true,
    MANAGEMENT_REPORTS: false,
    USER_MANAGEMENT: false,
    SYSTEM_SETTINGS: false,
  },
  EMPLOYEE: {
    IT_INVENTORY: false,
    IT_HELP_DESK: true,
    INVENTORY_DASHBOARD: false,
    HELP_DESK_EMPLOYEE_DASHBOARD: true,
    HELP_DESK_MANAGEMENT_DASHBOARD: false,
    ASSET_MANAGEMENT: false,
    MANAGEMENT_REPORTS: false,
    USER_MANAGEMENT: false,
    SYSTEM_SETTINGS: false,
  },
  VIEWER: {
    IT_INVENTORY: true,
    IT_HELP_DESK: true,
    INVENTORY_DASHBOARD: true,
    HELP_DESK_EMPLOYEE_DASHBOARD: true,
    HELP_DESK_MANAGEMENT_DASHBOARD: false,
    ASSET_MANAGEMENT: false,
    MANAGEMENT_REPORTS: false,
    USER_MANAGEMENT: false,
    SYSTEM_SETTINGS: false,
  },
  PORTAL_ACCESS: Object.fromEntries(MODULE_DEFINITIONS.map((m) => [m.key, false])),
};

export const ROLE_LABELS = {
  ADMIN: 'Administrator',
  HEAD_OF_IT: 'Head of IT',
  IT_MANAGER: 'IT Manager',
  IT_OFFICER: 'IT Officer / Technician',
  EMPLOYEE: 'Employee',
  VIEWER: 'Viewer',
  PORTAL_ACCESS: 'Employee Support Portal',
};

export function isAdminOrHeadOfIT(user) {
  return user?.role === 'ADMIN' || user?.role === 'HEAD_OF_IT';
}

export function isHelpDeskManager(user) {
  return ['ADMIN', 'HEAD_OF_IT', 'IT_MANAGER'].includes(user?.role) || !!user?.moduleAccess?.HELP_DESK_MANAGEMENT_DASHBOARD;
}

export function isITStaff(user) {
  return ['ADMIN', 'HEAD_OF_IT', 'IT_MANAGER', 'IT_OFFICER'].includes(user?.role);
}

export function hasModuleAccess(user, moduleKey) {
  if (!user) return false;
  if (isAdminOrHeadOfIT(user)) return true;
  if (user.moduleAccess && typeof user.moduleAccess === 'object') {
    return !!user.moduleAccess[moduleKey];
  }
  const fallback = DEFAULT_ROLE_MODULES[user.role] || DEFAULT_ROLE_MODULES.EMPLOYEE;
  return !!fallback[moduleKey];
}

export function getDefaultLandingRoute(user) {
  if (!user) return '/login';
  if (user.role === 'PORTAL_ACCESS' || user.tokenScope === 'PORTAL_GATEWAY') {
    return '/portal/identify';
  }
  if (user.landingRoute) return user.landingRoute;
  if (user.role === 'EMPLOYEE' || (!hasModuleAccess(user, 'INVENTORY_DASHBOARD') && hasModuleAccess(user, 'HELP_DESK_EMPLOYEE_DASHBOARD'))) {
    return '/helpdesk/employee';
  }
  if (!hasModuleAccess(user, 'INVENTORY_DASHBOARD') && hasModuleAccess(user, 'HELP_DESK_MANAGEMENT_DASHBOARD')) {
    return '/helpdesk/management';
  }
  return '/';
}

export function authHeaders(extra = {}) {
  const token = localStorage.getItem('token');
  return {
    Authorization: `Bearer ${token}`,
    ...extra,
  };
}

export async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: authHeaders(options.headers || {}),
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (_) {
    data = null;
  }
  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status})`);
  }
  return data;
}

export async function downloadTicketAttachment(attachmentId, fileName, inline = false) {
  const token = localStorage.getItem('token');
  const res = await fetch(`${API_URL}/helpdesk/attachments/${attachmentId}/download?inline=${inline}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to download attachment');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  if (inline) {
    window.open(url, '_blank', 'noopener,noreferrer');
  } else {
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName || 'attachment';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

export function formatMinutes(min) {
  if (min === null || min === undefined) return '—';
  const m = Math.round(Number(min));
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem > 0 ? `${h}h ${rem}m` : `${h}h`;
}

export const BUSINESS_IMPACT_OPTIONS = [
  { value: 'INDIVIDUAL_EMPLOYEE', label: 'Individual Employee' },
  { value: 'MULTIPLE_EMPLOYEES', label: 'Multiple Employees' },
  { value: 'ENTIRE_DEPARTMENT', label: 'Entire Department' },
  { value: 'ENTIRE_BRANCH', label: 'Entire Branch' },
  { value: 'COMPANY_WIDE', label: 'Company-Wide' },
];

export const REQUEST_TYPE_OPTIONS = [
  { value: 'INCIDENT', label: 'Incident' },
  { value: 'SERVICE_REQUEST', label: 'Service Request' },
  { value: 'INQUIRY', label: 'Inquiry' },
];

export const STATUS_LABELS = {
  OPEN: 'Open',
  ASSIGNED: 'Assigned',
  IN_PROGRESS: 'In Progress',
  PENDING: 'Pending',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
  REOPENED: 'Reopened',
};
