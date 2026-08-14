// src/screens/vendor/VendorProfileScreen.js

import React, { useState, useCallback, useRef, useEffect } from 'react';
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
import { useAuth } from '../../contexts/AuthContext';

// ============================================================
// COLORS - Matches Customer Side Exactly
// ============================================================
const COLORS = {
  primary: '#DC2626',
  primaryLight: '#EF4444',
  primaryDark: '#B91C1C',
  primarySurface: '#FEF2F2',
  background: '#F8F9FA',
  surface: '#FFFFFF',
  text: {
    dark: '#1F2937',
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
  info: '#3B82F6',
  purple: '#7C3AED',
  shadow: 'rgba(0, 0, 0, 0.06)',
  shadowDark: 'rgba(0, 0, 0, 0.10)',
};

const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
};

// ============================================================
// GOOGLE MAPS COMPONENT - Web Version
// ============================================================
const GoogleMapsWeb = ({ latitude, longitude, onLocationSelect, onClose }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState({
    lat: latitude || 13.9407,
    lng: longitude || 121.1408,
  });
  const [mapLoaded, setMapLoaded] = useState(false);

  // Google Maps API Key - You need to add your own key
  const GOOGLE_MAPS_API_KEY = 'YOUR_GOOGLE_MAPS_API_KEY';

  // Search for places
  const searchPlaces = async (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&key=${GOOGLE_MAPS_API_KEY}&types=geocode&components=country:PH`
      );
      const data = await response.json();
      
      if (data.predictions) {
        // Get details for each prediction
        const results = await Promise.all(
          data.predictions.slice(0, 5).map(async (prediction) => {
            const detailsRes = await fetch(
              `https://maps.googleapis.com/maps/api/place/details/json?place_id=${prediction.place_id}&key=${GOOGLE_MAPS_API_KEY}`
            );
            const details = await detailsRes.json();
            const location = details.result?.geometry?.location;
            return {
              id: prediction.place_id,
              description: prediction.description,
              latitude: location?.lat || null,
              longitude: location?.lng || null,
            };
          })
        );
        setSearchResults(results.filter(r => r.latitude !== null));
      }
    } catch (error) {
      console.error('Error searching places:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle location selection from search
  const selectSearchResult = (result) => {
    setSelectedLocation({
      lat: result.latitude,
      lng: result.longitude,
    });
    setSearchQuery(result.description);
    setSearchResults([]);
    onLocationSelect(result.latitude, result.longitude, result.description);
  };

  return (
    <View style={styles.mapContainer}>
      {/* Header */}
      <View style={styles.mapHeader}>
        <Text style={styles.mapTitle}>Set Stall Location</Text>
        <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
          <Ionicons name="close" size={24} color={COLORS.text.dark} />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.mapSearchContainer}>
        <Ionicons name="search-outline" size={20} color={COLORS.text.light} />
        <TextInput
          style={styles.mapSearchInput}
          placeholder="Search for location..."
          placeholderTextColor={COLORS.text.lighter}
          value={searchQuery}
          onChangeText={(text) => {
            setSearchQuery(text);
            searchPlaces(text);
          }}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} activeOpacity={0.7}>
            <Ionicons name="close-circle" size={20} color={COLORS.text.light} />
          </TouchableOpacity>
        )}
      </View>

      {/* Search Results */}
      {searchResults.length > 0 && (
        <View style={styles.searchResults}>
          {searchResults.map((result) => (
            <TouchableOpacity
              key={result.id}
              style={styles.searchResultItem}
              onPress={() => selectSearchResult(result)}
              activeOpacity={0.7}
            >
              <Ionicons name="location-outline" size={20} color={COLORS.primary} />
              <Text style={styles.searchResultText} numberOfLines={1}>
                {result.description}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Map Display - Web */}
      <View style={styles.mapWebContainer}>
        {!mapLoaded && (
          <View style={styles.mapLoadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.mapLoadingText}>Loading map...</Text>
          </View>
        )}
        <iframe
          src={`https://www.google.com/maps/embed/v1/place?key=${GOOGLE_MAPS_API_KEY}&q=${selectedLocation.lat},${selectedLocation.lng}&zoom=16`}
          style={styles.mapIframe}
          onLoad={() => setMapLoaded(true)}
          title="Stall Location"
        />
      </View>

      {/* Current Location Button */}
      <TouchableOpacity
        style={styles.mapCurrentLocationBtn}
        onPress={async () => {
          try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
              Alert.alert('Permission Denied', 'Allow location access to use this feature.');
              return;
            }
            const location = await Location.getCurrentPositionAsync({});
            const { latitude, longitude } = location.coords;
            setSelectedLocation({ lat: latitude, lng: longitude });
            
            // Reverse geocode to get address
            const response = await fetch(
              `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${GOOGLE_MAPS_API_KEY}`
            );
            const data = await response.json();
            const address = data.results[0]?.formatted_address || `${latitude}, ${longitude}`;
            
            onLocationSelect(latitude, longitude, address);
            setSearchQuery(address);
          } catch (error) {
            console.error('Error getting location:', error);
            Alert.alert('Error', 'Could not get your current location.');
          }
        }}
        activeOpacity={0.7}
      >
        <Ionicons name="location" size={20} color="#FFFFFF" />
        <Text style={styles.mapCurrentLocationText}>Use Current Location</Text>
      </TouchableOpacity>

      {/* Confirm Button */}
      <TouchableOpacity
        style={styles.mapConfirmButton}
        onPress={() => {
          if (selectedLocation.lat && selectedLocation.lng) {
            const address = searchQuery || `${selectedLocation.lat}, ${selectedLocation.lng}`;
            onLocationSelect(selectedLocation.lat, selectedLocation.lng, address);
            onClose();
          }
        }}
        activeOpacity={0.7}
      >
        <Text style={styles.mapConfirmText}>Confirm Location</Text>
      </TouchableOpacity>
    </View>
  );
};

