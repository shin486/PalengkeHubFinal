// src/components/ui/VerdictChip.js
// Renders one of four computed price verdicts. It never computes a verdict
// itself — the caller passes one in, and a product with no roster of other
// stalls to compare against passes nothing, which renders nothing at all
// (02-CONTEXT.md D-17, D-18). PINAKAMURA has a solid form (rank one inside
// a comparison) and a soft form (cheapest on a home screen card) — D-19.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useColors } from '../../contexts/ThemeContext';
import { RADIUS, SPACING, TEXT_STYLES } from '../../theme/tokens';

const LABELS = {
  MURA: 'Mura',
  KATAMTAMAN: 'Katamtaman',
  MAHAL: 'Mahal',
  PINAKAMURA: 'Pinakamura',
};

const resolveTone = (COLORS, verdict, solid) => {
  switch (verdict) {
    case 'MURA':
      return { bg: COLORS.verdictCheapBg, text: COLORS.verdictCheapText };
    case 'KATAMTAMAN':
      return { bg: COLORS.verdictFairBg, text: COLORS.verdictFairText };
    case 'MAHAL':
      return { bg: COLORS.verdictDearBg, text: COLORS.verdictDearText };
    case 'PINAKAMURA':
      return solid
        ? { bg: COLORS.verdictBestBg, text: COLORS.verdictBestText }
        : { bg: COLORS.verdictCheapBg, text: COLORS.verdictCheapText };
    default:
      return null;
  }
};

export const VerdictChip = ({ verdict, solid = false, style }) => {
  const COLORS = useColors();
  if (!verdict || !LABELS[verdict]) return null;

  const tone = resolveTone(COLORS, verdict, solid);
  if (!tone) return null;

  return (
    <View style={[styles.chip, { backgroundColor: tone.bg }, style]}>
      <Text style={[TEXT_STYLES.chip, { color: tone.text }]}>{LABELS[verdict]}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  chip: {
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.sm + 1,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
  },
});
