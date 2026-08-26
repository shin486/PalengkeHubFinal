// src/theme/motion.js
// ============================================================
// MOTION & FEEDBACK DESIGN SYSTEM — PalengkeHub
// ============================================================
// One place for animation timing, spring physics, press states,
// and haptic feedback so every screen moves and feels alike.
//
// Principles:
//   - Motion should explain hierarchy, never decorate (150–320ms).
//   - Springs over easings for anything the user directly touches.
//   - Haptics mark *meaningful* events only: confirmations, toggles,
//     completions — never continuous scrolling or passive updates.
//   - All haptics are safe no-ops on web and on devices where the
//     engine is unavailable.
//
// Usage:
//   import { MOTION, hapticLight, hapticSuccess } from '../theme/motion';
//   Animated.spring(scale, { toValue: 1, ...MOTION.spring.snappy }).start();
//   onPress={() => { hapticLight(); doThing(); }}
// ============================================================

import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

// ------------------------------------------------------------
// TIMING & PHYSICS
// ------------------------------------------------------------
export const MOTION = {
  duration: {
    fast: 150,   // micro-feedback: pressed state, badge tick
    base: 220,   // standard transition: card enter, tab swap
    slow: 320,   // large surfaces: modal sheet, screen-level reveal
  },

  spring: {
    // Direct-manipulation controls (tabs, buttons, toggles)
    snappy: { tension: 300, friction: 26, useNativeDriver: true },
    // Standard element entrance / settle
    gentle: { tension: 180, friction: 22, useNativeDriver: true },
    // Celebratory moments (add-to-cart pop, favorite fill)
    bouncy: { tension: 240, friction: 13, useNativeDriver: true },
  },

  // Consistent press-state contract for every touchable
  press: {
    scaleDown: 0.96,
    activeOpacity: 0.75,
    activeOpacitySubtle: 0.85,
  },

  // Stagger base for list/card entrances (multiply by index)
  stagger: 40,
};

// ------------------------------------------------------------
// HAPTICS — semantic wrappers (no-op on web)
// ------------------------------------------------------------
const hapticsAvailable = Platform.OS === 'ios' || Platform.OS === 'android';

const safe = (fn) => {
  if (!hapticsAvailable) return;
  try {
    fn();
  } catch {
    /* engine unavailable — stay silent, never crash */
  }
};

/** Ultra-subtle tick — tab switches, quantity steppers, segmented picks */
export const hapticSelection = () =>
  safe(() => Haptics.selectionAsync());

/** Light tap — toggles (favorite/heart), minor confirmations */
export const hapticLight = () =>
  safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));

/** Medium tap — primary actions that commit something (add to cart) */
export const hapticMedium = () =>
  safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));

/** Success chord — order placed, payment completed */
export const hapticSuccess = () =>
  safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));

/** Warning nudge — validation issues, expiring timers */
export const hapticWarning = () =>
  safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));

/** Error thud — failures that need attention */
export const hapticError = () =>
  safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));