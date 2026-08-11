require('dotenv').config();
const prisma = require('./prismaClient');

async function migrateCodes() {
  console.log('Starting migration of Asset and Employee codes...');

  // EMPLOYEES
  const employees = await prisma.employee.findMany({ select: { id: true, employeeCode: true } });
  let empUpdated = 0;
  for (let emp of employees) {
    const match = emp.employeeCode.match(/^EMP-(\d+)-001$/i);
    if (match) {
      const numStr = match[1];
      const newCode = `EMP-${numStr.padStart(9, '0')}`;
      await prisma.employee.update({
        where: { id: emp.id },
        data: { employeeCode: newCode }
      });
      empUpdated++;
    }
  }
  console.log(`Migrated ${empUpdated} Employee codes.`);

  // ASSETS
  const assets = await prisma.asset.findMany({ select: { id: true, assetCode: true } });
  let astUpdated = 0;
  for (let ast of assets) {
    const match = ast.assetCode.match(/^AST-(\d+)-001$/i);
    if (match) {
      const numStr = match[1];
      const newCode = `AST-${numStr.padStart(9, '0')}`;
      await prisma.asset.update({
        where: { id: ast.id },
        data: { assetCode: newCode }
      });
      astUpdated++;
    } else {
        const emMatch = ast.assetCode.match(/^EM-IT-LAP-(\d+)$/i);
        if (emMatch) {
            const numStr = emMatch[1];
            const newCode = `AST-${numStr.padStart(9, '0')}`;
            await prisma.asset.update({
              where: { id: ast.id },
              data: { assetCode: newCode }
            });
            astUpdated++;
        }
    }
  }
  console.log(`Migrated ${astUpdated} Asset codes.`);

  // Audit Logs - Optional, but good practice since Audit Logs might store literal code strings.
  // It's a bit harder to migrate every text description, but we can migrate entityCode.
  const logs = await prisma.auditLog.findMany({ 
      where: { 
          OR: [
              { entityCode: { startsWith: 'EMP-' } },
              { entityCode: { startsWith: 'AST-' } }
          ]
      },
      select: { id: true, entityCode: true }
  });
  
  let logUpdated = 0;
  for (let log of logs) {
      if (!log.entityCode) continue;
      
      let newEntityCode = null;
      const empMatch = log.entityCode.match(/^EMP-(\d+)-001$/i);
      if (empMatch) newEntityCode = `EMP-${empMatch[1].padStart(9, '0')}`;
      
      const astMatch = log.entityCode.match(/^AST-(\d+)-001$/i);
      if (astMatch) newEntityCode = `AST-${astMatch[1].padStart(9, '0')}`;
      
      if (newEntityCode) {
          await prisma.auditLog.update({
              where: { id: log.id },
              data: { entityCode: newEntityCode }
          });
          logUpdated++;
      }
  }
  console.log(`Migrated ${logUpdated} Audit Log entityCodes.`);
  
  // AssetTimeline
  const timelines = await prisma.assetTimeline.findMany({
      where: { assetCode: { startsWith: 'AST-' } },
      select: { id: true, assetCode: true }
  });
  let tlUpdated = 0;
  for (let tl of timelines) {
      if (!tl.assetCode) continue;
      
      let newAssetCode = null;
      const astMatch = tl.assetCode.match(/^AST-(\d+)-001$/i);
      if (astMatch) newAssetCode = `AST-${astMatch[1].padStart(9, '0')}`;
      
      if (newAssetCode) {
          await prisma.assetTimeline.update({
              where: { id: tl.id },
              data: { assetCode: newAssetCode }
          });
          tlUpdated++;
      }
  }
  console.log(`Migrated ${tlUpdated} Asset Timeline assetCodes.`);

  await prisma.$disconnect();
  console.log('Migration complete!');
}

migrateCodes().catch(e => {
    console.error(e);
    process.exit(1);
});
