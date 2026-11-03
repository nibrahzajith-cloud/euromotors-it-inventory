import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Search, Bell, Sun, Moon,
  LayoutDashboard, MonitorSmartphone, PlusCircle, Users,
  UserPlus, Building2, MapPin, ArrowRightLeft, QrCode,
  Wrench, FileText, Settings, ShieldCheck, History,
  Camera, Ticket, Database, KeyRound
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export default function Header() {
  const { user } = useAuth();
  const { toggleTheme, isDark } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const [showNotifications, setShowNotifications] = useState(false);
  const notifRef = useRef(null);
  const [notifications, setNotifications] = useState([]);
  const unreadCount = notifications.filter(n => !n.read).length;

  useEffect(() => {
    const fetchOpenTickets = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/tickets`, {
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
      } catch (e) { }
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
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard shortcut Ctrl+K to trigger search palette
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        const cmdPaletteBtn = document.querySelector('[data-command-palette-trigger]');
        if (cmdPaletteBtn) cmdPaletteBtn.click();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const openSearch = () => {
    const cmdPaletteBtn = document.querySelector('[data-command-palette-trigger]');
    if (cmdPaletteBtn) cmdPaletteBtn.click();
  };

  const displayName = user?.fullName || 'Nibrahz Ajith';
  const displayRole = (user?.role || 'ADMIN').toUpperCase();
  const initials = displayName.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() || 'NA';

  return (
    <header className="h-16 bg-white dark:bg-[#070b13] border-b border-slate-200 dark:border-slate-800/80 px-4 md:px-6 flex items-center justify-between shrink-0 z-30 select-none transition-colors duration-300">

      {/* Left: Euro Motors Branding & Module Title */}
      <div className="flex items-center gap-4">
        {/* Euro Motors Wing Emblem */}
        <div
          onClick={() => navigate('/')}
          className="flex items-center gap-2.5 cursor-pointer group"
        >
          <div className="relative flex items-center justify-center">
            {/* Stylized Wing Logo */}
            <svg className="w-8 h-8 text-blue-500 dark:text-blue-400 group-hover:text-blue-600 dark:group-hover:text-blue-300 transition-colors drop-shadow-[0_0_8px_rgba(59,130,246,0.3)] dark:drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M4 24C12 20 20 16 28 12C36 8 42 6 44 6C42 10 38 16 32 22C26 28 18 34 8 38C6 38 4 34 4 24Z" fill="currentColor" fillOpacity="0.8" />
              <path d="M10 26C16 23 22 20 28 17C34 14 38 13 40 13C38 16 35 20 30 24C25 28 18 32 12 34C11 34 10 32 10 26Z" fill="#3B82F6" />
              <path d="M14 28C18 26 24 23 28 21C32 19 36 18 37 18C35 20 32 23 28 26C24 29 18 32 15 33C14 33 14 31 14 28Z" fill="#60A5FA" />
            </svg>
          </div>
          <div>
            <span className="font-bold text-slate-900 dark:text-white text-xs md:text-sm tracking-wider block font-sans leading-none">
              EURO MOTORS
            </span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 block tracking-tight leading-none mt-1">
              Private Limited
            </span>
          </div>
        </div>

        {/* Vertical divider */}
        <div className="hidden sm:block h-6 w-[1px] bg-slate-200 dark:bg-slate-800" />

        {/* Subtitle / System title */}
        <div className="hidden sm:block">
          <h2 className="text-xs md:text-sm font-bold text-slate-800 dark:text-slate-100 leading-tight">
            IT Control Center
          </h2>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5">
            Asset Management & Operational Analytics
          </p>
        </div>
      </div>

      {/* Right Controls: Search, Notifications, Theme, User */}
      <div className="flex items-center gap-3">

        {/* Global Search Bar (with Ctrl + K) */}
        <div
          onClick={openSearch}
          className="relative hidden md:flex items-center bg-slate-100 hover:bg-slate-200/70 dark:bg-[#0d1424] dark:hover:bg-[#111a2e] border border-slate-200 dark:border-slate-700/60 hover:border-slate-300 dark:hover:border-slate-600 rounded-xl px-3.5 py-1.5 cursor-pointer transition-all w-64 lg:w-72 shadow-inner"
        >
          <Search className="w-3.5 h-3.5 text-slate-400 shrink-0 mr-2.5" />
          <span className="text-xs text-slate-500 dark:text-slate-400 flex-1 truncate">Search assets, employees, locations...</span>
          <kbd className="hidden lg:inline-flex items-center text-[10px] font-mono font-semibold text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 px-1.5 py-0.5 rounded shadow-sm">
            Ctrl + K
          </kbd>
        </div>

        {/* Mobile Search Button */}
        <button
          onClick={openSearch}
          className="md:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800/80 transition-colors"
          title="Search (Ctrl + K)"
        >
          <Search className="w-4 h-4" />
        </button>

        {/* Notification Bell */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800/80 transition-colors"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_6px_#3b82f6]" />
          </button>

          {/* Notifications Dropdown */}
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-[#0e1626] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="p-3.5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-[#0a0f1a]">
                <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">Alerts & Tickets</span>
                <span className="text-[10px] bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 px-2 py-0.5 rounded-full font-bold">
                  {notifications.length} Active
                </span>
              </div>
              <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
                {notifications.length === 0 ? (
                  <p className="text-xs text-slate-400 p-4 text-center">No new notifications</p>
                ) : (
                  notifications.map(n => (
                    <div key={n.id} className="p-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors text-xs space-y-0.5">
                      <p className="font-semibold text-slate-800 dark:text-slate-200">{n.title}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">{n.message}</p>
                      <span className="text-[9px] text-slate-400 dark:text-slate-500 font-mono block pt-0.5">{n.time}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Theme Toggle (Moon button matching reference) */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800/80 transition-colors"
          title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          {isDark ? <Moon className="w-4 h-4 text-blue-400" /> : <Sun className="w-4 h-4 text-amber-500" />}
        </button>

        {/* User Avatar & Name */}
        <div
          onClick={() => navigate('/settings')}
          className="flex items-center gap-2.5 pl-2 cursor-pointer group"
          title="Profile & Settings"
        >
          <div className="w-8 h-8 rounded-full bg-blue-600 hover:bg-blue-500 flex items-center justify-center text-white font-bold text-xs shadow-md shadow-blue-600/30 ring-2 ring-blue-500/30 transition-all shrink-0">
            {initials}
          </div>
          <div className="hidden sm:flex flex-col text-left">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors leading-tight">
              {displayName}
            </span>
            <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider leading-tight">
              {displayRole}
            </span>
          </div>
        </div>

      </div>
    </header>
  );
}
