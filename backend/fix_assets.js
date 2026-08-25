require('dotenv').config();
const prisma = require('./prismaClient');

async function checkAndFixAssets() {
  process.env.DATABASE_URL = 'postgresql://neondb_owner:npg_2eU5aEvPLAqF@ep-curly-mud-at3hmcuq.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require';

  try {
    const total = await prisma.asset.count();
    console.log(`Total Assets: ${total}`);
    
    const availableEmployees = await prisma.asset.count({
      where: {
        status: 'AVAILABLE',
        assignmentType: 'EMPLOYEE'
      }
    });
    console.log(`Available assets mistakenly assigned to EMPLOYEE: ${availableEmployees}`);
    
    if (availableEmployees > 0) {
      console.log('Fixing available assets...');
      const result = await prisma.asset.updateMany({
        where: {
          status: 'AVAILABLE',
          assignmentType: 'EMPLOYEE'
        },
        data: {
          assignmentType: 'STORE'
        }
      });
      console.log(`Fixed ${result.count} assets to be STORE assignment type.`);
    }

    console.log('Done.');
  } catch(e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

checkAndFixAssets();
