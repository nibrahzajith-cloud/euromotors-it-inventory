const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient');
const { authenticate, requirePermission } = require('../middleware/auth.middleware');

router.use(authenticate);

// Helper to build filtering query
const buildQuery = (query) => {
  const { module, action, userId, employeeId, entityId, entityCode, startDate, endDate, status, severity, activityType, search } = query;
  const where = {};

  if (module && module !== 'ALL') where.module = module.toUpperCase();
  if (action && action !== 'ALL') where.action = action.toUpperCase();
  if (userId) where.userId = userId;
  if (employeeId) where.employeeId = employeeId;
  if (entityId) where.entityId = entityId;
  if (entityCode) where.entityCode = { contains: entityCode, mode: 'insensitive' };
  if (status && status !== 'ALL') where.status = status.toUpperCase();
  if (severity && severity !== 'ALL') where.severity = severity.toUpperCase();
  if (activityType && activityType !== 'ALL') where.activityType = activityType.toUpperCase();

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      where.createdAt.lte = end;
    }
  }

  if (search && search.trim()) {
    const q = search.trim();
    where.OR = [
      { description: { contains: q, mode: 'insensitive' } },
      { userName: { contains: q, mode: 'insensitive' } },
      { userEmail: { contains: q, mode: 'insensitive' } },
      { employeeName: { contains: q, mode: 'insensitive' } },
      { entityCode: { contains: q, mode: 'insensitive' } },
      { action: { contains: q, mode: 'insensitive' } },
      { module: { contains: q, mode: 'insensitive' } }
    ];
  }

  return where;
};

// -----------------------------------------------------------------------------
// 1. GET /api/audit-logs - Main Log Explorer
// -----------------------------------------------------------------------------
router.get('/', requirePermission('VIEW_AUDIT_LOG'), async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(10, parseInt(req.query.limit) || 25));
    const skip = (page - 1) * limit;

    const where = buildQuery(req.query);

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.auditLog.count({ where })
    ]);

    res.json({
      logs,
      total,
      page,
      pages: Math.ceil(total / limit)
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch audit logs', details: err.message });
  }
});

