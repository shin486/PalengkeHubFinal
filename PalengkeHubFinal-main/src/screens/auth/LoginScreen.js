import { Ionicons } from '@expo/vector-icons';
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  ActivityIndicator,
  Animated,
  Dimensions,
  Vibration,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SvgXml } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../../lib/supabase';
import * as Haptics from 'expo-haptics';
import { PinPadModal } from '../../components/PinPadModal';
import { hasSavedPin } from '../../services/pinService';

const { width, height } = Dimensions.get('window');

// Squiggly hand-drawn divider for the OR section
const SquiggleDivider = () => {
  const xml = `<svg viewBox="0 0 200 14" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
    <path d="M0 7 C12 2, 22 12, 34 7 C46 2, 56 12, 68 7 C80 2, 90 12, 102 7 C114 2, 124 12, 136 7 C148 2, 158 12, 170 7 C182 2, 192 12, 204 7"
      fill="none" stroke="#D8C8BE" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`;
  return <SvgXml xml={xml} width="100%" height={14} />;
};

// Hand-drawn curved underline beneath the greeting
const HandUnderline = () => {
  const xml = `<svg viewBox="0 0 150 9" xmlns="http://www.w3.org/2000/svg">
    <path d="M2 6 C24 2, 58 8, 90 5 C122 2, 142 7, 152 5"
      fill="none" stroke="#E2B8A8" stroke-width="2.8" stroke-linecap="round"/>
  </svg>`;
  return <SvgXml xml={xml} width={150} height={9} style={{ marginTop: 3, marginBottom: 13, marginLeft: 1 }} />;
};

// ─── SoftPressable — gentle scale + shadow on press ──────────────────────────
const SoftPressable = ({ onPress, style, children, disabled }) => {
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn = () =>
    Animated.spring(scale, { toValue: 0.968, useNativeDriver: true, speed: 40, bounciness: 2 }).start();

  const pressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 28, bounciness: 5 }).start();

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        disabled={disabled}
        activeOpacity={1}
      >
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
};

