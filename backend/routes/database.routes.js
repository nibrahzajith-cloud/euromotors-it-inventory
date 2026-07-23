const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { logAudit } = require('../utils/logger');

router.use(authenticate);

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
