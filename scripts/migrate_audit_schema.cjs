const path = require('path');
require('../backend/node_modules/dotenv').config({ path: path.join(__dirname, '..', 'backend', '.env') });
const { Pool } = require('../backend/node_modules/pg');

async function migrate() {
  console.log('Connecting to Neon PostgreSQL...');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('Applying AuditLog schema extensions on Neon...');

    await pool.query(`
      ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "userEmail" TEXT;
      ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "employeeId" TEXT;
      ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "employeeName" TEXT;
      ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "departmentName" TEXT;
      ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "initiatedById" TEXT;
      ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "executedBy" TEXT;
      ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "activityType" TEXT DEFAULT 'HUMAN';
      ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "changedFields" TEXT;
      ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT 'SUCCESS';
      ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "severity" TEXT DEFAULT 'INFO';
      ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "errorMessage" TEXT;
      ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "userAgent" TEXT;
      ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "correlationId" TEXT;

      CREATE INDEX IF NOT EXISTS "AuditLog_entityId_idx" ON "AuditLog"("entityId");
      CREATE INDEX IF NOT EXISTS "AuditLog_entityCode_idx" ON "AuditLog"("entityCode");
      CREATE INDEX IF NOT EXISTS "AuditLog_userId_idx" ON "AuditLog"("userId");
      CREATE INDEX IF NOT EXISTS "AuditLog_employeeId_idx" ON "AuditLog"("employeeId");
      CREATE INDEX IF NOT EXISTS "AuditLog_module_idx" ON "AuditLog"("module");
      CREATE INDEX IF NOT EXISTS "AuditLog_action_idx" ON "AuditLog"("action");
      CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
    `);

    console.log('Columns and indexes added successfully.');

    // Backfill historical audit records where userId matches a known user
    console.log('Backfilling known user identities in historical audit records...');
    const backfillRes = await pool.query(`
      UPDATE "AuditLog" a
      SET 
        "userName" = COALESCE(a."userName", u."fullName"),
        "userEmail" = COALESCE(a."userEmail", u."email"),
        "userRole" = COALESCE(a."userRole", u."role"::text),
        "initiatedById" = COALESCE(a."initiatedById", a."userId"),
        "activityType" = CASE WHEN a."userId" IS NOT NULL THEN 'HUMAN' ELSE 'SYSTEM' END
      FROM "User" u
      WHERE a."userId" = u."id" AND (a."userName" IS NULL OR a."userEmail" IS NULL);
    `);
    console.log(`Backfilled ${backfillRes.rowCount} historical audit records with user profiles.`);

    // Verify columns in Neon
    const cols = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'AuditLog';
    `);
    console.log('Current AuditLog columns in Neon:\n', cols.rows.map(r => r.column_name).join(', '));
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();

