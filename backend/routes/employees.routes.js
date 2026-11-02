const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient');
const { authenticate, requirePermission } = require('../middleware/auth.middleware');
const { generateEmployeeCode } = require('../utils/codeGenerator');
const { logAudit } = require('../utils/logger');

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
    const rawPayload = { ...req.body };

    // Duplicate prevention: check if active employee with same email already exists
    if (rawPayload.email && typeof rawPayload.email === 'string' && rawPayload.email.trim()) {
      const existing = await prisma.employee.findFirst({
        where: { email: rawPayload.email.trim(), status: 'ACTIVE' }
      });
      if (existing) {
        return res.status(409).json({ error: `An active employee with email "${rawPayload.email.trim()}" already exists (${existing.fullName}).` });
      }
    }

    // Debounce check: prevent double-clicks within 3 seconds for identical name + department
    if (rawPayload.fullName) {
      const recentDuplicate = await prisma.employee.findFirst({
        where: {
          fullName: rawPayload.fullName.trim(),
          departmentId: rawPayload.departmentId || null,
          createdAt: { gte: new Date(Date.now() - 3000) }
        }
      });
      if (recentDuplicate) {
        return res.status(200).json(recentDuplicate);
      }
    }

    const payload = {
      fullName: rawPayload.fullName ? String(rawPayload.fullName).trim() : '',
      email: rawPayload.email && String(rawPayload.email).trim() !== '' ? String(rawPayload.email).trim() : null,
      designation: rawPayload.designation && String(rawPayload.designation).trim() !== '' ? String(rawPayload.designation).trim() : null,
      phone: rawPayload.phone && String(rawPayload.phone).trim() !== '' ? String(rawPayload.phone).trim() : null,
      departmentId: rawPayload.departmentId && String(rawPayload.departmentId).trim() !== '' ? String(rawPayload.departmentId).trim() : null,
      locationId: rawPayload.locationId && String(rawPayload.locationId).trim() !== '' ? String(rawPayload.locationId).trim() : null,
      status: rawPayload.status || 'ACTIVE',
      avatarUrl: rawPayload.avatarUrl && String(rawPayload.avatarUrl).trim() !== '' ? String(rawPayload.avatarUrl).trim() : null,
    };
    if (rawPayload.employeeCode) {
      payload.employeeCode = String(rawPayload.employeeCode).trim();
    }

    let record;
    try {
      record = await prisma.$transaction(async (tx) => {
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
    } catch (createErr) {
      // If Prisma client doesn't recognize avatarUrl yet, create without it and update via raw SQL
      if (createErr.message && createErr.message.includes('avatarUrl')) {
        const { avatarUrl: pendingAvatar, ...safePayload } = payload;
        record = await prisma.$transaction(async (tx) => {
          if (!safePayload.employeeCode) {
            safePayload.employeeCode = await generateEmployeeCode(tx);
          }
          return await tx.employee.create({ 
            data: safePayload,
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

        if (pendingAvatar) {
          await prisma.$executeRawUnsafe(
            `UPDATE "Employee" SET "avatarUrl" = $1 WHERE id = $2`,
            pendingAvatar,
            record.id
          );
          record.avatarUrl = pendingAvatar;
        }
      } else {
        throw createErr;
      }
    }

    await logAudit({
      req,
      action: 'CREATE',
      module: 'EMPLOYEES',
      entityType: 'EMPLOYEE',
      entityId: record.id,
      entityCode: record.employeeCode,
      employeeOverride: { id: record.id, fullName: record.fullName, departmentName: record.department?.name },
      newValue: record,
      description: `Registered employee: ${record.fullName} (${record.employeeCode})`
    });

    res.status(201).json(record);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', requirePermission('MANAGE_EMPLOYEES'), async (req, res) => {
  try {
    const oldRecord = await prisma.employee.findUnique({
      where: { id: req.params.id },
      include: { department: true, location: true }
    });
    if (!oldRecord) return res.status(404).json({ error: 'Employee not found' });

    const raw = req.body || {};
    const dataToUpdate = {};

    if (raw.fullName !== undefined) dataToUpdate.fullName = String(raw.fullName).trim();
    if (raw.email !== undefined) dataToUpdate.email = raw.email && String(raw.email).trim() !== '' ? String(raw.email).trim() : null;
    if (raw.designation !== undefined) dataToUpdate.designation = raw.designation && String(raw.designation).trim() !== '' ? String(raw.designation).trim() : null;
    if (raw.phone !== undefined) dataToUpdate.phone = raw.phone && String(raw.phone).trim() !== '' ? String(raw.phone).trim() : null;
    if (raw.departmentId !== undefined) dataToUpdate.departmentId = raw.departmentId && String(raw.departmentId).trim() !== '' ? String(raw.departmentId).trim() : null;
    if (raw.locationId !== undefined) dataToUpdate.locationId = raw.locationId && String(raw.locationId).trim() !== '' ? String(raw.locationId).trim() : null;
    if (raw.status !== undefined) dataToUpdate.status = raw.status;

    const hasAvatar = raw.avatarUrl !== undefined;
    const cleanAvatar = hasAvatar ? (raw.avatarUrl && String(raw.avatarUrl).trim() !== '' ? String(raw.avatarUrl).trim() : null) : undefined;

    let record;
    try {
      record = await prisma.employee.update({ 
        where: { id: req.params.id }, 
        data: {
          ...dataToUpdate,
          ...(hasAvatar && { avatarUrl: cleanAvatar })
        },
        include: {
          department: true,
          location: true,
          assignedAssets: true,
          assignments: { where: { status: 'ACTIVE' } }
        }
      });
    } catch (prismaErr) {
      // Fallback if Prisma Client does not recognize avatarUrl
      if (prismaErr.message && prismaErr.message.includes('avatarUrl')) {
        record = await prisma.employee.update({ 
          where: { id: req.params.id }, 
          data: dataToUpdate,
          include: {
            department: true,
            location: true,
            assignedAssets: true,
            assignments: { where: { status: 'ACTIVE' } }
          }
        });

        if (hasAvatar) {
          await prisma.$executeRawUnsafe(
            `UPDATE "Employee" SET "avatarUrl" = $1 WHERE id = $2`,
            cleanAvatar,
            req.params.id
          );
          record.avatarUrl = cleanAvatar;
        }
      } else {
        throw prismaErr;
      }
    }

    await logAudit({
      req,
      action: 'UPDATE',
      module: 'EMPLOYEES',
      entityType: 'EMPLOYEE',
      entityId: record.id,
      entityCode: record.employeeCode,
      employeeOverride: { id: record.id, fullName: record.fullName, departmentName: record.department?.name },
      oldValue: oldRecord,
      newValue: record,
      description: `Updated employee profile: ${record.fullName} (${record.employeeCode})`
    });

    res.json(record);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Only Admin can delete
router.delete('/:id', requirePermission('MANAGE_EMPLOYEES'), async (req, res) => {
  try {
    const targetEmp = await prisma.employee.findUnique({ where: { id: req.params.id } });
    if (!targetEmp) return res.status(404).json({ error: 'Employee not found' });

    await prisma.$transaction([
      prisma.asset.updateMany({
        where: { assignedEmployeeId: req.params.id },
        data: { assignedEmployeeId: null, status: 'AVAILABLE' }
      }),
      prisma.assetAssignment.deleteMany({ where: { employeeId: req.params.id } }),
      prisma.supportTicket.deleteMany({ where: { employeeId: req.params.id } }),
      prisma.employee.delete({ where: { id: req.params.id } })
    ]);

    await logAudit({
      req,
      action: 'DELETE',
      module: 'EMPLOYEES',
      entityType: 'EMPLOYEE',
      entityId: req.params.id,
      entityCode: targetEmp.employeeCode,
      employeeOverride: { id: targetEmp.id, fullName: targetEmp.fullName },
      oldValue: targetEmp,
      severity: 'WARNING',
      description: `Deleted employee profile: ${targetEmp.fullName} (${targetEmp.employeeCode})`
    });

    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
