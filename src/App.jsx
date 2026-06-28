import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Assets from './pages/Assets';
import AddAsset from './pages/AddAsset';
import AssetProfile from './pages/AssetProfile';
import Employees from './pages/Employees';
import Departments from './pages/Departments';
import Locations from './pages/Locations';
import AssetAssignment from './pages/AssetAssignment';
import Maintenance from './pages/Maintenance';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Login from './pages/Login';
import Users from './pages/Users';
import QrCodePage from './pages/QrCodePage';
import ChangePassword from './pages/ChangePassword';
import AuditLogs from './pages/AuditLogs';
import AnalyticsDashboard from './pages/AnalyticsDashboard';
import Scanner from './pages/Scanner';
import Tickets from './pages/Tickets';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { ConfirmProvider } from './context/ConfirmContext';

// Protected Route Component
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return null; // Or a loading spinner

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.mustChangePassword && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }

  if (!user.mustChangePassword && location.pathname === '/change-password') {
    return <Navigate to="/" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />; // Redirect to dashboard if unauthorized
  }

  return children;
};

// App Content
const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/change-password" element={<ProtectedRoute><ChangePassword /></ProtectedRoute>} />
      
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<AnalyticsDashboard />} />
        
        <Route path="assets" element={<Assets />} />
        <Route path="assets/add" element={<ProtectedRoute allowedRoles={['ADMIN', 'IT_OFFICER']}><AddAsset /></ProtectedRoute>} />
        <Route path="assets/edit/:id" element={<ProtectedRoute allowedRoles={['ADMIN', 'IT_OFFICER']}><AddAsset /></ProtectedRoute>} />
        <Route path="assets/:id" element={<AssetProfile />} />
        <Route path="assets/:id" element={<AssetProfile />} />
        
        <Route path="employees" element={<Employees />} />
        <Route path="departments" element={<Departments />} />
        <Route path="locations" element={<Locations />} />
        
        <Route path="assignments" element={<ProtectedRoute allowedRoles={['ADMIN', 'IT_OFFICER']}><AssetAssignment /></ProtectedRoute>} />
        <Route path="qr-code" element={<ProtectedRoute allowedRoles={['ADMIN', 'IT_OFFICER']}><QrCodePage /></ProtectedRoute>} />
        <Route path="maintenance" element={<ProtectedRoute allowedRoles={['ADMIN', 'IT_OFFICER']}><Maintenance /></ProtectedRoute>} />
        <Route path="scanner" element={<ProtectedRoute allowedRoles={['ADMIN', 'IT_OFFICER']}><Scanner /></ProtectedRoute>} />
        <Route path="tickets" element={<Tickets />} />
        
        <Route path="reports" element={<Reports />} />
        <Route path="settings" element={<ProtectedRoute allowedRoles={['ADMIN']}><Settings /></ProtectedRoute>} />
        <Route path="users" element={<ProtectedRoute allowedRoles={['ADMIN']}><Users /></ProtectedRoute>} />
        <Route path="audit-logs" element={<ProtectedRoute allowedRoles={['ADMIN']}><AuditLogs /></ProtectedRoute>} />
      </Route>
    </Routes>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <ConfirmProvider>
          <AuthProvider>
            <Router>
              <AppRoutes />
            </Router>
          </AuthProvider>
        </ConfirmProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
