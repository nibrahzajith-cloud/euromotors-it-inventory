require('dotenv').config();
const prisma = require('./prismaClient');
const bcrypt = require('bcryptjs');

async function main() {
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash('Admin@123', salt);
  const user = await prisma.user.upsert({
    where: { email: 'nibrahz@euromotors.lk' },
    update: { 
      passwordHash, 
      role: 'ADMIN', 
      status: 'ACTIVE', 
      mustChangePassword: false 
    },
    create: {
      fullName: 'Nibrahz',
      email: 'nibrahz@euromotors.lk',
      passwordHash,
      role: 'ADMIN',
      status: 'ACTIVE',
      mustChangePassword: false
    }
  });
  console.log('User created/updated:', user.email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
