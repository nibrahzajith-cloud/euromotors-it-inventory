import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Monitor, Users, LayoutDashboard, Settings, Wrench, FileText, QrCode } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const COMMANDS = [
  { id: 'dash', name: 'Go to Dashboard', icon: LayoutDashboard, path: '/' },
  { id: 'assets', name: 'Manage Assets', icon: Monitor, path: '/assets' },
  { id: 'add-asset', name: 'Register New Asset', icon: Monitor, path: '/assets/new' },
  { id: 'employees', name: 'Manage Employees', icon: Users, path: '/employees' },
  { id: 'maintenance', name: 'Maintenance & Diagnostics', icon: Wrench, path: '/maintenance' },
  { id: 'reports', name: 'Analytics & Reports', icon: FileText, path: '/reports' },
  { id: 'qrcode', name: 'QR Code Center', icon: QrCode, path: '/qr-code' },
  { id: 'settings', name: 'System Settings', icon: Settings, path: '/settings' },
];

export default function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const navigate = useNavigate();
  const inputRef = useRef(null);

  // Toggle on Ctrl+K or Cmd+K
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((open) => !open);
        setQuery('');
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setSelectedIndex(0);
    }
  }, [isOpen, query]);

  const filteredCommands = COMMANDS.filter((cmd) =>
    cmd.name.toLowerCase().includes(query.toLowerCase())
  );

  const handleExecute = (path) => {
    setIsOpen(false);
    navigate(path);
  };

  const handleInputKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % filteredCommands.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredCommands[selectedIndex]) {
        handleExecute(filteredCommands[selectedIndex].path);
      }
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />

          {/* Palette */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="relative w-full max-w-xl bg-white dark:bg-slate-900 shadow-2xl rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800"
          >
            {/* Search Input */}
            <div className="flex items-center px-4 py-4 border-b border-slate-100 dark:border-slate-800">
              <Search className="w-5 h-5 text-slate-400" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleInputKeyDown}
                placeholder="Type a command or search... (↑/↓ to navigate, Enter to select)"
                className="flex-1 ml-3 bg-transparent border-none outline-none text-slate-800 dark:text-slate-200 placeholder:text-slate-400 text-lg"
              />
              <div className="flex gap-1 text-xs font-mono text-slate-400">
                <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">ESC</kbd>
              </div>
            </div>

            {/* Results list */}
            <div className="max-h-[300px] overflow-y-auto p-2">
              {filteredCommands.length === 0 ? (
                <div className="p-4 text-center text-slate-500">No commands found.</div>
              ) : (
                filteredCommands.map((cmd, idx) => {
                  const Icon = cmd.icon;
                  const isSelected = idx === selectedIndex;
                  return (
                    <button
                      key={cmd.id}
                      onClick={() => handleExecute(cmd.path)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors text-left ${
                        isSelected 
                          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400' 
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      <Icon className="w-5 h-5 opacity-70" />
                      <span className="font-medium">{cmd.name}</span>
                      {isSelected && (
                        <span className="ml-auto text-xs font-semibold opacity-50">Press Enter</span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
