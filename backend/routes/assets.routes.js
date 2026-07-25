const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { logAudit, logAssetTimeline } = require('../utils/logger');
const { generateAssetCode, generateEmployeeCode } = require('../utils/codeGenerator');

router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const records = await prisma.asset.findMany({ include: { location: true, department: true, assignedEmployee: true } });
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
      include: { location: true, department: true, assignedEmployee: true }
    });
    if (!record) return res.status(404).json({ error: 'Asset not found in database.' });
    res.json(record);
  } catch (err) {
      res.status(500).json({ error: err.message });
  }
});

router.post('/', authorize(['ADMIN', 'IT_OFFICER']), async (req, res) => {
  try {
    const payload = req.body;
    if (payload.assetCode) {
      payload.assetCode = payload.assetCode.trim();
    } else {
      payload.assetCode = await generateAssetCode(prisma);
    }
    if (payload.serialNumber) payload.serialNumber = payload.serialNumber.trim();

    if (!payload.deviceType) return res.status(400).json({ error: 'Device Type is mandatory.' });
    const REQUIRES_MODEL = ['Laptop', 'Desktop', 'Tablet', 'Phone', 'Server', 'Router', 'Switch', 'Printer', 'Photocopier'];
    if (REQUIRES_MODEL.includes(payload.deviceType) && !payload.model) {
      return res.status(400).json({ error: `Model is mandatory for device type: ${payload.deviceType}` });
    }
    
    // AssignmentType Validation
    const aType = payload.assignmentType || 'EMPLOYEE';
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
    
    const record = await prisma.asset.create({ data: payload });

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
    res.status(500).json({ error: err.message });
  }
});

