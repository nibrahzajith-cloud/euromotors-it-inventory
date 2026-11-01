import { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  MonitorSmartphone, 
  Layers, 
  Users, 
  Building2, 
  MapPin, 
  Wrench, 
  ShieldCheck, 
  FileText, 
  Settings, 
  ChevronDown,
  LogOut,
  ChevronRight,
  Menu,
  X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Sidebar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  
  // Collapse toggle state
  const [isCollapsed, setIsCollapsed] = useState(false);
  // Track open submenu groups
  const [openSubmenu, setOpenSubmenu] = useState({});

  const toggleSubmenu = (name, e) => {
    e.preventDefault();
    e.stopPropagation();
    setOpenSubmenu(prev => ({ ...prev, [name]: !prev[name] }));
  };

  const menuItems = [
    { 
      name: 'Dashboard', 
      path: '/', 
      icon: LayoutDashboard,
      hasSubmenu: false 
    },
    { 
      name: 'Assets', 
      path: '/assets', 
      icon: MonitorSmartphone,
      hasSubmenu: true,
      subItems: [
        { name: 'All Assets', path: '/assets' },
        { name: 'Add New Asset', path: '/assets/add' },
        { name: 'Assignments', path: '/assignments' },
        { name: 'QR Codes', path: '/qr-code' }
      ]
    },
    { 
      name: 'Inventory', 
      path: '/assets?status=AVAILABLE', 
      icon: Layers,
      hasSubmenu: true,
      subItems: [
        { name: 'In Store / Available', path: '/assets?status=AVAILABLE' },
        { name: 'Assigned Fleet', path: '/assets?status=ASSIGNED' },
        { name: 'Scanner Check-in', path: '/scanner' }
      ]
    },
    { 
      name: 'Employees', 
      path: '/employees', 
      icon: Users,
      hasSubmenu: true,
      subItems: [
        { name: 'Staff Directory', path: '/employees' },
        { name: 'Add Employee', path: '/employees/add' }
      ]
    },
    { 
      name: 'Departments', 
      path: '/departments', 
      icon: Building2,
      hasSubmenu: true 
    },
    { 
      name: 'Locations', 
      path: '/locations', 
      icon: MapPin,
      hasSubmenu: true 
    },
    { 
      name: 'Maintenance', 
      path: '/maintenance', 
      icon: Wrench,
      hasSubmenu: true,
      subItems: [
        { name: 'Repair Queue', path: '/maintenance' },
        { name: 'Support Tickets', path: '/tickets' }
      ]
    },
    { 
      name: 'Warranty', 
      path: '/reports', 
      icon: ShieldCheck,
      hasSubmenu: true,
      subItems: [
        { name: 'Expiring Soon', path: '/reports' },
        { name: 'Vendor SLA Tracking', path: '/reports' }
      ]
    },
    { 
      name: 'Reports', 
      path: '/reports', 
      icon: FileText,
      hasSubmenu: true,
      subItems: [
        { name: 'Executive Summary', path: '/reports' },
        { name: 'System Audit Logs', path: '/audit-logs' }
      ]
    },
    { 
      name: 'Settings', 
      path: '/settings', 
      icon: Settings,
      hasSubmenu: false 
    }
  ];

  return (
    <aside 
      className={`relative hidden md:flex flex-col bg-[#070a13] border-r border-slate-800/80 transition-all duration-300 z-20 select-none overflow-hidden ${
        isCollapsed ? 'w-18' : 'w-56'
      }`}
    >
      {/* Top Collapse Button Bar */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2 text-slate-500">
        {!isCollapsed && <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Navigation</span>}
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1 rounded-md hover:bg-slate-800/60 hover:text-slate-300 transition-colors ml-auto text-slate-400"
          title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {isCollapsed ? <Menu className="w-4 h-4" /> : <X className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Nav List */}
      <nav className="flex-1 px-3 space-y-1.5 overflow-y-auto custom-scrollbar z-10 pt-1">
        {menuItems.map((item) => {
          const isActive = item.path === '/' 
            ? location.pathname === '/' 
            : location.pathname.startsWith(item.path.split('?')[0]);
          const Icon = item.icon;
          const isSubOpen = openSubmenu[item.name];

          return (
            <div key={item.name} className="space-y-1">
              <NavLink
                to={item.path}
                className={({ isActive: navActive }) => {
                  const active = item.path === '/' ? location.pathname === '/' : isActive;
                  return `group flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 ${
                    active 
                      ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/25 font-bold' 
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                  }`;
                }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Icon className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-105 ${
                    isActive ? 'text-white' : 'text-slate-400 group-hover:text-blue-400'
                  }`} />
                  {!isCollapsed && (
                    <span className="truncate tracking-wide text-xs">{item.name}</span>
                  )}
                </div>

                {!isCollapsed && item.hasSubmenu && (
                  <button 
                    onClick={(e) => toggleSubmenu(item.name, e)}
                    className="p-0.5 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                  >
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isSubOpen ? 'rotate-180' : ''}`} />
                  </button>
                )}
              </NavLink>

              {/* Submenu Dropdown */}
              {!isCollapsed && item.hasSubmenu && isSubOpen && item.subItems && (
                <div className="pl-9 pr-2 py-1 space-y-1 bg-slate-900/40 rounded-lg">
                  {item.subItems.map((sub) => (
                    <NavLink
                      key={sub.name}
                      to={sub.path}
                      className={({ isActive }) => `block py-1 px-2 rounded text-[11px] font-medium transition-colors ${
                        isActive ? 'text-blue-400 font-semibold bg-blue-500/10' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {sub.name}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Automotive Styling at Bottom of Sidebar matching Reference Image */}
      <div className="relative mt-auto w-full pt-6 pointer-events-none select-none overflow-hidden">
        {/* Subtle Ambient Blue Lighting */}
        <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-blue-600/15 via-blue-900/10 to-transparent blur-md" />
        
        {/* Car Silhouette Image */}
        <div className="relative w-full h-36 flex items-end justify-center">
          <img 
            src="/assets/sidebar-car.png" 
            alt="Euro Motors Fleet" 
            className="w-full object-cover object-top opacity-85 drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]"
            onError={(e) => {
              // Graceful fallback if image file unavailable
              e.target.style.display = 'none';
            }}
          />
        </div>
      </div>
    </aside>
  );
}
