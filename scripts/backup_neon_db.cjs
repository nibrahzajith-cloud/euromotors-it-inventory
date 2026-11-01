const fs = require('fs');
const path = require('path');
require('../backend/node_modules/dotenv').config({ path: path.join(__dirname, '..', 'backend', '.env') });
const prisma = require('../backend/prismaClient');

async function backupDatabase() {
  const backupDir = path.join(__dirname, '..', 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(backupDir, `db_backup_${timestamp}.json`);

  console.log('Starting full database backup from Neon...');
  
  const [
    users,
    rolePermissions,
    departments,
    locations,
    employees,
    assets,
    assetAssignments,
    maintenanceLogs,
    systemSettings,
    auditLogs,
    assetTimelines,
    assetDocuments,
    supportTickets
  ] = await Promise.all([
    prisma.user.findMany(),
    prisma.rolePermission.findMany(),
    prisma.department.findMany(),
    prisma.location.findMany(),
    prisma.employee.findMany(),
    prisma.asset.findMany(),
    prisma.assetAssignment.findMany(),
    prisma.maintenanceLog.findMany(),
    prisma.systemSettings.findMany(),
    prisma.auditLog.findMany(),
    prisma.assetTimeline.findMany(),
    prisma.assetDocument.findMany(),
    prisma.supportTicket.findMany()
  ]);

  const backupData = {
    metadata: {
      timestamp: new Date().toISOString(),
      source: 'Neon PostgreSQL Production DB',
      counts: {
        users: users.length,
        rolePermissions: rolePermissions.length,
        departments: departments.length,
        locations: locations.length,
        employees: employees.length,
        assets: assets.length,
        assetAssignments: assetAssignments.length,
        maintenanceLogs: maintenanceLogs.length,
        systemSettings: systemSettings.length,
        auditLogs: auditLogs.length,
        assetTimelines: assetTimelines.length,
        assetDocuments: assetDocuments.length,
        supportTickets: supportTickets.length
      }
    },
    tables: {
      users,
      rolePermissions,
      departments,
      locations,
      employees,
      assets,
      assetAssignments,
      maintenanceLogs,
      systemSettings,
      auditLogs,
      assetTimelines,
      assetDocuments,
      supportTickets
    }
  };

  fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2), 'utf8');
  console.log(`Backup completed successfully! Saved to: ${backupFile}`);
  console.log('Record counts:', backupData.metadata.counts);

  await prisma.$disconnect();
}

backupDatabase().catch(err => {
  console.error('Database backup failed:', err);
  process.exit(1);
});

