import { useState, useRef, useEffect } from 'react';
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
  Menu,
  Pin
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Sidebar() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  
  // Persisted pinned state: true = docked open; false = auto-hide (opens on hover)
  const [isPinned, setIsPinned] = useState(() => {
    const saved = localStorage.getItem('it-sidebar-pinned');
    return saved !== null ? saved === 'true' : false;
  });

  const [isHovered, setIsHovered] = useState(false);
  const hoverTimeoutRef = useRef(null);

  // Active expanded state: true if pinned OR hovered
  const isExpanded = isPinned || isHovered;

  // Track open submenu groups
  const [openSubmenu, setOpenSubmenu] = useState({});

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovered(false);
    }, 180);
  };

  const togglePin = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setIsPinned(prev => {
      const next = !prev;
      localStorage.setItem('it-sidebar-pinned', String(next));
      return next;
    });
  };

  const handleMenuClick = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (isPinned) {
      // Unpin and collapse
      setIsPinned(false);
      setIsHovered(false);
      localStorage.setItem('it-sidebar-pinned', 'false');
    } else {
      // Pin and expand
      setIsPinned(true);
      setIsHovered(true);
      localStorage.setItem('it-sidebar-pinned', 'true');
    }
  };

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
    <div 
      className={`hidden md:block shrink-0 relative transition-all duration-300 select-none ${
        isPinned ? 'w-60' : 'w-16'
      }`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <aside 
        className={`flex flex-col bg-white dark:bg-[#070a13] border-r border-slate-200 dark:border-slate-800/80 transition-all duration-300 z-40 select-none overflow-hidden h-full ${
          isPinned 
            ? 'relative w-60' 
            : (isHovered 
                ? 'absolute top-0 bottom-0 left-0 w-60 shadow-2xl shadow-black/40 border-r border-slate-300 dark:border-slate-700/80' 
                : 'relative w-16')
        }`}
      >
        {/* Top Header Bar: 3-line Menu & Pin Button */}
        <div className={`h-14 flex items-center px-3 border-b border-slate-100 dark:border-slate-800/60 shrink-0 transition-colors ${
          isExpanded ? 'justify-between' : 'justify-center'
        }`}>
          {/* 3-line Menu Button - Perfectly centered in icon column */}
          <button 
            onClick={handleMenuClick}
            className="w-10 h-10 flex items-center justify-center rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors shrink-0"
            title={isExpanded ? (isPinned ? "Unpin sidebar" : "Collapse sidebar") : "Expand sidebar (click to pin)"}
          >
            <Menu className="w-5 h-5" />
          </button>

          {isExpanded && (
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 truncate mx-2">
              Navigation
            </span>
          )}

          {isExpanded && (
            <button 
              onClick={togglePin}
              className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors shrink-0 ${
                isPinned 
                  ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/15' 
                  : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60'
              }`}
              title={isPinned ? "Unpin sidebar (auto-hide on mouse leave)" : "Pin sidebar open"}
            >
              <Pin className={`w-4 h-4 transition-transform duration-200 ${isPinned ? 'fill-blue-500/20 rotate-45' : ''}`} />
            </button>
          )}
        </div>

        {/* Nav List */}
        <nav className="flex-1 px-3 space-y-1.5 overflow-y-auto custom-scrollbar z-10 pt-2">
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
                  title={!isExpanded ? item.name : undefined}
                  className={({ isActive: navActive }) => {
                    const active = item.path === '/' ? location.pathname === '/' : isActive;
                    return `group flex items-center ${
                      isExpanded ? 'justify-between px-3' : 'justify-center w-10 mx-auto'
                    } h-10 rounded-xl text-xs font-semibold transition-all duration-150 ${
                      active 
                        ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/25 font-bold' 
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/50'
                    }`;
                  }}
                >
                  <div className={`flex items-center ${isExpanded ? 'gap-3 min-w-0' : 'justify-center'}`}>
                    <Icon className={`w-5 h-5 shrink-0 transition-transform group-hover:scale-105 ${
                      isActive ? 'text-white' : 'text-slate-500 dark:text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400'
                    }`} />
                    {isExpanded && (
                      <span className="truncate tracking-wide text-xs">{item.name}</span>
                    )}
                  </div>

                  {isExpanded && item.hasSubmenu && (
                    <button 
                      onClick={(e) => toggleSubmenu(item.name, e)}
                      className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
                    >
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isSubOpen ? 'rotate-180' : ''}`} />
                    </button>
                  )}
                </NavLink>

                {/* Submenu Dropdown */}
                {isExpanded && item.hasSubmenu && isSubOpen && item.subItems && (
                  <div className="pl-9 pr-2 py-1 space-y-1 bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-transparent rounded-lg">
                    {item.subItems.map((sub) => (
                      <NavLink
                        key={sub.name}
                        to={sub.path}
                        className={({ isActive }) => `block py-1 px-2 rounded text-[11px] font-medium transition-colors ${
                          isActive 
                            ? 'text-blue-600 dark:text-blue-400 font-semibold bg-blue-50 dark:bg-blue-500/10' 
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/50'
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

        {/* Automotive Styling at Bottom of Sidebar */}
        <div className="relative mt-auto w-full pt-4 pointer-events-none select-none overflow-hidden shrink-0">
          {/* Subtle Ambient Lighting */}
          <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-blue-500/10 via-blue-500/5 to-transparent dark:from-blue-600/15 dark:via-blue-900/10 dark:to-transparent blur-md" />
          
          {/* Car Silhouette Image */}
          <div className="relative w-full h-24 sm:h-28 flex items-end justify-center overflow-hidden">
            <img 
              src="/assets/sidebar-car.png" 
              alt="Euro Motors Fleet" 
              className="w-full object-cover object-top opacity-75 dark:opacity-85 drop-shadow-[0_0_15px_rgba(59,130,246,0.3)] dark:drop-shadow-[0_0_15px_rgba(59,130,246,0.5)] transition-opacity"
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
          </div>
        </div>
      </aside>
    </div>
  );
}