// On-device PIN login — lets elderly users unlock the app with a 4-digit PIN
// instead of their password. The PIN and an encrypted copy of the credentials
// live ONLY on this device. The credentials are obfuscated with a keystream
// derived from the PIN (SHA-256 based), so the PIN works even after logout or
// session expiry: entering the PIN decrypts the credentials and signs the
// user back in with Supabase.
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

const PIN_HASH_KEY = '@palengkehub_pin_hash';
const PIN_SALT_KEY = '@palengkehub_pin_salt';
const PIN_USER_KEY = '@palengkehub_pin_user_id';
const PIN_CREDS_KEY = '@palengkehub_pin_creds';

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

// ── Keystream derived from the PIN (obfuscation-grade encryption) ──
const deriveKeystream = async (pin, salt) => {
  let seed = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${salt}:${pin}:palengkehub-pin`,
  );
  let stream = '';
  for (let i = 0; i < 8; i++) {
    stream += seed;
    seed = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, seed);
  }
  const bytes = new Uint8Array(stream.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(stream.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
};

const xorBytes = (byteString, keyBytes) => {
  let out = '';
  for (let i = 0; i < byteString.length; i++) {
    out += String.fromCharCode(byteString.charCodeAt(i) ^ keyBytes[i % keyBytes.length]);
  }
  return out;
};

const toByteString = (str) => unescape(encodeURIComponent(str));
const fromByteString = (bs) => decodeURIComponent(escape(bs));

/**
 * Save the PIN plus an encrypted copy of the login credentials so the PIN can
 * sign the user back in later (works even after logout/session expiry).
 */
export const savePinWithCredentials = async (pin, userId, identifier, password) => {
  const salt = await getSalt();
  const key = await deriveKeystream(pin, salt);
  const plain = JSON.stringify({ v: 1, magic: 'PHUB-PIN', identifier, password });
  const encrypted = xorBytes(toByteString(plain), key);
  const hash = await hashPin(pin);
  await AsyncStorage.multiSet([
    [PIN_HASH_KEY, hash],
    [PIN_USER_KEY, String(userId || '')],
    [PIN_CREDS_KEY, btoa(encrypted)],
  ]);
};

/**
 * Decrypt the stored credentials using the PIN.
 * Returns { identifier, password } on success, null on wrong PIN or no data.
 */
export const getStoredCredentials = async (pin) => {
  try {
    const [salt, blob] = await Promise.all([
      AsyncStorage.getItem(PIN_SALT_KEY),
      AsyncStorage.getItem(PIN_CREDS_KEY),
    ]);
    if (!salt || !blob) return null;
    const key = await deriveKeystream(pin, salt);
    const decrypted = xorBytes(atob(blob), key);
    const parsed = JSON.parse(fromByteString(decrypted));
    if (!parsed || parsed.magic !== 'PHUB-PIN') return null;
    return { identifier: parsed.identifier, password: parsed.password };
  } catch (e) {
    return null;
  }
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
  await AsyncStorage.multiRemove([PIN_HASH_KEY, PIN_SALT_KEY, PIN_USER_KEY, PIN_CREDS_KEY]);
};

