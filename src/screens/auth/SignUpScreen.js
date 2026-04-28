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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';

const { width, height } = Dimensions.get('window');

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

export const SignUpScreen = ({ setIsGuest }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('consumer');
  
  // Vendor-specific fields
  const [stallName, setStallName] = useState('');
  const [stallSection, setStallSection] = useState('');
  const [stallNumber, setStallNumber] = useState('');
  
  // Document uploads
  const [validId, setValidId] = useState(null);
  const [validIdName, setValidIdName] = useState('');
  const [businessPermit, setBusinessPermit] = useState(null);
  const [businessPermitName, setBusinessPermitName] = useState('');
  const [barangayClearance, setBarangayClearance] = useState(null);
  const [barangayClearanceName, setBarangayClearanceName] = useState('');
  
  const [uploading, setUploading] = useState(false);
  const [showSectionPicker, setShowSectionPicker] = useState(false);
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [emailValid, setEmailValid] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [passwordsMatch, setPasswordsMatch] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [signUpSuccess, setSignUpSuccess] = useState(false);
  const [shakeAnim] = useState(new Animated.Value(0));
  const [scaleAnim] = useState(new Animated.Value(1));
  const [logoScale] = useState(new Animated.Value(0));
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(50));
  
  const { signUp } = useAuth();
  const navigation = useNavigation();

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
    
    // Request permissions for image picker
    (async () => {
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Needed', 'Please grant gallery access to upload documents');
        }
      }
    })();
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
    const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text);
    setEmailValid(isValid);
    return isValid;
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
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
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
    // Basic validation
    if (!fullName || !email || !password || !confirmPassword) {
      shake();
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    
    if (!emailValid) {
      shake();
      Alert.alert('Error', 'Please enter a valid email address');
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
      // Upload documents if vendor
      let validIdUrl = null;
      let businessPermitUrl = null;
      let barangayClearanceUrl = null;
      
      if (role === 'vendor') {
        const timestamp = Date.now();
        const userId = `temp_${timestamp}`;
        
        validIdUrl = await uploadDocument(validId, `valid_ids/${userId}`);
        businessPermitUrl = await uploadDocument(businessPermit, `business_permits/${userId}`);
        if (barangayClearance) {
          barangayClearanceUrl = await uploadDocument(barangayClearance, `clearances/${userId}`);
        }
      }
      
      // Prepare vendor metadata with document URLs
      const metadata = role === 'vendor' ? {
        stall_name: stallName,
        stall_section: stallSection,
        stall_number: stallNumber,
        phone: phone,
        valid_id_url: validIdUrl,
        business_permit_url: businessPermitUrl,
        barangay_clearance_url: barangayClearanceUrl,
        requires_approval: true,
      } : { phone: phone };
      
      const result = await signUp(email, password, fullName, role, metadata);
      
      if (result.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setSignUpSuccess(true);
        
        let successMessage = result.message || 'Account created successfully! Please check your email to verify.';
        
        if (role === 'vendor') {
          successMessage = 'Vendor application submitted with documents! Your account will be reviewed by admin within 2-3 business days. You will receive an email once approved.';
        }
        
        setTimeout(() => {
          setSignUpSuccess(false);
          Alert.alert(
            role === 'vendor' ? 'Application Submitted!' : 'Success!',
            successMessage,
            [{ text: 'OK', onPress: () => navigation.navigate('Login') }]
          );
        }, 1500);
      } else {
        shake();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert('Sign Up Failed', result.error);
      }
    } catch (error) {
      console.error('Sign up error:', error);
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
          
          {/* Barangay Clearance (Optional but recommended) */}
          <DocumentUpload
            label="Barangay Clearance"
            icon="🏘️"
            required={false}
            fileName={barangayClearanceName}
            file={barangayClearance}
            onUpload={() => pickDocument('clearance', setBarangayClearance, setBarangayClearanceName)}
          />
        </View>
        
        <View style={styles.requirementsNote}>
          <Text style={styles.requirementsNoteIcon}>📋</Text>
          <View style={styles.requirementsNoteContent}>
            <Text style={styles.requirementsNoteTitle}>Document Requirements</Text>
            <Text style={styles.requirementsNoteText}>
              • Valid Government ID (Driver's License, Passport, UMID, Postal ID,etc.){'\n'}
              • Business Permit or Mayor's Permit{'\n'}
              • Barangay Clearance (Recommended for faster approval){'\n'}
              • Photo of your stall (to be submitted after approval)
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
            {email.length > 0 && !emailValid && (
              <Text style={styles.errorText}>Please enter a valid email</Text>
            )}
          </View>

          {/* Phone Input (optional for customers) */}
          {role === 'consumer' && (
            <View style={styles.inputGroup}>
              <View style={styles.inputWrapper}>
                <Text style={styles.inputIcon}>📞</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Contact Number (Optional)"
                  placeholderTextColor="#9CA3AF"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                />
              </View>
            </View>
          )}

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
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
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
    flex: 1,
    paddingVertical: 16,
    fontSize: 16,
    color: '#111827',
  },
  inputText: {
    color: '#111827',
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
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  sectionOptionActive: {
    backgroundColor: '#FEF3F2',
  },
  sectionOptionText: {
    fontSize: 14,
    color: '#374151',
  },
  sectionOptionTextActive: {
    color: '#DC2626',
    fontWeight: '600',
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
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 14,
    borderStyle: 'dashed',
  },
  uploadButtonSuccess: {
    backgroundColor: '#F0FDF4',
    borderColor: '#10B981',
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
    shadowColor: '#DC2626',
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
});