const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient');
const { authenticate, requirePermission } = require('../middleware/auth.middleware');
const { generateEmployeeCode } = require('../utils/codeGenerator');
const { logAudit } = require('../utils/logger');
const memoryCache = require('../utils/cache');
const crypto = require('crypto');

router.use(authenticate);

// Everyone can view employees
router.get('/', async (req, res) => {
  try {
    if (req.query.refresh !== 'true') {
      const cached = memoryCache.get('employees:all');
      if (cached) return res.json(cached);
    }
    const records = await prisma.employee.findMany({ 
      include: { 
        department: true, 
        location: true,
        assignedAssets: true,
        assignments: { where: { status: 'ACTIVE' } }
      } 
    });
    memoryCache.set('employees:all', records, 30);
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

    const deptId = rawPayload.departmentId && String(rawPayload.departmentId).trim() !== '' ? String(rawPayload.departmentId).trim() : null;
    const locId = rawPayload.locationId && String(rawPayload.locationId).trim() !== '' ? String(rawPayload.locationId).trim() : null;
    const avatarUrl = rawPayload.avatarUrl && String(rawPayload.avatarUrl).trim() !== '' ? String(rawPayload.avatarUrl).trim() : null;

    // Verify deptId and locId exist to ensure clean relation linking
    let validDeptConnect = null;
    if (deptId) {
      const dept = await prisma.department.findUnique({ where: { id: deptId }, select: { id: true } });
      if (dept) validDeptConnect = { connect: { id: dept.id } };
    }

    let validLocConnect = null;
    if (locId) {
      const loc = await prisma.location.findUnique({ where: { id: locId }, select: { id: true } });
      if (loc) validLocConnect = { connect: { id: loc.id } };
    }

    // Build canonical relation-connected data object
    const dataToCreate = {
      fullName: rawPayload.fullName ? String(rawPayload.fullName).trim() : '',
      email: rawPayload.email && String(rawPayload.email).trim() !== '' ? String(rawPayload.email).trim() : null,
      designation: rawPayload.designation && String(rawPayload.designation).trim() !== '' ? String(rawPayload.designation).trim() : null,
      phone: rawPayload.phone && String(rawPayload.phone).trim() !== '' ? String(rawPayload.phone).trim() : null,
      status: rawPayload.status || 'ACTIVE',
      ...(avatarUrl ? { avatarUrl } : {}),
      ...(validDeptConnect ? { department: validDeptConnect } : {}),
      ...(validLocConnect ? { location: validLocConnect } : {})
    };

    let record;
    try {
      record = await prisma.$transaction(async (tx) => {
        const employeeCode = rawPayload.employeeCode && String(rawPayload.employeeCode).trim() !== '' 
          ? String(rawPayload.employeeCode).trim() 
          : await generateEmployeeCode(tx);

        return await tx.employee.create({ 
          data: {
            ...dataToCreate,
            employeeCode
          },
          include: {
            department: true,
            location: true,
            assignedAssets: true,
            assignments: { where: { status: 'ACTIVE' } }
          }
        });
      }, {
        maxWait: 5000,
        timeout: 10000
      });
    } catch (createErr) {
      console.warn('Prisma create standard invocation failed, attempting resilient fallback:', createErr.message);

      const employeeCode = rawPayload.employeeCode && String(rawPayload.employeeCode).trim() !== '' 
        ? String(rawPayload.employeeCode).trim() 
        : await generateEmployeeCode(prisma);

      try {
        record = await prisma.employee.create({
          data: {
            ...dataToCreate,
            employeeCode
          },
          include: {
            department: true,
            location: true,
            assignedAssets: true,
            assignments: { where: { status: 'ACTIVE' } }
          }
        });
      } catch (fallbackErr) {
        console.error('All standard Prisma create attempts failed:', fallbackErr);
        throw fallbackErr;
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

    memoryCache.delPrefix('employees');
    memoryCache.delPrefix('dashboard');
    res.status(201).json(record);
  } catch (err) {
    console.error('Error creating employee:', err);
    let userMsg = err.message || 'Failed to create employee';
    if (userMsg.includes('Unique constraint failed') && userMsg.includes('employeeCode')) {
      userMsg = 'Employee code collision detected. Please try saving again.';
    } else if (userMsg.includes('Unique constraint failed') && userMsg.includes('email')) {
      userMsg = 'An employee with this email address already exists in the system.';
    }
    res.status(500).json({ error: userMsg });
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
    if (raw.status !== undefined) dataToUpdate.status = raw.status;

    const hasDept = raw.departmentId !== undefined;
    const deptId = hasDept ? (raw.departmentId && String(raw.departmentId).trim() !== '' ? String(raw.departmentId).trim() : null) : undefined;

    const hasLoc = raw.locationId !== undefined;
    const locId = hasLoc ? (raw.locationId && String(raw.locationId).trim() !== '' ? String(raw.locationId).trim() : null) : undefined;

    const hasAvatar = raw.avatarUrl !== undefined;
    const cleanAvatar = hasAvatar ? (raw.avatarUrl && String(raw.avatarUrl).trim() !== '' ? String(raw.avatarUrl).trim() : null) : undefined;

    // Use canonical Prisma relation update syntax
    const relationData = {
      ...dataToUpdate,
      ...(hasAvatar ? { avatarUrl: cleanAvatar } : {}),
      ...(hasDept ? (deptId ? { department: { connect: { id: deptId } } } : { department: { disconnect: true } }) : {}),
      ...(hasLoc ? (locId ? { location: { connect: { id: locId } } } : { location: { disconnect: true } }) : {})
    };

    let record;
    try {
      record = await prisma.employee.update({ 
        where: { id: req.params.id }, 
        data: relationData,
        include: {
          department: true,
          location: true,
          assignedAssets: true,
          assignments: { where: { status: 'ACTIVE' } }
        }
      });
    } catch (prismaErr) {
      console.warn('Prisma employee update relation syntax threw, using resilient fallback:', prismaErr.message);

      try {
        // Fallback 1: try fields with safe relation linking
        record = await prisma.employee.update({ 
          where: { id: req.params.id }, 
          data: {
            ...dataToUpdate,
            ...(hasAvatar ? { avatarUrl: cleanAvatar } : {})
          },
          include: {
            department: true,
            location: true,
            assignedAssets: true,
            assignments: { where: { status: 'ACTIVE' } }
          }
        });
        if (hasDept) {
          if (deptId) {
            record = await prisma.employee.update({ where: { id: req.params.id }, data: { department: { connect: { id: deptId } } } });
          } else {
            record = await prisma.employee.update({ where: { id: req.params.id }, data: { department: { disconnect: true } } });
          }
        }
        if (hasLoc) {
          if (locId) {
            record = await prisma.employee.update({ where: { id: req.params.id }, data: { location: { connect: { id: locId } } } });
          } else {
            record = await prisma.employee.update({ where: { id: req.params.id }, data: { location: { disconnect: true } } });
          }
        }
      } catch (scalarErr) {
        // Fallback 2: Direct raw SQL update
        await prisma.$executeRawUnsafe(
          `UPDATE "Employee" 
           SET "fullName" = COALESCE($1, "fullName"),
               "email" = $2,
               "designation" = $3,
               "phone" = $4,
               "departmentId" = $5,
               "locationId" = $6,
               "status" = COALESCE($7::"GeneralStatus", "status"),
               "avatarUrl" = $8,
               "updatedAt" = NOW()
           WHERE id = $9`,
          dataToUpdate.fullName || null,
          dataToUpdate.email !== undefined ? dataToUpdate.email : oldRecord.email,
          dataToUpdate.designation !== undefined ? dataToUpdate.designation : oldRecord.designation,
          dataToUpdate.phone !== undefined ? dataToUpdate.phone : oldRecord.phone,
          deptId !== undefined ? deptId : oldRecord.departmentId,
          locId !== undefined ? locId : oldRecord.locationId,
          dataToUpdate.status || null,
          cleanAvatar !== undefined ? cleanAvatar : oldRecord.avatarUrl,
          req.params.id
        );

        record = await prisma.employee.findUnique({
          where: { id: req.params.id },
          include: {
            department: true,
            location: true,
            assignedAssets: true,
            assignments: { where: { status: 'ACTIVE' } }
          }
        });
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

    memoryCache.delPrefix('employees');
    memoryCache.delPrefix('dashboard');
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

    memoryCache.delPrefix('employees');
    memoryCache.delPrefix('dashboard');
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
