const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { logAudit } = require('../utils/logger');

const generateTempPassword = () => crypto.randomBytes(4).toString('hex');

// All User routes require ADMIN privileges, except GET which maybe IT_OFFICER can view
router.use(authenticate);

router.get('/', authorize(['ADMIN', 'IT_OFFICER']), async (req, res) => {
  try {
    const users = await prisma.user.findMany({ select: { id: true, fullName: true, email: true, role: true, status: true, createdAt: true } });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', authorize(['ADMIN']), async (req, res) => {
  try {
    const { fullName, email, role, status } = req.body;
    
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) return res.status(400).json({ error: 'Email already exists' });

    const tempPassword = generateTempPassword();
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(tempPassword, salt);

    const user = await prisma.user.create({ 
      data: { 
        fullName, 
        email, 
        passwordHash, 
        role: role || 'VIEWER', 
        status: status || 'ACTIVE',
        mustChangePassword: true
      } 
    });

    await logAudit({
      req,
      action: 'CREATE_USER',
      module: 'USERS',
      entityType: 'USER',
      entityId: user.id,
      newValue: user,
      description: `Admin created new user: ${user.email}`
    });
    
    res.status(201).json({ user, tempPassword });
  } catch (err) {
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

router.put('/:id', authorize(['ADMIN']), async (req, res) => {
  try {
    const { id } = req.params;
    const { fullName, role, status } = req.body;
    
    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) return res.status(404).json({ error: 'User not found' });

    if (req.user.id === id && role && role !== targetUser.role) {
      return res.status(403).json({ error: 'You cannot change your own role' });
    }

    if (targetUser.role === 'ADMIN' && status === 'INACTIVE') {
       const activeAdmins = await prisma.user.count({ where: { role: 'ADMIN', status: 'ACTIVE' } });
       if (activeAdmins <= 1) {
          return res.status(403).json({ error: 'Cannot deactivate the last active Admin' });
       }
    }

    const user = await prisma.user.update({ 
      where: { id }, 
      data: { fullName, role, status } 
    });

    await logAudit({
      req,
      action: 'UPDATE_USER',
      module: 'USERS',
      entityType: 'USER',
      entityId: user.id,
      oldValue: targetUser,
      newValue: user,
      description: `Admin updated user: ${user.email}`
    });

    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

router.delete('/:id', authorize(['ADMIN']), async (req, res) => {
  try {
    const { id } = req.params;
    
    if (req.user.id === id) {
      return res.status(403).json({ error: 'You cannot delete your own account' });
    }

    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) return res.status(404).json({ error: 'User not found' });

    if (targetUser.role === 'ADMIN') {
       const activeAdmins = await prisma.user.count({ where: { role: 'ADMIN', status: 'ACTIVE' } });
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
      oldValue: targetUser,
      description: `Admin deleted user: ${targetUser.email}`
    });

    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

router.post('/:id/reset-password', authorize(['ADMIN']), async (req, res) => {
  try {
    const { id } = req.params;
    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) return res.status(404).json({ error: 'User not found' });

    const tempPassword = generateTempPassword();
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(tempPassword, salt);

    await prisma.user.update({
      where: { id },
      data: { passwordHash, mustChangePassword: true }
    });

    await logAudit({
      req,
      action: 'RESET_PASSWORD',
      module: 'USERS',
      entityType: 'USER',
      entityId: id,
      description: `Admin reset password for user: ${targetUser.email}`
    });

    res.json({ message: 'Password reset successfully', tempPassword });
  } catch (err) {
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

module.exports = router;
