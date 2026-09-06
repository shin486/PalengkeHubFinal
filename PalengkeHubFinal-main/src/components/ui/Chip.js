// src/components/ui/Chip.js
// A chip is tappable, at least 42px tall, and toggles or filters — never
// confuse it with Badge.js, which only labels (02-CONTEXT.md D-13).

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../../contexts/ThemeContext';
import { RADIUS, SPACING, LAYOUT, TYPE } from '../../theme/tokens';
import { hapticSelection } from '../../theme/motion';

export const Chip = ({
  children,
  icon,
  isOn = false,
  onPress,
  removable = false,
  onRemove,
  // Opt-in only — every existing caller renders at the same size as
  // before, since none of them pass this. For a dense row of several
  // chips at once (sort/filter strips) the standard size reads as
  // oversized; 'compact' trims padding and text size while keeping a
  // still-tappable 36px minimum height (below the design system's 42px
  // baseline, but not so small it stops being a reasonable tap target).
  size = 'default', // 'default' | 'compact'
  style,
}) => {
  const COLORS = useColors();
  const isCompact = size === 'compact';

  const handlePress = () => {
    hapticSelection();
    onPress?.();
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.8}
      style={[
        styles.chip,
        isCompact && styles.chipCompact,
        {
          backgroundColor: isOn ? COLORS.brandSoft : COLORS.card,
          borderColor: isOn ? COLORS.primary : COLORS.border,
        },
        style,
      ]}
    >
      {icon}
      <Text
        style={[
          styles.label,
          isCompact && styles.labelCompact,
          { color: isOn ? COLORS.primaryDark : COLORS.text.primary },
        ]}
        numberOfLines={1}
      >
        {children}
      </Text>
      {removable ? (
        <TouchableOpacity
          onPress={onRemove}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          style={[styles.removeCircle, { backgroundColor: COLORS.wickerSoft }]}
        >
          <Ionicons name="close" size={14} color={COLORS.text.secondary} />
        </TouchableOpacity>
      ) : null}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  chip: {
    // alignSelf: 'flex-start' pins this to its own content width no
    // matter what flex context it's dropped into — without it, a chip
    // placed in a container that stretches its children (React Native's
    // actual default is alignItems:'stretch', not the web's "shrink to
    // content") grows to fill available width instead of staying an
    // oval pill, which is what "stretches through the screen" was.
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 42,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.full,
    borderWidth: LAYOUT.borderWidth,
    gap: SPACING.sm - 1,
  },
  chipCompact: {
    minHeight: 30,
    paddingHorizontal: SPACING.sm + 2,
    gap: 4,
  },
  label: {
    fontSize: TYPE.size.bodySmall,
    fontFamily: 'Nunito_800ExtraBold',
    fontWeight: TYPE.weight.bold,
  },
  labelCompact: {
    fontSize: TYPE.size.micro,
  },
  removeCircle: {
    width: 22,
    height: 22,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -8,
  },
});
