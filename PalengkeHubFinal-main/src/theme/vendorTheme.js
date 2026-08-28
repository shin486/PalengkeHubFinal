// src/theme/vendorTheme.js
// Unified design system for the Vendor module
// EXACTLY matches the Customer module's design language

import { useColors, useTheme } from '../contexts/ThemeContext';
import { COLORS, SPACING, RADIUS, ORDER_STATUS } from './tokens';

// Legacy static colors (kept for backward compatibility), now derived from
// tokens.js instead of a private hex copy. `purple`/`purpleLight` have no
// home in the design system (nothing in the logo is violet), so they stay
// as literal legacy values.
export const vendorColors = {
  primary: COLORS.light.primary,
  primaryLight: COLORS.light.primaryLight,
  primaryDark: COLORS.light.primaryDark,
  accent: COLORS.light.accent,
  accentLight: COLORS.light.accentLight,
  accentSoft: COLORS.light.accentSoft,
  background: COLORS.light.background,
  surface: COLORS.light.surface,
  surfaceAlt: COLORS.light.surfaceSecondary,
  divider: COLORS.light.borderLight,
  text: {
    primary: COLORS.light.text.primary,
    dark: COLORS.light.text.dark,
    medium: COLORS.light.text.medium,
    secondary: COLORS.light.text.secondary,
    light: COLORS.light.text.light,
    tertiary: COLORS.light.text.tertiary,
    lighter: COLORS.light.text.lighter,
    quaternary: COLORS.light.text.quaternary,
    white: COLORS.light.text.white,
  },
  border: COLORS.light.border,
  borderLight: COLORS.light.borderLight,
  success: COLORS.light.success,
  successLight: COLORS.light.successLight,
  error: COLORS.light.error,
  danger: COLORS.light.error,
  dangerLight: COLORS.light.errorLight,
  warning: COLORS.light.warning,
  warningLight: COLORS.light.warningLight,
  info: COLORS.light.info,
  infoLight: COLORS.light.infoLight,
  purple: '#7C3AED',
  purpleLight: '#EDE9FE',
  shadow: COLORS.light.shadow,
  shadowDark: COLORS.light.shadowDark,
  gcash: COLORS.light.gcash,
  gcashLight: COLORS.light.gcashLight,
};

//  Theme-aware vendor colors hook — uses ThemeContext colors with vendor-specific extras
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

export const vendorSpacing = SPACING;

export const vendorBorderRadius = {
  sm: RADIUS.sm,
  md: RADIUS.md,
  lg: RADIUS.lg,
  xl: RADIUS.xl,
  xxl: RADIUS.xl,
  full: RADIUS.full,
};

//  Theme-aware vendor typography — same Baloo 2 (display) / Nunito (UI)
// families and weight-matched font files as tokens.js's TEXT_STYLES, so
// vendor screens stop rendering in the system default font. See the
// "weight trap" note in tokens.js: a named font file carries its own
// weight, so `fontWeight` here must match the file, never guess a value
// the loaded font doesn't have.
export const useVendorTypography = () => {
  const COLORS = useColors();
  return {
    h1: { fontSize: 28, fontFamily: 'Baloo2_800ExtraBold', fontWeight: '800', color: COLORS.text.dark },
    h2: { fontSize: 22, fontFamily: 'Baloo2_800ExtraBold', fontWeight: '800', color: COLORS.text.dark },
    h3: { fontSize: 18, fontFamily: 'Baloo2_800ExtraBold', fontWeight: '800', color: COLORS.text.dark },
    h4: { fontSize: 16, fontFamily: 'Nunito_700Bold', fontWeight: '700', color: COLORS.text.dark },
    body: { fontSize: 14, fontFamily: 'Nunito_600SemiBold', fontWeight: '600', color: COLORS.text.dark },
    bodySmall: { fontSize: 12, fontFamily: 'Nunito_600SemiBold', fontWeight: '600', color: COLORS.text.medium },
    caption: { fontSize: 11, fontFamily: 'Nunito_700Bold', fontWeight: '700', color: COLORS.text.lighter },
    label: { fontSize: 14, fontFamily: 'Nunito_700Bold', fontWeight: '700', color: COLORS.text.dark, marginBottom: 8 },
  };
};

export const vendorTypography = {
  h1: { fontSize: 28, fontFamily: 'Baloo2_800ExtraBold', fontWeight: '800', color: vendorColors.text.primary },
  h2: { fontSize: 22, fontFamily: 'Baloo2_800ExtraBold', fontWeight: '800', color: vendorColors.text.primary },
  h3: { fontSize: 18, fontFamily: 'Baloo2_800ExtraBold', fontWeight: '800', color: vendorColors.text.primary },
  h4: { fontSize: 16, fontFamily: 'Nunito_700Bold', fontWeight: '700', color: vendorColors.text.primary },
  body: { fontSize: 14, fontFamily: 'Nunito_600SemiBold', fontWeight: '600', color: vendorColors.text.primary },
  bodySmall: { fontSize: 12, fontFamily: 'Nunito_600SemiBold', fontWeight: '600', color: vendorColors.text.secondary },
  caption: { fontSize: 11, fontFamily: 'Nunito_700Bold', fontWeight: '700', color: vendorColors.text.tertiary },
  label: { fontSize: 14, fontFamily: 'Nunito_700Bold', fontWeight: '700', color: vendorColors.text.primary, marginBottom: 8 },
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
  // Was hardcoded red — the brand's actual primary color is orange
  // (tokens.js: red is reserved for error/danger states only). Unused by
  // any live screen today, but was a landmine for the next one that
  // reached for "the vendor primary gradient".
  primary: [vendorColors.primary, vendorColors.primaryLight],
  success: ['#10B981', '#059669'],
  warning: ['#F59E0B', '#D97706'],
  info: ['#3B82F6', '#2563EB'],
  purple: ['#8B5CF6', '#7C3AED'],
  danger: ['#EF4444', '#DC2626'],
  map: ['#4CAF50', '#45A049'],
  directions: [vendorColors.primary, vendorColors.primaryLight],
};

//  Theme-aware status color helpers, from tokens.js's ORDER_STATUS.
// awaiting_verification and rejected_payment are payment-only states with
// no ORDER_STATUS entry of their own; they reuse the closest status
// (pending, rejected) rather than inventing a new color.
const darkStatusMap = {
  ...ORDER_STATUS.dark,
  awaiting_verification: ORDER_STATUS.dark.pending,
  rejected_payment: ORDER_STATUS.dark.rejected,
};

const lightStatusMap = {
  ...ORDER_STATUS.light,
  awaiting_verification: ORDER_STATUS.light.pending,
  rejected_payment: ORDER_STATUS.light.rejected,
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
