import React, { createContext, useState, useContext, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ThemeContext = createContext();

export const useTheme = () => useContext(ThemeContext);

// Legacy-compatible, theme-aware colors (keeps the COLORS.text.dark style naming used by older screens)
export const useColors = () => {
  const { colors } = useTheme();
  return colors;
};

const THEME_KEY = '@palengkehub_theme';

const COLORS = {
  light: {
    primary: '#DC2626',
    primaryLight: '#EF4444',
    primaryDark: '#B91C1C',
    accent: '#F87171',
    accentLight: '#FEE2E2',
    accentSoft: '#FEF2F2',
        background: '#F8F9FA',
    surface: '#FFFFFF',
    surfaceSecondary: '#F5F5F5',
    card: '#FFFFFF',
    text: {
      primary: '#111827',
      secondary: '#374151',
      tertiary: '#6B7280',
      quaternary: '#9CA3AF',
      inverse: '#FFFFFF',
      // Legacy naming aliases (kept for backward compatibility with older screens)
      dark: '#111827',
      medium: '#374151',
      light: '#6B7280',
      lighter: '#9CA3AF',
      white: '#FFFFFF',
      tertiaryer: '#6B7280',
    },
    border: '#E5E7EB',
    borderLight: '#F3F4F6',
    success: '#10B981',
    successLight: '#D1FAE5',
    error: '#DC2626',
    errorLight: '#FEE2E2',
    warning: '#F59E0B',
    warningLight: '#FFF8E1',
    shadow: 'rgba(0, 0, 0, 0.08)',
    shadowDark: 'rgba(0, 0, 0, 0.12)',
    overlay: 'rgba(0, 0, 0, 0.5)',
    inputBg: '#F3F4F6',
    badgeBg: '#FEE2E2',
    statusBar: 'dark',
    // Screen-specific brand/surface tokens (theme-aware)
    gold: '#F59E0B',
    primarySurface: '#FEF2F2',
    gcash: '#007DFE',
    gcashLight: '#E8F4FF',
  },
  dark: {
    primary: '#EF4444',
    primaryLight: '#F87171',
    primaryDark: '#DC2626',
    accent: '#F87171',
    accentLight: '#7F1D1D',
    accentSoft: '#1A0A0A',
    background: '#0F0F1E',
    surface: '#1A1A2E',
    surfaceSecondary: '#16213E',
    card: '#1A1A2E',
    text: {
      primary: '#F9FAFB',
      secondary: '#D1D5DB',
      tertiary: '#9CA3AF',
      quaternary: '#6B7280',
      inverse: '#111827',
      // Legacy naming aliases (kept for backward compatibility with older screens)
      dark: '#F9FAFB',
      medium: '#D1D5DB',
      light: '#9CA3AF',
      lighter: '#6B7280',
      white: '#111827',
      tertiaryer: '#9CA3AF',
    },
    border: '#2A2A3E',
    borderLight: '#1F1F3A',
    success: '#34D399',
    successLight: '#064E3B',
    error: '#F87171',
    errorLight: '#7F1D1D',
    warning: '#FBBF24',
    warningLight: '#78350F',
    shadow: 'rgba(0, 0, 0, 0.3)',
    shadowDark: 'rgba(0, 0, 0, 0.5)',
    overlay: 'rgba(0, 0, 0, 0.7)',
    inputBg: '#1F1F3A',
    badgeBg: '#7F1D1D',
    statusBar: 'light',
    // Screen-specific brand/surface tokens (theme-aware)
    gold: '#FBBF24',
    primarySurface: '#1A0A0A',
    gcash: '#007DFE',
    gcashLight: '#1E3A8A',
  },
};

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