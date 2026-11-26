const MODULE_KEYS = [
  'IT_INVENTORY',
  'IT_HELP_DESK',
  'INVENTORY_DASHBOARD',
  'HELP_DESK_EMPLOYEE_DASHBOARD',
  'HELP_DESK_MANAGEMENT_DASHBOARD',
  'ASSET_MANAGEMENT',
  'MANAGEMENT_REPORTS',
  'USER_MANAGEMENT',
  'SYSTEM_SETTINGS',
];

const ALL_MODULES_ON = MODULE_KEYS.reduce((acc, key) => {
  acc[key] = true;
  return acc;
}, {});

const DEFAULT_ROLE_MODULES = {
  ADMIN: { ...ALL_MODULES_ON },
  HEAD_OF_IT: { ...ALL_MODULES_ON },
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
  PORTAL_ACCESS: MODULE_KEYS.reduce((acc, key) => {
    acc[key] = false;
    return acc;
  }, {}),
};

const ALL_GRANULAR_PERMISSIONS = {
  VIEW_ASSETS: true, CREATE_ASSETS: true, EDIT_ASSETS: true, DELETE_ASSETS: true,
  ASSIGN_ASSETS: true, TRANSFER_ASSETS: true,
  MANAGE_PURCHASE_PRICE: true, VIEW_FINANCIAL_VALUATION: true,
  UPLOAD_ASSET_IMAGES: true, REPLACE_ASSET_IMAGES: true, DELETE_ASSET_IMAGES: true,
  UPLOAD_ASSET_DOCUMENTS: true, DOWNLOAD_ASSET_DOCUMENTS: true, DELETE_ASSET_DOCUMENTS: true,
  BULK_IMPORT_ASSETS: true, EXPORT_REPORTS: true, VIEW_STORAGE_STATS: true,
  MANAGE_EMPLOYEES: true, MANAGE_DEPARTMENTS: true, MANAGE_LOCATIONS: true,
  MANAGE_USERS: true, MANAGE_ROLES: true, VIEW_AUDIT_LOG: true, EXPORT_AUDIT_LOG: true, CONFIGURE_SYSTEM: true,
};

const DEFAULT_GRANULAR_BY_ROLE = {
  ADMIN: { ...ALL_GRANULAR_PERMISSIONS },
  HEAD_OF_IT: { ...ALL_GRANULAR_PERMISSIONS },
  IT_MANAGER: {
    ...ALL_GRANULAR_PERMISSIONS,
    MANAGE_PURCHASE_PRICE: false,
    DELETE_ASSETS: false,
    MANAGE_USERS: false,
    MANAGE_ROLES: false,
    CONFIGURE_SYSTEM: false,
  },
  IT_OFFICER: {
    VIEW_ASSETS: true, CREATE_ASSETS: true, EDIT_ASSETS: true, DELETE_ASSETS: false,
    ASSIGN_ASSETS: true, TRANSFER_ASSETS: true,
    MANAGE_PURCHASE_PRICE: false, VIEW_FINANCIAL_VALUATION: false,
    UPLOAD_ASSET_IMAGES: true, REPLACE_ASSET_IMAGES: true, DELETE_ASSET_IMAGES: false,
    UPLOAD_ASSET_DOCUMENTS: true, DOWNLOAD_ASSET_DOCUMENTS: true, DELETE_ASSET_DOCUMENTS: false,
    BULK_IMPORT_ASSETS: false, EXPORT_REPORTS: true, VIEW_STORAGE_STATS: false,
    MANAGE_EMPLOYEES: true, MANAGE_DEPARTMENTS: false, MANAGE_LOCATIONS: false,
    MANAGE_USERS: false, MANAGE_ROLES: false, VIEW_AUDIT_LOG: false, EXPORT_AUDIT_LOG: false, CONFIGURE_SYSTEM: false,
  },
  EMPLOYEE: Object.keys(ALL_GRANULAR_PERMISSIONS).reduce((acc, k) => {
    acc[k] = false;
    return acc;
  }, {}),
  VIEWER: {
    ...Object.keys(ALL_GRANULAR_PERMISSIONS).reduce((acc, k) => {
      acc[k] = false;
      return acc;
    }, {}),
    VIEW_ASSETS: true,
    DOWNLOAD_ASSET_DOCUMENTS: true,
  },
  PORTAL_ACCESS: Object.keys(ALL_GRANULAR_PERMISSIONS).reduce((acc, k) => {
    acc[k] = false;
    return acc;
  }, {}),
};

