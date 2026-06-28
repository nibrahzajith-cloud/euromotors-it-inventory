const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { logAudit, logAssetTimeline } = require('../utils/logger');

router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const records = await prisma.maintenanceLog.findMany({ include: { asset: true } });
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', authorize(['ADMIN', 'IT_OFFICER']), async (req, res) => {
  try {
    const asset = await prisma.asset.findUnique({ where: { id: req.body.assetId } });
    if (!asset) return res.status(404).json({ error: 'Asset not found' });

    const record = await prisma.maintenanceLog.create({ data: req.body });
    
    // Update asset status
    await prisma.asset.update({
      where: { id: req.body.assetId },
      data: { status: 'UNDER_REPAIR' }
    });

    // Log Audit
    await logAudit({
      req,
      action: 'CREATE_MAINTENANCE',
      module: 'MAINTENANCE',
      entityType: 'MAINTENANCE_LOG',
      entityId: record.id,
      entityCode: asset.assetCode,
      newValue: record,
      description: `Maintenance opened for asset ${asset.assetCode}: ${record.issueDescription}`
    });

    // Log Timeline
    await logAssetTimeline({
      assetId: asset.id,
      assetCode: asset.assetCode,
      eventType: 'MAINTENANCE_OPENED',
      title: 'Maintenance Opened',
      description: `Issue: ${record.issueDescription}`,
      oldStatus: asset.status,
      newStatus: 'UNDER_REPAIR',
      performedById: req.user.id,
      performedByName: req.user.fullName
    });

    res.status(201).json(record);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', authorize(['ADMIN', 'IT_OFFICER']), async (req, res) => {
  try {
    const oldLog = await prisma.maintenanceLog.findUnique({ 
       where: { id: req.params.id },
       include: { asset: true }
    });
    if (!oldLog) return res.status(404).json({ error: 'Maintenance log not found' });

    const record = await prisma.maintenanceLog.update({ where: { id: req.params.id }, data: req.body });
    
    // Status Logic Resolution
    if (record.status === 'RESOLVED' && oldLog.status !== 'RESOLVED') {
       const asset = await prisma.asset.findUnique({ where: { id: record.assetId } });
       const nextStatus = asset.assignedEmployeeId ? 'ASSIGNED' : 'AVAILABLE';
       await prisma.asset.update({
          where: { id: record.assetId },
          data: { status: nextStatus }
       });

       // Log Timeline for Resolution
       await logAssetTimeline({
         assetId: oldLog.asset.id,
         assetCode: oldLog.asset.assetCode,
         eventType: 'MAINTENANCE_RESOLVED',
         title: 'Maintenance Resolved',
         description: `Repair completed: ${record.repairAction || 'No details'}`,
         oldStatus: 'UNDER_REPAIR',
         newStatus: nextStatus,
         performedById: req.user.id,
         performedByName: req.user.fullName
       });
    } else if ((record.status === 'OPEN' || record.status === 'IN_PROGRESS') && oldLog.status === 'RESOLVED') {
       // Re-opening maintenance
       await prisma.asset.update({
          where: { id: record.assetId },
          data: { status: 'UNDER_REPAIR' }
       });
    }

    // Log Audit for update
    await logAudit({
      req,
      action: 'UPDATE_MAINTENANCE',
      module: 'MAINTENANCE',
      entityType: 'MAINTENANCE_LOG',
      entityId: record.id,
      entityCode: oldLog.asset.assetCode,
      oldValue: oldLog,
      newValue: record,
      description: `Maintenance updated for asset ${oldLog.asset.assetCode}. Status: ${record.status}`
    });
    
    res.json(record);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', authorize(['ADMIN']), async (req, res) => {
  try {
    const record = await prisma.maintenanceLog.findUnique({ 
       where: { id: req.params.id },
       include: { asset: true }
    });
    if (!record) return res.status(404).json({ error: 'Maintenance log not found' });
    
    await prisma.maintenanceLog.delete({ where: { id: req.params.id } });

    // Log Audit
    await logAudit({
      req,
      action: 'DELETE_MAINTENANCE',
      module: 'MAINTENANCE',
      entityType: 'MAINTENANCE_LOG',
      entityId: req.params.id,
      entityCode: record.asset.assetCode,
      description: `Historical maintenance record deleted for asset ${record.asset.assetCode}`
    });

    res.json({ message: 'Deleted historical maintenance log.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
