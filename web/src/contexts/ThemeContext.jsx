// web/src/contexts/ThemeContext.jsx
// Mirrors the mobile app's ThemeContext: binary light/dark, persisted,
// defaults to light regardless of OS preference. The web side doesn't need
// a colors object like the native COLORS.light/COLORS.dark tables — every
// admin.css rule already reads var(--admin-*), which tokens.css re-points
// per [data-theme] — so applying theme here just means setting the
// data-theme attribute on <html> and letting the existing CSS variables do
// the work.
import { createContext, useContext, useEffect, useState } from 'react';

const THEME_KEY = 'palengkehub_admin_theme';

const ThemeContext = createContext();

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }) => {
  const [isDark, setIsDark] = useState(() => {
    try {
      return localStorage.getItem(THEME_KEY) === 'dark';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    try {
      localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light');
    } catch {
      // localStorage unavailable (private mode, etc.) — theme just won't persist
    }
  }, [isDark]);

  const toggleTheme = () => setIsDark((d) => !d);

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
