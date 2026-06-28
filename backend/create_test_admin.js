const prisma = require('./prismaClient');
const bcrypt = require('bcryptjs');

async function main() {
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash('Admin@123', salt);
  const user = await prisma.user.upsert({
    where: { email: 'test_admin@euromotors.com' },
    update: { passwordHash, role: 'ADMIN', status: 'ACTIVE', mustChangePassword: false },
    create: {
      fullName: 'Test Admin',
      email: 'test_admin@euromotors.com',
      passwordHash,
      role: 'ADMIN',
      status: 'ACTIVE',
      mustChangePassword: false
    }
  });
  console.log('Created test admin:', user.email);
}

main().catch(console.error).finally(() => prisma.$disconnect());
