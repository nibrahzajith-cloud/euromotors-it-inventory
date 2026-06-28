import { createContext, useContext, useEffect, useState, useCallback } from 'react';

const ThemeContext = createContext();
const STORAGE_KEY = 'euromotors-theme';

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    // Read from localStorage, default to 'dark'
    return localStorage.getItem(STORAGE_KEY) || 'dark';
  });
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    const root = window.document.documentElement;
    
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    const root = window.document.documentElement;
    // Add transition class for smooth theme switch
    root.classList.add('theme-transitioning');
    setIsTransitioning(true);

    setTheme(prev => prev === 'light' ? 'dark' : 'light');

    // Remove transition class after animation completes
    setTimeout(() => {
      root.classList.remove('theme-transitioning');
      setIsTransitioning(false);
    }, 500);
  }, []);

  const isDark = theme === 'dark';

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, isDark, isTransitioning }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
