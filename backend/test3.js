const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Get an employee
  const emp = await prisma.employee.findFirst();
  if (!emp) {
    console.log("No employees found!");
    return;
  }
  
  // Create ticket
  const t = await prisma.supportTicket.create({
    data: {
      ticketCode: "TKT-TEST",
      subject: "Test Issue",
      description: "This is a test",
      priority: "HIGH",
      employeeId: emp.id
    }
  });
  
  console.log("Created:", t);
  
  // Fetch tickets
  const tickets = await prisma.supportTicket.findMany({
    include: { employee: true, asset: true }
  });
  console.log("All tickets:");
  console.log(JSON.stringify(tickets, null, 2));
}

main().finally(() => prisma.$disconnect());
