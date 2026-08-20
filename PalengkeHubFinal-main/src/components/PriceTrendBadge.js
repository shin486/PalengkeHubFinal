import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

// Small pill showing whether a product's price went up or down compared to
// its previous recorded price. Elderly-friendly: color + arrow + short Tagalog.
export const PriceTrendBadge = ({ currentPrice, previousPrice }) => {
  const cur = parseFloat(currentPrice);
  const prev = parseFloat(previousPrice);
  if (!Number.isFinite(cur) || !Number.isFinite(prev) || prev <= 0) return null;
  const delta = cur - prev;
  const abs = Math.abs(delta);
  if (abs < 0.01) return null;

  const down = delta < 0;
  const color = down ? '#16A34A' : '#B45309';
  const bg = down ? '#DCFCE7' : '#FEF3C7';
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
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 4,
  },
  text: {
    fontSize: 10.5,
    fontWeight: '700',
  },
});
