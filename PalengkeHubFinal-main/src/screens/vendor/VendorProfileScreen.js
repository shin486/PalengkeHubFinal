// src/screens/vendor/VendorProfileScreen.js

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
  Platform,
  RefreshControl,
  TextInput,
  Modal,
  Dimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons, MaterialIcons, Feather } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { supabase } from '../../../lib/supabase';
import { Header } from '../../components/Header';
import { useAuth, SIGNED_URL_TTL_SECONDS } from '../../contexts/AuthContext';
import { useColors, useTheme } from '../../contexts/ThemeContext';
import { useI18n } from '../../contexts/i18nContext';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode as decodeBase64 } from 'base64-arraybuffer';
import { hapticLight, hapticSuccess } from '../../theme/motion';
import { savePinWithCredentials, clearPin, hasSavedPin } from '../../services/pinService';
import { SPACING, RADIUS, TEXT_STYLES } from '../../theme/tokens';
import { WovenBackground } from '../../components/WovenBackground';
import { ThemeToggle } from '../../components/ThemeToggle';
import StallLocationCapture from '../../components/vendor/StallLocationCapture';
import { fetchCurrentStallLocation } from '../../services/stallLocationService';

// ============================================================
// COLORS - Theme-aware (from ThemeContext)
// ============================================================


