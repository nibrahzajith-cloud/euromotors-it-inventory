const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient');
const { authenticate, requirePermission } = require('../middleware/auth.middleware');
const { logAudit } = require('../utils/logger');
const memoryCache = require('../utils/cache');

router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    if (req.query.refresh !== 'true') {
      const cached = memoryCache.get('departments:all');
      if (cached) return res.json(cached);
    }
    const records = await prisma.department.findMany({
      include: {
        _count: {
          select: {
            employees: true,
            assets: true
          }
        },
        employees: {
          take: 5,
          select: {
            id: true,
            fullName: true,
            designation: true,
            status: true
          }
        },
        assets: {
          take: 5,
          select: {
            id: true,
            assetCode: true,
            deviceType: true,
            model: true,
            status: true
          }
        }
      }
    });
    memoryCache.set('departments:all', records, 60);
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', requirePermission('MANAGE_DEPARTMENTS'), async (req, res) => {
  try {
    const record = await prisma.department.create({ data: req.body });
    memoryCache.delPrefix('departments');
    memoryCache.delPrefix('dashboard');
    await logAudit({
      req,
      action: 'CREATE',
      module: 'DEPARTMENTS',
      entityType: 'DEPARTMENT',
      entityId: record.id,
      newValue: record,
      description: `Created department: ${record.name}`
    });
    res.status(201).json(record);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', requirePermission('MANAGE_DEPARTMENTS'), async (req, res) => {
  try {
    const oldRecord = await prisma.department.findUnique({ where: { id: req.params.id } });
    const record = await prisma.department.update({ where: { id: req.params.id }, data: req.body });
    memoryCache.delPrefix('departments');
    memoryCache.delPrefix('dashboard');
    await logAudit({
      req,
      action: 'UPDATE',
      module: 'DEPARTMENTS',
      entityType: 'DEPARTMENT',
      entityId: record.id,
      oldValue: oldRecord,
      newValue: record,
      description: `Updated department: ${record.name}`
    });
    res.json(record);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', requirePermission('MANAGE_DEPARTMENTS'), async (req, res) => {
  try {
    await prisma.department.delete({ where: { id: req.params.id } });
    memoryCache.delPrefix('departments');
    memoryCache.delPrefix('dashboard');
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
