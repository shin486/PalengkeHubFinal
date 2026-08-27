// src/components/ui/Badge.js
// A badge labels; it is never tappable (see Chip.js for the tappable
// version). Uppercase, TYPE.size.micro, TYPE.weight.black, RADIUS.sm —
// TEXT_STYLES.chip already assembles the text style (02-CONTEXT.md D-14).

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useColors } from '../../contexts/ThemeContext';
import { RADIUS, SPACING, TEXT_STYLES } from '../../theme/tokens';

const toneColors = (COLORS) => ({
  brand: { bg: COLORS.brandSoft, text: COLORS.primaryDark },
  leaf: { bg: COLORS.successLight, text: COLORS.success },
  tomato: { bg: COLORS.errorLight, text: COLORS.errorDark },
  gold: { bg: COLORS.warningLight, text: COLORS.warning },
  fish: { bg: COLORS.infoLight, text: COLORS.info },
  neutral: { bg: COLORS.wickerSoft, text: COLORS.text.secondary },
  solid: { bg: COLORS.primary, text: COLORS.onPrimary },
  ink: { bg: COLORS.inkSurface, text: COLORS.onInk },
});

export const Badge = ({ children, tone = 'neutral', icon, style }) => {
  const COLORS = useColors();
  const { bg, text } = toneColors(COLORS)[tone] || toneColors(COLORS).neutral;
  return (
    <View style={[styles.badge, { backgroundColor: bg }, style]}>
      {icon}
      <Text style={[TEXT_STYLES.chip, { color: text }]}>{children}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: SPACING.xs - 1,
    paddingHorizontal: SPACING.sm + 1,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
  },
});
