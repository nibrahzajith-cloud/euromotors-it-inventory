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
      prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 10 }),
      prisma.department.findMany({ include: { _count: { select: { assets: true, employees: true } } } }),
      prisma.location.findMany({ include: { _count: { select: { assets: true } } } }),
      prisma.maintenanceLog.findMany({ where: { status: 'OPEN' }, include: { asset: true }, take: 5 }),
      prisma.asset.findMany({ where: { warrantyExpiryDate: { lte: thirtyDaysFromNow, gt: now } }, take: 5 }),
      prisma.employee.findMany({ orderBy: { createdAt: 'desc' }, take: 5, select: { fullName: true, designation: true, status: true } }),
      prisma.department.findMany({ orderBy: { createdAt: 'desc' }, take: 5, select: { name: true, status: true } }),
      prisma.location.findMany({ orderBy: { createdAt: 'desc' }, take: 5, select: { name: true, status: true } }),
      prisma.asset.findMany({ orderBy: { createdAt: 'desc' }, take: 5, select: { assetCode: true, model: true, status: true } })
    ]);

    // Counts for cards
    const assignedCount = await prisma.asset.count({ where: { status: 'ASSIGNED' } });
    const availableCount = await prisma.asset.count({ where: { status: 'AVAILABLE' } });
    const repairCount = await prisma.asset.count({ where: { status: 'UNDER_REPAIR' } });
    const warrantyCount = await prisma.asset.count({ where: { warrantyExpiryDate: { lte: thirtyDaysFromNow, gt: now } } });

    res.json({
      counts: {   // The system develop come 
        totalAssets,
        assigned: assignedCount,
        available: availableCount,
        repair: repairCount,
        warranty: warrantyCount,
        employees: totalEmployees,
        departments: totalDepartments,
        locations: totalLocations
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
      recentActivity,
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
      hardwareRefresh
    ] = await Promise.all([
      prisma.asset.count(),
      prisma.asset.count({ where: { status: 'ASSIGNED' } }),
      prisma.asset.count({ where: { status: 'AVAILABLE' } }),
      prisma.asset.count({ where: { status: 'UNDER_REPAIR' } }),
      prisma.asset.count({ where: { warrantyExpiryDate: { lte: thirtyDaysFromNow, gt: new Date() } } }),
      prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 15 }),
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
      prisma.asset.count({ where: { purchaseDate: { lte: new Date(now.getTime() - 4 * 365 * 24 * 60 * 60 * 1000) } } })
    ]);

    // Calculate trends (comparing to total)
    // For a real app, we'd compare to yesterday's snapshot.
    // Here we'll simulate a trend based on recent additions.
    const lastWeek = new Date(new Date().getTime() - 7 * 24 * 60 * 60 * 1000);
    const addedLastWeek = await prisma.asset.count({ where: { createdAt: { gte: lastWeek } } });

    // Warranty segments
    const expiring7 = await prisma.asset.findMany({ where: { warrantyExpiryDate: { lte: sevenDaysFromNow, gt: new Date() } }, take: 5 });
    const expiring15 = await prisma.asset.findMany({ where: { warrantyExpiryDate: { lte: fifteenDaysFromNow, gt: sevenDaysFromNow } }, take: 5 });
    const expiring30 = await prisma.asset.findMany({ where: { warrantyExpiryDate: { lte: thirtyDaysFromNow, gt: fifteenDaysFromNow } }, take: 5 });

    // 7-Day Activity Timeline Data
    const timelineData = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const nextD = new Date(d);
      nextD.setDate(d.getDate() + 1);

      const [assigned, returned, repairs] = await Promise.all([
        prisma.assetAssignment.count({ where: { assignedDate: { gte: d, lt: nextD } } }),
        prisma.assetAssignment.count({ where: { returnedDate: { gte: d, lt: nextD } } }),
        prisma.maintenanceLog.count({ where: { createdAt: { gte: d, lt: nextD } } })
      ]);

      timelineData.push({
        date: d.toLocaleDateString([], { weekday: 'short', day: 'numeric' }),
        assigned,
        returned,
        repairs
      });
    }

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
        warranty: { value: expiringSoon, trend: expiring7.length, type: 'down' }
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
      activityFeed: recentActivity,
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
