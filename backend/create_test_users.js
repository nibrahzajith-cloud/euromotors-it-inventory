const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  const users = [
    { email: 'admin@euromotors.local', role: 'ADMIN', fullName: 'Test Admin' },
    { email: 'it@euromotors.local', role: 'IT_OFFICER', fullName: 'Test IT' },
    { email: 'viewer@euromotors.local', role: 'VIEWER', fullName: 'Test Viewer' }
  ];

  const salt = await bcrypt.genSalt(8);
  const passwordHash = await bcrypt.hash('TestPassword123!', salt);

  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { passwordHash, role: u.role, status: 'ACTIVE' },
      create: {
        email: u.email,
        fullName: u.fullName,
        role: u.role,
        passwordHash,
        status: 'ACTIVE'
      }
    });
    console.log(`User ${u.email} ready (Role: ${u.role})`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
