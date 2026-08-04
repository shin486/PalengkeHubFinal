import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
  Animated,
  Dimensions,
  Vibration,
  Modal,
  SafeAreaView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../../lib/supabase';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';

const { width, height } = Dimensions.get('window');

const COLORS = {
  primary: '#DC2626',
  primaryLight: '#EF4444',
  primaryDark: '#B91C1C',
  accent: '#F87171',
  accentLight: '#FEE2E2',
  accentSoft: '#FEF2F2',
  background: '#F8F9FA',
  surface: '#FFFFFF',
  text: {
    dark: '#111827',
    medium: '#374151',
    light: '#6B7280',
    lighter: '#9CA3AF',
    white: '#FFFFFF',
  },
  border: '#E5E7EB',
  borderLight: '#F3F4F6',
  success: '#10B981',
  error: '#DC2626',
  warning: '#F59E0B',
  shadow: 'rgba(0, 0, 0, 0.08)',
  shadowDark: 'rgba(0, 0, 0, 0.12)',
};

// Stall sections available in the market
const STALL_SECTIONS = [
  'Meat Section',
  'Vegetable Section',
  'Fish Section',
  'Fruit Section',
  'Dry Goods',
  'Poultry Section',
  'Rice Section',
  'Condiments Section',
  'Frozen Goods',
  'Beverages Section',
];

// Stable module-scope OTP modal — avoids the component-identity re-render loop
// that happens when the modal is defined inside the screen component.
const OTPModal = ({
  visible,
  title = 'Verification',
  recipient,
  recipientLabel = 'your phone number',
  digits,
  otpInputs,
  onDigitChange,
  onKeyPress,
  error,
  sending,
  onVerify,
  onResend,
  onClose,
  resendCooldown,
  hintText = '⏳ The SMS may take 30–60 seconds to arrive, depending on your network.',
}) => (
  <Modal
    visible={visible}
    animationType="slide"
    transparent={false}
    onRequestClose={onClose}
  >
    <SafeAreaView style={styles.modalContainer}>
      <View style={styles.modalHeader}>
        <Text style={styles.modalTitle}>{title}</Text>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.modalClose}>✕</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.modalContent}>
        <Text style={styles.modalMessage}>
          Enter the 6-digit code sent to {recipient || recipientLabel}.
        </Text>

        {/* Delivery-time hint */}
        <View style={styles.otpHintBox}>
          <Text style={styles.otpHintText}>
            {hintText}
          </Text>
        </View>

        {/* 6 blank digit boxes with auto-advance */}
        <View style={styles.otpBoxesRow}>
          {digits.map((digit, index) => (
            <TextInput
              key={index}
              ref={(el) => { otpInputs.current[index] = el; }}
              style={[styles.otpBox, digit !== '' && styles.otpBoxFilled]}
              value={digit}
              onChangeText={(v) => onDigitChange(index, v)}
              onKeyPress={(e) => onKeyPress(index, e)}
              keyboardType="numeric"
              maxLength={1}
              textAlign="center"
              autoFocus={index === 0}
              placeholder=""
            />
          ))}
        </View>

        {error ? <Text style={styles.otpErrorText}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.otpButton, sending && styles.otpButtonDisabled]}
          onPress={onVerify}
          disabled={sending}
        >
          <Text style={styles.otpButtonText}>{sending ? 'Verifying...' : 'Verify Code'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.otpLinkButton, (sending || resendCooldown > 0) && styles.otpLinkButtonDisabled]}
          onPress={onResend}
          disabled={sending || resendCooldown > 0}
        >
          <Text style={styles.otpLinkText}>
            {sending
              ? 'Resending...'
              : resendCooldown > 0
                ? `Resend code in ${resendCooldown}s`
                : 'Resend code'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  </Modal>
);

