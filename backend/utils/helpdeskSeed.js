const bcrypt = require('bcryptjs');
const prisma = require('../prismaClient');
const { DEFAULT_GRANULAR_BY_ROLE } = require('./rbac');

const DEFAULT_PORTAL_CONFIG = {
  enabled: true,
  portalEmail: 'itsupport@euromotors.lk',
  verificationMethod: 'EMAIL_OR_PHONE',
  idleTimeoutMinutes: 30,
  allowRememberDevice: true,
  rememberDeviceDays: 7,
  minSearchChars: 2,
  maxSearchResults: 15,
  restrictedDepartmentIds: [],
  restrictedEmployeeCodes: [],
};

const DEFAULT_CATEGORIES = [
  { name: 'Hardware', description: 'Physical IT hardware & peripheral issues', examples: 'Desktop, laptop, printer, scanner', sortOrder: 1 },
  { name: 'Software', description: 'Operating systems and productivity software', examples: 'Windows, MS Office, applications', sortOrder: 2 },
  { name: 'Network', description: 'Connectivity, cabling, wireless & VPN', examples: 'Internet, Wi-Fi, LAN, VPN', sortOrder: 3 },
  { name: 'Email', description: 'Corporate email accounts & clients', examples: 'Gmail, Office 365, email access', sortOrder: 4 },
  { name: 'ERP / Accounting', description: 'Enterprise resource planning and finance systems', examples: 'Zoho Books, ERP, system errors', sortOrder: 5 },
  { name: 'CRM', description: 'Customer relationship management platform', examples: 'CRM access, configuration and system errors', sortOrder: 6 },
  { name: 'DMS', description: 'Automotive dealership management software', examples: 'Dealer Management System issues', sortOrder: 7 },
  { name: 'CCTV', description: 'Surveillance cameras and video recording', examples: 'Camera, NVR, remote access', sortOrder: 8 },
  { name: 'Access Management', description: 'User accounts, permissions & password resets', examples: 'User creation, password reset', sortOrder: 9 },
  { name: 'Telephone', description: 'Office voice and IP telephony systems', examples: 'IP phones, extensions, telephone systems', sortOrder: 10 },
  { name: 'Other', description: 'General IT assistance and miscellaneous queries', examples: 'General IT inquiries', sortOrder: 11 },
];

const DEFAULT_SLA_RULES = [
  { priority: 'CRITICAL', firstResponseMinutes: 15, resolutionMinutes: 120, warningThresholdPercent: 75, escalateAfterBreachMinutes: 15 },
  { priority: 'HIGH', firstResponseMinutes: 30, resolutionMinutes: 240, warningThresholdPercent: 75, escalateAfterBreachMinutes: 30 },
  { priority: 'MEDIUM', firstResponseMinutes: 120, resolutionMinutes: 480, warningThresholdPercent: 75, escalateAfterBreachMinutes: 60 },
  { priority: 'LOW', firstResponseMinutes: 240, resolutionMinutes: 1440, warningThresholdPercent: 80, escalateAfterBreachMinutes: 120 },
];

const DEFAULT_SETTINGS = {
  id: 'global',
  ticketPrefix: 'HD',
  ticketNumberFormat: 'HD-{YYYY}-{SEQ6}',
  nextSequenceNumber: 1,
  workingHours: {
    start: '08:30',
    end: '17:30',
    timezone: 'Asia/Colombo',
    workingDays: [1, 2, 3, 4, 5, 6],
  },
  holidays: [],
  allowedPauseReasons: [
    'Awaiting Employee Response',
    'Awaiting Vendor / Third-Party',
    'Awaiting Spare Parts',
    'Awaiting Management Approval',
  ],
  requestTypes: [
    { key: 'INCIDENT', label: 'Incident', description: 'Unplanned interruption or degradation of an IT service' },
    { key: 'SERVICE_REQUEST', label: 'Service Request', description: 'Request for new access, hardware, software, or standard change' },
    { key: 'INQUIRY', label: 'Inquiry', description: 'General IT question or guidance request' },
  ],
  priorityLevels: [
    { key: 'CRITICAL', label: 'Critical', color: 'rose', description: 'Company-wide or branch outage blocking business operations' },
    { key: 'HIGH', label: 'High', color: 'amber', description: 'Departmental or urgent operational disruption' },
    { key: 'MEDIUM', label: 'Medium', color: 'blue', description: 'Standard user issue with available workaround' },
    { key: 'LOW', label: 'Low', color: 'slate', description: 'Minor inconvenience or non-urgent inquiry' },
  ],
  notificationSettings: {
    emailEnabled: process.env.DISABLE_EMAIL_NOTIFICATIONS !== 'true',
    inAppEnabled: true,
    notifyOnSubmit: true,
    notifyOnAssign: true,
    notifyOnStatusChange: true,
    notifyOnSlaApproaching: true,
    notifyOnSlaBreach: true,
    notifyOnResolve: true,
    notifyOnReopen: true,
    confirmationReminderHours: 24,
  },
  feedbackSettings: {
    enabled: true,
    requireRatingOnConfirm: true,
    requireReasonOnReopen: true,
    autoRemindAfterHours: 24,
  },
  assignmentRules: {
    mode: 'MANUAL',
    autoAssignEnabled: false,
    categoryDefaults: {},
  },
  escalationRules: {
    notifyManagerAtWarning: true,
    escalateToHeadOfItOnBreach: true,
    requireReasonOnPending: true,
  },
  portalConfig: DEFAULT_PORTAL_CONFIG,
};

