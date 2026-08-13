require('dotenv').config();
const prisma = require('./prismaClient');

async function check() {
  const assets = await prisma.asset.findMany({ select: { assetCode: true } });
  const employees = await prisma.employee.findMany({ select: { employeeCode: true } });
  
  let oldAsset = 0, newAsset = 0, otherAsset = 0;
  for (let a of assets) {
    if (a.assetCode.match(/^AST-\d{5}-001$/) || a.assetCode.match(/^EM-IT-LAP-/)) oldAsset++;
    else if (a.assetCode.match(/^AST-\d{9}$/)) newAsset++;
    else otherAsset++;
  }
  
  let oldEmp = 0, newEmp = 0, otherEmp = 0;
  for (let e of employees) {
    if (e.employeeCode.match(/^EMP-\d{5}-001$/)) oldEmp++;
    else if (e.employeeCode.match(/^EMP-\d{9}$/)) newEmp++;
    else otherEmp++;
  }

  console.log('--- DATABASE STATUS ---');
  console.log('Total Assets:', assets.length);
  console.log('Old Asset Format:', oldAsset);
  console.log('New Asset Format:', newAsset);
  console.log('Other Asset Format:', otherAsset);
  if (assets.length > 0) {
    console.log('Asset Samples:', assets.slice(0, 3).map(a => a.assetCode));
  }
  
  console.log('Total Employees:', employees.length);
  console.log('Old Employee Format:', oldEmp);
  console.log('New Employee Format:', newEmp);
  console.log('Other Employee Format:', otherEmp);
  if (employees.length > 0) {
      console.log('Employee Samples:', employees.slice(0, 3).map(e => e.employeeCode));
  }
  
  const lastOldEmp = await prisma.employee.findFirst({
    where: { employeeCode: { startsWith: 'EMP-', endsWith: '-001' } },
    orderBy: { employeeCode: 'desc' }
  });
  console.log('Highest Old Emp:', lastOldEmp?.employeeCode);

  const lastOldAst = await prisma.asset.findFirst({
    where: { assetCode: { startsWith: 'AST-', endsWith: '-001' } },
    orderBy: { assetCode: 'desc' }
  });
  console.log('Highest Old Ast:', lastOldAst?.assetCode);

  await prisma.$disconnect();
}
check().catch(console.error);
