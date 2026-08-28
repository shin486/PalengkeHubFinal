// src/services/biometricAuth.js
// Session unlock only — this never touches sign-in/credentials. A user is
// already authenticated via Supabase; this just gates re-entry into that
// session after the app returns from the background, using the device's
// own biometrics or its lock-screen passcode as the gate.

import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PREF_KEY = 'palengkehub_biometric_unlock_enabled';

export const isBiometricHardwareAvailable = async () => {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    return hasHardware && isEnrolled;
  } catch (e) {
    return false;
  }
};

export const getBiometricUnlockPreference = async () => {
  try {
    return (await AsyncStorage.getItem(PREF_KEY)) === 'true';
  } catch (e) {
    return false;
  }
};

export const setBiometricUnlockPreference = async (enabled) => {
  try {
    await AsyncStorage.setItem(PREF_KEY, enabled ? 'true' : 'false');
  } catch (e) {
    // best-effort — worst case the toggle doesn't persist across restarts
  }
};

// disableDeviceFallback: false lets the OS fall back to the device's own
// passcode/pattern/PIN when biometrics fail or aren't enrolled — this is
// the "password of phone" half of "biometrics or phone password".
export const authenticateWithBiometrics = async (promptMessage) => {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: promptMessage || 'Unlock PalengkeHub',
      disableDeviceFallback: false,
    });
    return !!result.success;
  } catch (e) {
    return false;
  }
};
