const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient');
const { authenticate, authorize } = require('../middleware/auth.middleware');

// GET /api/permissions
// Get the entire permission matrix for all roles
router.get('/', authenticate, authorize(['ADMIN']), async (req, res) => {
  try {
    const roles = ['ADMIN', 'IT_OFFICER', 'VIEWER'];
    const dbPermissions = await prisma.rolePermission.findMany();
    
    const fullPermissions = {
      VIEW_ASSETS: true, CREATE_ASSETS: true, EDIT_ASSETS: true, DELETE_ASSETS: true,
      ASSIGN_ASSETS: true, TRANSFER_ASSETS: true, 
      UPLOAD_ASSET_IMAGES: true, REPLACE_ASSET_IMAGES: true, DELETE_ASSET_IMAGES: true,
      UPLOAD_ASSET_DOCUMENTS: true, DOWNLOAD_ASSET_DOCUMENTS: true, DELETE_ASSET_DOCUMENTS: true,
      BULK_IMPORT_ASSETS: true, EXPORT_REPORTS: true, VIEW_STORAGE_STATS: true,
      MANAGE_EMPLOYEES: true, MANAGE_DEPARTMENTS: true, MANAGE_LOCATIONS: true,
      MANAGE_USERS: true, MANAGE_ROLES: true, VIEW_AUDIT_LOG: true, EXPORT_AUDIT_LOG: true, CONFIGURE_SYSTEM: true
    };
    const defaultPermissions = {
      ADMIN: fullPermissions,
      IT_OFFICER: fullPermissions,
      VIEWER: fullPermissions
    };

    const matrix = {};
    for (const role of roles) {
      const stored = dbPermissions.find(p => p.role === role);
      matrix[role] = stored ? stored.permissions : defaultPermissions[role];
    }

    res.json(matrix);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/permissions/:role
// Update permissions for a specific role
router.put('/:role', authenticate, authorize(['ADMIN']), async (req, res) => {
  try {
    const { role } = req.params;
    const { permissions } = req.body;

    if (!['ADMIN', 'IT_OFFICER', 'VIEWER'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    // Ensure ADMIN always retains critical permissions
    if (role === 'ADMIN') {
      permissions.MANAGE_ROLES = true;
      permissions.VIEW_AUDIT_LOG = true;
      permissions.CONFIGURE_SYSTEM = true;
    }

    const updated = await prisma.rolePermission.upsert({
      where: { role },
      update: { permissions },
      create: { role, permissions }
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        userName: req.user.fullName || req.user.email,
        userRole: req.user.role,
        action: 'UPDATE_PERMISSIONS',
        module: 'Settings',
        entityType: 'Role',
        entityId: role,
        description: `Updated permissions for role ${role}`,
        ipAddress: req.ip || req.connection.remoteAddress
      }
    });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
