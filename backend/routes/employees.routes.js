const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient');
const { authenticate, requirePermission } = require('../middleware/auth.middleware');
const { generateEmployeeCode } = require('../utils/codeGenerator');

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
    res.status(201).json(record);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', requirePermission('MANAGE_EMPLOYEES'), async (req, res) => {
  try {
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
    res.json(record);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Only Admin can delete
router.delete('/:id', requirePermission('MANAGE_EMPLOYEES'), async (req, res) => {
  try {
    // Manual cascade delete
    await prisma.$transaction([
      prisma.asset.updateMany({
        where: { assignedEmployeeId: req.params.id },
        data: { assignedEmployeeId: null, status: 'AVAILABLE' }
      }),
      prisma.assetAssignment.deleteMany({ where: { employeeId: req.params.id } }),
      prisma.supportTicket.deleteMany({ where: { employeeId: req.params.id } }),
      prisma.employee.delete({ where: { id: req.params.id } })
    ]);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
