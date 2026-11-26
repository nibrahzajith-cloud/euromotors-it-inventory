import React, { lazy, Suspense, Component } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { ConfirmProvider } from './context/ConfirmContext';
import { getDefaultLandingRoute, hasModuleAccess, isAdminOrHeadOfIT, isHelpDeskManager, isITStaff } from './utils/helpdeskApi';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#070b13] text-white flex flex-col items-center justify-center p-6 text-center">
          <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 mb-4 text-xl font-bold">
            !
          </div>
          <h2 className="text-lg font-bold text-slate-100 mb-1">Something went wrong</h2>
          <p className="text-xs text-slate-400 max-w-md mb-4">{this.state.error?.message || 'An unexpected rendering error occurred.'}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs font-semibold text-white transition-colors cursor-pointer"
          >
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Existing Inventory Pages
const Assets = lazy(() => import('./pages/Assets'));
const AddAsset = lazy(() => import('./pages/AddAsset'));
const AssetProfile = lazy(() => import('./pages/AssetProfile'));
const Employees = lazy(() => import('./pages/Employees'));
const Departments = lazy(() => import('./pages/Departments'));
const Locations = lazy(() => import('./pages/Locations'));
const AssetAssignment = lazy(() => import('./pages/AssetAssignment'));
const Maintenance = lazy(() => import('./pages/Maintenance'));
const Reports = lazy(() => import('./pages/Reports'));
const Settings = lazy(() => import('./pages/Settings'));
const Login = lazy(() => import('./pages/Login'));
const Users = lazy(() => import('./pages/Users'));
const QrCodePage = lazy(() => import('./pages/QrCodePage'));
const ChangePassword = lazy(() => import('./pages/ChangePassword'));
const AuditLogs = lazy(() => import('./pages/AuditLogs'));
const Database = lazy(() => import('./pages/Database'));
const AnalyticsDashboard = lazy(() => import('./pages/AnalyticsDashboard'));
const Scanner = lazy(() => import('./pages/Scanner'));

// Help Desk Module Pages
const EmployeeHelpDeskDashboard = lazy(() => import('./pages/helpdesk/EmployeeHelpDeskDashboard'));
const CreateSupportRequest = lazy(() => import('./pages/helpdesk/CreateSupportRequest'));
const TicketListPage = lazy(() => import('./pages/helpdesk/TicketListPage'));
const TicketDetailPage = lazy(() => import('./pages/helpdesk/TicketDetailPage'));
const HelpDeskManagementDashboard = lazy(() => import('./pages/helpdesk/HelpDeskManagementDashboard'));
const TechnicianPerformancePage = lazy(() => import('./pages/helpdesk/TechnicianPerformancePage'));
const SlaManagementPage = lazy(() => import('./pages/helpdesk/SlaManagementPage'));
const HelpDeskReportsPage = lazy(() => import('./pages/helpdesk/HelpDeskReportsPage'));
const HelpDeskSettingsPage = lazy(() => import('./pages/helpdesk/HelpDeskSettingsPage'));
const EmployeeIdentifyPage = lazy(() => import('./pages/portal/EmployeeIdentifyPage'));

const PageLoadingFallback = () => (
  <div className="flex h-[50vh] w-full flex-col items-center justify-center space-y-3 animate-in fade-in duration-150">
    <div className="w-8 h-8 rounded-full border-2 border-blue-500/20 border-t-blue-500 animate-spin" />
    <span className="text-xs font-medium text-slate-400">Loading module...</span>
  </div>
);

const ProtectedRoute = ({ children, allowedRoles, requiredPermission, requiredModule, customCheck }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return null;

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Common portal gateway login must verify individual employee identity first
  if (user.role === 'PORTAL_ACCESS' || user.tokenScope === 'PORTAL_GATEWAY') {
    return <Navigate to="/portal/identify" replace />;
  }

  if (user.mustChangePassword && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }

  if (!user.mustChangePassword && location.pathname === '/change-password') {
    return <Navigate to={getDefaultLandingRoute(user)} replace />;
  }

  if (isAdminOrHeadOfIT(user)) {
    return children;
  }

  const fallback = getDefaultLandingRoute(user);

  if (requiredModule && !hasModuleAccess(user, requiredModule)) {
    return <Navigate to={fallback} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={fallback} replace />;
  }

  if (requiredPermission && (!user.permissions || !user.permissions[requiredPermission])) {
    return <Navigate to={fallback} replace />;
  }

  if (customCheck && !customCheck(user)) {
    return <Navigate to={fallback} replace />;
  }

  return children;
};

const PortalGatewayRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'PORTAL_ACCESS' || user.tokenScope === 'PORTAL_GATEWAY') {
    return children;
  }
  return <Navigate to={getDefaultLandingRoute(user)} replace />;
};

const RootLanding = () => {
  const { user } = useAuth();
  if (!hasModuleAccess(user, 'INVENTORY_DASHBOARD')) {
    return <Navigate to={getDefaultLandingRoute(user)} replace />;
  }
  return <AnalyticsDashboard />;
};

const AppRoutes = () => {
  return (
    <Suspense fallback={<PageLoadingFallback />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/portal/identify" element={<PortalGatewayRoute><EmployeeIdentifyPage /></PortalGatewayRoute>} />
        <Route path="/change-password" element={<ProtectedRoute><ChangePassword /></ProtectedRoute>} />

        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<RootLanding />} />

          {/* Existing IT Inventory Routes (Protected by Module RBAC) */}
          <Route path="assets" element={<ProtectedRoute requiredModule="IT_INVENTORY"><Assets /></ProtectedRoute>} />
          <Route path="assets/add" element={<ProtectedRoute requiredModule="ASSET_MANAGEMENT" allowedRoles={['ADMIN', 'HEAD_OF_IT', 'IT_MANAGER', 'IT_OFFICER']}><AddAsset /></ProtectedRoute>} />
          <Route path="assets/edit/:id" element={<ProtectedRoute requiredModule="ASSET_MANAGEMENT" allowedRoles={['ADMIN', 'HEAD_OF_IT', 'IT_MANAGER', 'IT_OFFICER']}><AddAsset /></ProtectedRoute>} />
          <Route path="assets/:id" element={<ProtectedRoute requiredModule="IT_INVENTORY"><AssetProfile /></ProtectedRoute>} />

          <Route path="employees" element={<ProtectedRoute requiredModule="IT_INVENTORY"><Employees /></ProtectedRoute>} />
          <Route path="employees/add" element={<ProtectedRoute requiredModule="ASSET_MANAGEMENT"><Employees defaultOpenAdd={true} /></ProtectedRoute>} />
          <Route path="departments" element={<ProtectedRoute requiredModule="IT_INVENTORY"><Departments /></ProtectedRoute>} />
          <Route path="locations" element={<ProtectedRoute requiredModule="IT_INVENTORY"><Locations /></ProtectedRoute>} />

          <Route path="assignments" element={<ProtectedRoute requiredModule="ASSET_MANAGEMENT" allowedRoles={['ADMIN', 'HEAD_OF_IT', 'IT_MANAGER', 'IT_OFFICER']}><AssetAssignment /></ProtectedRoute>} />
          <Route path="qr-code" element={<ProtectedRoute requiredModule="ASSET_MANAGEMENT" allowedRoles={['ADMIN', 'HEAD_OF_IT', 'IT_MANAGER', 'IT_OFFICER']}><QrCodePage /></ProtectedRoute>} />
          <Route path="maintenance" element={<ProtectedRoute requiredModule="ASSET_MANAGEMENT" allowedRoles={['ADMIN', 'HEAD_OF_IT', 'IT_MANAGER', 'IT_OFFICER']}><Maintenance /></ProtectedRoute>} />
          <Route path="scanner" element={<ProtectedRoute requiredModule="ASSET_MANAGEMENT" allowedRoles={['ADMIN', 'HEAD_OF_IT', 'IT_MANAGER', 'IT_OFFICER']}><Scanner /></ProtectedRoute>} />

          <Route path="inventory" element={<Navigate to="/assets?status=AVAILABLE" replace />} />
          <Route path="shared-assets" element={<Navigate to="/assets?assignmentType=SHARED" replace />} />
          <Route path="warranty" element={<Navigate to="/reports" replace />} />
          <Route path="qr-management" element={<Navigate to="/qr-code" replace />} />

          <Route path="reports" element={<ProtectedRoute requiredModule="MANAGEMENT_REPORTS"><Reports /></ProtectedRoute>} />
          <Route path="settings" element={<ProtectedRoute requiredModule="SYSTEM_SETTINGS"><Settings /></ProtectedRoute>} />
          <Route path="users" element={<ProtectedRoute requiredModule="USER_MANAGEMENT"><Users /></ProtectedRoute>} />
          <Route path="audit-logs" element={<ProtectedRoute requiredModule="SYSTEM_SETTINGS" requiredPermission="VIEW_AUDIT_LOG"><AuditLogs /></ProtectedRoute>} />
          <Route path="database" element={<ProtectedRoute requiredModule="SYSTEM_SETTINGS"><Database /></ProtectedRoute>} />

          {/* IT Help Desk Module Routes */}
          <Route path="tickets" element={<ProtectedRoute requiredModule="IT_HELP_DESK"><TicketListPage queue="my-requests" title="Support Tickets" subtitle="Submit and track IT support requests." /></ProtectedRoute>} />
          <Route path="helpdesk/employee" element={<ProtectedRoute requiredModule="HELP_DESK_EMPLOYEE_DASHBOARD"><EmployeeHelpDeskDashboard /></ProtectedRoute>} />
          <Route path="helpdesk/new" element={<ProtectedRoute requiredModule="IT_HELP_DESK"><CreateSupportRequest /></ProtectedRoute>} />
          <Route path="helpdesk/my-requests" element={<ProtectedRoute requiredModule="IT_HELP_DESK"><TicketListPage queue="my-requests" title="My Support Requests" subtitle="Track all requests submitted by you." /></ProtectedRoute>} />
          <Route path="helpdesk/management" element={<ProtectedRoute requiredModule="IT_HELP_DESK" customCheck={(u) => isHelpDeskManager(u)}><HelpDeskManagementDashboard /></ProtectedRoute>} />
          <Route path="helpdesk/tickets" element={<ProtectedRoute requiredModule="IT_HELP_DESK" customCheck={(u) => isHelpDeskManager(u)}><TicketListPage queue="all" title="All Help Desk Tickets" subtitle="Centralized ticket ledger across all departments and branches." /></ProtectedRoute>} />
          <Route path="helpdesk/unassigned" element={<ProtectedRoute requiredModule="IT_HELP_DESK" customCheck={(u) => isHelpDeskManager(u)}><TicketListPage queue="unassigned" title="Unassigned Tickets" subtitle="Newly submitted or reopened tickets awaiting IT Officer assignment." /></ProtectedRoute>} />
          <Route path="helpdesk/my-assigned" element={<ProtectedRoute requiredModule="IT_HELP_DESK" customCheck={(u) => isITStaff(u)}><TicketListPage queue="my-assigned" title="My Assigned Tickets" subtitle="Tickets assigned to you for investigation and resolution." /></ProtectedRoute>} />
          <Route path="helpdesk/pending" element={<ProtectedRoute requiredModule="IT_HELP_DESK" customCheck={(u) => isITStaff(u)}><TicketListPage queue="pending" title="Pending Tickets" subtitle="Tickets paused awaiting employee, vendor, parts, or approval." /></ProtectedRoute>} />
          <Route path="helpdesk/resolved-closed" element={<ProtectedRoute requiredModule="IT_HELP_DESK" customCheck={(u) => isITStaff(u)}><TicketListPage queue="resolved-closed" title="Resolved & Closed Tickets" subtitle="Completed support requests and employee confirmations." /></ProtectedRoute>} />
          <Route path="helpdesk/tickets/:id" element={<ProtectedRoute requiredModule="IT_HELP_DESK"><TicketDetailPage /></ProtectedRoute>} />
          <Route path="helpdesk/technicians" element={<ProtectedRoute requiredModule="IT_HELP_DESK" customCheck={(u) => isHelpDeskManager(u)}><TechnicianPerformancePage /></ProtectedRoute>} />
          <Route path="helpdesk/sla" element={<ProtectedRoute requiredModule="IT_HELP_DESK" customCheck={(u) => isHelpDeskManager(u)}><SlaManagementPage /></ProtectedRoute>} />
          <Route path="helpdesk/reports" element={<ProtectedRoute requiredModule="IT_HELP_DESK" customCheck={(u) => isHelpDeskManager(u) || hasModuleAccess(u, 'MANAGEMENT_REPORTS')}><HelpDeskReportsPage /></ProtectedRoute>} />
          <Route path="helpdesk/settings" element={<ProtectedRoute requiredModule="IT_HELP_DESK" customCheck={(u) => isAdminOrHeadOfIT(u) || hasModuleAccess(u, 'SYSTEM_SETTINGS')}><HelpDeskSettingsPage /></ProtectedRoute>} />
        </Route>
      </Routes>
    </Suspense>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <ConfirmProvider>
          <AuthProvider>
            <Router>
              <ErrorBoundary>
                <AppRoutes />
              </ErrorBoundary>
            </Router>
          </AuthProvider>
        </ConfirmProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
