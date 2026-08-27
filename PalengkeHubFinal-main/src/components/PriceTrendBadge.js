import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useColors } from '../contexts/ThemeContext';
import { RADIUS, SPACING, LAYOUT, TYPE } from '../theme/tokens';

// Small pill showing whether a product's price went up or down compared to
// its previous recorded price. Elderly-friendly: color + arrow + short Tagalog.
export const PriceTrendBadge = ({ currentPrice, previousPrice }) => {
  const COLORS = useColors();
  const cur = parseFloat(currentPrice);
  const prev = parseFloat(previousPrice);
  if (!Number.isFinite(cur) || !Number.isFinite(prev) || prev <= 0) return null;
  const delta = cur - prev;
  const abs = Math.abs(delta);
  if (abs < 0.01) return null;

  // A price increase is a caution, not an error — red stays reserved for
  // MAHAL and destructive actions, so "up" uses the warning family instead.
  const down = delta < 0;
  const color = down ? COLORS.success : COLORS.warning;
  const bg = down ? COLORS.successLight : COLORS.warningLight;
  const formatted = abs >= 100 ? abs.toFixed(0) : abs.toFixed(2);

  return (
    <View style={[styles.badge, { backgroundColor: bg, borderColor: color }]}>
      <Text style={[styles.text, { color }]}>
        {down ? '▼ Bumaba ang presyo ₱' : '▲ Tumaas ng ₱'}{formatted}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.full,
    borderWidth: LAYOUT.hairlineWidth,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    marginBottom: 4,
  },
  text: {
    fontSize: TYPE.size.micro,
    fontWeight: TYPE.weight.semibold,
  },
});
