const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { logAudit } = require('../utils/logger');
const { DEFAULT_GRANULAR_BY_ROLE, isAdminOrHeadOfIT } = require('../utils/rbac');

const SUPPORTED_ROLES = ['ADMIN', 'HEAD_OF_IT', 'IT_MANAGER', 'IT_OFFICER', 'EMPLOYEE', 'VIEWER', 'PORTAL_ACCESS'];

router.get('/', authenticate, authorize(['ADMIN', 'HEAD_OF_IT']), async (req, res) => {
  try {
    const dbPermissions = await prisma.rolePermission.findMany();
    const matrix = {};
    for (const role of SUPPORTED_ROLES) {
      const stored = dbPermissions.find((p) => p.role === role);
      const defaults = DEFAULT_GRANULAR_BY_ROLE[role] || DEFAULT_GRANULAR_BY_ROLE.EMPLOYEE;
      matrix[role] = stored ? { ...defaults, ...stored.permissions } : defaults;
    }
    res.json(matrix);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:role', authenticate, authorize(['ADMIN', 'HEAD_OF_IT']), async (req, res) => {
  try {
    const { role } = req.params;
    const { permissions } = req.body;

    if (!SUPPORTED_ROLES.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    if (isAdminOrHeadOfIT(role)) {
      permissions.MANAGE_USERS = true;
      permissions.MANAGE_ROLES = true;
      permissions.VIEW_AUDIT_LOG = true;
      permissions.CONFIGURE_SYSTEM = true;
      permissions.MANAGE_PURCHASE_PRICE = true;
      permissions.VIEW_FINANCIAL_VALUATION = true;
    }

    const updated = await prisma.rolePermission.upsert({
      where: { role },
      update: { permissions },
      create: { role, permissions },
    });

    await logAudit({
      req,
      action: 'MODIFY_PERMISSIONS',
      module: 'PERMISSIONS',
      entityType: 'ROLE',
      entityId: role,
      severity: 'CRITICAL',
      newValue: permissions,
      description: `Security role permissions modified for: ${role}`,
    });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
