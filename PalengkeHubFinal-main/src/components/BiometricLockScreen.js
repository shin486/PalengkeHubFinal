// src/components/BiometricLockScreen.js
// Full-screen gate shown when the app returns from the background with
// biometric unlock turned on. Purely a re-entry gate on an already
// authenticated session — never touches sign-in or credentials.

import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../contexts/ThemeContext';
import { SPACING, RADIUS, TEXT_STYLES, TYPE } from '../theme/tokens';
import { authenticateWithBiometrics } from '../services/biometricAuth';

export const BiometricLockScreen = ({ onUnlock }) => {
  const colors = useColors();
  const styles = createStyles(colors);
  const [authenticating, setAuthenticating] = useState(false);
  const [failed, setFailed] = useState(false);

  const attempt = async () => {
    setAuthenticating(true);
    setFailed(false);
    const success = await authenticateWithBiometrics();
    setAuthenticating(false);
    if (success) {
      onUnlock();
    } else {
      setFailed(true);
    }
  };

  // Prompt automatically once, on mount — the user shouldn't have to tap
  // "Unlock" just to get the OS biometric sheet to appear the first time.
  useEffect(() => {
    attempt();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.container}>
      <Image
        source={require('../assets/palengkehublogo.jpg')}
        style={styles.logo}
        resizeMode="cover"
      />
      <Text style={styles.title}>PalengkeHub</Text>
      <Text style={styles.subtitle}>
        {failed ? 'Not recognized — try again' : 'Locked for your privacy'}
      </Text>

      <TouchableOpacity
        style={styles.unlockButton}
        onPress={attempt}
        activeOpacity={0.85}
        disabled={authenticating}
      >
        <Ionicons name="finger-print" size={22} color={colors.onPrimary} />
        <Text style={styles.unlockButtonText}>
          {authenticating ? 'Verifying…' : 'Unlock'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const createStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xxl,
  },
  logo: {
    width: 88,
    height: 88,
    borderRadius: RADIUS.full,
    marginBottom: SPACING.lg,
    borderWidth: 2,
    borderColor: colors.border,
  },
  title: {
    ...TEXT_STYLES.h1,
    color: colors.text.primary,
    marginBottom: SPACING.xs,
  },
  subtitle: {
    fontSize: TYPE.size.body,
    color: colors.text.tertiary,
    marginBottom: SPACING.xxl,
  },
  unlockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: colors.primary,
    paddingHorizontal: SPACING.xxl,
    height: 52,
    borderRadius: RADIUS.full,
  },
  unlockButtonText: {
    ...TEXT_STYLES.label,
    color: colors.onPrimary,
    fontSize: TYPE.size.body,
  },
});

export default BiometricLockScreen;
