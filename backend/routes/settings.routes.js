const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient');
const { authenticate, authorize, requireModule, requireAnyModule } = require('../middleware/auth.middleware');
const { logAudit } = require('../utils/logger');
const { getSystemVersionInfo } = require('../utils/systemVersion');

router.use(authenticate);

router.get('/version', authorize(['ADMIN', 'HEAD_OF_IT']), async (req, res) => {
  try {
    const info = await getSystemVersionInfo(prisma);
    res.json(info);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/', requireAnyModule(['IT_INVENTORY', 'SYSTEM_SETTINGS']), authorize(['ADMIN', 'HEAD_OF_IT', 'IT_MANAGER', 'IT_OFFICER']), async (req, res) => {
  try {
    let settings = await prisma.systemSettings.findUnique({ where: { id: 'global' } });
    if (!settings) {
      settings = await prisma.systemSettings.create({ data: { id: 'global' } });
    }
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/', requireModule('SYSTEM_SETTINGS'), authorize(['ADMIN', 'HEAD_OF_IT']), async (req, res) => {
  try {
    const { assetCodePrefix, warrantyPeriod } = req.body;
    let oldSettings = await prisma.systemSettings.findUnique({ where: { id: 'global' } });
    
    let settings;
    if (!oldSettings) {
      settings = await prisma.systemSettings.create({
         data: { id: 'global', assetCodePrefix, warrantyPeriod: parseInt(warrantyPeriod) }
      });
    } else {
      settings = await prisma.systemSettings.update({
         where: { id: 'global' },
         data: { assetCodePrefix, warrantyPeriod: parseInt(warrantyPeriod) }
      });
    }

    await logAudit({
      req,
      action: 'UPDATE_SETTINGS',
      module: 'SETTINGS',
      entityType: 'SYSTEM_SETTINGS',
      entityId: 'global',
      oldValue: oldSettings,
      newValue: settings,
      description: 'System-wide settings updated'
    });

    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
