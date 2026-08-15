import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  MonitorSmartphone, 
  PlusCircle, 
  Users, 
  Building2, 
  MapPin, 
  ArrowRightLeft, 
  QrCode, 
  Wrench, 
  FileText, 
  Settings, 
  LogOut,
  ShieldCheck,
  History,
  Camera,
  Ticket,
  Menu,
  X
} from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '../context/AuthContext';
import { AnimatePresence, motion } from 'framer-motion';

export default function MobileNav() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { name: 'Control Center', path: '/', icon: LayoutDashboard, roles: ['ADMIN', 'IT_OFFICER', 'VIEWER'] },
    
    { name: 'Operations', isHeader: true, roles: ['ADMIN', 'IT_OFFICER', 'VIEWER'] },
    { name: 'Assets', path: '/assets', icon: MonitorSmartphone, roles: ['ADMIN', 'IT_OFFICER', 'VIEWER'] },
    { name: 'Add Asset', path: '/assets/add', icon: PlusCircle, roles: ['ADMIN', 'IT_OFFICER'] },
    { name: 'Employees', path: '/employees', icon: Users, roles: ['ADMIN', 'IT_OFFICER', 'VIEWER'] },
    { name: 'Departments', path: '/departments', icon: Building2, roles: ['ADMIN', 'IT_OFFICER', 'VIEWER'] },
    { name: 'Locations', path: '/locations', icon: MapPin, roles: ['ADMIN', 'IT_OFFICER', 'VIEWER'] },
    { name: 'Asset Assignment', path: '/assignments', icon: ArrowRightLeft, roles: ['ADMIN', 'IT_OFFICER'] },
    { name: 'QR Code', path: '/qr-code', icon: QrCode, roles: ['ADMIN', 'IT_OFFICER'] },
    { name: 'Camera Scanner', path: '/scanner', icon: Camera, roles: ['ADMIN', 'IT_OFFICER'] },
    { name: 'Maintenance', path: '/maintenance', icon: Wrench, roles: ['ADMIN', 'IT_OFFICER'] },
    { name: 'Support Desk', path: '/tickets', icon: Ticket, roles: ['ADMIN', 'IT_OFFICER'] },
    
    { name: 'System', isHeader: true, roles: ['ADMIN'] },
    { name: 'Reports', path: '/reports', icon: FileText, roles: ['ADMIN'] },
    { name: 'Audit Logs', path: '/audit-logs', icon: History, roles: ['ADMIN'] },
    { name: 'User Management', path: '/users', icon: ShieldCheck, roles: ['ADMIN'] },
    { name: 'Settings', path: '/settings', icon: Settings, roles: ['ADMIN'] },
  ];

  const visibleNavItems = navItems.filter(item => item.roles.includes(user?.role));

  const quickLinks = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Assets', path: '/assets', icon: MonitorSmartphone },
    { name: 'Scanner', path: '/scanner', icon: Camera },
  ];

  return (
    <>
      {/* Bottom Navigation Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/90 dark:bg-black/90 backdrop-blur-xl border-t border-slate-200 dark:border-white/10 pb-[env(safe-area-inset-bottom)] px-2 py-2 flex items-center justify-around">
        {quickLinks.map((item) => (
          <NavLink
            key={item.name}
            to={item.path}
            onClick={() => setIsMenuOpen(false)}
            className={({ isActive }) => clsx(
              "flex flex-col items-center justify-center p-2 rounded-xl transition-all w-16",
              isActive 
                ? "text-blue-600 dark:text-blue-400" 
                : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            )}
          >
            <item.icon className={clsx("w-6 h-6 mb-1")} />
            <span className="text-[10px] font-medium">{item.name}</span>
          </NavLink>
        ))}
        
        <button 
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className={clsx(
            "flex flex-col items-center justify-center p-2 rounded-xl transition-all w-16",
            isMenuOpen 
              ? "text-blue-600 dark:text-blue-400" 
              : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
          )}
        >
          {isMenuOpen ? <X className="w-6 h-6 mb-1" /> : <Menu className="w-6 h-6 mb-1" />}
          <span className="text-[10px] font-medium">Menu</span>
        </button>
      </div>

      {/* Full Screen Menu Modal */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed inset-0 z-30 bg-slate-50 dark:bg-[#0f172a] pt-20 pb-32 overflow-y-auto"
          >
            <div className="px-6 py-4">
              <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white mb-6 tracking-tight">Navigation</h2>
              <div className="space-y-1">
                {visibleNavItems.map((item) => (
                  item.isHeader ? (
                    <div key={item.name} className="pt-6 pb-2">
                      <span className="text-xs font-black uppercase tracking-wider text-slate-400">{item.name}</span>
                    </div>
                  ) : (
                    <NavLink
                      key={item.name}
                      to={item.path}
                      onClick={() => setIsMenuOpen(false)}
                      className={({ isActive }) => clsx(
                        "flex items-center gap-4 py-4 px-5 rounded-2xl text-[15px] font-bold transition-all",
                        isActive 
                          ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" 
                          : "text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800"
                      )}
                    >
                      <item.icon className="w-5 h-5" />
                      {item.name}
                    </NavLink>
                  )
                ))}
              </div>

              <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800 mb-20">
                <button 
                  onClick={handleLogout}
                  className="flex items-center justify-center gap-2 w-full py-4 px-4 rounded-2xl text-sm font-bold text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-500/10 dark:hover:bg-red-500/20 transition-all"
                >
                  <LogOut className="w-5 h-5" />
                  Logout
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
