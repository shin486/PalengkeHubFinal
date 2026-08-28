// src/hooks/useBiometricLock.js
// Watches AppState for background -> active transitions and, if the user
// is signed in and has biometric unlock turned on, flips `locked` true so
// the caller can render BiometricLockScreen on top of everything.

import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { getBiometricUnlockPreference } from '../services/biometricAuth';

export const useBiometricLock = (isLoggedIn) => {
  const [locked, setLocked] = useState(false);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    if (!isLoggedIn) {
      setLocked(false);
      return;
    }

    const subscription = AppState.addEventListener('change', async (nextState) => {
      const cameFromBackground = /inactive|background/.test(appState.current);
      appState.current = nextState;
      if (!cameFromBackground || nextState !== 'active') return;

      const enabled = await getBiometricUnlockPreference();
      if (enabled) setLocked(true);
    });

    return () => subscription.remove();
  }, [isLoggedIn]);

  return { locked, unlock: () => setLocked(false) };
};
