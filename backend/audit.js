const { PrismaClient } = require('@prisma/client'); 
const prisma = new PrismaClient(); 

async function audit() { 
  const total = await prisma.asset.count(); 
  const emp = await prisma.asset.count({where: {assignmentType: 'EMPLOYEE'}}); 
  const dept = await prisma.asset.count({where: {assignmentType: 'DEPARTMENT'}}); 
  const loc = await prisma.asset.count({where: {assignmentType: 'LOCATION'}}); 
  const shared = await prisma.asset.count({where: {assignmentType: 'SHARED'}}); 
  const store = await prisma.asset.count({where: {assignmentType: 'STORE'}}); 
  console.log(JSON.stringify({total, emp, dept, loc, shared, store}, null, 2)); 
} 

audit().finally(() => prisma.$disconnect());
