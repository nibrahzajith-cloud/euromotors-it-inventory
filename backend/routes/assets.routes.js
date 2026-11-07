const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const prisma = require('../prismaClient');
const { authenticate, authorize, requirePermission } = require('../middleware/auth.middleware');
const { logAudit, logAssetTimeline } = require('../utils/logger');
const { generateAssetCode, generateEmployeeCode } = require('../utils/codeGenerator');

const MAC_REGEX = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
const IPV4_REGEX = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
const VALID_CONDITIONS = ['NEW', 'GOOD', 'FAIR', 'POOR', 'DAMAGED'];
const VALID_WARRANTY_STATUSES = ['ACTIVE', 'EXPIRED', 'NONE', 'EXTENDED'];

router.get('/template/download', (req, res) => {
  try {
    const templatePath = path.join(__dirname, '../../templates/Bulk Upload Templates.xlsx');
    if (!fs.existsSync(templatePath)) {
      return res.status(404).json({ error: 'Master template file not found.' });
    }
    res.download(templatePath, 'Bulk Upload Templates.xlsx');
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/guide/download', (req, res) => {
  try {
    const guidePath = path.join(__dirname, '../../templates/Bulk Upload Guide.xlsx');
    if (!fs.existsSync(guidePath)) {
      return res.status(404).json({ error: 'Bulk Upload Guide file not found.' });
    }
    res.download(guidePath, 'Bulk Upload Guide.xlsx');
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const records = await prisma.asset.findMany({ 
      include: { 
        location: true, 
        department: true, 
        assignedEmployee: true,
        assignments: {
          include: {
            employee: {
              include: { department: true, location: true }
            }
          },
          orderBy: { assignedDate: 'desc' }
        }
      } 
    });
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/code/:code', async (req, res) => {
  try {
    const cleanCode = req.params.code ? req.params.code.trim() : '';
    const record = await prisma.asset.findFirst({
      where: { 
        assetCode: {
          equals: cleanCode,
          mode: 'insensitive'
        }
      },
      include: { 
        location: true, 
        department: true, 
        assignedEmployee: true,
        assignments: {
          include: {
            employee: {
              include: { department: true, location: true }
            }
          },
          orderBy: { assignedDate: 'desc' }
        }
      }
    });
    if (!record) return res.status(404).json({ error: 'Asset not found in database.' });
    res.json(record);
  } catch (err) {
      res.status(500).json({ error: err.message });
  }
});


// GET /assets/:id — Fetch single asset by UUID (performance optimization for edit form)
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    // Basic UUID format check to avoid conflicts with named routes
    if (!/^[0-9a-f-]{36}$/i.test(id)) {
      return res.status(400).json({ error: 'Invalid asset ID format' });
    }
    const record = await prisma.asset.findUnique({
      where: { id },
      include: {
        location: true,
        department: true,
        assignedEmployee: true,
        assignments: {
          include: {
            employee: {
              include: { department: true, location: true }
            }
          },
          orderBy: { assignedDate: 'desc' }
        }
      }
    });
    if (!record) return res.status(404).json({ error: 'Asset not found' });
    res.json(record);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', requirePermission('CREATE_ASSETS'), async (req, res) => {
  try {
    const payload = { ...req.body };
    if (payload.serialNumber && typeof payload.serialNumber === 'string') {
      payload.serialNumber = payload.serialNumber.trim();
      if (payload.serialNumber === '') payload.serialNumber = null;
    }

    if (!payload.deviceType) return res.status(400).json({ error: 'Device Type is mandatory.' });
    const REQUIRES_MODEL = ['Laptop', 'Desktop', 'Tablet', 'Phone', 'Server', 'Router', 'Switch', 'Printer', 'Photocopier'];
    if (REQUIRES_MODEL.includes(payload.deviceType) && !payload.model) {
      return res.status(400).json({ error: `Model is mandatory for device type: ${payload.deviceType}` });
    }

    if (payload.macAddress && typeof payload.macAddress === 'string' && payload.macAddress.trim()) {
      payload.macAddress = payload.macAddress.trim();
      if (!MAC_REGEX.test(payload.macAddress)) {
        return res.status(400).json({ error: 'Invalid MAC Address format. Example: 00:1B:44:11:3A:B7 or 00-1B-44-11-3A-B7' });
      }
    }
    if (payload.ipAddress && typeof payload.ipAddress === 'string' && payload.ipAddress.trim()) {
      payload.ipAddress = payload.ipAddress.trim();
      if (!IPV4_REGEX.test(payload.ipAddress)) {
        return res.status(400).json({ error: 'Invalid IP Address format. Example: 192.168.1.50' });
      }
    }
    if (payload.condition && typeof payload.condition === 'string' && payload.condition.trim()) {
      const condUpper = payload.condition.trim().toUpperCase();
      if (!VALID_CONDITIONS.includes(condUpper)) {
        return res.status(400).json({ error: `Invalid Condition. Allowed values: ${VALID_CONDITIONS.join(', ')}` });
      }
    }
    if (payload.warrantyStatus && typeof payload.warrantyStatus === 'string' && payload.warrantyStatus.trim()) {
      const wsUpper = payload.warrantyStatus.trim().toUpperCase();
      if (!VALID_WARRANTY_STATUSES.includes(wsUpper)) {
        return res.status(400).json({ error: `Invalid Warranty Status. Allowed values: ${VALID_WARRANTY_STATUSES.join(', ')}` });
      }
    }
    
    // AssignmentType Validation
    let aType = payload.assignmentType;
    if (!aType) {
      aType = (!payload.assignedEmployeeId && (payload.status === 'AVAILABLE' || !payload.status)) ? 'STORE' : 'EMPLOYEE';
      payload.assignmentType = aType;
    }
    if (aType === 'DEPARTMENT') {
      if (!payload.departmentId) return res.status(400).json({ error: 'Department is mandatory for DEPARTMENT assignment type.' });
      payload.assignedEmployeeId = null;
    } else if (aType === 'LOCATION') {
      if (!payload.locationId) return res.status(400).json({ error: 'Location is mandatory for LOCATION assignment type.' });
      payload.assignedEmployeeId = null;
    } else if (aType === 'SHARED') {
      if (!payload.departmentId && !payload.locationId) return res.status(400).json({ error: 'Department or Location is required for SHARED assignment type.' });
      payload.assignedEmployeeId = null;
    } else if (aType === 'STORE') {
      if (!payload.locationId) return res.status(400).json({ error: 'Location is mandatory for STORE assignment type.' });
      payload.assignedEmployeeId = null;
    }
    
    // Auto-set status if assigned
    if (payload.assignedEmployeeId || (aType !== 'STORE' && (payload.departmentId || payload.locationId))) {
      if (!payload.status || payload.status === 'AVAILABLE') {
        payload.status = 'ASSIGNED';
      }
    }

    // Sanitize relational IDs
    payload.departmentId = (payload.departmentId && String(payload.departmentId).trim() !== '') ? String(payload.departmentId).trim() : null;
    payload.locationId = (payload.locationId && String(payload.locationId).trim() !== '') ? String(payload.locationId).trim() : null;
    payload.assignedEmployeeId = (payload.assignedEmployeeId && String(payload.assignedEmployeeId).trim() !== '') ? String(payload.assignedEmployeeId).trim() : null;

    // Enforce required field defaults
    payload.warrantyStatus = (payload.warrantyStatus && typeof payload.warrantyStatus === 'string' && payload.warrantyStatus.trim())
      ? payload.warrantyStatus.trim()
      : 'Active';
    payload.condition = (payload.condition && typeof payload.condition === 'string' && payload.condition.trim())
      ? payload.condition.trim()
      : 'New';
    payload.status = payload.status || 'AVAILABLE';

    // Pre-check Serial Number uniqueness
    if (payload.serialNumber) {
      const existingSerial = await prisma.asset.findUnique({
        where: { serialNumber: payload.serialNumber },
        select: { id: true, assetCode: true }
      });
      if (existingSerial) {
        return res.status(409).json({
          error: `The Serial Number "${payload.serialNumber}" already exists in the system (assigned to ${existingSerial.assetCode}). Use a unique serial number.`,
          field: 'serialNumber'
        });
      }
    }

    // Inspect Asset Code: differentiate user-specified code vs auto-generation
    const rawAssetCode = payload.assetCode;
    const isAutoGenerate = 
      !rawAssetCode || 
      typeof rawAssetCode !== 'string' || 
      rawAssetCode.trim() === '' || 
      /^auto-generated/i.test(rawAssetCode.trim()) ||
      rawAssetCode.trim().toLowerCase() === 'n/a' ||
      rawAssetCode.trim().toLowerCase() === 'null';

    let explicitUserCode = null;
    if (!isAutoGenerate) {
      explicitUserCode = rawAssetCode.trim();
      const existingCode = await prisma.asset.findUnique({
        where: { assetCode: explicitUserCode },
        select: { id: true }
      });
      if (existingCode) {
        return res.status(409).json({
          error: `The Asset Code "${explicitUserCode}" already exists in the system. Use a unique identifier.`,
          field: 'assetCode'
        });
      }
    }

    // Collision-Safe Asset Creation Loop
    let record = null;
    const MAX_RETRIES = 10;
    let attempt = 0;
    let lastError = null;

    while (attempt < MAX_RETRIES) {
      attempt++;
      try {
        record = await prisma.$transaction(async (tx) => {
          let codeToAssign = explicitUserCode;

          if (isAutoGenerate || !codeToAssign) {
            codeToAssign = await generateAssetCode(tx);

            // Verify uniqueness in current transaction
            let exists = await tx.asset.findUnique({
              where: { assetCode: codeToAssign },
              select: { id: true }
            });

            // If collision found, increment sequence safely
            let counter = 0;
            while (exists && counter < 100) {
              counter++;
              const match = codeToAssign.match(/^([A-Za-z0-9_-]+?)-(\d+)$/);
              if (match) {
                const pfx = match[1];
                const nextNum = parseInt(match[2], 10) + 1;
                const padLen = match[2].length;
                codeToAssign = `${pfx}-${nextNum.toString().padStart(padLen, '0')}`;
              } else {
                codeToAssign = `${codeToAssign}-${counter}`;
              }
              exists = await tx.asset.findUnique({
                where: { assetCode: codeToAssign },
                select: { id: true }
              });
            }
          }

          const assetData = {
            ...payload,
            assetCode: codeToAssign
          };

          const newRecord = await tx.asset.create({ data: assetData });

          // Create assignment history if assigned to employee during creation
          if (payload.assignedEmployeeId) {
            await tx.assetAssignment.create({
              data: {
                assetId: newRecord.id,
                employeeId: payload.assignedEmployeeId,
                status: 'ACTIVE',
                remarks: 'Assigned during asset creation',
                accessories: payload.accessories || []
              }
            });
          }

          return newRecord;
        }, {
          maxWait: 5000,
          timeout: 10000
        });

        // Succeeded! Break loop
        break;
      } catch (err) {
        lastError = err;
        const msg = err.message || '';
        const target = err.meta?.target;

        const isSerialCollision = 
          (Array.isArray(target) && target.includes('serialNumber')) ||
          (typeof target === 'string' && target.includes('serialNumber')) ||
          msg.includes('serialNumber') || 
          msg.includes('Asset_serialNumber_key');

        if (isSerialCollision) {
          return res.status(409).json({
            error: `The Serial Number "${payload.serialNumber}" already exists in the system. Hardware serial numbers must be unique.`,
            field: 'serialNumber'
          });
        }

        const isAssetCodeCollision = 
          (Array.isArray(target) && target.includes('assetCode')) ||
          (typeof target === 'string' && target.includes('assetCode')) ||
          msg.includes('assetCode') || 
          msg.includes('Asset_assetCode_key');

        if (isAssetCodeCollision) {
          if (explicitUserCode) {
            return res.status(409).json({
              error: `The Asset Code "${explicitUserCode}" already exists in the system. Use a unique identifier.`,
              field: 'assetCode'
            });
          }
          // Concurrent collision on auto-generated code — jitter and retry
          console.warn(`[Asset Creation] Race condition: Asset code collision on attempt ${attempt}. Retrying with next sequence code...`);
          await new Promise(r => setTimeout(r, 40 * attempt + Math.floor(Math.random() * 40)));
          continue;
        }

        // For non-collision errors, break immediately
        break;
      }
    }

    if (!record) {
      console.error('Asset creation failed after retries:', lastError);
      let clientMsg = 'Failed to create asset.';
      if (lastError?.message?.includes('Foreign key constraint failed')) {
        clientMsg = 'Invalid location, department, or employee reference selected.';
      } else if (lastError?.message) {
        clientMsg = lastError.message;
      }
      return res.status(500).json({ error: clientMsg });
    }

    // Log Audit
    await logAudit({
      req,
      action: 'CREATE',
      module: 'ASSETS',
      entityType: 'ASSET',
      entityId: record.id,
      entityCode: record.assetCode,
      newValue: record,
      description: `Asset created: ${record.assetCode}`
    });

    // Log Timeline
    await logAssetTimeline({
      assetId: record.id,
      assetCode: record.assetCode,
      eventType: 'CREATED',
      title: 'Asset Created',
      description: `Asset initialized in system: ${record.assetCode}`,
      newStatus: record.status,
      performedById: req.user.id,
      performedByName: req.user.fullName
    });

    res.status(201).json(record);
  } catch (err) {
    console.error('Asset creation route exception:', err);
    res.status(500).json({ error: err.message || 'Server error creating asset.' });
  }
});



