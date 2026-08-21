// src/screens/customer/ProfileScreen.js

import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  Image,
  ActivityIndicator,
  Modal,
  TextInput,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useI18n } from '../../contexts/i18nContext';
import { useTheme, useColors } from '../../contexts/ThemeContext';
import { useFavorites } from '../../hooks/useFavorites';
import { Header } from '../../components/Header';
import { supabase } from '../../../lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import { uploadImageToStorage } from '../../utils/imageUpload';
import { savePinWithCredentials, clearPin, hasSavedPin } from '../../services/pinService';

export default function ProfileScreen({ navigation }) {
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const { user, profile, logout, setIsGuest, isGuest, checkUser } = useAuth();
  const { t, locale, changeLanguage } = useI18n();
  const { themeMode, setTheme } = useTheme();
  const { getFavoriteCount } = useFavorites();
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const [removingPhoto, setRemovingPhoto] = useState(false);
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [ordersCount, setOrdersCount] = useState(0);
  const [ratingsCount, setRatingsCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  // ── PIN Login state ──
  const [showPinModal, setShowPinModal] = useState(false);
  const [hasPin, setHasPin] = useState(false);
  const [pinStep, setPinStep] = useState(0); // 0 = password check, 1 = new PIN, 2 = confirm
  const [pinIdentifier, setPinIdentifier] = useState('');
  const [pinPassword, setPinPassword] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinBusy, setPinBusy] = useState(false);
  const [pinSaved, setPinSaved] = useState(false);

  useEffect(() => {
    checkSavedPin();
    if (user) {
      fetchUserStats();
    }
  }, [user]);

  const checkSavedPin = async () => {
    setHasPin(await hasSavedPin());
  };

  const openPinModal = () => {
    setPinStep(0);
    setPinIdentifier(user?.email || profile?.phone || '');
    setPinPassword('');
    setNewPin('');
    setConfirmPin('');
    setPinError('');
    setPinSaved(false);
    setShowPinModal(true);
  };

  // Step 0 → verify the password against Supabase (so the PIN can sign in later)
  const handlePinVerifyCredentials = async () => {
    if (!pinIdentifier.trim() || !pinPassword) {
      setPinError('Ilagay ang email/phone at password mo.');
      return;
    }
    setPinBusy(true);
    setPinError('');
    try {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const credentials = emailRegex.test(pinIdentifier.trim())
        ? { email: pinIdentifier.trim() }
        : { phone: pinIdentifier.trim() };
      const { error } = await supabase.auth.signInWithPassword({
        ...credentials,
        password: pinPassword,
      });
      if (error) {
        setPinError('Maling password. Subukan muli.');
        setPinBusy(false);
        return;
      }
      setPinStep(1);
    } catch (e) {
      setPinError('Hindi ma-verify ang password. Subukan muli.');
    } finally {
      setPinBusy(false);
    }
  };

  const handlePinNext = () => {
    if (!/^\d{4}$/.test(newPin)) {
      setPinError('Ang PIN ay dapat 4 na numero.');
      return;
    }
    setPinError('');
    setPinStep(2);
  };

  const handlePinSave = async () => {
    if (confirmPin !== newPin) {
      setPinError('Hindi magkatugma ang PIN. Subukan muli.');
      return;
    }
    setPinBusy(true);
    setPinError('');
    await savePinWithCredentials(newPin, user?.id, pinIdentifier.trim(), pinPassword);
    setPinBusy(false);
    setHasPin(true);
    setPinSaved(true);
    setTimeout(() => setShowPinModal(false), 1200);
  };

  const handlePinRemove = async () => {
    await clearPin();
    setHasPin(false);
    setPinSaved(false);
    setShowPinModal(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await checkUser();
    await fetchUserStats();
    setRefreshing(false);
  };

  const fetchUserStats = async () => {
    try {
      const { count: orderCount } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('consumer_id', user.id);
      setOrdersCount(orderCount || 0);

      const { count: reviewCount } = await supabase
        .from('ratings')
        .select('*', { count: 'exact', head: true })
        .eq('consumer_id', user.id);
      setRatingsCount(reviewCount || 0);
    } catch (err) {
      console.warn('Error fetching user stats:', err);
    }
  };

  const uploadAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant gallery permissions to upload profile picture');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      setUploadingAvatar(true);
      try {
        const asset = result.assets[0];
        const uri = asset.uri;
        console.log('✅ Uploading avatar:', uri);

        const { url: avatarUrl } = await uploadImageToStorage({
          uri,
          folder: 'avatars',
          mimeType: asset.mimeType,
          fileAsset: asset.file, // Web only: real File/Blob
        });
        console.log('✅ Avatar uploaded:', avatarUrl);

        const { error } = await supabase
          .from('profiles')
          .update({ avatar_url: avatarUrl })
          .eq('id', user.id);

        if (error) throw error;

        await checkUser();
        setAvatarError(false);
        Alert.alert('Success', 'Profile picture updated!');
      } catch (error) {
        console.error('Upload error:', error);
        Alert.alert('Error', 'Failed to upload image. Please try again.');
      } finally {
        setUploadingAvatar(false);
      }
    }
  };

  // ✅ NEW: Remove Profile Photo Function
  const removeProfilePhoto = async () => {
    Alert.alert(
      'Remove Profile Photo',
      'Are you sure you want to remove your profile photo?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setRemovingPhoto(true);
            try {
              // Update profile in Supabase - set avatar_url to null
              const { error } = await supabase
                .from('profiles')
                .update({ avatar_url: null })
                .eq('id', user.id);
              
              if (error) throw error;
              
              // Refresh user profile
              await checkUser();
              setAvatarError(false);
              Alert.alert('Success', 'Profile photo removed successfully');
              
            } catch (error) {
              console.error('Remove photo error:', error);
              Alert.alert('Error', 'Failed to remove profile photo. Please try again.');
            } finally {
              setRemovingPhoto(false);
            }
          }
        }
      ]
    );
  };

  const handleLogout = async () => {
    if (Platform.OS === 'web') {
      const confirmLogout = window.confirm('Are you sure you want to logout?');
      if (confirmLogout) {
        console.log('🔴 Logging out...');
        await supabase.auth.signOut();
        window.location.href = '/';
      }
      return;
    }
    
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            const result = await logout();
            if (result.success) {
              navigation.reset({
                index: 0,
                routes: [{ name: 'Login' }],
              });
            } else {
              Alert.alert('Error', result.error);
            }
          }
        }
      ]
    );
  };

  const handleSwitchToGuest = () => {
    if (Platform.OS === 'web') {
      const confirmSwitch = window.confirm('Switch to Guest Mode? You will be logged out.');
      if (confirmSwitch) {
        supabase.auth.signOut();
        setIsGuest(true);
        window.location.href = '/';
      }
      return;
    }
    
    Alert.alert(
      'Switch to Guest Mode',
      'You will be logged out and continue as guest. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          onPress: () => {
            if (setIsGuest) {
              setIsGuest(true);
            }
          }
        }
      ]
    );
  };

  const handleSignIn = () => {
    if (setIsGuest) {
      setIsGuest(false);
    }
    if (Platform.OS === 'web') {
      window.location.href = '/';
    } else {
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    }
  };

  const handleSignUp = () => {
    if (setIsGuest) {
      setIsGuest(false);
    }
    navigation.navigate('SignUp');
  };

  // ========== GUEST MODE ==========
  if (isGuest) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Guest Avatar Section */}
          <View style={styles.avatarSection}>
            <LinearGradient
              colors={['#DC2626', '#EF4444', '#F87171']}
              style={styles.avatarGradient}
            >
              <Text style={styles.avatarEmoji}>👤</Text>
            </LinearGradient>
            <Text style={styles.guestName}>Guest User</Text>
            <Text style={styles.guestEmail}>browsing without account</Text>
            <View style={styles.guestBadge}>
              <Text style={styles.guestBadgeText}>Guest Mode</Text>
            </View>
          </View>

          {/* Benefits Section */}
          <View style={styles.benefitsCard}>
            <Text style={styles.benefitsTitle}>Sign in to unlock</Text>
            
            <View style={styles.benefitItem}>
              <View style={styles.benefitIconContainer}>
                <Ionicons name="cart-outline" size={22} color={COLORS.primary} />
              </View>
              <View style={styles.benefitContent}>
                <Text style={styles.benefitText}>Save your cart items</Text>
                <Text style={styles.benefitSubtext}>Items stay even after closing the app</Text>
              </View>
            </View>

            <View style={styles.benefitItem}>
              <View style={styles.benefitIconContainer}>
                <Ionicons name="cube-outline" size={22} color={COLORS.primary} />
              </View>
              <View style={styles.benefitContent}>
                <Text style={styles.benefitText}>Place orders</Text>
                <Text style={styles.benefitSubtext}>Order from any stall in the market</Text>
              </View>
            </View>

            <View style={styles.benefitItem}>
              <View style={styles.benefitIconContainer}>
                <Ionicons name="receipt-outline" size={22} color={COLORS.primary} />
              </View>
              <View style={styles.benefitContent}>
                <Text style={styles.benefitText}>View order history</Text>
                <Text style={styles.benefitSubtext}>Track all your past purchases</Text>
              </View>
            </View>

            <View style={styles.benefitItem}>
              <View style={styles.benefitIconContainer}>
                <Ionicons name="star-outline" size={22} color={COLORS.primary} />
              </View>
              <View style={styles.benefitContent}>
                <Text style={styles.benefitText}>Rate stalls</Text>
                <Text style={styles.benefitSubtext}>Share your experience with others</Text>
              </View>
            </View>

            <View style={styles.benefitItem}>
              <View style={styles.benefitIconContainer}>
                <Ionicons name="heart-outline" size={22} color={COLORS.primary} />
              </View>
              <View style={styles.benefitContent}>
                <Text style={styles.benefitText}>Save favorite stalls</Text>
                <Text style={styles.benefitSubtext}>Quick access to your preferred vendors</Text>
              </View>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionSection}>
            <TouchableOpacity 
              style={styles.signInButton}
              onPress={handleSignIn}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#DC2626', '#EF4444']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.signInGradient}
              >
                <Text style={styles.signInButtonText}>Sign In</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.signUpButton}
              onPress={handleSignUp}
              activeOpacity={0.7}
            >
              <Text style={styles.signUpButtonText}>Create Account</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

      // ========== LOGGED IN USER ==========
  const hasProfilePhoto = profile?.avatar_url && !avatarError;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* User Avatar Section with Upload */}
        <View style={styles.avatarSection}>
          <TouchableOpacity onPress={uploadAvatar} disabled={uploadingAvatar} style={styles.avatarContainer}>
            {uploadingAvatar ? (
              <View style={styles.avatarGradient}>
                <ActivityIndicator size="large" color="white" />
              </View>
            ) : hasProfilePhoto ? (
              <Image 
                source={{ uri: profile.avatar_url }} 
                style={styles.avatarImage}
                onError={() => setAvatarError(true)}
              />
            ) : (
              <LinearGradient
                colors={['#DC2626', '#EF4444', '#F87171']}
                style={styles.avatarGradient}
              >
                {profile?.full_name ? (
                  <Text style={styles.avatarEmoji}>
                    {profile.full_name.charAt(0).toUpperCase()}
                  </Text>
                ) : (
                  <Ionicons name="person" size={28} color="#FFFFFF" />
                )}
              </LinearGradient>
            )}
            <View style={styles.editAvatarBadge}>
              <Ionicons name="camera" size={14} color="#FFFFFF" />
            </View>
          </TouchableOpacity>
          
          <Text style={styles.userName}>{profile?.full_name || user?.email?.split('@')[0]}</Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>
              {profile?.role === 'vendor' ? 'Vendor' : 'Shopper'}
            </Text>
          </View>

          {/* ✅ REMOVED: The duplicate "Change Profile Photo" text button */}
          {/* ✅ ADDED: "Remove Photo" button - only shows when user has a profile photo */}
          {hasProfilePhoto && (
            <TouchableOpacity 
              style={styles.removePhotoBtn}
              onPress={removeProfilePhoto}
              disabled={removingPhoto}
              activeOpacity={0.7}
            >
              <Ionicons name="trash-outline" size={16} color={COLORS.primary} />
              <Text style={styles.removePhotoBtnText}>
                {removingPhoto ? 'Removing...' : 'Remove Photo'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Stats Section */}
        <View style={styles.statsCard}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{ordersCount}</Text>
            <Text style={styles.statLabel}>{t('profile.orders')}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{ratingsCount}</Text>
            <Text style={styles.statLabel}>{t('profile.ratings')}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{getFavoriteCount()}</Text>
            <Text style={styles.statLabel}>{t('profile.favorites_count')}</Text>
          </View>
        </View>

        {/* Account Information */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Account Information</Text>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue}>{user?.email}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Full Name</Text>
            <Text style={styles.infoValue}>{profile?.full_name || 'Not set'}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Phone</Text>
            <Text style={styles.infoValue}>{profile?.phone || 'Not set'}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Member Since</Text>
            <Text style={styles.infoValue}>
              {profile?.created_at 
                ? new Date(profile.created_at).toLocaleDateString() 
                : 'Recently'}
            </Text>
          </View>
        </View>

        {/* Menu Items */}
        <View style={styles.menuSection}>
          <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Favorites')}>
            <Ionicons name="heart-outline" size={22} color={COLORS.primary} />
            <Text style={styles.menuItemText}>{t('favorites.title')}</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Orders')}>
            <Ionicons name="receipt-outline" size={22} color={COLORS.primary} />
            <Text style={styles.menuItemText}>{t('orders.title')}</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>

          {/* Theme Selector */}
          <TouchableOpacity style={styles.menuItem} onPress={() => setShowThemePicker(true)}>
            <Ionicons name={themeMode === 'dark' ? 'moon-outline' : 'sunny-outline'} size={22} color={COLORS.primary} />
            <Text style={styles.menuItemText}>Theme</Text>
            <Text style={styles.languageValue}>
              {themeMode === 'light' ? 'Light' : themeMode === 'dark' ? 'Dark' : 'System'}
            </Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>

          {/* Language Selector */}
          <TouchableOpacity style={styles.menuItem} onPress={() => setShowLanguagePicker(true)}>
            <Ionicons name="globe-outline" size={22} color={COLORS.primary} />
            <Text style={styles.menuItemText}>{t('profile.language')}</Text>
            <Text style={styles.languageValue}>{locale === 'en' ? 'English' : 'Filipino'}</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>

          {/* PIN Login */}
          <TouchableOpacity style={styles.menuItem} onPress={openPinModal}>
            <Ionicons name="keypad-outline" size={22} color={COLORS.primary} />
            <Text style={styles.menuItemText}>PIN Login</Text>
            <Text style={styles.languageValue}>{hasPin ? 'Naka-on' : 'Naka-off'}</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <Ionicons name="location-outline" size={22} color={COLORS.primary} />
            <Text style={styles.menuItemText}>Saved Addresses</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <Ionicons name="help-circle-outline" size={22} color={COLORS.primary} />
            <Text style={styles.menuItemText}>Help & Support</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <Ionicons name="lock-closed-outline" size={22} color={COLORS.primary} />
            <Text style={styles.menuItemText}>Privacy Policy</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Vendor Dashboard Button (only for vendors) */}
        {profile?.role === 'vendor' && (
          <TouchableOpacity 
            style={styles.vendorButton}
            onPress={() => navigation.navigate('VendorDashboard')}
          >
            <LinearGradient
              colors={['#DC2626', '#EF4444']}
              style={styles.vendorGradient}
            >
              <Text style={styles.vendorButtonText}>Open Vendor Dashboard →</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Switch to Guest Button */}
        <TouchableOpacity style={styles.switchGuestButton} onPress={handleSwitchToGuest}>
          <Text style={styles.switchGuestText}>Switch to Guest Mode</Text>
        </TouchableOpacity>

        {/* LOGOUT BUTTON */}
        {Platform.OS === 'web' ? (
          <button
            onClick={async () => {
              console.log('🔴 Logout button clicked on web');
              const confirmLogout = window.confirm('Are you sure you want to logout?');
              if (confirmLogout) {
                console.log('🔴 User confirmed, signing out...');
                try {
                  const { error } = await supabase.auth.signOut();
                  if (error) console.error('SignOut error:', error);
                  console.log('🔴 SignOut complete, redirecting to login...');
                  window.location.href = '/';
                } catch (err) {
                  console.error('Error during logout:', err);
                  window.location.href = '/';
                }
              }
            }}
            style={{
              backgroundColor: '#DC2626',
              color: 'white',
              padding: '14px 20px',
              borderRadius: '12px',
              border: 'none',
              cursor: 'pointer',
              width: '100%',
              fontSize: '16px',
              fontWeight: '600',
              marginTop: '16px',
              marginBottom: '30px',
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}
          >
            Logout
          </button>
        ) : (
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <LinearGradient
              colors={['#DC2626', '#EF4444']}
              style={styles.logoutGradient}
            >
              <Text style={styles.logoutButtonText}>Logout</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
        {/* VERSION LABEL */}
        <View style={styles.versionContainer}>
          <Text style={styles.versionText}>PalengkeHub v1.0.8 (build 9)</Text>
        </View>
      </ScrollView>

      {/* Theme Picker Modal */}
      <Modal visible={showThemePicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Choose Theme</Text>
            <TouchableOpacity
              style={[styles.langOption, themeMode === 'light' && styles.langOptionActive]}
              onPress={() => { setTheme('light'); setShowThemePicker(false); }}
            >
              <Text style={styles.langOptionText}>Light</Text>
              {themeMode === 'light' && <Text style={styles.langCheck}>✓</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.langOption, themeMode === 'dark' && styles.langOptionActive]}
              onPress={() => { setTheme('dark'); setShowThemePicker(false); }}
            >
              <Text style={styles.langOptionText}>Dark</Text>
              {themeMode === 'dark' && <Text style={styles.langCheck}>✓</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.langOption, themeMode === 'system' && styles.langOptionActive]}
              onPress={() => { setTheme('system'); setShowThemePicker(false); }}
            >
              <Text style={styles.langOptionText}>System Default</Text>
              {themeMode === 'system' && <Text style={styles.langCheck}>✓</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.langCancelBtn}
              onPress={() => setShowThemePicker(false)}
            >
              <Text style={styles.langCancelText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Language Picker Modal */}
      <Modal visible={showLanguagePicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('profile.select_language')}</Text>
            <TouchableOpacity
              style={[styles.langOption, locale === 'en' && styles.langOptionActive]}
              onPress={() => { changeLanguage('en'); setShowLanguagePicker(false); }}
            >
              <Text style={styles.langOptionText}>English</Text>
              {locale === 'en' && <Text style={styles.langCheck}>✓</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.langOption, locale === 'fil' && styles.langOptionActive]}
              onPress={() => { changeLanguage('fil'); setShowLanguagePicker(false); }}
            >
              <Text style={styles.langOptionText}>Filipino</Text>
              {locale === 'fil' && <Text style={styles.langCheck}>✓</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.langCancelBtn}
              onPress={() => setShowLanguagePicker(false)}
            >
              <Text style={styles.langCancelText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      {/* PIN Login Setup Modal */}
      <Modal visible={showPinModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>PIN Login</Text>

            {pinSaved ? (
              <>
                <Text style={styles.pinHint}>
                  ✓ Naka-enable na! Sa susunod, PIN na lang ang kailangan para makapasok.
                </Text>
              </>
            ) : pinStep === 0 ? (
              <>
                <Text style={styles.pinHint}>
                  Para sa seguridad, ilagay ang email/phone at password mo. Ise-save ito
                  sa device na ito (naka-encrypt) para makapasok ka gamit ang PIN.
                </Text>
                <TextInput
                  style={styles.pinInput}
                  placeholder="Email o phone"
                  placeholderTextColor={COLORS.text.lighter}
                  value={pinIdentifier}
                  onChangeText={(v) => { setPinIdentifier(v); setPinError(''); }}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
                <TextInput
                  style={styles.pinInput}
                  placeholder="Password"
                  placeholderTextColor={COLORS.text.lighter}
                  value={pinPassword}
                  onChangeText={(v) => { setPinPassword(v); setPinError(''); }}
                  secureTextEntry
                />
                {pinError ? <Text style={styles.pinError}>{pinError}</Text> : null}
                {hasPin && (
                  <TouchableOpacity style={styles.langCancelBtn} onPress={handlePinRemove}>
                    <Text style={[styles.langCancelText, { color: COLORS.error, fontWeight: '600' }]}>Tanggalin ang PIN</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.langOption, (pinIdentifier.trim() && pinPassword) ? styles.langOptionActive : null]}
                  onPress={handlePinVerifyCredentials}
                  disabled={pinBusy}
                >
                  <Text style={styles.langOptionText}>{pinBusy ? 'Nagve-verify...' : 'I-verify →'}</Text>
                </TouchableOpacity>
              </>
            ) : pinStep === 1 ? (
              <>
                <Text style={styles.pinHint}>
                  Maglagay ng bagong 4-digit na PIN.
                </Text>
                <TextInput
                  style={styles.pinInput}
                  placeholder="● ● ● ●"
                  placeholderTextColor={COLORS.text.lighter}
                  value={newPin}
                  onChangeText={(v) => { setNewPin(v.replace(/\D/g, '').slice(0, 4)); setPinError(''); }}
                  keyboardType="number-pad"
                  maxLength={4}
                  secureTextEntry
                />
                {pinError ? <Text style={styles.pinError}>{pinError}</Text> : null}
                <TouchableOpacity
                  style={[styles.langOption, newPin.length === 4 && styles.langOptionActive]}
                  onPress={handlePinNext}
                >
                  <Text style={styles.langOptionText}>Susunod →</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.langCancelBtn} onPress={() => setPinStep(0)}>
                  <Text style={styles.langCancelText}>Bumalik</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.pinHint}>
                  Ulitin ang PIN para kumpirmahin.
                </Text>
                <TextInput
                  style={styles.pinInput}
                  placeholder="● ● ● ● (ulitin)"
                  placeholderTextColor={COLORS.text.lighter}
                  value={confirmPin}
                  onChangeText={(v) => { setConfirmPin(v.replace(/\D/g, '').slice(0, 4)); setPinError(''); }}
                  keyboardType="number-pad"
                  maxLength={4}
                  secureTextEntry
                />
                {pinError ? <Text style={styles.pinError}>{pinError}</Text> : null}
                <TouchableOpacity
                  style={[styles.langOption, confirmPin.length === 4 && styles.langOptionActive]}
                  onPress={handlePinSave}
                  disabled={pinBusy}
                >
                  <Text style={styles.langOptionText}>{pinBusy ? 'Nagse-save...' : 'I-save ang PIN'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.langCancelBtn} onPress={() => setPinStep(1)}>
                  <Text style={styles.langCancelText}>Bumalik</Text>
                </TouchableOpacity>
              </>
            )}

            {!pinSaved && (
              <TouchableOpacity style={styles.langCancelBtn} onPress={() => setShowPinModal(false)}>
                <Text style={styles.langCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (COLORS) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 30 },
  avatarSection: { alignItems: 'center', marginTop: 20, marginBottom: 20 },
  avatarContainer: { position: 'relative', marginBottom: 16 },
  avatarGradient: {
    width: 100, height: 100, borderRadius: 50, justifyContent: 'center', alignItems: 'center',
    shadowColor: '#DC2626', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5,
  },
  avatarImage: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: '#DC2626' },
  avatarEmoji: { fontSize: 48 },
  editAvatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: COLORS.primary,
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
    shadowColor: COLORS.shadowDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },
  editAvatarBadgeText: {
    fontSize: 16,
  },
  // ✅ NEW STYLES: Remove Photo Button
  removePhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: COLORS.accentSoft,
    borderWidth: 1,
    borderColor: COLORS.accentLight,
  },
  removePhotoBtnText: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '600',
  },
  guestName: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.text.dark,
    marginBottom: 4,
  },
  guestEmail: {
    fontSize: 14,
    color: COLORS.text.medium,
    marginBottom: 12,
  },
  guestBadge: {
    backgroundColor: COLORS.accentSoft,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  guestBadgeText: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '600',
  },
  userName: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.text.dark,
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: COLORS.text.medium,
    marginBottom: 12,
  },
  roleBadge: {
    backgroundColor: COLORS.accentSoft,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  roleText: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '600',
  },
  benefitsCard: {
    backgroundColor: COLORS.surface, marginHorizontal: 16, marginBottom: 20, padding: 20, borderRadius: 20,
    shadowColor: COLORS.shadow, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 8, elevation: 3,
    borderWidth: 1, borderColor: COLORS.borderLight,
  },
  benefitsTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text.dark, marginBottom: 20, textAlign: 'center' },
  benefitItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  benefitIconContainer: {
    width: 48, height: 48, backgroundColor: COLORS.accentSoft, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginRight: 16,
  },
  benefitIcon: { fontSize: 24 },
  benefitContent: { flex: 1 },
  benefitText: { fontSize: 16, fontWeight: '700', color: COLORS.text.dark, marginBottom: 2 },
  benefitSubtext: { fontSize: 13, color: COLORS.text.medium },
  actionSection: { marginHorizontal: 16, marginBottom: 30 },
  signInButton: { borderRadius: 16, overflow: 'hidden', marginBottom: 12, shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  signInGradient: { paddingVertical: 16, alignItems: 'center' },
  signInButtonText: { color: 'white', fontSize: 16, fontWeight: '700' },
  signUpButton: { paddingVertical: 16, borderRadius: 16, alignItems: 'center', borderWidth: 1.5, borderColor: COLORS.primary, backgroundColor: COLORS.surface },
  signUpButtonText: { color: COLORS.primary, fontSize: 16, fontWeight: '700' },
  statsCard: {
    flexDirection: 'row', backgroundColor: COLORS.surface, marginHorizontal: 16, marginBottom: 20, padding: 16, borderRadius: 20,
    shadowColor: COLORS.shadow, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 8, elevation: 3,
    borderWidth: 1, borderColor: COLORS.borderLight,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statNumber: { fontSize: 24, fontWeight: '800', color: COLORS.primary, marginBottom: 4 },
  statLabel: { fontSize: 12, color: COLORS.text.medium },
  statDivider: { width: 1, backgroundColor: COLORS.border, marginHorizontal: 8 },
  infoCard: {
    backgroundColor: COLORS.surface, marginHorizontal: 16, marginBottom: 20, padding: 20, borderRadius: 20,
    shadowColor: COLORS.shadow, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 8, elevation: 3,
    borderWidth: 1, borderColor: COLORS.borderLight,
  },
  infoTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text.dark, marginBottom: 16 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  infoLabel: { fontSize: 14, color: COLORS.text.medium },
  infoValue: { fontSize: 14, color: COLORS.text.dark, fontWeight: '600' },
  vendorButton: { marginHorizontal: 16, marginBottom: 16, borderRadius: 16, overflow: 'hidden', shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  vendorGradient: { paddingVertical: 14, alignItems: 'center' },
  vendorButtonText: { color: 'white', fontSize: 16, fontWeight: '700' },
  switchGuestButton: { marginHorizontal: 16, marginBottom: 12, paddingVertical: 14, borderRadius: 16, alignItems: 'center', borderWidth: 1.5, borderColor: COLORS.primary, backgroundColor: COLORS.surface },
  switchGuestText: { color: COLORS.primary, fontSize: 16, fontWeight: '700' },
  logoutButton: { marginHorizontal: 16, marginBottom: 30, borderRadius: 16, overflow: 'hidden', shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  logoutGradient: { paddingVertical: 14, alignItems: 'center' },
  logoutButtonText: { color: 'white', fontSize: 16, fontWeight: '700' },
  versionContainer: {
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 24,
  },
  versionText: {
    fontSize: 12,
    color: COLORS.text.lighter,
    letterSpacing: 0.3,
  },
  // Menu styles
  menuSection: { backgroundColor: COLORS.surface, marginHorizontal: 16, marginBottom: 20, borderRadius: 20, overflow: 'hidden' },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
  },
  menuItemIcon: { fontSize: 20, width: 28, textAlign: 'center' },
  menuItemText: { flex: 1, marginLeft: 14, fontSize: 15, color: COLORS.text.dark },
  languageValue: { fontSize: 13, color: COLORS.success, fontWeight: '600', marginRight: 8 },
  chevron: { fontSize: 20, color: COLORS.text.lighter },
  // Modal styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: COLORS.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: '600', marginBottom: 16 },
  langOption: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16,
    borderRadius: 12, marginBottom: 8, backgroundColor: COLORS.surfaceSecondary,
  },
  langOptionActive: { backgroundColor: COLORS.successLight, borderWidth: 1, borderColor: COLORS.success },
  langOptionText: { fontSize: 16, fontWeight: '500' },
  langCheck: { fontSize: 18, color: COLORS.success, fontWeight: '700' },
  langCancelBtn: { padding: 14, alignItems: 'center', marginTop: 8 },
  langCancelText: { color: COLORS.text.light, fontSize: 15 },
  pinHint: { fontSize: 13, color: COLORS.text.light, marginBottom: 12, lineHeight: 19 },
  pinInput: {
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 22,
    letterSpacing: 8,
    textAlign: 'center',
    color: COLORS.text.dark,
    marginBottom: 8,
  },
  pinError: { color: COLORS.error, fontSize: 13, marginBottom: 8, fontWeight: '600' },
});