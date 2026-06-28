const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');

const app = express();

// Middleware
const corsOptions = {
   origin: process.env.FRONTEND_URL || '*',
   optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use(express.json());

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
const uploadsRoutes = require('./routes/uploads.routes');
const ticketsRoutes = require('./routes/tickets.routes');

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

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'API is running' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
