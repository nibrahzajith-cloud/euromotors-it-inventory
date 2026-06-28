const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { logAudit, logAssetTimeline } = require('../utils/logger');

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
    if (payload.assetCode) payload.assetCode = payload.assetCode.trim();
    if (payload.serialNumber) payload.serialNumber = payload.serialNumber.trim();
    
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

    for (let i = 0; i < assets.length; i++) {
       const a = assets[i];
       const rowNum = i + 1;
       
       try {
          if (!a.deviceType || !a.model) {
             throw new Error("Missing required fields (deviceType or model).");
          }

          // 1 & 2. Location and Department Resolution
          let locationId = null;
          if (a.locationName) {
             let loc = await prisma.location.findUnique({ where: { name: a.locationName } });
             if (!loc) {
                 loc = await prisma.location.create({ data: { name: a.locationName, status: 'ACTIVE' } });
                 results.createdLocations++;
             }
             locationId = loc.id;
          }

          let departmentId = null;
          if (a.departmentName) {
             let dept = await prisma.department.findUnique({ where: { name: a.departmentName } });
             if (!dept) {
                 dept = await prisma.department.create({ data: { name: a.departmentName, status: 'ACTIVE' } });
                 results.createdDepartments++;
             }
             departmentId = dept.id;
          }

          // 3 & 4. Employee Resolution
          let employeeId = null;
          if (a.employeeName && a.employeeName.trim() !== '') {
             let emp = null;
             
             if (a.employeeCode) emp = await prisma.employee.findUnique({ where: { employeeCode: a.employeeCode } });
             if (!emp && a.email) emp = await prisma.employee.findFirst({ where: { email: a.email } });
             if (!emp) {
                 const matchCriteria = { fullName: a.employeeName };
                 if (locationId) matchCriteria.locationId = locationId;
                 emp = await prisma.employee.findFirst({ where: matchCriteria });
             }
             
             if (!emp) {
                 const newEmpCode = a.employeeCode || `EMP-${Date.now().toString().slice(-4)}-${Math.floor(Math.random()*100)}`;
                 emp = await prisma.employee.create({
                     data: {
                         employeeCode: newEmpCode,
                         fullName: a.employeeName,
                         email: a.email || null,
                         phone: a.phone || null,
                         designation: a.designation || null,
                         departmentId,
                         locationId,
                         status: a.employeeStatus || 'ACTIVE'
                     }
                 });
                 results.createdEmployees++;
             } else {
                 const updateData = { departmentId, locationId };
                 if (a.employeeCode) updateData.employeeCode = a.employeeCode;
                 if (a.email) updateData.email = a.email;
                 if (a.phone) updateData.phone = a.phone;
                 if (a.designation) updateData.designation = a.designation;
                 if (a.employeeStatus) updateData.status = a.employeeStatus;

                 emp = await prisma.employee.update({
                     where: { id: emp.id },
                     data: updateData
                 });
                 results.updatedEmployees++;
             }
             employeeId = emp.id;
          }

          // 6. Auto-generate assetCode
          const finalAssetCode = a.assetCode || `EM-IT-${Date.now().toString().slice(-5)}-${Math.floor(Math.random()*1000)}`;

          // 7. Serial Number Resolution
          let finalSerial = a.serialNumber;
          if (!finalSerial || finalSerial.trim().toLowerCase() === 'no serial') {
              finalSerial = `NO-SERIAL-ROW-${rowNum}-${Math.floor(Math.random()*1000)}`;
          }

          // Duplicate checks
          const existingCode = await prisma.asset.findUnique({ where: { assetCode: finalAssetCode } });
          if (existingCode) throw new Error(`Duplicate assetCode: ${finalAssetCode}`);
          
          const existingSerial = await prisma.asset.findUnique({ where: { serialNumber: finalSerial } });
          if (existingSerial) throw new Error(`Duplicate Serial Number`);

          // 5. Status determination
          const finalStatus = employeeId ? 'ASSIGNED' : 'AVAILABLE';

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
             assignedEmployeeId: employeeId
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
          }
          
       } catch (err) {
          results.skippedRows++;
          results.errors.push(`Row ${rowNum}: ${err.message}`);
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

    const record = await prisma.asset.update({ where: { id: req.params.id }, data: req.body });

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

    await prisma.asset.delete({ where: { id: req.params.id } });

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