// ─── AlertBanner ──────────────────────────────────────────────────────────────
const AlertBanner = ({ message, type = 'error', onDismiss }) => {
  const slideAnim = useRef(new Animated.Value(-72)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (message) {
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, tension: 68, friction: 12, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 240, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: -72, duration: 210, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [message]);

  if (!message) return null;

  const isSuccess = type === 'success';

  return (
    <Animated.View
      style={[
        styles.banner,
        isSuccess ? styles.bannerSuccess : styles.bannerError,
        { transform: [{ translateY: slideAnim }], opacity: opacityAnim },
      ]}
    >
      <View style={[styles.bannerBadge, isSuccess && styles.bannerBadgeSuccess]}>
        <Text style={styles.bannerBadgeText}>{isSuccess ? '' : '!'}</Text>
      </View>
      <Text style={[styles.bannerText, isSuccess && styles.bannerTextSuccess]} numberOfLines={2}>
        {message}
      </Text>
      <TouchableOpacity
        onPress={onDismiss}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        
      </TouchableOpacity>
    </Animated.View>
  );
};

// ─── Main Login Screen ─────────────────────────────────────────────────────────
export const LoginScreen = ({ setIsGuest }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [emailValid, setEmailValid] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loginSuccess, setLoginSuccess] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const [resetVisible, setResetVisible] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const [alertMessage, setAlertMessage] = useState('');
  const [alertType, setAlertType] = useState('error');

  const shakeAnim   = useRef(new Animated.Value(0)).current;
  const scaleAnim   = useRef(new Animated.Value(1)).current;
  const logoSlide   = useRef(new Animated.Value(-28)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const formSlide   = useRef(new Animated.Value(36)).current;
  const formOpacity = useRef(new Animated.Value(0)).current;
  const logoFloat   = useRef(new Animated.Value(0)).current;

  const { login, loginAsAccount, checkUser } = useAuth();
  const navigation = useNavigation();

  // ── PIN login state ──
  const [pinVisible, setPinVisible] = useState(false);

  // If this device has a saved PIN, show the PIN pad instead of the password form
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const saved = await hasSavedPin();
      if (!cancelled && saved) setPinVisible(true);
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Multi-account picker state ──
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerAccounts, setPickerAccounts] = useState([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerError, setPickerError] = useState('');

  const showAlert = (msg, t = 'error') => {
    setAlertMessage(msg);
    setAlertType(t);
    if (t === 'error') setTimeout(() => setAlertMessage(''), 4200);
  };
  const dismissAlert = () => setAlertMessage('');

  const showPlatformAlert = (message, type = 'error') => {
    if (Platform.OS === 'web') {
      alert(message);
    } else {
      showAlert(message, type);
    }
  };

  useEffect(() => {
    Animated.stagger(130, [
      Animated.parallel([
        Animated.spring(logoSlide,   { toValue: 0, tension: 55, friction: 10, useNativeDriver: true }),
        Animated.timing(logoOpacity, { toValue: 1, duration: 520, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.spring(formSlide,   { toValue: 0, tension: 55, friction: 10, useNativeDriver: true }),
        Animated.timing(formOpacity, { toValue: 1, duration: 520, useNativeDriver: true }),
      ]),
    ]).start();

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(logoFloat, { toValue: -5, duration: 2300, useNativeDriver: true }),
        Animated.timing(logoFloat, { toValue: 0,  duration: 2300, useNativeDriver: true }),
      ])
    );
    const t = setTimeout(() => loop.start(), 900);
    return () => { clearTimeout(t); loop.stop(); };
  }, []);

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue:  9, duration: 46, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -9, duration: 46, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue:  6, duration: 46, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -6, duration: 46, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue:  0, duration: 46, useNativeDriver: true }),
    ]).start();
    Vibration.vibrate(80);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  };

  const validateEmail = (text) => {
    setEmail(text);
    const emailOK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text);
    const phoneOK = /^\+?\d{8,15}$/.test(text.trim());
    const ok = emailOK || phoneOK;
    setEmailValid(ok);
    return ok;
  };

  const isValidLoginIdentifier = (text) => {
    const emailOK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text);
    const phoneOK = /^\+?\d{8,15}$/.test(text.trim());
    return emailOK || phoneOK;
  };

  const handleLogin = async () => {
    dismissAlert();
    if (!email.trim()) { 
      shake(); 
      showPlatformAlert('Please enter your email or phone number.');
      return; 
    }
    if (!isValidLoginIdentifier(email)) { 
      shake(); 
      showPlatformAlert('Enter a valid email or phone number.');
      return; 
    }
    if (!password) { 
      shake(); 
      showPlatformAlert('Please enter your password.');
      return; 
    }

    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.96, duration: 75, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 4, useNativeDriver: true }),
    ]).start();

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsLoading(true);

    try {
      const result = await login(email.trim(), password);

      // ── Multi-account: show the picker ──
      if (result.multipleAccounts && result.accounts && result.accounts.length > 0) {
        setPickerAccounts(result.accounts);
        setPickerVisible(true);
        return;
      }

      if (result.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setLoginSuccess(true);
        showPlatformAlert('Welcome back! Signing you in...', 'success');
        setTimeout(() => setLoginSuccess(false), 2000);
      } else {
        shake();
        const raw = result.error?.toLowerCase() || '';
        let msg = 'Login failed. Please try again.';
        if (result.adminWebOnly) {
 msg = ' Admin accounts can only log in through the PalengkeHub web portal. Please visit the Admin Login page on the website. Customers and vendors can log in here on the app.';
        } else if (raw.includes('invalid login') || raw.includes('invalid credentials') || raw.includes('user not found'))
          msg = 'Wrong email or password. Double-check and try again.';
        else if (raw.includes('email not confirmed'))
          msg = 'Please verify your email first. Check your inbox.';
        else if (raw.includes('too many requests') || raw.includes('rate limit'))
          msg = 'Too many attempts. Please wait a moment and try again.';
        else if (raw.includes('network') || raw.includes('fetch'))
          msg = 'No connection. Check your internet and try again.';
        else if (result.error)
          msg = result.error;
        
        showPlatformAlert(msg);
      }
    } catch {
      shake();
      showPlatformAlert('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuestMode = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (setIsGuest) setIsGuest(true);
  };

  // ── Multi-account picker handlers ──
  const handleSelectAccount = async (account) => {
    setPickerLoading(true);
    setPickerError('');
    try {
      const result = await loginAsAccount(account.authEmail, password);
      if (result.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setPickerVisible(false);
        // Navigation happens automatically via RootNavigator on auth state change
      } else {
        setPickerError(result.error || 'Could not sign in to this account.');
      }
    } catch (err) {
      setPickerError(err.message || 'Could not sign in to this account.');
    } finally {
      setPickerLoading(false);
    }
  };

  const handleClosePicker = () => {
    setPickerVisible(false);
    setPickerAccounts([]);
    setPickerError('');
  };

  const handleForgotPassword = async () => {
    if (!resetEmail.trim()) { 
      showPlatformAlert('Enter your email address first.');
      return; 
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setResetLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: 'palengkehub://reset-password',
      });
      if (error) throw error;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setResetSent(true);
      setTimeout(() => { setResetVisible(false); setResetSent(false); setResetEmail(''); }, 2500);
    } catch (err) {
      showPlatformAlert(err.message || 'Could not send reset email. Try again.');
    } finally {
      setResetLoading(false);
    }
  };

  const emailInputStyle = [
    styles.inputRow,
    emailFocused                          ? styles.inputFocused  : null,
    email.length > 0 && !emailValid       ? styles.inputError    : null,
    emailValid && email.length > 0        ? styles.inputValid    : null,
  ];

  const passwordInputStyle = [
    styles.inputRow,
    passwordFocused ? styles.inputFocused : null,
    { transform: [{ translateX: shakeAnim }] },
  ];

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* FULL SCREEN BACKGROUND IMAGE */}
      <Image
        source={require('../../../src/assets/Lipapublicmarket.jpg')}
        style={styles.fullScreenBackground}
        resizeMode="cover"
      />
      
      {/* Dark overlay for better text readability */}
      <View style={styles.overlay} />

      {/* Floating alert banner */}
      {Platform.OS !== 'web' && (
        <AlertBanner message={alertMessage} type={alertType} onDismiss={dismissAlert} />
      )}

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Header with Logo and Text ── */}
        <Animated.View
          style={[
            styles.header,
            { opacity: logoOpacity, transform: [{ translateY: logoSlide }] },
          ]}
        >
          <Animated.View style={{ transform: [{ translateY: logoFloat }] }}>
            <Image
              source={require('../../../src/assets/palengkehublogo.jpg')}
              style={styles.logoImg}
              resizeMode="cover"
            />
          </Animated.View>

          <Text style={styles.appName}>PalengkeHub</Text>

          <View style={styles.tagRow}>
            <View style={styles.tagDot} />
            <Text style={styles.tagline}>Lipa City Public Market</Text>
            <View style={styles.tagDot} />
          </View>
        </Animated.View>

        {/* ── Login Card (Floating on top of background) ── */}
        <Animated.View
          style={[
            styles.card,
            { opacity: formOpacity, transform: [{ translateY: formSlide }] },
          ]}
        >
          <Text style={styles.greeting}>Mabuhay! </Text>
          <HandUnderline />
          <Text style={styles.sub}>Sign in to your account</Text>

          {/* Email */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Email or Phone</Text>
            <View style={emailInputStyle}>
              <Ionicons name="mail-outline" size={18} />
              <TextInput
                style={styles.textInput}
                placeholder="you@example.com"
                placeholderTextColor="#BEB0A4"
                value={email}
                onChangeText={validateEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
              />
              {emailValid && email.length > 0 && (
                
              )}
            </View>
            {email.length > 0 && !emailValid && (
              <Text style={styles.fieldError}>Enter a valid email (e.g. juan@email.com)</Text>
            )}
          </View>

          {/* Password */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Password</Text>
            <Animated.View style={passwordInputStyle}>
              <Ionicons name="key-outline" size={18} />
              <TextInput
                style={styles.textInput}
                placeholder="Your password"
                placeholderTextColor="#BEB0A4"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
              />
              <TouchableOpacity
                onPress={() => {
                  setShowPassword(!showPassword);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.eyeToggle}>{showPassword ? 'Hide' : 'Show'}</Text>
              </TouchableOpacity>
            </Animated.View>
          </View>

          {/* Options */}
          <View style={styles.optionsRow}>
            <TouchableOpacity
              style={styles.rememberRow}
              onPress={() => {
                setRememberMe(!rememberMe);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              activeOpacity={0.7}
            >
              <View style={[styles.checkbox, rememberMe && styles.checkboxOn]}>
                {rememberMe && }
              </View>
              <Text style={styles.rememberLabel}>Remember me</Text>
            </TouchableOpacity>

            <SoftPressable onPress={() => setResetVisible(true)}>
              <Text style={styles.forgotLink}>Forgot password?</Text>
            </SoftPressable>
          </View>

          {/* Sign In Button */}
          <Animated.View style={[styles.signInBtn, { transform: [{ scale: scaleAnim }] }]}>
            <TouchableOpacity
              onPress={handleLogin}
              disabled={isLoading || loginSuccess}
              activeOpacity={0.88}
            >
              <LinearGradient
                colors={loginSuccess ? ['#2E8B57', '#3AA86B'] : ['#B5342A', '#D9503F']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.signInGrad}
              >
                {isLoading
                  ? <ActivityIndicator color="#fff" />
                  : loginSuccess
                    ? <Text style={styles.signInText}>  Signed In</Text>
                    : <Text style={styles.signInText}>Sign In</Text>
                }
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>

          {/* OR Divider */}
          <View style={styles.divider}>
            <View style={{ flex: 1 }}><SquiggleDivider /></View>
            <Text style={styles.dividerLabel}>or</Text>
            <View style={{ flex: 1 }}><SquiggleDivider /></View>
          </View>

          {/* Guest Button */}
          <SoftPressable onPress={handleGuestMode} style={styles.guestBtn}>
            <View>
              <Text style={styles.guestTitle}> Browse as Guest</Text>
              <Text style={styles.guestSub}>No account needed</Text>
            </View>
          </SoftPressable>

          {/* Sign up */}
          <View style={styles.signupRow}>
            <Text style={styles.signupPrompt}>Don't have an account? </Text>
            <SoftPressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                navigation.navigate('SignUp');
              }}
            >
              <Text style={styles.signupLink}>Create one.</Text>
            </SoftPressable>
          </View>
        </Animated.View>
      </ScrollView>

      {/* Multi-Account Picker Modal */}
      <Modal
        visible={pickerVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={handleClosePicker}
      >
        <KeyboardAvoidingView
          style={styles.pickerRoot}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>Choose an account</Text>
            <TouchableOpacity onPress={handleClosePicker}>
              
            </TouchableOpacity>
          </View>

          <View style={styles.pickerBody}>
            <Text style={styles.pickerSubtitle}>
              Multiple accounts use this email and password. Select which name you want to sign in as.
            </Text>

            {pickerAccounts.map((account, index) => (
              <TouchableOpacity
                key={account.authEmail || index}
                style={styles.pickerAccountCard}
                onPress={() => handleSelectAccount(account)}
                disabled={pickerLoading}
                activeOpacity={0.75}
              >
                <View style={styles.pickerAvatar}>
                  <Text style={styles.pickerAvatarText}>
                    {(account.full_name || '?').charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.pickerAccountInfo}>
                  <Text style={styles.pickerAccountName}>{account.full_name || 'Unnamed account'}</Text>
                  <Text style={styles.pickerAccountMeta}>
 {account.role === 'vendor' ? ' Vendor' : account.role === 'admin' ? ' Admin' : ' Customer'}
                  </Text>
                </View>
                <Text style={styles.pickerArrow}>›</Text>
              </TouchableOpacity>
            ))}

            {pickerError ? (
              <Text style={styles.pickerError}>{pickerError}</Text>
            ) : null}

            {pickerLoading ? (
              <View style={styles.pickerLoadingWrap}>
                <ActivityIndicator color="#B5342A" />
                <Text style={styles.pickerLoadingText}>Signing you in...</Text>
              </View>
            ) : null}

            <TouchableOpacity style={styles.pickerCancel} onPress={handleClosePicker} disabled={pickerLoading}>
              <Text style={styles.pickerCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Forgot Password Sheet */}
      {resetVisible && (
        <View style={styles.sheetOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            onPress={() => { setResetVisible(false); setResetSent(false); setResetEmail(''); }}
            activeOpacity={1}
          />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Reset Password</Text>
            <Text style={styles.sheetSub}>
              We'll send a link so you can create a new password.
            </Text>

            {resetSent ? (
              <View style={styles.sentBox}>
                <Ionicons name="mail-outline" size={18} />
                <Text style={styles.sentText}>Email sent! Check your inbox.</Text>
              </View>
            ) : (
              <>
                <View style={[styles.inputRow, { marginBottom: 22 }]}>
                  <Ionicons name="mail-outline" size={18} />
                  <TextInput
                    style={styles.textInput}
                    placeholder="your@email.com"
                    placeholderTextColor="#BEB0A4"
                    value={resetEmail}
                    onChangeText={setResetEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>

                <TouchableOpacity
                  style={styles.signInBtn}
                  onPress={handleForgotPassword}
                  disabled={resetLoading}
                  activeOpacity={0.88}
                >
                  <LinearGradient
                    colors={['#B5342A', '#D9503F']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.signInGrad}
                  >
                    {resetLoading
                      ? <ActivityIndicator color="#fff" />
                      : <Text style={styles.signInText}>Send Reset Link</Text>
                    }
                  </LinearGradient>
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => { setResetVisible(false); setResetSent(false); setResetEmail(''); }}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      {/* PIN pad for elderly quick login */}
      <PinPadModal
        visible={pinVisible}
        onClose={() => setPinVisible(false)}
        onSuccess={async () => {
          setPinVisible(false);
          // Load the user — RootNavigator auto-navigates on auth state change
          await checkUser();
        }}
      />
    </KeyboardAvoidingView>
  );
};

// ─── StyleSheet ───────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'transparent', // Transparent so image shows through
  },

  // FULL SCREEN BACKGROUND
  fullScreenBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },

  // Dark overlay for better text contrast
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.45)', // Darkens background for better readability
  },

  // ── Alert Banner ─────────────────────────────────────────────────────────────
  banner: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 52 : 14,
    left: 14, right: 14,
    zIndex: 999,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
    paddingLeft: 12, paddingRight: 14,
    paddingTop: 11, paddingBottom: 13,
    gap: 10,
    shadowColor: '#5C2D1A',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.10,
    shadowRadius: 10,
    elevation: 6,
  },
  bannerError: {
    backgroundColor: '#FFF2EF',
    borderWidth: 1,
    borderColor: '#F5C0B6',
  },
  bannerSuccess: {
    backgroundColor: '#EDFAF3',
    borderWidth: 1,
    borderColor: '#A8EACC',
  },
  bannerBadge: {
    width: 24, height: 24,
    borderRadius: 10,
    borderTopLeftRadius: 14,
    borderBottomRightRadius: 14,
    backgroundColor: '#D9503F',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  bannerBadgeSuccess: { backgroundColor: '#2E8B57' },
  bannerBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  bannerText: { flex: 1, fontSize: 13.5, color: '#6E2518', fontWeight: '500', lineHeight: 18 },
  bannerTextSuccess: { color: '#1A6640' },
  bannerCloseText: { fontSize: 12, color: '#A84030', fontWeight: '600' },

  // ── Scroll ────────────────────────────────────────────────────────────────────
  scroll: { 
    flexGrow: 1, 
    paddingBottom: 44,
    justifyContent: 'center',
  },

  // ── Header ───────────────────────────────────────────────────────────────────
  header: {
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 84 : 64,
    paddingBottom: 18,
    paddingLeft: 10,
    position: 'relative',
  },

  logoImg: { 
    width: 96, 
    height: 96, 
    borderRadius: 48,
    marginBottom: 14,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.8)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.30,
    shadowRadius: 16,
    elevation: 8,
  },

  appName: {
    fontSize: Math.min(26, width * 0.067),
    fontWeight: '800',
    color: '#FFFFFF', // White for better contrast on dark background
    letterSpacing: 0.2,
    marginBottom: 7,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },

  tagRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  tagDot: {
    width: 4, height: 4,
    borderRadius: 2,
    borderTopRightRadius: 3,
    backgroundColor: '#FFFFFF',
    opacity: 0.7,
  },
  tagline: {
    fontSize: 11.5,
    color: '#FFFFFF',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    fontWeight: '500',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },

  // ── Card (Now semi-transparent with blur effect) ─────────────────────────────
  card: {
    marginLeft: 20,
    marginRight: 20,
    backgroundColor: 'rgba(255, 250, 247, 0.92)', // Semi-transparent dirty white
    borderTopLeftRadius: 28,
    borderTopRightRadius: 36,
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 22,
    paddingTop: 26,
    paddingBottom: 32,
    paddingLeft: 22,
    paddingRight: 26,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
    backdropFilter: Platform.OS === 'web' ? 'blur(10px)' : undefined,
  },

  greeting: {
    fontSize: Math.min(23, width * 0.059),
    fontWeight: '700',
    color: '#1E1008',
  },
  sub: {
    fontSize: 13.5,
    color: '#9E8070',
    marginBottom: 22,
    marginTop: 2,
  },

  // ── Fields ───────────────────────────────────────────────────────────────────
  fieldGroup: { marginBottom: 16 },

  label: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8A6558',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 9,
    marginLeft: 2,
  },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5EDE7',
    borderRadius: 16,
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E4D3C8',
    paddingLeft: 16,
    paddingRight: 12,
    minHeight: 50,
  },

  inputFocused: {
    borderColor: '#B5342A',
    backgroundColor: '#FDF6F0',
    shadowColor: '#B5342A',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 6,
    elevation: 2,
  },
  inputError: {
    borderColor: '#D9503F',
    backgroundColor: '#FFF3F1',
  },
  inputValid: {
    borderColor: '#4A9E72',
    backgroundColor: '#F2FAF6',
  },

  fieldIcon:  { fontSize: 15, marginRight: 10, color: '#B5342A' },
  textInput:  { flex: 1, fontSize: 14.5, color: '#1E1008', paddingVertical: 13 },
  validIcon:  { fontSize: 15, color: '#4A9E72', fontWeight: '700', marginLeft: 6 },
  eyeToggle:  { fontSize: 12.5, color: '#B5342A', fontWeight: '600', paddingLeft: 8 },
  fieldError: { fontSize: 11.5, color: '#C0392B', marginTop: 5, marginLeft: 3 },

  // ── Options Row ──────────────────────────────────────────────────────────────
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 4,
  },
  rememberRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  checkbox: {
    width: 20, height: 20,
    borderRadius: 7,
    borderTopLeftRadius: 10,
    borderBottomRightRadius: 10,
    borderWidth: 1.5,
    borderColor: '#B5342A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxOn: { backgroundColor: '#B5342A' },
  checkmark:  { color: '#fff', fontSize: 11, fontWeight: '700' },
  rememberLabel: { fontSize: 13, color: '#b53535' },
  forgotLink:    { fontSize: 13, color: '#B5342A', fontWeight: '600' },

  // ── Sign In Button ────────────────────────────────────────────────────────────
  signInBtn: {
    borderRadius: 18,
    borderTopRightRadius: 11,
    borderBottomLeftRadius: 11,
    overflow: 'hidden',
    marginBottom: 18,
    shadowColor: '#B5342A',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.24,
    shadowRadius: 12,
    elevation: 4,
  },
  signInGrad: {
    paddingTop: 16,
    paddingBottom: 14,
    alignItems: 'center',
  },
  signInText: { color: '#fff', fontSize: 15.5, fontWeight: '700', letterSpacing: 0.25 },

  // ── Squiggle OR Divider ───────────────────────────────────────────────────────
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
    gap: 8,
  },
  dividerLabel: { fontSize: 12, color: '#BEB0A4', fontWeight: '500', paddingHorizontal: 2 },

  // ── Guest Button ──────────────────────────────────────────────────────────────
  guestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 13,
    borderWidth: 1.5,
    borderColor: '#E4D3C8',
    borderRadius: 18,
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
    paddingTop: 13,
    paddingBottom: 15,
    paddingLeft: 18,
    paddingRight: 14,
    backgroundColor: '#F5EDE7',
    marginBottom: 22,
    alignSelf: 'center',
    width: '80%',
  },
  guestTitle: { fontSize: 14.5, fontWeight: '600', color: '#2A1610', textAlign: 'center' },
  guestSub:   { fontSize: 11.5, color: '#9E8070', marginTop: 2, textAlign: 'center' },

  // ── Sign Up ───────────────────────────────────────────────────────────────────
  signupRow:    { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  signupPrompt: { fontSize: 13.5, color: '#9E8070' },
  signupLink:   { fontSize: 13.5, color: '#B5342A', fontWeight: '700' },

  // ── Bottom Sheet ──────────────────────────────────────────────────────────────
  sheetOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
    zIndex: 100,
  },
  sheet: {
    backgroundColor: '#FAF7F2',
    borderTopLeftRadius: 34,
    borderTopRightRadius: 22,
    paddingHorizontal: 24,
    paddingTop: 14,
    paddingBottom: Platform.OS === 'ios' ? 46 : 28,
  },
  sheetHandle: {
    width: 38, height: 4,
    borderRadius: 2,
    backgroundColor: '#E4D3C8',
    alignSelf: 'center',
    marginBottom: 22,
  },
  sheetTitle: { fontSize: 21, fontWeight: '700', color: '#1E1008', marginBottom: 7 },
  sheetSub:   { fontSize: 13.5, color: '#8A6558', marginBottom: 22, lineHeight: 19 },

  sentBox: { alignItems: 'center', paddingTop: 20, paddingBottom: 24, gap: 11 },
  sentIcon: { fontSize: 38 },
  sentText: { fontSize: 15.5, color: '#2E8B57', fontWeight: '600', textAlign: 'center' },

  cancelBtn:  { paddingTop: 16, paddingBottom: 12, alignItems: 'center' },
  cancelText: { fontSize: 13.5, color: '#9E8070', fontWeight: '500' },

  // ── Multi-Account Picker ─────────────────────────────────────────────────────
  pickerRoot: {
    flex: 1,
    backgroundColor: '#FAF7F2',
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 24,
    paddingBottom: 16,
    backgroundColor: '#B5342A',
  },
  pickerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  pickerClose: {
    fontSize: 24,
    color: '#FFFFFF',
    fontWeight: '700',
    paddingHorizontal: 6,
  },
  pickerBody: {
    flex: 1,
    padding: 20,
  },
  pickerSubtitle: {
    fontSize: 14,
    color: '#8A6558',
    lineHeight: 20,
    marginBottom: 18,
  },
  pickerAccountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
    gap: 12,
  },
  pickerAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#B5342A',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  pickerAvatarText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  pickerAccountInfo: {
    flex: 1,
  },
  pickerAccountName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E1008',
    marginBottom: 3,
  },
  pickerAccountMeta: {
    fontSize: 12.5,
    color: '#9E8070',
  },
  pickerArrow: {
    fontSize: 24,
    color: '#B5342A',
    fontWeight: '600',
  },
  pickerError: {
    marginTop: 14,
    fontSize: 13,
    color: '#C0392B',
    textAlign: 'center',
  },
  pickerLoadingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 18,
  },
  pickerLoadingText: {
    fontSize: 14,
    color: '#8A6558',
  },
  pickerCancel: {
    marginTop: 18,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E4D3C8',
    borderRadius: 14,
  },
  pickerCancelText: {
    fontSize: 14,
    color: '#9E8070',
    fontWeight: '500',
  },
});