router.post('/bulk', authorize(['ADMIN']), async (req, res) => {
  try {
    const assets = req.body.assets;
    const rowOffset = req.body.rowOffset || 2;
    if (!Array.isArray(assets)) return res.status(400).json({ error: 'Payload must contain assets array.' });

    let results = {
       totalRows: assets.length,
       createdLocations: 0,
       createdDepartments: 0,
       createdEmployees: 0,
       updatedEmployees: 0,
       createdAssets: 0,
       createdAssignments: 0,
       skippedRows: 0,
       errors: []
    };

    // Pre-fetch data for caching to drastically speed up bulk insert
    const locations = await prisma.location.findMany();
    const departments = await prisma.department.findMany();
    const employees = await prisma.employee.findMany();

    const locationMap = new Map(locations.map(l => [l.name, l]));
    const departmentMap = new Map(departments.map(d => [d.name, d]));
    const employeeMap = new Map(employees.map(e => [e.employeeCode, e]));
    
    const existingAssetCodesArray = (await prisma.asset.findMany({ select: { assetCode: true } })).map(a => a.assetCode);
    const existingAssetCodes = new Set(existingAssetCodesArray);
    
    const settings = await prisma.systemSettings.findUnique({ where: { id: 'global' } });
    const assetPrefix = settings?.assetCodePrefix || 'AST';

    let highestAssetSequence = 0;
    const assetRegex = new RegExp(`^${assetPrefix}-(\\d+)-001$`);
    existingAssetCodesArray.forEach(code => {
        const match = code.match(assetRegex);
        if (match) {
            const num = parseInt(match[1], 10);
            if (num > highestAssetSequence) highestAssetSequence = num;
        }
    });

    const existingSerialNumbers = new Set((await prisma.asset.findMany({ where: { serialNumber: { not: null } }, select: { serialNumber: true } })).map(a => a.serialNumber));

    const existingEmployeeCodesArray = (await prisma.employee.findMany({ select: { employeeCode: true } })).map(e => e.employeeCode);
    const existingEmployeeCodes = new Set(existingEmployeeCodesArray);
    
    let highestEmployeeSequence = 0;
    const empRegex = new RegExp(`^EMP-(\\d+)-001$`);
    existingEmployeeCodesArray.forEach(code => {
        const match = code.match(empRegex);
        if (match) {
            const num = parseInt(match[1], 10);
            if (num > highestEmployeeSequence) highestEmployeeSequence = num;
        }
    });

    for (let i = 0; i < assets.length; i++) {
       const a = assets[i];
       const rowNum = rowOffset + i;
       
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
             a.employeeCode = `EMP-${highestEmployeeSequence.toString().padStart(5, '0')}-001`;
             existingEmployeeCodes.add(a.employeeCode);
          }
          if (aType === 'DEPARTMENT' && !a.departmentName) {
             const e = new Error("Department Name is mandatory for DEPARTMENT assignment type.");
             e.column = 'departmentName';
             e.value = a.departmentName || '';
             throw e;
          }
          if ((aType === 'LOCATION' || aType === 'STORE') && !a.locationName) {
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

          // 1 & 2. Location and Department Resolution
          let locationId = null;
          if (a.locationName) {
             let loc = locationMap.get(a.locationName);
             if (!loc) {
                 loc = await prisma.location.create({ data: { name: a.locationName, status: 'ACTIVE' } });
                 locationMap.set(a.locationName, loc);
                 results.createdLocations++;
             }
             locationId = loc.id;
          }

          let departmentId = null;
          if (a.departmentName) {
             let dept = departmentMap.get(a.departmentName);
             if (!dept) {
                 dept = await prisma.department.create({ data: { name: a.departmentName, status: 'ACTIVE' } });
                 departmentMap.set(a.departmentName, dept);
                 results.createdDepartments++;
             }
             departmentId = dept.id;
          }

          // 3 & 4. Employee Resolution
          let employeeId = null;
          if (aType === 'EMPLOYEE' && a.employeeCode) {
             let emp = employeeMap.get(a.employeeCode);
             
             if (!emp) {
                 emp = await prisma.employee.create({
                     data: {
                         employeeCode: a.employeeCode,
                         fullName: a.employeeName || 'Unknown',
                         email: a.email || null,
                         phone: a.phone || null,
                         designation: a.designation || null,
                         departmentId,
                         locationId,
                         status: a.employeeStatus ? a.employeeStatus.toUpperCase() : 'ACTIVE'
                     }
                 });
                 employeeMap.set(a.employeeCode, emp);
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
                 employeeMap.set(a.employeeCode, emp);
                 results.updatedEmployees++;
             }
             employeeId = emp.id;
          }

          // 6. Auto-generate assetCode
          let finalAssetCode = a.assetCode;
          if (!finalAssetCode || finalAssetCode.trim() === '') {
              highestAssetSequence++;
              finalAssetCode = `${assetPrefix}-${highestAssetSequence.toString().padStart(5, '0')}-001`;
          } else {
              finalAssetCode = finalAssetCode.trim();
          }

          // Duplicate checks
          if (existingAssetCodes.has(finalAssetCode)) {
              const e = new Error("This asset code already exists in the database.");
              e.column = 'assetCode';
              e.value = finalAssetCode;
              throw e;
          }
          existingAssetCodes.add(finalAssetCode);
          
          // 7. Serial Number Resolution
          let finalSerial = null;
          if (a.serialNumber && a.serialNumber.toString().trim() !== '' && a.serialNumber.toString().trim().toLowerCase() !== 'no serial') {
              finalSerial = a.serialNumber.toString().trim();
              if (existingSerialNumbers.has(finalSerial)) {
                  const e = new Error("This Serial Number already exists in the database.");
                  e.column = 'serialNumber';
                  e.value = finalSerial;
                  throw e;
              }
              existingSerialNumbers.add(finalSerial);
          }

          // 5. Status determination
          const finalStatus = (aType === 'STORE' || (!employeeId && !departmentId && !locationId)) ? 'AVAILABLE' : 'ASSIGNED';

          const parseSafeDate = (dt) => {
             if (!dt) return null;
             const parsed = new Date(dt);
             return isNaN(parsed.getTime()) ? null : parsed;
          };

          const createData = {
             assetCode: finalAssetCode,
             deviceType: a.deviceType,
             model: a.model,
             serialNumber: finalSerial,
             status: finalStatus,
             condition: a.condition || 'New',
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
             assignmentType: aType
          };

          const newAsset = await prisma.asset.create({ data: createData });
          results.createdAssets++;

          // Timeline Log for Creation
          await logAssetTimeline({
            assetId: newAsset.id,
            assetCode: newAsset.assetCode,
            eventType: 'CREATED',
            title: 'Asset Created (Bulk)',
            description: `Asset added via system bulk data ingestion. Initial status: ${finalStatus}`,
            newStatus: finalStatus,
            performedById: req.user.id,
            performedByName: req.user.fullName
          });

          // 5. Assignment Logging
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

             // Timeline Log for Assignment
             const emp = await prisma.employee.findUnique({ where: { id: employeeId } });
             await logAssetTimeline({
               assetId: newAsset.id,
               assetCode: newAsset.assetCode,
               eventType: 'ASSIGNED',
               title: 'Asset Assigned (Bulk)',
               description: `Automatically assigned to ${emp?.fullName} during ingestion.`,
               oldStatus: 'AVAILABLE',
               newStatus: 'ASSIGNED',
               employeeId: emp?.id,
               employeeName: emp?.fullName,
               performedById: req.user.id,
               performedByName: req.user.fullName
             });
          } else if (departmentId || locationId) {
             let targetName = '';
             if (departmentId && locationId) {
                 const dept = departmentMap.get(a.departmentName);
                 const loc = locationMap.get(a.locationName);
                 targetName = `Department: ${dept?.name}, Location: ${loc?.name}`;
             } else if (departmentId) {
                 const dept = departmentMap.get(a.departmentName);
                 targetName = `Department: ${dept?.name}`;
             } else if (locationId) {
                 const loc = locationMap.get(a.locationName);
                 targetName = `Location: ${loc?.name}`;
             }
             
             await logAssetTimeline({
               assetId: newAsset.id,
               assetCode: newAsset.assetCode,
               eventType: 'ASSIGNED',
               title: 'Asset Assigned (Bulk)',
               description: `Automatically assigned to ${targetName} during ingestion.`,
               oldStatus: 'AVAILABLE',
               newStatus: 'ASSIGNED',
               performedById: req.user.id,
               performedByName: req.user.fullName
             });
          }
          
       } catch (err) {
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
      description: `Bulk upload processed ${assets.length} rows. Results: ${results.createdAssets} assets created, ${results.createdEmployees} employees created, ${results.skippedRows} rows skipped.`
    });

    res.status(200).json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', authorize(['ADMIN', 'IT_OFFICER']), async (req, res) => {
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

router.delete('/:id', authorize(['ADMIN']), async (req, res) => {
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

module.exports = router;
