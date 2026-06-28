const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { logAudit, logAssetTimeline } = require('../utils/logger');

router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const records = await prisma.assetAssignment.findMany({ include: { asset: true, employee: true } });
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', authorize(['ADMIN', 'IT_OFFICER']), async (req, res) => {
  try {
    const asset = await prisma.asset.findUnique({ 
       where: { id: req.body.assetId },
       include: { department: true, location: true }
    });
    if (!asset) return res.status(404).json({ error: 'Asset not found' });
    if (asset.status === 'UNDER_REPAIR') {
      return res.status(400).json({ error: 'Cannot assign an asset that is currently under repair.' });
    }
    if (asset.status !== 'AVAILABLE') {
      return res.status(400).json({ error: `Cannot assign asset. Current status is ${asset.status}.` });
    }

    const employee = await prisma.employee.findUnique({ 
       where: { id: req.body.employeeId },
       include: { department: true, location: true }
    });
    if (!employee) return res.status(404).json({ error: 'Employee not found' });

    const record = await prisma.assetAssignment.create({ data: req.body });
    
    // Update asset status
    await prisma.asset.update({
      where: { id: req.body.assetId },
      data: { status: 'ASSIGNED', assignedEmployeeId: req.body.employeeId }
    });

    // Log Audit
    await logAudit({
      req,
      action: 'ASSIGN',
      module: 'ASSIGNMENTS',
      entityType: 'ASSIGNMENT',
      entityId: record.id,
      entityCode: asset.assetCode,
      newValue: record,
      description: `Asset ${asset.assetCode} assigned to ${employee.fullName}`
    });

    // Log Timeline
    await logAssetTimeline({
      assetId: asset.id,
      assetCode: asset.assetCode,
      eventType: 'ASSIGNED',
      title: 'Asset Assigned',
      description: `Assigned to ${employee.fullName} (${employee.employeeCode})`,
      oldStatus: 'AVAILABLE',
      newStatus: 'ASSIGNED',
      employeeId: employee.id,
      employeeName: employee.fullName,
      departmentId: employee.departmentId,
      departmentName: employee.department?.name,
      locationId: employee.locationId,
      locationName: employee.location?.name,
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
    const oldAssignment = await prisma.assetAssignment.findUnique({ 
       where: { id: req.params.id },
       include: { asset: true, employee: true }
    });
    if (!oldAssignment) return res.status(404).json({ error: 'Assignment not found' });

    const record = await prisma.assetAssignment.update({ 
       where: { id: req.params.id }, 
       data: req.body 
    });

    if(req.body.status === 'RETURNED' && oldAssignment.status !== 'RETURNED') {
       await prisma.asset.update({
          where: { id: record.assetId },
          data: { status: 'AVAILABLE', assignedEmployeeId: null }
       });

       // Log Audit
       await logAudit({
         req,
         action: 'RETURN',
         module: 'ASSIGNMENTS',
         entityType: 'ASSIGNMENT',
         entityId: record.id,
         entityCode: oldAssignment.asset.assetCode,
         description: `Asset ${oldAssignment.asset.assetCode} returned by ${oldAssignment.employee.fullName}`
       });

       // Log Timeline
       await logAssetTimeline({
         assetId: oldAssignment.asset.id,
         assetCode: oldAssignment.asset.assetCode,
         eventType: 'RETURNED',
         title: 'Asset Returned',
         description: `Returned by ${oldAssignment.employee.fullName}`,
         oldStatus: 'ASSIGNED',
         newStatus: 'AVAILABLE',
         employeeId: oldAssignment.employee.id,
         employeeName: oldAssignment.employee.fullName,
         performedById: req.user.id,
         performedByName: req.user.fullName
       });
    }

    res.json(record);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', authorize(['ADMIN']), async (req, res) => {
  try {
    const record = await prisma.assetAssignment.findUnique({ 
       where: { id: req.params.id },
       include: { asset: true }
    });
    if (!record) return res.status(404).json({ error: 'Assignment not found' });
    
    if (record.status === 'ACTIVE') {
       await prisma.asset.update({
          where: { id: record.assetId },
          data: { status: 'AVAILABLE', assignedEmployeeId: null }
       });
    }
    
    await prisma.assetAssignment.delete({ where: { id: req.params.id } });

    // Log Audit
    await logAudit({
      req,
      action: 'DELETE',
      module: 'ASSIGNMENTS',
      entityType: 'ASSIGNMENT',
      entityId: req.params.id,
      entityCode: record.asset?.assetCode,
      description: `Historical assignment record deleted for asset ${record.asset?.assetCode}`
    });

    res.json({ message: 'Deleted historical assignment record.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
