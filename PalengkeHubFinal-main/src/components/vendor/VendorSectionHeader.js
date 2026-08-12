// src/components/vendor/VendorSectionHeader.js
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { vendorColors, vendorTypography, vendorSpacing } from '../../theme/vendorTheme';

export const VendorSectionHeader = ({ title, subtitle, rightLabel, onRightPress, rightIcon }) => (
  <View style={styles.container}>
    <View style={styles.left}>
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </View>
    {rightLabel && (
      <TouchableOpacity style={styles.right} onPress={onRightPress} disabled={!onRightPress}>
        <Text style={styles.rightText}>
          {rightLabel} <Ionicons name="chevron-forward" size={14} color={vendorColors.primary} />
        </Text>
      </TouchableOpacity>
    )}
  </View>
);

export const VendorCardHeader = ({ title, subtitle, right }) => (
  <View style={styles.container}>
    <View style={styles.left}>
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </View>
    {right && <View>{right}</View>}
  </View>
);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: vendorSpacing.lg,
  },
  left: {
    flex: 1,
  },
  title: {
    ...vendorTypography.h3,
    fontSize: 16,
    marginBottom: 0,
  },
  subtitle: {
    ...vendorTypography.caption,
    marginTop: 2,
  },
  right: {
    paddingHorizontal: 4,
    paddingVertical: 4,
    marginLeft: vendorSpacing.md,
  },
  rightText: {
    color: vendorColors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
});
