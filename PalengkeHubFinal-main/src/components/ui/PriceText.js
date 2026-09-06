// src/components/ui/PriceText.js
// Restyles the price block; does not reformat it (02-CONTEXT.md D-22). The
// peso sign immediately before the number, two decimals via toFixed(2),
// then the unit as a separate suffix — exactly what ProductCard.js and
// SearchScreen.js already render.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useColors } from '../../contexts/ThemeContext';
import { SPACING, TEXT_STYLES, TYPE } from '../../theme/tokens';

export const PriceText = ({
  price,
  unit,
  originalPrice,
  // Opt-in only — every existing caller renders exactly as before
  // since none of them pass this. When set (and actually higher than
  // `price`), renders "₱min – ₱max" instead of a single price: a
  // product with several unit options (e.g. small vs. big pakwan) has
  // more than one real price, and showing just one of them understates
  // the range a shopper will actually see once they open the product.
  maxPrice,
  size = 'default', // 'default' | 'hero'
  stacked = false, // original price above current, instead of beside it
  style,
}) => {
  const COLORS = useColors();
  const priceStyle = size === 'hero' ? TEXT_STYLES.priceHero : TEXT_STYLES.price;
  const safePrice = Number(price) || 0;
  const hasRange = maxPrice != null && Number(maxPrice) > safePrice;
  // A "was ₱X" strike-through doesn't compose sensibly with "now ₱Y–₱Z" —
  // rare enough (promo + multi-unit at once) to just prefer the range.
  const hasOriginal = !hasRange && originalPrice != null && Number(originalPrice) > 0;

  const original = hasOriginal ? (
    <Text style={[styles.original, { color: COLORS.text.tertiary }]}>
      ₱{Number(originalPrice).toFixed(2)}
    </Text>
  ) : null;

  const current = (
    <Text style={[priceStyle, { color: COLORS.primary }]}>
      {hasRange ? `₱${safePrice.toFixed(2)} – ₱${Number(maxPrice).toFixed(2)}` : `₱${safePrice.toFixed(2)}`}
    </Text>
  );

  // The unit suffix implies a single per-unit price — misleading once
  // a range is showing (the range already spans multiple units).
  const unitText = unit && !hasRange ? (
    <Text style={[styles.unit, { color: COLORS.text.tertiary }]}>/ {unit}</Text>
  ) : null;

  if (stacked) {
    return (
      <View style={style}>
        {original}
        <View style={styles.row}>
          {current}
          {unitText}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.row, style]}>
      {original}
      {current}
      {unitText}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: SPACING.xs + 1,
  },
  original: {
    fontSize: TYPE.size.bodySmall,
    fontFamily: 'Nunito_400Regular',
    textDecorationLine: 'line-through',
  },
  unit: {
    fontSize: TYPE.size.caption,
    fontFamily: 'Nunito_600SemiBold',
    fontWeight: TYPE.weight.medium,
  },
});