export const SignUpScreen = ({ setIsGuest }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('consumer');
  const [verificationMethod, setVerificationMethod] = useState('email');
  
  // Vendor-specific fields
  const [stallName, setStallName] = useState('');
  const [stallSection, setStallSection] = useState('');
  const [stallNumber, setStallNumber] = useState('');
  
  // ✅ Terms and Conditions
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  
  // Document uploads
  const [validId, setValidId] = useState(null);
  const [validIdName, setValidIdName] = useState('');
  const [businessPermit, setBusinessPermit] = useState(null);
  const [businessPermitName, setBusinessPermitName] = useState('');
  
  const [uploading, setUploading] = useState(false);
  const [showSectionPicker, setShowSectionPicker] = useState(false);
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [emailValid, setEmailValid] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [passwordsMatch, setPasswordsMatch] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [signUpSuccess, setSignUpSuccess] = useState(false);
  const [otpModalVisible, setOtpModalVisible] = useState(false);
  const [otpMode, setOtpMode] = useState('sms'); // 'sms' | 'email'
  const [otpCode, setOtpCode] = useState('');
  const [expectedVerificationCode, setExpectedVerificationCode] = useState('');
  const [expectedEmailVerificationCode, setExpectedEmailVerificationCode] = useState('');
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [authEmail, setAuthEmail] = useState(''); // the auth email (may be a +alias for accounts 2–5)
  const [emailAccountCount, setEmailAccountCount] = useState(0); // existing accounts for this email
  const [duplicateName, setDuplicateName] = useState(false); // same name already used for this email
  const otpInputs = useRef([]);
  const [smsSending, setSmsSending] = useState(false);
  const [smsSendError, setSmsSendError] = useState('');
  const [emailSending, setEmailSending] = useState(false);
  const [emailSendError, setEmailSendError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [shakeAnim] = useState(new Animated.Value(0));
  const [scaleAnim] = useState(new Animated.Value(1));
  const [logoScale] = useState(new Animated.Value(0));
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(50));
  
  const { signUp, login, sendAuthenticatorSms, sendEmailVerificationCode } = useAuth();
  const navigation = useNavigation();

  const handleSendSmsVerification = async () => {
    setSmsSendError('');
    setSmsSending(true);
    setOtpMode('sms');
    try {
      const result = await sendAuthenticatorSms(phone);
      setExpectedVerificationCode(result.verification_code || '');
      setOtpModalVisible(true);
      // On web, Alert.alert is blocking (window.alert) and can prevent the
      // OTP modal from appearing immediately — show the modal first instead.
      if (Platform.OS !== 'web') {
        Alert.alert('Verification code sent', 'Please check your SMS and enter the code to continue.');
      }
      // Start resend cooldown (60s)
      setResendCooldown(60);
    } catch (error) {
      console.error('SMS verification send failed:', error);
      setSmsSendError(error.message || 'Failed to send verification code');
      if (Platform.OS !== 'web') {
        Alert.alert('SMS Failed', error.message || 'Failed to send verification code.');
      } else {
        setOtpModalVisible(true); // Still show modal on web so the error is visible inline
      }
    } finally {
      setSmsSending(false);
    }
  };

  // Countdown timer for resend cooldown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleSendEmailVerification = async () => {
    setEmailSendError('');
    setEmailSending(true);
    setOtpMode('email');
    try {
      const result = await sendEmailVerificationCode(email);
      setExpectedEmailVerificationCode(result.verification_code || '');
      setOtpModalVisible(true);
      if (Platform.OS !== 'web') {
        Alert.alert('Verification code sent', 'Please check your email and enter the 6-digit code to continue.');
      }
      setResendCooldown(60);
    } catch (error) {
      console.error('Email verification send failed:', error);
      setEmailSendError(error.message || 'Failed to send verification code');
      if (Platform.OS !== 'web') {
        Alert.alert('Email Failed', error.message || 'Failed to send verification code.');
      } else {
        setOtpModalVisible(true);
      }
    } finally {
      setEmailSending(false);
    }
  };

  const handleVerifyEmailOtp = async (directCode) => {
    const enteredCode = (directCode ?? otpCode).trim();

    if (enteredCode.length !== 6) {
      shake();
      setEmailSendError('Please enter the 6-digit code sent to your email.');
      return;
    }

    if (enteredCode !== expectedEmailVerificationCode) {
      shake();
      setEmailSendError('Incorrect code. Please check the code sent to your email and try again.');
      return;
    }

    setOtpModalVisible(false);
    setEmailSendError('');
    setOtpCode('');
    setExpectedEmailVerificationCode('');
    setOtpDigits(['', '', '', '', '', '']);

    // The account was already created and the email is now verified.
    // Sign the user in automatically and redirect them to the dashboard.
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSignUpSuccess(true);

    try {
      // The account is ALWAYS created with email in AuthContext.signUp().
      // Use the stored authEmail (may be a +alias for accounts 2–5) so we
      // sign into the exact account that was just created.
      const loginIdentifier = authEmail || email;
      const result = await login(loginIdentifier, password);
      if (result.success) {
        // RootNavigator will automatically redirect to the right dashboard
        // based on profile.role (consumer → App, vendor → VendorDashboard).
        if (role === 'vendor') {
          Alert.alert(
            'Application Submitted!',
            'Email verified! Your vendor application was submitted and will be reviewed by admin within 2-3 business days. You will be notified once approved.',
            [{ text: 'OK' }]
          );
        }
      } else {
        // Login after signup failed — send them to the Login screen instead.
        setTimeout(() => {
          setSignUpSuccess(false);
          Alert.alert(
            'Email Verified!',
            'Your email address has been verified. Please log in with your credentials.',
            [{ text: 'OK', onPress: () => navigation.navigate('Login') }]
          );
        }, 800);
      }
    } catch (err) {
      console.error('Auto-login after email OTP error:', err);
      setTimeout(() => {
        setSignUpSuccess(false);
        Alert.alert(
          'Email Verified!',
          'Your email address has been verified. Please log in with your credentials.',
          [{ text: 'OK', onPress: () => navigation.navigate('Login') }]
        );
      }, 800);
    }
  };

  const handleOtpDigitChange = (index, value) => {
    const cleaned = value.replace(/\D/g, '').slice(-1);
    const next = [...otpDigits];
    next[index] = cleaned;
    const joined = next.join('');
    setOtpDigits(next);
    setOtpCode(joined);

    // Auto-advance to the next box
    if (cleaned && index < 5) {
      otpInputs.current[index + 1]?.focus();
    }

    // Auto-verify once all 6 digits are entered.
    // Pass `joined` directly to avoid reading the stale `otpCode` state
    // (React state updates are async — the closure would still hold 5 digits).
    if (joined.length === 6) {
      setTimeout(() => {
        if (otpMode === 'email') {
          handleVerifyEmailOtp(joined);
        } else {
          handleVerifyOtp(joined);
        }
      }, 250);
    }
  };

  const handleOtpKeyPress = (index, e) => {
    // Backspace on an empty box goes back to the previous box
    if (e.nativeEvent.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputs.current[index - 1]?.focus();
    }
  };

  const handleVerifyOtp = async (directCode) => {
    const enteredCode = (directCode ?? otpCode).trim();

    if (enteredCode.length !== 6) {
      shake();
      setSmsSendError('Please enter the 6-digit code sent to your phone.');
      return;
    }

    if (enteredCode !== expectedVerificationCode) {
      shake();
      setSmsSendError('Incorrect code. Please check the code sent to your phone and try again.');
      return;
    }

    setOtpModalVisible(false);
    setSmsSendError('');
    setOtpCode('');
    setExpectedVerificationCode('');
    setOtpDigits(['', '', '', '', '', '']);

    // The account was already created and the phone is now verified.
    // Sign the user in automatically and redirect them to the dashboard.
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSignUpSuccess(true);

    try {
      // The account is ALWAYS created with email in AuthContext.signUp()
      // (even for SMS verification), so the login identifier must be the
      // auth email. Use the stored authEmail (may be a +alias for accounts 2–5).
      // Logging in with the phone number would fail because the Supabase auth
      // identity is tied to the email.
      const loginIdentifier = authEmail || email;
      const result = await login(loginIdentifier, password);
      if (result.success) {
        // RootNavigator will automatically redirect to the right dashboard
        // based on profile.role (consumer → App, vendor → VendorDashboard).
        // For vendors, their application is still pending review.
        if (role === 'vendor') {
          Alert.alert(
            'Application Submitted!',
            'Phone verified! Your vendor application was submitted and will be reviewed by admin within 2-3 business days. You will be notified once approved.',
            [{ text: 'OK' }]
          );
        }
      } else {
        // Login after signup failed — send them to the Login screen instead.
        setTimeout(() => {
          setSignUpSuccess(false);
          Alert.alert(
            'Phone Verified!',
            'Your phone number has been verified. Please log in with your credentials.',
            [{ text: 'OK', onPress: () => navigation.navigate('Login') }]
          );
        }, 800);
      }
    } catch (err) {
      console.error('Auto-login after OTP error:', err);
      setTimeout(() => {
        setSignUpSuccess(false);
        Alert.alert(
          'Phone Verified!',
          'Your phone number has been verified. Please log in with your credentials.',
          [{ text: 'OK', onPress: () => navigation.navigate('Login') }]
        );
      }, 800);
    }
  };

  // Animations on mount
  useEffect(() => {
    Animated.parallel([
      Animated.spring(logoScale, {
        toValue: 1,
        tension: 10,
        friction: 2,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 20,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Check if passwords match
  useEffect(() => {
    setPasswordsMatch(password === confirmPassword && confirmPassword.length > 0);
  }, [password, confirmPassword]);

  // Shake animation for errors
  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
    Vibration.vibrate(100);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  };

  // Email validation
  const validateEmail = (text) => {
    setEmail(text);
    const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text);
    setEmailValid(isValidEmail);
    return isValidEmail;
  };

  // Look up how many accounts already exist for the entered email (debounced),
  // so we can show "This email already has N accounts" and block at the 5th.
  useEffect(() => {
    if (!emailValid || !email) {
      setEmailAccountCount(0);
      return;
    }

    const normalized = email.trim().toLowerCase();
    const timer = setTimeout(async () => {
      try {
        const { count, error } = await supabase
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .eq('email', normalized);
        if (!error) {
          setEmailAccountCount(count || 0);
        }
      } catch (err) {
        console.warn('Could not fetch account count for email:', err);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [email, emailValid]);

  // Check whether this full name is already used for this email, so we can
  // warn the user before they hit submit (multi-account supports 1 per name).
  useEffect(() => {
    if (!emailValid || !email || !fullName.trim()) {
      setDuplicateName(false);
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const name = fullName.trim();
    const timer = setTimeout(async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('email', normalizedEmail)
          .ilike('full_name', name);
        if (!error) {
          setDuplicateName((data || []).length > 0);
        }
      } catch (err) {
        console.warn('Could not check duplicate name:', err);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [email, emailValid, fullName]);

  const isValidPhoneNumber = (text) => {
    return /^\+?\d{8,15}$/.test(text.trim());
  };

  const getVerificationHint = () => {
    return verificationMethod === 'sms'
      ? 'Enter your mobile number with country code, e.g. +639123456789.'
      : 'A 6-digit code will be sent to your email for verification.';
  };

  // Password strength indicator
  const checkPasswordStrength = (pass) => {
    setPassword(pass);
    let strength = 0;
    if (pass.length >= 6) strength++;
    if (pass.length >= 10) strength++;
    if (/[A-Z]/.test(pass)) strength++;
    if (/[0-9]/.test(pass)) strength++;
    if (/[^A-Za-z0-9]/.test(pass)) strength++;
    setPasswordStrength(strength);
  };

  // Pick image/document functions
  const pickDocument = async (type, setFile, setFileName) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf'],
        copyToCacheDirectory: true,
      });
      
      if (result.canceled === false) {
        const file = result.assets[0];
        setFile(file);
        setFileName(file.name);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('Document pick error:', error);
      Alert.alert('Error', 'Failed to select document');
    }
  };

  const pickImage = async (type, setFile, setFileName) => {
    try {
      // Request permission ONLY when the user actually taps "Upload" —
      // this avoids the early prompt on the SignUp screen mount.
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            'Photo Access Needed',
            'Please allow photo access to upload your document. You can enable it in your device Settings > Apps > PalengkeHub > Permissions.'
          );
          return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaType.Images,
        allowsEditing: true,
        quality: 0.8,
        base64: true,
      });
      
      if (!result.canceled) {
        const file = {
          uri: result.assets[0].uri,
          name: `${type}_${Date.now()}.jpg`,
          type: 'image/jpeg',
          base64: result.assets[0].base64,
        };
        setFile(file);
        setFileName(file.name);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('Image pick error:', error);
      Alert.alert('Error', 'Failed to select image');
    }
  };

  const uploadDocument = async (file, folder) => {
    if (!file) return null;
    
    try {
      const formData = new FormData();
      formData.append('file', {
        uri: file.uri,
        name: file.name,
        type: file.type || 'image/jpeg',
      });
      
      // Upload to your storage bucket
      const { data, error } = await supabase.storage
        .from('vendor_documents')
        .upload(`${folder}/${Date.now()}_${file.name}`, file, {
          cacheControl: '3600',
          upsert: false,
        });
      
      if (error) throw error;
      
      // Get public URL
      const { data: urlData } = supabase.storage
        .from('vendor_documents')
        .getPublicUrl(data.path);
      
      return urlData.publicUrl;
    } catch (error) {
      console.error('Upload error:', error);
      return null;
    }
  };

  // Validate vendor fields
  const validateVendorFields = () => {
    if (role !== 'vendor') return true;
    
    if (!stallName.trim()) {
      Alert.alert('Required', 'Please enter your stall name');
      return false;
    }
    
    if (!stallSection) {
      Alert.alert('Required', 'Please select your stall section');
      return false;
    }
    
    if (!stallNumber.trim()) {
      Alert.alert('Required', 'Please enter your stall number');
      return false;
    }
    
    if (!phone.trim()) {
      Alert.alert('Required', 'Please enter your contact number');
      return false;
    }
    
    if (!validId) {
      Alert.alert('Required', 'Please upload a valid government ID');
      return false;
    }
    
    if (!businessPermit) {
      Alert.alert('Required', 'Please upload your business permit');
      return false;
    }
    
    return true;
  };

  const handleSignUp = async () => {
    // ✅ Check Terms and Conditions
    if (!termsAccepted) {
      shake();
      Alert.alert('Terms & Conditions', 'Please accept the Terms and Conditions to continue');
      return;
    }

    // Basic validation. Email is ALWAYS required because AuthContext.signUp()
    // creates the account with email even for SMS verification — the phone
    // number is only used for the OTP code, not as the auth identifier.
    if (!fullName || !password || !confirmPassword) {
      shake();
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    if (!email) {
      shake();
      Alert.alert('Error', 'Please enter your email address');
      return;
    }

    if (!emailValid) {
      shake();
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    // Multi-account limit (client-side pre-check; AuthContext re-checks too)
    if (emailAccountCount >= 5) {
      shake();
      Alert.alert('Limit Reached', 'This email already has 5 accounts. The maximum of 5 accounts per email has been reached. Please use a different email.');
      return;
    }

    if (duplicateName) {
      shake();
      Alert.alert('Name Already Used', 'An account with this name already exists for this email. Please use a different name for this additional account.');
      return;
    }

    if (!phone.trim()) {
      shake();
      Alert.alert('Error', 'Please enter your mobile number for verification');
      return;
    }

    if (!isValidPhoneNumber(phone)) {
      shake();
      Alert.alert('Error', 'Please enter a valid phone number with country code, e.g. +639123456789');
      return;
    }

    if (password !== confirmPassword) {
      shake();
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (password.length < 6) {
      shake();
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    // Vendor-specific validation
    if (!validateVendorFields()) {
      shake();
      return;
    }

    // Button press animation
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.95, duration: 100, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 3, useNativeDriver: true }),
    ]).start();
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsLoading(true);
    setUploading(true);

    try {
      const performSignUp = async () => {
        let validIdUrl = null;
        let businessPermitUrl = null;
        
        if (role === 'vendor') {
          const timestamp = Date.now();
          const userId = `temp_${timestamp}`;
          
          validIdUrl = await uploadDocument(validId, `valid_ids/${userId}`);
          businessPermitUrl = await uploadDocument(businessPermit, `business_permits/${userId}`);
        }
        
        const metadata = role === 'vendor' ? {
          stall_name: stallName,
          stall_section: stallSection,
          stall_number: stallNumber,
          phone: phone,
          verificationMethod,
          valid_id_url: validIdUrl,
          business_permit_url: businessPermitUrl,
          requires_approval: true,
          terms_accepted: true,
          terms_accepted_at: new Date().toISOString(),
        } : { 
          phone: phone,
          verificationMethod,
          terms_accepted: true,
          terms_accepted_at: new Date().toISOString(),
        };

        return await signUp(email, password, fullName, role, metadata);
      };

      // 1) Create the account. For SMS verification, ALSO fire the SMS send
      //    in parallel so the code is already in transit while the account is
      //    being created (avoids the perceived "SMS takes too long" delay).
      const smsPromise = verificationMethod === 'sms'
        ? handleSendSmsVerification()
        : null;

      const result = await performSignUp();
      
      if (result.success) {
        // Store the auth email (may be a +alias for accounts 2–5) so the OTP
        // auto-login uses the exact account that was just created.
        setAuthEmail(result.authEmail || email);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        // 2) Authenticate based on the method the user chose:
        //    - "sms"   → iProg SMS sends a 6-digit code → OTP modal appears
        //    - "email" → Resend email sends a 6-digit code → OTP modal appears
        //                (sent AFTER account creation, code returned by worker)
        if (verificationMethod === 'sms') {
          setSignUpSuccess(true);
          if (smsPromise) await smsPromise;
          setSignUpSuccess(false);
        } else {
          setSignUpSuccess(true);
          await handleSendEmailVerification();
          setSignUpSuccess(false);
        }
        return;
      } else {
        // Account creation failed — dismiss the OTP modal if the parallel SMS
        // send already opened it, since there is no account to verify.
        setOtpModalVisible(false);
        shake();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert('Sign Up Failed', result.error);
      }
    } catch (error) {
      console.error('Sign up error:', error);
      setOtpModalVisible(false);
      shake();
      Alert.alert('Error', error.message || 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
      setUploading(false);
    }
  };

  const handleGuestMode = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (setIsGuest) {
      setIsGuest(true);
    }
  };

  const getPasswordStrengthColor = () => {
    if (passwordStrength <= 1) return '#EF4444';
    if (passwordStrength <= 3) return '#F59E0B';
    return '#10B981';
  };

  const getPasswordStrengthText = () => {
    if (passwordStrength <= 1) return 'Weak';
    if (passwordStrength <= 3) return 'Medium';
    return 'Strong';
  };

  const handleOtpModalClose = () => {
    setOtpModalVisible(false);
    setOtpCode('');
    setExpectedVerificationCode('');
    setExpectedEmailVerificationCode('');
    setOtpDigits(['', '', '', '', '', '']);
    setSmsSendError('');
    setEmailSendError('');
    setResendCooldown(0);
  };

  // ✅ Terms and Conditions Modal
  const TermsModal = () => (
    <Modal
      visible={showTermsModal}
      animationType="slide"
      transparent={false}
      onRequestClose={() => setShowTermsModal(false)}
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Terms and Conditions</Text>
          <TouchableOpacity onPress={() => setShowTermsModal(false)}>
            <Text style={styles.modalClose}>✕</Text>
          </TouchableOpacity>
        </View>
        <ScrollView style={styles.modalContent}>
          <Text style={styles.termsText}>
            <Text style={styles.termsHeading}>1. Acceptance of Terms{'\n\n'}</Text>
            By creating an account on PalengkeHub, you agree to be bound by these Terms and Conditions. If you do not agree to these terms, please do not use our services.

            {'\n\n'}<Text style={styles.termsHeading}>2. Description of Service{'\n\n'}</Text>
            PalengkeHub is an online marketplace platform that connects customers with vendors/stall owners at Lipa City Public Market. Users can browse products, place orders, and communicate with vendors through our platform.

            {'\n\n'}<Text style={styles.termsHeading}>3. User Accounts{'\n\n'}</Text>
            • You must provide accurate and complete information when creating an account{'\n'}
            • You are responsible for maintaining the confidentiality of your account credentials{'\n'}
            • You are responsible for all activities that occur under your account{'\n'}
            • Notify us immediately of any unauthorized use of your account{'\n'}
            • We reserve the right to suspend or terminate accounts that violate these terms

            {'\n\n'}<Text style={styles.termsHeading}>4. Vendor Terms{'\n\n'}</Text>
            • Vendors must provide valid business permits and identification{'\n'}
            • Vendors are responsible for the accuracy of product listings{'\n'}
            • Vendors must fulfill orders in a timely manner{'\n'}
            • Vendors must maintain fair and accurate pricing{'\n'}
            • Vendors must respond to customer inquiries promptly{'\n'}
            • Failure to comply may result in account suspension

            {'\n\n'}<Text style={styles.termsHeading}>5. Customer Terms{'\n\n'}</Text>
            • Customers must provide accurate delivery/pickup information{'\n'}
            • Customers agree to pay the total amount shown at checkout{'\n'}
            • Customers must pick up orders on time{'\n'}
            • Abusive behavior towards vendors will not be tolerated{'\n'}
            • False or fraudulent orders may result in account ban

            {'\n\n'}<Text style={styles.termsHeading}>6. Payments and Fees{'\n\n'}</Text>
            • All prices are in Philippine Peso (PHP){'\n'}
            • Payment methods accepted: Cash on Pickup, GCash, Bank Transfer{'\n'}
            • Vendors are responsible for their own transaction fees{'\n'}
            • PalengkeHub may charge service fees (to be disclosed separately){'\n'}
            • Refunds are subject to vendor approval

            {'\n\n'}<Text style={styles.termsHeading}>7. Order and Delivery{'\n\n'}</Text>
            • Orders are confirmed once the vendor accepts them{'\n'}
            • Pickup times are estimates and may vary{'\n'}
            • Customers should inspect orders upon pickup{'\n'}
            • Issues with orders should be reported within 24 hours{'\n'}
            • Vendors may propose changes to orders (quantity/unit changes)

            {'\n\n'}<Text style={styles.termsHeading}>8. Cancellations and Refunds{'\n\n'}</Text>
            • Customers can cancel orders while still pending{'\n'}
            • Cancellations after vendor confirmation require vendor approval{'\n'}
            • Refunds are processed at the vendor's discretion{'\n'}
            • PalengkeHub may mediate disputes but is not liable for refunds

            {'\n\n'}<Text style={styles.termsHeading}>9. Prohibited Activities{'\n\n'}</Text>
            • Selling illegal or prohibited items{'\n'}
            • Misrepresenting products or prices{'\n'}
            • Harassing other users{'\n'}
            • Manipulating ratings or reviews{'\n'}
            • Attempting to bypass our payment system{'\n'}
            • Sharing account credentials with unauthorized users

            {'\n\n'}<Text style={styles.termsHeading}>10. Ratings and Reviews{'\n\n'}</Text>
            • Users may rate and review vendors after completed orders{'\n'}
            • Reviews must be honest and based on actual experience{'\n'}
            • Fake or malicious reviews may be removed{'\n'}
            • Vendors may respond to customer reviews{'\n'}
            • We reserve the right to remove inappropriate content

            {'\n\n'}<Text style={styles.termsHeading}>11. Privacy Policy{'\n\n'}</Text>
            We collect and process personal information as described in our Privacy Policy. By using our service, you consent to such collection and use.

            {'\n\n'}<Text style={styles.termsHeading}>12. Limitation of Liability{'\n\n'}</Text>
            PalengkeHub acts as a platform connecting buyers and sellers. We are not responsible for:
            • Product quality or safety{'\n'}
            • Vendor-customer disputes{'\n'}
            • Delays in order fulfillment{'\n'}
            • Losses due to account compromise{'\n'}
            • Technical issues beyond our control

            {'\n\n'}<Text style={styles.termsHeading}>13. Modifications to Terms{'\n\n'}</Text>
            We may modify these terms at any time. Continued use of the platform constitutes acceptance of modified terms.

            {'\n\n'}<Text style={styles.termsHeading}>14. Termination{'\n\n'}</Text>
            We may terminate or suspend your account immediately, without prior notice, for conduct that violates these terms or is harmful to other users.

            {'\n\n'}<Text style={styles.termsHeading}>15. Contact Information{'\n\n'}</Text>
            For questions about these Terms, contact us at:{'\n'}
            Email: support@palengkehub.com{'\n'}
            Phone: (043) 123-4567{'\n'}
            Address: Lipa City Public Market, Lipa City, Batangas

            {'\n\n'}<Text style={styles.termsLastUpdated}>Last Updated: January 1, 2024</Text>
          </Text>
        </ScrollView>
        <View style={styles.modalFooter}>
          <TouchableOpacity
            style={styles.modalAcceptButton}
            onPress={() => {
              setTermsAccepted(true);
              setShowTermsModal(false);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
          >
            <LinearGradient
              colors={['#DC2626', '#EF4444']}
              style={styles.modalAcceptGradient}
            >
              <Text style={styles.modalAcceptText}>I Accept the Terms</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );

  // Document upload component
  const DocumentUpload = ({ label, icon, required, onUpload, fileName, file }) => (
    <View style={styles.documentUploadGroup}>
      <Text style={styles.documentLabel}>
        {required && <Text style={styles.requiredStar}>*</Text>}
        {label}
      </Text>
      <TouchableOpacity 
        style={[styles.uploadButton, file && styles.uploadButtonSuccess]}
        onPress={onUpload}
      >
        <Text style={styles.uploadIcon}>{file ? '✅' : icon}</Text>
        <Text style={[styles.uploadText, file && styles.uploadTextSuccess]}>
          {file ? fileName : `Upload ${label}`}
        </Text>
      </TouchableOpacity>
      {required && !file && (
        <Text style={styles.uploadErrorText}>Required document missing</Text>
      )}
    </View>
  );

  // Render vendor-specific fields
  const renderVendorFields = () => {
    if (role !== 'vendor') return null;
    
    return (
      <View style={styles.vendorSection}>
        <Text style={styles.vendorSectionTitle}>🏪 Stall Information</Text>
        <Text style={styles.vendorSectionSubtitle}>Please provide your stall details for verification</Text>
        
        {/* Stall Name */}
        <View style={styles.inputGroup}>
          <View style={styles.inputWrapper}>
            <Text style={styles.inputIcon}>🏷️</Text>
            <TextInput
              style={styles.input}
              placeholder="Stall Name (e.g., Mang Juan's Meat Shop)"
              placeholderTextColor="#9CA3AF"
              value={stallName}
              onChangeText={setStallName}
            />
          </View>
        </View>
        
        {/* Stall Section Dropdown */}
        <View style={styles.inputGroup}>
          <TouchableOpacity 
            style={styles.inputWrapper}
            onPress={() => setShowSectionPicker(!showSectionPicker)}
          >
            <Text style={styles.inputIcon}>📍</Text>
            <Text style={[styles.input, stallSection ? styles.inputText : styles.placeholderText]}>
              {stallSection || 'Select Stall Section'}
            </Text>
            <Text style={styles.dropdownArrow}>▼</Text>
          </TouchableOpacity>
          
          {showSectionPicker && (
            <View style={styles.sectionPicker}>
              {STALL_SECTIONS.map((section) => (
                <TouchableOpacity
                  key={section}
                  style={[
                    styles.sectionOption,
                    stallSection === section && styles.sectionOptionActive
                  ]}
                  onPress={() => {
                    setStallSection(section);
                    setShowSectionPicker(false);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                >
                  <Text style={[
                    styles.sectionOptionText,
                    stallSection === section && styles.sectionOptionTextActive
                  ]}>
                    {section}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
        
        {/* Stall Number */}
        <View style={styles.inputGroup}>
          <View style={styles.inputWrapper}>
            <Text style={styles.inputIcon}>🔢</Text>
            <TextInput
              style={styles.input}
              placeholder="Stall Number (e.g., 42, B-12)"
              placeholderTextColor="#9CA3AF"
              value={stallNumber}
              onChangeText={setStallNumber}
            />
          </View>
        </View>
        
        {/* Contact Number */}
        <View style={styles.inputGroup}>
          <View style={styles.inputWrapper}>
            <Text style={styles.inputIcon}>📞</Text>
            <TextInput
              style={styles.input}
              placeholder="Contact Number"
              placeholderTextColor="#9CA3AF"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
          </View>
        </View>

        {/* Document Uploads Section */}
        <View style={styles.documentsSection}>
          <Text style={styles.documentsSectionTitle}>📄 Required Documents</Text>
          <Text style={styles.documentsSectionSubtitle}>
            Please upload clear photos or PDFs of the following documents
          </Text>
          
          {/* Valid ID Upload */}
          <DocumentUpload
            label="Government Issued ID"
            icon="🆔"
            required={true}
            fileName={validIdName}
            file={validId}
            onUpload={() => pickImage('valid_id', setValidId, setValidIdName)}
          />
          
          {/* Business Permit Upload */}
          <DocumentUpload
            label="Business Permit / Mayor's Permit"
            icon="📜"
            required={true}
            fileName={businessPermitName}
            file={businessPermit}
            onUpload={() => pickDocument('business_permit', setBusinessPermit, setBusinessPermitName)}
          />
          
        </View>

        <View style={styles.requirementsNote}>
          <Text style={styles.requirementsNoteIcon}>ðŸ“‹</Text>
          <View style={styles.requirementsNoteContent}>
            <Text style={styles.requirementsNoteTitle}>Document Requirements</Text>
            <Text style={styles.requirementsNoteText}>
              â€¢ Valid Government ID (Driver's License, Passport, UMID, Postal ID,etc.){'\n'}
              â€¢ Business Permit or Mayor's Permit{'\n'}
              â€¢ Photo of your stall (to be submitted after approval)
            </Text>
          </View>
        </View>
        
        <View style={styles.privacyNote}>
          <Text style={styles.privacyNoteIcon}>🔒</Text>
          <Text style={styles.privacyNoteText}>
            Your documents are securely stored and will only be used for verification purposes.
          </Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Animated.View style={[styles.background, { opacity: fadeAnim }]}>
        <LinearGradient
          colors={['#FFF5F5', '#FFFFFF', '#FFF0F0']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.backgroundGradient}
        />
      </Animated.View>

      <ScrollView 
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo Section */}
        <Animated.View 
          style={[
            styles.headerSection,
            {
              transform: [{ scale: logoScale }],
              opacity: fadeAnim,
            }
          ]}
        >
          <LinearGradient
            colors={['#DC2626', '#EF4444', '#F87171']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.logoContainer}
          >
            <Image 
              source={require('../../../src/assets/palengkehublogo.jpg')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </LinearGradient>
          
          <Text style={styles.title}>PalengkeHub</Text>
          <Text style={styles.subtitle}>Create your account</Text>
        </Animated.View>

        {/* Form Section */}
        <Animated.View 
          style={[
            styles.formSection,
            {
              transform: [{ translateY: slideAnim }],
              opacity: fadeAnim,
            }
          ]}
        >
          <Text style={styles.welcomeText}>Get Started</Text>
          <Text style={styles.signInText}>Create your account to start shopping</Text>

          {/* Full Name Input */}
          <View style={styles.inputGroup}>
            <View style={styles.inputWrapper}>
              <Text style={styles.inputIcon}>👤</Text>
              <TextInput
                style={styles.input}
                placeholder="Full Name"
                placeholderTextColor="#9CA3AF"
                value={fullName}
                onChangeText={setFullName}
              />
            </View>
            {duplicateName && (
              <Text style={styles.errorText}>This name is already used for this email. Please use a different name.</Text>
            )}
          </View>

          {/* Email Input */}
          <View style={styles.inputGroup}>
            <Animated.View style={[styles.inputWrapper, emailValid && email.length > 0 && styles.inputValid]}>
              <Text style={[styles.inputIcon, emailValid && email.length > 0 && styles.inputIconValid]}>📧</Text>
              <TextInput
                style={styles.input}
                placeholder="Email Address"
                placeholderTextColor="#9CA3AF"
                value={email}
                onChangeText={validateEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              {emailValid && email.length > 0 && (
                <Text style={styles.checkIcon}>✓</Text>
              )}
            </Animated.View>
            {verificationMethod === 'email' && email.length > 0 && !emailValid && (
              <Text style={styles.errorText}>Please enter a valid email</Text>
            )}
            {/* Multi-account notice */}
            {emailValid && email.length > 0 && emailAccountCount > 0 && (
              <Text style={styles.infoText}>
                This email already has {emailAccountCount} account{emailAccountCount > 1 ? 's' : ''}. You can add up to {5 - emailAccountCount} more, each with a different name.
              </Text>
            )}
            {emailValid && email.length > 0 && emailAccountCount >= 5 && (
              <Text style={styles.errorText}>This email has reached the maximum of 5 accounts.</Text>
            )}
          </View>

          {/* Phone Input */}
          <View style={styles.inputGroup}>
            <View style={styles.inputWrapper}>
              <Text style={styles.inputIcon}>📞</Text>
              <TextInput
                style={styles.input}
                placeholder="Contact Number"
                placeholderTextColor="#9CA3AF"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />
            </View>
            {verificationMethod === 'sms' && phone.length > 0 && !isValidPhoneNumber(phone) && (
              <Text style={styles.errorText}>Enter a valid phone number including country code</Text>
            )}
          </View>

          {/* Verification method selection */}
          <View style={styles.verificationContainer}>
            <Text style={styles.verificationLabel}>Verify via</Text>
            <View style={styles.verificationButtons}>
              <TouchableOpacity
                style={[styles.verificationButton, verificationMethod === 'email' && styles.verificationButtonActive]}
                onPress={() => setVerificationMethod('email')}
                activeOpacity={0.8}
              >
                <Text style={[styles.verificationText, verificationMethod === 'email' && styles.verificationTextActive]}>📧 Email</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.verificationButton, verificationMethod === 'sms' && styles.verificationButtonActive]}
                onPress={() => setVerificationMethod('sms')}
                activeOpacity={0.8}
              >
                <Text style={[styles.verificationText, verificationMethod === 'sms' && styles.verificationTextActive]}>📱 Text Message</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.verificationHint}>{getVerificationHint()}</Text>
          </View>

          {/* Password Input */}
          <View style={styles.inputGroup}>
            <Animated.View style={[styles.inputWrapper, { transform: [{ translateX: shakeAnim }] }]}>
              <Text style={styles.inputIcon}>🔒</Text>
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor="#9CA3AF"
                value={password}
                onChangeText={checkPasswordStrength}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity 
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeButton}
              >
                <Text style={styles.eyeIcon}>
                  {showPassword ? '👁️' : '👁️‍🗨️'}
                </Text>
              </TouchableOpacity>
            </Animated.View>
            
            {password.length > 0 && (
              <View style={styles.strengthContainer}>
                <View style={styles.strengthBarContainer}>
                  {[1, 2, 3, 4, 5].map((level) => (
                    <View
                      key={level}
                      style={[
                        styles.strengthBar,
                        {
                          backgroundColor: level <= passwordStrength 
                            ? getPasswordStrengthColor() 
                            : '#E5E7EB',
                          width: `${100 / 5}%`,
                        }
                      ]}
                    />
                  ))}
                </View>
                <Text style={[styles.strengthText, { color: getPasswordStrengthColor() }]}>
                  {getPasswordStrengthText()} Password
                </Text>
              </View>
            )}
          </View>

          {/* Confirm Password Input */}
          <View style={styles.inputGroup}>
            <Animated.View style={[styles.inputWrapper, passwordsMatch && styles.inputValid]}>
              <Text style={styles.inputIcon}>✓</Text>
              <TextInput
                style={styles.input}
                placeholder="Confirm Password"
                placeholderTextColor="#9CA3AF"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
              />
              <TouchableOpacity 
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                style={styles.eyeButton}
              >
                <Text style={styles.eyeIcon}>
                  {showConfirmPassword ? '👁️' : '👁️‍🗨️'}
                </Text>
              </TouchableOpacity>
            </Animated.View>
            {confirmPassword.length > 0 && !passwordsMatch && (
              <Text style={styles.errorText}>Passwords do not match</Text>
            )}
            {passwordsMatch && confirmPassword.length > 0 && (
              <Text style={styles.successText}>✓ Passwords match</Text>
            )}
          </View>

          {/* Role Selection */}
          <View style={styles.roleContainer}>
            <Text style={styles.roleLabel}>I want to:</Text>
            <View style={styles.roleButtons}>
              <TouchableOpacity
                style={[styles.roleButton, role === 'consumer' && styles.roleButtonActive]}
                onPress={() => {
                  setRole('consumer');
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
              >
                <Text style={[styles.roleText, role === 'consumer' && styles.roleTextActive]}>
                  🛍️ Shop as Customer
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.roleButton, role === 'vendor' && styles.roleButtonActive]}
                onPress={() => {
                  setRole('vendor');
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
              >
                <Text style={[styles.roleText, role === 'vendor' && styles.roleTextActive]}>
                  🏪 Sell as Vendor
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Vendor-specific fields */}
          {renderVendorFields()}

          {/* ✅ Terms and Conditions Checkbox */}
          <View style={styles.termsContainer}>
            <TouchableOpacity
              style={styles.checkboxContainer}
              onPress={() => setTermsAccepted(!termsAccepted)}
            >
              <View style={[styles.checkbox, termsAccepted && styles.checkboxChecked]}>
                {termsAccepted && <Text style={styles.checkboxCheck}>✓</Text>}
              </View>
              <Text style={styles.termsTextSmall}>
                I agree to the{' '}
              </Text>
              <TouchableOpacity onPress={() => setShowTermsModal(true)}>
                <Text style={styles.termsLink}>Terms and Conditions</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </View>

          {/* Sign Up Button */}
          <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
            <TouchableOpacity 
              style={styles.signUpButton}
              onPress={handleSignUp}
              disabled={isLoading || signUpSuccess || uploading}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={signUpSuccess ? ['#10B981', '#059669'] : ['#DC2626', '#EF4444', '#F87171']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.signUpGradient}
              >
                {isLoading || uploading ? (
                  <ActivityIndicator color="white" />
                ) : signUpSuccess ? (
                  <Text style={styles.signUpButtonText}>✓ {role === 'vendor' ? 'Application Sent!' : 'Account Created!'}</Text>
                ) : (
                  <Text style={styles.signUpButtonText}>{role === 'vendor' ? 'Submit Application' : 'Create Account'}</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Guest Mode Button */}
          <TouchableOpacity 
            style={styles.guestButton}
            onPress={handleGuestMode}
            activeOpacity={0.7}
          >
            <Text style={styles.guestButtonIcon}>👋</Text>
            <View>
              <Text style={styles.guestButtonText}>Continue as Guest</Text>
              <Text style={styles.guestButtonSubtext}>Browse without an account</Text>
            </View>
          </TouchableOpacity>

          {/* Login Link */}
          <View style={styles.loginContainer}>
            <Text style={styles.loginText}>Already have an account? </Text>
            <TouchableOpacity 
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                navigation.navigate('Login');
              }}
            >
              <Text style={styles.loginLink}>Sign In</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </ScrollView>

      {/* OTP Verification Modal */}
      <OTPModal
        visible={otpModalVisible}
        title={otpMode === 'email' ? 'Email Verification' : 'SMS Verification'}
        recipient={otpMode === 'email' ? email : phone}
        recipientLabel={otpMode === 'email' ? 'your email address' : 'your phone number'}
        hintText={otpMode === 'email'
          ? '✉️ Check your inbox (and spam folder). The email may take a few seconds to arrive.'
          : '⏳ The SMS may take 30–60 seconds to arrive, depending on your network.'}
        digits={otpDigits}
        otpInputs={otpInputs}
        onDigitChange={handleOtpDigitChange}
        onKeyPress={handleOtpKeyPress}
        error={otpMode === 'email' ? emailSendError : smsSendError}
        sending={otpMode === 'email' ? emailSending : smsSending}
        onVerify={otpMode === 'email' ? handleVerifyEmailOtp : handleVerifyOtp}
        onResend={otpMode === 'email' ? handleSendEmailVerification : handleSendSmsVerification}
        onClose={handleOtpModalClose}
        resendCooldown={resendCooldown}
      />
      {/* Terms and Conditions Modal */}
      <TermsModal />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  background: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  backgroundGradient: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingBottom: 30,
  },
  headerSection: {
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 30,
  },
  logoContainer: {
    width: 110,
    height: 110,
    borderRadius: 55,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  logoImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#DC2626',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    letterSpacing: 0.5,
  },
  formSection: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 40,
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 5,
  },
  welcomeText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  signInText: {
    fontSize: 15,
    color: '#6B7280',
    marginBottom: 32,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    paddingHorizontal: 16,
  },
  inputValid: {
    borderColor: '#10B981',
    backgroundColor: '#F0FDF4',
  },
  inputIcon: {
    fontSize: 18,
    marginRight: 12,
  },
  inputIconValid: {
    color: '#10B981',
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 14,
    fontSize: 15,
    color: COLORS.text.dark,
    backgroundColor: COLORS.background,
  },
  placeholderText: {
    color: '#9CA3AF',
  },
  eyeButton: {
    padding: 8,
  },
  eyeIcon: {
    fontSize: 18,
    color: '#9CA3AF',
  },
  checkIcon: {
    fontSize: 16,
    color: '#10B981',
    fontWeight: 'bold',
    marginLeft: 8,
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 6,
    marginLeft: 4,
  },
  successText: {
    fontSize: 12,
    color: '#10B981',
    marginTop: 6,
    marginLeft: 4,
  },
  infoText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 6,
    marginLeft: 4,
  },
  strengthContainer: {
    marginTop: 8,
  },
  strengthBarContainer: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 4,
  },
  strengthBar: {
    height: 3,
    borderRadius: 2,
  },
  strengthText: {
    fontSize: 11,
    fontWeight: '500',
  },
  roleContainer: {
    marginBottom: 24,
  },
  roleLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  roleButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  roleButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  roleButtonActive: {
    backgroundColor: '#DC2626',
    borderColor: '#DC2626',
  },
  roleText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  roleTextActive: {
    color: 'white',
  },
  verificationContainer: {
    marginBottom: 20,
  },
  verificationLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  verificationButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  verificationButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  verificationButtonActive: {
    backgroundColor: '#DC2626',
    borderColor: '#DC2626',
  },
  verificationText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  verificationTextActive: {
    color: 'white',
  },
  verificationHint: {
    marginTop: 10,
    fontSize: 12,
    color: '#6B7280',
  },
  vendorSection: {
    marginTop: 8,
    marginBottom: 16,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  vendorSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  vendorSectionSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 16,
  },
  dropdownArrow: {
    fontSize: 12,
    color: '#9CA3AF',
    paddingLeft: 8,
  },
  sectionPicker: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginTop: 8,
    maxHeight: 200,
  },
  sectionOption: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  sectionOptionActive: {
    backgroundColor: COLORS.accentSoft,
  },
  sectionOptionText: {
    fontSize: 14,
    color: COLORS.text.medium,
  },
  sectionOptionTextActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  documentsSection: {
    marginTop: 16,
    marginBottom: 8,
  },
  documentsSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  documentsSectionSubtitle: {
    fontSize: 11,
    color: '#6B7280',
    marginBottom: 12,
  },
  documentUploadGroup: {
    marginBottom: 16,
  },
  documentLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 6,
  },
  requiredStar: {
    color: '#EF4444',
    marginRight: 4,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.background,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 14,
    borderStyle: 'dashed',
  },
  uploadButtonSuccess: {
    backgroundColor: '#F0FDF4',
    borderColor: COLORS.success,
    borderStyle: 'solid',
  },
  uploadIcon: {
    fontSize: 22,
  },
  uploadText: {
    fontSize: 14,
    color: '#6B7280',
    flex: 1,
  },
  uploadTextSuccess: {
    color: '#10B981',
    fontWeight: '500',
  },
  uploadErrorText: {
    fontSize: 11,
    color: '#EF4444',
    marginTop: 4,
    marginLeft: 4,
  },
  requirementsNote: {
    flexDirection: 'row',
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    marginBottom: 12,
  },
  requirementsNoteIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  requirementsNoteContent: {
    flex: 1,
  },
  requirementsNoteTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#92400E',
    marginBottom: 6,
  },
  requirementsNoteText: {
    fontSize: 11,
    color: '#78350F',
    lineHeight: 16,
  },
  privacyNote: {
    flexDirection: 'row',
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
  },
  privacyNoteIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  privacyNoteText: {
    flex: 1,
    fontSize: 10,
    color: '#3B82F6',
    lineHeight: 14,
  },
  signUpButton: {
    marginBottom: 24,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  signUpGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  signUpButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  dividerText: {
    marginHorizontal: 16,
    color: '#9CA3AF',
    fontSize: 13,
  },
  guestButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    borderWidth: 1.5,
    borderColor: '#EF4444',
    borderRadius: 16,
    paddingVertical: 14,
    marginBottom: 24,
    backgroundColor: 'white',
  },
  guestButtonIcon: {
    fontSize: 24,
  },
  guestButtonText: {
    color: '#EF4444',
    fontSize: 16,
    fontWeight: '600',
  },
  guestButtonSubtext: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 2,
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 8,
  },
  loginText: {
    fontSize: 14,
    color: '#6B7280',
  },
  loginLink: {
    fontSize: 14,
    color: '#EF4444',
    fontWeight: '600',
  },
  // ✅ Terms and Conditions Styles
  termsContainer: {
    marginBottom: 24,
    marginTop: 8,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#DC2626',
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  checkboxChecked: {
    backgroundColor: '#DC2626',
  },
  checkboxCheck: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  termsTextSmall: {
    fontSize: 13,
    color: '#6B7280',
  },
  termsLink: {
    fontSize: 13,
    color: '#DC2626',
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: '#DC2626',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  modalClose: {
    fontSize: 24,
    color: 'white',
    fontWeight: 'bold',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  termsText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#374151',
  },
  termsHeading: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#DC2626',
  },
  termsLastUpdated: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 30,
  },
  modalFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  otpInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#111827',
    marginTop: 12,
    marginBottom: 8,
    backgroundColor: '#F9FAFB',
  },
  otpBoxesRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
    marginBottom: 12,
    gap: 10,
  },
  otpBox: {
    width: 50,
    height: 50,
    borderWidth: 2,
    borderColor: COLORS.border,
    borderRadius: 14,
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.text.dark,
    backgroundColor: COLORS.surface,
    padding: 0,
    textAlign: 'center',
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },
  otpBoxFilled: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.accentSoft,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.15,
    elevation: 3,
  },
  otpButton: {
    marginTop: 12,
    backgroundColor: '#DC2626',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  otpButtonDisabled: {
    opacity: 0.6,
  },
  otpButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
  otpLinkButton: {
    marginTop: 12,
    alignItems: 'center',
  },
  otpLinkText: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '600',
  },
  otpErrorText: {
    color: '#B91C1C',
    marginTop: 8,
    fontSize: 13,
  },
  otpHintBox: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  otpHintText: {
    fontSize: 13,
    color: '#92400E',
    lineHeight: 18,
    textAlign: 'center',
  },
  otpLinkButtonDisabled: {
    opacity: 0.5,
  },
  modalAcceptButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  modalAcceptGradient: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalAcceptText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
