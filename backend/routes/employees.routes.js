const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient');
const { authenticate, requirePermission } = require('../middleware/auth.middleware');
const { generateEmployeeCode } = require('../utils/codeGenerator');
const { logAudit } = require('../utils/logger');
const memoryCache = require('../utils/cache');
const crypto = require('crypto');
const { computeEmployeeValuationSummary } = require('../utils/marketValuation');

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
        assignments: {
          where: { status: 'ACTIVE' },
          include: { asset: true }
        }
      }
    });

    // Compute valuation metrics for each employee based on current assigned hardware
    const enrichedRecords = records.map(emp => {
      // Collect all actively assigned assets (deduplicated)
      const assetMap = new Map();
      if (Array.isArray(emp.assignedAssets)) {
        emp.assignedAssets.forEach(ast => {
          if (ast && (ast.status === 'ASSIGNED' || !ast.status)) {
            assetMap.set(ast.id, ast);
          }
        });
      }
      if (Array.isArray(emp.assignments)) {
        emp.assignments.forEach(asg => {
          if (asg && asg.asset && asg.status === 'ACTIVE') {
            assetMap.set(asg.asset.id, asg.asset);
          }
        });
      }

      const activeList = Array.from(assetMap.values());
      const valSummary = computeEmployeeValuationSummary(activeList);

      return {
        ...emp,
        assignedAssetsCount: activeList.length,
        totalAssetValueLKR: valSummary.totalValueLKR,
        formattedAssetValue: valSummary.formattedTotalLKR,
        valuationSummary: valSummary
      };
    });

    memoryCache.set('employees:all', enrichedRecords, 30);
    res.json(enrichedRecords);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/employees/:id/handover — Comprehensive live data for Employee IT Asset Handover Document
router.get('/:id/handover', async (req, res) => {
  try {
    const { id } = req.params;
    const employee = await prisma.employee.findUnique({
      where: { id },
      include: {
        department: true,
        location: true
      }
    });

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // 1. Fetch active assignments for this employee
    const activeAssignments = await prisma.assetAssignment.findMany({
      where: {
        employeeId: id,
        status: 'ACTIVE'
      },
      include: {
        asset: {
          include: {
            department: true,
            location: true
          }
        }
      },
      orderBy: { assignedDate: 'desc' }
    });

    // 2. Fetch directly assigned assets where assignedEmployeeId = employee.id
    const directlyAssignedAssets = await prisma.asset.findMany({
      where: {
        assignedEmployeeId: id,
        status: { not: 'AVAILABLE' }
      },
      include: {
        department: true,
        location: true
      }
    });

    // 3. Merge and deduplicate assets
    const assetMap = new Map();

    // Add directly assigned assets first
    for (const ast of directlyAssignedAssets) {
      assetMap.set(ast.id, {
        id: ast.id,
        assetCode: ast.assetCode,
        deviceType: ast.deviceType,
        brand: ast.brand || '',
        model: ast.model || '',
        serialNumber: ast.serialNumber || 'N/A',
        condition: ast.condition || 'Good',
        status: ast.status,
        assignedDate: ast.updatedAt || ast.createdAt,
        remarks: ast.remarks || '',
        accessories: Array.isArray(ast.accessories) ? ast.accessories : [],
        assignmentId: null
      });
    }

    // Overlay or add assets from active assignments (contains precise assignment date & accessories)
    for (const asg of activeAssignments) {
      if (asg.asset && asg.asset.status !== 'AVAILABLE') {
        const ast = asg.asset;
        assetMap.set(ast.id, {
          id: ast.id,
          assetCode: ast.assetCode,
          deviceType: ast.deviceType,
          brand: ast.brand || '',
          model: ast.model || '',
          serialNumber: ast.serialNumber || 'N/A',
          condition: ast.condition || 'Good',
          status: ast.status,
          assignedDate: asg.assignedDate || ast.updatedAt,
          remarks: asg.remarks || ast.remarks || '',
          accessories: Array.isArray(asg.accessories) && asg.accessories.length > 0
            ? asg.accessories
            : (Array.isArray(ast.accessories) ? ast.accessories : []),
          assignmentId: asg.id
        });
      }
    }

    const assignedAssets = Array.from(assetMap.values()).sort((a, b) =>
      (a.assetCode || '').localeCompare(b.assetCode || '', undefined, { numeric: true })
    );

    // Compute comprehensive valuation in Sri Lankan Rupees (LKR)
    const valuationSummary = computeEmployeeValuationSummary(assignedAssets);

    const now = new Date();
    const dateCode = now.toISOString().slice(0, 10).replace(/-/g, '');
    const cleanEmpCode = (employee.employeeCode || 'EMP').replace(/[^A-Za-z0-9]/g, '');
    const handoverReference = `EM-HO-${cleanEmpCode}-${dateCode}`;

    res.json({
      employee,
      assignedAssets: valuationSummary.enrichedAssets,
      assetCount: valuationSummary.totalAssignedAssets,
      valuationSummary,
      handoverReference,
      generatedAt: now.toISOString()
    });
  } catch (err) {
    console.error('Error fetching employee handover data:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch employee handover records.' });
  }
});

