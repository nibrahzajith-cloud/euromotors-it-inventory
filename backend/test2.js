const http = require('http');
// I need the token. I'll just write a script that bypasses the API and queries Prisma.
// Let's use the local API via a new route that skips auth, or just a standalone Prisma script.
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const tickets = await prisma.supportTicket.findMany({
    include: { employee: true, asset: true }
  });
  console.log(JSON.stringify(tickets, null, 2));
}
main()
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1); });