const isAdminOrHeadOfIT = (role) => role === 'ADMIN' || role === 'HEAD_OF_IT';
const isHelpDeskManager = (role) => role === 'ADMIN' || role === 'HEAD_OF_IT' || role === 'IT_MANAGER';
const isITStaff = (role) => ['ADMIN', 'HEAD_OF_IT', 'IT_MANAGER', 'IT_OFFICER'].includes(role);

function resolveModuleAccess(user) {
  const roleDefaults = DEFAULT_ROLE_MODULES[user?.role] || DEFAULT_ROLE_MODULES.EMPLOYEE;
  const overrides = (user?.modulePermissions && typeof user.modulePermissions === 'object')
    ? user.modulePermissions
    : {};

  const resolved = {};
  for (const key of MODULE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(overrides, key) && typeof overrides[key] === 'boolean') {
      resolved[key] = overrides[key];
    } else {
      resolved[key] = !!roleDefaults[key];
    }
  }

  if (isAdminOrHeadOfIT(user?.role)) {
    resolved.USER_MANAGEMENT = true;
    resolved.SYSTEM_SETTINGS = true;
    resolved.IT_HELP_DESK = true;
    resolved.HELP_DESK_MANAGEMENT_DASHBOARD = true;
  }

  return resolved;
}

function resolveGranularPermissions(user, rolePermDoc) {
  const base = DEFAULT_GRANULAR_BY_ROLE[user?.role] || DEFAULT_GRANULAR_BY_ROLE.EMPLOYEE;
  const fromDb = (rolePermDoc?.permissions && typeof rolePermDoc.permissions === 'object')
    ? rolePermDoc.permissions
    : {};

  const permissions = { ...base, ...fromDb };

  if (isAdminOrHeadOfIT(user?.role)) {
    permissions.MANAGE_USERS = true;
    permissions.MANAGE_ROLES = true;
    permissions.VIEW_AUDIT_LOG = true;
    permissions.CONFIGURE_SYSTEM = true;
    permissions.MANAGE_PURCHASE_PRICE = true;
    permissions.VIEW_FINANCIAL_VALUATION = true;
  }

  return permissions;
}

async function userHasPermission(prisma, user, permissionKey) {
  if (!user || !user.role) return false;
  if (isAdminOrHeadOfIT(user.role)) return true;
  const rolePerm = await prisma.rolePermission.findUnique({
    where: { role: user.role },
  }).catch(() => null);
  const resolved = resolveGranularPermissions(user, rolePerm);
  return !!resolved[permissionKey];
}

function getDefaultLandingRoute(user) {
  if (user?.role === 'PORTAL_ACCESS' || user?.tokenScope === 'PORTAL_GATEWAY') {
    return '/portal/identify';
  }
  const modules = user?.moduleAccess || resolveModuleAccess(user);
  if (user?.role === 'EMPLOYEE' || (!modules.INVENTORY_DASHBOARD && modules.HELP_DESK_EMPLOYEE_DASHBOARD)) {
    return '/helpdesk/employee';
  }
  if (!modules.INVENTORY_DASHBOARD && modules.HELP_DESK_MANAGEMENT_DASHBOARD) {
    return '/helpdesk/management';
  }
  if (!modules.INVENTORY_DASHBOARD && modules.IT_HELP_DESK) {
    return '/helpdesk/employee';
  }
  return '/';
}

module.exports = {
  MODULE_KEYS,
  DEFAULT_ROLE_MODULES,
  ALL_GRANULAR_PERMISSIONS,
  DEFAULT_GRANULAR_BY_ROLE,
  isAdminOrHeadOfIT,
  isHelpDeskManager,
  isITStaff,
  resolveModuleAccess,
  resolveGranularPermissions,
  userHasPermission,
  getDefaultLandingRoute,
};
