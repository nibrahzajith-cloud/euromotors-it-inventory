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
    const record = await prisma.$transaction(async (tx) => {
      if (!payload.employeeCode) {
        payload.employeeCode = await generateEmployeeCode(tx);
      }
      return await tx.employee.create({ data: payload });
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
    const record = await prisma.employee.update({ where: { id: req.params.id }, data: req.body });
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
