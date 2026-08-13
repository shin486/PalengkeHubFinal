// On-device PIN lock — lets elderly users unlock the app with a 4-digit PIN
// instead of their password. The PIN lives ONLY on this device (hashed with
// SHA-256 + a random salt). It never leaves the device and is NOT a
// replacement for the Supabase password — if the session fully expires the
// user falls back to their password.
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

const PIN_HASH_KEY = '@palengkehub_pin_hash';
const PIN_SALT_KEY = '@palengkehub_pin_salt';
const PIN_USER_KEY = '@palengkehub_pin_user_id';

const getSalt = async () => {
  let salt = await AsyncStorage.getItem(PIN_SALT_KEY);
  if (!salt) {
    salt = Crypto.randomUUID();
    await AsyncStorage.setItem(PIN_SALT_KEY, salt);
  }
  return salt;
};

const hashPin = async (pin) => {
  const salt = await getSalt();
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${pin}`);
};

/** Save a 4-digit PIN for the given user (hashed). */
export const savePin = async (pin, userId) => {
  const hash = await hashPin(pin);
  await AsyncStorage.multiSet([
    [PIN_HASH_KEY, hash],
    [PIN_USER_KEY, String(userId || '')],
  ]);
};

export const hasSavedPin = async () => {
  try {
    return !!(await AsyncStorage.getItem(PIN_HASH_KEY));
  } catch (e) {
    return false;
  }
};

export const getPinUserId = async () => {
  try {
    return await AsyncStorage.getItem(PIN_USER_KEY);
  } catch (e) {
    return null;
  }
};

export const verifyPin = async (pin) => {
  try {
    const stored = await AsyncStorage.getItem(PIN_HASH_KEY);
    if (!stored) return false;
    const hash = await hashPin(pin);
    return hash === stored;
  } catch (e) {
    return false;
  }
};

export const clearPin = async () => {
  await AsyncStorage.multiRemove([PIN_HASH_KEY, PIN_SALT_KEY, PIN_USER_KEY]);
};
