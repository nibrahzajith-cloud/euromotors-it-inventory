const prisma = require('./prismaClient');

async function main() {
  const emp = await prisma.employee.findFirst({ orderBy: { employeeCode: 'desc' } });
  console.log(emp ? emp.employeeCode : 'No employees found');
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
