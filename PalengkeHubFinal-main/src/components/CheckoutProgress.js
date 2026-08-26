// src/components/CheckoutProgress.js
// 3-step checkout progress indicator (Pickup -> Payment -> Confirm).
// Designed to sit at the top of CheckoutContent; each step lights up when the
// current `step` index reaches it. Fully theme-driven via customerTheme tokens.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../contexts/ThemeContext';

const STEPS = [
  { key: 'pickup', label: 'Pickup Time', icon: 'location-sharp' },
  { key: 'payment', label: 'Payment', icon: 'card-outline' },
  { key: 'confirm', label: 'Confirm', icon: 'checkmark-circle-outline' },
];

export const CheckoutProgress = ({ step = 0, onStepPress }) => {
  const COLORS = useColors();

  return (
    <View style={styles.container} pointerEvents="box-none">
      {STEPS.map((s, i) => {
        const active = i === step;
        const done = i < step;
        const iconColor = done
          ? COLORS.success
          : active
          ? COLORS.primary
          : COLORS.text.tertiary;
        const labelColor = done ? COLORS.text.primary : active ? COLORS.primary : COLORS.text.tertiary;
        const labelWeight = done || active ? '600' : '400';

        return (
          <React.Fragment key={s.key}>
            <View style={styles.stepCol}>
              <View
                style={[
                  styles.circle,
                  {
                    backgroundColor: done ? COLORS.success : active ? COLORS.primary : COLORS.inputBg,
                    borderColor: done ? COLORS.success : active ? COLORS.primary : COLORS.borderLight,
                    shadowColor: COLORS.shadow,
                  },
                ]}
              >
                {done ? (
                  <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                ) : (
                  <Ionicons name={s.icon} size={18} color={iconColor} />
                )}
              </View>
              <Text style={[styles.label, { color: labelColor, fontWeight: labelWeight }]} numberOfLines={1}>
                {s.label}
              </Text>
            </View>

            {i < STEPS.length - 1 ? (
              <View
                style={[
                  styles.connector,
                  {
                    backgroundColor: done ? COLORS.success : COLORS.borderLight,
                  },
                ]}
              />
            ) : null}
          </React.Fragment>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  stepCol: {
    alignItems: 'center',
    flex: 1,
  },
  circle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  connector: {
    flex: 1,
    height: 2,
    marginHorizontal: -4,
  },
  label: {
    fontSize: 12,
    marginTop: 6,
    textAlign: 'center',
  },
});
