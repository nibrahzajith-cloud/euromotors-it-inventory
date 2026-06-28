const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient');
const { authenticate, authorize } = require('../middleware/auth.middleware');

router.use(authenticate);

router.get('/', authorize(['ADMIN']), async (req, res) => {
  try {
    const { module, action, userId, startDate, endDate } = req.query;

    const where = {};
    if (module) where.module = module;
    if (action) where.action = action;
    if (userId) where.userId = userId;
    
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });

    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: 'Server error fetching audit logs', details: err.message });
  }
});

module.exports = router;