// GET /api/employees/:id
router.get('/:id', async (req, res) => {
  try {
    const record = await prisma.employee.findUnique({
      where: { id: req.params.id },
      include: {
        department: true,
        location: true,
        assignedAssets: true,
        assignments: {
          where: { status: 'ACTIVE' },
          include: { asset: true }
        }
      }
    });
    if (!record) return res.status(404).json({ error: 'Employee not found' });
    res.json(record);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin and IT Officer can modify
router.post('/', requirePermission('MANAGE_EMPLOYEES'), async (req, res) => {
  const tStart = Date.now();
  console.log('[PERF] POST /employees started');
  try {
    const rawPayload = { ...req.body };

    const debounceKey = `emp_debounce:${rawPayload.fullName?.trim()}:${rawPayload.departmentId || ''}`;
    const cachedRecent = memoryCache.get(debounceKey);
    if (cachedRecent) {
      return res.status(200).json(cachedRecent);
    }

    // Execute duplicate email check and employee code generation concurrently
    const [existing, generatedCode] = await Promise.all([
      (rawPayload.email && typeof rawPayload.email === 'string' && rawPayload.email.trim())
        ? prisma.employee.findFirst({
          where: { email: rawPayload.email.trim(), status: 'ACTIVE' },
          select: { id: true, fullName: true }
        })
        : Promise.resolve(null),
      (rawPayload.employeeCode && String(rawPayload.employeeCode).trim() !== '')
        ? Promise.resolve(String(rawPayload.employeeCode).trim())
        : generateEmployeeCode(prisma)
    ]);

    if (existing) {
      return res.status(409).json({ error: `An active employee with email "${rawPayload.email.trim()}" already exists (${existing.fullName}).` });
    }

    const employeeCode = generatedCode;

    const deptId = rawPayload.departmentId && String(rawPayload.departmentId).trim() !== '' ? String(rawPayload.departmentId).trim() : null;
    const locId = rawPayload.locationId && String(rawPayload.locationId).trim() !== '' ? String(rawPayload.locationId).trim() : null;
    const avatarUrl = rawPayload.avatarUrl && String(rawPayload.avatarUrl).trim() !== '' ? String(rawPayload.avatarUrl).trim() : null;

    const validDeptConnect = deptId ? { connect: { id: deptId } } : null;
    const validLocConnect = locId ? { connect: { id: locId } } : null;

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
    const t4 = Date.now();
    try {
      record = await prisma.employee.create({
        data: {
          ...dataToCreate,
          employeeCode
        },
        include: {
          department: true,
          location: true
        }
      });
      console.log(`[PERF] prisma.employee.create took ${Date.now() - t4}ms`);
    } catch (createErr) {
      // If code collision occurred, retry with freshly incremented code
      if (createErr.code === 'P2002' && (createErr.message?.includes('employeeCode') || createErr.meta?.target?.includes('employeeCode'))) {
        employeeCode = await generateEmployeeCode(prisma);
        record = await prisma.employee.create({
          data: {
            ...dataToCreate,
            employeeCode
          },
          include: {
            department: true,
            location: true
          }
        });
      } else {
        throw createErr;
      }
    }

    record.assignedAssets = [];
    record.assignments = [];

    const t5 = Date.now();
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
    console.log(`[PERF] logAudit took ${Date.now() - t5}ms`);

    memoryCache.set(debounceKey, record, 3);
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
