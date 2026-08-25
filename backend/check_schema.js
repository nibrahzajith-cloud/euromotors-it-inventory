const prisma = require('./prismaClient');

async function countAssets() {
  try {
    const totalAssets = await prisma.$queryRawUnsafe(`SELECT COUNT(*) FROM "Asset"`);
    console.log("Total Asset rows:", totalAssets[0].count);

    const distinctCodes = await prisma.$queryRawUnsafe(`SELECT COUNT(DISTINCT "assetCode") FROM "Asset"`);
    console.log("Total distinct assetCode:", distinctCodes[0].count);
    
    // Other metrics requested by user
    const assignedEmployees = await prisma.$queryRawUnsafe(`SELECT COUNT(*) FROM "Asset" WHERE "assignmentType" = 'EMPLOYEE' AND status = 'ASSIGNED'`);
    console.log("Assigned to Employees:", assignedEmployees[0].count);
    
    const assignedDepts = await prisma.$queryRawUnsafe(`SELECT COUNT(*) FROM "Asset" WHERE "assignmentType" = 'DEPARTMENT' AND status = 'ASSIGNED'`);
    console.log("Assigned to Departments:", assignedDepts[0].count);
    
    const assignedLocs = await prisma.$queryRawUnsafe(`SELECT COUNT(*) FROM "Asset" WHERE "assignmentType" = 'LOCATION' AND status = 'ASSIGNED'`);
    console.log("Assigned to Locations:", assignedLocs[0].count);
    
    const store = await prisma.$queryRawUnsafe(`SELECT COUNT(*) FROM "Asset" WHERE "assignmentType" = 'STORE' OR status = 'AVAILABLE'`);
    console.log("Assets in Store:", store[0].count);
    
    const shared = await prisma.$queryRawUnsafe(`SELECT COUNT(*) FROM "Asset" WHERE "assignmentType" = 'SHARED'`);
    console.log("Shared Assets:", shared[0].count);
    
    const repair = await prisma.$queryRawUnsafe(`SELECT COUNT(*) FROM "Asset" WHERE status = 'UNDER_REPAIR'`);
    console.log("Under Repair:", repair[0].count);

  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

countAssets();
