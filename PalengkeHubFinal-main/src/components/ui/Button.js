// src/components/ui/Button.js
// One Button primitive, five variants: primary, secondary, outline, ghost,
// danger. Primary and danger "sink" — a solid PRESS_OFFSET bottom edge that
// disappears and translates down on press. Everything else scales via
// PressableScale. Never both on the same button (see 02-CONTEXT.md D-06):
// scaling and sinking at once reads as mush.

import React, { useRef, useState } from 'react';
import { Animated, Text, ActivityIndicator, TouchableWithoutFeedback, View } from 'react-native';
import { useColors } from '../../contexts/ThemeContext';
import { SPACING, RADIUS, TYPE, PRESS_OFFSET, LAYOUT } from '../../theme/tokens';
import { MOTION, hapticLight } from '../../theme/motion';
import { PressableScale } from './PressableScale';

const SIZES = {
  sm: { height: 38, paddingHorizontal: 14, fontSize: 14, gap: 6 },
  md: { height: 48, paddingHorizontal: 20, fontSize: 16, gap: 8 },
  lg: { height: 56, paddingHorizontal: 26, fontSize: 18, gap: 8 },
};

const SINKING_VARIANTS = new Set(['primary', 'danger']);

export const Button = ({
  children,
  onPress,
  variant = 'primary',
  size = 'md',
  shape = 'pill',
  icon,
  loading = false,
  disabled = false,
  fullWidth = false,
  style,
  textStyle,
  ...rest
}) => {
  const COLORS = useColors();
  const dims = SIZES[size] || SIZES.md;
  const isSinking = SINKING_VARIANTS.has(variant);
  const isDisabled = disabled || loading;

  const translateY = useRef(new Animated.Value(0)).current;
  const [pressedBorder, setPressedBorder] = useState(false);

  const variantColors = {
    primary: { bg: COLORS.primary, text: COLORS.onPrimary, edge: COLORS.primaryDark },
    danger: { bg: COLORS.error, text: COLORS.onError, edge: COLORS.errorDark },
    secondary: { bg: COLORS.wickerSoft, text: COLORS.text.primary },
    outline: { bg: 'transparent', text: COLORS.text.primary, border: COLORS.border },
    ghost: { bg: 'transparent', text: COLORS.primaryDark },
  }[variant] || { bg: COLORS.primary, text: COLORS.onPrimary, edge: COLORS.primaryDark };

  const radius = shape === 'square' ? RADIUS.sm : RADIUS.full;

  const sink = () => {
    setPressedBorder(true);
    Animated.timing(translateY, {
      toValue: PRESS_OFFSET.height,
      duration: MOTION.duration.fast,
      useNativeDriver: true,
    }).start();
  };

  const unsink = () => {
    setPressedBorder(false);
    Animated.timing(translateY, {
      toValue: 0,
      duration: MOTION.duration.fast,
      useNativeDriver: true,
    }).start();
  };

  const handlePress = () => {
    if (isDisabled) return;
    if (isSinking) hapticLight();
    onPress?.();
  };

  const baseStyle = {
    height: dims.height,
    paddingHorizontal: dims.paddingHorizontal,
    borderRadius: radius,
    backgroundColor: variantColors.bg,
    borderWidth: variant === 'outline' ? LAYOUT.borderWidth : 0,
    borderColor: variantColors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: dims.gap,
    opacity: isDisabled ? 0.42 : 1,
    ...(fullWidth ? { width: '100%' } : null),
  };

  const label = (
    <Text
      style={[
        {
          // weight-trap: black (900) needs its own file, not the
          // TYPE.family.ui fallback (which carries weight 700)
          fontFamily: 'Nunito_900Black',
          fontSize: dims.fontSize,
          fontWeight: TYPE.weight.black,
          color: variantColors.text,
          opacity: loading ? 0 : 1,
        },
        textStyle,
      ]}
      numberOfLines={1}
    >
      {children}
    </Text>
  );

  const content = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: dims.gap }}>
      {icon ? <View style={{ opacity: loading ? 0 : 1 }}>{icon}</View> : null}
      {label}
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variantColors.text}
          style={{ position: 'absolute' }}
        />
      ) : null}
    </View>
  );

  if (isSinking) {
    return (
      <TouchableWithoutFeedback
        onPress={handlePress}
        onPressIn={isDisabled ? undefined : sink}
        onPressOut={isDisabled ? undefined : unsink}
        disabled={isDisabled}
        {...rest}
      >
        <Animated.View
          style={[
            baseStyle,
            {
              borderBottomWidth: pressedBorder ? 0 : PRESS_OFFSET.height,
              borderBottomColor: variantColors.edge,
              transform: [{ translateY }],
            },
            style,
          ]}
        >
          {content}
        </Animated.View>
      </TouchableWithoutFeedback>
    );
  }

  return (
    <PressableScale
      onPress={handlePress}
      disabled={isDisabled}
      style={[baseStyle, style]}
      {...rest}
    >
      {content}
    </PressableScale>
  );
};
