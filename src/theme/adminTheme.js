// src/theme/adminTheme.js
export const colors = {
  primary: {
    50: '#EEF2FF',
    100: '#E0E7FF',
    200: '#C7D2FE',
    300: '#A5B4FC',
    400: '#818CF8',
    500: '#4F46E5',
    600: '#4338CA',
    700: '#3730A3',
    800: '#2E2B7A',
    900: '#1E1B4B',
  },
  success: {
    50: '#F0FDF4',
    100: '#DCFCE7',
    200: '#BBF7D0',
    300: '#86EFAC',
    400: '#4ADE80',
    500: '#22C55E',
    600: '#16A34A',
    700: '#15803D',
    800: '#166534',
    900: '#14532D',
  },
  warning: {
    50: '#FFFBEB',
    100: '#FEF3C7',
    200: '#FDE68A',
    300: '#FCD34D',
    400: '#FBBF24',
    500: '#F59E0B',
    600: '#D97706',
    700: '#B45309',
    800: '#92400E',
    900: '#78350F',
  },
  danger: {
    50: '#FEF2F2',
    100: '#FEE2E2',
    200: '#FECACA',
    300: '#FCA5A5',
    400: '#F87171',
    500: '#EF4444',
    600: '#DC2626',
    700: '#B91C1C',
    800: '#991B1B',
    900: '#7F1D1D',
  },
  info: {
    50: '#EFF6FF',
    100: '#DBEAFE',
    200: '#BFDBFE',
    300: '#93C5FD',
    400: '#60A5FA',
    500: '#3B82F6',
    600: '#2563EB',
    700: '#1D4ED8',
    800: '#1E40AF',
    900: '#1E3A8A',
  },
  neutral: {
    50: '#F8FAFC',
    100: '#F1F5F9',
    200: '#E5E7EB',
    300: '#D1D5DB',
    400: '#9CA3AF',
    500: '#6B7280',
    600: '#4B5563',
    700: '#374151',
    800: '#1F2937',
    900: '#111827',
  },
  surface: {
    default: '#FFFFFF',
    subtle: '#F8FAFC',
    elevated: '#FFFFFF',
    overlay: 'rgba(0, 0, 0, 0.4)',
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  pill: 9999,
};

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 8,
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 12,
  },
};

export const typography = {
  pageTitle: {
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 40,
    letterSpacing: '-0.02em',
    color: colors.neutral[900],
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '600',
    lineHeight: 30,
    letterSpacing: '-0.01em',
    color: colors.neutral[900],
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '500',
    lineHeight: 26,
    color: colors.neutral[900],
  },
  body: {
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 22,
    color: colors.neutral[500],
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
    color: colors.neutral[500],
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
  },
  helper: {
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
    color: colors.neutral[400],
  },
};

export const getStatusColor = (status) => {
  const map = {
    pending: colors.warning[500],
    approved: colors.success[500],
    rejected: colors.danger[500],
    active: colors.success[500],
    inactive: colors.neutral[400],
    completed: colors.success[500],
    cancelled: colors.danger[500],
    'in-progress': colors.info[500],
    reviewing: colors.info[500],
    resolved: colors.success[500],
    dismissed: colors.neutral[400],
    confirmed: colors.info[500],
    preparing: colors.warning[500],
    ready: colors.success[500],
  };
  return map[status] || colors.neutral[500];
};

export const getStatusBg = (status) => {
  const map = {
    pending: colors.warning[50],
    approved: colors.success[50],
    rejected: colors.danger[50],
    active: colors.success[50],
    inactive: colors.neutral[50],
    completed: colors.success[50],
    cancelled: colors.danger[50],
    'in-progress': colors.info[50],
    reviewing: colors.info[50],
    resolved: colors.success[50],
    dismissed: colors.neutral[50],
    confirmed: colors.info[50],
    preparing: colors.warning[50],
    ready: colors.success[50],
  };
  return map[status] || colors.neutral[50];
};

export const gradients = {
  primary: ['#4F46E5', '#818CF8'],
  success: ['#22C55E', '#4ADE80'],
  warning: ['#F59E0B', '#FBBF24'],
  danger: ['#EF4444', '#F87171'],
  info: ['#3B82F6', '#60A5FA'],
  dark: ['#1F2937', '#374151'],
};