import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
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

  const currentIdx = STEP_ORDER.indexOf(status);
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
              <View style={[
                styles.dot,
                { backgroundColor: isPast || isCurrent ? cfg.color : COLORS.border },
                isCurrent && styles.dotCurrent,
              ]}>
                {isPast ? (
                  <Ionicons name="checkmark" size={12} color={COLORS.text.inverse} />
                ) : (
                  <Ionicons name={cfg.icon} size={isCurrent ? 16 : 12} color={isCurrent ? COLORS.text.inverse : COLORS.text.quaternary} />
                )}
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
