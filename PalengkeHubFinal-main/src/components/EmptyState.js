import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../contexts/ThemeContext';
import { SPACING, TYPE } from '../theme/tokens';
import { Button } from './ui/Button';

export const EmptyState = ({
  icon = 'cube-outline',
  title = 'Nothing here yet',
  subtitle = '',
  actionLabel = '',
  onAction = null,
  colors = {},
}) => {
  const COLORS = useColors();
  const themeColors = {
    icon: COLORS.text.tertiary,
    title: COLORS.text.secondary,
    subtitle: COLORS.text.tertiary,
    background: COLORS.background,
    iconBg: COLORS.surfaceSecondary,
    ...colors,
  };

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <View style={[styles.iconCircle, { backgroundColor: themeColors.iconBg }]}>
        <Ionicons name={icon} size={48} color={themeColors.icon} />
      </View>
      <Text style={[styles.title, { color: themeColors.title }]}>{title}</Text>
      {subtitle ? (
        <Text style={[styles.subtitle, { color: themeColors.subtitle }]}>{subtitle}</Text>
      ) : null}
      {actionLabel && onAction ? (
        <Button variant="primary" onPress={onAction} icon={
          <Ionicons name="arrow-forward" size={16} color={COLORS.onPrimary} />
        }>
          {actionLabel}
        </Button>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingBottom: 60,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  title: {
    fontSize: TYPE.size.h1,
    fontWeight: TYPE.weight.semibold,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  subtitle: {
    fontSize: TYPE.size.body,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: SPACING.xxl,
  },
});
