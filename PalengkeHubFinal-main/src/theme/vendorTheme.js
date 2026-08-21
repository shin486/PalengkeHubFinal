// src/theme/vendorTheme.js
// Unified design system for the Vendor module
// EXACTLY matches the Customer module's design language

import { useColors, useTheme } from '../contexts/ThemeContext';

// Legacy static colors (kept for backward compatibility)
export const vendorColors = {
  primary: '#DC2626',
  primaryLight: '#EF4444',
  primaryDark: '#B91C1C',
  accent: '#F87171',
  accentLight: '#FEE2E2',
  accentSoft: '#FEF2F2',
  background: '#F8F9FA',
  surface: '#FFFFFF',
  surfaceAlt: '#F9FAFB',
  divider: '#F3F4F6',
  text: {
    primary: '#111827',
    dark: '#111827',
    medium: '#374151',
    secondary: '#6B7280',
    light: '#6B7280',
    tertiary: '#9CA3AF',
    lighter: '#9CA3AF',
    quaternary: '#D1D5DB',
    white: '#FFFFFF',
  },
  border: '#E5E7EB',
  borderLight: '#F3F4F6',
  success: '#10B981',
  successLight: '#D1FAE5',
  error: '#DC2626',
  danger: '#EF4444',
  dangerLight: '#FEE2E2',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  info: '#3B82F6',
  infoLight: '#DBEAFE',
  purple: '#7C3AED',
  purpleLight: '#EDE9FE',
  shadow: 'rgba(0, 0, 0, 0.08)',
  shadowDark: 'rgba(0, 0, 0, 0.12)',
  gcash: '#007DFE',
  gcashLight: '#E8F4FF',
};

// ✅ Theme-aware vendor colors hook — uses ThemeContext colors with vendor-specific extras
export const useVendorColors = () => {
  const COLORS = useColors();
  const { isDark } = useTheme();
  return {
    // Theme-aware base (spread first, then vendor aliases override)
    ...COLORS,
    // Vendor-specific aliases mapped to theme-aware values
    primary: COLORS.primary,
    primaryLight: COLORS.primaryLight,
    primaryDark: COLORS.primaryDark,
    accent: COLORS.accent,
    accentLight: COLORS.accentLight,
    accentSoft: COLORS.accentSoft,
    background: COLORS.background,
    surface: COLORS.surface,
    surfaceAlt: COLORS.surfaceSecondary,
    divider: COLORS.border,
    border: COLORS.border,
    borderLight: COLORS.borderLight,
    shadow: COLORS.shadow,
    shadowDark: COLORS.shadowDark,
    // Vendor-specific (non-theme)
    success: COLORS.success,
    successLight: COLORS.successLight,
    error: COLORS.error,
    errorLight: COLORS.errorLight,
    danger: COLORS.error,
    dangerLight: COLORS.errorLight,
    warning: COLORS.warning,
    warningLight: COLORS.warningLight,
    info: COLORS.info || '#3B82F6',
    infoLight: COLORS.infoLight || '#DBEAFE',
    purple: COLORS.purple || '#7C3AED',
    purpleLight: COLORS.purpleLight || '#EDE9FE',
    gcash: COLORS.gcash,
    gcashLight: COLORS.gcashLight,
    isDark,
  };
};

export const vendorSpacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const vendorBorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 999,
};

// ✅ Theme-aware vendor typography
export const useVendorTypography = () => {
  const COLORS = useColors();
  return {
    h1: { fontSize: 28, fontWeight: 'bold', color: COLORS.text.dark },
    h2: { fontSize: 22, fontWeight: 'bold', color: COLORS.text.dark },
    h3: { fontSize: 18, fontWeight: 'bold', color: COLORS.text.dark },
    h4: { fontSize: 16, fontWeight: '600', color: COLORS.text.dark },
    body: { fontSize: 14, color: COLORS.text.dark },
    bodySmall: { fontSize: 12, color: COLORS.text.medium },
    caption: { fontSize: 11, color: COLORS.text.lighter },
    label: { fontSize: 14, fontWeight: '600', color: COLORS.text.dark, marginBottom: 8 },
  };
};

export const vendorTypography = {
  h1: { fontSize: 28, fontWeight: 'bold', color: vendorColors.text.primary },
  h2: { fontSize: 22, fontWeight: 'bold', color: vendorColors.text.primary },
  h3: { fontSize: 18, fontWeight: 'bold', color: vendorColors.text.primary },
  h4: { fontSize: 16, fontWeight: '600', color: vendorColors.text.primary },
  body: { fontSize: 14, color: vendorColors.text.primary },
  bodySmall: { fontSize: 12, color: vendorColors.text.secondary },
  caption: { fontSize: 11, color: vendorColors.text.tertiary },
  label: { fontSize: 14, fontWeight: '600', color: vendorColors.text.primary, marginBottom: 8 },
};

export const vendorShadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: vendorColors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },
  lg: {
    shadowColor: vendorColors.shadowDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 4,
  },
};

// Gradient pairs matching customer module
export const vendorGradients = {
  primary: ['#DC2626', '#EF4444'],
  success: ['#10B981', '#059669'],
  warning: ['#F59E0B', '#D97706'],
  info: ['#3B82F6', '#2563EB'],
  purple: ['#8B5CF6', '#7C3AED'],
  danger: ['#EF4444', '#DC2626'],
  map: ['#4CAF50', '#45A049'],
  directions: ['#DC2626', '#EF4444'],
};

// ✅ Theme-aware status color helpers
const darkStatusMap = {
  pending: '#FBBF24',
  accepted: '#60A5FA',
  confirmed: '#60A5FA',
  preparing: '#A78BFA',
  ready: '#34D399',
  completed: '#9CA3AF',
  cancelled: '#F87171',
  expired: '#9CA3AF',
  rejected: '#F87171',
  paid: '#34D399',
  awaiting_verification: '#FBBF24',
  verified: '#34D399',
  rejected_payment: '#F87171',
};

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
  awaiting_verification: '#F59E0B',
  verified: '#10B981',
  rejected_payment: '#DC2626',
};

export const getStatusColor = (status) => {
  return lightStatusMap[status] || '#6B7280';
};

export const getStatusColorForTheme = (status, isDark) => {
  const map = isDark ? darkStatusMap : lightStatusMap;
  return map[status] || '#9CA3AF';
};

export const getStatusLabel = (status) => {
  const labelMap = {
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
    awaiting_verification: 'Awaiting Verification',
    verified: 'Verified',
    rejected_payment: 'Payment Rejected',
  };
  return labelMap[status] || status;
};

export const getPaymentStatusColor = (status) => {
  return lightStatusMap[status] || '#6B7280';
};

export const getPaymentStatusLabel = (status) => {
  const map = {
    pending: 'Pending',
    awaiting_payment: 'Awaiting Payment',
    awaiting_verification: 'Awaiting Verification',
    verified: 'Verified',
    paid: 'Paid',
    rejected: 'Rejected',
    refunded: 'Refunded',
    expired: 'Expired',
    cancelled: 'Cancelled',
  };
  return map[status] || status;
};
