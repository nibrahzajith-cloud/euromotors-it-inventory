const prisma = require('./prismaClient');
const { generateAssetCode, generateEmployeeCode } = require('./utils/codeGenerator');

async function testGeneration() {
  const astCode = await generateAssetCode(prisma);
  const empCode = await generateEmployeeCode(prisma);
  console.log('Generated Asset:', astCode);
  console.log('Generated Employee:', empCode);
  await prisma.$disconnect();
}
testGeneration().catch(e => { console.error(e); process.exit(1); });
