import { useState, useRef, useEffect, useMemo } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  MonitorSmartphone,
  Layers,
  Users,
  Building2,
  MapPin,
  ArrowRightLeft,
  Share2,
  Wrench,
  ShieldCheck,
  QrCode,
  FileText,
  History,
  Settings,
  ChevronDown,
  Menu,
  Pin,
  Search,
  Sparkles,
  Zap,
  Eye,
  EyeOff,
  Command,
  LogOut
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Sidebar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Mode States persisted in localStorage
  const [isPinned, setIsPinned] = useState(() => {
    const saved = localStorage.getItem('it-sidebar-pinned');
    return saved !== null ? saved === 'true' : false;
  });

  const [autoHide, setAutoHide] = useState(() => {
    const saved = localStorage.getItem('it-sidebar-autohide');
    return saved !== null ? saved === 'true' : true;
  });

  const [isHovered, setIsHovered] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');
  const [openSubmenu, setOpenSubmenu] = useState({});
  const hoverTimeoutRef = useRef(null);

  // Expanded if: (Pinned and AutoHide is off) OR currently hovered
  // When Auto-Hide is OFF and pinned: permanently expanded.
  // When Auto-Hide is ON: collapses to icon bar or slim strip, expands on hover.
  const isExpanded = (!autoHide && isPinned) || isHovered;

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovered(false);
      setFilterQuery(''); // Reset filter on collapse
    }, 220);
  };

  const togglePin = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setIsPinned(prev => {
      const next = !prev;
      localStorage.setItem('it-sidebar-pinned', String(next));
      if (next) {
        setAutoHide(false);
        localStorage.setItem('it-sidebar-autohide', 'false');
      }
      return next;
    });
  };

  const toggleAutoHide = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setAutoHide(prev => {
      const next = !prev;
      localStorage.setItem('it-sidebar-autohide', String(next));
      if (next) {
        setIsPinned(false);
        localStorage.setItem('it-sidebar-pinned', 'false');
      }
      return next;
    });
  };

  const handleMenuClick = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (isExpanded) {
      setIsHovered(false);
      setIsPinned(false);
      setAutoHide(true);
      localStorage.setItem('it-sidebar-pinned', 'false');
      localStorage.setItem('it-sidebar-autohide', 'true');
    } else {
      setIsHovered(true);
      setIsPinned(true);
      setAutoHide(false);
      localStorage.setItem('it-sidebar-pinned', 'true');
      localStorage.setItem('it-sidebar-autohide', 'false');
    }
  };

  const toggleSubmenu = (name, e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setOpenSubmenu(prev => ({ ...prev, [name]: !prev[name] }));
  };

  const handleNavClick = () => {
    if (autoHide && !isPinned) {
      setIsHovered(false);
    }
  };

  // 14 Core Authorized Modules
  const allModules = useMemo(() => [
    {
      id: 'dashboard',
      name: 'Control Center',
      path: '/',
      icon: LayoutDashboard,
      description: 'System metrics & operational KPIs',
      hasSubmenu: false
    },
    {
      id: 'assets',
      name: 'Asset Management',
      path: '/assets',
      icon: MonitorSmartphone,
      description: 'All hardware and IT assets',
      hasSubmenu: true,
      subItems: [
        { name: 'All Assets List', path: '/assets' },
        { name: 'Register New Asset', path: '/assets/add' },
        { name: 'Bulk Upload & Export', path: '/assets?tab=export' }
      ]
    },
    {
      id: 'inventory',
      name: 'Inventory & Store',
      path: '/assets?status=AVAILABLE',
      icon: Layers,
      description: 'Stock availability and store assets',
      hasSubmenu: true,
      subItems: [
        { name: 'Available in Store', path: '/assets?status=AVAILABLE' },
        { name: 'Currently Assigned', path: '/assets?status=ASSIGNED' },
        { name: 'Scanner Check-in', path: '/scanner' }
      ]
    },
    {
      id: 'employees',
      name: 'Employees',
      path: '/employees',
      icon: Users,
      description: 'Employee profiles & asset custodian list',
      hasSubmenu: true,
      subItems: [
        { name: 'Staff Directory', path: '/employees' },
        { name: 'Add New Employee', path: '/employees/add' }
      ]
    },
    {
      id: 'departments',
      name: 'Departments',
      path: '/departments',
      icon: Building2,
      description: 'Departmental divisions & unit assets',
      hasSubmenu: false
    },
    {
      id: 'locations',
      name: 'Locations',
      path: '/locations',
      icon: MapPin,
      description: 'Branches, facilities & showrooms',
      hasSubmenu: false
    },
    {
      id: 'assignments',
      name: 'Assignments & Returns',
      path: '/assignments',
      icon: ArrowRightLeft,
      description: 'Issue assets and process check-in returns',
      hasSubmenu: false
    },
    {
      id: 'shared-assets',
      name: 'Shared Assets',
      path: '/assets?assignmentType=SHARED',
      icon: Share2,
      description: 'Common pool & multi-user equipment',
      hasSubmenu: false
    },
    {
      id: 'maintenance',
      name: 'Maintenance & Repairs',
      path: '/maintenance',
      icon: Wrench,
      description: 'Repair tracking and maintenance logs',
      hasSubmenu: true,
      subItems: [
        { name: 'Active Repair Queue', path: '/maintenance' },
        { name: 'Support Tickets', path: '/tickets' }
      ]
    },
    {
      id: 'warranty',
      name: 'Warranty Management',
      path: '/reports',
      icon: ShieldCheck,
      description: 'Expiry alerts and SLA coverage',
      hasSubmenu: true,
      subItems: [
        { name: 'Warranty Alerts', path: '/reports?tab=warranty' },
        { name: 'Vendor SLA Tracking', path: '/reports?tab=sla' }
      ]
    },
    {
      id: 'qr-codes',
      name: 'QR Code Management',
      path: '/qr-code',
      icon: QrCode,
      description: 'QR generation, batch print & scanning',
      hasSubmenu: true,
      subItems: [
        { name: 'Generate & Batch Print', path: '/qr-code' },
        { name: 'Live Camera Scanner', path: '/scanner' }
      ]
    },
    {
      id: 'reports',
      name: 'Reports & Analytics',
      path: '/reports',
      icon: FileText,
      description: 'Executive dashboards & data exports',
      hasSubmenu: false
    },
    {
      id: 'audit-logs',
      name: 'System Audit Logs',
      path: '/audit-logs',
      icon: History,
      description: 'Activity timeline & security trail',
      hasSubmenu: false
    },
    {
      id: 'settings',
      name: 'Settings & Admin',
      path: '/settings',
      icon: Settings,
      description: 'System config & user access',
      hasSubmenu: true,
      subItems: [
        { name: 'System Settings', path: '/settings' },
        { name: 'User Management', path: '/users' },
        { name: 'Database & Storage', path: '/database' }
      ]
    }
  ], []);

  // Filter modules based on search input
  const filteredModules = useMemo(() => {
    if (!filterQuery.trim()) return allModules;
    const q = filterQuery.toLowerCase();
    return allModules.filter(m =>
      m.name.toLowerCase().includes(q) ||
      m.description?.toLowerCase().includes(q) ||
      m.subItems?.some(s => s.name.toLowerCase().includes(q))
    );
  }, [allModules, filterQuery]);

  return (
    <div
      className={`hidden md:block shrink-0 relative transition-all duration-300 select-none ${
        isPinned ? 'w-64' : 'w-16'
      }`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Invisible Hover Activation Zone for Edge Trigger */}
      <div
        className="absolute -top-4 -bottom-4 -left-2 w-6 z-30 pointer-events-auto"
        onMouseEnter={handleMouseEnter}
      />

      <aside
        className={`flex flex-col bg-white dark:bg-[#070a13] border-r border-slate-200 dark:border-slate-800/80 transition-all duration-300 z-40 select-none overflow-hidden h-full ${
          isPinned
            ? 'relative w-64'
            : (isHovered
                ? 'absolute top-0 bottom-0 left-0 w-64 shadow-2xl shadow-black/50 border-r border-slate-300 dark:border-slate-700/80'
                : 'relative w-16')
        }`}
      >
        {/* Top Header Bar */}
        <div className={`h-14 flex items-center px-3 border-b border-slate-100 dark:border-slate-800/80 shrink-0 transition-colors ${
          isExpanded ? 'justify-between' : 'justify-center'
        }`}>
          {/* Menu Toggle Button */}
          <button
            onClick={handleMenuClick}
            className="w-10 h-10 flex items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/70 transition-colors shrink-0 cursor-pointer"
            title={isExpanded ? (isPinned ? "Unpin sidebar" : "Collapse sidebar") : "Expand sidebar (click to pin)"}
          >
            <Menu className="w-5 h-5" />
          </button>

          {isExpanded && (
            <div className="flex items-center gap-1.5 overflow-hidden">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-200 truncate">
                Navigation
              </span>
            </div>
          )}

          {isExpanded && (
            <div className="flex items-center gap-1">
              {/* Auto-Hide ON/OFF Toggle Button */}
              <button
                onClick={toggleAutoHide}
                className={`p-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                  autoHide
                    ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400'
                    : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                }`}
                title={autoHide ? "Auto-Hide: ON (Hover to expand)" : "Auto-Hide: OFF"}
              >
                {autoHide ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>

              {/* Pin / Unpin Button */}
              <button
                onClick={togglePin}
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                  isPinned
                    ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/15 shadow-sm'
                    : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                }`}
                title={isPinned ? "Unpin sidebar (Allow auto-hide on mouse leave)" : "Pin sidebar permanently expanded"}
              >
                <Pin className={`w-3.5 h-3.5 transition-transform duration-200 ${isPinned ? 'fill-blue-500/20 rotate-45' : ''}`} />
              </button>
            </div>
          )}
        </div>

        {/* Quick Filter Search in Sidebar (when expanded) */}
        {isExpanded && (
          <div className="px-3 pt-2.5 pb-1">
            <div className="relative flex items-center bg-slate-100/80 dark:bg-[#0c1322] border border-slate-200 dark:border-slate-700/60 rounded-xl px-2.5 py-1.5 text-xs">
              <Search className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 mr-2 shrink-0" />
              <input
                type="text"
                placeholder="Filter modules..."
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                className="w-full bg-transparent outline-none text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 text-xs"
              />
              {filterQuery && (
                <button
                  onClick={() => setFilterQuery('')}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-[10px] font-bold px-1"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        )}

        {/* Nav List */}
        <nav className="flex-1 px-2.5 space-y-1 overflow-y-auto custom-scrollbar z-10 pt-2 pb-4">
          {filteredModules.map((item) => {
            const rawPath = item.path.split('?')[0];
            const isRoot = item.path === '/';
            const isActive = isRoot
              ? location.pathname === '/'
              : (location.pathname === rawPath || location.pathname.startsWith(`${rawPath}/`));

            const Icon = item.icon;
            const isSubOpen = openSubmenu[item.name];

            return (
              <div key={item.id} className="relative group/nav space-y-0.5">
                <NavLink
                  to={item.path}
                  onClick={handleNavClick}
                  className={({ isActive: navActive }) => {
                    const active = isRoot ? location.pathname === '/' : isActive;
                    return `group flex items-center ${
                      isExpanded ? 'justify-between px-3' : 'justify-center w-11 mx-auto'
                    } h-9 rounded-xl text-xs font-semibold transition-all duration-150 ${
                      active
                        ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-md shadow-blue-500/25 font-bold'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
                    }`;
                  }}
                >
                  <div className={`flex items-center ${isExpanded ? 'gap-3 min-w-0' : 'justify-center'}`}>
                    <Icon className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-110 ${
                      isActive ? 'text-white' : 'text-slate-500 dark:text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400'
                    }`} />
                    {isExpanded && (
                      <span className="truncate tracking-wide text-xs">{item.name}</span>
                    )}
                  </div>

                  {isExpanded && item.hasSubmenu && (
                    <button
                      type="button"
                      onClick={(e) => toggleSubmenu(item.name, e)}
                      className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
                      title="Toggle submenu"
                    >
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isSubOpen ? 'rotate-180' : ''}`} />
                    </button>
                  )}
                </NavLink>

                {/* Floating Tooltip in Collapsed Mode */}
                {!isExpanded && (
                  <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2.5 py-1.5 bg-slate-900 text-white dark:bg-slate-800 dark:text-white text-xs font-medium rounded-lg shadow-xl opacity-0 group-hover/nav:opacity-100 pointer-events-none transition-all duration-150 whitespace-nowrap z-50 border border-slate-700/60">
                    <div className="font-bold">{item.name}</div>
                    {item.description && (
                      <div className="text-[10px] text-slate-400 font-normal">{item.description}</div>
                    )}
                  </div>
                )}

                {/* Submenu Dropdown in Expanded Mode */}
                {isExpanded && item.hasSubmenu && (isSubOpen || filterQuery.trim().length > 0) && item.subItems && (
                  <div className="pl-8 pr-1 py-1 space-y-0.5 bg-slate-50/70 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800/60 rounded-xl my-0.5">
                    {item.subItems.map((sub) => {
                      const isSubActive = location.pathname + location.search === sub.path ||
                        location.pathname === sub.path.split('?')[0];

                      return (
                        <NavLink
                          key={sub.name}
                          to={sub.path}
                          onClick={handleNavClick}
                          className={`block py-1.5 px-2 rounded-lg text-[11px] font-medium transition-colors ${
                            isSubActive
                              ? 'text-blue-600 dark:text-blue-400 font-bold bg-blue-50 dark:bg-blue-500/10'
                              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/50'
                          }`}
                        >
                          {sub.name}
                        </NavLink>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Sidebar Logout Action */}
        <div className="px-2 pt-2 pb-1 shrink-0 border-t border-slate-100 dark:border-slate-800/60">
          <button
            onClick={() => {
              logout();
              navigate('/login');
            }}
            title={!isExpanded ? 'Sign Out' : undefined}
            className={`w-full flex items-center py-2 px-2.5 rounded-xl text-xs font-semibold text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors cursor-pointer ${
              isExpanded ? 'gap-3 justify-start' : 'justify-center'
            }`}
          >
            <LogOut className="w-4 h-4 text-red-500/80 shrink-0" />
            {isExpanded && <span>Sign Out</span>}
          </button>
        </div>

        {/* Automotive Styling & Status at Bottom of Sidebar */}
        <div className="relative mt-auto w-full pt-3 pointer-events-none select-none overflow-hidden shrink-0 border-t border-slate-100 dark:border-slate-800/60">
          <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-blue-500/10 via-blue-500/5 to-transparent dark:from-blue-600/15 dark:via-blue-900/10 dark:to-transparent blur-md" />

          {isExpanded && (
            <div className="px-3 pb-1 flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500">
              <span className="flex items-center gap-1 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Connected
              </span>
              <span className="font-mono text-[9px] uppercase tracking-wider bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                Ctrl + K
              </span>
            </div>
          )}

          {/* Car Silhouette Image */}
          <div className="relative w-full h-20 flex items-end justify-center overflow-hidden">
            <img
              src="/assets/sidebar-car.png"
              alt="Euro Motors Fleet"
              className="w-full object-cover object-top opacity-75 dark:opacity-85 drop-shadow-[0_0_12px_rgba(59,130,246,0.3)] dark:drop-shadow-[0_0_12px_rgba(59,130,246,0.5)] transition-opacity"
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