// -----------------------------------------------------------------------------
// 2. GET /api/audit-logs/stats - KPI Summary & Analytics
// -----------------------------------------------------------------------------
router.get('/stats', requirePermission('VIEW_AUDIT_LOG'), async (req, res) => {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalEvents,
      activeUsersList,
      failedLogins,
      assetMods,
      permissionChanges,
      criticalEvents,
      humanEvents,
      systemEvents,
      moduleDistribution
    ] = await Promise.all([
      prisma.auditLog.count(),
      prisma.auditLog.groupBy({
        by: ['userId'],
        where: { createdAt: { gte: thirtyDaysAgo }, userId: { not: null } }
      }),
      prisma.auditLog.count({
        where: {
          action: 'LOGIN',
          status: 'FAILED',
          createdAt: { gte: thirtyDaysAgo }
        }
      }),
      prisma.auditLog.count({
        where: {
          module: 'ASSETS',
          action: { in: ['CREATE', 'UPDATE', 'DELETE', 'BULK_UPLOAD'] },
          createdAt: { gte: thirtyDaysAgo }
        }
      }),
      prisma.auditLog.count({
        where: {
          module: { in: ['PERMISSIONS', 'USERS'] },
          action: { in: ['MODIFY_PERMISSIONS', 'UPDATE_ROLE'] }
        }
      }),
      prisma.auditLog.count({
        where: {
          OR: [
            { severity: 'CRITICAL' },
            { status: 'BLOCKED' }
          ]
        }
      }),
      prisma.auditLog.count({ where: { activityType: 'HUMAN' } }),
      prisma.auditLog.count({ where: { activityType: 'SYSTEM' } }),
      prisma.auditLog.groupBy({
        by: ['module'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 8
      })
    ]);

    res.json({
      totalEvents,
      activeUsers: activeUsersList.length,
      failedLogins,
      assetModifications: assetMods,
      permissionChanges,
      criticalSecurityEvents: criticalEvents,
      humanEvents,
      systemEvents,
      moduleDistribution: moduleDistribution.map(m => ({
        module: m.module,
        count: m._count.id
      }))
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch audit stats', details: err.message });
  }
});

// -----------------------------------------------------------------------------
// 3. GET /api/audit-logs/employees/:employeeId - Employee Activity History
// -----------------------------------------------------------------------------
router.get('/employees/:employeeId', requirePermission('VIEW_AUDIT_LOG'), async (req, res) => {
  try {
    const { employeeId } = req.params;
    
    // Find employee
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: { department: true, location: true }
    });

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Try finding matching user account by email or name
    let matchingUser = null;
    if (employee.email) {
      matchingUser = await prisma.user.findUnique({ where: { email: employee.email } });
    }

    const whereConditions = [
      { employeeId: employee.id },
      { description: { contains: employee.fullName, mode: 'insensitive' } }
    ];

    if (employee.employeeCode) {
      whereConditions.push({ entityCode: employee.employeeCode });
    }

    if (matchingUser) {
      whereConditions.push({ userId: matchingUser.id });
    }

    const logs = await prisma.auditLog.findMany({
      where: { OR: whereConditions },
      orderBy: { createdAt: 'desc' },
      take: 100
    });

    // Compute activity metrics
    const summary = {
      totalActions: logs.length,
      assetsCreated: logs.filter(l => l.action === 'CREATE' && l.module === 'ASSETS').length,
      assetsUpdated: logs.filter(l => l.action === 'UPDATE' && l.module === 'ASSETS').length,
      assetsAssigned: logs.filter(l => l.action === 'ASSIGN').length,
      assetsReturned: logs.filter(l => l.action === 'RETURN').length,
      failedActions: logs.filter(l => l.status === 'FAILED').length,
      lastActive: logs.length > 0 ? logs[0].createdAt : null
    };

    res.json({
      employee: {
        id: employee.id,
        fullName: employee.fullName,
        employeeCode: employee.employeeCode,
        email: employee.email,
        designation: employee.designation,
        avatarUrl: employee.avatarUrl,
        department: employee.department?.name || 'Unassigned',
        location: employee.location?.name || 'Unassigned',
        status: employee.status
      },
      summary,
      logs
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch employee activity history', details: err.message });
  }
});

// -----------------------------------------------------------------------------
// 4. GET /api/audit-logs/assets/:assetId - Individual Asset Lifecycle History
// -----------------------------------------------------------------------------
router.get('/assets/:assetId', requirePermission('VIEW_AUDIT_LOG'), async (req, res) => {
  try {
    const { assetId } = req.params;

    // Find asset
    const asset = await prisma.asset.findFirst({
      where: {
        OR: [
          { id: assetId },
          { assetCode: assetId }
        ]
      },
      include: {
        department: true,
        location: true,
        assignedEmployee: true
      }
    });

    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    // Query all audit logs concerning this asset
    const [auditEvents, timelineEvents] = await Promise.all([
      prisma.auditLog.findMany({
        where: {
          OR: [
            { entityId: asset.id },
            { entityCode: asset.assetCode },
            { description: { contains: asset.assetCode, mode: 'insensitive' } }
          ]
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.assetTimeline.findMany({
        where: {
          OR: [
            { assetId: asset.id },
            { assetCode: asset.assetCode }
          ]
        },
        orderBy: { createdAt: 'desc' }
      })
    ]);

    // Unify timeline events into structured audit format
    const unifiedEvents = [...auditEvents];
    const auditTimestamps = new Set(auditEvents.map(a => Math.floor(new Date(a.createdAt).getTime() / 1000)));

    for (const t of timelineEvents) {
      const sec = Math.floor(new Date(t.createdAt).getTime() / 1000);
      if (!auditTimestamps.has(sec)) {
        unifiedEvents.push({
          id: t.id,
          createdAt: t.createdAt,
          action: t.eventType || 'STATUS_CHANGE',
          module: 'ASSETS',
          entityType: 'ASSET',
          entityId: t.assetId,
          entityCode: t.assetCode,
          userName: t.performedByName || 'System',
          employeeName: t.employeeName,
          description: t.description || t.title,
          oldValue: t.oldStatus ? JSON.stringify({ status: t.oldStatus }) : null,
          newValue: t.newStatus ? JSON.stringify({ status: t.newStatus }) : null,
          activityType: t.performedByName ? 'HUMAN' : 'SYSTEM',
          status: 'SUCCESS',
          severity: 'INFO'
        });
      }
    }

    unifiedEvents.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({
      asset: {
        id: asset.id,
        assetCode: asset.assetCode,
        deviceType: asset.deviceType,
        model: asset.model,
        serialNumber: asset.serialNumber,
        status: asset.status,
        department: asset.department?.name,
        location: asset.location?.name,
        assignedEmployee: asset.assignedEmployee?.fullName
      },
      events: unifiedEvents
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch asset history', details: err.message });
  }
});

// -----------------------------------------------------------------------------
// 5. GET /api/audit-logs/coverage - Audit Coverage Monitor
// -----------------------------------------------------------------------------
router.get('/coverage', requirePermission('VIEW_AUDIT_LOG'), async (req, res) => {
  try {
    // Registry of all auditable business operations
    const operationsRegistry = [
      { id: 'AUTH_LOGIN', name: 'User Authentication / Login', module: 'AUTH', category: 'Security' },
      { id: 'AUTH_LOGOUT', name: 'User Logout', module: 'AUTH', category: 'Security' },
      { id: 'AUTH_REGISTER', name: 'User Registration', module: 'AUTH', category: 'Security' },
      { id: 'AUTH_CHANGE_PASSWORD', name: 'Password Modification', module: 'AUTH', category: 'Security' },
      { id: 'ASSET_CREATE', name: 'Asset Registration', module: 'ASSETS', category: 'Asset Management' },
      { id: 'ASSET_UPDATE', name: 'Asset Profile Update', module: 'ASSETS', category: 'Asset Management' },
      { id: 'ASSET_DELETE', name: 'Asset Deletion', module: 'ASSETS', category: 'Asset Management' },
      { id: 'ASSET_BULK_UPLOAD', name: 'Bulk Inventory Import', module: 'ASSETS', category: 'Asset Management' },
      { id: 'ASSIGN_ASSET', name: 'Asset Assignment (Staff/Dept/Loc)', module: 'ASSIGNMENTS', category: 'Lifecycle' },
      { id: 'RETURN_ASSET', name: 'Asset Return to Store', module: 'ASSIGNMENTS', category: 'Lifecycle' },
      { id: 'TRANSFER_ASSET', name: 'Asset Custody Transfer', module: 'ASSIGNMENTS', category: 'Lifecycle' },
      { id: 'MAINTENANCE_LOG', name: 'Maintenance Ticket Created', module: 'MAINTENANCE', category: 'Maintenance' },
      { id: 'MAINTENANCE_UPDATE', name: 'Maintenance Status Updated', module: 'MAINTENANCE', category: 'Maintenance' },
      { id: 'EMPLOYEE_CREATE', name: 'Employee Registration', module: 'EMPLOYEES', category: 'Organization' },
      { id: 'EMPLOYEE_UPDATE', name: 'Employee Profile Update', module: 'EMPLOYEES', category: 'Organization' },
      { id: 'EMPLOYEE_DELETE', name: 'Employee Deletion', module: 'EMPLOYEES', category: 'Organization' },
      { id: 'DEPARTMENT_CREATE', name: 'Department Creation', module: 'DEPARTMENTS', category: 'Organization' },
      { id: 'DEPARTMENT_UPDATE', name: 'Department Update', module: 'DEPARTMENTS', category: 'Organization' },
      { id: 'LOCATION_CREATE', name: 'Location Creation', module: 'LOCATIONS', category: 'Organization' },
      { id: 'LOCATION_UPDATE', name: 'Location Update', module: 'LOCATIONS', category: 'Organization' },
      { id: 'DOCUMENT_UPLOAD', name: 'Procurement Document Upload', module: 'DOCUMENTS', category: 'Compliance' },
      { id: 'DOCUMENT_DELETE', name: 'Document Deletion', module: 'DOCUMENTS', category: 'Compliance' },
      { id: 'PERMISSION_MODIFY', name: 'Role Permission Mutation', module: 'PERMISSIONS', category: 'Security' },
      { id: 'USER_ROLE_UPDATE', name: 'User Role Assignment', module: 'USERS', category: 'Security' },
      { id: 'DATABASE_BACKUP', name: 'Database Backup Export', module: 'DATABASE', category: 'System' }
    ];

    // Query active modules in database
    const recordedActions = await prisma.auditLog.groupBy({
      by: ['module', 'action'],
      _count: { id: true }
    });

    const recordedSet = new Set(recordedActions.map(a => `${a.module}_${a.action}`));

    // Audit anomalies: check for events with missing identity
    const missingIdentityCount = await prisma.auditLog.count({
      where: {
        activityType: 'HUMAN',
        userId: null
      }
    });

    const coverageResults = operationsRegistry.map(op => {
      // Check if logged in system
      const isLogged = recordedActions.some(r => r.module === op.module);
      return {
        ...op,
        isInstrumented: true,
        hasRecordedData: isLogged,
        health: isLogged ? 'VERIFIED' : 'STANDBY'
      };
    });

    const verifiedCount = coverageResults.filter(c => c.hasRecordedData).length;
    const coveragePercentage = Math.round((verifiedCount / operationsRegistry.length) * 100);

    res.json({
      coverageScore: coveragePercentage,
      totalRegisteredOperations: operationsRegistry.length,
      verifiedOperations: verifiedCount,
      missingIdentityCount,
      lastCheckTimestamp: new Date().toISOString(),
      operations: coverageResults
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch coverage telemetry', details: err.message });
  }
});

// -----------------------------------------------------------------------------
// 6. GET /api/audit-logs/security-alerts - Security Telemetry
// -----------------------------------------------------------------------------
router.get('/security-alerts', requirePermission('VIEW_AUDIT_LOG'), async (req, res) => {
  try {
    const alerts = await prisma.auditLog.findMany({
      where: {
        OR: [
          { severity: { in: ['WARNING', 'CRITICAL'] } },
          { status: 'FAILED' },
          { action: { in: ['MODIFY_PERMISSIONS', 'UPDATE_ROLE', 'DELETE', 'BULK_UPLOAD'] } }
        ]
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    res.json({ alerts });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch security alerts', details: err.message });
  }
});

// -----------------------------------------------------------------------------
// 7. GET /api/audit-logs/export - CSV Export with Sri Lanka Time
// -----------------------------------------------------------------------------
router.get('/export', requirePermission('EXPORT_AUDIT_LOG'), async (req, res) => {
  try {
    const where = buildQuery(req.query);
    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 5000
    });

    // Helper for Sri Lanka Time (UTC+5:30)
    const formatSLT = (date) => {
      return new Date(date).toLocaleString('en-GB', {
        timeZone: 'Asia/Colombo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });
    };

    const csvLines = [];
    csvLines.push([
      'Event ID',
      'Timestamp (Sri Lanka Time)',
      'Actor Name',
      'Actor Email',
      'Actor Role',
      'Action Type',
      'Module',
      'Entity Code',
      'Target Employee',
      'Changed Fields',
      'Status',
      'Severity',
      'IP Address',
      'Description'
    ].join(','));

    for (const log of logs) {
      csvLines.push([
        `"${log.id}"`,
        `"${formatSLT(log.createdAt)}"`,
        `"${log.userName || 'System'}"`,
        `"${log.userEmail || 'system@euromotors.lk'}"`,
        `"${log.userRole || 'SYSTEM'}"`,
        `"${log.action}"`,
        `"${log.module}"`,
        `"${log.entityCode || log.entityId || ''}"`,
        `"${log.employeeName || ''}"`,
        `"${log.changedFields || ''}"`,
        `"${log.status || 'SUCCESS'}"`,
        `"${log.severity || 'INFO'}"`,
        `"${log.ipAddress || ''}"`,
        `"${(log.description || '').replace(/"/g, '""')}"`
      ].join(','));
    }

    const csvContent = csvLines.join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=EuroMotors_Audit_Trail_${Date.now()}.csv`);
    res.send(csvContent);
  } catch (err) {
    res.status(500).json({ error: 'Export failed', details: err.message });
  }
});

module.exports = router;
