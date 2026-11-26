const { execSync } = require('child_process');
const path = require('path');
const backendPkg = require('../package.json');
const applyMigrations = require('./migrations');

const STARTED_AT = new Date().toISOString();
const API_CONTRACT_VERSION = 'helpdesk-v1';

let cachedCommit = null;

function getGitCommit() {
  if (cachedCommit) return cachedCommit;
  const envSha =
    process.env.RENDER_GIT_COMMIT ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.GIT_COMMIT ||
    '';
  if (envSha.trim()) {
    cachedCommit = {
      full: envSha.trim(),
      short: envSha.trim().slice(0, 7),
      source: 'env',
    };
    return cachedCommit;
  }

  try {
    const repoRoot = path.resolve(__dirname, '..', '..');
    const full = execSync('git rev-parse HEAD', { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    cachedCommit = {
      full,
      short: full.slice(0, 7),
      source: 'git',
    };
  } catch (_) {
    cachedCommit = {
      full: 'unknown',
      short: 'unknown',
      source: 'fallback',
    };
  }
  return cachedCommit;
}

function getRuntimeEnvironment() {
  const isProd = Boolean(process.env.RENDER || process.env.RENDER_SERVICE_ID || process.env.NODE_ENV === 'production');
  return isProd ? 'Production' : 'Localhost';
}

const REQUIRED_TABLES = [
  'Asset',
  'Employee',
  'User',
  'SystemSettings',
  'HelpDeskCategory',
  'HelpDeskSlaRule',
  'HelpDeskSettings',
  'SupportTicket',
  'TicketStatusHistory',
  'TicketComment',
  'TicketAttachment',
  'SlaBreachLog',
  'Notification',
  'EmailNotificationLog',
  'PortalSession',
];

const REQUIRED_COLUMNS = [
  { table: 'Asset', column: 'purchasePrice' },
  { table: 'Asset', column: 'estimatedValue' },
  { table: 'User', column: 'employeeId' },
  { table: 'User', column: 'modulePermissions' },
  { table: 'HelpDeskSettings', column: 'portalConfig' },
  { table: 'SupportTicket', column: 'submittedByUserId' },
  { table: 'SupportTicket', column: 'assignedToId' },
  { table: 'SupportTicket', column: 'closedAt' },
  { table: 'SupportTicket', column: 'categoryId' },
  { table: 'SupportTicket', column: 'slaStatus' },
];

async function getDatabaseSchemaStatus(prisma) {
  const migrationVersion = applyMigrations.MIGRATION_VERSION || '2026.11.26-helpdesk-v1.0';
  try {
    const [tablesRows, columnsRows] = await Promise.all([
      prisma.$queryRawUnsafe(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
      `),
      prisma.$queryRawUnsafe(`
        SELECT table_name, column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
      `),
    ]);

    const existingTables = new Set(tablesRows.map((r) => r.table_name));
    const existingColumns = new Set(columnsRows.map((r) => `${r.table_name}.${r.column_name}`));

    const missingTables = REQUIRED_TABLES.filter((t) => !existingTables.has(t));
    const missingColumns = REQUIRED_COLUMNS
      .filter((c) => !existingColumns.has(`${c.table}.${c.column}`))
      .map((c) => `${c.table}.${c.column}`);

    const missingItems = [...missingTables.map((t) => `table:${t}`), ...missingColumns];
    return {
      migrationVersion,
      schemaReady: missingItems.length === 0,
      missingItems,
      verifiedAt: new Date().toISOString(),
    };
  } catch (err) {
    return {
      migrationVersion,
      schemaReady: false,
      missingItems: [`check_error: ${err.message}`],
      verifiedAt: new Date().toISOString(),
    };
  }
}

async function getSystemVersionInfo(prisma) {
  const commit = getGitCommit();
  const dbMigration = prisma ? await getDatabaseSchemaStatus(prisma) : {
    migrationVersion: applyMigrations.MIGRATION_VERSION || '2026.11.26-helpdesk-v1.0',
    schemaReady: null,
    missingItems: [],
  };

  return {
    backendVersion: backendPkg.version || '2.0.0',
    apiContract: API_CONTRACT_VERSION,
    gitCommit: commit.full,
    gitCommitShort: commit.short,
    gitCommitSource: commit.source,
    migrationVersion: dbMigration.migrationVersion,
    dbSchemaReady: dbMigration.schemaReady,
    dbMissingItems: dbMigration.missingItems,
    lastDeployedAt: process.env.RENDER_DEPLOY_CREATED_AT || STARTED_AT,
    serverStartedAt: STARTED_AT,
    environment: getRuntimeEnvironment(),
  };
}

module.exports = {
  getGitCommit,
  getRuntimeEnvironment,
  getSystemVersionInfo,
  API_CONTRACT_VERSION,
  BACKEND_VERSION: backendPkg.version || '2.0.0',
  STARTED_AT,
};
