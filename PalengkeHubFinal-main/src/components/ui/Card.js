// src/components/ui/Card.js
// Three kinds: basic, media, stat. All RADIUS.lg, COLORS.card background,
// a 2px COLORS.border border, and no drop shadow (SHADOWS.none) — the
// contrast between the warm white card and the woven paper background is
// what separates them. Do not add a shadow back (02-CONTEXT.md D-11).

import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { useColors } from '../../contexts/ThemeContext';
import { SPACING, RADIUS, LAYOUT, TYPE, SHADOWS } from '../../theme/tokens';
import { PressableScale } from './PressableScale';

const cardFrame = (COLORS) => ({
  backgroundColor: COLORS.card,
  borderRadius: RADIUS.lg,
  borderWidth: LAYOUT.borderWidth,
  borderColor: COLORS.border,
  overflow: 'hidden',
  ...SHADOWS.none,
});

export const Card = ({ children, onPress, style, ...rest }) => {
  const COLORS = useColors();
  const frame = [cardFrame(COLORS), style];
  if (onPress) {
    return (
      <PressableScale onPress={onPress} style={frame} {...rest}>
        {children}
      </PressableScale>
    );
  }
  return <View style={frame} {...rest}>{children}</View>;
};

export const CardBody = ({ children, style }) => (
  <View style={[{ padding: SPACING.lg }, style]}>{children}</View>
);

export const CardMedia = ({ source, style }) => {
  const COLORS = useColors();
  return (
    <View style={[styles.mediaBox, { backgroundColor: COLORS.wickerSoft }, style]}>
      <Image source={source} style={styles.mediaImage} resizeMode="cover" />
    </View>
  );
};

export const StatCard = ({ label, icon, value, delta, deltaDirection, style }) => {
  const COLORS = useColors();
  const deltaColor = deltaDirection === 'up' ? COLORS.success : COLORS.errorDark;
  return (
    <View style={[cardFrame(COLORS), styles.statPad, style]}>
      <View style={styles.statLabelRow}>
        {icon}
        <Text style={[styles.statLabel, { color: COLORS.text.tertiary }]}>{label}</Text>
      </View>
      <Text style={[styles.statValue, { color: COLORS.text.primary }]}>{value}</Text>
      {delta ? (
        <Text style={[styles.statDelta, { color: deltaColor }]}>{delta}</Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  mediaBox: {
    aspectRatio: 16 / 9,
  },
  mediaImage: {
    width: '100%',
    height: '100%',
  },
  statPad: {
    padding: SPACING.lg,
  },
  statLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  statLabel: {
    fontSize: TYPE.size.caption,
    fontWeight: TYPE.weight.bold,
    textTransform: 'uppercase',
    letterSpacing: TYPE.letterSpacing.caps,
  },
  statValue: {
    fontSize: 30,
    fontWeight: TYPE.weight.bold,
    marginTop: SPACING.xs,
    letterSpacing: -0.5,
  },
  statDelta: {
    fontSize: TYPE.size.caption,
    fontWeight: TYPE.weight.bold,
    marginTop: 3,
  },
});
