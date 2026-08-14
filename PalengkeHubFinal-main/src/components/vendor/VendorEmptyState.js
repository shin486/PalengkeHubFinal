// src/components/vendor/VendorEmptyState.js
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { vendorColors, vendorBorderRadius, vendorSpacing } from '../../theme/vendorTheme';

export const VendorEmptyState = ({ icon, title, message, actionLabel, onAction, variant = 'default' }) => {
  if (variant === 'compact') {
    return (
      <View style={styles.compact}>
        <View style={styles.compactIconContainer}>
          <Ionicons name={icon || 'file-tray-outline'} size={32} color={vendorColors.text.tertiary} />
        </View>
        <Text style={styles.compactTitle}>{title}</Text>
        {message && <Text style={styles.compactMessage}>{message}</Text>}
        {actionLabel && onAction && (
          <TouchableOpacity style={styles.compactButton} onPress={onAction}>
            <Text style={styles.compactButtonText}>{actionLabel}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Ionicons name={icon || 'file-tray-outline'} size={48} color={vendorColors.text.tertiary} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {message && <Text style={styles.message}>{message}</Text>}
      {actionLabel && onAction && (
        <TouchableOpacity style={styles.actionButton} onPress={onAction}>
          <Text style={styles.actionButtonText}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

export const VendorErrorState = ({ message = 'Something went wrong', onRetry, icon = 'alert-circle-outline' }) => (
  <View style={styles.container}>
    <View style={styles.iconContainer}>
      <Ionicons name={icon} size={48} color={vendorColors.danger} />
    </View>
    <Text style={styles.title}>Oops!</Text>
    <Text style={styles.message}>{message}</Text>
    {onRetry && (
      <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
        <Text style={styles.retryButtonText}>Try Again</Text>
      </TouchableOpacity>
    )}
  </View>
);

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: vendorSpacing.xxl,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: vendorColors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: vendorColors.text.primary,
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: vendorColors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  actionButton: {
    backgroundColor: vendorColors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: vendorBorderRadius.md,
  },
  actionButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  retryButton: {
    backgroundColor: vendorColors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: vendorBorderRadius.md,
  },
  retryButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  compact: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: vendorSpacing.lg,
    backgroundColor: vendorColors.surface,
    borderRadius: vendorBorderRadius.lg,
    marginHorizontal: vendorSpacing.lg,
    marginVertical: vendorSpacing.sm,
    borderWidth: 1,
    borderColor: vendorColors.border,
  },
  compactIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: vendorColors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  compactTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: vendorColors.text.primary,
    marginBottom: 4,
    textAlign: 'center',
  },
  compactMessage: {
    fontSize: 13,
    color: vendorColors.text.secondary,
    textAlign: 'center',
    marginBottom: 16,
  },
  compactButton: {
    backgroundColor: vendorColors.primary,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: vendorBorderRadius.sm,
  },
  compactButtonText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
  },
});