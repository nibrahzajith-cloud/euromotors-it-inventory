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
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'AssetDocument' AND column_name = 'filePath'
        ) THEN
          UPDATE "AssetDocument"
          SET "fileUrl" = "filePath",
              "storageKey" = "filePath"
          WHERE "fileUrl" IS NULL AND "filePath" IS NOT NULL;
        END IF;
      END $$;
    `);
  } catch (err) {
    console.warn('[MIGRATION] AssetDocument columns notice:', err.message);
  }

  try {
    // 3. Add accessories column to Asset
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Asset" 
      ADD COLUMN IF NOT EXISTS "accessories" JSONB DEFAULT '[]'::jsonb;
    `);
  } catch (err) {
    console.warn('[MIGRATION] Asset accessories column notice:', err.message);
  }

  try {
    // 4. Add accessories and returnAccessories columns to AssetAssignment
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "AssetAssignment" 
      ADD COLUMN IF NOT EXISTS "accessories" JSONB DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS "returnAccessories" JSONB DEFAULT '[]'::jsonb;
    `);
  } catch (err) {
    console.warn('[MIGRATION] AssetAssignment accessories columns notice:', err.message);
  }

  try {
    // 5. Add valuation columns to Asset for Sri Lankan Rupee (LKR) tracking
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Asset"
        ADD COLUMN IF NOT EXISTS "purchasePrice" NUMERIC(12, 2),
        ADD COLUMN IF NOT EXISTS "estimatedValue" NUMERIC(12, 2),
        ADD COLUMN IF NOT EXISTS "valuationSource" TEXT,
        ADD COLUMN IF NOT EXISTS "valuationDate" TIMESTAMP;
    `);
  } catch (err) {
    console.warn('[MIGRATION] Asset valuation columns notice:', err.message);
  }

  // 6. High-performance enterprise indexes
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
    'CREATE INDEX IF NOT EXISTS idx_assignment_assigned_date ON "AssetAssignment"("assignedDate" DESC)',
    'CREATE INDEX IF NOT EXISTS idx_assignment_returned_date ON "AssetAssignment"("returnedDate" DESC)',
    'CREATE INDEX IF NOT EXISTS idx_asset_assignment_type ON "Asset"("assignmentType")',
    'CREATE INDEX IF NOT EXISTS idx_asset_warranty ON "Asset"("warrantyExpiryDate")',
    'CREATE INDEX IF NOT EXISTS idx_asset_serial ON "Asset"("serialNumber")',
    'CREATE INDEX IF NOT EXISTS idx_asset_code ON "Asset"("assetCode")',
    'CREATE INDEX IF NOT EXISTS idx_maintenance_status ON "MaintenanceLog"("status")',
    'CREATE INDEX IF NOT EXISTS idx_maintenance_created ON "MaintenanceLog"("createdAt" DESC)',
    'CREATE INDEX IF NOT EXISTS idx_maintenance_asset ON "MaintenanceLog"("assetId")',
    'CREATE INDEX IF NOT EXISTS idx_employee_email ON "Employee"("email")',
    'CREATE INDEX IF NOT EXISTS idx_employee_code ON "Employee"("employeeCode")',
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
