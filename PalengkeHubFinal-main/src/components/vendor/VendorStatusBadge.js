// src/components/vendor/VendorStatusBadge.js
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import {
  vendorBorderRadius,
  getStatusColorForTheme,
  getStatusLabel,
  getPaymentStatusLabel,
} from '../../theme/vendorTheme';

export const VendorStatusBadge = ({ status, size = 'sm', style }) => {
  const { isDark } = useTheme();
  // getStatusColor (no theme) always read the light-mode map regardless
  // of the app's actual theme — getStatusColorForTheme already existed
  // for exactly this, just wasn't being called from here.
  const color = getStatusColorForTheme(status, isDark);
  const label = getStatusLabel(status);
  const isSmall = size === 'sm';

  return (
    <View style={[
      styles.badge,
      { backgroundColor: color + '20', borderColor: color },
      isSmall ? styles.sm : styles.md,
      style,
    ]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[
        styles.text,
        { color },
        isSmall ? styles.textSm : styles.textMd,
      ]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
};

export const VendorPaymentStatusBadge = ({ status, size = 'sm' }) => {
  const { isDark } = useTheme();
  // getPaymentStatusColor reads the exact same underlying map as
  // getStatusColor (see vendorTheme.js) — reusing the theme-aware
  // version here too rather than adding a parallel one.
  const color = getStatusColorForTheme(status, isDark);
  const label = getPaymentStatusLabel(status);
  const isSmall = size === 'sm';

  return (
    <View style={[
      styles.badge,
      { backgroundColor: color + '20', borderColor: color },
      isSmall ? styles.sm : styles.md,
    ]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.text, { color }, isSmall ? styles.textSm : styles.textMd]}>
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: vendorBorderRadius.full,
    borderWidth: 1,
  },
  sm: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 4,
  },
  md: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    fontWeight: '600',
  },
  textSm: {
    fontSize: 10,
  },
  textMd: {
    fontSize: 12,
  },
});