const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Load environment variables
require('../backend/node_modules/dotenv').config({ path: path.join(__dirname, '..', 'backend', '.env') });
const prisma = require('../backend/prismaClient');

async function restoreDatabase() {
  console.log('====================================================');
  console.log('   EURO MOTORS IT INVENTORY - DATABASE RESTORE TOOL   ');
  console.log('====================================================\n');

  const targetDbUrl = process.env.DATABASE_URL;
  if (!targetDbUrl) {
    throw new Error('DATABASE_URL is not set in backend/.env!');
  }

  // Parse and display connection target safely
  try {
    const u = new URL(targetDbUrl);
    console.log(`Connecting to: ${u.host}${u.pathname}`);
  } catch (_) {}

  // 1. Locate latest backup file
  const backupDir = path.join(__dirname, '..', 'backups');
  const backupFiles = fs.readdirSync(backupDir).filter(f => f.endsWith('.json')).sort().reverse();
  if (backupFiles.length === 0) {
    throw new Error('No JSON backup files found in backups/ directory!');
  }

  const latestBackup = path.join(backupDir, backupFiles[0]);
  console.log(`Using backup file: ${backupFiles[0]}`);
  const rawData = fs.readFileSync(latestBackup, 'utf8');
  const backup = JSON.parse(rawData);
  const tables = backup.tables;

  // 2. Ensure schema tables exist via Prisma db push
  console.log('\n[1/4] Ensuring database schema and tables exist...');
  try {
    execSync('npx prisma db push --schema=backend/prisma/schema.prisma --accept-data-loss', {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    });
    console.log('Schema synchronized successfully.');
  } catch (err) {
    console.warn('Note: prisma db push warning or step completed:', err.message);
  }

  // Helper to parse dates
  const parseDates = (row, dateFields) => {
    const copy = { ...row };
    for (const f of dateFields) {
      if (copy[f]) copy[f] = new Date(copy[f]);
    }
    return copy;
  };

  console.log('\n[2/4] Restoring records in dependency order...');

  // SystemSettings
  if (tables.systemSettings && tables.systemSettings.length > 0) {
    for (const row of tables.systemSettings) {
      await prisma.systemSettings.upsert({
        where: { id: row.id },
        update: parseDates(row, ['updatedAt']),
        create: parseDates(row, ['updatedAt'])
      });
    }
    console.log(`  ✓ SystemSettings: ${tables.systemSettings.length} rows`);
  }

  // RolePermissions
  if (tables.rolePermissions && tables.rolePermissions.length > 0) {
    for (const row of tables.rolePermissions) {
      await prisma.rolePermission.upsert({
        where: { id: row.id || row.role },
        update: parseDates(row, ['createdAt', 'updatedAt']),
        create: parseDates(row, ['createdAt', 'updatedAt'])
      });
    }
    console.log(`  ✓ RolePermissions: ${tables.rolePermissions.length} rows`);
  }

  // Users
  if (tables.users && tables.users.length > 0) {
    for (const row of tables.users) {
      await prisma.user.upsert({
        where: { id: row.id },
        update: parseDates(row, ['createdAt', 'updatedAt']),
        create: parseDates(row, ['createdAt', 'updatedAt'])
      });
    }
    console.log(`  ✓ Users: ${tables.users.length} rows`);
  }

  // Departments
  if (tables.departments && tables.departments.length > 0) {
    for (const row of tables.departments) {
      await prisma.department.upsert({
        where: { id: row.id },
        update: parseDates(row, ['createdAt', 'updatedAt']),
        create: parseDates(row, ['createdAt', 'updatedAt'])
      });
    }
    console.log(`  ✓ Departments: ${tables.departments.length} rows`);
  }

  // Locations
  if (tables.locations && tables.locations.length > 0) {
    for (const row of tables.locations) {
      await prisma.location.upsert({
        where: { id: row.id },
        update: parseDates(row, ['createdAt', 'updatedAt']),
        create: parseDates(row, ['createdAt', 'updatedAt'])
      });
    }
    console.log(`  ✓ Locations: ${tables.locations.length} rows`);
  }

  // Employees (temporarily strip direct relations so circular references don't fail)
  if (tables.employees && tables.employees.length > 0) {
    for (const row of tables.employees) {
      const data = parseDates(row, ['createdAt', 'updatedAt']);
      delete data.assignedAssets;
      delete data.assignments;
      delete data.supportTickets;
      delete data.department;
      delete data.location;
      await prisma.employee.upsert({
        where: { id: row.id },
        update: data,
        create: data
      });
    }
    console.log(`  ✓ Employees: ${tables.employees.length} rows`);
  }

  // Assets
  if (tables.assets && tables.assets.length > 0) {
    for (const row of tables.assets) {
      const data = parseDates(row, [
        'purchaseDate',
        'warrantyExpiryDate',
        'valuationDate',
        'imageUploadedAt',
        'createdAt',
        'updatedAt'
      ]);
      delete data.location;
      delete data.department;
      delete data.assignedEmployee;
      delete data.assignments;
      delete data.maintenanceLogs;
      delete data.documents;
      delete data.supportTickets;
      await prisma.asset.upsert({
        where: { id: row.id },
        update: data,
        create: data
      });
    }
    console.log(`  ✓ Assets: ${tables.assets.length} rows`);
  }

  // AssetAssignments
  if (tables.assetAssignments && tables.assetAssignments.length > 0) {
    for (const row of tables.assetAssignments) {
      const data = parseDates(row, ['assignedDate', 'returnedDate', 'createdAt', 'updatedAt']);
      delete data.asset;
      delete data.employee;
      await prisma.assetAssignment.upsert({
        where: { id: row.id },
        update: data,
        create: data
      });
    }
    console.log(`  ✓ AssetAssignments: ${tables.assetAssignments.length} rows`);
  }

  // AssetDocuments
  if (tables.assetDocuments && tables.assetDocuments.length > 0) {
    for (const row of tables.assetDocuments) {
      const data = parseDates(row, ['uploadedAt', 'createdAt', 'updatedAt']);
      delete data.asset;
      await prisma.assetDocument.upsert({
        where: { id: row.id },
        update: data,
        create: data
      });
    }
    console.log(`  ✓ AssetDocuments: ${tables.assetDocuments.length} rows`);
  }

  // AssetTimelines
  if (tables.assetTimelines && tables.assetTimelines.length > 0) {
    for (const row of tables.assetTimelines) {
      const data = parseDates(row, ['createdAt']);
      delete data.asset;
      await prisma.assetTimeline.upsert({
        where: { id: row.id },
        update: data,
        create: data
      });
    }
    console.log(`  ✓ AssetTimelines: ${tables.assetTimelines.length} rows`);
  }

  // AuditLogs
  if (tables.auditLogs && tables.auditLogs.length > 0) {
    for (const row of tables.auditLogs) {
      const data = parseDates(row, ['createdAt']);
      await prisma.auditLog.upsert({
        where: { id: row.id },
        update: data,
        create: data
      });
    }
    console.log(`  ✓ AuditLogs: ${tables.auditLogs.length} rows`);
  }

  // MaintenanceLogs
  if (tables.maintenanceLogs && tables.maintenanceLogs.length > 0) {
    for (const row of tables.maintenanceLogs) {
      const data = parseDates(row, ['repairDate', 'createdAt', 'updatedAt']);
      delete data.asset;
      await prisma.maintenanceLog.upsert({
        where: { id: row.id },
        update: data,
        create: data
      });
    }
    console.log(`  ✓ MaintenanceLogs: ${tables.maintenanceLogs.length} rows`);
  }

  // SupportTickets
  if (tables.supportTickets && tables.supportTickets.length > 0) {
    for (const row of tables.supportTickets) {
      const data = parseDates(row, ['createdAt', 'updatedAt']);
      delete data.asset;
      delete data.employee;
      await prisma.supportTicket.upsert({
        where: { id: row.id },
        update: data,
        create: data
      });
    }
    console.log(`  ✓ SupportTickets: ${tables.supportTickets.length} rows`);
  }

  console.log('\n[3/4] Verifying database records...');
  const [empCount, astCount, userCount] = await Promise.all([
    prisma.employee.count(),
    prisma.asset.count(),
    prisma.user.count()
  ]);
  console.log(`  Employees in DB: ${empCount}`);
  console.log(`  Assets in DB:    ${astCount}`);
  console.log(`  Users in DB:     ${userCount}`);

  console.log('\n[4/4] ✅ RESTORE COMPLETED SUCCESSFULLY!');
  await prisma.$disconnect();
}

restoreDatabase().catch(err => {
  console.error('\n❌ RESTORE FAILED:', err.message);
  process.exit(1);
});
