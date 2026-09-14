import React, { useMemo, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../contexts/ThemeContext';

const STEP_ORDER = ['pending', 'confirmed', 'preparing', 'ready', 'completed'];

export const OrderTimeline = ({ status }) => {
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);

  const STEP_CONFIG = {
    pending: { label: 'Ordered', icon: 'cart-outline', color: COLORS.warning },
    confirmed: { label: 'Confirmed', icon: 'checkmark-circle', color: COLORS.info },
    preparing: { label: 'Preparing', icon: 'restaurant-outline', color: '#8B5CF6' },
    ready: { label: 'Ready', icon: 'flag', color: COLORS.success },
    completed: { label: 'Complete', icon: 'checkmark-done-circle', color: COLORS.success },
  };

  const currentIdx = STEP_ORDER.indexOf(status);

  // Small bounce the moment a step becomes the current one — feedback that
  // the status actually moved, not just a silent re-render.
  const popAnim = useRef(new Animated.Value(0.6)).current;
  // Expanding/fading ring behind the current dot, looping while that step
  // is still in progress (i.e. not the final "completed" step) — gives
  // "waiting" visible motion instead of a static icon.
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (currentIdx === -1) return;
    popAnim.setValue(0.6);
    Animated.spring(popAnim, {
      toValue: 1,
      friction: 5,
      tension: 80,
      useNativeDriver: true,
    }).start();
  }, [currentIdx]);

  useEffect(() => {
    if (currentIdx === -1 || currentIdx === STEP_ORDER.length - 1) {
      pulseAnim.setValue(0);
      return;
    }
    pulseAnim.setValue(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1100,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.delay(200),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [currentIdx]);

  if (status === 'cancelled') {
    const cfg = { label: 'Cancelled', icon: 'close-circle', color: COLORS.error };
    return (
      <View style={[styles.container, { backgroundColor: COLORS.errorLight, borderRadius: 12 }]}>
        <View style={styles.cancelledRow}>
          <View style={[styles.cancelledDot, { backgroundColor: cfg.color }]}>
            <Ionicons name={cfg.icon} size={16} color={COLORS.text.inverse} />
          </View>
          <Text style={[styles.label, { color: cfg.color }]}>{cfg.label}</Text>
        </View>
      </View>
    );
  }

  if (currentIdx === -1) return null;

  return (
    <View style={styles.container}>
      {STEP_ORDER.map((step, idx) => {
        const cfg = STEP_CONFIG[step];
        const isPast = idx < currentIdx;
        const isCurrent = idx === currentIdx;
        const isFuture = idx > currentIdx;

        return (
          <View key={step} style={styles.stepRow}>
            {/* Line + Dot */}
            <View style={styles.lineSection}>
              {idx > 0 && (
                <View style={[styles.line, { backgroundColor: isPast || isCurrent ? cfg.color : COLORS.border }]} />
              )}
              <View style={styles.dotWrapper}>
                {isCurrent && (
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      styles.pulseRing,
                      {
                        borderColor: cfg.color,
                        opacity: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }),
                        transform: [{ scale: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.8] }) }],
                      },
                    ]}
                  />
                )}
                <Animated.View style={[
                  styles.dot,
                  { backgroundColor: isPast || isCurrent ? cfg.color : COLORS.border },
                  isCurrent && styles.dotCurrent,
                  isCurrent && { transform: [{ scale: popAnim }] },
                ]}>
                  {isPast ? (
                    <Ionicons name="checkmark" size={12} color={COLORS.text.inverse} />
                  ) : (
                    <Ionicons name={cfg.icon} size={isCurrent ? 16 : 12} color={isCurrent ? COLORS.text.inverse : COLORS.text.quaternary} />
                  )}
                </Animated.View>
              </View>
            </View>
            {/* Label */}
            <View style={styles.labelSection}>
              <Text style={[
                styles.label,
                { color: isPast || isCurrent ? cfg.color : COLORS.text.quaternary },
                isFuture && styles.futureLabel,
              ]}>
                {cfg.label}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
};

const createStyles = (COLORS) => StyleSheet.create({
  container: {
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 36,
  },
  lineSection: {
    width: 36,
    alignItems: 'center',
  },
  line: {
    width: 2,
    height: 14,
    marginBottom: 2,
  },
  dotWrapper: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
  },
  dot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dotCurrent: {
    width: 28,
    height: 28,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  labelSection: {
    marginLeft: 12,
    flex: 1,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
  },
  futureLabel: {
    fontWeight: '400',
  },
  cancelledRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  cancelledDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
