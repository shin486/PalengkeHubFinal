// On-device PIN login — lets elderly users unlock the app with a 4-digit PIN
// instead of their password. The PIN and an encrypted copy of the credentials
// live in the OS-level secure keystore (iOS Keychain / Android Keystore, via
// expo-secure-store) — NOT AsyncStorage. AsyncStorage has no hardware-backed
// encryption, so anything with raw storage access (a lost/repaired/rooted
// device, a backup-extraction tool) could pull the stored hash+salt+blob and
// brute-force all 10,000 possible 4-digit PINs offline in well under a
// second (one SHA-256 hash per guess), recovering the user's real account
// password. SecureStore keeps that data behind the OS's own key material,
// which isn't something an offline brute force can just read off disk.
//
// A second, independent layer: MAX_PIN_ATTEMPTS wrong guesses in a row wipes
// the stored PIN+credentials entirely, forcing a real password login (which
// goes through Supabase's own server-side auth rate limiting). Without this,
// nothing stopped unlimited PIN guesses against an unlocked/left-open phone.
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

const PIN_HASH_KEY = 'palengkehub_pin_hash';
const PIN_SALT_KEY = 'palengkehub_pin_salt';
const PIN_USER_KEY = 'palengkehub_pin_user_id';
const PIN_CREDS_KEY = 'palengkehub_pin_creds';
const PIN_ATTEMPTS_KEY = 'palengkehub_pin_attempts';

// Pre-fix key names (AsyncStorage, "@"-prefixed) — wiped on first load below
// so no device is left holding an old-format, weakly-stored credential blob.
const LEGACY_ASYNC_KEYS = [
  '@palengkehub_pin_hash',
  '@palengkehub_pin_salt',
  '@palengkehub_pin_user_id',
  '@palengkehub_pin_creds',
];

export const MAX_PIN_ATTEMPTS = 5;

let legacyPurged = false;
const purgeLegacyStorage = async () => {
  if (legacyPurged) return;
  legacyPurged = true;
  try {
    await AsyncStorage.multiRemove(LEGACY_ASYNC_KEYS);
  } catch (e) {
    // best-effort — nothing to do if this fails
  }
};

const getSalt = async () => {
  await purgeLegacyStorage();
  let salt = await SecureStore.getItemAsync(PIN_SALT_KEY);
  if (!salt) {
    salt = Crypto.randomUUID();
    await SecureStore.setItemAsync(PIN_SALT_KEY, salt);
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
  await purgeLegacyStorage();
  const salt = await getSalt();
  const key = await deriveKeystream(pin, salt);
  const plain = JSON.stringify({ v: 1, magic: 'PHUB-PIN', identifier, password });
  const encrypted = xorBytes(toByteString(plain), key);
  const hash = await hashPin(pin);
  await SecureStore.setItemAsync(PIN_HASH_KEY, hash);
  await SecureStore.setItemAsync(PIN_USER_KEY, String(userId || ''));
  await SecureStore.setItemAsync(PIN_CREDS_KEY, btoa(encrypted));
  await SecureStore.deleteItemAsync(PIN_ATTEMPTS_KEY).catch(() => {});
};

/**
 * Decrypt the stored credentials using the PIN.
 * Returns { identifier, password } on success, null on wrong PIN or no data.
 */
export const getStoredCredentials = async (pin) => {
  try {
    await purgeLegacyStorage();
    const [salt, blob] = await Promise.all([
      SecureStore.getItemAsync(PIN_SALT_KEY),
      SecureStore.getItemAsync(PIN_CREDS_KEY),
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
    await purgeLegacyStorage();
    return !!(await SecureStore.getItemAsync(PIN_HASH_KEY));
  } catch (e) {
    return false;
  }
};

export const getPinUserId = async () => {
  try {
    return await SecureStore.getItemAsync(PIN_USER_KEY);
  } catch (e) {
    return null;
  }
};

export const verifyPin = async (pin) => {
  try {
    const stored = await SecureStore.getItemAsync(PIN_HASH_KEY);
    if (!stored) return false;
    const hash = await hashPin(pin);
    return hash === stored;
  } catch (e) {
    return false;
  }
};

export const clearPin = async () => {
  await SecureStore.deleteItemAsync(PIN_HASH_KEY).catch(() => {});
  await SecureStore.deleteItemAsync(PIN_SALT_KEY).catch(() => {});
  await SecureStore.deleteItemAsync(PIN_USER_KEY).catch(() => {});
  await SecureStore.deleteItemAsync(PIN_CREDS_KEY).catch(() => {});
  await SecureStore.deleteItemAsync(PIN_ATTEMPTS_KEY).catch(() => {});
};

/**
 * Call after a failed PIN attempt. Persists the failure count across app
 * restarts (an in-memory counter would reset on every relaunch, making the
 * lockout trivial to dodge). Once MAX_PIN_ATTEMPTS is reached, wipes the
 * stored PIN+credentials and reports lockedOut: true — the caller should
 * close the PIN pad and send the user to full password login.
 */
export const recordFailedPinAttempt = async () => {
  const current = parseInt((await SecureStore.getItemAsync(PIN_ATTEMPTS_KEY)) || '0', 10) || 0;
  const next = current + 1;
  if (next >= MAX_PIN_ATTEMPTS) {
    await clearPin();
    return { lockedOut: true, attempts: next, remaining: 0 };
  }
  await SecureStore.setItemAsync(PIN_ATTEMPTS_KEY, String(next));
  return { lockedOut: false, attempts: next, remaining: MAX_PIN_ATTEMPTS - next };
};

export const resetPinAttempts = async () => {
  await SecureStore.deleteItemAsync(PIN_ATTEMPTS_KEY).catch(() => {});
};
