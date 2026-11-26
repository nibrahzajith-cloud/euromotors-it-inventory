const express = require('express');
const { randomUUID } = require('crypto');
const multer = require('multer');
const router = express.Router();
const prisma = require('../prismaClient');
const { authenticate, requireModule, requireAnyModule } = require('../middleware/auth.middleware');
const { logAudit } = require('../utils/logger');
const { isAdminOrHeadOfIT, isHelpDeskManager, isITStaff } = require('../utils/rbac');
const {
  computeInitialSlaDeadlines,
  evaluateTicketSla,
  diffBusinessMinutes,
} = require('../utils/slaCalculator');
const { ensureHelpDeskSeeded } = require('../utils/helpdeskSeed');
const { notifyUsers, getUserIdsByRoles, evaluateAndNotifySla } = require('../utils/helpdeskNotifications');
const { uploadFile, readFileBuffer } = require('../utils/s3Client');

// Allowed attachment types (Section 19)
const ALLOWED_ATTACHMENT_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

const uploadHelpdeskFiles = multer({
  storage: multer.memoryStorage(),
  limits: { files: 5, fileSize: 5 * 1024 * 1024 }, // 5 MB per file, max 5 files
  fileFilter: (req, file, cb) => {
    if (ALLOWED_ATTACHMENT_MIMES.has(file.mimetype)) return cb(null, true);
    return cb(new Error('Unsupported file type. Allowed: JPG, PNG, WEBP, GIF, PDF, DOC/DOCX, XLS/XLSX, TXT'));
  },
});

router.use(authenticate);
router.use(async (req, res, next) => {
  await ensureHelpDeskSeeded();
  next();
});

// Helper: Resolve linked Employee for current user
async function resolveUserEmployee(user) {
  if (!user) return null;
  if (user.employeeId) {
    return prisma.employee.findUnique({
      where: { id: user.employeeId },
      include: { department: true, location: true },
    });
  }
  if (user.email) {
    return prisma.employee.findFirst({
      where: { email: { equals: user.email, mode: 'insensitive' } },
      include: { department: true, location: true },
    });
  }
  return null;
}

// Helper: Generate atomic ticket number using HelpDeskSettings format
async function generateTicketNumber(tx) {
  let settings = await tx.helpDeskSettings.findUnique({ where: { id: 'global' } });
  if (!settings) {
    settings = await tx.helpDeskSettings.create({
      data: {
        id: 'global',
        ticketPrefix: 'HD',
        ticketNumberFormat: 'HD-{YYYY}-{SEQ6}',
        nextSequenceNumber: 1,
        workingHours: { start: '08:30', end: '17:30', workingDays: [1, 2, 3, 4, 5, 6] },
        holidays: [],
        allowedPauseReasons: ['Awaiting Employee Response'],
        requestTypes: [],
        priorityLevels: [],
        notificationSettings: {},
        feedbackSettings: {},
        assignmentRules: {},
        escalationRules: {},
      },
    });
  }

  const seq = settings.nextSequenceNumber || 1;
  const year = new Date().getFullYear();
  const prefix = settings.ticketPrefix || 'HD';
  const format = settings.ticketNumberFormat || 'HD-{YYYY}-{SEQ6}';

  let code = format
    .replace('{PREFIX}', prefix)
    .replace('{YYYY}', String(year))
    .replace('{SEQ6}', String(seq).padStart(6, '0'))
    .replace('{SEQ5}', String(seq).padStart(5, '0'));

  if (code === format) {
    code = `${prefix}-${year}-${String(seq).padStart(6, '0')}`;
  }

  await tx.helpDeskSettings.update({
    where: { id: 'global' },
    data: { nextSequenceNumber: seq + 1 },
  });

  return code;
}

// Helper: Strip internal IT fields when returning ticket to non-IT staff
function sanitizeTicketForUser(ticket, user) {
  if (!ticket) return ticket;
  const staff = isITStaff(user.role);
  if (staff) return ticket;

  const copy = { ...ticket };
  delete copy.internalRemarks;
  if (Array.isArray(copy.comments)) {
    copy.comments = copy.comments.filter((c) => !c.isInternal);
  }
  return copy;
}

// Helper: Check ticket access permission
function canAccessTicket(ticket, user) {
  if (!ticket || !user) return false;
  if (isHelpDeskManager(user.role) || user.moduleAccess?.HELP_DESK_MANAGEMENT_DASHBOARD) return true;
  if (user.role === 'IT_OFFICER') {
    return (
      ticket.assignedToId === user.id ||
      ticket.requesterUserId === user.id ||
      (user.employeeId && ticket.employeeId === user.employeeId)
    );
  }
  return (
    ticket.requesterUserId === user.id ||
    (user.employeeId && ticket.employeeId === user.employeeId)
  );
}

// Helper: Build ticket include clause
const TICKET_INCLUDE = {
  category: true,
  employee: {
    select: {
      id: true,
      employeeCode: true,
      fullName: true,
      email: true,
      phone: true,
      designation: true,
      department: { select: { id: true, name: true } },
      location: { select: { id: true, name: true } },
    },
  },
  department: { select: { id: true, name: true } },
  location: { select: { id: true, name: true } },
  asset: {
    select: {
      id: true,
      assetCode: true,
      deviceType: true,
      brand: true,
      model: true,
      serialNumber: true,
      warrantyStatus: true,
      warrantyExpiryDate: true,
      status: true,
      assignedEmployee: { select: { id: true, fullName: true, employeeCode: true } },
      department: { select: { id: true, name: true } },
      location: { select: { id: true, name: true } },
    },
  },
  assignedTo: { select: { id: true, fullName: true, email: true, role: true } },
  requesterUser: { select: { id: true, fullName: true, email: true, role: true } },
  attachments: { orderBy: { createdAt: 'asc' } },
};

// =============================================================================
// 1. EMPLOYEE SELF-SERVICE PROFILE, ASSETS & FORM OPTIONS
// =============================================================================

