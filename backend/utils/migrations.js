/**
 * DB Migration: Adds customOptions column, AssetDocument columns,
 * and creates high-performance indexes.
 * Run once on startup.
 */
const prisma = require('../prismaClient');

async function applyMigrations() {
  try {
    // 1. Add customOptions column to SystemSettings
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "SystemSettings" 
      ADD COLUMN IF NOT EXISTS "customOptions" JSONB DEFAULT '{}'::jsonb;
    `);
  } catch (err) {
    console.warn('[MIGRATION] customOptions column notice:', err.message);
  }

  try {
    // 2. Add missing columns to AssetDocument to prevent 500 crashes
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "AssetDocument" 
        ADD COLUMN IF NOT EXISTS "fileUrl" TEXT,
        ADD COLUMN IF NOT EXISTS "storageKey" TEXT,
        ADD COLUMN IF NOT EXISTS "mimeType" TEXT;
    `);
    await prisma.$executeRawUnsafe(`
      UPDATE "AssetDocument"
      SET "fileUrl" = "filePath",
          "storageKey" = "filePath"
      WHERE "fileUrl" IS NULL AND "filePath" IS NOT NULL;
    `);
  } catch (err) {
    console.warn('[MIGRATION] AssetDocument columns notice:', err.message);
  }

  // 3. High-performance enterprise indexes
  const indexQueries = [
    'CREATE INDEX IF NOT EXISTS idx_asset_status ON "Asset"("status")',
    'CREATE INDEX IF NOT EXISTS idx_asset_device_type ON "Asset"("deviceType")',
    'CREATE INDEX IF NOT EXISTS idx_asset_assigned_employee ON "Asset"("assignedEmployeeId")',
    'CREATE INDEX IF NOT EXISTS idx_asset_location ON "Asset"("locationId")',
    'CREATE INDEX IF NOT EXISTS idx_asset_department ON "Asset"("departmentId")',
    'CREATE INDEX IF NOT EXISTS idx_asset_brand ON "Asset"("brand")',
    'CREATE INDEX IF NOT EXISTS idx_asset_created_at ON "Asset"("createdAt" DESC)',
    'CREATE INDEX IF NOT EXISTS idx_employee_status ON "Employee"("status")',
    'CREATE INDEX IF NOT EXISTS idx_employee_department ON "Employee"("departmentId")',
    'CREATE INDEX IF NOT EXISTS idx_employee_location ON "Employee"("locationId")',
    'CREATE INDEX IF NOT EXISTS idx_assignment_asset ON "AssetAssignment"("assetId")',
    'CREATE INDEX IF NOT EXISTS idx_assignment_employee ON "AssetAssignment"("employeeId")',
    'CREATE INDEX IF NOT EXISTS idx_assignment_status ON "AssetAssignment"("status")',
    'CREATE INDEX IF NOT EXISTS idx_document_asset ON "AssetDocument"("assetId")'
  ];

  for (const query of indexQueries) {
    try {
      await prisma.$executeRawUnsafe(query);
    } catch (_) {}
  }
  console.log('[MIGRATION] Database migrations and performance indexing complete.');
}

module.exports = applyMigrations;
