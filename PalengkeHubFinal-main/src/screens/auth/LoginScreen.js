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
  Linking,
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
export const LoginScreen = () => {
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
  // 'email' -> 'code' -> 'password' -> 'done'
  const [resetStep, setResetStep] = useState('email');
  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState('');

  const [alertMessage, setAlertMessage] = useState('');
  const [alertType, setAlertType] = useState('error');

  const shakeAnim   = useRef(new Animated.Value(0)).current;
  const scaleAnim   = useRef(new Animated.Value(1)).current;
  const logoSlide   = useRef(new Animated.Value(-28)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const formSlide   = useRef(new Animated.Value(36)).current;
  const formOpacity = useRef(new Animated.Value(0)).current;
  const logoFloat   = useRef(new Animated.Value(0)).current;

  const { login, loginAsAccount, checkUser, setIsGuest } = useAuth();
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
      } else if (result.adminWebOnly) {
        shake();
        showPlatformAlert('Admin accounts sign in on the web, not the app. Opening the admin portal for you...');
        Linking.openURL('https://admin.palengkehub.site').catch(() => {});
      } else {
        shake();
        const raw = result.error?.toLowerCase() || '';
        let msg = 'Login failed. Please try again.';
        if (raw.includes('invalid login') || raw.includes('invalid credentials') || raw.includes('user not found'))
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

  const closeResetSheet = () => {
    setResetVisible(false);
    setResetStep('email');
    setResetEmail('');
    setResetCode('');
    setNewPassword('');
    setConfirmNewPassword('');
    setResetError('');
  };

  // Step 1: send a 6-digit recovery code to the entered email. Uses
  // Supabase's own OTP-based recovery (auth.resetPasswordForEmail +
  // auth.verifyOtp), not a magic link — a link needs a deep-link route
  // this app never registered, which is exactly what left "Forgot
  // password?" going nowhere before.
  const handleSendResetCode = async () => {
    if (!resetEmail.trim()) {
      setResetError('Enter your email address first.');
      return;
    }
    setResetError('');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setResetLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.trim());
      if (error) throw error;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setResetStep('code');
    } catch (err) {
      setResetError(err.message || 'Could not send the reset code. Try again.');
    } finally {
      setResetLoading(false);
    }
  };

  // Step 2: confirm the code proves the user owns this inbox. Supabase
  // trades a valid code for a short-lived "recovery" session — that
  // session (not a password, not an admin key) is what authorizes the
  // password change in step 3.
  const handleVerifyResetCode = async () => {
    if (resetCode.trim().length < 6) {
      setResetError('Enter the code sent to your email.');
      return;
    }
    setResetError('');
    setResetLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: resetEmail.trim(),
        token: resetCode.trim(),
        type: 'recovery',
      });
      if (error) throw error;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setResetStep('password');
    } catch (err) {
      setResetError(err.message || 'Incorrect or expired code. Try again.');
    } finally {
      setResetLoading(false);
    }
  };

  // Step 3: the recovery session from step 2 is what lets this succeed —
  // Supabase only allows updateUser({ password }) for the currently
  // authenticated session, which is exactly the guarantee we want here.
  const handleSetNewPassword = async () => {
    if (newPassword.length < 6) {
      setResetError('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setResetError('Passwords do not match.');
      return;
    }
    setResetError('');
    setResetLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      // Sign out of the recovery session so the user lands on a clean
      // Login screen and confirms their new password by signing in fresh.
      await supabase.auth.signOut();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setResetStep('done');
      setTimeout(closeResetSheet, 2500);
    } catch (err) {
      setResetError(err.message || 'Could not update your password. Try again.');
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
      // windowSoftInputMode is "adjustNothing" (see AndroidManifest.xml) —
      // Android does zero automatic window resize/pan when the keyboard
      // opens. That handoff to the OS was what caused the login form's
      // content to shift while a touch was still in progress, landing the
      // touch-up on a different field than the one that was tapped. With
      // "adjustNothing", this KeyboardAvoidingView is the ONLY thing that
      // moves the layout, and it only runs after React processes the
      // focus change — i.e. strictly after the tap gesture has finished.
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
                placeholderTextColor="#A89484"
                value={email}
                onChangeText={validateEmail}
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
              />
              {emailValid && email.length > 0 && (
                <Ionicons name="checkmark" size={18} color="#61802F" />
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
                placeholderTextColor="#A89484"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                onSubmitEditing={handleLogin}
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
                {rememberMe && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
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
                colors={loginSuccess ? ['#61802F', '#9EBF5C'] : ['#C96A28', '#E8833A']}
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
                <ActivityIndicator color="#C96A28" />
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
            onPress={closeResetSheet}
            activeOpacity={1}
          />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />

            {resetStep === 'email' && (
              <>
                <Text style={styles.sheetTitle}>Reset Password</Text>
                <Text style={styles.sheetSub}>
                  We'll send a code to your email so you can create a new password.
                </Text>

                <View style={[styles.inputRow, { marginBottom: 10 }]}>
                  <Ionicons name="mail-outline" size={18} />
                  <TextInput
                    style={styles.textInput}
                    placeholder="your@email.com"
                    placeholderTextColor="#A89484"
                    value={resetEmail}
                    onChangeText={setResetEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
                {resetError ? <Text style={styles.fieldError}>{resetError}</Text> : null}

                <TouchableOpacity
                  style={[styles.signInBtn, { marginTop: 22 }]}
                  onPress={handleSendResetCode}
                  disabled={resetLoading}
                  activeOpacity={0.88}
                >
                  <LinearGradient
                    colors={['#C96A28', '#E8833A']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.signInGrad}
                  >
                    {resetLoading
                      ? <ActivityIndicator color="#fff" />
                      : <Text style={styles.signInText}>Send Code</Text>
                    }
                  </LinearGradient>
                </TouchableOpacity>
              </>
            )}

            {resetStep === 'code' && (
              <>
                <Text style={styles.sheetTitle}>Enter Code</Text>
                <Text style={styles.sheetSub}>
                  We sent a code to {resetEmail}. Enter it below.
                </Text>

                <View style={[styles.inputRow, { marginBottom: 10 }]}>
                  <Ionicons name="key-outline" size={18} />
                  <TextInput
                    style={styles.textInput}
                    placeholder="Enter code"
                    placeholderTextColor="#A89484"
                    value={resetCode}
                    onChangeText={(t) => setResetCode(t.replace(/\D/g, ''))}
                    keyboardType="number-pad"
                  />
                </View>
                {resetError ? <Text style={styles.fieldError}>{resetError}</Text> : null}

                <TouchableOpacity
                  style={[styles.signInBtn, { marginTop: 22 }]}
                  onPress={handleVerifyResetCode}
                  disabled={resetLoading}
                  activeOpacity={0.88}
                >
                  <LinearGradient
                    colors={['#C96A28', '#E8833A']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.signInGrad}
                  >
                    {resetLoading
                      ? <ActivityIndicator color="#fff" />
                      : <Text style={styles.signInText}>Verify Code</Text>
                    }
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                  style={{ marginTop: 14, alignItems: 'center' }}
                  onPress={handleSendResetCode}
                  disabled={resetLoading}
                >
                  <Text style={styles.changeLink}>Resend code</Text>
                </TouchableOpacity>
              </>
            )}

            {resetStep === 'password' && (
              <>
                <Text style={styles.sheetTitle}>New Password</Text>
                <Text style={styles.sheetSub}>
                  Code verified! Choose a new password for your account.
                </Text>

                <View style={[styles.inputRow, { marginBottom: 14 }]}>
                  <Ionicons name="key-outline" size={18} />
                  <TextInput
                    style={styles.textInput}
                    placeholder="New password"
                    placeholderTextColor="#A89484"
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secureTextEntry
                  />
                </View>
                <View style={[styles.inputRow, { marginBottom: 10 }]}>
                  <Ionicons name="key-outline" size={18} />
                  <TextInput
                    style={styles.textInput}
                    placeholder="Confirm new password"
                    placeholderTextColor="#A89484"
                    value={confirmNewPassword}
                    onChangeText={setConfirmNewPassword}
                    secureTextEntry
                  />
                </View>
                {resetError ? <Text style={styles.fieldError}>{resetError}</Text> : null}

                <TouchableOpacity
                  style={[styles.signInBtn, { marginTop: 22 }]}
                  onPress={handleSetNewPassword}
                  disabled={resetLoading}
                  activeOpacity={0.88}
                >
                  <LinearGradient
                    colors={['#C96A28', '#E8833A']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.signInGrad}
                  >
                    {resetLoading
                      ? <ActivityIndicator color="#fff" />
                      : <Text style={styles.signInText}>Update Password</Text>
                    }
                  </LinearGradient>
                </TouchableOpacity>
              </>
            )}

            {resetStep === 'done' && (
              <View style={styles.sentBox}>
                <Ionicons name="checkmark-circle-outline" size={20} color="#61802F" />
                <Text style={styles.sentText}>Password updated! Please sign in again.</Text>
              </View>
            )}

            {resetStep !== 'done' && (
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={closeResetSheet}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            )}
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
    backgroundColor: '#F2E7D6', // paper — shows below the hero photo band
  },

  // Hero photo band, sized to the source photo's own aspect ratio (it's a
  // landscape 4:3 shot) instead of stretching full-bleed across a portrait
  // screen — that stretch is what was cropping it into an extreme, "too
  // zoomed in" close-up. This shows the whole photo, uncropped.
  fullScreenBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    width: '100%',
    aspectRatio: 3552 / 2664,
  },

  // Dark overlay, same band as the photo — not the full screen, so the
  // paper background below it isn't needlessly darkened too.
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    width: '100%',
    aspectRatio: 3552 / 2664,
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
    backgroundColor: '#D34638',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  bannerBadgeSuccess: { backgroundColor: '#61802F' },
  bannerBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  bannerText: { flex: 1, fontSize: 13.5, color: '#6E2518', fontWeight: '500', lineHeight: 18 },
  bannerTextSuccess: { color: '#61802F' },
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
    color: '#261006',
  },
  sub: {
    fontSize: 13.5,
    color: '#8A7263',
    marginBottom: 22,
    marginTop: 2,
  },

  // ── Fields ───────────────────────────────────────────────────────────────────
  fieldGroup: { marginBottom: 16 },

  label: {
    fontSize: 11,
    fontWeight: '600',
    color: '#5B4436',
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
    borderColor: '#C96A28',
    backgroundColor: '#FDF3E9',
    // No shadow/elevation here deliberately: adding elevation to a View the
    // instant its child TextInput gains focus makes Android rebuild that
    // View's native layer to add the shadow, which drops the child's IME
    // connection right as it's created — this was the actual cause of the
    // email field losing focus and jumping to password on every tap.
  },
  inputError: {
    borderColor: '#D34638',
    backgroundColor: '#FBE2DE',
  },
  inputValid: {
    borderColor: '#4A9E72',
    backgroundColor: '#F2FAF6',
  },

  fieldIcon:  { fontSize: 15, marginRight: 10, color: '#C96A28' },
  textInput:  { flex: 1, fontSize: 14.5, color: '#261006', paddingVertical: 13 },
  validIcon:  { fontSize: 15, color: '#4A9E72', fontWeight: '700', marginLeft: 6 },
  eyeToggle:  { fontSize: 12.5, color: '#C96A28', fontWeight: '600', paddingLeft: 8 },
  fieldError: { fontSize: 11.5, color: '#9E2B20', marginTop: 5, marginLeft: 3 },
  lockedEmailText: { flex: 1, fontSize: 14.5, color: '#5B4436', marginLeft: 10 },
  changeLink: { fontSize: 12.5, color: '#C96A28', fontWeight: '700' },

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
    borderColor: '#C96A28',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxOn: { backgroundColor: '#C96A28' },
  checkmark:  { color: '#fff', fontSize: 11, fontWeight: '700' },
  rememberLabel: { fontSize: 13, color: '#5B4436' },
  forgotLink:    { fontSize: 13, color: '#C96A28', fontWeight: '600' },

  // ── Sign In Button ────────────────────────────────────────────────────────────
  signInBtn: {
    borderRadius: 18,
    borderTopRightRadius: 11,
    borderBottomLeftRadius: 11,
    overflow: 'hidden',
    marginBottom: 18,
    shadowColor: '#C96A28',
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
  dividerLabel: { fontSize: 12, color: '#A89484', fontWeight: '500', paddingHorizontal: 2 },

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
  guestSub:   { fontSize: 11.5, color: '#8A7263', marginTop: 2, textAlign: 'center' },

  // ── Sign Up ───────────────────────────────────────────────────────────────────
  signupRow:    { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  signupPrompt: { fontSize: 13.5, color: '#8A7263' },
  signupLink:   { fontSize: 13.5, color: '#C96A28', fontWeight: '700' },

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
  sheetTitle: { fontSize: 21, fontWeight: '700', color: '#261006', marginBottom: 7 },
  sheetSub:   { fontSize: 13.5, color: '#5B4436', marginBottom: 22, lineHeight: 19 },

  sentBox: { alignItems: 'center', paddingTop: 20, paddingBottom: 24, gap: 11 },
  sentIcon: { fontSize: 38 },
  sentText: { fontSize: 15.5, color: '#61802F', fontWeight: '600', textAlign: 'center' },

  cancelBtn:  { paddingTop: 16, paddingBottom: 12, alignItems: 'center' },
  cancelText: { fontSize: 13.5, color: '#8A7263', fontWeight: '500' },

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
    backgroundColor: '#C96A28',
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
    color: '#5B4436',
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
    backgroundColor: '#C96A28',
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
    color: '#261006',
    marginBottom: 3,
  },
  pickerAccountMeta: {
    fontSize: 12.5,
    color: '#8A7263',
  },
  pickerArrow: {
    fontSize: 24,
    color: '#C96A28',
    fontWeight: '600',
  },
  pickerError: {
    marginTop: 14,
    fontSize: 13,
    color: '#9E2B20',
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
    color: '#5B4436',
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
    color: '#8A7263',
    fontWeight: '500',
  },
});
