import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { verifyPin, getStoredCredentials } from '../services/pinService';

// Big-button 4-digit PIN pad shown on the login screen when the user has
// enabled PIN login. Designed for elderly users: huge keys, clear dots.
export const PinPadModal = ({ visible, onClose, onSuccess }) => {
  const [entry, setEntry] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setEntry('');
      setError('');
      setBusy(false);
    }
  }, [visible]);

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 8, duration: 45, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 45, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 5, duration: 45, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 45, useNativeDriver: true }),
    ]).start();
  };

  const attemptUnlock = async (pin) => {
    setBusy(true);

    // 1) Try decrypting the saved credentials with this PIN and signing in.
    //    This works even after logout or session expiry.
    const creds = await getStoredCredentials(pin);
    if (creds) {
      try {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const credentials = emailRegex.test(creds.identifier || '')
          ? { email: creds.identifier }
          : { phone: creds.identifier };
        const { error } = await supabase.auth.signInWithPassword({
          ...credentials,
          password: creds.password,
        });
        if (!error) {
          setError('');
          setBusy(false);
          onSuccess();
          return;
        }
        console.warn('PIN unlock sign-in failed:', error.message);
        setEntry('');
        setError('Hindi makapasok. Gumamit ng password.');
        shake();
        setBusy(false);
        return;
      } catch (e) {
        console.warn('PIN unlock error:', e);
        setEntry('');
        setError('Hindi makapasok. Gumamit ng password.');
        shake();
        setBusy(false);
        return;
      }
    }

    // 2) Fallback: older PIN with no stored credentials — only unlocks when a
    //    Supabase session is still alive.
    const ok = await verifyPin(pin);
    if (ok) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setError('');
          setBusy(false);
          onSuccess();
          return;
        }
      } catch (e) {
        // fall through to error
      }
    }

    setEntry('');
    setError('Maling PIN. Subukan muli.');
    shake();
    setBusy(false);
  };

  const pressDigit = (digit) => {
    if (busy) return;
    setError('');
    const next = entry + digit;
    if (next.length >= 4) {
      setEntry(next);
      setTimeout(() => attemptUnlock(next), 120);
    } else {
      setEntry(next);
    }
  };

  const pressBackspace = () => {
    if (busy) return;
    setError('');
    setEntry((prev) => prev.slice(0, -1));
  };


  const key = (label, onPress, styleKey) => (
    <TouchableOpacity
      style={[styles.key, styleKey && styles[styleKey]]}
      onPress={onPress}
      activeOpacity={0.6}
      disabled={busy}
    >
      <Text style={styles.keyText}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Animated.View style={[styles.card, { transform: [{ translateX: shakeAnim }] }]}>
          <Ionicons name="lock-closed-outline" size={28} color="#DC2626" />
          <Text style={styles.title}>Ipasok ang iyong PIN</Text>
          <Text style={styles.subtitle}>4-digit na PIN para makapasok agad</Text>

          <View style={styles.dotsRow}>
            {[0, 1, 2, 3].map((i) => (
              <View
                key={i}
                style={[styles.dot, i < entry.length && styles.dotFilled]}
              />
            ))}
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : <Text style={styles.errorPlaceholder}> </Text>}

          <View style={styles.pad}>
            <View style={styles.padRow}>
              {key('1', () => pressDigit('1'))}
              {key('2', () => pressDigit('2'))}
              {key('3', () => pressDigit('3'))}
            </View>
            <View style={styles.padRow}>
              {key('4', () => pressDigit('4'))}
              {key('5', () => pressDigit('5'))}
              {key('6', () => pressDigit('6'))}
            </View>
            <View style={styles.padRow}>
              {key('7', () => pressDigit('7'))}
              {key('8', () => pressDigit('8'))}
              {key('9', () => pressDigit('9'))}
            </View>
            <View style={styles.padRow}>
              <View style={styles.keySpacer} />
              {key('0', () => pressDigit('0'))}
              {key('⌫', pressBackspace, 'keyBackspace')}
            </View>
          </View>

          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.fallback}>Gumamit ng password sa halip</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
};


const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  lockIcon: {
    fontSize: 34,
    marginBottom: 6,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1F2937',
  },
  subtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 4,
    marginBottom: 14,
    textAlign: 'center',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 10,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
  },
  dotFilled: {
    backgroundColor: '#16A34A',
    borderColor: '#16A34A',
  },
  error: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '600',
    minHeight: 18,
    marginBottom: 4,
  },
  errorPlaceholder: {
    minHeight: 18,
    marginBottom: 4,
  },
  pad: {
    width: '100%',
    gap: 12,
  },
  padRow: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
  },
  key: {
    width: 76,
    height: 64,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyText: {
    fontSize: 26,
    fontWeight: '700',
    color: '#111827',
  },
  keyBackspace: {
    backgroundColor: '#FEF2F2',
  },
  keySpacer: {
    width: 76,
    height: 64,
  },
  fallback: {
    marginTop: 16,
    color: '#2563EB',
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
