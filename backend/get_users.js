const prisma = require('./prismaClient');

async function main() {
  const users = await prisma.user.findMany({ select: { id: true, email: true, role: true, fullName: true } });
  console.log(JSON.stringify(users, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
