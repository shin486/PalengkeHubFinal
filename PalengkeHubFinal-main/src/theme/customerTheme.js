// src/theme/customerTheme.js
// Canonical design-tokens for the Customer module.
// Mirrors src/theme/vendorTheme.js so customer & vendor share one visual
// language. Every semantic color routes through ThemeContext (useColors())
// so dark mode is respected — customer screens stop hardcoding hex values.
//
// Usage:
//   import { useCustomerColors, customerSpacing, customerBorderRadius } from '../theme/customerTheme';
//   const C = useCustomerColors();

import { useColors, useTheme } from '../contexts/ThemeContext';

// ============================================================
// STATIC PALETTE (legacy/back-compat — prefer useCustomerColors())
// ============================================================
export const customerColors = {
  // Brand red family (matches ThemeContext.primary at runtime so the brand
  // stays consistent across Header / BottomNavigation / cards).
  primary: '#DC2626',
  primaryLight: '#EF4444',
  primaryDark: '#B91C1C',
  accent: '#F87171',
  accentLight: '#FEE2E2',
  accentSoft: '#FEF2F2',
  background: '#F8F9FA',
  surface: '#FFFFFF',
  surfaceSecondary: '#F5F5F5',
  divider: '#E5E7EB',
  text: {
    primary: '#1F2937',
    dark: '#1F2937',
    medium: '#374151',
    secondary: '#6B7280',
    light: '#6B7280',
    lighter: '#9CA3AF',
    tertiary: '#9CA3AF',
    quaternary: '#D1D5DB',
    white: '#FFFFFF',
  },
  border: '#E5E7EB',
  borderLight: '#F3F4F6',
  success: '#10B981',
  successLight: '#D1FAE5',
  error: '#DC2626',
  errorLight: '#FEE2E2',
  warning: '#F59E0B',
  warningLight: '#FFF8E1',
  info: '#3B82F6',
  infoLight: '#DBEAFE',
  // Soft shadows (shadowOpacity kept <= 0.08 per design spec)
  shadow: 'rgba(0, 0, 0, 0.05)',
  shadowDark: 'rgba(0, 0, 0, 0.08)',
  gcash: '#007DFE',
  gcashLight: '#E8F4FF',
};

// ============================================================
// Theme-aware hook — the one customer screens should call
// ============================================================
export const useCustomerColors = () => {
  const COLORS = useColors();
  const { isDark } = useTheme();
  return {
    ...COLORS,
    primary: COLORS.primary,
    primaryLight: COLORS.primaryLight,
    primaryDark: COLORS.primaryDark,
    accent: COLORS.accent,
    accentLight: COLORS.accentLight,
    accentSoft: COLORS.accentSoft,
    background: COLORS.background,
    surface: COLORS.surface,
    surfaceSecondary: COLORS.surfaceSecondary,
    card: COLORS.card,
    divider: COLORS.border,
    border: COLORS.border,
    borderLight: COLORS.borderLight,
    shadow: COLORS.shadow,
    shadowDark: COLORS.shadowDark,
    success: COLORS.success,
    successLight: COLORS.successLight,
    error: COLORS.error,
    errorLight: COLORS.errorLight,
    danger: COLORS.error,
    warning: COLORS.warning,
    warningLight: COLORS.warningLight,
    info: COLORS.info || '#3B82F6',
    gcash: COLORS.gcash,
    gcashLight: COLORS.gcashLight,
    gold: COLORS.gold,
    isDark,
  };
};

// ============================================================
// Spacing scale (4/8/12/16/24)
// ============================================================
export const customerSpacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 40,
};

// ============================================================
// Radius scale (8/12/16)
// ============================================================
export const customerBorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 999,
};

// ============================================================
// Soft shadow presets (shadowOpacity <= 0.08)
// ============================================================
export const customerShadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
};

// ============================================================
// Gradient pairs (theme-aware primary)
// ============================================================
export const customerGradients = {
  primary: ['#DC2626', '#EF4444'],
  success: ['#10B981', '#059669'],
  warning: ['#F59E0B', '#D97706'],
  info: ['#3B82F6', '#2563EB'],
  danger: ['#EF4444', '#DC2626'],
  map: ['#4CAF50', '#45A049'],
};

// ============================================================
// Status color helpers
// ============================================================
const lightStatusMap = {
  pending: '#F59E0B',
  accepted: '#3B82F6',
  confirmed: '#3B82F6',
  preparing: '#7C3AED',
  ready: '#10B981',
  completed: '#9CA3AF',
  cancelled: '#DC2626',
  expired: '#6B7280',
  rejected: '#DC2626',
  paid: '#10B981',
  awaiting_payment: '#F59E0B',
  awaiting_verification: '#F59E0B',
  verified: '#10B981',
  rejected_payment: '#DC2626',
};

const darkStatusMap = {
  pending: '#FBBF24',
  accepted: '#60A5FA',
  confirmed: '#60A5FA',
  preparing: '#A78BDA',
  ready: '#34D399',
  completed: '#9CA3AF',
  cancelled: '#F87171',
  expired: '#9CA3AF',
  rejected: '#F87171',
  paid: '#34D399',
  awaiting_payment: '#FBBF24',
  awaiting_verification: '#FBBF24',
  verified: '#34D399',
  rejected_payment: '#F87171',
};

export const getStatusColor = (status) => lightStatusMap[status] || '#6B7280';
export const getStatusColorForTheme = (status, isDark) =>
  (isDark ? darkStatusMap : lightStatusMap)[status] || '#9CA3AF';

const statusLabelMap = {
  pending: 'Pending',
  accepted: 'Accepted',
  confirmed: 'Confirmed',
  preparing: 'Preparing',
  ready: 'Ready for Pickup',
  completed: 'Completed',
  cancelled: 'Cancelled',
  expired: 'Expired',
  rejected: 'Rejected',
  paid: 'Paid',
  awaiting_payment: 'Awaiting Payment',
  awaiting_verification: 'Awaiting Verification',
  verified: 'Verified',
  rejected_payment: 'Payment Rejected',
};
export const getStatusLabel = (status) => statusLabelMap[status] || status;

// ============================================================
// Theme-aware typography
// ============================================================
export const useCustomerTypography = () => {
  const C = useCustomerColors();
  return {
    h1: { fontSize: 28, fontWeight: '700', color: C.text.primary },
    h2: { fontSize: 22, fontWeight: '700', color: C.text.primary },
    h3: { fontSize: 18, fontWeight: '600', color: C.text.primary },
    h4: { fontSize: 16, fontWeight: '600', color: C.text.primary },
    body: { fontSize: 14, color: C.text.primary },
    bodySmall: { fontSize: 12, color: C.text.secondary },
    caption: { fontSize: 11, color: C.text.tertiary },
    label: { fontSize: 14, fontWeight: '600', color: C.text.primary },
  };
};
