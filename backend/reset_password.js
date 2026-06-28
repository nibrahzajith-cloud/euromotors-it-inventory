const bcrypt = require('bcryptjs');
const prisma = require('./prismaClient');

async function main() {
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash('admin123', salt);
  await prisma.user.update({ where: { email: 'admin@euromotors.lk' }, data: { passwordHash: hash } });
  await prisma.user.update({ where: { email: 'nibrahz@euromotors.lk' }, data: { passwordHash: hash } });
  console.log('Passwords reset to admin123');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