// ============================================================
// MAIN COMPONENT
// ============================================================
export default function VendorProfileScreen({ navigation }) {
  const { user, profile, logout, resetToLogin, checkUser } = useAuth();
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const [stall, setStall] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showLocationCapture, setShowLocationCapture] = useState(false);
  const [stallLocation, setStallLocation] = useState(null); // current stall_locations row, or null if never captured
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Editable fields
  const [stallName, setStallName] = useState('');
  const [section, setSection] = useState('');
  const [locationNotes, setLocationNotes] = useState('');
  const [description, setDescription] = useState('');
  
  // UI states
  const [editModalVisible, setEditModalVisible] = useState(false);
    const [editingField, setEditingField] = useState(null);

  // ── Settings: theme / language / PIN login ──
  const { isDark } = useTheme();
  const { locale, changeLanguage } = useI18n();
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);
  const [hasPin, setHasPin] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinStep, setPinStep] = useState(0); // 0 verify password, 1 enter PIN, 2 confirm
  const [pinIdentifier, setPinIdentifier] = useState('');
  const [pinPassword, setPinPassword] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinBusy, setPinBusy] = useState(false);
  const [pinSaved, setPinSaved] = useState(false);

  useEffect(() => {
    (async () => setHasPin(await hasSavedPin()))();
  }, []);

  // ── Change Profile Photo ──
  // Mirrors the customer ProfileScreen flow: pick → Supabase Storage upload →
  // profiles.avatar_url update → AuthContext refresh.
  const uploadAvatar = async () => {
    hapticLight();
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

        // Determine file extension
        const ext = asset.fileName?.split('.').pop() || (asset.mimeType === 'image/png' ? 'png' : 'jpg');
        const fileName = asset.fileName || `avatar_${Date.now()}.${ext}`;
        const contentType = asset.mimeType || (ext === 'png' ? 'image/png' : 'image/jpeg');

        // fetch(uri).blob() is unreliable on Android for the content://
        // URIs the image picker can return — it fails silently for some
        // pickers/OS versions. Reading the file as base64 and decoding to
        // an ArrayBuffer works consistently on both platforms. expo-file-system
        // has no web implementation of readAsStringAsync at all, so this
        // never resolved on web — same fix as AddProductModal/AuthContext.
        let fileData;
        if (Platform.OS === 'web') {
          const response = await fetch(uri);
          fileData = await response.blob();
        } else {
          const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
          fileData = decodeBase64(base64);
        }
        const path = `avatars/${user.id}/${Date.now()}_${fileName}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('vendor_documents')
          .upload(path, fileData, { cacheControl: '3600', upsert: true, contentType });
        if (uploadError) throw uploadError;

        // vendor_documents is a private bucket — a long-lived signed URL
        // is used since getPublicUrl() 400s for any request without an
        // auth header (which a plain <Image> tag never sends).
        const { data: urlData, error: signError } = await supabase.storage
          .from('vendor_documents')
          .createSignedUrl(uploadData.path, SIGNED_URL_TTL_SECONDS);
        if (signError) throw signError;
        const avatarUrl = urlData.signedUrl;

        const { error } = await supabase
          .from('profiles')
          .update({ avatar_url: avatarUrl })
          .eq('id', user.id);

        if (error) throw error;

        await checkUser();
        hapticSuccess();
        Alert.alert('Success', 'Profile picture updated!');
      } catch (error) {
        console.error('Upload error:', error);
        Alert.alert('Error', 'Failed to upload profile picture. Please try again.');
      } finally {
        setUploadingAvatar(false);
      }
    }
  };

  const fetchStall = useCallback(async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('stalls')
        .select('*')
        .eq('vendor_id', user.id)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      setStall(data);

      // Initialize editable fields
      if (data) {
        setStallName(data.stall_name || '');
        setSection(data.section || '');
        setLocationNotes(data.location_notes || '');
        setDescription(data.description || '');
        try {
          setStallLocation(await fetchCurrentStallLocation(data.id));
        } catch (locError) {
          console.warn('Error fetching stall location:', locError.message);
        }
      }
    } catch (error) {
      console.error('Error fetching stall:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      fetchStall();
    }, [fetchStall])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchStall();
  };

    // ============================================================
  // SETTINGS HANDLERS (theme, language, PIN login)
  // ============================================================
  const startPinSetup = () => {
    setPinStep(0);
    setPinIdentifier(user?.email || profile?.phone || '');
    setPinPassword('');
    setNewPin('');
    setConfirmPin('');
    setPinError('');
    setPinSaved(false);
    setShowPinModal(true);
  };

  const openPinModal = () => {
    if (hasPin) {
      Alert.alert(
        'PIN Login',
        'PIN login is enabled. What would you like to do?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Remove PIN', style: 'destructive', onPress: async () => { await clearPin(); setHasPin(false); } },
          { text: 'Change PIN', onPress: startPinSetup },
        ]
      );
      return;
    }
    startPinSetup();
  };

  const handlePinVerifyCredentials = async () => {
    if (!pinIdentifier.trim() || !pinPassword) {
      setPinError('Please enter your email/phone and password.');
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
        setPinError('Wrong password. Please try again.');
        setPinBusy(false);
        return;
      }
      setPinStep(1);
    } catch (e) {
      setPinError('Could not verify password. Please try again.');
    } finally {
      setPinBusy(false);
    }
  };

  const handlePinNext = () => {
    if (!/^\d{4}$/.test(newPin)) {
      setPinError('PIN must be exactly 4 digits.');
      return;
    }
    setPinError('');
    setPinStep(2);
  };

  const handlePinSave = async () => {
    if (confirmPin !== newPin) {
      setPinError('PINs do not match. Please try again.');
      return;
    }
    setPinBusy(true);
    setPinError('');
    await savePinWithCredentials(newPin, user?.id, pinIdentifier.trim(), pinPassword);
    setPinBusy(false);
    setHasPin(true);
    setPinSaved(true);
    setTimeout(() => { setShowPinModal(false); setPinSaved(false); }, 1200);
  };

  const handleLogout = async () => {
    // react-native-web does NOT implement Alert.alert — use window.confirm on web
    if (Platform.OS === 'web') {
      const confirmLogout = window.confirm('Are you sure you want to logout?');
      if (!confirmLogout) return;
      console.log(' Vendor logging out (web)...');
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.error('Error during logout:', err);
      }
      window.location.href = '/';
      return;
    }

    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          const result = await logout();
          if (result.success) {
            resetToLogin();
          } else {
            Alert.alert('Error', result.error || 'Failed to logout');
          }
        }
      }
    ]);
  };

  // ============================================================
  // UPDATE STALL FUNCTION
  // ============================================================
  const updateStall = async (field, value) => {
    if (!stall?.id) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('stalls')
        .update({ [field]: value })
        .eq('id', stall.id);
      
      if (error) throw error;
      
      // Update local state
      setStall(prev => ({ ...prev, [field]: value }));
      
      Alert.alert('Success', `${field.replace('_', ' ')} updated successfully!`);
    } catch (error) {
      console.error('Error updating stall:', error);
      Alert.alert('Error', 'Failed to update stall information. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // ============================================================
  // OPEN EDIT MODAL
  // ============================================================
  const openEditModal = (field, currentValue, label) => {
    setEditingField({
      field,
      value: currentValue,
      label,
    });
    setEditModalVisible(true);
  };

  // ============================================================
  // SAVE EDITED FIELD
  // ============================================================
  const saveEditedField = async () => {
    if (!editingField) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('stalls')
        .update({ [editingField.field]: editingField.value })
        .eq('id', stall.id);
      
      if (error) throw error;
      
      // Update local state
      setStall(prev => ({ ...prev, [editingField.field]: editingField.value }));
      
      // Update individual state variables
      if (editingField.field === 'stall_name') setStallName(editingField.value);
      if (editingField.field === 'section') setSection(editingField.value);
      if (editingField.field === 'location_notes') setLocationNotes(editingField.value);
      if (editingField.field === 'description') setDescription(editingField.value);
      
      setEditModalVisible(false);
      setEditingField(null);
      Alert.alert('Success', 'Stall information updated successfully!');
    } catch (error) {
      console.error('Error updating stall:', error);
      Alert.alert('Error', 'Failed to update stall information. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // ============================================================
  // RENDER EDIT MODAL
  // ============================================================
  const renderEditModal = () => (
    <Modal
      visible={editModalVisible}
      transparent={true}
      animationType="fade"
      onRequestClose={() => {
        setEditModalVisible(false);
        setEditingField(null);
      }}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              Edit {editingField?.label || 'Field'}
            </Text>
            <TouchableOpacity
              onPress={() => {
                setEditModalVisible(false);
                setEditingField(null);
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={24} color={COLORS.text.dark} />
            </TouchableOpacity>
          </View>
          
          <TextInput
            style={styles.modalInput}
            value={editingField?.value || ''}
            onChangeText={(text) => {
              setEditingField(prev => prev ? { ...prev, value: text } : null);
            }}
            placeholder={`Enter ${editingField?.label?.toLowerCase() || 'value'}`}
            placeholderTextColor={COLORS.text.lighter}
            multiline={editingField?.field === 'location_notes' || editingField?.field === 'description'}
            numberOfLines={editingField?.field === 'location_notes' || editingField?.field === 'description' ? 4 : 1}
          />
          
          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={[styles.modalButton, styles.modalCancelButton]}
              onPress={() => {
                setEditModalVisible(false);
                setEditingField(null);
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.modalButton, styles.modalSaveButton]}
              onPress={saveEditedField}
              disabled={saving}
              activeOpacity={0.7}
            >
              {saving ? (
                <ActivityIndicator size="small" color={COLORS.text.inverse} />
              ) : (
                <Text style={styles.modalSaveText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );


  // ============================================================
  // INFO ROW COMPONENT
  // ============================================================
  const InfoRow = ({ label, value, icon, editable = false, onPress, iconColor = COLORS.primary }) => (
    <TouchableOpacity
      style={styles.infoRow}
      onPress={onPress}
      activeOpacity={editable ? 0.7 : 1}
      disabled={!editable}
    >
      <View style={styles.infoRowLeft}>
        <View style={[styles.infoIconContainer, { backgroundColor: COLORS.primarySurface }]}>
          <Ionicons name={icon} size={20} color={iconColor} />
        </View>
        <View style={styles.infoContent}>
          <Text style={styles.infoLabel}>{label}</Text>
          <Text style={[styles.infoValue, !value && styles.infoValueEmpty]} numberOfLines={2}>
            {value || 'Not set'}
          </Text>
        </View>
      </View>
      {editable && (
        <View style={styles.infoEditIcon}>
          <Feather name="edit-2" size={16} color={COLORS.text.light} />
        </View>
      )}
    </TouchableOpacity>
  );

  // ============================================================
  // MENU ITEM COMPONENT
  // ============================================================
  const MenuItem = ({ icon, label, onPress, badge }) => (
    <TouchableOpacity
      style={styles.menuItem}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.menuIconContainer, { backgroundColor: COLORS.primarySurface }]}>
        <Ionicons name={icon} size={22} color={COLORS.primary} />
      </View>
      <Text style={styles.menuLabel}>{label}</Text>
      {badge && (
        <View style={styles.menuBadge}>
          <Text style={styles.menuBadgeText}>{badge}</Text>
        </View>
      )}
      <Ionicons name="chevron-forward" size={20} color={COLORS.text.lighter} />
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <WovenBackground isDark={isDark} />
      <Header title="Profile" subtitle="Account settings" showBack onBackPress={() => navigation.goBack()} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <WovenBackground isDark={isDark} />
      <Header title="Profile" subtitle="Account settings" showBack onBackPress={() => navigation.goBack()} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
      >
        {/* ============================================================
            PROFILE HEADER
        ============================================================ */}
        <View style={styles.profileHeader}>
          <TouchableOpacity
            style={styles.avatarContainer}
            onPress={uploadAvatar}
            disabled={uploadingAvatar}
            activeOpacity={0.8}
          >
            {uploadingAvatar ? (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <ActivityIndicator size="small" color={COLORS.primary} />
              </View>
            ) : profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarText}>
                  {profile?.full_name?.charAt(0)?.toUpperCase() || 'V'}
                </Text>
              </View>
            )}
            {!uploadingAvatar && (
              <View style={styles.avatarCameraBadge}>
                <Ionicons name="camera" size={14} color={COLORS.text.inverse} />
              </View>
            )}
          </TouchableOpacity>
          <Text style={styles.changePhotoHint}>Tap photo to change</Text>
          <Text style={styles.name}>{profile?.full_name || 'Vendor'}</Text>
          <Text style={styles.email}>{user?.email}</Text>
          <View style={styles.roleBadge}>
            <Ionicons name="storefront-outline" size={14} color={COLORS.primary} />
            <Text style={styles.roleText}>Vendor</Text>
          </View>
        </View>

        {/* ============================================================
            STALL INFORMATION - EDITABLE
        ============================================================ */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderLeft}>
              <Ionicons name="storefront-outline" size={20} color={COLORS.primary} />
              <Text style={styles.sectionTitle}>Stall Information</Text>
            </View>
          </View>

          {/* Stall Number - NOT EDITABLE */}
          <InfoRow
            label="Stall Number"
            value={stall?.stall_number}
            icon="pricetag-outline"
            editable={false}
          />

          {/* Stall Name - EDITABLE */}
          <InfoRow
            label="Stall Name"
            value={stallName}
            icon="storefront-outline"
            editable={true}
            onPress={() => openEditModal('stall_name', stallName, 'Stall Name')}
          />

          {/* Section - EDITABLE */}
          <InfoRow
            label="Section"
            value={section}
            icon="grid-outline"
            editable={true}
            onPress={() => openEditModal('section', section, 'Section')}
          />

          {/* Location - EDITABLE, opens the GPS capture flow */}
          <InfoRow
            label="Stall Location"
            value={
              !stallLocation
                ? 'Not set — tap to capture'
                : stallLocation.reregister_reason
                  ? 'Flagged for re-registration'
                  : !stallLocation.verified_by_admin
                    ? `Pending review (~${stallLocation.accuracy_meters != null ? Math.round(stallLocation.accuracy_meters) + 'm' : 'manual'})`
                    : 'Verified'
            }
            icon="location-outline"
            editable={true}
            iconColor={
              !stallLocation
                ? COLORS.primary
                : stallLocation.reregister_reason
                  ? COLORS.error
                  : !stallLocation.verified_by_admin
                    ? COLORS.warning
                    : COLORS.success
            }
            onPress={() => setShowLocationCapture(true)}
          />

          {/* Coordinates - Display Only */}
          {stallLocation && (
            <InfoRow
              label="Coordinates"
              value={`${stallLocation.lat.toFixed(6)}, ${stallLocation.lng.toFixed(6)}`}
              icon="compass-outline"
              editable={false}
            />
          )}

          {/* Directions Note - EDITABLE, the text complement to the GPS pin.
              A covered market blocks GPS lock for most captures, so the
              pin alone often only gets you to the building — this fills
              the "which aisle, which side" gap a coordinate can't. */}
          <InfoRow
            label="Directions Note"
            value={locationNotes || 'Not set — e.g. "3rd aisle, left side, near the fish section"'}
            icon="walk-outline"
            editable={true}
            iconColor={locationNotes ? COLORS.success : COLORS.primary}
            onPress={() => openEditModal('location_notes', locationNotes, 'Directions Note')}
          />

          {/* Description - EDITABLE */}
          <InfoRow
            label="Description"
            value={description}
            icon="document-text-outline"
            editable={true}
            onPress={() => openEditModal('description', description, 'Description')}
          />

          {/* Status - NOT EDITABLE */}
          <View style={styles.infoRow}>
            <View style={styles.infoRowLeft}>
              <View style={[styles.infoIconContainer, { backgroundColor: stall?.is_temporarily_closed ? COLORS.errorLight : COLORS.successLight }]}>
                <Ionicons 
                  name={stall?.is_temporarily_closed ? 'close-circle-outline' : 'checkmark-circle-outline'} 
                  size={20} 
                  color={stall?.is_temporarily_closed ? COLORS.error : COLORS.success} 
                />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Status</Text>
                <Text style={[styles.infoValue, { color: stall?.is_temporarily_closed ? COLORS.error : COLORS.success }]}>
                  {stall?.is_temporarily_closed ? 'Closed' : 'Open'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* ============================================================
            ACCOUNT MENU
        ============================================================ */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderLeft}>
              <Ionicons name="settings-outline" size={20} color={COLORS.primary} />
              <Text style={styles.sectionTitle}>Account</Text>
            </View>
          </View>

          <MenuItem
            icon="star-outline"
            label="Ratings & Reviews"
            onPress={() => navigation.navigate('VendorRatings')}
          />

          <MenuItem
            icon="document-text-outline"
            label="My Reports"
            onPress={() => navigation.navigate('VendorReportsList')}
          />

                    <MenuItem
            icon="flag-outline"
            label="Report an Issue"
            onPress={() => navigation.navigate('VendorReportIssue')}
          />
        </View>

        {/* ============================================================
            SETTINGS (theme / language / security / support / policy)
        ============================================================ */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderLeft}>
              <Ionicons name="options-outline" size={20} color={COLORS.primary} />
              <Text style={styles.sectionTitle}>Settings</Text>
            </View>
          </View>

          <View style={styles.menuItem}>
            <View style={[styles.menuIconContainer, { backgroundColor: COLORS.primarySurface }]}>
              <Ionicons name={isDark ? 'moon-outline' : 'sunny-outline'} size={22} color={COLORS.primary} />
            </View>
            <Text style={styles.menuLabel}>Dark Mode</Text>
            <ThemeToggle />
          </View>
          <MenuItem
            icon="language-outline"
            label={`Language · ${locale === 'en' ? 'English' : 'Filipino'}`}
            onPress={() => setShowLanguagePicker(true)}
          />
          <MenuItem
            icon="keypad-outline"
            label={`PIN Login · ${hasPin ? 'On' : 'Off'}`}
            onPress={openPinModal}
          />
          <MenuItem
            icon="help-circle-outline"
            label="Help & Support"
            onPress={() => navigation.navigate('HelpSupport', { role: 'vendor' })}
          />
          <MenuItem
            icon="lock-closed-outline"
            label="Privacy & Policy"
            onPress={() => navigation.navigate('PrivacyPolicy', { role: 'vendor' })}
          />
        </View>

        {/* ============================================================
            LOGOUT BUTTON
        ============================================================ */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.7}>
          <Ionicons name="log-out-outline" size={20} color={COLORS.text.inverse} />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Edit Modal */}
      {renderEditModal()}

      {/* Stall Location Capture */}
      <StallLocationCapture
        visible={showLocationCapture}
        stallId={stall?.id}
        capturedBy="vendor"
        reason={stallLocation?.reregister_reason || null}
        onClose={() => setShowLocationCapture(false)}
        onSaved={(saved) => setStallLocation(saved)}
      />

      {/* Language Picker Modal */}
      <Modal visible={showLanguagePicker} transparent animationType="slide" onRequestClose={() => setShowLanguagePicker(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Language</Text>
            <TouchableOpacity
              style={styles.optionRow}
              onPress={() => { changeLanguage('en'); setShowLanguagePicker(false); }}
            >
              <Text style={[styles.optionText, locale === 'en' && styles.optionTextActive]}>English</Text>
              {locale === 'en' && <Ionicons name="checkmark" size={18} color={COLORS.success} />}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.optionRow}
              onPress={() => { changeLanguage('fil'); setShowLanguagePicker(false); }}
            >
              <Text style={[styles.optionText, locale === 'fil' && styles.optionTextActive]}>Filipino</Text>
              {locale === 'fil' && <Ionicons name="checkmark" size={18} color={COLORS.success} />}
            </TouchableOpacity>
            <TouchableOpacity style={styles.optionRow} onPress={() => setShowLanguagePicker(false)}>
              <Text style={styles.optionText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* PIN Login Modal */}
      <Modal visible={showPinModal} transparent animationType="slide" onRequestClose={() => setShowPinModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {pinSaved ? (
              <View style={styles.pinSuccessBox}>
                <Ionicons name="checkmark-circle" size={48} color={COLORS.success} />
                <Text style={styles.pinSuccessText}>PIN saved! You can now sign in with your 4-digit PIN.</Text>
              </View>
            ) : (
              <>
                <Text style={styles.modalTitle}>
                  {pinStep === 0 ? 'Verify your account' : pinStep === 1 ? 'Create your PIN' : 'Confirm your PIN'}
                </Text>
                {pinStep === 0 && (
                  <>
                    <TextInput
                      style={styles.pinInput}
                      placeholder="Email or phone"
                      placeholderTextColor={COLORS.text.lighter}
                      value={pinIdentifier}
                      onChangeText={setPinIdentifier}
                      autoCapitalize="none"
                    />
                    <TextInput
                      style={styles.pinInput}
                      placeholder="Current password"
                      placeholderTextColor={COLORS.text.lighter}
                      value={pinPassword}
                      onChangeText={setPinPassword}
                      secureTextEntry
                    />
                  </>
                )}
                {(pinStep === 1 || pinStep === 2) && (
                  <TextInput
                    style={styles.pinInput}
                    placeholder="4-digit PIN"
                    placeholderTextColor={COLORS.text.lighter}
                    value={pinStep === 1 ? newPin : confirmPin}
                    onChangeText={(v) => /^\d{0,4}$/.test(v) && (pinStep === 1 ? setNewPin : setConfirmPin)(v)}
                    keyboardType="number-pad"
                    secureTextEntry
                    maxLength={4}
                  />
                )}
                {!!pinError && <Text style={styles.pinErrorText}>{pinError}</Text>}
                <TouchableOpacity
                  style={[styles.pinPrimaryBtn, pinBusy && { opacity: 0.7 }]}
                  disabled={pinBusy}
                  onPress={pinStep === 0 ? handlePinVerifyCredentials : pinStep === 1 ? handlePinNext : handlePinSave}
                >
                  <Text style={styles.pinPrimaryBtnText}>
                    {pinBusy ? 'Please wait...' : pinStep === 0 ? 'Verify' : pinStep === 1 ? 'Next' : 'Save PIN'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.pinSecondaryBtn} onPress={() => setShowPinModal(false)}>
                  <Text style={styles.pinSecondaryBtnText}>Cancel</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ============================================================
// STYLES
// ============================================================
const createStyles = (COLORS) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  // ── Loading ──
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.text.light,
  },

  // ── Profile Header ──
  profileHeader: {
    alignItems: 'center',
    paddingVertical: SPACING.xxl,
    paddingHorizontal: SPACING.lg,
    backgroundColor: COLORS.surface,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.lg,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },
  avatarContainer: {
    marginBottom: SPACING.md,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: COLORS.primary,
  },
  avatarFallback: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: COLORS.primaryLight,
  },
  avatarText: {
    fontSize: 40,
    fontWeight: 'bold',
    color: COLORS.text.inverse,
  },
  avatarCameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.surface,
  },
  changePhotoHint: {
    fontSize: 12,
    color: COLORS.text.lighter,
    marginTop: -SPACING.sm + 2,
    marginBottom: SPACING.xs,
  },
  name: {
    ...TEXT_STYLES.h1,
    color: COLORS.text.dark,
  },
  email: {
    fontSize: 14,
    color: COLORS.text.light,
    marginTop: 4,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primarySurface,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    marginTop: 8,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  roleText: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '600',
  },

  // ── Section Card ──
  sectionCard: {
    backgroundColor: COLORS.surface,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.lg,
    padding: SPACING.lg,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    ...TEXT_STYLES.h3,
    color: COLORS.text.dark,
  },

  // ── Info Row ──
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  infoRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  infoIconContainer: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.primarySurface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: COLORS.text.light,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text.dark,
  },
  infoValueEmpty: {
    color: COLORS.text.lighter,
    fontStyle: 'italic',
  },
  infoEditIcon: {
    padding: 4,
  },

  // ── Menu Item ──
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  menuIconContainer: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.sm,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  menuLabel: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text.dark,
    fontWeight: '500',
  },
  menuBadge: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
    marginRight: 8,
  },
  menuBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.text.inverse,
  },

  // ── Logout ──
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.error,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.lg,
    paddingVertical: 14,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.error,
  },
  logoutText: {
    color: COLORS.text.inverse,
    fontSize: 15,
    fontWeight: '600',
  },

  // ── Spacer ──
  bottomSpacer: {
    height: 30,
  },

  // ── Modal ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    width: '100%',
    maxWidth: 400,
    shadowColor: COLORS.shadowDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text.dark,
  },
  modalInput: {
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    fontSize: 16,
    color: COLORS.text.dark,
    borderWidth: 1,
    borderColor: COLORS.border,
    minHeight: 50,
    textAlignVertical: 'top',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: SPACING.lg,
  },
  modalButton: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    minWidth: 80,
    alignItems: 'center',
  },
  modalCancelButton: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text.medium,
  },
  modalSaveButton: {
    backgroundColor: COLORS.primary,
  },
  modalSaveText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text.inverse,
  },

  // ── Map Modal ──
  mapModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 0,
  },
  mapModalContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    width: '95%',
    maxWidth: 600,
    maxHeight: '90%',
    overflow: 'hidden',
    shadowColor: COLORS.shadowDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 8,
  },
  mapContainer: {
    padding: SPACING.lg,
  },
  mapHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  mapTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text.dark,
  },
  mapSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.md,
  },
  mapSearchInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text.dark,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  searchResults: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    maxHeight: 150,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  searchResultText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text.dark,
    marginLeft: 8,
  },
  mapWebContainer: {
    height: 300,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.md,
  },
  mapIframe: {
    width: '100%',
    height: '100%',
    borderWidth: 0,
  },
  mapLoadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  mapLoadingText: {
    marginTop: 8,
    fontSize: 14,
    color: COLORS.text.light,
  },
  mapCurrentLocationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.info,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.md,
  },
  mapCurrentLocationText: {
    color: COLORS.text.inverse,
    fontSize: 14,
    fontWeight: '600',
  },
  mapConfirmButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    alignItems: 'center',
  },
  mapConfirmText: {
    color: COLORS.text.inverse,
    fontSize: 16,
    fontWeight: '600',
  },
  // ── Native Map Placeholder ──
  mapNativeContainer: {
    padding: SPACING.lg,
  },
  mapNativePlaceholder: {
    height: 400,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  mapNativeText: {
    fontSize: 16,
    color: COLORS.text.medium,
    marginTop: 12,
  },
  mapNativeSubtext: {
    fontSize: 14,
    color: COLORS.text.light,
    marginTop: 8,
    textAlign: 'center',
  },

  // ── Settings modals (theme / language / PIN) ──
  modalContent: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: SPACING.xl,
    width: '100%',
  },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  optionText: {
    fontSize: 15,
    color: COLORS.text.dark,
  },
  optionTextActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  pinInput: {
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.text.dark,
    backgroundColor: COLORS.background,
    marginBottom: SPACING.sm,
  },
  pinErrorText: {
    color: COLORS.error,
    fontSize: 13,
    marginBottom: SPACING.sm,
  },
  pinPrimaryBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: SPACING.xs,
  },
  pinPrimaryBtnText: {
    color: COLORS.text.inverse,
    fontWeight: '700',
    fontSize: 15,
  },
  pinSecondaryBtn: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  pinSecondaryBtnText: {
    color: COLORS.text.medium,
    fontWeight: '600',
    fontSize: 14,
  },
  pinSuccessBox: {
    alignItems: 'center',
    paddingVertical: SPACING.lg,
    gap: 10,
  },
  pinSuccessText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.success,
    textAlign: 'center',
  },
});