router.get('/my-profile', requireModule('IT_HELP_DESK'), async (req, res) => {
  try {
    const employee = await resolveUserEmployee(req.user);
    let assignedAssets = [];
    if (employee) {
      assignedAssets = await prisma.asset.findMany({
        where: { assignedEmployeeId: employee.id },
        select: {
          id: true,
          assetCode: true,
          deviceType: true,
          brand: true,
          model: true,
          serialNumber: true,
          status: true,
          assignmentType: true,
          imageUrl: true,
          imageStorageKey: true,
          thumbnailUrl: true,
          warrantyStatus: true,
          warrantyExpiryDate: true,
          department: { select: { id: true, name: true } },
          location: { select: { id: true, name: true } },
        },
        orderBy: { assetCode: 'asc' },
      });
    }

    res.json({
      user: {
        id: req.user.id,
        fullName: req.user.fullName,
        email: req.user.email,
        role: req.user.role,
        employeeId: employee?.id || req.user.employeeId || null,
      },
      employee: employee ? {
        id: employee.id,
        employeeCode: employee.employeeCode,
        fullName: employee.fullName,
        email: employee.email,
        phone: employee.phone,
        designation: employee.designation,
        departmentId: employee.departmentId,
        departmentName: employee.department?.name || null,
        locationId: employee.locationId,
        locationName: employee.location?.name || null,
      } : null,
      assignedAssets,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/form-options', requireModule('IT_HELP_DESK'), async (req, res) => {
  try {
    const [categories, settings, slaRules, departments, locations, officers, employees] = await Promise.all([
      prisma.helpDeskCategory.findMany({
        where: req.query.includeInactive === 'true' && isHelpDeskManager(req.user.role) ? {} : { isActive: true },
        orderBy: { sortOrder: 'asc' },
      }),
      prisma.helpDeskSettings.findUnique({ where: { id: 'global' } }),
      prisma.helpDeskSlaRule.findMany({ orderBy: { firstResponseMinutes: 'asc' } }),
      prisma.department.findMany({ where: { status: 'ACTIVE' }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
      prisma.location.findMany({ where: { status: 'ACTIVE' }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
      isHelpDeskManager(req.user.role)
        ? prisma.user.findMany({
            where: { role: { in: ['IT_OFFICER', 'IT_MANAGER', 'HEAD_OF_IT', 'ADMIN'] }, status: 'ACTIVE' },
            select: { id: true, fullName: true, email: true, role: true },
            orderBy: { fullName: 'asc' },
          })
        : Promise.resolve([]),
      isITStaff(req.user.role) || isHelpDeskManager(req.user.role)
        ? prisma.employee.findMany({
            where: { status: 'ACTIVE' },
            select: {
              id: true,
              employeeCode: true,
              fullName: true,
              email: true,
              phone: true,
              designation: true,
              departmentId: true,
              locationId: true,
              department: { select: { id: true, name: true } },
              location: { select: { id: true, name: true } },
            },
            orderBy: { fullName: 'asc' },
          })
        : Promise.resolve([]),
    ]);

    res.json({
      categories,
      settings,
      slaRules,
      departments,
      locations,
      officers,
      employees,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/asset-lookup/:codeOrId', requireModule('IT_HELP_DESK'), async (req, res) => {
  try {
    const q = (req.params.codeOrId || '').trim();
    const asset = await prisma.asset.findFirst({
      where: {
        OR: [
          { id: q },
          { assetCode: { equals: q, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        assetCode: true,
        deviceType: true,
        brand: true,
        model: true,
        serialNumber: true,
        warrantyStatus: true,
        warrantyExpiryDate: true,
        status: true,
        assignedEmployeeId: true,
        assignedEmployee: { select: { id: true, fullName: true, employeeCode: true } },
        department: { select: { id: true, name: true } },
        location: { select: { id: true, name: true } },
      },
    });
    if (!asset) return res.status(404).json({ error: 'Asset not found' });

    if (!isITStaff(req.user.role)) {
      const emp = await resolveUserEmployee(req.user);
      if (!emp || asset.assignedEmployeeId !== emp.id) {
        return res.status(403).json({ error: 'Forbidden: You can only view details of assets assigned to you' });
      }
    }

    res.json(asset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =============================================================================
// 2. EMPLOYEE DASHBOARD SUMMARY
// =============================================================================

router.get('/my-summary', requireModule('IT_HELP_DESK'), async (req, res) => {
  try {
    await evaluateAndNotifySla();
    const employee = await resolveUserEmployee(req.user);

    const ownershipFilter = employee
      ? { OR: [{ requesterUserId: req.user.id }, { employeeId: employee.id }] }
      : { requesterUserId: req.user.id };

    const [tickets, assignedAssets, notifications, settings, slaRules] = await Promise.all([
      prisma.supportTicket.findMany({
        where: ownershipFilter,
        include: TICKET_INCLUDE,
        orderBy: { createdAt: 'desc' },
      }),
      employee
        ? prisma.asset.findMany({
            where: { assignedEmployeeId: employee.id },
            select: {
              id: true,
              assetCode: true,
              deviceType: true,
              brand: true,
              model: true,
              serialNumber: true,
              status: true,
              assignmentType: true,
              imageUrl: true,
              imageStorageKey: true,
              thumbnailUrl: true,
              warrantyStatus: true,
              warrantyExpiryDate: true,
              department: { select: { name: true } },
              location: { select: { name: true } },
            },
          })
        : Promise.resolve([]),
      prisma.notification.findMany({
        where: { userId: req.user.id },
        orderBy: { createdAt: 'desc' },
        take: 15,
      }),
      prisma.helpDeskSettings.findUnique({ where: { id: 'global' } }),
      prisma.helpDeskSlaRule.findMany(),
    ]);

    const ruleMap = Object.fromEntries(slaRules.map((r) => [r.priority, r]));
    const enrichedTickets = tickets.map((t) => {
      const sanitized = sanitizeTicketForUser(t, req.user);
      return {
        ...sanitized,
        slaInfo: evaluateTicketSla(t, ruleMap[t.priority], settings),
      };
    });

    const counts = {
      total: enrichedTickets.length,
      open: enrichedTickets.filter((t) => t.status === 'OPEN' || t.status === 'ASSIGNED' || t.status === 'REOPENED').length,
      inProgress: enrichedTickets.filter((t) => t.status === 'IN_PROGRESS').length,
      pending: enrichedTickets.filter((t) => t.status === 'PENDING').length,
      resolved: enrichedTickets.filter((t) => t.status === 'RESOLVED').length,
      closed: enrichedTickets.filter((t) => t.status === 'CLOSED').length,
    };

    const awaitingConfirmation = enrichedTickets.filter((t) => t.status === 'RESOLVED');
    const feedbackHistory = enrichedTickets.filter((t) => t.satisfactionRating != null);

    res.json({
      counts,
      recentTickets: enrichedTickets.slice(0, 8),
      awaitingConfirmation,
      feedbackHistory: feedbackHistory.slice(0, 5),
      assignedAssets,
      notifications,
      employee: employee ? {
        id: employee.id,
        employeeCode: employee.employeeCode,
        fullName: employee.fullName,
        email: employee.email,
        phone: employee.phone,
        departmentName: employee.department?.name || null,
        locationName: employee.location?.name || null,
      } : null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =============================================================================
// 3. TICKETS LIST, CREATE, DETAILS & WORKFLOW
// =============================================================================

router.get('/tickets', requireModule('IT_HELP_DESK'), async (req, res) => {
  try {
    await evaluateAndNotifySla();

    const {
      queue = 'all',
      status,
      priority,
      categoryId,
      departmentId,
      locationId,
      assignedToId,
      slaStatus,
      dateFrom,
      dateTo,
      search,
    } = req.query;

    const employee = await resolveUserEmployee(req.user);
    const isManager = isHelpDeskManager(req.user.role) || !!req.user.moduleAccess?.HELP_DESK_MANAGEMENT_DASHBOARD;
    const isOfficer = req.user.role === 'IT_OFFICER';

    const where = {};
    const andConditions = [];

    // Strict RBAC row-level scoping
    if (queue === 'my-requests' || (!isManager && !isOfficer)) {
      andConditions.push(
        employee
          ? { OR: [{ requesterUserId: req.user.id }, { employeeId: employee.id }] }
          : { requesterUserId: req.user.id }
      );
    } else if (queue === 'my-assigned') {
      andConditions.push({ assignedToId: req.user.id });
    } else if (!isManager && isOfficer) {
      // IT Officer without management dashboard access only sees assigned or own requests
      const orClauses = [{ assignedToId: req.user.id }, { requesterUserId: req.user.id }];
      if (employee) orClauses.push({ employeeId: employee.id });
      andConditions.push({ OR: orClauses });
    }

    if (queue === 'unassigned') {
      if (!isManager) return res.status(403).json({ error: 'Forbidden: Unassigned queue requires IT Manager or Head of IT access' });
      andConditions.push({ assignedToId: null, status: { in: ['OPEN', 'REOPENED'] } });
    } else if (queue === 'pending') {
      andConditions.push({ status: 'PENDING' });
    } else if (queue === 'resolved-closed') {
      andConditions.push({ status: { in: ['RESOLVED', 'CLOSED'] } });
    } else if (queue === 'overdue') {
      andConditions.push({ slaStatus: 'BREACHED', status: { notIn: ['RESOLVED', 'CLOSED'] } });
    } else if (queue === 'open') {
      andConditions.push({ status: { in: ['OPEN', 'REOPENED'] } });
    } else if (queue === 'assigned') {
      andConditions.push({ status: 'ASSIGNED' });
    } else if (queue === 'in-progress') {
      andConditions.push({ status: 'IN_PROGRESS' });
    } else if (queue === 'reopened') {
      andConditions.push({ status: 'REOPENED' });
    }

    if (status && status !== 'ALL') andConditions.push({ status });
    if (priority && priority !== 'ALL') andConditions.push({ priority });
    if (categoryId && categoryId !== 'ALL') andConditions.push({ categoryId });
    if (departmentId && departmentId !== 'ALL') andConditions.push({ departmentId });
    if (locationId && locationId !== 'ALL') andConditions.push({ locationId });
    if (assignedToId && assignedToId !== 'ALL') andConditions.push({ assignedToId });
    if (slaStatus && slaStatus !== 'ALL') andConditions.push({ slaStatus });

    if (dateFrom || dateTo) {
      const createdAt = {};
      if (dateFrom) createdAt.gte = new Date(dateFrom);
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        createdAt.lte = end;
      }
      andConditions.push({ createdAt });
    }

    if (search && search.trim()) {
      const q = search.trim();
      andConditions.push({
        OR: [
          { ticketCode: { contains: q, mode: 'insensitive' } },
          { subject: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
          { requesterName: { contains: q, mode: 'insensitive' } },
          { requesterEmployeeCode: { contains: q, mode: 'insensitive' } },
          { asset: { assetCode: { contains: q, mode: 'insensitive' } } },
        ],
      });
    }

    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    const [tickets, settings, slaRules] = await Promise.all([
      prisma.supportTicket.findMany({
        where,
        include: TICKET_INCLUDE,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.helpDeskSettings.findUnique({ where: { id: 'global' } }),
      prisma.helpDeskSlaRule.findMany(),
    ]);

    const ruleMap = Object.fromEntries(slaRules.map((r) => [r.priority, r]));
    const result = tickets.map((t) => ({
      ...sanitizeTicketForUser(t, req.user),
      slaInfo: evaluateTicketSla(t, ruleMap[t.priority], settings),
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/tickets/:id', requireModule('IT_HELP_DESK'), async (req, res) => {
  try {
    const [ticket, settings, slaRules] = await Promise.all([
      prisma.supportTicket.findUnique({
        where: { id: req.params.id },
        include: {
          ...TICKET_INCLUDE,
          statusHistory: { orderBy: { createdAt: 'asc' } },
          comments: {
            include: { attachments: true },
            orderBy: { createdAt: 'asc' },
          },
          slaBreachLogs: { orderBy: { createdAt: 'desc' } },
        },
      }),
      prisma.helpDeskSettings.findUnique({ where: { id: 'global' } }),
      prisma.helpDeskSlaRule.findMany(),
    ]);

    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    if (!canAccessTicket(ticket, req.user)) {
      return res.status(403).json({ error: 'Forbidden: You do not have access to this ticket' });
    }

    const rule = slaRules.find((r) => r.priority === ticket.priority);
    const slaInfo = evaluateTicketSla(ticket, rule, settings);

    // For IT staff, attach recent asset history when asset is linked
    let assetHistory = null;
    if (ticket.assetId && isITStaff(req.user.role)) {
      const [pastTickets, maintenanceLogs] = await Promise.all([
        prisma.supportTicket.findMany({
          where: { assetId: ticket.assetId, id: { not: ticket.id } },
          select: {
            id: true,
            ticketCode: true,
            subject: true,
            status: true,
            priority: true,
            createdAt: true,
            resolvedAt: true,
            actionTaken: true,
            assignedTo: { select: { fullName: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        }),
        prisma.maintenanceLog.findMany({
          where: { assetId: ticket.assetId },
          orderBy: { createdAt: 'desc' },
          take: 10,
        }),
      ]);
      assetHistory = { pastTickets, maintenanceLogs };
    }

    const sanitized = sanitizeTicketForUser(ticket, req.user);
    res.json({
      ...sanitized,
      slaInfo,
      assetHistory,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create support request (supports multipart/form-data with attachments OR JSON)
router.post(
  '/tickets',
  requireModule('IT_HELP_DESK'),
  uploadHelpdeskFiles.array('attachments', 5),
  async (req, res) => {
    try {
      const {
        subject,
        description,
        categoryId,
        requestType = 'INCIDENT',
        priority = 'MEDIUM',
        businessImpact = 'INDIVIDUAL_EMPLOYEE',
        businessImpactDetails,
        assetId,
        contactNumber,
        employeeId: requestedEmployeeId,
      } = req.body;

      if (!subject || !subject.trim() || !description || !description.trim()) {
        return res.status(400).json({ error: 'Subject and issue description are required' });
      }

      // Resolve employee profile (IT Staff can submit on behalf of any active employee)
      let employee = null;
      let targetRequesterUserId = req.user.id;
      const isOnBehalfRequested = requestedEmployeeId && isITStaff(req.user.role) && requestedEmployeeId !== req.user.employeeId;

      if (requestedEmployeeId && isITStaff(req.user.role)) {
        employee = await prisma.employee.findUnique({
          where: { id: requestedEmployeeId },
          include: { department: true, location: true, user: { select: { id: true } } },
        });
        if (!employee) {
          return res.status(404).json({ error: 'Selected employee was not found in the directory' });
        }
        if (employee.user?.id) {
          targetRequesterUserId = employee.user.id;
        }
      } else {
        employee = await resolveUserEmployee(req.user);
      }

      // Verify asset access if assetId supplied
      let validAssetId = null;
      if (assetId) {
        const asset = await prisma.asset.findUnique({ where: { id: assetId } });
        if (!asset) return res.status(404).json({ error: 'Selected IT Asset not found' });
        if (!isITStaff(req.user.role) && (!employee || asset.assignedEmployeeId !== employee.id)) {
          return res.status(403).json({ error: 'Forbidden: You can only link assets assigned to you' });
        }
        validAssetId = asset.id;
      }

      const [settings, slaRule] = await Promise.all([
        prisma.helpDeskSettings.findUnique({ where: { id: 'global' } }),
        prisma.helpDeskSlaRule.findUnique({ where: { priority } }),
      ]);

      const now = new Date();
      const { firstResponseDueAt, resolutionDueAt } = computeInitialSlaDeadlines(now, slaRule, settings);

      // Optional auto-assignment rule by category
      let autoAssignedToId = null;
      const rules = settings?.assignmentRules || {};
      if (rules.autoAssignEnabled && categoryId && rules.categoryDefaults?.[categoryId]) {
        autoAssignedToId = rules.categoryDefaults[categoryId];
      }

      const createdTicket = await prisma.$transaction(async (tx) => {
        const ticketCode = await generateTicketNumber(tx);
        const initialStatus = autoAssignedToId ? 'ASSIGNED' : 'OPEN';

        const t = await tx.supportTicket.create({
          data: {
            ticketCode,
            subject: subject.trim(),
            description: description.trim(),
            priority,
            status: initialStatus,
            requestType,
            categoryId: categoryId || null,
            businessImpact,
            businessImpactDetails: businessImpactDetails?.trim() || null,
            requesterUserId: targetRequesterUserId,
            requesterName: employee?.fullName || req.user.fullName,
            requesterEmployeeCode: employee?.employeeCode || null,
            requesterEmail: employee?.email || req.user.email,
            contactNumber: contactNumber?.trim() || employee?.phone || null,
            submittedByUserId: req.user.id,
            submittedByName: req.user.fullName,
            submittedByRole: req.user.role,
            employeeId: employee?.id || null,
            departmentId: employee?.departmentId || null,
            locationId: employee?.locationId || null,
            assetId: validAssetId,
            assignedToId: autoAssignedToId,
            assignedAt: autoAssignedToId ? now : null,
            firstResponseDueAt,
            resolutionDueAt,
            slaStatus: 'ON_TRACK',
          },
        });

        await tx.ticketStatusHistory.create({
          data: {
            ticketId: t.id,
            fromStatus: null,
            toStatus: initialStatus,
            reason: 'Support request submitted',
            changedById: req.user.id,
            changedByName: req.user.fullName,
            changedByRole: req.user.role,
          },
        });

        return t;
      });

      // Handle uploaded attachments
      const files = req.files || [];
      for (const file of files) {
        const ext = (file.originalname.split('.').pop() || 'bin').replace(/[^a-zA-Z0-9]/g, '');
        const key = `helpdesk/${createdTicket.ticketCode}/${Date.now()}_${randomUUID().slice(0, 8)}.${ext}`;
        await uploadFile(file.buffer, key, file.mimetype);
        await prisma.ticketAttachment.create({
          data: {
            ticketId: createdTicket.id,
            fileName: file.originalname,
            storageKey: key,
            fileSize: file.size,
            mimeType: file.mimetype,
            uploadedById: req.user.id,
            uploadedByName: req.user.fullName,
          },
        });
      }

      await logAudit({
        req,
        employeeOverride: employee ? { id: employee.id, fullName: employee.fullName, departmentName: employee.department?.name } : null,
        action: 'CREATE_TICKET',
        module: 'HELPDESK',
        entityType: 'SUPPORT_TICKET',
        entityId: createdTicket.id,
        entityCode: createdTicket.ticketCode,
        newValue: {
          ticketCode: createdTicket.ticketCode,
          subject: createdTicket.subject,
          priority: createdTicket.priority,
          requestType: createdTicket.requestType,
          businessImpact: createdTicket.businessImpact,
          status: createdTicket.status,
        },
        description: isOnBehalfRequested && employee
          ? `Support request ${createdTicket.ticketCode} submitted on behalf of ${employee.fullName} (${employee.employeeCode}) by ${req.user.fullName}: ${createdTicket.subject}`
          : `Support request ${createdTicket.ticketCode} submitted: ${createdTicket.subject}`,
      });

      // Notify IT Managers, Head of IT, and requester confirmation
      const managerIds = await getUserIdsByRoles(['IT_MANAGER', 'HEAD_OF_IT', 'ADMIN']);
      await notifyUsers({
        userIds: managerIds,
        ticketId: createdTicket.id,
        type: 'NEW_TICKET',
        title: `New Support Request: ${createdTicket.ticketCode}`,
        message: `${createdTicket.requesterName} submitted "${createdTicket.subject}" (${createdTicket.priority}).`,
        link: `/helpdesk/tickets/${createdTicket.id}`,
        emailEvent: 'NEW_TICKET',
      });
      await notifyUsers({
        userIds: [req.user.id],
        ticketId: createdTicket.id,
        type: 'TICKET_CONFIRMATION',
        title: `Request Submitted: ${createdTicket.ticketCode}`,
        message: `Your support request "${createdTicket.subject}" has been logged and sent to the IT Help Desk.`,
        link: `/helpdesk/tickets/${createdTicket.id}`,
        emailEvent: 'TICKET_CONFIRMATION',
      });
      if (autoAssignedToId) {
        await notifyUsers({
          userIds: [autoAssignedToId],
          ticketId: createdTicket.id,
          type: 'TICKET_ASSIGNED',
          title: `Ticket Auto-Assigned: ${createdTicket.ticketCode}`,
          message: `You have been assigned ticket "${createdTicket.subject}" (${createdTicket.priority}).`,
          link: `/helpdesk/tickets/${createdTicket.id}`,
          emailEvent: 'TICKET_ASSIGNED',
        });
      }

      const fullTicket = await prisma.supportTicket.findUnique({
        where: { id: createdTicket.id },
        include: TICKET_INCLUDE,
      });

      res.status(201).json(sanitizeTicketForUser(fullTicket, req.user));
    } catch (err) {
      console.error('Create Help Desk Ticket Error:', err);
      res.status(400).json({ error: err.message });
    }
  }
);

// Assign or reassign ticket + review/adjust priority, category, business impact
router.patch('/tickets/:id/assign', requireModule('IT_HELP_DESK'), async (req, res) => {
  try {
    if (!isHelpDeskManager(req.user.role) && !req.user.moduleAccess?.HELP_DESK_MANAGEMENT_DASHBOARD) {
      return res.status(403).json({ error: 'Forbidden: Only IT Manager or Head of IT can assign tickets' });
    }

    const { assignedToId, priority, categoryId, businessImpact, businessImpactDetails, note } = req.body;

    const existing = await prisma.supportTicket.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Ticket not found' });

    let officer = null;
    if (assignedToId) {
      officer = await prisma.user.findUnique({
        where: { id: assignedToId },
        select: { id: true, fullName: true, role: true, status: true },
      });
      if (!officer || officer.status !== 'ACTIVE' || !isITStaff(officer.role)) {
        return res.status(400).json({ error: 'Selected assignee must be an active IT team member' });
      }
    }

    const now = new Date();
    const isReassignment = Boolean(existing.assignedToId && assignedToId && existing.assignedToId !== assignedToId);
    const nextPriority = priority || existing.priority;
    const priorityChanged = priority && priority !== existing.priority;

    const updateData = {
      assignedToId: assignedToId !== undefined ? (assignedToId || null) : existing.assignedToId,
      assignedById: assignedToId ? req.user.id : existing.assignedById,
      assignedAt: assignedToId ? now : existing.assignedAt,
      priority: nextPriority,
      categoryId: categoryId !== undefined ? (categoryId || null) : existing.categoryId,
      businessImpact: businessImpact || existing.businessImpact,
      businessImpactDetails: businessImpactDetails !== undefined ? businessImpactDetails : existing.businessImpactDetails,
    };

    if (assignedToId && ['OPEN', 'REOPENED'].includes(existing.status)) {
      updateData.status = 'ASSIGNED';
    }

    // Recalculate SLA targets if priority adjusted
    if (priorityChanged) {
      const [settings, slaRule] = await Promise.all([
        prisma.helpDeskSettings.findUnique({ where: { id: 'global' } }),
        prisma.helpDeskSlaRule.findUnique({ where: { priority: nextPriority } }),
      ]);
      const { firstResponseDueAt, resolutionDueAt } = computeInitialSlaDeadlines(existing.createdAt, slaRule, settings);
      updateData.firstResponseDueAt = firstResponseDueAt;
      updateData.resolutionDueAt = resolutionDueAt;
    }

    // Record first response if IT staff hasn't responded yet
    if (!existing.firstRespondedAt && assignedToId) {
      const settings = await prisma.helpDeskSettings.findUnique({ where: { id: 'global' } });
      updateData.firstRespondedAt = now;
      updateData.firstResponseMinutes = diffBusinessMinutes(existing.createdAt, now, settings?.workingHours, settings?.holidays);
    }

    const updated = await prisma.supportTicket.update({
      where: { id: existing.id },
      data: updateData,
      include: TICKET_INCLUDE,
    });

    if (updateData.status && updateData.status !== existing.status) {
      await prisma.ticketStatusHistory.create({
        data: {
          ticketId: existing.id,
          fromStatus: existing.status,
          toStatus: updateData.status,
          reason: isReassignment ? `Reassigned to ${officer?.fullName}` : `Assigned to ${officer?.fullName}`,
          note: note || null,
          changedById: req.user.id,
          changedByName: req.user.fullName,
          changedByRole: req.user.role,
        },
      });
    } else if (isReassignment || priorityChanged) {
      await prisma.ticketStatusHistory.create({
        data: {
          ticketId: existing.id,
          fromStatus: existing.status,
          toStatus: existing.status,
          reason: isReassignment
            ? `Reassigned to ${officer?.fullName}`
            : `Priority adjusted from ${existing.priority} to ${nextPriority}`,
          note: note || null,
          changedById: req.user.id,
          changedByName: req.user.fullName,
          changedByRole: req.user.role,
        },
      });
    }

    await logAudit({
      req,
      action: isReassignment ? 'REASSIGN_TICKET' : (priorityChanged ? 'UPDATE_TICKET_PRIORITY' : 'ASSIGN_TICKET'),
      module: 'HELPDESK',
      entityType: 'SUPPORT_TICKET',
      entityId: existing.id,
      entityCode: existing.ticketCode,
      oldValue: { assignedToId: existing.assignedToId, priority: existing.priority, status: existing.status },
      newValue: { assignedToId: updated.assignedToId, priority: updated.priority, status: updated.status },
      description: `Ticket ${existing.ticketCode} ${isReassignment ? 'reassigned' : 'assigned'} to ${officer?.fullName || 'Unassigned'}`,
    });

    if (assignedToId) {
      await notifyUsers({
        userIds: [assignedToId],
        ticketId: existing.id,
        type: isReassignment ? 'TICKET_REASSIGNED' : 'TICKET_ASSIGNED',
        title: `${isReassignment ? 'Ticket Reassigned' : 'New Assignment'}: ${existing.ticketCode}`,
        message: `Ticket "${existing.subject}" (${updated.priority}) has been ${isReassignment ? 'reassigned' : 'assigned'} to you by ${req.user.fullName}.`,
        link: `/helpdesk/tickets/${existing.id}`,
        emailEvent: isReassignment ? 'TICKET_REASSIGNED' : 'TICKET_ASSIGNED',
      });
    }
    if (existing.requesterUserId) {
      await notifyUsers({
        userIds: [existing.requesterUserId],
        ticketId: existing.id,
        type: 'STATUS_CHANGED',
        title: `Ticket Updated: ${existing.ticketCode}`,
        message: officer ? `Your ticket "${existing.subject}" was assigned to ${officer.fullName}.` : `Your ticket "${existing.subject}" priority/details were updated.`,
        link: `/helpdesk/tickets/${existing.id}`,
      });
    }

    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// IT Officer / Manager updates investigation, action taken, status, pending reason, resolution
router.patch('/tickets/:id/status', requireModule('IT_HELP_DESK'), async (req, res) => {
  try {
    if (!isITStaff(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden: Only IT staff can update ticket workflow' });
    }

    const existing = await prisma.supportTicket.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Ticket not found' });

    if (
      req.user.role === 'IT_OFFICER' &&
      !req.user.moduleAccess?.HELP_DESK_MANAGEMENT_DASHBOARD &&
      existing.assignedToId !== req.user.id
    ) {
      return res.status(403).json({ error: 'Forbidden: IT Officers can only update tickets assigned to them' });
    }

    const {
      status,
      pendingReason,
      investigationDetails,
      actionTaken,
      repairOrReplacementDetails,
      repairCost,
      internalRemarks,
      note,
    } = req.body;

    const nextStatus = status || existing.status;
    if (nextStatus === 'PENDING' && !pendingReason?.trim() && !existing.pendingReason) {
      return res.status(400).json({ error: 'A reason is required when placing a ticket in Pending status' });
    }
    if (nextStatus === 'RESOLVED' && !(actionTaken?.trim() || existing.actionTaken)) {
      return res.status(400).json({ error: 'Please record the Action Taken before marking a ticket as Resolved' });
    }

    const settings = await prisma.helpDeskSettings.findUnique({ where: { id: 'global' } });
    const now = new Date();
    const updateData = {};

    if (investigationDetails !== undefined) updateData.investigationDetails = investigationDetails;
    if (actionTaken !== undefined) updateData.actionTaken = actionTaken;
    if (repairOrReplacementDetails !== undefined) updateData.repairOrReplacementDetails = repairOrReplacementDetails;
    if (repairCost !== undefined) updateData.repairCost = repairCost === '' || repairCost === null ? null : Number(repairCost);
    if (internalRemarks !== undefined) updateData.internalRemarks = internalRemarks;

    if (!existing.firstRespondedAt) {
      updateData.firstRespondedAt = now;
      updateData.firstResponseMinutes = diffBusinessMinutes(existing.createdAt, now, settings?.workingHours, settings?.holidays);
    }

    // Handle SLA Pause & Resume
    if (nextStatus === 'PENDING' && existing.status !== 'PENDING') {
      updateData.slaPausedAt = now;
      updateData.slaPauseReason = pendingReason.trim();
      updateData.pendingReason = pendingReason.trim();
      updateData.slaStatus = 'PAUSED';
    } else if (existing.status === 'PENDING' && nextStatus !== 'PENDING' && existing.slaPausedAt) {
      const pausedMin = Math.max(0, Math.round((now.getTime() - new Date(existing.slaPausedAt).getTime()) / 60000));
      updateData.slaTotalPausedMinutes = (existing.slaTotalPausedMinutes || 0) + pausedMin;
      updateData.slaPausedAt = null;
      if (existing.resolutionDueAt) {
        updateData.resolutionDueAt = new Date(new Date(existing.resolutionDueAt).getTime() + pausedMin * 60000);
      }
      updateData.slaStatus = 'ON_TRACK';
    } else if (pendingReason !== undefined && nextStatus === 'PENDING') {
      updateData.pendingReason = pendingReason.trim();
      updateData.slaPauseReason = pendingReason.trim();
    }

    if (nextStatus === 'RESOLVED') {
      updateData.resolvedAt = now;
      const rawMin = diffBusinessMinutes(existing.createdAt, now, settings?.workingHours, settings?.holidays);
      updateData.resolutionMinutes = Math.max(0, rawMin - (updateData.slaTotalPausedMinutes ?? existing.slaTotalPausedMinutes ?? 0));
      const due = updateData.resolutionDueAt || existing.resolutionDueAt;
      updateData.slaStatus = due && now > new Date(due) ? 'BREACHED' : 'MET';
    } else if (nextStatus === 'CLOSED') {
      if (!isHelpDeskManager(req.user.role) && existing.employeeConfirmed !== true) {
        return res.status(400).json({ error: 'Ticket should be confirmed by the employee before closure (or closed by IT Manager/Head of IT)' });
      }
      updateData.closedAt = now;
    }

    updateData.status = nextStatus;

    const updated = await prisma.supportTicket.update({
      where: { id: existing.id },
      data: updateData,
      include: TICKET_INCLUDE,
    });

    if (nextStatus !== existing.status || note) {
      await prisma.ticketStatusHistory.create({
        data: {
          ticketId: existing.id,
          fromStatus: existing.status,
          toStatus: nextStatus,
          reason: nextStatus === 'PENDING' ? (pendingReason || existing.pendingReason) : (note || `Status updated to ${nextStatus}`),
          note: note || null,
          changedById: req.user.id,
          changedByName: req.user.fullName,
          changedByRole: req.user.role,
        },
      });
    }

    await logAudit({
      req,
      action: nextStatus === 'RESOLVED' ? 'RESOLVE_TICKET' : (nextStatus !== existing.status ? 'CHANGE_TICKET_STATUS' : 'UPDATE_INVESTIGATION'),
      module: 'HELPDESK',
      entityType: 'SUPPORT_TICKET',
      entityId: existing.id,
      entityCode: existing.ticketCode,
      oldValue: { status: existing.status, pendingReason: existing.pendingReason },
      newValue: { status: nextStatus, pendingReason: updated.pendingReason },
      description: `Ticket ${existing.ticketCode} updated (${existing.status} -> ${nextStatus})`,
    });

    // Notifications
    if (existing.requesterUserId) {
      if (nextStatus === 'RESOLVED') {
        await notifyUsers({
          userIds: [existing.requesterUserId],
          ticketId: existing.id,
          type: 'TICKET_RESOLVED',
          title: `Issue Resolved — Please Confirm: ${existing.ticketCode}`,
          message: `IT Help Desk marked "${existing.subject}" as Resolved. Please confirm whether your issue is fixed and rate the service.`,
          link: `/helpdesk/tickets/${existing.id}`,
          emailEvent: 'TICKET_RESOLVED',
        });
      } else if (nextStatus === 'PENDING') {
        await notifyUsers({
          userIds: [existing.requesterUserId],
          ticketId: existing.id,
          type: 'TICKET_PENDING',
          title: `Action/Info Needed: ${existing.ticketCode}`,
          message: `Your ticket "${existing.subject}" is Pending (${pendingReason}).`,
          link: `/helpdesk/tickets/${existing.id}`,
          emailEvent: 'TICKET_PENDING',
        });
      } else if (nextStatus !== existing.status) {
        await notifyUsers({
          userIds: [existing.requesterUserId],
          ticketId: existing.id,
          type: 'STATUS_CHANGED',
          title: `Ticket Status Updated: ${existing.ticketCode}`,
          message: `Your ticket "${existing.subject}" status changed to ${nextStatus.replace('_', ' ')}.`,
          link: `/helpdesk/tickets/${existing.id}`,
          emailEvent: 'STATUS_CHANGED',
        });
      }
    }

    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Employee Confirmation (Yes/No + 1-5 Star Rating + Feedback; auto-reopens if No)
router.post('/tickets/:id/confirm', requireModule('IT_HELP_DESK'), async (req, res) => {
  try {
    const existing = await prisma.supportTicket.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Ticket not found' });
    if (!canAccessTicket(existing, req.user)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (existing.status !== 'RESOLVED') {
      return res.status(400).json({ error: 'Only Resolved tickets can be confirmed or reopened here' });
    }

    const { confirmed, satisfactionRating, employeeFeedback, employeeRemarks } = req.body;
    if (typeof confirmed !== 'boolean') {
      return res.status(400).json({ error: 'Please specify whether the issue is resolved (Yes/No)' });
    }
    if (confirmed && satisfactionRating !== undefined && satisfactionRating !== null) {
      const r = Number(satisfactionRating);
      if (Number.isNaN(r) || r < 1 || r > 5) {
        return res.status(400).json({ error: 'Satisfaction rating must be between 1 and 5 stars' });
      }
    }
    if (!confirmed && !employeeFeedback?.trim() && !employeeRemarks?.trim()) {
      return res.status(400).json({ error: 'Please describe why the issue is still unresolved before reopening' });
    }

    const now = new Date();
    const nextStatus = confirmed ? 'CLOSED' : 'REOPENED';

    const updateData = {
      employeeConfirmed: confirmed,
      employeeConfirmedAt: now,
      employeeFeedback: employeeFeedback?.trim() || null,
      satisfactionRating: satisfactionRating ? Number(satisfactionRating) : null,
      employeeRemarks: employeeRemarks?.trim() || null,
      status: nextStatus,
      ...(confirmed
        ? { closedAt: now }
        : {
            reopenedAt: now,
            reopenCount: (existing.reopenCount || 0) + 1,
            slaStatus: 'ON_TRACK',
          }),
    };

    const updated = await prisma.supportTicket.update({
      where: { id: existing.id },
      data: updateData,
      include: TICKET_INCLUDE,
    });

    await prisma.ticketStatusHistory.create({
      data: {
        ticketId: existing.id,
        fromStatus: existing.status,
        toStatus: nextStatus,
        reason: confirmed
          ? `Employee confirmed resolution (${satisfactionRating || '-'}/5 stars)`
          : `Employee reported issue unresolved: ${employeeFeedback || employeeRemarks}`,
        changedById: req.user.id,
        changedByName: req.user.fullName,
        changedByRole: req.user.role,
      },
    });

    await logAudit({
      req,
      action: confirmed ? 'CONFIRM_AND_CLOSE_TICKET' : 'REOPEN_TICKET',
      module: 'HELPDESK',
      entityType: 'SUPPORT_TICKET',
      entityId: existing.id,
      entityCode: existing.ticketCode,
      severity: confirmed ? 'INFO' : 'WARNING',
      oldValue: { status: existing.status },
      newValue: { status: nextStatus, employeeConfirmed: confirmed, satisfactionRating },
      description: confirmed
        ? `Employee confirmed & closed ${existing.ticketCode}`
        : `Employee reopened ${existing.ticketCode}: issue remains unresolved`,
    });

    const managerIds = await getUserIdsByRoles(['IT_MANAGER', 'HEAD_OF_IT', 'ADMIN']);
    if (confirmed) {
      await notifyUsers({
        userIds: [existing.assignedToId],
        ticketId: existing.id,
        type: 'TICKET_CLOSED',
        title: `Ticket Confirmed & Closed: ${existing.ticketCode}`,
        message: `${req.user.fullName} confirmed resolution (${satisfactionRating || '-'}/5 stars).`,
        link: `/helpdesk/tickets/${existing.id}`,
        emailEvent: 'TICKET_CLOSED',
      });
    } else {
      // Auto-notify assigned officer AND IT Manager on reopen (Section 8D)
      await notifyUsers({
        userIds: [existing.assignedToId, ...managerIds],
        ticketId: existing.id,
        type: 'TICKET_REOPENED',
        title: `Ticket Reopened by Employee: ${existing.ticketCode}`,
        message: `${req.user.fullName} reported "${existing.subject}" is still unresolved: ${employeeFeedback || employeeRemarks}`,
        link: `/helpdesk/tickets/${existing.id}`,
        emailEvent: 'TICKET_REOPENED',
      });
    }

    res.json(sanitizeTicketForUser(updated, req.user));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Add comment / additional info (with optional attachments)
router.post(
  '/tickets/:id/comments',
  requireModule('IT_HELP_DESK'),
  uploadHelpdeskFiles.array('attachments', 5),
  async (req, res) => {
    try {
      const existing = await prisma.supportTicket.findUnique({ where: { id: req.params.id } });
      if (!existing) return res.status(404).json({ error: 'Ticket not found' });
      if (!canAccessTicket(existing, req.user)) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const { message, isInternal } = req.body;
      if (!message || !message.trim()) {
        return res.status(400).json({ error: 'Comment message is required' });
      }

      const internalFlag = isITStaff(req.user.role) && (isInternal === true || isInternal === 'true');

      const comment = await prisma.ticketComment.create({
        data: {
          ticketId: existing.id,
          authorId: req.user.id,
          authorName: req.user.fullName,
          authorRole: req.user.role,
          message: message.trim(),
          isInternal: internalFlag,
        },
      });

      const files = req.files || [];
      const createdAttachments = [];
      for (const file of files) {
        const ext = (file.originalname.split('.').pop() || 'bin').replace(/[^a-zA-Z0-9]/g, '');
        const key = `helpdesk/${existing.ticketCode}/${Date.now()}_${randomUUID().slice(0, 8)}.${ext}`;
        await uploadFile(file.buffer, key, file.mimetype);
        const att = await prisma.ticketAttachment.create({
          data: {
            ticketId: existing.id,
            commentId: comment.id,
            fileName: file.originalname,
            storageKey: key,
            fileSize: file.size,
            mimeType: file.mimetype,
            uploadedById: req.user.id,
            uploadedByName: req.user.fullName,
          },
        });
        createdAttachments.push(att);
      }

      // Notify the other party (never notify employees for internal IT notes)
      if (!internalFlag) {
        if (isITStaff(req.user.role) && existing.requesterUserId && existing.requesterUserId !== req.user.id) {
          await notifyUsers({
            userIds: [existing.requesterUserId],
            ticketId: existing.id,
            type: 'TICKET_COMMENT',
            title: `IT Update on ${existing.ticketCode}`,
            message: `${req.user.fullName} replied on "${existing.subject}".`,
            link: `/helpdesk/tickets/${existing.id}`,
            emailEvent: 'TICKET_COMMENT',
          });
        } else if (!isITStaff(req.user.role)) {
          const managerIds = await getUserIdsByRoles(['IT_MANAGER']);
          await notifyUsers({
            userIds: [existing.assignedToId, ...managerIds].filter((id) => id && id !== req.user.id),
            ticketId: existing.id,
            type: 'TICKET_COMMENT',
            title: `Employee Reply on ${existing.ticketCode}`,
            message: `${req.user.fullName} added information on "${existing.subject}".`,
            link: `/helpdesk/tickets/${existing.id}`,
            emailEvent: 'TICKET_COMMENT',
          });
        }
      }

      res.status(201).json({ ...comment, attachments: createdAttachments });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

// Upload additional attachments directly to a ticket (e.g., resolution proof)
router.post(
  '/tickets/:id/attachments',
  requireModule('IT_HELP_DESK'),
  uploadHelpdeskFiles.array('attachments', 5),
  async (req, res) => {
    try {
      const existing = await prisma.supportTicket.findUnique({ where: { id: req.params.id } });
      if (!existing) return res.status(404).json({ error: 'Ticket not found' });
      if (!canAccessTicket(existing, req.user)) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const files = req.files || [];
      if (files.length === 0) return res.status(400).json({ error: 'At least one file is required' });

      const isResolutionProof = isITStaff(req.user.role) && req.body.isResolutionProof === 'true';
      const uploaded = [];
      for (const file of files) {
        const ext = (file.originalname.split('.').pop() || 'bin').replace(/[^a-zA-Z0-9]/g, '');
        const key = `helpdesk/${existing.ticketCode}/${Date.now()}_${randomUUID().slice(0, 8)}.${ext}`;
        await uploadFile(file.buffer, key, file.mimetype);
        const att = await prisma.ticketAttachment.create({
          data: {
            ticketId: existing.id,
            fileName: file.originalname,
            storageKey: key,
            fileSize: file.size,
            mimeType: file.mimetype,
            uploadedById: req.user.id,
            uploadedByName: req.user.fullName,
            isResolutionProof,
          },
        });
        uploaded.push(att);
      }

      res.status(201).json(uploaded);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

// Authenticated & ticket-authorized attachment download/view
router.get('/attachments/:attachmentId/download', requireModule('IT_HELP_DESK'), async (req, res) => {
  try {
    const attachment = await prisma.ticketAttachment.findUnique({
      where: { id: req.params.attachmentId },
      include: { ticket: true },
    });
    if (!attachment) return res.status(404).json({ error: 'Attachment not found' });
    if (!canAccessTicket(attachment.ticket, req.user)) {
      return res.status(403).json({ error: 'Forbidden: Unauthorized attachment access' });
    }

    const buffer = await readFileBuffer(attachment.storageKey);
    if (!buffer) return res.status(404).json({ error: 'Attachment file missing from storage' });

    const safeName = attachment.fileName.replace(/[\r\n"\\]/g, '_');
    const disposition = req.query.inline === 'true' ? 'inline' : 'attachment';
    res.setHeader('Content-Type', attachment.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `${disposition}; filename="${safeName}"`);
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =============================================================================
// 4. ASSET PROFILE — SUPPORT & MAINTENANCE HISTORY (PHASE C)
// =============================================================================

router.get(
  '/asset-history/:assetId',
  requireAnyModule(['IT_INVENTORY', 'ASSET_MANAGEMENT', 'IT_HELP_DESK']),
  async (req, res) => {
    try {
      const asset = await prisma.asset.findUnique({ where: { id: req.params.assetId } });
      if (!asset) return res.status(404).json({ error: 'Asset not found' });

      if (!isITStaff(req.user.role) && !req.user.moduleAccess?.IT_INVENTORY && !req.user.moduleAccess?.ASSET_MANAGEMENT) {
        const emp = await resolveUserEmployee(req.user);
        if (!emp || asset.assignedEmployeeId !== emp.id) {
          return res.status(403).json({ error: 'Forbidden' });
        }
      }

      const [tickets, maintenanceLogs] = await Promise.all([
        prisma.supportTicket.findMany({
          where: { assetId: req.params.assetId },
          include: {
            assignedTo: { select: { id: true, fullName: true } },
            category: { select: { name: true } },
          },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.maintenanceLog.findMany({
          where: { assetId: req.params.assetId },
          orderBy: { createdAt: 'desc' },
        }),
      ]);

      const sanitizedTickets = tickets.map((t) => sanitizeTicketForUser(t, req.user));
      res.json({ tickets: sanitizedTickets, maintenanceLogs });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// =============================================================================
// 5. MANAGEMENT DASHBOARD, TECHNICIAN PERFORMANCE & SLA OVERVIEW (PHASE D)
// =============================================================================

function buildDashboardWhere(query) {
  const { dateFrom, dateTo, departmentId, locationId, assignedToId, categoryId, priority, status } = query;
  const where = {};
  if (departmentId && departmentId !== 'ALL') where.departmentId = departmentId;
  if (locationId && locationId !== 'ALL') where.locationId = locationId;
  if (assignedToId && assignedToId !== 'ALL') where.assignedToId = assignedToId;
  if (categoryId && categoryId !== 'ALL') where.categoryId = categoryId;
  if (priority && priority !== 'ALL') where.priority = priority;
  if (status && status !== 'ALL') where.status = status;
  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) where.createdAt.gte = new Date(dateFrom);
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      where.createdAt.lte = end;
    }
  }
  return where;
}

router.get('/management/dashboard', requireModule('IT_HELP_DESK'), async (req, res) => {
  try {
    if (!isHelpDeskManager(req.user.role) && !req.user.moduleAccess?.HELP_DESK_MANAGEMENT_DASHBOARD) {
      return res.status(403).json({ error: 'Forbidden: Management Dashboard access required' });
    }

    await evaluateAndNotifySla();

    const where = buildDashboardWhere(req.query);
    const [tickets, settings, slaRules, officers] = await Promise.all([
      prisma.supportTicket.findMany({
        where,
        include: {
          category: true,
          department: true,
          location: true,
          assignedTo: { select: { id: true, fullName: true } },
          asset: { select: { id: true, assetCode: true, deviceType: true, brand: true, model: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.helpDeskSettings.findUnique({ where: { id: 'global' } }),
      prisma.helpDeskSlaRule.findMany(),
      prisma.user.findMany({
        where: { role: { in: ['IT_OFFICER', 'IT_MANAGER', 'HEAD_OF_IT', 'ADMIN'] }, status: 'ACTIVE' },
        select: { id: true, fullName: true, role: true },
      }),
    ]);

    const ruleMap = Object.fromEntries(slaRules.map((r) => [r.priority, r]));
    const evaluated = tickets.map((t) => ({
      ...t,
      slaInfo: evaluateTicketSla(t, ruleMap[t.priority], settings),
    }));

    const total = evaluated.length;
    const open = evaluated.filter((t) => t.status === 'OPEN').length;
    const unassigned = evaluated.filter((t) => !t.assignedToId && ['OPEN', 'REOPENED'].includes(t.status)).length;
    const assigned = evaluated.filter((t) => t.status === 'ASSIGNED').length;
    const inProgress = evaluated.filter((t) => t.status === 'IN_PROGRESS').length;
    const pending = evaluated.filter((t) => t.status === 'PENDING').length;
    const resolved = evaluated.filter((t) => t.status === 'RESOLVED').length;
    const closed = evaluated.filter((t) => t.status === 'CLOSED').length;
    const reopened = evaluated.filter((t) => t.status === 'REOPENED' || (t.reopenCount || 0) > 0).length;
    const overdue = evaluated.filter(
      (t) => t.slaInfo.slaStatus === 'BREACHED' && !['RESOLVED', 'CLOSED'].includes(t.status)
    ).length;

    const respValues = evaluated.map((t) => t.firstResponseMinutes).filter((v) => v !== null && v !== undefined);
    const resValues = evaluated.map((t) => t.resolutionMinutes).filter((v) => v !== null && v !== undefined);
    const ratingValues = evaluated.map((t) => t.satisfactionRating).filter((v) => v !== null && v !== undefined);

    const avgFirstResponseMinutes = respValues.length
      ? Math.round(respValues.reduce((a, b) => a + b, 0) / respValues.length)
      : 0;
    const avgResolutionMinutes = resValues.length
      ? Math.round(resValues.reduce((a, b) => a + b, 0) / resValues.length)
      : 0;
    const avgSatisfactionRating = ratingValues.length
      ? Number((ratingValues.reduce((a, b) => a + b, 0) / ratingValues.length).toFixed(2))
      : 0;

    const completedForSla = evaluated.filter((t) => ['RESOLVED', 'CLOSED'].includes(t.status));
    const slaMetCount = completedForSla.filter((t) => t.slaInfo.slaStatus === 'MET').length;
    const slaComplianceRate = completedForSla.length
      ? Number(((slaMetCount / completedForSla.length) * 100).toFixed(1))
      : 100;

    // Groupings for charts
    const countBy = (list, keyFn) => {
      const map = {};
      for (const item of list) {
        const k = keyFn(item);
        map[k] = (map[k] || 0) + 1;
      }
      return Object.entries(map).map(([name, value]) => ({ name, value }));
    };

    const statusDistribution = countBy(evaluated, (t) => t.status);
    const categoryWise = countBy(evaluated, (t) => t.category?.name || 'Uncategorized').sort((a, b) => b.value - a.value);
    const priorityWise = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((p) => ({
      name: p,
      value: evaluated.filter((t) => t.priority === p).length,
    }));
    const departmentWise = countBy(evaluated, (t) => t.department?.name || 'Unassigned').sort((a, b) => b.value - a.value);
    const branchWise = countBy(evaluated, (t) => t.location?.name || 'Unassigned').sort((a, b) => b.value - a.value);

    // Monthly trends (last 6 months or matching span)
    const monthMap = {};
    for (const t of evaluated) {
      const d = new Date(t.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!monthMap[key]) monthMap[key] = { month: key, received: 0, resolved: 0 };
      monthMap[key].received++;
      if (t.resolvedAt) {
        const rd = new Date(t.resolvedAt);
        const rKey = `${rd.getFullYear()}-${String(rd.getMonth() + 1).padStart(2, '0')}`;
        if (!monthMap[rKey]) monthMap[rKey] = { month: rKey, received: 0, resolved: 0 };
        monthMap[rKey].resolved++;
      }
    }
    const monthlyTrends = Object.values(monthMap).sort((a, b) => a.month.localeCompare(b.month));

    // Officer performance summary
    const officerPerformance = officers.map((off) => {
      const mine = evaluated.filter((t) => t.assignedToId === off.id);
      const done = mine.filter((t) => ['RESOLVED', 'CLOSED'].includes(t.status));
      const met = done.filter((t) => t.slaInfo.slaStatus === 'MET').length;
      const ratings = mine.map((t) => t.satisfactionRating).filter((v) => v != null);
      return {
        id: off.id,
        name: off.fullName,
        assigned: mine.length,
        resolved: done.length,
        overdue: mine.filter((t) => t.slaInfo.slaStatus === 'BREACHED' && !['RESOLVED', 'CLOSED'].includes(t.status)).length,
        slaRate: done.length ? Number(((met / done.length) * 100).toFixed(1)) : 100,
        avgRating: ratings.length ? Number((ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(2)) : 0,
      };
    });

    const slaAnalysis = [
      { name: 'Met', value: evaluated.filter((t) => t.slaInfo.slaStatus === 'MET').length },
      { name: 'On Track', value: evaluated.filter((t) => t.slaInfo.slaStatus === 'ON_TRACK').length },
      { name: 'Approaching', value: evaluated.filter((t) => t.slaInfo.slaStatus === 'APPROACHING').length },
      { name: 'Paused', value: evaluated.filter((t) => t.slaInfo.slaStatus === 'PAUSED').length },
      { name: 'Breached', value: evaluated.filter((t) => t.slaInfo.slaStatus === 'BREACHED').length },
    ];

    const satisfactionAnalysis = [5, 4, 3, 2, 1].map((stars) => ({
      name: `${stars} Star${stars > 1 ? 's' : ''}`,
      value: evaluated.filter((t) => t.satisfactionRating === stars).length,
    }));

    const assetIssueMap = {};
    for (const t of evaluated) {
      if (!t.asset) continue;
      const key = `${t.asset.assetCode} (${t.asset.model || t.asset.deviceType})`;
      assetIssueMap[key] = (assetIssueMap[key] || 0) + 1;
    }
    const frequentAssetIssues = Object.entries(assetIssueMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    res.json({
      kpis: {
        totalInquiries: total,
        openTickets: open,
        unassignedTickets: unassigned,
        assignedTickets: assigned,
        inProgressTickets: inProgress,
        pendingTickets: pending,
        resolvedTickets: resolved,
        closedTickets: closed,
        reopenedTickets: reopened,
        overdueTickets: overdue,
        avgFirstResponseMinutes,
        avgResolutionMinutes,
        avgSatisfactionRating,
        slaComplianceRate,
      },
      charts: {
        statusDistribution,
        monthlyTrends,
        categoryWise,
        priorityWise,
        departmentWise,
        branchWise,
        officerPerformance,
        slaAnalysis,
        satisfactionAnalysis,
        frequentAssetIssues,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Technician Performance Dashboard (Section 15)
router.get('/technicians/performance', requireModule('IT_HELP_DESK'), async (req, res) => {
  try {
    if (!isHelpDeskManager(req.user.role) && !req.user.moduleAccess?.HELP_DESK_MANAGEMENT_DASHBOARD) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const PRIORITY_WEIGHT = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
    const IMPACT_WEIGHT = {
      COMPANY_WIDE: 4,
      ENTIRE_BRANCH: 3,
      ENTIRE_DEPARTMENT: 2.5,
      MULTIPLE_EMPLOYEES: 1.5,
      INDIVIDUAL_EMPLOYEE: 1,
    };

    const where = buildDashboardWhere(req.query);
    const [officers, tickets, settings, slaRules] = await Promise.all([
      prisma.user.findMany({
        where: { role: { in: ['IT_OFFICER', 'IT_MANAGER', 'HEAD_OF_IT', 'ADMIN'] }, status: 'ACTIVE' },
        select: { id: true, fullName: true, email: true, role: true },
        orderBy: { fullName: 'asc' },
      }),
      prisma.supportTicket.findMany({
        where,
        include: { category: true },
      }),
      prisma.helpDeskSettings.findUnique({ where: { id: 'global' } }),
      prisma.helpDeskSlaRule.findMany(),
    ]);

    const ruleMap = Object.fromEntries(slaRules.map((r) => [r.priority, r]));

    const performance = officers.map((off) => {
      const assigned = tickets.filter((t) => t.assignedToId === off.id);
      const completed = assigned.filter((t) => ['RESOLVED', 'CLOSED'].includes(t.status));
      const pending = assigned.filter((t) => t.status === 'PENDING');
      const inProgress = assigned.filter((t) => t.status === 'IN_PROGRESS');
      const active = assigned.filter((t) => !['RESOLVED', 'CLOSED'].includes(t.status));

      const overdue = active.filter(
        (t) => evaluateTicketSla(t, ruleMap[t.priority], settings).slaStatus === 'BREACHED'
      ).length;

      const respTimes = assigned.map((t) => t.firstResponseMinutes).filter((v) => v != null);
      const resTimes = completed.map((t) => t.resolutionMinutes).filter((v) => v != null);
      const ratings = assigned.map((t) => t.satisfactionRating).filter((v) => v != null);

      const slaMet = completed.filter(
        (t) => evaluateTicketSla(t, ruleMap[t.priority], settings).slaStatus === 'MET'
      ).length;

      // Complexity-weighted score across active & completed tickets
      const weightedComplexityScore = Number(
        assigned
          .reduce(
            (sum, t) => sum + (PRIORITY_WEIGHT[t.priority] || 1) * (IMPACT_WEIGHT[t.businessImpact] || 1),
            0
          )
          .toFixed(1)
      );

      return {
        officer: off,
        totalAssigned: assigned.length,
        completed: completed.length,
        pending: pending.length,
        inProgress: inProgress.length,
        overdue,
        currentWorkload: active.length,
        weightedComplexityScore,
        avgResponseMinutes: respTimes.length ? Math.round(respTimes.reduce((a, b) => a + b, 0) / respTimes.length) : 0,
        avgResolutionMinutes: resTimes.length ? Math.round(resTimes.reduce((a, b) => a + b, 0) / resTimes.length) : 0,
        slaComplianceRate: completed.length ? Number(((slaMet / completed.length) * 100).toFixed(1)) : 100,
        satisfactionRating: ratings.length ? Number((ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(2)) : 0,
        reopenedCount: assigned.filter((t) => (t.reopenCount || 0) > 0 || t.status === 'REOPENED').length,
      };
    });

    res.json(performance);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// SLA Management Overview (Section 17)
router.get('/sla/overview', requireModule('IT_HELP_DESK'), async (req, res) => {
  try {
    if (!isHelpDeskManager(req.user.role) && !req.user.moduleAccess?.HELP_DESK_MANAGEMENT_DASHBOARD) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    await evaluateAndNotifySla();

    const [rules, settings, breachLogs, activeTickets] = await Promise.all([
      prisma.helpDeskSlaRule.findMany({ orderBy: { firstResponseMinutes: 'asc' } }),
      prisma.helpDeskSettings.findUnique({ where: { id: 'global' } }),
      prisma.slaBreachLog.findMany({
        include: {
          ticket: {
            select: {
              id: true,
              ticketCode: true,
              subject: true,
              priority: true,
              status: true,
              assignedTo: { select: { fullName: true } },
            },
          },
        },
        orderBy: { breachedAt: 'desc' },
        take: 100,
      }),
      prisma.supportTicket.findMany({
        where: { status: { notIn: ['RESOLVED', 'CLOSED'] } },
        include: {
          assignedTo: { select: { fullName: true } },
          category: { select: { name: true } },
        },
        orderBy: { resolutionDueAt: 'asc' },
      }),
    ]);

    const ruleMap = Object.fromEntries(rules.map((r) => [r.priority, r]));
    const monitored = activeTickets.map((t) => ({
      ...t,
      slaInfo: evaluateTicketSla(t, ruleMap[t.priority], settings),
    }));

    res.json({ rules, settings, breachLogs, monitoredTickets: monitored });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =============================================================================
// 6. REPORTS & ANALYTICS (12 REPORT TYPES - SECTION 16)
// =============================================================================

router.get('/reports', requireAnyModule(['IT_HELP_DESK', 'MANAGEMENT_REPORTS']), async (req, res) => {
  try {
    if (!isHelpDeskManager(req.user.role) && !req.user.moduleAccess?.MANAGEMENT_REPORTS) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { type = 'daily' } = req.query;
    const where = buildDashboardWhere(req.query);

    const now = new Date();
    if (!req.query.dateFrom && !req.query.dateTo) {
      if (type === 'daily') {
        const start = new Date(now);
        start.setHours(0, 0, 0, 0);
        where.createdAt = { gte: start };
      } else if (type === 'weekly') {
        const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        where.createdAt = { gte: start };
      } else if (type === 'monthly') {
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        where.createdAt = { gte: start };
      }
    }

    const [tickets, settings, slaRules] = await Promise.all([
      prisma.supportTicket.findMany({
        where,
        include: TICKET_INCLUDE,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.helpDeskSettings.findUnique({ where: { id: 'global' } }),
      prisma.helpDeskSlaRule.findMany(),
    ]);

    const ruleMap = Object.fromEntries(slaRules.map((r) => [r.priority, r]));
    const withSla = tickets.map((t) => ({
      ...t,
      slaInfo: evaluateTicketSla(t, ruleMap[t.priority], settings),
    }));

    let rows = [];
    if (['daily', 'weekly', 'monthly'].includes(type)) {
      rows = withSla.map((t) => ({
        'Ticket No': t.ticketCode,
        'Date': new Date(t.createdAt).toLocaleString(),
        'Employee': t.requesterName || t.employee?.fullName || '-',
        'Department': t.department?.name || '-',
        'Branch': t.location?.name || '-',
        'Category': t.category?.name || '-',
        'Type': t.requestType,
        'Priority': t.priority,
        'Assigned To': t.assignedTo?.fullName || 'Unassigned',
        'Status': t.status,
        'SLA': t.slaInfo.slaStatus,
        'Subject': t.subject,
      }));
    } else if (type === 'department' || type === 'branch' || type === 'category') {
      const labelFn =
        type === 'department'
          ? (t) => t.department?.name || 'Unassigned'
          : type === 'branch'
          ? (t) => t.location?.name || 'Unassigned'
          : (t) => t.category?.name || 'Uncategorized';
      const groups = {};
      for (const t of withSla) {
        const key = labelFn(t);
        if (!groups[key]) {
          groups[key] = { name: key, total: 0, open: 0, resolved: 0, breached: 0, ratings: [] };
        }
        groups[key].total++;
        if (!['RESOLVED', 'CLOSED'].includes(t.status)) groups[key].open++;
        else groups[key].resolved++;
        if (t.slaInfo.slaStatus === 'BREACHED') groups[key].breached++;
        if (t.satisfactionRating) groups[key].ratings.push(t.satisfactionRating);
      }
      rows = Object.values(groups).map((g) => ({
        [type === 'department' ? 'Department' : type === 'branch' ? 'Branch / Location' : 'Category']: g.name,
        'Total Tickets': g.total,
        'Active / Open': g.open,
        'Resolved / Closed': g.resolved,
        'SLA Breached': g.breached,
        'Avg Rating': g.ratings.length ? (g.ratings.reduce((a, b) => a + b, 0) / g.ratings.length).toFixed(2) : '-',
      }));
    } else if (type === 'technician') {
      const groups = {};
      for (const t of withSla) {
        const key = t.assignedTo?.fullName || 'Unassigned';
        if (!groups[key]) {
          groups[key] = { name: key, assigned: 0, completed: 0, pending: 0, overdue: 0, resMin: [], ratings: [] };
        }
        groups[key].assigned++;
        if (['RESOLVED', 'CLOSED'].includes(t.status)) groups[key].completed++;
        if (t.status === 'PENDING') groups[key].pending++;
        if (t.slaInfo.slaStatus === 'BREACHED' && !['RESOLVED', 'CLOSED'].includes(t.status)) groups[key].overdue++;
        if (t.resolutionMinutes != null) groups[key].resMin.push(t.resolutionMinutes);
        if (t.satisfactionRating != null) groups[key].ratings.push(t.satisfactionRating);
      }
      rows = Object.values(groups).map((g) => ({
        'IT Officer': g.name,
        'Assigned': g.assigned,
        'Completed': g.completed,
        'Pending': g.pending,
        'Overdue': g.overdue,
        'Avg Resolution (min)': g.resMin.length ? Math.round(g.resMin.reduce((a, b) => a + b, 0) / g.resMin.length) : '-',
        'Avg Rating': g.ratings.length ? (g.ratings.reduce((a, b) => a + b, 0) / g.ratings.length).toFixed(2) : '-',
      }));
    } else if (type === 'outstanding') {
      rows = withSla
        .filter((t) => !['RESOLVED', 'CLOSED'].includes(t.status))
        .map((t) => ({
          'Ticket No': t.ticketCode,
          'Created': new Date(t.createdAt).toLocaleDateString(),
          'Priority': t.priority,
          'Status': t.status,
          'Requester': t.requesterName || '-',
          'Assigned To': t.assignedTo?.fullName || 'Unassigned',
          'SLA Status': t.slaInfo.slaStatus,
          'Remaining (min)': t.slaInfo.remainingMinutes ?? '-',
          'Subject': t.subject,
        }));
    } else if (type === 'overdue') {
      rows = withSla
        .filter((t) => t.slaInfo.slaStatus === 'BREACHED')
        .map((t) => ({
          'Ticket No': t.ticketCode,
          'Priority': t.priority,
          'Status': t.status,
          'Due At': t.resolutionDueAt ? new Date(t.resolutionDueAt).toLocaleString() : '-',
          'Overdue (min)': t.slaInfo.overdueMinutes,
          'Assigned To': t.assignedTo?.fullName || 'Unassigned',
          'Requester': t.requesterName || '-',
          'Subject': t.subject,
        }));
    } else if (type === 'sla') {
      rows = withSla.map((t) => ({
        'Ticket No': t.ticketCode,
        'Priority': t.priority,
        'Status': t.status,
        'First Response (min)': t.firstResponseMinutes ?? '-',
        'Resolution (min)': t.resolutionMinutes ?? '-',
        'Paused (min)': t.slaTotalPausedMinutes || 0,
        'SLA Status': t.slaInfo.slaStatus,
        'Assigned To': t.assignedTo?.fullName || 'Unassigned',
      }));
    } else if (type === 'satisfaction') {
      rows = withSla
        .filter((t) => t.satisfactionRating != null || t.employeeConfirmed !== null)
        .map((t) => ({
          'Ticket No': t.ticketCode,
          'Employee': t.requesterName || '-',
          'IT Officer': t.assignedTo?.fullName || '-',
          'Resolved Confirmed': t.employeeConfirmed ? 'Yes' : 'No',
          'Rating (1-5)': t.satisfactionRating ?? '-',
          'Feedback': t.employeeFeedback || '-',
          'Confirmed At': t.employeeConfirmedAt ? new Date(t.employeeConfirmedAt).toLocaleString() : '-',
        }));
    } else if (type === 'asset-maintenance') {
      rows = withSla
        .filter((t) => t.asset)
        .map((t) => ({
          'Asset Code': t.asset.assetCode,
          'Device': `${t.asset.brand || ''} ${t.asset.model || t.asset.deviceType}`.trim(),
          'Ticket No': t.ticketCode,
          'Reported Issue': t.subject,
          'Reported Date': new Date(t.createdAt).toLocaleDateString(),
          'Officer': t.assignedTo?.fullName || 'Unassigned',
          'Action Taken': t.actionTaken || '-',
          'Repair/Replace': t.repairOrReplacementDetails || '-',
          'Cost': t.repairCost != null ? t.repairCost.toFixed(2) : '0.00',
          'Status': t.status,
        }));
    }

    res.json({ type, count: rows.length, rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =============================================================================
// 7. HELP DESK SETTINGS, SLA RULES & CATEGORIES ADMIN (SECTION 9, 17, 23)
// =============================================================================

router.get('/settings', requireModule('IT_HELP_DESK'), async (req, res) => {
  try {
    if (!isHelpDeskManager(req.user.role) && !req.user.moduleAccess?.SYSTEM_SETTINGS) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const [settings, slaRules, categories, emailLogs] = await Promise.all([
      prisma.helpDeskSettings.findUnique({ where: { id: 'global' } }),
      prisma.helpDeskSlaRule.findMany({ orderBy: { firstResponseMinutes: 'asc' } }),
      prisma.helpDeskCategory.findMany({
        include: { _count: { select: { tickets: true } } },
        orderBy: { sortOrder: 'asc' },
      }),
      prisma.emailNotificationLog.findMany({ orderBy: { createdAt: 'desc' }, take: 30 }),
    ]);
    res.json({ settings, slaRules, categories, emailLogs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/settings', requireModule('IT_HELP_DESK'), async (req, res) => {
  try {
    if (!isAdminOrHeadOfIT(req.user.role) && !req.user.moduleAccess?.SYSTEM_SETTINGS) {
      return res.status(403).json({ error: 'Forbidden: Head of IT or Admin access required' });
    }

    const oldSettings = await prisma.helpDeskSettings.findUnique({ where: { id: 'global' } });
    const {
      ticketPrefix,
      ticketNumberFormat,
      workingHours,
      holidays,
      allowedPauseReasons,
      requestTypes,
      priorityLevels,
      notificationSettings,
      feedbackSettings,
      assignmentRules,
      escalationRules,
    } = req.body;

    const updated = await prisma.helpDeskSettings.update({
      where: { id: 'global' },
      data: {
        ...(ticketPrefix !== undefined && { ticketPrefix }),
        ...(ticketNumberFormat !== undefined && { ticketNumberFormat }),
        ...(workingHours !== undefined && { workingHours }),
        ...(holidays !== undefined && { holidays }),
        ...(allowedPauseReasons !== undefined && { allowedPauseReasons }),
        ...(requestTypes !== undefined && { requestTypes }),
        ...(priorityLevels !== undefined && { priorityLevels }),
        ...(notificationSettings !== undefined && { notificationSettings }),
        ...(feedbackSettings !== undefined && { feedbackSettings }),
        ...(assignmentRules !== undefined && { assignmentRules }),
        ...(escalationRules !== undefined && { escalationRules }),
      },
    });

    await logAudit({
      req,
      action: 'UPDATE_HELPDESK_SETTINGS',
      module: 'HELPDESK',
      entityType: 'HELPDESK_SETTINGS',
      entityId: 'global',
      severity: 'CRITICAL',
      oldValue: oldSettings,
      newValue: updated,
      description: 'Updated Help Desk configuration settings',
    });

    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/sla-rules', requireModule('IT_HELP_DESK'), async (req, res) => {
  try {
    if (!isAdminOrHeadOfIT(req.user.role) && !req.user.moduleAccess?.SYSTEM_SETTINGS) {
      return res.status(403).json({ error: 'Forbidden: Head of IT or Admin access required' });
    }

    const { rules } = req.body;
    if (!Array.isArray(rules)) return res.status(400).json({ error: 'rules array required' });

    const oldRules = await prisma.helpDeskSlaRule.findMany();
    const updatedRules = [];
    for (const r of rules) {
      const u = await prisma.helpDeskSlaRule.upsert({
        where: { priority: r.priority },
        update: {
          firstResponseMinutes: Math.max(1, Number(r.firstResponseMinutes) || 15),
          resolutionMinutes: Math.max(5, Number(r.resolutionMinutes) || 60),
          warningThresholdPercent: Math.min(95, Math.max(10, Number(r.warningThresholdPercent) || 75)),
          escalateAfterBreachMinutes: Math.max(0, Number(r.escalateAfterBreachMinutes) || 30),
          isActive: r.isActive !== undefined ? Boolean(r.isActive) : true,
        },
        create: {
          priority: r.priority,
          firstResponseMinutes: Number(r.firstResponseMinutes) || 60,
          resolutionMinutes: Number(r.resolutionMinutes) || 240,
          warningThresholdPercent: Number(r.warningThresholdPercent) || 75,
          escalateAfterBreachMinutes: Number(r.escalateAfterBreachMinutes) || 30,
          isActive: true,
        },
      });
      updatedRules.push(u);
    }

    await logAudit({
      req,
      action: 'UPDATE_SLA_RULES',
      module: 'HELPDESK',
      entityType: 'SLA_RULES',
      entityId: 'global',
      severity: 'CRITICAL',
      oldValue: oldRules,
      newValue: updatedRules,
      description: 'Updated Help Desk SLA targets and escalation thresholds',
    });

    res.json(updatedRules);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Category Management (never permanently delete categories with historical tickets)
router.post('/categories', requireModule('IT_HELP_DESK'), async (req, res) => {
  try {
    if (!isAdminOrHeadOfIT(req.user.role) && !req.user.moduleAccess?.SYSTEM_SETTINGS) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const { name, description, examples, sortOrder } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Category name is required' });

    const created = await prisma.helpDeskCategory.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        examples: examples?.trim() || null,
        sortOrder: Number(sortOrder) || 99,
        isActive: true,
        isSystem: false,
      },
    });

    await logAudit({
      req,
      action: 'CREATE_HELPDESK_CATEGORY',
      module: 'HELPDESK',
      entityType: 'HELPDESK_CATEGORY',
      entityId: created.id,
      newValue: created,
      description: `Created Help Desk category: ${created.name}`,
    });

    res.status(201).json(created);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/categories/:id', requireModule('IT_HELP_DESK'), async (req, res) => {
  try {
    if (!isAdminOrHeadOfIT(req.user.role) && !req.user.moduleAccess?.SYSTEM_SETTINGS) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const { name, description, examples, isActive, sortOrder } = req.body;
    const oldCat = await prisma.helpDeskCategory.findUnique({ where: { id: req.params.id } });
    if (!oldCat) return res.status(404).json({ error: 'Category not found' });

    const updated = await prisma.helpDeskCategory.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(examples !== undefined && { examples: examples?.trim() || null }),
        ...(isActive !== undefined && { isActive: Boolean(isActive) }),
        ...(sortOrder !== undefined && { sortOrder: Number(sortOrder) }),
      },
    });

    await logAudit({
      req,
      action: 'UPDATE_HELPDESK_CATEGORY',
      module: 'HELPDESK',
      entityType: 'HELPDESK_CATEGORY',
      entityId: updated.id,
      oldValue: oldCat,
      newValue: updated,
      description: `Updated Help Desk category: ${updated.name}`,
    });

    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/categories/:id', requireModule('IT_HELP_DESK'), async (req, res) => {
  try {
    if (!isAdminOrHeadOfIT(req.user.role) && !req.user.moduleAccess?.SYSTEM_SETTINGS) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const cat = await prisma.helpDeskCategory.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { tickets: true } } },
    });
    if (!cat) return res.status(404).json({ error: 'Category not found' });

    if (cat._count.tickets > 0) {
      const deactivated = await prisma.helpDeskCategory.update({
        where: { id: cat.id },
        data: { isActive: false },
      });
      return res.json({
        deactivated: true,
        category: deactivated,
        message: 'Category has historical tickets and was deactivated instead of permanently deleted.',
      });
    }

    await prisma.helpDeskCategory.delete({ where: { id: cat.id } });
    res.json({ deleted: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
