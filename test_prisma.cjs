const prisma = require('./backend/prismaClient');

async function testPrisma() {
    const emps = await prisma.employee.findMany();
    emps.forEach(e => {
        if (e.fullName.toLowerCase().includes('anj')) console.log(e.employeeCode, e.fullName);
    });
}

testPrisma().finally(() => prisma.$disconnect());
