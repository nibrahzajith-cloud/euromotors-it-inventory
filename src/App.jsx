import React, { lazy, Suspense, Component } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { ConfirmProvider } from './context/ConfirmContext';

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

// Performance Optimization: Route-based Code Splitting via React.lazy
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
const Tickets = lazy(() => import('./pages/Tickets'));

// Elegant, ultra-lightweight dark-mode loading fallback
const PageLoadingFallback = () => (
  <div className="flex h-[50vh] w-full flex-col items-center justify-center space-y-3 animate-in fade-in duration-150">
    <div className="w-8 h-8 rounded-full border-2 border-blue-500/20 border-t-blue-500 animate-spin" />
    <span className="text-xs font-medium text-slate-400">Loading module...</span>
  </div>
);

// Protected Route Component
const ProtectedRoute = ({ children, allowedRoles, requiredPermission }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return null;

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.mustChangePassword && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }

  if (!user.mustChangePassword && location.pathname === '/change-password') {
    return <Navigate to="/" replace />;
  }

  // ADMIN always has full access — skip role and permission checks
  if (user.role === 'ADMIN') {
    return children;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  if (requiredPermission && (!user.permissions || !user.permissions[requiredPermission])) {
    return <Navigate to="/" replace />;
  }

  return children;
};

// App Content
const AppRoutes = () => {
  return (
    <Suspense fallback={<PageLoadingFallback />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/change-password" element={<ProtectedRoute><ChangePassword /></ProtectedRoute>} />
        
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<AnalyticsDashboard />} />
          
          <Route path="assets" element={<Assets />} />
          <Route path="assets/add" element={<ProtectedRoute allowedRoles={['ADMIN', 'IT_OFFICER']}><AddAsset /></ProtectedRoute>} />
          <Route path="assets/edit/:id" element={<ProtectedRoute allowedRoles={['ADMIN', 'IT_OFFICER']}><AddAsset /></ProtectedRoute>} />
          <Route path="assets/:id" element={<AssetProfile />} />
          
          <Route path="employees" element={<Employees />} />
          <Route path="employees/add" element={<Employees defaultOpenAdd={true} />} />
          <Route path="departments" element={<Departments />} />
          <Route path="locations" element={<Locations />} />
          
          <Route path="assignments" element={<ProtectedRoute allowedRoles={['ADMIN', 'IT_OFFICER']}><AssetAssignment /></ProtectedRoute>} />
          <Route path="qr-code" element={<ProtectedRoute allowedRoles={['ADMIN', 'IT_OFFICER']}><QrCodePage /></ProtectedRoute>} />
          <Route path="maintenance" element={<ProtectedRoute allowedRoles={['ADMIN', 'IT_OFFICER']}><Maintenance /></ProtectedRoute>} />
          <Route path="scanner" element={<ProtectedRoute allowedRoles={['ADMIN', 'IT_OFFICER']}><Scanner /></ProtectedRoute>} />
          <Route path="tickets" element={<Tickets />} />
          
          <Route path="inventory" element={<Navigate to="/assets?status=AVAILABLE" replace />} />
          <Route path="shared-assets" element={<Navigate to="/assets?assignmentType=SHARED" replace />} />
          <Route path="warranty" element={<Navigate to="/reports" replace />} />
          <Route path="qr-management" element={<Navigate to="/qr-code" replace />} />
          
          <Route path="reports" element={<ProtectedRoute allowedRoles={['ADMIN']}><Reports /></ProtectedRoute>} />
          <Route path="settings" element={<ProtectedRoute allowedRoles={['ADMIN']}><Settings /></ProtectedRoute>} />
          <Route path="users" element={<ProtectedRoute allowedRoles={['ADMIN']} requiredPermission="MANAGE_USERS"><Users /></ProtectedRoute>} />
          <Route path="audit-logs" element={<ProtectedRoute allowedRoles={['ADMIN']} requiredPermission="VIEW_AUDIT_LOG"><AuditLogs /></ProtectedRoute>} />
          <Route path="database" element={<ProtectedRoute allowedRoles={['ADMIN']}><Database /></ProtectedRoute>} />
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