router.get('/export/excel', async (req, res) => {
  try {
    const templatePath = path.join(__dirname, '../../templates/Bulk Upload Templates.xlsx');
    if (!fs.existsSync(templatePath)) {
      return res.status(404).json({ error: 'Master template file not found.' });
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(templatePath);

    const ws1 = workbook.getWorksheet('IT Inventory') || workbook.worksheets[0];
    
    // Clear data rows starting at row 2 while keeping headers and formatting
    const totalRows = ws1.rowCount;
    for (let r = totalRows; r >= 2; r--) {
      ws1.spliceRows(r, 1);
    }

    const assets = await prisma.asset.findMany({
      include: {
        location: true,
        department: true,
        assignedEmployee: true
      },
      orderBy: { createdAt: 'asc' }
    });

    const formatAssignmentType = (type) => {
      switch ((type || '').toUpperCase()) {
        case 'EMPLOYEE': return 'Employee';
        case 'LOCATION': return 'Location';
        case 'DEPARTMENT': return 'Department';
        case 'SHARED': return 'Shared';
        case 'STORE':
        case 'IN STORE': return 'In Store';
        default: return type || 'In Store';
      }
    };

    const formatDate = (dt) => {
      if (!dt) return '';
      try {
        const d = new Date(dt);
        if (isNaN(d.getTime())) return '';
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const yyyy = d.getFullYear();
        return `${mm}/${dd}/${yyyy}`;
      } catch (e) {
        return '';
      }
    };

    const sections = ['EMPLOYEE', 'LOCATION', 'DEPARTMENT', 'SHARED', 'STORE'];
    const grouped = { EMPLOYEE: [], LOCATION: [], DEPARTMENT: [], SHARED: [], STORE: [] };

    assets.forEach(a => {
      const type = (a.assignmentType || 'STORE').toUpperCase();
      if (grouped[type]) {
        grouped[type].push(a);
      } else {
        grouped.STORE.push(a);
      }
    });

    // Sort within each group by assetCode naturally (handles padded numbers correctly)
    sections.forEach(secKey => {
      grouped[secKey].sort((a, b) => {
        const codeA = a.assetCode || '';
        const codeB = b.assetCode || '';
        return codeA.localeCompare(codeB, undefined, { numeric: true, sensitivity: 'base' });
      });
    });

    let isFirstSection = true;

    sections.forEach(secKey => {
      const list = grouped[secKey];
      if (!list || list.length === 0) return;

      if (!isFirstSection) {
        ws1.addRow([]);
      }
      isFirstSection = false;

      list.forEach(a => {
        const emp = a.assignedEmployee;
        const rowValues = [
          formatAssignmentType(a.assignmentType),
          a.location?.name || '',
          a.department?.name || '',
          emp?.employeeCode || '',
          emp?.fullName || '',
          emp?.email || '',
          emp?.phone || '',
          emp?.designation || '',
          emp?.status || '',
          a.deviceType || '',
          a.model || '',
          a.serialNumber || '',
          a.assetCode || '',
          a.processor || '',
          a.ram || '',
          a.storage || '',
          a.operatingSystem || '',
          a.vendor || '',
          formatDate(a.purchaseDate),
          formatDate(a.warrantyExpiryDate),
          a.status === 'AVAILABLE' ? 'In Store' : (a.status === 'ASSIGNED' ? 'Assigned' : a.status),
          a.brand || '',
          a.condition || '',
          a.remarks || ''
        ];

        const newRow = ws1.addRow(rowValues);
        newRow.eachCell((cell) => {
          cell.font = { name: 'Arial', size: 9 };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
            left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
            bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
            right: { style: 'thin', color: { argb: 'FFCCCCCC' } }
          };
        });
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="EuroMotors_IT_Inventory_Export.xlsx"');

    const buffer = await workbook.xlsx.writeBuffer();
    res.send(Buffer.from(buffer));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/bulk', requirePermission('BULK_IMPORT_ASSETS'), async (req, res) => {
  try {
    const assets = req.body.assets;
    const rowOffset = req.body.rowOffset || 2;
    if (!Array.isArray(assets)) return res.status(400).json({ error: 'Payload must contain assets array.' });

    let results = {
       totalRows: assets.length,
       imported: 0,
       updated: 0,
       skipped: 0,
       failed: 0,
       createdLocations: 0,
       createdDepartments: 0,
       createdEmployees: 0,
       updatedEmployees: 0,
       createdAssets: 0,
       updatedAssets: 0,
       createdAssignments: 0,
       skippedRows: 0,
       errors: []
    };

    const locations = await prisma.location.findMany();
    const departments = await prisma.department.findMany();
    const employees = await prisma.employee.findMany();

    const locationMap = new Map(locations.map(l => [l.name.toLowerCase().trim(), l]));
    const departmentMap = new Map(departments.map(d => [d.name.toLowerCase().trim(), d]));
    const employeeMap = new Map(employees.map(e => [e.employeeCode ? e.employeeCode.toUpperCase().trim() : '', e]));
    
    const existingAssetRecords = await prisma.asset.findMany({ select: { id: true, assetCode: true, serialNumber: true } });
    const assetCodeToAsset = new Map(existingAssetRecords.map(a => [a.assetCode.toUpperCase().trim(), a]));
    const serialToAsset = new Map(existingAssetRecords.filter(a => a.serialNumber).map(a => [a.serialNumber.toUpperCase().trim(), a]));

    const settings = await prisma.systemSettings.findUnique({ where: { id: 'global' } });
    const assetPrefix = settings?.assetCodePrefix || 'AST';

    let highestAssetSequence = 550; // default max if no valid sequences
    const assetRegex = new RegExp(`^${assetPrefix}-(\\d{9})$`, 'i');
    existingAssetRecords.forEach(a => {
        const match = a.assetCode.match(assetRegex);
        if (match) {
            const num = parseInt(match[1], 10);
            if (num > highestAssetSequence) highestAssetSequence = num;
        }
    });

    const existingEmployeeCodesArray = employees.map(e => e.employeeCode);
    const existingEmployeeCodes = new Set(existingEmployeeCodesArray.filter(Boolean));
    
    let highestEmployeeSequence = 166; // default max if no valid sequences
    const empRegex = new RegExp(`^EMP-(\\d{9})$`, 'i');
    existingEmployeeCodesArray.forEach(code => {
        if (!code) return;
        const match = code.match(empRegex);
        if (match) {
            const num = parseInt(match[1], 10);
            if (num > highestEmployeeSequence) highestEmployeeSequence = num;
        }
    });

    const seenAssetCodesInBatch = new Set();
    const seenSerialsInBatch = new Set();

    for (let i = 0; i < assets.length; i++) {
       const a = assets[i];
       const rowNum = rowOffset + i;

       // Ignore empty/blank separator rows
       const values = Object.values(a || {});
       const isBlankRow = values.length === 0 || values.every(v => v === null || v === undefined || v.toString().trim() === '');
       if (isBlankRow) {
           results.skipped++;
           results.skippedRows++;
           continue;
       }
       
       try {
          if (!a.deviceType) {
             const e = new Error("Please provide a valid device type (e.g., Laptop, Router).");
             e.column = 'deviceType';
             e.value = a.deviceType || '';
             throw e;
          }

          const aType = a.assignmentType ? a.assignmentType.toUpperCase() : 'EMPLOYEE';
          if (aType === 'EMPLOYEE' && !a.employeeCode) {
             highestEmployeeSequence++;
             a.employeeCode = `EMP-${highestEmployeeSequence.toString().padStart(9, '0')}`;
             existingEmployeeCodes.add(a.employeeCode);
          }
          if (aType === 'DEPARTMENT' && !a.departmentName) {
             const e = new Error("Department Name is mandatory for DEPARTMENT assignment type.");
             e.column = 'departmentName';
             e.value = a.departmentName || '';
             throw e;
          }
          if ((aType === 'LOCATION' || aType === 'STORE' || aType === 'IN STORE') && !a.locationName) {
             const e = new Error(`Location Name is mandatory for ${aType} assignment type.`);
             e.column = 'locationName';
             e.value = a.locationName || '';
             throw e;
          }
          if (aType === 'SHARED' && !a.departmentName && !a.locationName) {
             const e = new Error("Department or Location is mandatory for SHARED assignment type.");
             e.column = 'departmentName / locationName';
             e.value = '';
             throw e;
          }

          // Location Resolution
          let locationId = null;
          if (a.locationName && a.locationName.trim() !== '') {
             const locKey = a.locationName.toLowerCase().trim();
             let loc = locationMap.get(locKey);
             if (!loc) {
                 loc = await prisma.location.create({ data: { name: a.locationName.trim(), status: 'ACTIVE' } });
                 locationMap.set(locKey, loc);
                 results.createdLocations++;
             }
             locationId = loc.id;
          }

          // Department Resolution
          let departmentId = null;
          if (a.departmentName && a.departmentName.trim() !== '') {
             const deptKey = a.departmentName.toLowerCase().trim();
             let dept = departmentMap.get(deptKey);
             if (!dept) {
                 dept = await prisma.department.create({ data: { name: a.departmentName.trim(), status: 'ACTIVE' } });
                 departmentMap.set(deptKey, dept);
                 results.createdDepartments++;
             }
             departmentId = dept.id;
          }

          // Employee Resolution
          let employeeId = null;
          if (aType === 'EMPLOYEE' && a.employeeCode) {
             const empKey = a.employeeCode.toUpperCase().trim();
             let emp = employeeMap.get(empKey);
             
             if (!emp) {
                 emp = await prisma.employee.create({
                     data: {
                         employeeCode: a.employeeCode.trim(),
                         fullName: a.employeeName || 'Unknown',
                         email: a.email || null,
                         phone: a.phone || null,
                         designation: a.designation || null,
                         ...(departmentId ? { department: { connect: { id: departmentId } } } : {}),
                         ...(locationId ? { location: { connect: { id: locationId } } } : {}),
                         status: a.employeeStatus ? a.employeeStatus.toUpperCase() : 'ACTIVE'
                     }
                 });
                 employeeMap.set(empKey, emp);
                 results.createdEmployees++;
             } else {
                 const updateData = { departmentId, locationId };
                 if (a.employeeName) updateData.fullName = a.employeeName;
                 if (a.email) updateData.email = a.email;
                 if (a.phone) updateData.phone = a.phone;
                 if (a.designation) updateData.designation = a.designation;
                 if (a.employeeStatus) updateData.status = a.employeeStatus.toUpperCase();

                 emp = await prisma.employee.update({
                     where: { id: emp.id },
                     data: updateData
                 });
                 employeeMap.set(empKey, emp);
                 results.updatedEmployees++;
             }
             employeeId = emp.id;
          }

          // AssetCode Resolution and Check if updating vs inserting
          let inputCode = a.assetCode ? a.assetCode.toString().trim() : '';
          let existingAsset = null;
          if (inputCode) {
              existingAsset = assetCodeToAsset.get(inputCode.toUpperCase());
          }

          if (!inputCode && !existingAsset) {
              highestAssetSequence++;
              inputCode = `${assetPrefix}-${highestAssetSequence.toString().padStart(9, '0')}`;
          }

          // Validate duplicate assetCode within batch
          if (inputCode) {
              const codeKey = inputCode.toUpperCase();
              if (seenAssetCodesInBatch.has(codeKey) && !req.body.forceUpload) {
                  const e = new Error("Duplicate Asset Code in uploaded file.");
                  e.column = 'assetCode';
                  e.value = inputCode;
                  throw e;
              }
              seenAssetCodesInBatch.add(codeKey);
          }

          // Serial Number Resolution
          let finalSerial = null;
          if (a.serialNumber && a.serialNumber.toString().trim() !== '' && a.serialNumber.toString().trim().toLowerCase() !== 'no serial' && a.serialNumber.toString().trim().toLowerCase() !== 'n/a') {
              finalSerial = a.serialNumber.toString().trim();
              const serialKey = finalSerial.toUpperCase();
              
              if (seenSerialsInBatch.has(serialKey)) {
                  if (!req.body.forceUpload) {
                      const e = new Error("Duplicate Serial Number in uploaded file.");
                      e.column = 'serialNumber';
                      e.value = finalSerial;
                      throw e;
                  } else {
                      finalSerial = null;
                  }
              }
              
              // Check if serial exists in DB on ANOTHER asset
              if (finalSerial) {
                  const dbSerialAsset = serialToAsset.get(serialKey);
                  if (dbSerialAsset && (!existingAsset || dbSerialAsset.id !== existingAsset.id)) {
                      if (!req.body.forceUpload) {
                          const e = new Error("This Serial Number already exists in the database.");
                          e.column = 'serialNumber';
                          e.value = finalSerial;
                          throw e;
                      } else {
                          finalSerial = null;
                      }
                  }
              }
              
              if (finalSerial) {
                  seenSerialsInBatch.add(serialKey);
              }
          }

          // Status determination
          const rawStatus = (a.status || '').toUpperCase();
          let finalStatus = 'AVAILABLE';
          if (rawStatus === 'ASSIGNED' || employeeId || (aType === 'EMPLOYEE' && employeeId)) {
              finalStatus = 'ASSIGNED';
          } else if (rawStatus === 'UNDER_REPAIR' || rawStatus === 'UNDER REPAIR') {
              finalStatus = 'UNDER_REPAIR';
          } else if (rawStatus === 'RETIRED') {
              finalStatus = 'RETIRED';
          } else {
              finalStatus = (aType === 'STORE' || aType === 'IN STORE' || (!employeeId && !departmentId && !locationId)) ? 'AVAILABLE' : 'ASSIGNED';
          }

          const parseSafeDate = (dt) => {
             if (!dt) return null;
             const parsed = new Date(dt);
             return isNaN(parsed.getTime()) ? null : parsed;
          };

          const assetPayload = {
             assetCode: inputCode,
             deviceType: a.deviceType,
             model: a.model || null,
             serialNumber: finalSerial,
             status: finalStatus,
             condition: a.condition || 'GOOD',
             brand: a.brand || null,
             processor: a.processor || null,
             ram: a.ram || null,
             storage: a.storage || null,
             operatingSystem: a.operatingSystem || null,
             vendor: a.vendor || null,
             purchaseDate: parseSafeDate(a.purchaseDate),
             warrantyStatus: a.warrantyStatus || 'Active',
             warrantyExpiryDate: parseSafeDate(a.warrantyExpiryDate),
             remarks: a.remarks || null,
             macAddress: a.macAddress || null,
             ipAddress: a.ipAddress || null,
             departmentId,
             locationId,
             assignedEmployeeId: employeeId,
             assignmentType: aType === 'IN STORE' ? 'STORE' : aType
          };

          if (existingAsset) {
              // UPDATE EXISTING ASSET
              const updated = await prisma.asset.update({
                  where: { id: existingAsset.id },
                  data: assetPayload
              });
              
              results.updated++;
              results.updatedAssets++;

              await logAssetTimeline({
                assetId: updated.id,
                assetCode: updated.assetCode,
                eventType: 'UPDATED',
                title: 'Asset Updated (Bulk)',
                description: `Asset updated via standard Excel ingestion.`,
                newStatus: finalStatus,
                performedById: req.user.id,
                performedByName: req.user.fullName
              });
          } else {
              // INSERT NEW ASSET
              const newAsset = await prisma.asset.create({ data: assetPayload });
              results.imported++;
              results.createdAssets++;

              assetCodeToAsset.set(newAsset.assetCode.toUpperCase(), newAsset);
              if (finalSerial) serialToAsset.set(finalSerial.toUpperCase(), newAsset);

              await logAssetTimeline({
                assetId: newAsset.id,
                assetCode: newAsset.assetCode,
                eventType: 'CREATED',
                title: 'Asset Created (Bulk)',
                description: `Asset added via standard Excel ingestion. Initial status: ${finalStatus}`,
                newStatus: finalStatus,
                performedById: req.user.id,
                performedByName: req.user.fullName
              });

              if (employeeId) {
                 await prisma.assetAssignment.create({
                     data: {
                         assetId: newAsset.id,
                         employeeId: employeeId,
                         status: 'ACTIVE',
                         remarks: 'Automated Direct Organization Ingestion'
                     }
                 });
                 results.createdAssignments++;
              }
          }
          
       } catch (err) {
          results.failed++;
          results.skippedRows++;
          results.errors.push({
             row: rowNum,
             assetCode: a.assetCode || 'N/A',
             column: err.column || 'System',
             value: err.value || '-',
             fix: err.message,
             originalData: a
          });
       }
    }

    // Final Bulk Audit
    await logAudit({
      req,
      action: 'BULK_UPLOAD',
      module: 'ASSETS',
      entityType: 'ASSET_COLLECTION',
      description: `Bulk upload processed ${assets.length} rows. Results: ${results.imported} created, ${results.updated} updated, ${results.skipped} skipped, ${results.failed} failed.`
    });

    res.status(200).json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', requirePermission('EDIT_ASSETS'), async (req, res) => {
  try {
    const oldRecord = await prisma.asset.findUnique({ where: { id: req.params.id } });
    if (!oldRecord) return res.status(404).json({ error: 'Asset not found' });

    const payload = req.body;
    const dType = payload.deviceType || oldRecord.deviceType;
    const REQUIRES_MODEL = ['Laptop', 'Desktop', 'Tablet', 'Phone', 'Server', 'Router', 'Switch', 'Printer', 'Photocopier'];
    if (REQUIRES_MODEL.includes(dType)) {
      const finalModel = payload.model !== undefined ? payload.model : oldRecord.model;
      if (!finalModel) {
        return res.status(400).json({ error: `Model is mandatory for device type: ${dType}` });
      }
    }

    if (payload.macAddress !== undefined && payload.macAddress !== null && typeof payload.macAddress === 'string' && payload.macAddress.trim()) {
      payload.macAddress = payload.macAddress.trim();
      if (!MAC_REGEX.test(payload.macAddress)) {
        return res.status(400).json({ error: 'Invalid MAC Address format. Example: 00:1B:44:11:3A:B7 or 00-1B-44-11-3A-B7' });
      }
    }
    if (payload.ipAddress !== undefined && payload.ipAddress !== null && typeof payload.ipAddress === 'string' && payload.ipAddress.trim()) {
      payload.ipAddress = payload.ipAddress.trim();
      if (!IPV4_REGEX.test(payload.ipAddress)) {
        return res.status(400).json({ error: 'Invalid IP Address format. Example: 192.168.1.50' });
      }
    }
    if (payload.condition && typeof payload.condition === 'string' && payload.condition.trim()) {
      const condUpper = payload.condition.trim().toUpperCase();
      if (!VALID_CONDITIONS.includes(condUpper)) {
        return res.status(400).json({ error: `Invalid Condition. Allowed values: ${VALID_CONDITIONS.join(', ')}` });
      }
    }
    if (payload.warrantyStatus && typeof payload.warrantyStatus === 'string' && payload.warrantyStatus.trim()) {
      const wsUpper = payload.warrantyStatus.trim().toUpperCase();
      if (!VALID_WARRANTY_STATUSES.includes(wsUpper)) {
        return res.status(400).json({ error: `Invalid Warranty Status. Allowed values: ${VALID_WARRANTY_STATUSES.join(', ')}` });
      }
    }

    if (payload.status === 'AVAILABLE' && !payload.assignedEmployeeId && (!payload.assignmentType || payload.assignmentType === 'EMPLOYEE')) {
      payload.assignmentType = 'STORE';
    }
    const aType = payload.assignmentType || oldRecord.assignmentType;
    
    if (aType === 'DEPARTMENT') {
      if (!payload.departmentId && !oldRecord.departmentId) return res.status(400).json({ error: 'Department is mandatory for DEPARTMENT assignment type.' });
      payload.assignedEmployeeId = null;
    } else if (aType === 'LOCATION') {
      if (!payload.locationId && !oldRecord.locationId) return res.status(400).json({ error: 'Location is mandatory for LOCATION assignment type.' });
      payload.assignedEmployeeId = null;
    } else if (aType === 'SHARED') {
      if (!payload.departmentId && !oldRecord.departmentId && !payload.locationId && !oldRecord.locationId) return res.status(400).json({ error: 'Department or Location is required for SHARED assignment type.' });
      payload.assignedEmployeeId = null;
    } else if (aType === 'STORE') {
      if (!payload.locationId && !oldRecord.locationId) return res.status(400).json({ error: 'Location is mandatory for STORE assignment type.' });
      payload.assignedEmployeeId = null;
    }
    
    const record = await prisma.asset.update({ where: { id: req.params.id }, data: payload });

    // If status was changed to AVAILABLE or STORE, close active assignments
    if ((record.status === 'AVAILABLE' || record.assignmentType === 'STORE') && oldRecord.status !== 'AVAILABLE') {
      try {
        await prisma.assetAssignment.updateMany({
          where: { assetId: record.id, status: 'ACTIVE' },
          data: { status: 'RETURNED', returnedDate: new Date() }
        });
      } catch (_) {}
    }

    // Log Audit
    await logAudit({
      req,
      action: 'UPDATE',
      module: 'ASSETS',
      entityType: 'ASSET',
      entityId: record.id,
      entityCode: record.assetCode,
      oldValue: oldRecord,
      newValue: record,
      description: `Asset updated: ${record.assetCode}`
    });

    // Track Specific Timeline Events
    if (oldRecord.status !== record.status) {
      await logAssetTimeline({
        assetId: record.id,
        assetCode: record.assetCode,
        eventType: 'STATUS_CHANGE',
        title: 'Status Updated',
        description: `Asset status changed from ${oldRecord.status} to ${record.status}`,
        oldStatus: oldRecord.status,
        newStatus: record.status,
        performedById: req.user.id,
        performedByName: req.user.fullName
      });
    }

    if (oldRecord.locationId !== record.locationId || oldRecord.departmentId !== record.departmentId) {
      await logAssetTimeline({
        assetId: record.id,
        assetCode: record.assetCode,
        eventType: 'MOVEMENT',
        title: 'Asset Moved',
        description: `Asset location or department attributes updated.`,
        performedById: req.user.id,
        performedByName: req.user.fullName
      });
    }

    res.json(record);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', requirePermission('DELETE_ASSETS'), async (req, res) => {
  try {
    const oldRecord = await prisma.asset.findUnique({ where: { id: req.params.id } });
    if (!oldRecord) return res.status(404).json({ error: 'Asset not found' });

    // Manual cascade delete
    await prisma.$transaction([
      prisma.assetAssignment.deleteMany({ where: { assetId: req.params.id } }),
      prisma.maintenanceLog.deleteMany({ where: { assetId: req.params.id } }),
      prisma.assetTimeline.deleteMany({ where: { assetId: req.params.id } }),
      prisma.assetDocument.deleteMany({ where: { assetId: req.params.id } }),
      prisma.supportTicket.updateMany({
        where: { assetId: req.params.id },
        data: { assetId: null }
      }),
      prisma.asset.delete({ where: { id: req.params.id } })
    ]);

    // Log Audit
    await logAudit({
      req,
      action: 'DELETE',
      module: 'ASSETS',
      entityType: 'ASSET',
      entityId: req.params.id,
      entityCode: oldRecord.assetCode,
      oldValue: oldRecord,
      description: `Asset deleted: ${oldRecord.assetCode}`
    });

    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/timeline', async (req, res) => {
  try {
    const { id } = req.params;
    const timeline = await prisma.assetTimeline.findMany({
      where: { assetId: id },
      orderBy: { createdAt: 'desc' }
    });
    res.json(timeline);
  } catch (err) {
    res.status(500).json({ error: 'Server error fetching asset timeline', details: err.message });
  }
});

router.get('/code/:code/timeline', async (req, res) => {
  try {
    const { code } = req.params;
    const timeline = await prisma.assetTimeline.findMany({
      where: { assetCode: code },
      orderBy: { createdAt: 'desc' }
    });
    res.json(timeline);
  } catch (err) {
    res.status(500).json({ error: 'Server error fetching asset timeline', details: err.message });
  }
});


// Direct asset check-in / return endpoint
router.post('/:id/return', requirePermission('ASSIGN_ASSETS'), async (req, res) => {
  try {
    const asset = await prisma.asset.findFirst({
      where: {
        OR: [
          { id: req.params.id },
          { assetCode: req.params.id }
        ]
      },
      include: {
        assignedEmployee: { include: { department: true } },
        assignments: { where: { status: 'ACTIVE' }, include: { employee: true } }
      }
    });

    if (!asset) return res.status(404).json({ error: 'Asset not found' });

    // Mark all active assignments as RETURNED
    const now = new Date();
    const returnAccessories = req.body?.returnAccessories || null;
    const returnRemarks = req.body?.remarks || null;
    await prisma.assetAssignment.updateMany({
      where: { assetId: asset.id, status: 'ACTIVE' },
      data: { 
        status: 'RETURNED', 
        returnedDate: now,
        ...(returnAccessories ? { returnAccessories } : {}),
        ...(returnRemarks ? { remarks: returnRemarks } : {})
      }
    });

    const emp = asset.assignedEmployee || asset.assignments?.[0]?.employee || null;
    const empName = emp ? emp.fullName : 'Employee';
    const empCode = emp?.employeeCode || '';

    // Update asset status to AVAILABLE
    const updated = await prisma.asset.update({
      where: { id: asset.id },
      data: {
        status: 'AVAILABLE',
        assignedEmployeeId: null,
        assignmentType: 'STORE'
      },
      include: { 
        location: true, 
        department: true, 
        assignedEmployee: true,
        assignments: {
          include: {
            employee: {
              include: { department: true, location: true }
            }
          },
          orderBy: { assignedDate: 'desc' }
        }
      }
    });

    // Central Audit Log
    await logAudit({
      req,
      action: 'RETURN',
      module: 'ASSIGNMENTS',
      entityType: 'ASSET',
      entityId: asset.id,
      entityCode: asset.assetCode,
      employeeOverride: emp ? {
        id: emp.id,
        fullName: emp.fullName,
        departmentName: emp.department?.name || null
      } : null,
      description: `Asset ${asset.assetCode} returned to store by ${empName}${empCode ? ` (${empCode})` : ''}`
    });

    // Asset Lifecycle Timeline
    await logAssetTimeline({
      assetId: asset.id,
      assetCode: asset.assetCode,
      eventType: 'RETURNED',
      title: 'Asset Returned',
      description: `Returned to store by ${empName}${empCode ? ` (${empCode})` : ''}`,
      oldStatus: asset.status,
      newStatus: 'AVAILABLE',
      employeeId: emp?.id || null,
      employeeName: empName,
      performedById: req.user.id,
      performedByName: req.user.fullName
    });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
