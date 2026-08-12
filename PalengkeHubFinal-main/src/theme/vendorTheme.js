// src/theme/vendorTheme.js
// Unified design system for the Vendor module
// EXACTLY matches the Customer module's design language

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

export const getStatusColor = (status) => {
  const statusMap = {
    pending: vendorColors.warning,
    accepted: vendorColors.info,
    confirmed: vendorColors.info,
    preparing: vendorColors.purple,
    ready: vendorColors.success,
    completed: vendorColors.text.tertiary,
    cancelled: vendorColors.error,
    expired: vendorColors.text.secondary,
    rejected: vendorColors.error,
    paid: vendorColors.success,
    awaiting_verification: vendorColors.warning,
    verified: vendorColors.success,
    rejected_payment: vendorColors.error,
  };
  return statusMap[status] || vendorColors.text.secondary;
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
  const map = {
    pending: vendorColors.warning,
    awaiting_payment: vendorColors.warning,
    awaiting_verification: vendorColors.warning,
    verified: vendorColors.success,
    paid: vendorColors.success,
    rejected: vendorColors.error,
    refunded: vendorColors.info,
    expired: vendorColors.text.secondary,
    cancelled: vendorColors.text.secondary,
  };
  return map[status] || vendorColors.text.secondary;
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

export const vendorCardStyle = {
  backgroundColor: vendorColors.surface,
  borderRadius: vendorBorderRadius.lg,
  padding: vendorSpacing.lg,
  marginBottom: vendorSpacing.md,
  borderWidth: 1,
  borderColor: vendorColors.border,
  ...vendorShadows.md,
};

export const vendorSectionStyle = {
  backgroundColor: vendorColors.surface,
  marginHorizontal: vendorSpacing.lg,
  marginBottom: vendorSpacing.lg,
  padding: vendorSpacing.lg,
  borderRadius: vendorBorderRadius.xl,
  ...vendorShadows.md,
};