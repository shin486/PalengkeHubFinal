// src/utils/animations.js
// Reusable animation helpers for the customer side.
// - FadeInUp: fades + slides content in when it mounts (used for screen
//   sections, cards and list items).
//
// PressableScale moved to src/components/ui/PressableScale.js in phase 2.

import React, { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';

export const FadeInUp = ({
  children,
  delay = 0,
  duration = 350,
  distance = 20,
  style,
}) => {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [progress, delay, duration]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [distance, 0],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
};
