const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { logAudit } = require('../utils/logger');

router.use(authenticate);

// GET /api/database/counts — Returns actual record counts per table
router.get('/counts', authorize(['ADMIN']), async (req, res) => {
  try {
    const [
      assets, employees, departments, locations,
      assignments, maintenanceLogs, auditLogs, tickets,
      documents, timelines, users
    ] = await Promise.all([
      prisma.asset.count(),
      prisma.employee.count(),
      prisma.department.count(),
      prisma.location.count(),
      prisma.assetAssignment.count(),
      prisma.maintenanceLog.count(),
      prisma.auditLog.count(),
      prisma.supportTicket.count(),
      prisma.assetDocument.count(),
      prisma.assetTimeline.count(),
      prisma.user.count(),
    ]);

    // Breakdown counts
    const [
      assetsAssigned, assetsAvailable, assetsUnderRepair, assetsRetired,
      assetsWithImages, employeesActive
    ] = await Promise.all([
      prisma.asset.count({ where: { status: 'ASSIGNED' } }),
      prisma.asset.count({ where: { status: 'AVAILABLE' } }),
      prisma.asset.count({ where: { status: 'UNDER_REPAIR' } }),
      prisma.asset.count({ where: { status: 'RETIRED' } }),
      prisma.asset.count({ where: { imageStorageKey: { not: null } } }),
      prisma.employee.count({ where: { status: 'ACTIVE' } }),
    ]);

    res.json({
      tables: {
        assets,
        employees,
        departments,
        locations,
        assignments,
        maintenanceLogs,
        auditLogs,
        tickets,
        documents,
        timelines,
        users,
      },
      breakdown: {
        assetsAssigned,
        assetsAvailable,
        assetsUnderRepair,
        assetsRetired,
        assetsWithImages,
        employeesActive,
      }
    });
  } catch (err) {
    console.error('DB Counts Error:', err);
    res.status(500).json({ error: 'Failed to retrieve record counts' });
  }
});

// DELETE /api/database/reset-all
router.delete('/reset-all', authorize(['ADMIN']), async (req, res) => {
  try {
    // Delete in order to respect foreign key constraints
    await prisma.$transaction([
      prisma.supportTicket.deleteMany(),
      prisma.maintenanceLog.deleteMany(),
      prisma.assetDocument.deleteMany(),
      prisma.assetAssignment.deleteMany(),
      prisma.assetTimeline.deleteMany(),
      prisma.asset.deleteMany(),
      prisma.employee.deleteMany(),
      prisma.department.deleteMany(),
      prisma.location.deleteMany(),
      prisma.auditLog.deleteMany()
    ]);

    await logAudit({
      req,
      action: 'DELETE',
      module: 'DATABASE',
      description: 'Admin performed a complete database reset (inventory data cleared).'
    });

    res.json({ message: 'Database reset successfully.' });
  } catch (err) {
    console.error('Error resetting database:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/database/clear-activity
router.delete('/clear-activity', authorize(['ADMIN']), async (req, res) => {
  try {
    await prisma.$transaction([
      prisma.assetTimeline.deleteMany(),
      prisma.auditLog.deleteMany()
    ]);

    await logAudit({
      req,
      action: 'DELETE',
      module: 'DATABASE',
      description: 'Admin cleared all recent activity logs and timelines.'
    });

    res.json({ message: 'Activity logs cleared successfully.' });
  } catch (err) {
    console.error('Error clearing activity logs:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
