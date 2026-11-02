const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const prisma = require('./prismaClient');

const app = express();

// Middleware
const allowedOrigins = process.env.FRONTEND_URL 
  ? process.env.FRONTEND_URL.split(',').map(url => url.trim().replace(/\/$/, ''))
  : [];

const corsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser requests (e.g. mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);
    
    // If FRONTEND_URL is explicitly '*' or unset, allow all
    if (!process.env.FRONTEND_URL || process.env.FRONTEND_URL === '*') {
      return callback(null, true);
    }
    
    // Allow configured frontend domains
    if (allowedOrigins.includes(origin)) return callback(null, true);
    
    // Allow any Vercel deployment (preview or production: *.vercel.app)
    if (/^https:\/\/([a-zA-Z0-9_-]+\.)*vercel\.app$/.test(origin)) {
      return callback(null, true);
    }
    
    // Allow local development ports
    if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      return callback(null, true);
    }

    callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Routes
const authRoutes = require('./routes/auth.routes');
const usersRoutes = require('./routes/users.routes');
const departmentsRoutes = require('./routes/departments.routes');
const locationsRoutes = require('./routes/locations.routes');
const employeesRoutes = require('./routes/employees.routes');
const assetsRoutes = require('./routes/assets.routes');
const assignmentsRoutes = require('./routes/assignments.routes');
const maintenanceRoutes = require('./routes/maintenance.routes');
const settingsRoutes = require('./routes/settings.routes');
const auditLogsRoutes = require('./routes/auditLogs.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const ticketsRoutes = require('./routes/tickets.routes');
const databaseRoutes = require('./routes/database.routes');
const uploadsRoutes = require('./routes/uploads.routes');
const warmupRoutes = require('./routes/warmup.routes');
const permissionsRoutes = require('./routes/permissions.routes');
const reportsRoutes = require('./routes/reports.routes');

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/departments', departmentsRoutes);
app.use('/api/locations', locationsRoutes);
app.use('/api/employees', employeesRoutes);
app.use('/api/assets', assetsRoutes);
app.use('/api/assignments', assignmentsRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/audit-logs', auditLogsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/uploads', uploadsRoutes);
app.use('/api/tickets', ticketsRoutes);
app.use('/api/database', databaseRoutes);
app.use('/api/warmup', warmupRoutes);
app.use('/api/permissions', permissionsRoutes);
app.use('/api/reports', reportsRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'API is running' });
});

const PORT = process.env.PORT || 5000;
const serverStart = Date.now();

// Eagerly establish the DB connection at startup so the very first
// user request doesn't pay the connection setup cost.
prisma.$connect()
  .then(async () => {
    console.log(`[STARTUP] Database connection established.`);
    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "SystemSettings" ADD COLUMN IF NOT EXISTS "dbStorageLimitMB" INTEGER;
      `);
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "avatarUrl" TEXT;
      `);
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "AuditLog" 
          ADD COLUMN IF NOT EXISTS "userEmail" TEXT,
          ADD COLUMN IF NOT EXISTS "employeeId" TEXT,
          ADD COLUMN IF NOT EXISTS "employeeName" TEXT,
          ADD COLUMN IF NOT EXISTS "departmentName" TEXT,
          ADD COLUMN IF NOT EXISTS "initiatedById" TEXT,
          ADD COLUMN IF NOT EXISTS "executedBy" TEXT,
          ADD COLUMN IF NOT EXISTS "activityType" TEXT DEFAULT 'HUMAN',
          ADD COLUMN IF NOT EXISTS "changedFields" TEXT,
          ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT 'SUCCESS',
          ADD COLUMN IF NOT EXISTS "severity" TEXT DEFAULT 'INFO',
          ADD COLUMN IF NOT EXISTS "errorMessage" TEXT,
          ADD COLUMN IF NOT EXISTS "userAgent" TEXT,
          ADD COLUMN IF NOT EXISTS "correlationId" TEXT;
      `);
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "Asset" 
          ADD COLUMN IF NOT EXISTS "imageStorageKey" TEXT,
          ADD COLUMN IF NOT EXISTS "imageFileName" TEXT,
          ADD COLUMN IF NOT EXISTS "imageFileSize" INTEGER,
          ADD COLUMN IF NOT EXISTS "imageMimeType" TEXT,
          ADD COLUMN IF NOT EXISTS "imageUploadedAt" TIMESTAMP,
          ADD COLUMN IF NOT EXISTS "imageUploadedBy" TEXT,
          ADD COLUMN IF NOT EXISTS "thumbnailUrl" TEXT;
      `);
    } catch (_) {}
  })
  .catch((err) => {
    console.error('[STARTUP] Failed to connect to database:', err.message);
  });

app.listen(PORT, () => {
  console.log(`[STARTUP] Server running on port ${PORT} (ready in ${Date.now() - serverStart}ms)`);
});
