import { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { 
  Search, Bell, UserCircle, Sun, Moon,
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
  ShieldCheck, 
  History, 
  Camera, 
  Ticket, 
  Database,
  KeyRound
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const routeModuleMap = [
  { path: '/assets/add', name: 'Add Asset', icon: PlusCircle, category: 'Operations' },
  { path: '/assets/edit', name: 'Edit Asset', icon: MonitorSmartphone, category: 'Operations' },
  { path: '/assets/', name: 'Asset Profile', icon: MonitorSmartphone, category: 'Operations' },
  { path: '/assets', name: 'Assets', icon: MonitorSmartphone, category: 'Operations' },
  { path: '/employees', name: 'Employees', icon: Users, category: 'Operations' },
  { path: '/departments', name: 'Departments', icon: Building2, category: 'Operations' },
  { path: '/locations', name: 'Locations', icon: MapPin, category: 'Operations' },
  { path: '/assignments', name: 'Asset Assignment', icon: ArrowRightLeft, category: 'Operations' },
  { path: '/qr-code', name: 'QR Code', icon: QrCode, category: 'Operations' },
  { path: '/scanner', name: 'Camera Scanner', icon: Camera, category: 'Operations' },
  { path: '/maintenance', name: 'Maintenance', icon: Wrench, category: 'Operations' },
  { path: '/tickets', name: 'Support Desk', icon: Ticket, category: 'Operations' },
  { path: '/reports', name: 'Reports', icon: FileText, category: 'System' },
  { path: '/audit-logs', name: 'Audit Logs', icon: History, category: 'System' },
  { path: '/database', name: 'Database', icon: Database, category: 'System' },
  { path: '/users', name: 'User Management', icon: ShieldCheck, category: 'System' },
  { path: '/settings', name: 'Settings', icon: Settings, category: 'System' },
  { path: '/change-password', name: 'Change Password', icon: KeyRound, category: 'Account' },
  { path: '/', name: 'Control Center', icon: LayoutDashboard, category: 'Dashboard' },
];

const getModuleInfo = (pathname) => {
  if (pathname === '/') return routeModuleMap.find(m => m.path === '/');
  const sorted = [...routeModuleMap].sort((a, b) => b.path.length - a.path.length);
  return sorted.find(m => pathname.startsWith(m.path)) || { name: 'Control Center', icon: LayoutDashboard, category: 'Dashboard' };
};

export default function Header() {
  const { user } = useAuth();
  const { toggleTheme, isDark } = useTheme();
  const location = useLocation();
  
  const [showNotifications, setShowNotifications] = useState(false);
  const notifRef = useRef(null);
  const [notifications, setNotifications] = useState([]);
  const unreadCount = notifications.filter(n => !n.read).length;

  const currentModule = getModuleInfo(location.pathname);
  const ModuleIcon = currentModule.icon;

  useEffect(() => {
    const fetchOpenTickets = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/tickets`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const tickets = await res.json();
          const openTickets = tickets.filter(t => t.status === 'OPEN');
          setNotifications(openTickets.map(t => ({
            id: t.id,
            title: `New Ticket: ${t.subject}`,
            message: `Raised by ${t.employee?.fullName || 'Employee'} for ${t.asset?.model || 'General Issue'}`,
            time: new Date(t.createdAt).toLocaleDateString(),
            read: false
          })));
        }
      } catch (e) {
        // Silently fail if API is unavailable
      }
    };
    
    fetchOpenTickets();
    const interval = setInterval(fetchOpenTickets, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [notifRef]);

  return (
    <header className="bg-white dark:bg-[#111827] border-b border-slate-200 dark:border-white/[0.06] h-16 flex items-center justify-between px-4 md:px-6 shrink-0 transition-colors duration-300">
      <div className="flex items-center gap-3 md:gap-6 flex-1 min-w-0">
        {/* Module Name Display */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="p-2 rounded-xl bg-blue-500/10 dark:bg-blue-400/10 text-blue-600 dark:text-blue-400 ring-1 ring-blue-500/20">
            <ModuleIcon className="w-5 h-5" />
          </div>
          <div className="hidden sm:block">
            <h1 className="text-base md:text-lg font-extrabold text-slate-800 dark:text-white leading-tight tracking-tight whitespace-nowrap">
              {currentModule.name}
            </h1>
            {currentModule.category && (
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 tracking-widest uppercase block -mt-0.5">
                {currentModule.category}
              </span>
            )}
          </div>
        </div>

        {/* Search Bar */}
        <div 
          onClick={() => window.dispatchEvent(new Event('open-command-palette'))}
          className="hidden lg:flex items-center bg-slate-100 dark:bg-white/[0.04] px-3 py-2 rounded-lg w-72 xl:w-96 hover:bg-slate-200 dark:hover:bg-white/[0.08] border border-transparent dark:border-white/[0.06] transition-all cursor-text group ml-auto lg:ml-0"
        >
          <Search className="w-5 h-5 text-slate-400 group-hover:text-slate-500 dark:group-hover:text-slate-300 transition-colors" />
          <input 
            type="text"
            readOnly
            placeholder="Search assets, employees... (Press Ctrl+K)" 
            className="bg-transparent border-none outline-none ml-2 w-full text-sm placeholder:text-slate-400 text-slate-700 dark:text-slate-200 cursor-text"
          />
        </div>
      </div>

      <div className="flex items-center gap-3 md:gap-4 shrink-0">
        {/* Premium Animated Theme Toggle */}
        <button 
          onClick={toggleTheme}
          className="relative w-16 h-8 rounded-full p-[3px] transition-all duration-500 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/50 group"
          style={{
            background: isDark 
              ? 'linear-gradient(135deg, #1e1b4b, #312e81)' 
              : 'linear-gradient(135deg, #bfdbfe, #93c5fd)',
            boxShadow: isDark 
              ? '0 0 15px rgba(99, 102, 241, 0.3), inset 0 1px 0 rgba(255,255,255,0.08)' 
              : '0 0 15px rgba(59, 130, 246, 0.2), inset 0 1px 0 rgba(255,255,255,0.5)',
          }}
          aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
          id="theme-toggle"
        >
          {/* Sliding indicator */}
          <div 
            className="absolute top-[3px] w-[26px] h-[26px] rounded-full transition-all duration-500 ease-[cubic-bezier(0.68,-0.55,0.265,1.55)] flex items-center justify-center"
            style={{
              left: isDark ? 'calc(100% - 29px)' : '3px',
              background: isDark 
                ? 'linear-gradient(135deg, #6366f1, #818cf8)' 
                : 'linear-gradient(135deg, #fbbf24, #f59e0b)',
              boxShadow: isDark 
                ? '0 2px 10px rgba(99, 102, 241, 0.5), 0 0 20px rgba(129, 140, 248, 0.3)' 
                : '0 2px 10px rgba(245, 158, 11, 0.5), 0 0 20px rgba(251, 191, 36, 0.3)',
            }}
          >
            {/* Icon with morph animation */}
            <div className="relative w-4 h-4">
              <Sun 
                className="absolute inset-0 w-4 h-4 text-white transition-all duration-500"
                style={{
                  opacity: isDark ? 0 : 1,
                  transform: isDark ? 'rotate(-90deg) scale(0.5)' : 'rotate(0deg) scale(1)',
                }}
              />
              <Moon 
                className="absolute inset-0 w-4 h-4 text-white transition-all duration-500"
                style={{
                  opacity: isDark ? 1 : 0,
                  transform: isDark ? 'rotate(0deg) scale(1)' : 'rotate(90deg) scale(0.5)',
                }}
              />
            </div>
          </div>

          {/* Background stars/dots (dark mode decoration) */}
          <div 
            className="absolute inset-0 overflow-hidden rounded-full pointer-events-none transition-opacity duration-500"
            style={{ opacity: isDark ? 0.6 : 0 }}
          >
            <div className="absolute w-1 h-1 rounded-full bg-white/40" style={{ top: '6px', left: '8px' }} />
            <div className="absolute w-0.5 h-0.5 rounded-full bg-white/30" style={{ top: '14px', left: '14px' }} />
            <div className="absolute w-0.5 h-0.5 rounded-full bg-white/20" style={{ top: '8px', left: '20px' }} />
          </div>

          {/* Background clouds (light mode decoration) */}
          <div 
            className="absolute inset-0 overflow-hidden rounded-full pointer-events-none transition-opacity duration-500"
            style={{ opacity: isDark ? 0 : 0.5 }}
          >
            <div className="absolute w-3 h-1.5 rounded-full bg-white/60" style={{ top: '10px', right: '8px' }} />
            <div className="absolute w-2 h-1 rounded-full bg-white/40" style={{ top: '6px', right: '16px' }} />
          </div>
        </button>

        <div className="relative" ref={notifRef}>
          <button 
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 hover:bg-slate-100 dark:hover:bg-white/[0.06] rounded-full relative text-slate-500 dark:text-slate-400 transition-colors"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-[#111827]"></span>
            )}
          </button>

          {/* Dropdown Panel */}
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-700 z-50 overflow-hidden origin-top-right transition-all animate-in fade-in zoom-in-95 duration-200">
               <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                 <h3 className="font-bold text-slate-800 dark:text-white">Notifications</h3>
                 {unreadCount > 0 && (
                    <span className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 px-2 py-0.5 rounded-full font-bold">{unreadCount} New</span>
                 )}
               </div>
               <div className="max-h-[320px] overflow-y-auto custom-scrollbar">
                 {notifications.map(n => (
                   <div key={n.id} className={`p-4 border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors cursor-pointer ${!n.read ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}>
                      <h4 className={`text-sm ${!n.read ? 'font-bold text-slate-800 dark:text-white' : 'font-medium text-slate-700 dark:text-slate-300'}`}>{n.title}</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{n.message}</p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-2 font-medium">{n.time}</p>
                   </div>
                 ))}
               </div>
               <div className="p-3 text-center border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                 <button 
                   onClick={() => {
                     setNotifications(notifications.map(n => ({...n, read: true})));
                     setTimeout(() => setShowNotifications(false), 300);
                   }}
                   className="text-sm font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                 >
                   Mark all as read
                 </button>
               </div>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2 pl-2 md:pl-4 border-l border-slate-200 dark:border-white/[0.06] cursor-pointer hover:opacity-80 transition-opacity">
          <div className="hidden md:block text-right">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{user?.name || 'Guest'}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{user?.role || 'Viewer'}</p>
          </div>
          <UserCircle className="w-8 h-8 text-blue-600" />
        </div>
      </div>
    </header>
  );
}
