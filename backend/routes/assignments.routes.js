const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient');
const { authenticate, authorize, requirePermission } = require('../middleware/auth.middleware');
const { logAudit, logAssetTimeline } = require('../utils/logger');
const memoryCache = require('../utils/cache');

router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    if (req.query.refresh !== 'true') {
      const cached = memoryCache.get('assignments:all');
      if (cached) return res.json(cached);
    }
    const records = await prisma.assetAssignment.findMany({ 
      include: { 
        asset: {
          include: { department: true, location: true }
        }, 
        employee: {
          include: { department: true, location: true }
        }
      },
      orderBy: { assignedDate: 'desc' }
    });
    memoryCache.set('assignments:all', records, 20);
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', requirePermission('ASSIGN_ASSETS'), async (req, res) => {
  try {
    const asset = await prisma.asset.findUnique({ 
       where: { id: req.body.assetId },
       include: { department: true, location: true }
    });
    if (!asset) return res.status(404).json({ error: 'Asset not found' });
    if (asset.status === 'UNDER_REPAIR') {
      return res.status(400).json({ error: 'Cannot assign an asset that is currently under repair.' });
    }
    if (asset.status !== 'AVAILABLE') {
      return res.status(400).json({ error: `Cannot assign asset. Current status is ${asset.status}.` });
    }

    const aType = req.body.assignmentType || asset.assignmentType || 'EMPLOYEE';
    let employee = null;
    let record = null;
    let dept = null;
    let loc = null;
    
    if (aType === 'EMPLOYEE') {
      employee = await prisma.employee.findUnique({ 
         where: { id: req.body.employeeId },
         include: { department: true, location: true }
      });
      if (!employee) return res.status(404).json({ error: 'Employee not found' });
      
      record = await prisma.assetAssignment.create({ 
        data: {
          assetId: req.body.assetId,
          employeeId: req.body.employeeId,
          assignedDate: req.body.assignedDate ? new Date(req.body.assignedDate) : new Date(),
          status: 'ACTIVE',
          remarks: req.body.remarks || null,
          accessories: req.body.accessories || null
        },
        include: { asset: true, employee: true }
      });
      
      await prisma.asset.update({
        where: { id: req.body.assetId },
        data: { 
          status: 'ASSIGNED', 
          assignedEmployeeId: req.body.employeeId,
          assignmentType: 'EMPLOYEE'
        }
      });
    } else {
      if (req.body.departmentId) {
        dept = await prisma.department.findUnique({ where: { id: req.body.departmentId } });
      }
      if (req.body.locationId) {
        loc = await prisma.location.findUnique({ where: { id: req.body.locationId } });
      }
      
      await prisma.asset.update({
        where: { id: req.body.assetId },
        data: {
          status: 'ASSIGNED',
          assignmentType: aType,
          departmentId: req.body.departmentId || asset.departmentId,
          locationId: req.body.locationId || asset.locationId,
          assignedEmployeeId: null
        }
      });
    }

    // Central Audit Log with employee attribution
    await logAudit({
      req,
      action: 'ASSIGN',
      module: 'ASSIGNMENTS',
      entityType: 'ASSET',
      entityId: asset.id,
      entityCode: asset.assetCode,
      employeeOverride: employee ? {
        id: employee.id,
        fullName: employee.fullName,
        departmentName: employee.department?.name || null
      } : null,
      description: aType === 'EMPLOYEE' && employee
        ? `Asset ${asset.assetCode} assigned to ${employee.fullName} (${employee.employeeCode || 'EMP'})`
        : `Asset ${asset.assetCode} assigned (${aType}${dept ? ` - ${dept.name}` : ''}${loc ? ` - ${loc.name}` : ''})`
    });

    // Asset Lifecycle Timeline Event
    await logAssetTimeline({
      assetId: asset.id,
      assetCode: asset.assetCode,
      eventType: 'ASSIGNED',
      title: 'Asset Assigned',
      description: aType === 'EMPLOYEE' && employee
        ? `Assigned to ${employee.fullName} (${employee.employeeCode || 'EMP'})`
        : `Assigned as ${aType}` + (dept ? ` to ${dept.name}` : '') + (loc ? ` at ${loc.name}` : ''),
      oldStatus: 'AVAILABLE',
      newStatus: 'ASSIGNED',
      employeeId: employee?.id || null,
      employeeName: employee?.fullName || null,
      departmentId: employee?.departmentId || req.body.departmentId || null,
      departmentName: employee?.department?.name || dept?.name || null,
      locationId: employee?.locationId || req.body.locationId || null,
      locationName: employee?.location?.name || loc?.name || null,
      performedById: req.user.id,
      performedByName: req.user.fullName
    });

    memoryCache.delPrefix('assignments');
    memoryCache.delPrefix('assets');
    memoryCache.delPrefix('dashboard');
    res.status(201).json(record || { message: 'Asset assigned successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', requirePermission('ASSIGN_ASSETS'), async (req, res) => {
  try {
    const oldAssignment = await prisma.assetAssignment.findUnique({ 
       where: { id: req.params.id },
       include: { 
         asset: true, 
         employee: { include: { department: true } }
       }
    });
    if (!oldAssignment) return res.status(404).json({ error: 'Assignment not found' });

    const updateData = { ...req.body };
    if (updateData.returnedDate) {
      updateData.returnedDate = new Date(updateData.returnedDate);
    }
    if (updateData.assignedDate) {
      updateData.assignedDate = new Date(updateData.assignedDate);
    }
    if (updateData.returnAccessories !== undefined) {
      updateData.returnAccessories = updateData.returnAccessories;
    }
    if (updateData.accessories !== undefined) {
      updateData.accessories = updateData.accessories;
    }

    const record = await prisma.assetAssignment.update({ 
       where: { id: req.params.id }, 
       data: updateData,
       include: { 
         asset: true, 
         employee: { include: { department: true } }
       }
    });

    const isMarkingReturned = String(req.body.status || '').toUpperCase() === 'RETURNED';

    if (isMarkingReturned && oldAssignment.status !== 'RETURNED') {
       const assetIdToUpdate = oldAssignment.assetId || record.assetId;
       const ast = record.asset || oldAssignment.asset;
       const emp = record.employee || oldAssignment.employee;
       const empName = emp ? emp.fullName : 'Employee';
       const empCode = emp?.employeeCode || '';
       const astCode = ast ? ast.assetCode : 'Asset';

       // 1. Return asset to available stock in store
       await prisma.asset.update({
          where: { id: assetIdToUpdate },
          data: { 
            status: 'AVAILABLE', 
            assignedEmployeeId: null, 
            assignmentType: 'STORE' 
          }
       });

       // 2. Automatically close any other orphan active assignments for this asset
       await prisma.assetAssignment.updateMany({
         where: { 
           assetId: assetIdToUpdate, 
           id: { not: record.id }, 
           status: 'ACTIVE' 
         },
         data: { 
           status: 'RETURNED', 
           returnedDate: updateData.returnedDate || new Date() 
         }
       });

       // 3. Central Audit Log
       await logAudit({
         req,
         action: 'RETURN',
         module: 'ASSIGNMENTS',
         entityType: 'ASSET',
         entityId: assetIdToUpdate,
         entityCode: astCode,
         employeeOverride: emp ? {
           id: emp.id,
           fullName: emp.fullName,
           departmentName: emp.department?.name || null
         } : null,
         description: `Asset ${astCode} returned by ${empName}${empCode ? ` (${empCode})` : ''}`
       });

       // 4. Asset Timeline Record
       await logAssetTimeline({
         assetId: assetIdToUpdate,
         assetCode: astCode,
         eventType: 'RETURNED',
         title: 'Asset Returned',
         description: `Returned by ${empName}${empCode ? ` (${empCode})` : ''}`,
         oldStatus: 'ASSIGNED',
         newStatus: 'AVAILABLE',
         employeeId: emp?.id || null,
         employeeName: empName,
         performedById: req.user.id,
         performedByName: req.user.fullName
       });
    }

    memoryCache.delPrefix('assignments');
    memoryCache.delPrefix('assets');
    memoryCache.delPrefix('dashboard');
    res.json(record);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', requirePermission('ASSIGN_ASSETS'), async (req, res) => {
  try {
    const record = await prisma.assetAssignment.findUnique({ 
       where: { id: req.params.id },
       include: { 
         asset: true,
         employee: { include: { department: true } }
       }
    });
    if (!record) return res.status(404).json({ error: 'Assignment not found' });
    
    if (record.status === 'ACTIVE' && record.assetId) {
       await prisma.asset.update({
          where: { id: record.assetId },
          data: { status: 'AVAILABLE', assignedEmployeeId: null, assignmentType: 'STORE' }
       });
    }
    
    await prisma.assetAssignment.delete({ where: { id: req.params.id } });

    // Log Audit
    await logAudit({
      req,
      action: 'DELETE',
      module: 'ASSIGNMENTS',
      entityType: 'ASSIGNMENT',
      entityId: req.params.id,
      entityCode: record.asset?.assetCode,
      employeeOverride: record.employee ? {
        id: record.employee.id,
        fullName: record.employee.fullName,
        departmentName: record.employee.department?.name || null
      } : null,
      description: `Assignment record deleted for asset ${record.asset?.assetCode || 'Unknown'}`
    });

    memoryCache.delPrefix('assignments');
    memoryCache.delPrefix('assets');
    memoryCache.delPrefix('dashboard');
    res.json({ message: 'Deleted historical assignment record.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
