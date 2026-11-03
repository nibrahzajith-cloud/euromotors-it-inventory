import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Sidebar from './Sidebar';
import Header from './Header';
import CommandPalette from './CommandPalette';
import MobileNav from './MobileNav';
import Breadcrumb from './Breadcrumb';

export default function Layout() {
  const location = useLocation();

  return (
    <div className="flex flex-col h-screen bg-slate-50 dark:bg-[#060913] text-slate-800 dark:text-slate-200 overflow-hidden transition-colors duration-300">
      <CommandPalette />
      
      {/* Top Header Spanning Full Width */}
      <Header />

      {/* Main Body: Sidebar + Scrollable Content */}
      <div className="flex-1 flex min-h-0 relative overflow-hidden">
        
        {/* Left Navigation Sidebar */}
        <Sidebar />

        {/* Scrollable Center Content Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto overflow-x-hidden bg-slate-50 dark:bg-[#060913] relative custom-scrollbar select-text transition-colors duration-300">
          <Breadcrumb />
          <AnimatePresence mode="wait">
            <motion.main
              key={location.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="flex-1 select-text"
            >
              <Outlet />
            </motion.main>
          </AnimatePresence>
          
          {/* Reference Footer: Section 9 */}
          <footer className="py-3 px-6 bg-white dark:bg-[#070a13] border-t border-slate-200 dark:border-slate-800/80 text-xs text-slate-500 dark:text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-2 shrink-0 select-none transition-colors duration-300">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-800 dark:text-slate-300">EURO MOTORS</span>
              <span className="text-slate-400 dark:text-slate-500">Private Limited</span>
              <span className="text-slate-300 dark:text-slate-600">|</span>
              <span className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">IT Control Center v2.0</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-blue-500 dark:text-blue-400 font-mono text-[11px]">&lt;/&gt;</span>
              <span className="text-slate-500 dark:text-slate-400 text-xs">Developed by:</span>
              <a 
                href="https://wa.me/94755546600" 
                target="_blank" 
                rel="noopener noreferrer"
                className="font-bold text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                Nibrahz Ajith, Ph.D
              </a>
            </div>
          </footer>
        </div>
      </div>

      {/* Mobile Nav Bar */}
      <MobileNav />
    </div>
  );
}
