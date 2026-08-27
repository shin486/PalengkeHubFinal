// src/components/ui/PressableScale.js
// Scales a pressable down slightly while pressed. Moved from
// src/utils/animations.js (phase 2) — it had zero importers there.
// Used by Button and other primitives; cards and tiles scale, buttons
// sink instead (see Button.js's PRESS_OFFSET), so pass scaleTo: 1 to
// suppress the scale on anything that already sinks.

import React, { useRef } from 'react';
import { Animated, TouchableOpacity } from 'react-native';

export const PressableScale = ({
  children,
  onPress,
  style,
  scaleTo = 0.96,
  disabled = false,
  activeOpacity = 1,
  ...rest
}) => {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: scaleTo,
      useNativeDriver: true,
      tension: 300,
      friction: 12,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      tension: 300,
      friction: 12,
    }).start();
  };

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={activeOpacity}
        disabled={disabled}
        {...rest}
      >
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
};