let seedCompleted = false;

async function ensureHelpDeskSeeded() {
  if (seedCompleted) return;
  try {
    // 1. Seed categories
    for (const cat of DEFAULT_CATEGORIES) {
      await prisma.helpDeskCategory.upsert({
        where: { name: cat.name },
        update: {},
        create: { ...cat, isActive: true, isSystem: true },
      });
    }

    // 2. Seed SLA rules
    for (const rule of DEFAULT_SLA_RULES) {
      await prisma.helpDeskSlaRule.upsert({
        where: { priority: rule.priority },
        update: {},
        create: rule,
      });
    }

    // 3. Seed global settings & backfill portalConfig
    const existingSettings = await prisma.helpDeskSettings.upsert({
      where: { id: 'global' },
      update: {},
      create: DEFAULT_SETTINGS,
    });
    if (!existingSettings.portalConfig) {
      await prisma.helpDeskSettings.update({
        where: { id: 'global' },
        data: { portalConfig: DEFAULT_PORTAL_CONFIG },
      }).catch(() => {});
    }

    // 3b. Ensure single common portal access account exists
    const existingPortalAccount = await prisma.user.findFirst({
      where: { role: 'PORTAL_ACCESS' },
      select: { id: true, email: true },
    });
    if (!existingPortalAccount) {
      const portalEmail = existingSettings?.portalConfig?.portalEmail || DEFAULT_PORTAL_CONFIG.portalEmail;
      const existingByEmail = await prisma.user.findUnique({ where: { email: portalEmail } });
      if (!existingByEmail) {
        const defaultPortalPass = process.env.PORTAL_DEFAULT_PASSWORD || 'EuroSupport@2026';
        const passwordHash = await bcrypt.hash(defaultPortalPass, 8);
        await prisma.user.create({
          data: {
            fullName: 'Euro Motors IT Support Portal',
            email: portalEmail,
            passwordHash,
            role: 'PORTAL_ACCESS',
            status: 'ACTIVE',
            mustChangePassword: false,
            modulePermissions: {
              IT_INVENTORY: false,
              IT_HELP_DESK: false,
              INVENTORY_DASHBOARD: false,
              HELP_DESK_EMPLOYEE_DASHBOARD: false,
              HELP_DESK_MANAGEMENT_DASHBOARD: false,
              ASSET_MANAGEMENT: false,
              MANAGEMENT_REPORTS: false,
              USER_MANAGEMENT: false,
              SYSTEM_SETTINGS: false,
            },
          },
        }).catch(() => {});
      }
    }

    // 4. Seed RolePermission defaults for all roles
    for (const [role, permissions] of Object.entries(DEFAULT_GRANULAR_BY_ROLE)) {
      await prisma.rolePermission.upsert({
        where: { role },
        update: {},
        create: { role, permissions },
      });
    }

    // 5. Auto-link unlinked User <-> Employee by matching email
    const unlinkedUsers = await prisma.user.findMany({
      where: { employeeId: null },
      select: { id: true, email: true },
    });

    for (const u of unlinkedUsers) {
      const emp = await prisma.employee.findFirst({
        where: {
          email: { equals: u.email, mode: 'insensitive' },
          user: { is: null },
        },
        select: { id: true },
      });
      if (emp) {
        await prisma.user.update({
          where: { id: u.id },
          data: { employeeId: emp.id },
        }).catch(() => {});
      }
    }

    seedCompleted = true;
  } catch (err) {
    console.warn('[HELPDESK SEED] Seed notice:', err.message);
  }
}

module.exports = {
  DEFAULT_CATEGORIES,
  DEFAULT_SLA_RULES,
  DEFAULT_SETTINGS,
  DEFAULT_PORTAL_CONFIG,
  ensureHelpDeskSeeded,
};
