import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Sidebar from './Sidebar';
import Header from './Header';
import CommandPalette from './CommandPalette';

export default function Layout() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <CommandPalette />
      
      {/* Sidebar */}
      <Sidebar isOpen={isMobileMenuOpen} setIsOpen={setIsMobileMenuOpen} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        <Header onMenuClick={() => setIsMobileMenuOpen(true)} />
        
        {/* Scrollable Main Area */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col bg-slate-50 dark:bg-slate-900 transition-colors duration-300 relative">
          <AnimatePresence mode="wait">
            <motion.main
              key={location.pathname}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="flex-1 p-4 md:p-6"
            >
              <Outlet />
            </motion.main>
          </AnimatePresence>
          
          <footer className="py-4 text-center text-sm text-slate-500 dark:text-slate-400 mt-auto border-t border-slate-200 dark:border-slate-800 shrink-0 transition-colors duration-300">
            Developed By: Nifraz Ajith, Ph.D
          </footer>
        </div>
      </div>
    </div>
  );
}
