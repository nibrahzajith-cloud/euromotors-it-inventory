const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { authenticate, authorize, requireModule, requirePermission } = require('../middleware/auth.middleware');
const { logAudit } = require('../utils/logger');
const { MODULE_KEYS, DEFAULT_ROLE_MODULES, resolveModuleAccess, isAdminOrHeadOfIT } = require('../utils/rbac');

const generateTempPassword = () => crypto.randomBytes(4).toString('hex');

router.use(authenticate);

// List users (User Management or Help Desk staff listing for assignment)
router.get('/', authorize(['ADMIN', 'HEAD_OF_IT', 'IT_MANAGER', 'IT_OFFICER']), async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        status: true,
        employeeId: true,
        modulePermissions: true,
        createdAt: true,
        employee: {
          select: {
            id: true,
            employeeCode: true,
            fullName: true,
            department: { select: { id: true, name: true } },
            location: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const enriched = users.map((u) => ({
      ...u,
      moduleAccess: resolveModuleAccess(u),
    }));
    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get module definitions and default profiles
router.get('/module-defaults', requireModule('USER_MANAGEMENT'), async (req, res) => {
  res.json({
    moduleKeys: MODULE_KEYS,
    roleDefaults: DEFAULT_ROLE_MODULES,
  });
});

// Create user with role, optional employee link, and individual module toggles
router.post('/', requireModule('USER_MANAGEMENT'), requirePermission('MANAGE_USERS'), async (req, res) => {
  try {
    const { fullName, email, role, status, employeeId, modulePermissions, customPassword } = req.body;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) return res.status(400).json({ error: 'Email already exists' });

    if (employeeId) {
      const existingLinked = await prisma.user.findUnique({ where: { employeeId } });
      if (existingLinked) {
        return res.status(400).json({ error: 'Selected employee is already linked to another user account' });
      }
    }

    const tempPassword = customPassword && customPassword.trim() ? customPassword.trim() : generateTempPassword();
    const salt = await bcrypt.genSalt(8);
    const passwordHash = await bcrypt.hash(tempPassword, salt);

    const targetRole = role || 'EMPLOYEE';
    const cleanModules = modulePermissions && typeof modulePermissions === 'object'
      ? modulePermissions
      : DEFAULT_ROLE_MODULES[targetRole] || DEFAULT_ROLE_MODULES.EMPLOYEE;

    const user = await prisma.user.create({
      data: {
        fullName,
        email,
        passwordHash,
        role: targetRole,
        status: status || 'ACTIVE',
        employeeId: employeeId || null,
        modulePermissions: cleanModules,
        mustChangePassword: customPassword ? false : true,
      },
      include: {
        employee: { select: { id: true, employeeCode: true, fullName: true } },
      },
    });

    await logAudit({
      req,
      action: 'CREATE_USER',
      module: 'USERS',
      entityType: 'USER',
      entityId: user.id,
      newValue: { ...user, passwordHash: undefined },
      description: `Admin created new user: ${user.email} (${user.role})`,
    });

    res.status(201).json({
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        status: user.status,
        employeeId: user.employeeId,
        employee: user.employee,
        modulePermissions: user.modulePermissions,
        moduleAccess: resolveModuleAccess(user),
      },
      tempPassword,
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// Update user details, role, employee link, and module ON/OFF toggles
router.put('/:id', requireModule('USER_MANAGEMENT'), requirePermission('MANAGE_USERS'), async (req, res) => {
  try {
    const { id } = req.params;
    const { fullName, role, status, employeeId, modulePermissions } = req.body;

    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) return res.status(404).json({ error: 'User not found' });

    if (req.user.id === id && role && role !== targetUser.role) {
      return res.status(403).json({ error: 'You cannot change your own role' });
    }

    if (isAdminOrHeadOfIT(targetUser.role) && status === 'INACTIVE') {
      const activeAdmins = await prisma.user.count({
        where: { role: { in: ['ADMIN', 'HEAD_OF_IT'] }, status: 'ACTIVE' },
      });
      if (activeAdmins <= 1) {
        return res.status(403).json({ error: 'Cannot deactivate the last active Administrator / Head of IT' });
      }
    }

    if (employeeId && employeeId !== targetUser.employeeId) {
      const existingLinked = await prisma.user.findUnique({ where: { employeeId } });
      if (existingLinked && existingLinked.id !== id) {
        return res.status(400).json({ error: 'Selected employee is already linked to another user account' });
      }
    }

    const updateData = {
      fullName: fullName !== undefined ? fullName : targetUser.fullName,
      role: role !== undefined ? role : targetUser.role,
      status: status !== undefined ? status : targetUser.status,
      employeeId: employeeId !== undefined ? (employeeId || null) : targetUser.employeeId,
    };

    if (modulePermissions !== undefined) {
      updateData.modulePermissions = modulePermissions;
    } else if (role && role !== targetUser.role) {
      // Reset module toggles to new role defaults when role changes unless explicitly provided
      updateData.modulePermissions = DEFAULT_ROLE_MODULES[role] || DEFAULT_ROLE_MODULES.EMPLOYEE;
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      include: {
        employee: { select: { id: true, employeeCode: true, fullName: true } },
      },
    });

    await logAudit({
      req,
      action: 'UPDATE_USER_PERMISSIONS',
      module: 'USERS',
      entityType: 'USER',
      entityId: user.id,
      severity: modulePermissions !== undefined || (role && role !== targetUser.role) ? 'CRITICAL' : 'INFO',
      oldValue: {
        role: targetUser.role,
        status: targetUser.status,
        employeeId: targetUser.employeeId,
        modulePermissions: targetUser.modulePermissions,
      },
      newValue: {
        role: user.role,
        status: user.status,
        employeeId: user.employeeId,
        modulePermissions: user.modulePermissions,
      },
      description: `Updated user account and module access for ${user.email}`,
    });

    res.json({
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      status: user.status,
      employeeId: user.employeeId,
      employee: user.employee,
      modulePermissions: user.modulePermissions,
      moduleAccess: resolveModuleAccess(user),
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

router.delete('/:id', requireModule('USER_MANAGEMENT'), requirePermission('MANAGE_USERS'), async (req, res) => {
  try {
    const { id } = req.params;

    if (req.user.id === id) {
      return res.status(403).json({ error: 'You cannot delete your own account' });
    }

    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) return res.status(404).json({ error: 'User not found' });

    if (isAdminOrHeadOfIT(targetUser.role)) {
      const activeAdmins = await prisma.user.count({
        where: { role: { in: ['ADMIN', 'HEAD_OF_IT'] }, status: 'ACTIVE' },
      });
      if (activeAdmins <= 1) {
        return res.status(403).json({ error: 'Cannot delete the last active Admin' });
      }
    }

    await prisma.user.delete({ where: { id } });

    await logAudit({
      req,
      action: 'DELETE_USER',
      module: 'USERS',
      entityType: 'USER',
      entityId: id,
      oldValue: { email: targetUser.email, role: targetUser.role },
      description: `Admin deleted user: ${targetUser.email}`,
    });

    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

router.post('/:id/reset-password', requireModule('USER_MANAGEMENT'), requirePermission('MANAGE_USERS'), async (req, res) => {
  try {
    const { id } = req.params;
    const { customPassword } = req.body || {};
    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) return res.status(404).json({ error: 'User not found' });

    const tempPassword = customPassword && String(customPassword).trim().length >= 6
      ? String(customPassword).trim()
      : generateTempPassword();
    const salt = await bcrypt.genSalt(8);
    const passwordHash = await bcrypt.hash(tempPassword, salt);

    await prisma.user.update({
      where: { id },
      data: {
        passwordHash,
        mustChangePassword: targetUser.role === 'PORTAL_ACCESS' ? false : !(customPassword && String(customPassword).trim().length >= 6),
      },
    });

    await logAudit({
      req,
      action: 'RESET_PASSWORD',
      module: 'USERS',
      entityType: 'USER',
      entityId: id,
      description: `Admin reset password for user: ${targetUser.email}`,
    });

    res.json({ message: 'Password reset successfully', tempPassword });
  } catch (err) {
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

module.exports = router;
