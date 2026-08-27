import React, { createContext, useState, useContext, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS } from '../theme/tokens';

const ThemeContext = createContext();

export const useTheme = () => useContext(ThemeContext);

// Legacy-compatible, theme-aware colors (keeps the COLORS.text.dark style naming used by older screens)
export const useColors = () => {
  const { colors } = useTheme();
  return colors;
};

const THEME_KEY = '@palengkehub_theme';

export const ThemeProvider = ({ children }) => {
  const systemScheme = useColorScheme();
  const [themeMode, setThemeMode] = useState('system'); // 'light', 'dark', 'system'
  const [colors, setColors] = useState(COLORS.light);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    loadTheme();
  }, []);

  useEffect(() => {
    applyTheme();
  }, [themeMode, systemScheme]);

  const loadTheme = async () => {
    try {
      const saved = await AsyncStorage.getItem(THEME_KEY);
      if (saved) setThemeMode(saved);
    } catch (e) {
      console.warn('Error loading theme:', e);
    }
  };

  const applyTheme = () => {
    const mode = themeMode === 'system' ? (systemScheme || 'light') : themeMode;
    setColors(COLORS[mode] || COLORS.light);
    setIsDark(mode === 'dark');
  };

  const setTheme = async (mode) => {
    setThemeMode(mode);
    try {
      await AsyncStorage.setItem(THEME_KEY, mode);
    } catch (e) {
      console.warn('Error saving theme:', e);
    }
  };

  return (
    <ThemeContext.Provider value={{ colors, isDark, themeMode, setTheme, COLORS }}>
      {children}
    </ThemeContext.Provider>
  );
};