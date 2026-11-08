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
      const cached = memoryCache.get('locations:all');
      if (cached) return res.json(cached);
    }
    const records = await prisma.location.findMany({
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
    memoryCache.set('locations:all', records, 60);
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', requirePermission('MANAGE_LOCATIONS'), async (req, res) => {
  try {
    const record = await prisma.location.create({ data: req.body });
    memoryCache.delPrefix('locations');
    memoryCache.delPrefix('dashboard');
    await logAudit({
      req,
      action: 'CREATE',
      module: 'LOCATIONS',
      entityType: 'LOCATION',
      entityId: record.id,
      newValue: record,
      description: `Created facility location: ${record.name}`
    });
    res.status(201).json(record);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', requirePermission('MANAGE_LOCATIONS'), async (req, res) => {
  try {
    const oldRecord = await prisma.location.findUnique({ where: { id: req.params.id } });
    const record = await prisma.location.update({ where: { id: req.params.id }, data: req.body });
    memoryCache.delPrefix('locations');
    memoryCache.delPrefix('dashboard');
    await logAudit({
      req,
      action: 'UPDATE',
      module: 'LOCATIONS',
      entityType: 'LOCATION',
      entityId: record.id,
      oldValue: oldRecord,
      newValue: record,
      description: `Updated facility location: ${record.name}`
    });
    res.json(record);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', requirePermission('MANAGE_LOCATIONS'), async (req, res) => {
  try {
    await prisma.location.delete({ where: { id: req.params.id } });
    memoryCache.delPrefix('locations');
    memoryCache.delPrefix('dashboard');
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
