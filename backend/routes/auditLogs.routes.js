const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient');
const { authenticate, requirePermission } = require('../middleware/auth.middleware');

router.use(authenticate);

// Build query helper
const buildQuery = (query) => {
  const { module, action, userId, startDate, endDate, status } = query;
  const where = {};
  if (module) where.module = module;
  if (action) where.action = action;
  if (userId) where.userId = userId;
  
  if (status) {
    if (status === 'SUCCESS') where.action = { not: { contains: 'FAILED' } };
    if (status === 'FAILED') where.action = { contains: 'FAILED' };
  }
  
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      where.createdAt.lte = end;
    }
  }
  return where;
};

// GET /api/audit-logs
router.get('/', requirePermission('VIEW_AUDIT_LOG'), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
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

    res.json({ logs, total, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: 'Server error fetching audit logs', details: err.message });
  }
});

// GET /api/audit-logs/export
router.get('/export', requirePermission('EXPORT_AUDIT_LOG'), async (req, res) => {
  try {
    const where = buildQuery(req.query);
    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });

    const csvLines = [];
    csvLines.push(['Timestamp', 'User', 'Role', 'Action', 'Module', 'Record', 'IP Address', 'Description'].join(','));
    
    for (const log of logs) {
      csvLines.push([
        `"${new Date(log.createdAt).toISOString()}"`,
        `"${log.userName || log.userId || ''}"`,
        `"${log.userRole || ''}"`,
        `"${log.action || ''}"`,
        `"${log.module || ''}"`,
        `"${log.entityCode || log.entityId || ''}"`,
        `"${log.ipAddress || ''}"`,
        `"${(log.description || '').replace(/"/g, '""')}"`
      ].join(','));
    }

    const csvContent = csvLines.join('\n');
    
    // Set headers
    const startDate = req.query.startDate || 'start';
    const endDate = req.query.endDate || 'end';
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=Euro_Motors_Audit_Log_${startDate}_to_${endDate}.csv`);
    
    res.send(csvContent);
  } catch (err) {
    res.status(500).json({ error: 'Server error exporting audit logs', details: err.message });
  }
});

module.exports = router;
