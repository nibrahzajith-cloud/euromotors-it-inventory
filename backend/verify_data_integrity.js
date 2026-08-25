const prisma = require('./prismaClient');

async function verifyDataIntegrity() {
  try {
    console.log("=== ASSIGNMENT TYPE INTEGRITY CHECK ===");
    
    // Count of each assignmentType
    const types = ['EMPLOYEE', 'DEPARTMENT', 'LOCATION', 'SHARED', 'STORE'];
    for (const t of types) {
      const count = await prisma.$queryRawUnsafe(`SELECT COUNT(*) FROM "Asset" WHERE "assignmentType" = '${t}'`);
      console.log(`Count of ${t}: ${count[0].count}`);
    }

    // Identify mismatches: ASSIGNED but wrong type? Or AVAILABLE but wrong type?
    // User asked: "verify whether the 112 assigned assets and 32 available/store assets have the correct assignmentType"
    // Since we just added the column with DEFAULT 'EMPLOYEE', all 144 assets will have 'EMPLOYEE'!
    // Let's confirm this:
    const assignedButNotEmployee = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*) FROM "Asset" 
      WHERE status = 'ASSIGNED' AND "assignmentType" != 'EMPLOYEE'
    `);
    const availableButEmployee = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*) FROM "Asset" 
      WHERE status = 'AVAILABLE' AND "assignmentType" = 'EMPLOYEE'
    `);

    console.log("Assigned but NOT EMPLOYEE:", assignedButNotEmployee[0].count);
    console.log("Available (Store) but marked as EMPLOYEE:", availableButEmployee[0].count);

  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

verifyDataIntegrity();
