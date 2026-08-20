import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const STEP_ORDER = ['pending', 'confirmed', 'preparing', 'ready', 'completed'];

const STEP_CONFIG = {
  pending:  { label: 'Ordered',   icon: 'cart-outline',          color: '#F59E0B' },
  confirmed:{ label: 'Confirmed', icon: 'checkmark-circle',      color: '#3B82F6' },
  preparing:{ label: 'Preparing', icon: 'restaurant-outline',    color: '#8B5CF6' },
  ready:    { label: 'Ready',     icon: 'flag',                  color: '#10B981' },
  completed:{ label: 'Complete',  icon: 'checkmark-done-circle', color: '#22C55E' },
};

const CANCELLED_CONFIG = {
  cancelled: { label: 'Cancelled', icon: 'close-circle', color: '#EF4444' },
};

export const OrderTimeline = ({ status, colors = {} }) => {
  if (status === 'cancelled') {
    const cfg = CANCELLED_CONFIG.cancelled;
    return (
      <View style={[styles.container, { backgroundColor: '#FEF2F2', borderRadius: 12 }]}>
        <View style={styles.cancelledRow}>
          <View style={[styles.cancelledDot, { backgroundColor: cfg.color }]}>
            <Ionicons name={cfg.icon} size={16} color="#fff" />
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
        const isPast   = idx < currentIdx;
        const isCurrent= idx === currentIdx;
        const isFuture = idx > currentIdx;

        return (
          <View key={step} style={styles.stepRow}>
            {/* Line + Dot */}
            <View style={styles.lineSection}>
              {idx > 0 && (
                <View style={[styles.line, { backgroundColor: isPast || isCurrent ? cfg.color : '#E5E7EB' }]} />
              )}
              <View style={[
                styles.dot,
                { backgroundColor: isPast || isCurrent ? cfg.color : '#E5E7EB' },
                isCurrent && styles.dotCurrent,
              ]}>
                {isPast ? (
                  <Ionicons name="checkmark" size={12} color="#fff" />
                ) : (
                  <Ionicons name={cfg.icon} size={isCurrent ? 16 : 12} color={isCurrent ? '#fff' : '#9CA3AF'} />
                )}
              </View>
            </View>
            {/* Label */}
            <View style={styles.labelSection}>
              <Text style={[
                styles.label,
                { color: isPast || isCurrent ? cfg.color : '#9CA3AF' },
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

const styles = StyleSheet.create({
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