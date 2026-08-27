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
  style,
}) => {
  const COLORS = useColors();

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
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 42,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.full,
    borderWidth: LAYOUT.borderWidth,
    gap: SPACING.sm - 1,
  },
  label: {
    fontSize: TYPE.size.bodySmall,
    fontWeight: TYPE.weight.bold,
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
