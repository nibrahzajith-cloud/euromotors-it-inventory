const prisma = require('./prismaClient');

async function applyFix() {
  try {
    console.log("Creating AssignmentType enum...");
    await prisma.$executeRawUnsafe(`
      CREATE TYPE "AssignmentType" AS ENUM ('EMPLOYEE', 'DEPARTMENT', 'LOCATION', 'SHARED', 'STORE');
    `);
    console.log("Enum created.");

    console.log("Adding assignmentType column to Asset...");
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Asset" ADD COLUMN "assignmentType" "AssignmentType" NOT NULL DEFAULT 'EMPLOYEE';
    `);
    console.log("Column added successfully.");
  } catch (err) {
    console.error("Error applying fix:", err);
  } finally {
    await prisma.$disconnect();
  }
}

applyFix();
