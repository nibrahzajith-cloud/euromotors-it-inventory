const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient');
const { authenticate, requirePermission } = require('../middleware/auth.middleware');
const { generateEmployeeCode } = require('../utils/codeGenerator');
const { logAudit } = require('../utils/logger');

router.use(authenticate);

// Everyone can view employees
router.get('/', async (req, res) => {
  try {
    const records = await prisma.employee.findMany({ 
      include: { 
        department: true, 
        location: true,
        assignedAssets: true,
        assignments: { where: { status: 'ACTIVE' } }
      } 
    });
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin and IT Officer can modify
router.post('/', requirePermission('MANAGE_EMPLOYEES'), async (req, res) => {
  try {
    const payload = { ...req.body };

    // Duplicate prevention: check if active employee with same email already exists
    if (payload.email && typeof payload.email === 'string' && payload.email.trim()) {
      const existing = await prisma.employee.findFirst({
        where: { email: payload.email.trim(), status: 'ACTIVE' }
      });
      if (existing) {
        return res.status(409).json({ error: `An active employee with email "${payload.email.trim()}" already exists (${existing.fullName}).` });
      }
    }

    // Debounce check: prevent double-clicks within 3 seconds for identical name + department
    if (payload.fullName) {
      const recentDuplicate = await prisma.employee.findFirst({
        where: {
          fullName: payload.fullName.trim(),
          departmentId: payload.departmentId || null,
          createdAt: { gte: new Date(Date.now() - 3000) }
        }
      });
      if (recentDuplicate) {
        return res.status(200).json(recentDuplicate);
      }
    }

    const record = await prisma.$transaction(async (tx) => {
      if (!payload.employeeCode) {
        payload.employeeCode = await generateEmployeeCode(tx);
      }
      return await tx.employee.create({ 
        data: payload,
        include: {
          department: true,
          location: true,
          assignedAssets: true,
          assignments: { where: { status: 'ACTIVE' } }
        }
      });
    }, {
      maxWait: 5000,
      timeout: 10000,
      isolationLevel: 'ReadCommitted'
    });
    await logAudit({
      req,
      action: 'CREATE',
      module: 'EMPLOYEES',
      entityType: 'EMPLOYEE',
      entityId: record.id,
      entityCode: record.employeeCode,
      employeeOverride: { id: record.id, fullName: record.fullName, departmentName: record.department?.name },
      newValue: record,
      description: `Registered employee: ${record.fullName} (${record.employeeCode})`
    });

    res.status(201).json(record);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', requirePermission('MANAGE_EMPLOYEES'), async (req, res) => {
  try {
    const oldRecord = await prisma.employee.findUnique({
      where: { id: req.params.id },
      include: { department: true, location: true }
    });
    if (!oldRecord) return res.status(404).json({ error: 'Employee not found' });

    const record = await prisma.employee.update({ 
      where: { id: req.params.id }, 
      data: req.body,
      include: {
        department: true,
        location: true,
        assignedAssets: true,
        assignments: { where: { status: 'ACTIVE' } }
      }
    });

    await logAudit({
      req,
      action: 'UPDATE',
      module: 'EMPLOYEES',
      entityType: 'EMPLOYEE',
      entityId: record.id,
      entityCode: record.employeeCode,
      employeeOverride: { id: record.id, fullName: record.fullName, departmentName: record.department?.name },
      oldValue: oldRecord,
      newValue: record,
      description: `Updated employee profile: ${record.fullName} (${record.employeeCode})`
    });

    res.json(record);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Only Admin can delete
router.delete('/:id', requirePermission('MANAGE_EMPLOYEES'), async (req, res) => {
  try {
    const targetEmp = await prisma.employee.findUnique({ where: { id: req.params.id } });
    if (!targetEmp) return res.status(404).json({ error: 'Employee not found' });

    await prisma.$transaction([
      prisma.asset.updateMany({
        where: { assignedEmployeeId: req.params.id },
        data: { assignedEmployeeId: null, status: 'AVAILABLE' }
      }),
      prisma.assetAssignment.deleteMany({ where: { employeeId: req.params.id } }),
      prisma.supportTicket.deleteMany({ where: { employeeId: req.params.id } }),
      prisma.employee.delete({ where: { id: req.params.id } })
    ]);

    await logAudit({
      req,
      action: 'DELETE',
      module: 'EMPLOYEES',
      entityType: 'EMPLOYEE',
      entityId: req.params.id,
      entityCode: targetEmp.employeeCode,
      employeeOverride: { id: targetEmp.id, fullName: targetEmp.fullName },
      oldValue: targetEmp,
      severity: 'WARNING',
      description: `Deleted employee profile: ${targetEmp.fullName} (${targetEmp.employeeCode})`
    });

    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
