// src/components/vendor/VendorSectionHeader.js
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useVendorColors, vendorSpacing } from '../../theme/vendorTheme';

export const VendorSectionHeader = ({ title, subtitle, rightLabel, onRightPress, rightIcon }) => {
  const vendorColors = useVendorColors();
  const styles = createStyles(vendorColors);
  return (
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
};

export const VendorCardHeader = ({ title, subtitle, right }) => {
  const vendorColors = useVendorColors();
  const styles = createStyles(vendorColors);
  return (
    <View style={styles.container}>
      <View style={styles.left}>
        <Text style={styles.title}>{title}</Text>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>
      {right && <View>{right}</View>}
    </View>
  );
};

// Was ...vendorTypography.h3 / .caption (see vendorTheme.js) — that
// object bakes its `color` from the same static, light-mode-only
// vendorColors import this whole pass is fixing, and it's only ever
// used here, so the color/weight/family it needs are inlined directly
// against the theme-aware vendorColors from the hook above instead of
// touching the shared vendorTypography export.
const createStyles = (vendorColors) => StyleSheet.create({
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
    fontSize: 16,
    fontFamily: 'Baloo2_800ExtraBold',
    fontWeight: '800',
    color: vendorColors.text.primary,
    marginBottom: 0,
  },
  subtitle: {
    fontSize: 11,
    fontFamily: 'Nunito_700Bold',
    fontWeight: '700',
    color: vendorColors.text.tertiary,
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
