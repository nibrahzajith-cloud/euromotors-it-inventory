require('dotenv').config();
const prisma = require('./prismaClient');
const bcrypt = require('bcryptjs');

async function main() {
  const email = 'test_admin@euromotors.com';
  const plainPassword = 'Admin@123';

  console.log(`Checking user: ${email}...`);
  console.log(`Using Database URL: ${process.env.DATABASE_URL.substring(0, 30)}...`);
  
  let user = await prisma.user.findUnique({ where: { email } });
  
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(plainPassword, salt);

  if (!user) {
    console.log(`User not found. Creating user ${email}...`);
    user = await prisma.user.create({
      data: {
        email,
        fullName: 'Test Admin',
        passwordHash,
        role: 'ADMIN',
        status: 'ACTIVE'
      }
    });
    console.log(`Created user with ID: ${user.id}`);
  } else {
    console.log(`User found. Resetting password for ${email}...`);
    user = await prisma.user.update({
      where: { email },
      data: { 
        passwordHash,
        role: 'ADMIN',
        status: 'ACTIVE'
      }
    });
    console.log(`Password reset for user ID: ${user.id}`);
  }

  // Verify compare logic
  const isMatch = await bcrypt.compare(plainPassword, user.passwordHash);
  console.log(`Verification - password match: ${isMatch}`);
  
  const activeCount = await prisma.user.count();
  console.log(`Total users in DB: ${activeCount}`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
