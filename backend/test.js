const { PrismaClient } = require('@prisma/client'); 
const prisma = new PrismaClient(); 
async function main() { 
  const t = await prisma.supportTicket.findMany({ include: { employee: true, asset: true } }); 
  console.log(JSON.stringify(t, null, 2)); 
} 
main().finally(() => prisma.$disconnect());
