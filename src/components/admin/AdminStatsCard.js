// src/components/admin/AdminStatsCard.js
import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, radius, shadows } from '../../theme/adminTheme';

export const AdminStatsCard = ({ title, value, icon, color, trend, trendValue }) => {
  const isPositive = trend === 'up';

  return (
    <View style={[styles.card, shadows.sm]}>
      <LinearGradient
        colors={[color, `${color}CC`]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.iconContainer}
      >
        <Text style={styles.icon}>{icon}</Text>
      </LinearGradient>
      
      <View style={styles.content}>
        <Text style={styles.value}>{value}</Text>
        <Text style={styles.title}>{title}</Text>
        {trend && (
          <View style={[styles.trendBadge, { backgroundColor: isPositive ? colors.success[50] : colors.danger[50] }]}>
            <Text style={[styles.trendText, { color: isPositive ? colors.success[500] : colors.danger[500] }]}>
              {isPositive ? '↑' : '↓'} {trendValue}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: Platform.OS === 'web' ? 200 : '45%',
    backgroundColor: colors.surface.default,
    borderRadius: radius.lg,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    fontSize: 24,
  },
  content: {
    flex: 1,
  },
  value: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.neutral[900],
  },
  title: {
    fontSize: 13,
    color: colors.neutral[500],
    marginTop: 2,
  },
  trendBadge: {
    marginTop: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    alignSelf: 'flex-start',
  },
  trendText: {
    fontSize: 11,
    fontWeight: '600',
  },
});