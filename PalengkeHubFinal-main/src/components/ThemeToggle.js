// src/components/ThemeToggle.js
// A single-purpose light/dark switch — press it and the knob slides across
// and swaps from a light marble to a dark one, mirroring a pill-shaped
// checkbox toggle (inset-shadow track, sliding gradient knob). No "System"
// stop here: this control is binary by design, tap = flip to the other mode.
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, TouchableWithoutFeedback } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../contexts/ThemeContext';

const WIDTH = 60;
const HEIGHT = 32;
const KNOB = 24;
const PAD = 4;

export function ThemeToggle({ style }) {
  const { isDark, setTheme } = useTheme();
  const progress = useRef(new Animated.Value(isDark ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: isDark ? 1 : 0,
      duration: 320,
      useNativeDriver: false,
    }).start();
  }, [isDark, progress]);

  const knobLeft = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [PAD, WIDTH - KNOB - PAD],
  });

  const trackColor = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['#F3E3CB', '#221812'],
  });

  const trackBorderColor = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(38,16,6,0.14)', 'rgba(0,0,0,0.6)'],
  });

  const lightKnobOpacity = progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });

  return (
    <TouchableWithoutFeedback
      accessibilityRole="switch"
      accessibilityState={{ checked: isDark }}
      accessibilityLabel={isDark ? 'Dark mode on' : 'Dark mode off'}
      onPress={() => setTheme(isDark ? 'light' : 'dark')}
    >
      <Animated.View style={[styles.track, { backgroundColor: trackColor, borderColor: trackBorderColor }, style]}>
        <Animated.View style={[styles.knob, { left: knobLeft }]}>
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: lightKnobOpacity }]}>
            <LinearGradient
              colors={['#FFFFFF', '#E7DCCB']}
              start={{ x: 0.2, y: 0 }}
              end={{ x: 0.9, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: progress }]}>
            <LinearGradient
              colors={['#4A3B30', '#0B0806']}
              start={{ x: 0.2, y: 0 }}
              end={{ x: 0.9, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  track: {
    width: WIDTH,
    height: HEIGHT,
    borderRadius: HEIGHT / 2,
    borderWidth: 1,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  knob: {
    position: 'absolute',
    width: KNOB,
    height: KNOB,
    borderRadius: KNOB / 2,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 3,
    elevation: 4,
  },
});
