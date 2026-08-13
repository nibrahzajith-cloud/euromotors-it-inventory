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
  Ticket,
  Database
} from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '../context/AuthContext';

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isPinned, setIsPinned] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { name: 'Control Center', path: '/', icon: LayoutDashboard, alwaysShow: true },
    
    { 
      name: 'Operations', 
      isHeader: true,
      alwaysShow: true 
    },
    { name: 'Assets', path: '/assets', icon: MonitorSmartphone, permission: 'VIEW_ASSETS' },
    { name: 'Add Asset', path: '/assets/add', icon: PlusCircle, permission: 'CREATE_ASSETS' },
    { name: 'Employees', path: '/employees', icon: Users, permission: 'MANAGE_EMPLOYEES' },
    { name: 'Departments', path: '/departments', icon: Building2, permission: 'MANAGE_DEPARTMENTS' },
    { name: 'Locations', path: '/locations', icon: MapPin, permission: 'MANAGE_LOCATIONS' },
    { name: 'Asset Assignment', path: '/assignments', icon: ArrowRightLeft, permission: 'ASSIGN_ASSETS' },
    { name: 'QR Code', path: '/qr-code', icon: QrCode, permission: 'CREATE_ASSETS' },
    { name: 'Camera Scanner', path: '/scanner', icon: Camera, permission: 'CREATE_ASSETS' },
    { name: 'Maintenance', path: '/maintenance', icon: Wrench, permission: 'EDIT_ASSETS' },
    { name: 'Support Desk', path: '/tickets', icon: Ticket, alwaysShow: true },
    
    { 
      name: 'System', 
      isHeader: true,
      roleRequired: 'ADMIN' // Headers for system settings can just stay ADMIN to simplify
    },
    { name: 'Reports', path: '/reports', icon: FileText, permission: 'EXPORT_REPORTS' },
    { name: 'Audit Logs', path: '/audit-logs', icon: History, permission: 'VIEW_AUDIT_LOG' },
    { name: 'Database', path: '/database', icon: Database, permission: 'VIEW_STORAGE_STATS' },
    { name: 'User Management', path: '/users', icon: ShieldCheck, permission: 'MANAGE_USERS' },
    { name: 'Role & Permissions', path: '/permissions', icon: ShieldCheck, permission: 'MANAGE_ROLES' },
    { name: 'Settings', path: '/settings', icon: Settings, permission: 'CONFIGURE_SYSTEM' },
  ];

  const fullPermissions = {
    VIEW_ASSETS: true, CREATE_ASSETS: true, EDIT_ASSETS: true, DELETE_ASSETS: true,
    ASSIGN_ASSETS: true, TRANSFER_ASSETS: true, 
    UPLOAD_ASSET_IMAGES: true, REPLACE_ASSET_IMAGES: true, DELETE_ASSET_IMAGES: true,
    UPLOAD_ASSET_DOCUMENTS: true, DOWNLOAD_ASSET_DOCUMENTS: true, DELETE_ASSET_DOCUMENTS: true,
    BULK_IMPORT_ASSETS: true, EXPORT_REPORTS: true, VIEW_STORAGE_STATS: true,
    MANAGE_EMPLOYEES: true, MANAGE_DEPARTMENTS: true, MANAGE_LOCATIONS: true,
    MANAGE_USERS: true, MANAGE_ROLES: true, VIEW_AUDIT_LOG: true, EXPORT_AUDIT_LOG: true, CONFIGURE_SYSTEM: true
  };
  const defaultPermissions = {
    ADMIN: fullPermissions,
    IT_OFFICER: fullPermissions,
    VIEWER: fullPermissions
  };

  const userPermissions = user?.permissions || (user?.role ? defaultPermissions[user.role] : {});

  // Filter items based on user granular permissions
  const visibleNavItems = navItems.filter((item, index, array) => {
    if (item.isHeader) {
      // Find items that belong to this header (until next header)
      const nextHeaderIndex = array.findIndex((el, i) => i > index && el.isHeader);
      const itemsInGroup = array.slice(index + 1, nextHeaderIndex === -1 ? array.length : nextHeaderIndex);
      return itemsInGroup.some(child => {
        if (child.alwaysShow) return true;
        if (child.roleRequired && user?.role === child.roleRequired) return true;
        if (child.permission && userPermissions[child.permission]) return true;
        return false;
      });
    }
    if (item.alwaysShow) return true;
    if (item.roleRequired && user?.role !== item.roleRequired) return false;
    if (item.permission && !userPermissions[item.permission]) return false;
    return true;
  });

  const isExpanded = isPinned || isHovered;

  return (
    <>
      <aside 
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={clsx(
          "hidden md:flex md:flex-col inset-y-0 left-0 z-30 bg-black text-slate-300 border-r border-white/5 transition-all duration-300 ease-in-out",
          isExpanded ? "w-64" : "w-20"
        )}
      >

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

        <div className="p-3 bg-white/[0.02] shrink-0 border-t border-white/5 pointer-events-auto overflow-hidden flex flex-col gap-1.5">
          <button 
            onClick={() => setIsPinned(!isPinned)} 
            title={!isExpanded ? (isPinned ? "Unpin sidebar" : "Pin sidebar") : undefined}
            className={clsx(
              "flex items-center w-full py-2.5 rounded-xl text-[13px] font-medium text-slate-400 hover:bg-slate-800 hover:text-white transition-all duration-200 cursor-pointer",
              isExpanded ? "gap-3 px-3" : "justify-center px-0 gap-0"
            )}
          >
            {isPinned ? <Pin className="w-5 h-5 text-blue-400 shrink-0" /> : <PinOff className="w-5 h-5 shrink-0" />}
            <span className={clsx("whitespace-nowrap transition-all duration-300", !isExpanded ? "opacity-0 w-0 overflow-hidden" : "opacity-100")}>
              {isPinned ? "Unpin Sidebar" : "Pin Sidebar"}
            </span>
          </button>

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
