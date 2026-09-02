import React, { useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { useColors } from '../contexts/ThemeContext';

// Five dots pulsing in sequence — scale 1 -> 1.5 -> 1 with a matching
// opacity dip, each dot starting 0.2s after the last, looping forever.
const DOT_COUNT = 5;
const DOT_SIZE = 14;
const DOT_GAP = 8;
const STAGGER_MS = 200;
const PULSE_MS = 500;

export const LoadingSpinner = ({ message = 'Loading...' }) => {
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const scales = useRef(Array.from({ length: DOT_COUNT }, () => new Animated.Value(1))).current;

  useEffect(() => {
    const loops = scales.map((scale, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * STAGGER_MS),
          Animated.timing(scale, {
            toValue: 1.5,
            duration: PULSE_MS,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 1,
            duration: PULSE_MS,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.delay((DOT_COUNT - 1 - i) * STAGGER_MS),
        ])
      )
    );
    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [scales]);

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {scales.map((scale, i) => (
          <Animated.View
            key={i}
            style={[
              styles.dot,
              {
                transform: [{ scale }],
                opacity: scale.interpolate({ inputRange: [1, 1.5], outputRange: [1, 0.5] }),
              },
            ]}
          />
        ))}
      </View>
      {message ? <Text style={styles.text}>{message}</Text> : null}
    </View>
  );
};

const createStyles = (COLORS) =>
  StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: COLORS.background,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    dot: {
      width: DOT_SIZE,
      height: DOT_SIZE,
      borderRadius: DOT_SIZE / 2,
      marginHorizontal: DOT_GAP / 2,
      backgroundColor: COLORS.primary,
    },
    text: {
      marginTop: 16,
      color: COLORS.text.tertiary,
      fontSize: 16,
    },
  });
