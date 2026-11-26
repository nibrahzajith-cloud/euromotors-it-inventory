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

  const enumAlterStatements = [
    `ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'HEAD_OF_IT';`,
    `ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'IT_MANAGER';`,
    `ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'EMPLOYEE';`,
    `ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'PORTAL_ACCESS';`,
    `ALTER TYPE "TicketStatus" ADD VALUE IF NOT EXISTS 'ASSIGNED';`,
    `ALTER TYPE "TicketStatus" ADD VALUE IF NOT EXISTS 'PENDING';`,
    `ALTER TYPE "TicketStatus" ADD VALUE IF NOT EXISTS 'REOPENED';`,
  ];
  for (const stmt of enumAlterStatements) {
    try {
      await prisma.$executeRawUnsafe(stmt);
    } catch (err) {
      console.warn('[MIGRATION] Enum value notice:', err.message);
    }
  }

  const helpDeskEnumDefs = [
    `DO $$ BEGIN CREATE TYPE "TicketRequestType" AS ENUM ('INCIDENT', 'SERVICE_REQUEST', 'INQUIRY'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
    `DO $$ BEGIN CREATE TYPE "BusinessImpact" AS ENUM ('INDIVIDUAL_EMPLOYEE', 'MULTIPLE_EMPLOYEES', 'ENTIRE_DEPARTMENT', 'ENTIRE_BRANCH', 'COMPANY_WIDE'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
    `DO $$ BEGIN CREATE TYPE "SlaStatus" AS ENUM ('ON_TRACK', 'APPROACHING', 'BREACHED', 'PAUSED', 'MET'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
  ];
  for (const stmt of helpDeskEnumDefs) {
    try {
      await prisma.$executeRawUnsafe(stmt);
    } catch (err) {
      console.warn('[MIGRATION] Help Desk enum type notice:', err.message);
    }
  }

  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "User"
        ADD COLUMN IF NOT EXISTS "employeeId" TEXT,
        ADD COLUMN IF NOT EXISTS "modulePermissions" JSONB;
      CREATE UNIQUE INDEX IF NOT EXISTS "User_employeeId_key" ON "User"("employeeId");
    `);
  } catch (err) {
    console.warn('[MIGRATION] User Help Desk columns notice:', err.message);
  }

  const helpDeskTables = [
    `CREATE TABLE IF NOT EXISTS "HelpDeskCategory" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "name" TEXT NOT NULL UNIQUE,
      "description" TEXT,
      "examples" TEXT,
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "isSystem" BOOLEAN NOT NULL DEFAULT false,
      "sortOrder" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE TABLE IF NOT EXISTS "HelpDeskSlaRule" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "priority" "TicketPriority" NOT NULL UNIQUE,
      "firstResponseMinutes" INTEGER NOT NULL,
      "resolutionMinutes" INTEGER NOT NULL,
      "warningThresholdPercent" INTEGER NOT NULL DEFAULT 75,
      "escalateAfterBreachMinutes" INTEGER NOT NULL DEFAULT 30,
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE TABLE IF NOT EXISTS "HelpDeskSettings" (
      "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'global',
      "ticketPrefix" TEXT NOT NULL DEFAULT 'HD',
      "ticketNumberFormat" TEXT NOT NULL DEFAULT 'HD-{YYYY}-{SEQ6}',
      "nextSequenceNumber" INTEGER NOT NULL DEFAULT 1,
      "workingHours" JSONB NOT NULL,
      "holidays" JSONB NOT NULL,
      "allowedPauseReasons" JSONB NOT NULL,
      "requestTypes" JSONB NOT NULL,
      "priorityLevels" JSONB NOT NULL,
      "notificationSettings" JSONB NOT NULL,
      "feedbackSettings" JSONB NOT NULL,
      "assignmentRules" JSONB NOT NULL,
      "escalationRules" JSONB NOT NULL,
      "portalConfig" JSONB,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );`,
    `ALTER TABLE "HelpDeskSettings" ADD COLUMN IF NOT EXISTS "portalConfig" JSONB;`,
    `ALTER TABLE "SupportTicket" ALTER COLUMN "employeeId" DROP NOT NULL;`,
    `ALTER TABLE "SupportTicket"
      ADD COLUMN IF NOT EXISTS "requestType" "TicketRequestType" NOT NULL DEFAULT 'INCIDENT',
      ADD COLUMN IF NOT EXISTS "categoryId" TEXT,
      ADD COLUMN IF NOT EXISTS "businessImpact" "BusinessImpact" NOT NULL DEFAULT 'INDIVIDUAL_EMPLOYEE',
      ADD COLUMN IF NOT EXISTS "businessImpactDetails" TEXT,
      ADD COLUMN IF NOT EXISTS "requesterUserId" TEXT,
      ADD COLUMN IF NOT EXISTS "requesterName" TEXT,
      ADD COLUMN IF NOT EXISTS "requesterEmployeeCode" TEXT,
      ADD COLUMN IF NOT EXISTS "requesterEmail" TEXT,
      ADD COLUMN IF NOT EXISTS "contactNumber" TEXT,
      ADD COLUMN IF NOT EXISTS "submittedByUserId" TEXT,
      ADD COLUMN IF NOT EXISTS "submittedByName" TEXT,
      ADD COLUMN IF NOT EXISTS "submittedByRole" TEXT,
      ADD COLUMN IF NOT EXISTS "departmentId" TEXT,
      ADD COLUMN IF NOT EXISTS "locationId" TEXT,
      ADD COLUMN IF NOT EXISTS "assetId" TEXT,
      ADD COLUMN IF NOT EXISTS "assignedToId" TEXT,
      ADD COLUMN IF NOT EXISTS "assignedById" TEXT,
      ADD COLUMN IF NOT EXISTS "assignedAt" TIMESTAMP(3),
      ADD COLUMN IF NOT EXISTS "investigationDetails" TEXT,
      ADD COLUMN IF NOT EXISTS "actionTaken" TEXT,
      ADD COLUMN IF NOT EXISTS "repairOrReplacementDetails" TEXT,
      ADD COLUMN IF NOT EXISTS "repairCost" DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS "internalRemarks" TEXT,
      ADD COLUMN IF NOT EXISTS "pendingReason" TEXT,
      ADD COLUMN IF NOT EXISTS "firstResponseDueAt" TIMESTAMP(3),
      ADD COLUMN IF NOT EXISTS "resolutionDueAt" TIMESTAMP(3),
      ADD COLUMN IF NOT EXISTS "firstRespondedAt" TIMESTAMP(3),
      ADD COLUMN IF NOT EXISTS "firstResponseMinutes" INTEGER,
      ADD COLUMN IF NOT EXISTS "resolutionMinutes" INTEGER,
      ADD COLUMN IF NOT EXISTS "slaPausedAt" TIMESTAMP(3),
      ADD COLUMN IF NOT EXISTS "slaTotalPausedMinutes" INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "slaPauseReason" TEXT,
      ADD COLUMN IF NOT EXISTS "slaStatus" "SlaStatus" NOT NULL DEFAULT 'ON_TRACK',
      ADD COLUMN IF NOT EXISTS "slaBreachedAt" TIMESTAMP(3),
      ADD COLUMN IF NOT EXISTS "escalatedAt" TIMESTAMP(3),
      ADD COLUMN IF NOT EXISTS "approachingNotifiedAt" TIMESTAMP(3),
      ADD COLUMN IF NOT EXISTS "breachNotifiedAt" TIMESTAMP(3),
      ADD COLUMN IF NOT EXISTS "employeeConfirmed" BOOLEAN,
      ADD COLUMN IF NOT EXISTS "employeeConfirmedAt" TIMESTAMP(3),
      ADD COLUMN IF NOT EXISTS "employeeFeedback" TEXT,
      ADD COLUMN IF NOT EXISTS "satisfactionRating" INTEGER,
      ADD COLUMN IF NOT EXISTS "employeeRemarks" TEXT,
      ADD COLUMN IF NOT EXISTS "closedAt" TIMESTAMP(3),
      ADD COLUMN IF NOT EXISTS "reopenedAt" TIMESTAMP(3),
      ADD COLUMN IF NOT EXISTS "reopenCount" INTEGER NOT NULL DEFAULT 0;`,
    `CREATE TABLE IF NOT EXISTS "TicketStatusHistory" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "ticketId" TEXT NOT NULL REFERENCES "SupportTicket"("id") ON DELETE CASCADE,
      "fromStatus" TEXT,
      "toStatus" TEXT NOT NULL,
      "reason" TEXT,
      "note" TEXT,
      "changedById" TEXT REFERENCES "User"("id") ON DELETE SET NULL,
      "changedByName" TEXT,
      "changedByRole" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE TABLE IF NOT EXISTS "TicketComment" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "ticketId" TEXT NOT NULL REFERENCES "SupportTicket"("id") ON DELETE CASCADE,
      "authorId" TEXT REFERENCES "User"("id") ON DELETE SET NULL,
      "authorName" TEXT,
      "authorRole" TEXT,
      "message" TEXT NOT NULL,
      "isInternal" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE TABLE IF NOT EXISTS "TicketAttachment" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "ticketId" TEXT NOT NULL REFERENCES "SupportTicket"("id") ON DELETE CASCADE,
      "commentId" TEXT REFERENCES "TicketComment"("id") ON DELETE SET NULL,
      "fileName" TEXT NOT NULL,
      "storageKey" TEXT NOT NULL,
      "fileSize" INTEGER NOT NULL,
      "mimeType" TEXT,
      "uploadedById" TEXT,
      "uploadedByName" TEXT,
      "isResolutionProof" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE TABLE IF NOT EXISTS "SlaBreachLog" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "ticketId" TEXT NOT NULL REFERENCES "SupportTicket"("id") ON DELETE CASCADE,
      "breachType" TEXT NOT NULL,
      "dueAt" TIMESTAMP(3) NOT NULL,
      "breachedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "overdueMinutes" INTEGER NOT NULL,
      "escalatedToId" TEXT,
      "escalatedToName" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE TABLE IF NOT EXISTS "Notification" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
      "ticketId" TEXT,
      "type" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "message" TEXT NOT NULL,
      "link" TEXT,
      "isRead" BOOLEAN NOT NULL DEFAULT false,
      "readAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE TABLE IF NOT EXISTS "EmailNotificationLog" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "recipientEmail" TEXT NOT NULL,
      "subject" TEXT NOT NULL,
      "body" TEXT NOT NULL,
      "eventType" TEXT NOT NULL,
      "ticketId" TEXT,
      "status" TEXT NOT NULL DEFAULT 'SUPPRESSED_DEV',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE TABLE IF NOT EXISTS "PortalSession" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "employeeId" TEXT NOT NULL REFERENCES "Employee"("id") ON DELETE CASCADE,
      "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
      "portalAccountId" TEXT,
      "verificationMethod" TEXT,
      "rememberDevice" BOOLEAN NOT NULL DEFAULT false,
      "expiresAt" TIMESTAMP(3) NOT NULL,
      "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "revokedAt" TIMESTAMP(3),
      "ipAddress" TEXT,
      "userAgent" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );`,
  ];

  for (const stmt of helpDeskTables) {
    try {
      await prisma.$executeRawUnsafe(stmt);
    } catch (err) {
      console.warn('[MIGRATION] Help Desk schema notice:', err.message);
    }
  }

  const helpDeskIndexes = [
    'CREATE INDEX IF NOT EXISTS "SupportTicket_status_idx" ON "SupportTicket"("status")',
    'CREATE INDEX IF NOT EXISTS "SupportTicket_priority_idx" ON "SupportTicket"("priority")',
    'CREATE INDEX IF NOT EXISTS "SupportTicket_employeeId_idx" ON "SupportTicket"("employeeId")',
    'CREATE INDEX IF NOT EXISTS "SupportTicket_requesterUserId_idx" ON "SupportTicket"("requesterUserId")',
    'CREATE INDEX IF NOT EXISTS "SupportTicket_assignedToId_idx" ON "SupportTicket"("assignedToId")',
    'CREATE INDEX IF NOT EXISTS "SupportTicket_categoryId_idx" ON "SupportTicket"("categoryId")',
    'CREATE INDEX IF NOT EXISTS "SupportTicket_departmentId_idx" ON "SupportTicket"("departmentId")',
    'CREATE INDEX IF NOT EXISTS "SupportTicket_locationId_idx" ON "SupportTicket"("locationId")',
    'CREATE INDEX IF NOT EXISTS "SupportTicket_assetId_idx" ON "SupportTicket"("assetId")',
    'CREATE INDEX IF NOT EXISTS "SupportTicket_slaStatus_idx" ON "SupportTicket"("slaStatus")',
    'CREATE INDEX IF NOT EXISTS "SupportTicket_createdAt_idx" ON "SupportTicket"("createdAt")',
    'CREATE INDEX IF NOT EXISTS "TicketStatusHistory_ticketId_idx" ON "TicketStatusHistory"("ticketId")',
    'CREATE INDEX IF NOT EXISTS "TicketStatusHistory_createdAt_idx" ON "TicketStatusHistory"("createdAt")',
    'CREATE INDEX IF NOT EXISTS "TicketComment_ticketId_idx" ON "TicketComment"("ticketId")',
    'CREATE INDEX IF NOT EXISTS "TicketComment_createdAt_idx" ON "TicketComment"("createdAt")',
    'CREATE INDEX IF NOT EXISTS "TicketAttachment_ticketId_idx" ON "TicketAttachment"("ticketId")',
    'CREATE INDEX IF NOT EXISTS "SlaBreachLog_ticketId_idx" ON "SlaBreachLog"("ticketId")',
    'CREATE INDEX IF NOT EXISTS "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead")',
    'CREATE INDEX IF NOT EXISTS "Notification_createdAt_idx" ON "Notification"("createdAt")',
    'CREATE INDEX IF NOT EXISTS "EmailNotificationLog_createdAt_idx" ON "EmailNotificationLog"("createdAt")',
    'CREATE INDEX IF NOT EXISTS "PortalSession_employeeId_idx" ON "PortalSession"("employeeId")',
    'CREATE INDEX IF NOT EXISTS "PortalSession_userId_idx" ON "PortalSession"("userId")',
    'CREATE INDEX IF NOT EXISTS "PortalSession_expiresAt_idx" ON "PortalSession"("expiresAt")',
  ];
  for (const idx of helpDeskIndexes) {
    try {
      await prisma.$executeRawUnsafe(idx);
    } catch (_) {}
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

applyMigrations.MIGRATION_VERSION = '2026.11.26-helpdesk-v1.1';

module.exports = applyMigrations;
