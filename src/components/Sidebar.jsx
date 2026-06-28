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
  X,
  ShieldCheck,
  History,
  LineChart,
  Pin,
  PinOff,
  Camera,
  Ticket
} from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '../context/AuthContext';

export default function Sidebar({ isOpen, setIsOpen }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isPinned, setIsPinned] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { name: 'Control Center', path: '/', icon: LayoutDashboard, roles: ['ADMIN', 'IT_OFFICER', 'VIEWER'] },
    
    { 
      name: 'Operations', 
      isHeader: true,
      roles: ['ADMIN', 'IT_OFFICER', 'VIEWER'] 
    },
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
    
    { 
      name: 'System', 
      isHeader: true,
      roles: ['ADMIN'] 
    },
    { name: 'Reports', path: '/reports', icon: FileText, roles: ['ADMIN', 'IT_OFFICER'] },
    { name: 'Audit Logs', path: '/audit-logs', icon: History, roles: ['ADMIN'] },
    { name: 'User Management', path: '/users', icon: ShieldCheck, roles: ['ADMIN'] },
    { name: 'Settings', path: '/settings', icon: Settings, roles: ['ADMIN'] },
  ];

  // Filter items based on user role
  const visibleNavItems = navItems.filter(item => item.roles.includes(user?.role));

  const isExpanded = isPinned || isHovered;

  return (
    <>
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 z-20 md:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}

      <aside 
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={clsx(
          "fixed md:static inset-y-0 left-0 z-30 bg-[#1e293b] text-slate-300 flex flex-col transition-all duration-300 ease-in-out",
          isOpen ? "translate-x-0 w-64" : "-translate-x-full md:translate-x-0",
          !isOpen && isExpanded ? "md:w-64" : (!isOpen && !isExpanded ? "md:w-20" : "")
        )}
      >
        <div className="flex items-center justify-between h-14 px-4 bg-slate-900/50 shrink-0 overflow-hidden">
          <div className="flex items-center gap-2 text-white font-semibold text-lg tracking-tight whitespace-nowrap">
            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shrink-0 p-0.5 overflow-hidden shadow-sm">
              <img src="/logo.png" alt="Euro Motors" className="w-full h-full object-contain" />
            </div>
            <span className={clsx("transition-opacity duration-300", !isExpanded ? "opacity-0 w-0 hidden" : "opacity-100")}>
              Euro Motors IT
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button 
              onClick={() => setIsPinned(!isPinned)} 
              className={clsx(
                "hidden md:flex p-1.5 hover:bg-slate-700 rounded-lg transition-colors text-slate-400 hover:text-white",
                !isExpanded && "hidden"
              )}
            >
              {isPinned ? <Pin className="w-4 h-4 text-blue-400" /> : <PinOff className="w-4 h-4" />}
            </button>
            <button onClick={() => setIsOpen(false)} className="md:hidden p-1 hover:bg-slate-700 rounded-lg transition-colors">
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-3 space-y-1 custom-scrollbar">
          {visibleNavItems.map((item) => (
            item.isHeader ? (
              <div key={item.name} className={clsx("px-3 pt-4 pb-2 transition-all duration-300", !isExpanded && "opacity-0 h-0 overflow-hidden py-0 pt-0")}>
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 whitespace-nowrap">{item.name}</span>
              </div>
            ) : (
              <NavLink
                key={item.name}
                to={item.path}
                title={!isExpanded ? item.name : undefined}
                onClick={() => setIsOpen(false)}
                className={({ isActive }) => clsx(
                  "relative flex items-center gap-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-300 group active:scale-[0.97] ease-out",
                  isExpanded ? "px-3" : "justify-center px-0",
                  isActive 
                    ? "bg-gradient-to-r from-blue-600/30 to-blue-600/5 text-blue-400 shadow-[inset_4px_0_0_0_#3b82f6] shadow-blue-900/40" 
                    : "hover:bg-slate-800/60 hover:text-white hover:translate-x-1"
                )}
              >
                <div className={clsx(
                    "absolute inset-0 bg-blue-400/20 opacity-0 transition-opacity duration-300 rounded-xl",
                    "group-active:opacity-100"
                )} />
                
                <item.icon className={clsx(
                  "w-5 h-5 transition-transform duration-300 shrink-0",
                  "group-hover:scale-110",
                  "group-active:scale-95"
                )} />
                <span className={clsx(
                  "relative z-10 tracking-wide whitespace-nowrap transition-all duration-300",
                  !isExpanded ? "opacity-0 w-0 overflow-hidden" : "opacity-100 flex-1"
                )}>{item.name}</span>
              </NavLink>
            )
          ))}
        </nav>

        <div className="p-3 bg-slate-900/30 shrink-0 border-t border-slate-800 pointer-events-auto overflow-hidden">
          <button 
            onClick={handleLogout}
            title={!isExpanded ? 'Logout' : undefined}
            className={clsx(
              "flex items-center w-full py-2.5 rounded-xl text-[13px] font-medium text-slate-400 hover:bg-slate-800 hover:text-red-400 transition-all duration-200 cursor-pointer",
              isExpanded ? "gap-3 px-3" : "justify-center px-0 gap-0"
            )}
          >
            <LogOut className="w-5 h-5 shrink-0" />
            <span className={clsx("whitespace-nowrap transition-all duration-300", !isExpanded ? "opacity-0 w-0 overflow-hidden" : "opacity-100")}>Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
}
