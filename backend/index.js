const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const prisma = require('./prismaClient');

const app = express();

// Middleware
const corsOptions = {
   origin: process.env.FRONTEND_URL || '*',
   optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'API is running' });
});

const PORT = process.env.PORT || 5000;
const serverStart = Date.now();

// Eagerly establish the DB connection at startup so the very first
// user request doesn't pay the connection setup cost.
prisma.$connect()
  .then(() => {
    console.log(`[STARTUP] Database connection established.`);
  })
  .catch((err) => {
    console.error('[STARTUP] Failed to connect to database:', err.message);
  });

app.listen(PORT, () => {
  console.log(`[STARTUP] Server running on port ${PORT} (ready in ${Date.now() - serverStart}ms)`);
});

