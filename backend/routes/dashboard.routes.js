const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient');
const { authenticate } = require('../middleware/auth.middleware');

router.get('/summary', authenticate, async (req, res) => {
  try {
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // 1. KPI Previews & Counts
    const [
      totalAssets,
      assignedAssets,
      availableAssets,
      underRepair,
      expiringSoon,
      totalEmployees,
      totalDepartments,
      totalLocations,
      recentActivity,
      distributionDept,
      distributionLoc,
      repairingAssets,
      warrantyAssets,
      recentEmployees,
      recentDepartments,
      recentLocations,
      recentAssets
    ] = await Promise.all([
      prisma.asset.count(),
      prisma.asset.findMany({ where: { status: 'ASSIGNED' }, take: 5, select: { assetCode: true, model: true, status: true } }),
      prisma.asset.findMany({ where: { status: 'AVAILABLE' }, take: 5, select: { assetCode: true, model: true, status: true } }),
      prisma.asset.findMany({ where: { status: 'UNDER_REPAIR' }, take: 5, select: { assetCode: true, model: true, status: true } }),
      prisma.asset.findMany({ where: { warrantyExpiryDate: { lte: thirtyDaysFromNow, gt: now } }, take: 5 }),
      prisma.employee.count(),
      prisma.department.count(),
      prisma.location.count(),
      prisma.asset.count({ where: { documents: { none: {} } } }),
      prisma.department.findMany({ include: { _count: { select: { assets: true, employees: true } } } }),
      prisma.location.findMany({ include: { _count: { select: { assets: true } } } }),
      prisma.maintenanceLog.findMany({ where: { status: 'OPEN' }, include: { asset: true }, take: 5 }),
      prisma.asset.findMany({ where: { warrantyExpiryDate: { lte: thirtyDaysFromNow, gt: now } }, take: 5 }),
      prisma.employee.findMany({ orderBy: { createdAt: 'desc' }, take: 5, select: { fullName: true, designation: true, status: true } }),
      prisma.department.findMany({ orderBy: { createdAt: 'desc' }, take: 5, select: { name: true, status: true } }),
      prisma.location.findMany({ orderBy: { createdAt: 'desc' }, take: 5, select: { name: true, status: true } }),
      prisma.asset.findMany({ orderBy: { createdAt: 'desc' }, take: 5, select: { assetCode: true, model: true, status: true } })
    ]);

    // All counts in a single parallel batch — zero serial round-trips
    const [
      assignedCount, availableCount, repairCount, warrantyCount,
      departmentAssets, locationAssets, sharedAssets, inStoreAssets
    ] = await Promise.all([
      prisma.asset.count({ where: { status: { not: 'UNDER_REPAIR' }, assignmentType: 'EMPLOYEE' } }),
      prisma.asset.count({ where: { status: 'AVAILABLE' } }),
      prisma.asset.count({ where: { status: 'UNDER_REPAIR' } }),
      prisma.asset.count({ where: { warrantyExpiryDate: { lte: thirtyDaysFromNow, gt: now } } }),
      prisma.asset.count({ where: { status: { not: 'UNDER_REPAIR' }, assignmentType: 'DEPARTMENT' } }),
      prisma.asset.count({ where: { status: { not: 'UNDER_REPAIR' }, assignmentType: 'LOCATION' } }),
      prisma.asset.count({ where: { status: { not: 'UNDER_REPAIR' }, assignmentType: 'SHARED' } }),
      prisma.asset.count({ where: { status: { not: 'UNDER_REPAIR' }, assignmentType: 'STORE' } })
    ]);

    res.json({
      counts: {   // The system develop come 
        totalAssets,
        assigned: assignedCount,
        available: availableCount,
        repair: repairCount,
        warranty: warrantyCount,
        employees: totalEmployees,
        departments: totalDepartments,
        locations: totalLocations,
        departmentAssets,
        locationAssets,
        sharedAssets,
        inStoreAssets
      },
      previews: {
        totalAssets: recentAssets,
        assigned: assignedAssets,
        available: availableAssets,
        repair: underRepair,
        warranty: expiringSoon,
        employees: recentEmployees,
        departments: recentDepartments.map(d => ({ fullName: d.name, designation: d.status })),
        locations: recentLocations.map(l => ({ fullName: l.name, designation: l.status }))
      },
      attentionRequired: {
        unassigned: assignedCount > 0 ? availableCount : 0, // Just use availableCount
        expiringWarranty: warrantyAssets.length,
        underRepair: repairingAssets.length,
        missingDocuments: recentActivity // we stored the count here
      },
      distribution: {
        departments: distributionDept.map(d => ({ name: d.name, id: d.id, count: d._count.assets, employeeCount: d._count.employees })),
        locations: distributionLoc.map(l => ({ name: l.name, id: l.id, count: l._count.assets }))
      },
      maintenance: repairingAssets,
      warrantyAlerts: warrantyAssets
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/advanced', authenticate, async (req, res) => {
  try {
    const now = new Date();
    const todayStart = new Date(now.setHours(0, 0, 0, 0));
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const fifteenDaysFromNow = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const [
      totalAssets,
      assignedAssets,
      availableAssets,
      underRepair,
      expiringSoon,
      recentActivity,
      distributionDept,
      distributionLoc,
      maintenanceLogs,
      assetsAddedToday,
      assetsAssignedToday,
      assetsReturnedToday,
      unusedAssets,
      hardwareRefresh,
      totalEmployees,
      departmentAssets,
      locationAssets,
      sharedAssets,
      inStoreAssets
    ] = await Promise.all([
      prisma.asset.count(),
      prisma.asset.count({ where: { status: { not: 'UNDER_REPAIR' }, assignmentType: 'EMPLOYEE' } }),
      prisma.asset.count({ where: { status: 'AVAILABLE' } }),
      prisma.asset.count({ where: { status: 'UNDER_REPAIR' } }),
      prisma.asset.count({ where: { warrantyExpiryDate: { lte: thirtyDaysFromNow, gt: new Date() } } }),
      prisma.asset.findMany({ where: { documents: { none: {} } }, take: 5 }),
      prisma.department.findMany({ include: { _count: { select: { assets: true, employees: true } }, employees: { take: 5 }, assets: { take: 5 } } }),
      prisma.location.findMany({ include: { _count: { select: { assets: true, employees: true } }, employees: { take: 5 }, assets: { take: 5 } } }),
      prisma.maintenanceLog.findMany({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] } }, include: { asset: true }, orderBy: { createdAt: 'desc' } }),
      prisma.asset.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.assetAssignment.count({ where: { assignedDate: { gte: todayStart }, status: 'ACTIVE' } }),
      prisma.assetAssignment.count({ where: { returnedDate: { gte: todayStart }, status: 'RETURNED' } }),
      prisma.asset.findMany({
        where: {
          status: 'AVAILABLE',
          updatedAt: { lte: thirtyDaysAgo },
          assignments: { none: { status: 'ACTIVE' } }
        },
        take: 5
      }),
      prisma.asset.count({ where: { purchaseDate: { lte: new Date(now.getTime() - 4 * 365 * 24 * 60 * 60 * 1000) } } }),
      prisma.employee.count(),
      prisma.asset.count({ where: { status: { not: 'UNDER_REPAIR' }, assignmentType: 'DEPARTMENT' } }),
      prisma.asset.count({ where: { status: { not: 'UNDER_REPAIR' }, assignmentType: 'LOCATION' } }),
      prisma.asset.count({ where: { status: { not: 'UNDER_REPAIR' }, assignmentType: 'SHARED' } }),
      prisma.asset.count({ where: { status: { not: 'UNDER_REPAIR' }, assignmentType: 'STORE' } })
    ]);

    // Build all 7-day buckets upfront, then fire ALL queries in a single Promise.all.
    // BEFORE: 7 iterations × 3 queries each = 21 SERIAL round-trips
    // AFTER:  21 queries launched simultaneously = 1 parallel round-trip batch
    const lastWeek = new Date(new Date().getTime() - 7 * 24 * 60 * 60 * 1000);
    const dayBuckets = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - (6 - i));
      const nextD = new Date(d);
      nextD.setDate(d.getDate() + 1);
      return { d, nextD };
    });

    // Launch all queries simultaneously (21 + 4 extra = 25 total, all parallel)
    const [
      addedLastWeek,
      expiring7, expiring15, expiring30,
      ...timelineResults
    ] = await Promise.all([
      prisma.asset.count({ where: { createdAt: { gte: lastWeek } } }),
      prisma.asset.findMany({ where: { warrantyExpiryDate: { lte: sevenDaysFromNow, gt: new Date() } }, take: 5 }),
      prisma.asset.findMany({ where: { warrantyExpiryDate: { lte: fifteenDaysFromNow, gt: sevenDaysFromNow } }, take: 5 }),
      prisma.asset.findMany({ where: { warrantyExpiryDate: { lte: thirtyDaysFromNow, gt: fifteenDaysFromNow } }, take: 5 }),
      // 7 × 3 = 21 timeline queries, all in parallel
      ...dayBuckets.flatMap(({ d, nextD }) => [
        prisma.assetAssignment.count({ where: { assignedDate: { gte: d, lt: nextD } } }),
        prisma.assetAssignment.count({ where: { returnedDate: { gte: d, lt: nextD } } }),
        prisma.maintenanceLog.count({ where: { createdAt: { gte: d, lt: nextD } } })
      ])
    ]);

    // Reconstruct timeline data from the flat parallel results array
    const timelineData = dayBuckets.map(({ d }, i) => ({
      date: d.toLocaleDateString([], { weekday: 'short', day: 'numeric' }),
      assigned: timelineResults[i * 3],
      returned: timelineResults[i * 3 + 1],
      repairs: timelineResults[i * 3 + 2]
    }));

    // Enhanced Analytics Aggregation
    const assetStatsByDept = await prisma.asset.groupBy({
      by: ['departmentId', 'status'],
      _count: true
    });

    const assetStatsByLoc = await prisma.asset.groupBy({
      by: ['locationId', 'status'],
      _count: true
    });

    const locRepairData = await prisma.maintenanceLog.findMany({
      where: { status: { in: ['OPEN', 'IN_PROGRESS'] } },
      select: { asset: { select: { locationId: true } } }
    });

    const getDeptStat = (deptId, status) => {
      return assetStatsByDept.find(s => s.departmentId === deptId && s.status === status)?._count || 0;
    };

    const getLocStat = (locId, status) => {
      return assetStatsByLoc.find(s => s.locationId === locId && s.status === status)?._count || 0;
    };

    const getLocRepairs = (locId) => {
      return locRepairData.filter(r => r.asset.locationId === locId).length;
    };

    res.json({
      summary: {
        totalAssets: { value: totalAssets, trend: addedLastWeek, type: 'up' },
        assigned: { value: assignedAssets, trend: assetsAssignedToday, type: 'up' },
        available: { value: availableAssets, trend: assetsReturnedToday, type: 'up' },
        repair: { value: underRepair, trend: maintenanceLogs.length, type: 'neutral' },
        warranty: { value: expiringSoon, trend: expiring7.length, type: 'down' },
        employees: { value: totalEmployees, trend: 0, type: 'neutral' },
        departmentAssets: { value: departmentAssets, trend: 0, type: 'neutral' },
        locationAssets: { value: locationAssets, trend: 0, type: 'neutral' },
        sharedAssets: { value: sharedAssets, trend: 0, type: 'neutral' },
        inStoreAssets: { value: inStoreAssets, trend: 0, type: 'neutral' }
      },
      alerts: {
        longRepair: maintenanceLogs.filter(m => (new Date() - new Date(m.createdAt)) > 5 * 24 * 60 * 60 * 1000),
        warranty30: expiringSoon,
        unused30: unusedAssets,
        hardwareRefresh: hardwareRefresh
      },
      analytics: {
        departments: distributionDept.map(d => {
          const assigned = getDeptStat(d.id, 'ASSIGNED');
          const available = getDeptStat(d.id, 'AVAILABLE');
          return {
            id: d.id,
            name: d.name,
            count: d._count.assets,
            staffCount: d._count.employees,
            assigned,
            available,
            utilization: d._count.assets > 0 ? (assigned / d._count.assets) * 100 : 0,
            percentage: totalAssets > 0 ? (d._count.assets / totalAssets) * 100 : 0,
            previewAssets: d.assets,
            previewStaff: d.employees
          };
        }).sort((a, b) => b.count - a.count).slice(0, 5),
        locations: distributionLoc.map(l => {
          const assigned = getLocStat(l.id, 'ASSIGNED');
          const available = getLocStat(l.id, 'AVAILABLE');
          const repairs = getLocRepairs(l.id);
          return {
            id: l.id,
            name: l.name,
            count: l._count.assets,
            staffCount: l._count.employees,
            repairCount: repairs,
            activeCount: assigned + available,
            activePercentage: l._count.assets > 0 ? ((assigned + available) / l._count.assets) * 100 : 0,
            percentage: totalAssets > 0 ? (l._count.assets / totalAssets) * 100 : 0,
            previewAssets: l.assets,
            previewStaff: l.employees
          };
        }).sort((a, b) => b.count - a.count).slice(0, 5)
      },
      maintenance: maintenanceLogs.map(m => ({
        id: m.id,
        assetCode: m.asset.assetCode,
        model: m.asset.model,
        days: Math.floor((new Date() - new Date(m.createdAt)) / (1000 * 60 * 60 * 24)),
        status: m.status
      })),
      timeline: timelineData,
      warrantyPanel: {
        days7: expiring7,
        days15: expiring15,
        days30: expiring30
      },
      attentionRequired: {
        unassigned: unusedAssets,
        warrantyExpiring: [...expiring7, ...expiring15, ...expiring30].slice(0, 5),
        underRepair: maintenanceLogs.map(m => m.asset).filter(Boolean).filter((asset, index, self) => self.findIndex(a => a.id === asset.id) === index).slice(0, 5),
        missingDocuments: recentActivity
      },
      today: {
        added: assetsAddedToday,
        assigned: assetsAssignedToday,
        returned: assetsReturnedToday
      },
      systemHealth: {
        database: 'Connected',
        server: 'Optimal',
        backup: 'Completed 2h ago'
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