// ============================================================
// MAIN COMPONENT
// ============================================================
export default function VendorProfileScreen({ navigation }) {
  const { user, profile } = useAuth();
  const [stall, setStall] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showMapModal, setShowMapModal] = useState(false);
  
  // Editable fields
  const [stallName, setStallName] = useState('');
  const [section, setSection] = useState('');
  const [locationNotes, setLocationNotes] = useState('');
  const [description, setDescription] = useState('');
  const [latitude, setLatitude] = useState(null);
  const [longitude, setLongitude] = useState(null);
  
  // UI states
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingField, setEditingField] = useState(null);

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
        setLatitude(data.latitude || null);
        setLongitude(data.longitude || null);
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

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
          if (Platform.OS === 'web') window.location.href = '/';
          else navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
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
  // UPDATE LOCATION WITH LAT/LNG
  // ============================================================
  const updateLocation = async (lat, lng, address) => {
    if (!stall?.id) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('stalls')
        .update({
          latitude: lat,
          longitude: lng,
          location_notes: address,
        })
        .eq('id', stall.id);
      
      if (error) throw error;
      
      // Update local state
      setLatitude(lat);
      setLongitude(lng);
      setLocationNotes(address);
      setStall(prev => ({ 
        ...prev, 
        latitude: lat, 
        longitude: lng,
        location_notes: address 
      }));
      
      Alert.alert('Success', 'Stall location updated successfully!');
    } catch (error) {
      console.error('Error updating location:', error);
      Alert.alert('Error', 'Failed to update location. Please try again.');
    } finally {
      setSaving(false);
      setShowMapModal(false);
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
                <ActivityIndicator size="small" color="#FFFFFF" />
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
  // RENDER MAP MODAL
  // ============================================================
  const renderMapModal = () => (
    <Modal
      visible={showMapModal}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setShowMapModal(false)}
    >
      <View style={styles.mapModalOverlay}>
        <View style={styles.mapModalContainer}>
          {Platform.OS === 'web' ? (
            <GoogleMapsWeb
              latitude={latitude}
              longitude={longitude}
              onLocationSelect={updateLocation}
              onClose={() => setShowMapModal(false)}
            />
          ) : (
            // Native version - you'll need react-native-maps
            <View style={styles.mapNativeContainer}>
              <View style={styles.mapHeader}>
                <Text style={styles.mapTitle}>Set Stall Location</Text>
                <TouchableOpacity onPress={() => setShowMapModal(false)} activeOpacity={0.7}>
                  <Ionicons name="close" size={24} color={COLORS.text.dark} />
                </TouchableOpacity>
              </View>
              <View style={styles.mapNativePlaceholder}>
                <Ionicons name="map-outline" size={64} color={COLORS.text.lighter} />
                <Text style={styles.mapNativeText}>Map view coming soon for mobile</Text>
                <Text style={styles.mapNativeSubtext}>
                  Latitude: {latitude || 'Not set'}
                  {'\n'}Longitude: {longitude || 'Not set'}
                </Text>
                <TouchableOpacity
                  style={styles.mapConfirmButton}
                  onPress={() => setShowMapModal(false)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.mapConfirmText}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
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
      <Header title="Profile" subtitle="Account settings" showBack onBackPress={() => navigation.goBack()} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
      >
        {/* ============================================================
            PROFILE HEADER
        ============================================================ */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarText}>
                  {profile?.full_name?.charAt(0)?.toUpperCase() || 'V'}
                </Text>
              </View>
            )}
          </View>
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

          {/* Location - EDITABLE with Map */}
          <InfoRow
            label="Location"
            value={locationNotes || `${latitude ? `${latitude}, ${longitude}` : ''}`}
            icon="location-outline"
            editable={true}
            iconColor={locationNotes ? COLORS.success : COLORS.primary}
            onPress={() => setShowMapModal(true)}
          />

          {/* Latitude - Display Only */}
          {latitude && (
            <InfoRow
              label="Coordinates"
              value={`${latitude?.toFixed(6)}, ${longitude?.toFixed(6)}`}
              icon="compass-outline"
              editable={false}
            />
          )}

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
              <View style={[styles.infoIconContainer, { backgroundColor: stall?.is_temporarily_closed ? '#FEE2E2' : '#D1FAE5' }]}>
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
            LOGOUT BUTTON
        ============================================================ */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.7}>
          <Ionicons name="log-out-outline" size={20} color="#FFFFFF" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Edit Modal */}
      {renderEditModal()}
      
      {/* Map Modal */}
      {renderMapModal()}
    </View>
  );
}

// ============================================================
// STYLES
// ============================================================
const styles = StyleSheet.create({
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
    color: '#FFFFFF',
  },
  name: {
    fontSize: 20,
    fontWeight: '700',
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
    fontSize: 16,
    fontWeight: '700',
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
    color: '#FFFFFF',
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
    color: '#FFFFFF',
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
    color: '#FFFFFF',
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
    color: '#FFFFFF',
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
    color: '#FFFFFF',
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
});