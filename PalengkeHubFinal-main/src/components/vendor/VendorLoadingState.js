// src/components/vendor/VendorLoadingState.js
import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useVendorColors, vendorBorderRadius, vendorSpacing } from '../../theme/vendorTheme';

export const VendorSkeleton = ({ width = '100%', height = 20, borderRadius = 8, style }) => (
  <View style={[skeletonBaseStyle, { width, height, borderRadius }, style]} />
);

// Not theme-dependent (a neutral shimmer tone works the same on either
// background) so this one stays a plain constant rather than needing
// the hook — unlike everything below it, which was previously reading
// the static (light-mode-only) vendorColors import instead of the
// theme-aware useVendorColors() hook. See VendorOrderDetailScreen.js
// for the same class of fix and why.
const skeletonBaseStyle = { backgroundColor: '#E5E7EB', opacity: 0.7 };

export const VendorSkeletonCard = () => {
  const vendorColors = useVendorColors();
  const styles = createStyles(vendorColors);
  return (
    <View style={styles.skeletonCard}>
      <View style={styles.skeletonRow}>
        <VendorSkeleton width={50} height={50} borderRadius={25} />
        <View style={styles.skeletonCol}>
          <VendorSkeleton width="70%" height={16} />
          <VendorSkeleton width="40%" height={12} style={{ marginTop: 6 }} />
        </View>
      </View>
      <VendorSkeleton width="100%" height={12} style={{ marginTop: 12 }} />
      <VendorSkeleton width="80%" height={12} style={{ marginTop: 6 }} />
      <View style={styles.skeletonRow}>
        <VendorSkeleton width="30%" height={32} borderRadius={16} />
        <VendorSkeleton width="30%" height={32} borderRadius={16} />
      </View>
    </View>
  );
};

export const VendorSkeletonList = ({ count = 3 }) => {
  const vendorColors = useVendorColors();
  const styles = createStyles(vendorColors);
  return (
    <View style={styles.skeletonList}>
      {Array.from({ length: count }).map((_, i) => (
        <VendorSkeletonCard key={i} />
      ))}
    </View>
  );
};

export const VendorLoadingOverlay = ({ message = 'Loading...' }) => {
  const vendorColors = useVendorColors();
  const styles = createStyles(vendorColors);
  return (
    <View style={styles.overlay}>
      <View style={styles.loadingBox}>
        <ActivityIndicator size="large" color={vendorColors.primary} />
        <Text style={styles.loadingText}>{message}</Text>
      </View>
    </View>
  );
};

const createStyles = (vendorColors) => StyleSheet.create({
  skeletonCard: {
    backgroundColor: vendorColors.surface,
    borderRadius: vendorBorderRadius.lg,
    padding: vendorSpacing.lg,
    marginBottom: vendorSpacing.md,
    borderWidth: 1,
    borderColor: vendorColors.border,
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
  },
  skeletonCol: {
    flex: 1,
  },
  skeletonList: {
    padding: vendorSpacing.lg,
  },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: vendorColors.background,
  },
  loadingBox: {
    alignItems: 'center',
    padding: vendorSpacing.xxl,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: vendorColors.text.secondary,
  },
});
