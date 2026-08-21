import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const STEP_ORDER = ['pending', 'confirmed', 'preparing', 'ready', 'completed'];

const STEP_CONFIG = {
  pending:  { label: 'Ordered',   icon: 'cart-outline',          color: '#3B82F6' },
  confirmed:{ label: 'Confirmed', icon: 'checkmark-circle',      color: '#3B82F6' },
  preparing:{ label: 'Preparing', icon: 'restaurant-outline',    color: '#3B82F6' },
  ready:    { label: 'Ready',     icon: 'flag',                  color: '#3B82F6' },
  completed:{ label: 'Complete',  icon: 'checkmark-done-circle', color: '#3B82F6' },
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
      <View style={styles.track}>
        {STEP_ORDER.map((step, idx) => {
          const cfg = STEP_CONFIG[step];
          const isPast    = idx < currentIdx;
          const isCurrent = idx === currentIdx;
          const isFuture  = idx > currentIdx;
          const isLast    = idx === STEP_ORDER.length - 1;

          // Connector leading INTO this step is active once we've reached it
          const leftActive  = idx <= currentIdx;
          // Connector leaving this step is active once this step is completed
          const rightActive = idx < currentIdx;

          return (
            <View key={step} style={styles.step}>
              <View style={styles.dotRow}>
                {idx > 0 && (
                  <View style={[styles.connector, { backgroundColor: leftActive ? cfg.color : '#E5E7EB' }]} />
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
                {!isLast && (
                  <View style={[styles.connector, { backgroundColor: rightActive ? STEP_CONFIG[STEP_ORDER[idx + 1]].color : '#E5E7EB' }]} />
                )}
              </View>
              <Text style={[
                styles.label,
                { color: isPast || isCurrent ? cfg.color : '#9CA3AF' },
                isFuture && styles.futureLabel,
              ]}>
                {cfg.label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  track: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  step: {
    flex: 1,
    alignItems: 'center',
  },
  dotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  connector: {
    flex: 1,
    height: 2,
  },
  dot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dotCurrent: {
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 6,
    textAlign: 'center',
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