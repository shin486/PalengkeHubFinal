// src/components/vendor/VendorStatCard.js
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { vendorColors, vendorBorderRadius, vendorSpacing, vendorShadows } from '../../theme/vendorTheme';

export const VendorStatCard = ({ title, value, icon, gradientColors, trend, trendValue, isCurrency, onPress, subtitle }) => {
  let displayValue = value;
  if (typeof value === 'number') {
    displayValue = isCurrency ? `₱${value.toFixed(2)}` : value.toString();
  }

  const Card = onPress ? TouchableOpacity : View;

  return (
    <Card
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <LinearGradient colors={gradientColors} style={styles.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
        <View style={styles.topRow}>
          <Ionicons name={icon} size={24} color="#FFFFFF" />
          {trend && (
            <View style={[styles.trendBadge, trendValue > 0 ? styles.trendUp : styles.trendDown]}>
              <Text style={styles.trendText}>
                {trendValue > 0 ? '↑' : '↓'} {Math.abs(trendValue).toFixed(1)}%
              </Text>
            </View>
          )}
        </View>
        <Text style={styles.value}>{displayValue}</Text>
        <Text style={styles.title}>{title}</Text>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </LinearGradient>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: '45%',
    borderRadius: vendorBorderRadius.lg,
    overflow: 'hidden',
    ...vendorShadows.md,
  },
  gradient: {
    padding: vendorSpacing.lg,
    borderRadius: vendorBorderRadius.lg,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: vendorSpacing.sm,
  },
  trendBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: vendorBorderRadius.full,
  },
  trendUp: {
    backgroundColor: 'rgba(16,185,129,0.3)',
  },
  trendDown: {
    backgroundColor: 'rgba(239,68,68,0.3)',
  },
  trendText: {
    fontSize: 10,
    color: '#FFF',
    fontWeight: '600',
  },
  value: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 4,
  },
  title: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '500',
  },
  subtitle: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
});
