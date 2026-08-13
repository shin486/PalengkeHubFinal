import { useColors } from '../../contexts/ThemeContext';
// src/screens/customer/StallDetailsScreen.js
import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  StatusBar,
  Modal,
  Dimensions,
  Linking,
  Platform,
  Image,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useFavorites } from '../../hooks/useFavorites';
import { chatService } from '../../services/chatService';
import StallMap from '../../components/StallMap';

const { width, height } = Dimensions.get('window');

// ============================================================
// COLORS - Clean Red & White Palette
// ============================================================

// ============================================================
// SPACING CONSTANTS
// ============================================================
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
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
};

// ============================================================
// STAR RATING COMPONENT
// ============================================================
const StarRating = ({ rating, size = 14 }) => {
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
  
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {[...Array(fullStars)].map((_, i) => (
        <Ionicons key={`full-${i}`} name="star" size={size} color="#F59E0B" />
      ))}
      {hasHalfStar && (
        <Ionicons name="star-half" size={size} color="#F59E0B" />
      )}
      {[...Array(emptyStars)].map((_, i) => (
        <Ionicons key={`empty-${i}`} name="star-outline" size={size} color="#D1D5DB" />
      ))}
    </View>
  );
};

// ============================================================
// HELPER FUNCTIONS
// ============================================================
const getStallRating = (stallId, realRating) => {
  if (realRating && realRating > 0) return realRating;
  const seed = String(stallId).split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const randomValue = ((seed * 9301 + 49297) % 233280) / 233280;
  const rating = 2.5 + (randomValue * 2.5);
  return Math.round(rating * 10) / 10;
};

const getRandomRatingCount = (stallId) => {
  const seed = String(stallId).split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const randomValue = ((seed * 9301 + 49297) % 233280) / 233280;
  return Math.floor(5 + (randomValue * 195));
};

const getStallCoordinates = (section, stallNumber) => {
  const baseLat = 13.9417;
  const baseLng = 121.1642;
  
  const sectionOffsets = {
    'Meat Section': { lat: 0.0008, lng: -0.0012 },
    'Vegetable Section': { lat: 0.0002, lng: -0.0008 },
    'Fish Section': { lat: -0.0003, lng: 0.0005 },
    'Fruit Section': { lat: 0.0005, lng: 0.0002 },
    'Dry Goods': { lat: -0.0001, lng: -0.0015 },
    'Poultry Section': { lat: 0.0010, lng: -0.0005 },
    'Rice Section': { lat: 0.0003, lng: -0.0003 },
    'Dairy Section': { lat: -0.0002, lng: 0.0008 },
  };
  
  const offset = sectionOffsets[section] || { lat: 0, lng: 0 };
  const stallOffset = (parseInt(stallNumber) || 0) * 0.00002;
  
  return {
    latitude: baseLat + offset.lat + stallOffset,
    longitude: baseLng + offset.lng + stallOffset,
  };
};

// ============================================================
// MAIN COMPONENT
// ============================================================
export default function StallDetailsScreen({ navigation, route }) {
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const { stallId } = route.params;
  const { user, isGuest, setIsGuest } = useAuth();
  const { isStallFavorite, toggleStallFavorite } = useFavorites();
  const [stall, setStall] = useState(null);
  const [vendor, setVendor] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mapModalVisible, setMapModalVisible] = useState(false);
  const [stallImageError, setStallImageError] = useState(false);
  const [vendorAvatarError, setVendorAvatarError] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // ✅ HIDE THE GLOBAL HEADER
  useEffect(() => {
    console.log('📱 StallDetailsScreen mounted - hiding header');
    if (global.setShowHeader) {
      global.setShowHeader(false);
    }
    navigation.setOptions({
      headerShown: false,
    });
    return () => {
      console.log('📱 StallDetailsScreen unmounted - showing header');
      if (global.setShowHeader) {
        global.setShowHeader(true);
      }
    };
  }, []);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, []);

  const fetchStallDetails = async () => {
    try {
      setLoading(true);
      
      const { data: stallData, error: stallError } = await supabase
        .from('stalls')
        .select('*')
        .eq('id', stallId)
        .single();
      
      if (stallError) throw stallError;
      
      if (stallData?.vendor_id) {
        const { data: vendorData, error: vendorError } = await supabase
          .from('profiles')
          .select('id, full_name, email, avatar_url, phone')
          .eq('id', stallData.vendor_id)
          .single();
        
        if (!vendorError) {
          setVendor(vendorData);
        }
      }
      
      if (stallData && !stallData.is_active) {
        Alert.alert(
          'Stall Unavailable',
          'This stall is currently inactive and not accepting orders.',
          [{ text: 'Go Back', onPress: () => navigation.goBack() }]
        );
        setLoading(false);
        return;
      }
      
      setStall(stallData);
      
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('*')
        .eq('stall_id', stallId)
        .eq('is_available', true);
      
      if (productsError) throw productsError;
      setProducts(productsData || []);
      
    } catch (error) {
      console.error('Error fetching stall:', error);
      Alert.alert('Error', 'Failed to load stall details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStallDetails();
  }, [stallId]);

  const startChat = async () => {
    if (!user) {
      Alert.alert(
        'Login Required',
        'Please login to message the stall',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Login', onPress: () => navigation.navigate('Login') }
        ]
      );
      return;
    }
    
    try {
      const conversation = await chatService.getOrCreateConversation(user.id, stall.id);
      navigation.navigate('ChatDetail', {
        conversationId: conversation.id,
        stall: stall,
      });
    } catch (error) {
      console.error('Error starting chat:', error);
      Alert.alert('Error', 'Unable to start conversation');
    }
  };

  const handleReportVendor = () => {
    if (!user) {
      Alert.alert(
        'Login Required',
        'Please login to report a vendor',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Login', onPress: () => { if (setIsGuest) setIsGuest(false); } }
        ]
      );
      return;
    }

    navigation.navigate('ReportIssue', {
      type: 'vendor',
      targetId: stall.id,
      targetName: stall?.stall_name || `Stall #${stall?.stall_number}`,
      targetType: 'vendor'
    });
  };

  const openMapsDirections = () => {
    const coords = getStallCoordinates(stall?.section, stall?.stall_number);
    const url = `https://www.google.com/maps/dir/?api=1&destination=${coords.latitude},${coords.longitude}&travelmode=walking`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Could not open maps');
    });
  };

  const showFullMap = () => {
    setMapModalVisible(true);
  };

  const goToReviews = () => {
    // Navigate to reviews screen - you can implement this later
    Alert.alert('Reviews', 'Navigate to reviews screen');
    // navigation.navigate('Reviews', { stallId: stall.id });
  };

  const displayRating = stall ? getStallRating(stall.id, stall.average_rating) : 0;
  const ratingCount = stall ? getRandomRatingCount(stall.id) : 0;
  const stallCoords = getStallCoordinates(stall?.section, stall?.stall_number);

  // Navigate back
  const goBack = () => {
    navigation.goBack();
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
      
      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ============================================================
            HERO BANNER
        ============================================================ */}
        <View style={styles.bannerContainer}>
          {stall?.image_url && !stallImageError ? (
            <Image 
              source={{ uri: stall.image_url }} 
              style={styles.bannerImage}
              onError={() => setStallImageError(true)}
              resizeMode="cover"
            />
          ) : (
            <LinearGradient
              colors={[COLORS.primary, COLORS.primaryDark]}
              style={styles.bannerPlaceholder}
            >
              <Ionicons name="storefront-outline" size={72} color="rgba(255,255,255,0.2)" />
            </LinearGradient>
          )}
          
          {/* Dark Overlay for readability */}
          <View style={styles.bannerOverlay} />
          
          {/* Back Button */}
          <TouchableOpacity 
            style={styles.backButton}
            onPress={goBack}
            activeOpacity={0.8}
          >
            <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
          </TouchableOpacity>
          
          {/* Favorite Button */}
          <TouchableOpacity 
            style={styles.bannerFavButton}
            onPress={() => toggleStallFavorite(stall)}
            activeOpacity={0.8}
          >
            <Ionicons 
              name={isStallFavorite(stall?.id) ? 'heart' : 'heart-outline'} 
              size={24} 
              color={isStallFavorite(stall?.id) ? '#EF4444' : '#FFFFFF'} 
            />
          </TouchableOpacity>
          
          {/* Banner Content - Bottom */}
          <View style={styles.bannerContent}>
            <Text style={styles.bannerName}>{stall?.stall_name || 'Market Stall'}</Text>
            <Text style={styles.bannerSubtitle}>
              Stall #{stall?.stall_number} • {stall?.section || 'No Section'}
            </Text>
            <View style={styles.bannerChips}>
              <View style={styles.bannerChip}>
                <Ionicons name="star" size={12} color="#F59E0B" />
                <Text style={styles.bannerChipText}>{displayRating.toFixed(1)}</Text>
              </View>
              <View style={[
                styles.bannerChip,
                stall?.is_temporarily_closed ? styles.bannerChipClosed : styles.bannerChipOpen
              ]}>
                <View style={[
                  styles.bannerDot,
                  stall?.is_temporarily_closed ? styles.bannerDotClosed : styles.bannerDotOpen
                ]} />
                <Text style={[
                  styles.bannerChipText,
                  stall?.is_temporarily_closed ? styles.bannerChipTextClosed : styles.bannerChipTextOpen
                ]}>
                  {stall?.is_temporarily_closed ? 'Closed' : 'Open'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* ============================================================
            VENDOR INFO STRIP - with Rating on the Right
        ============================================================ */}
        <View style={styles.infoStrip}>
          <View style={styles.infoStripContent}>
            <View style={styles.infoStripLeft}>
              {vendor?.avatar_url && !vendorAvatarError ? (
                <Image 
                  source={{ uri: vendor.avatar_url }} 
                  style={styles.infoStripAvatar}
                  onError={() => setVendorAvatarError(true)}
                />
              ) : (
                <LinearGradient
                  colors={[COLORS.primary, COLORS.primaryLight]}
                  style={styles.infoStripAvatarGradient}
                >
                  <Ionicons name="person-outline" size={24} color="#FFFFFF" />
                </LinearGradient>
              )}
              <View style={styles.infoStripText}>
                <Text style={styles.infoStripName}>{vendor?.full_name || 'Vendor'}</Text>
                {vendor?.email && (
                  <Text style={styles.infoStripEmail}>{vendor.email}</Text>
                )}
              </View>
            </View>
            
            {/* ✅ Rating on the Right Side - Clickable */}
            <TouchableOpacity 
              style={styles.infoStripRight}
              onPress={goToReviews}
              activeOpacity={0.7}
            >
              <View style={styles.infoStripRatingContainer}>
                <View style={styles.infoStripRating}>
                  <StarRating rating={displayRating} size={14} />
                  <Text style={styles.infoStripRatingText}>{displayRating.toFixed(1)}</Text>
                </View>
                {/* ✅ Underline BELOW the number (3.4) - aligned to the right */}
                <View style={styles.infoStripRatingUnderline} />
                <Text style={styles.infoStripReviewCount}>{ratingCount} reviews</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={COLORS.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ============================================================
            ABOUT SECTION
        ============================================================ */}
        {stall?.description && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIcon}>
                <Ionicons name="document-text-outline" size={20} color={COLORS.primary} />
              </View>
              <Text style={styles.sectionTitle}>About this Stall</Text>
            </View>
            <Text style={styles.descriptionText}>{stall.description}</Text>
          </View>
        )}

        {/* ============================================================
            VENDOR INFORMATION
        ============================================================ */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIcon}>
              <Ionicons name="person-circle-outline" size={20} color={COLORS.primary} />
            </View>
            <Text style={styles.sectionTitle}>Vendor Information</Text>
          </View>
          
          <View style={styles.vendorInfoGrid}>
            <View style={styles.vendorInfoItem}>
              <Text style={styles.vendorInfoLabel}>Vendor Name</Text>
              <Text style={styles.vendorInfoValue}>{vendor?.full_name || 'Not Available'}</Text>
            </View>
            {vendor?.email && (
              <View style={styles.vendorInfoItem}>
                <Text style={styles.vendorInfoLabel}>Email</Text>
                <Text style={styles.vendorInfoValue}>{vendor.email}</Text>
              </View>
            )}
            {vendor?.phone && (
              <View style={styles.vendorInfoItem}>
                <Text style={styles.vendorInfoLabel}>Phone</Text>
                <Text style={styles.vendorInfoValue}>{vendor.phone}</Text>
              </View>
            )}
          </View>
        </View>

        {/* ============================================================
            LOCATION SECTION
        ============================================================ */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIcon}>
              <Ionicons name="location-outline" size={20} color={COLORS.primary} />
            </View>
            <Text style={styles.sectionTitle}>Location</Text>
          </View>
          
          <TouchableOpacity 
            style={styles.mapContainer}
            onPress={showFullMap}
            activeOpacity={0.95}
          >
            <StallMap
              latitude={stallCoords.latitude}
              longitude={stallCoords.longitude}
              stallName={stall?.stall_name}
              stallNumber={stall?.stall_number}
              section={stall?.section}
              height={200}
              interactive={false}
            />
            <View style={styles.mapOverlay}>
              <Ionicons name="expand-outline" size={16} color="#FFFFFF" />
              <Text style={styles.mapOverlayText}>Tap to expand</Text>
            </View>
          </TouchableOpacity>
          
          <View style={styles.locationInfo}>
            <Text style={styles.locationAddress}>
              {stall?.section || 'No section'} • Stall #{stall?.stall_number || 'N/A'}
            </Text>
            {stall?.location_notes && (
              <Text style={styles.locationNotes}>{stall.location_notes}</Text>
            )}
          </View>
          
          <View style={styles.locationActions}>
            <TouchableOpacity 
              style={[styles.locationButton, styles.directionsButton]}
              onPress={openMapsDirections}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={[COLORS.primary, COLORS.primaryLight]}
                style={styles.locationButtonGradient}
              >
                <Ionicons name="navigate-outline" size={18} color="#FFFFFF" />
                <Text style={styles.locationButtonText}>Directions</Text>
              </LinearGradient>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.locationButton, styles.expandButton]}
              onPress={showFullMap}
              activeOpacity={0.8}
            >
              <Ionicons name="map-outline" size={18} color={COLORS.primary} />
              <Text style={styles.expandButtonText}>Expand Map</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ============================================================
            PRODUCTS SECTION
        ============================================================ */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIcon}>
              <Ionicons name="cube-outline" size={20} color={COLORS.primary} />
            </View>
            <Text style={styles.sectionTitle}>Products ({products.length})</Text>
          </View>
          
          {products.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyStateIcon}>
                <Ionicons name="cube-outline" size={40} color="#D1D5DB" />
              </View>
              <Text style={styles.emptyStateTitle}>No Products Available</Text>
              <Text style={styles.emptyStateSubtitle}>
                This vendor has not listed any products yet.
              </Text>
            </View>
          ) : (
            <View style={styles.productsList}>
              {products.map((product, index) => (
                <TouchableOpacity
                  key={product.id}
                  style={[
                    styles.productItem,
                    index === products.length - 1 && styles.productItemLast
                  ]}
                  onPress={() => navigation.navigate('ProductDetails', { productId: product.id })}
                  activeOpacity={0.7}
                >
                  <View style={styles.productLeft}>
                    <View style={styles.productIcon}>
                      <Ionicons name="cube-outline" size={20} color={COLORS.primary} />
                    </View>
                    <View style={styles.productInfo}>
                      <Text style={styles.productName} numberOfLines={1}>{product.name}</Text>
                      <Text style={styles.productMeta}>₱{product.price} / {product.unit}</Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* ============================================================
            ACTION BUTTONS
        ============================================================ */}
        {!stall?.is_temporarily_closed && stall?.is_active && (
          <View style={styles.actionContainer}>
            <TouchableOpacity 
              style={styles.primaryButton}
              onPress={startChat}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={[COLORS.primary, COLORS.primaryLight]}
                style={styles.primaryButtonGradient}
              >
                <Ionicons name="chatbubble-ellipses-outline" size={20} color="#FFFFFF" />
                <Text style={styles.primaryButtonText}>Message Vendor</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.secondaryButton}
              onPress={handleReportVendor}
              activeOpacity={0.7}
            >
              <Ionicons name="flag-outline" size={18} color={COLORS.primary} />
              <Text style={styles.secondaryButtonText}>Report Vendor</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* ============================================================
          FULL SCREEN MAP MODAL - FIXED
      ============================================================ */}
      <Modal
        visible={mapModalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setMapModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          {/* Modal Header - Outside the map */}
          <LinearGradient
            colors={[COLORS.primary, COLORS.primaryDark]}
            style={styles.modalHeader}
          >
            <View style={styles.modalHeaderContent}>
              <TouchableOpacity 
                style={styles.modalCloseButton}
                onPress={() => setMapModalVisible(false)}
                activeOpacity={0.7}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={28} color="#FFFFFF" />
              </TouchableOpacity>
              <View style={styles.modalHeaderText}>
                <Text style={styles.modalTitle} numberOfLines={1}>
                  {stall?.stall_name || 'Stall Location'}
                </Text>
                <Text style={styles.modalSubtitle}>
                  Stall #{stall?.stall_number} • {stall?.section || 'No section'}
                </Text>
              </View>
              <TouchableOpacity 
                style={styles.modalShareButton}
                onPress={() => {
                  // Optional: Add share functionality
                  Alert.alert('Share', 'Share this location');
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="share-outline" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </LinearGradient>
          
          {/* Full Screen Map - with pointerEvents handling */}
          <View style={styles.modalMapWrapper}>
            <StallMap
              latitude={stallCoords.latitude}
              longitude={stallCoords.longitude}
              stallName={stall?.stall_name}
              stallNumber={stall?.stall_number}
              section={stall?.section}
              height={height - 160}
              interactive={true}
            />
          </View>
          
          {/* Modal Footer - Fixed at bottom */}
          <View style={styles.modalFooter}>
            <TouchableOpacity 
              style={styles.modalDirectionsButton}
              onPress={() => {
                setMapModalVisible(false);
                openMapsDirections();
              }}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={[COLORS.primary, COLORS.primaryLight]}
                style={styles.modalDirectionsGradient}
              >
                <Ionicons name="navigate-outline" size={20} color="#FFFFFF" />
                <Text style={styles.modalDirectionsText}>Get Directions</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ============================================================
// STYLES - Clean Red & White
// ============================================================
const createStyles = (COLORS) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },

  // ── Hero Banner ──
  bannerContainer: {
    width: '100%',
    height: 280,
    position: 'relative',
  },
  bannerImage: {
    width: '100%',
    height: 280,
  },
  bannerPlaceholder: {
    width: '100%',
    height: 280,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bannerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },

  // ── Back Button Only ──
  backButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 52 : 28,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },

  // ── Favorite Button ──
  bannerFavButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 52 : 28,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },

  // ── Banner Content ──
  bannerContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingBottom: 20,
    zIndex: 5,
  },
  bannerName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    marginBottom: 2,
  },
  bannerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    marginBottom: 6,
  },
  bannerChips: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bannerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  bannerChipOpen: {
    backgroundColor: 'rgba(16,185,129,0.25)',
  },
  bannerChipClosed: {
    backgroundColor: 'rgba(220,38,38,0.25)',
  },
  bannerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  bannerDotOpen: {
    backgroundColor: COLORS.success,
  },
  bannerDotClosed: {
    backgroundColor: COLORS.error,
  },
  bannerChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  bannerChipTextOpen: {
    color: COLORS.success,
  },
  bannerChipTextClosed: {
    color: COLORS.error,
  },

  // ── Info Strip ──
  infoStrip: {
    backgroundColor: COLORS.surface,
    marginHorizontal: 16,
    marginTop: -16,
    borderRadius: 16,
    padding: 16,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  infoStripContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoStripLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  infoStripAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  infoStripAvatarGradient: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoStripText: {
    flex: 1,
  },
  infoStripName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text.dark,
  },
  infoStripEmail: {
    fontSize: 12,
    color: COLORS.text.medium,
    marginTop: 1,
  },

  // ── Rating on Right Side ──
  infoStripRight: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  infoStripRatingContainer: {
    alignItems: 'flex-end',
  },
  infoStripRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  infoStripRatingText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.warning,
  },
  infoStripRatingUnderline: {
    width: 30,
    height: 2,
    backgroundColor: COLORS.primary,
    borderRadius: 1,
    marginTop: 2,
  },
  infoStripReviewCount: {
    fontSize: 11,
    color: COLORS.text.light,
    marginTop: 2,
  },

  // ── Section Cards ──
  sectionCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  sectionIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: COLORS.primarySurface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text.dark,
  },

  // ── Description ──
  descriptionText: {
    fontSize: 14,
    lineHeight: 22,
    color: COLORS.text.medium,
  },

  // ── Vendor Info ──
  vendorInfoGrid: {
    gap: 12,
  },
  vendorInfoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  vendorInfoLabel: {
    fontSize: 13,
    color: COLORS.text.light,
  },
  vendorInfoValue: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text.dark,
  },

  // ── Location ──
  mapContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 12,
  },
  mapOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 6,
  },
  mapOverlayText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  locationInfo: {
    marginBottom: 12,
  },
  locationAddress: {
    fontSize: 14,
    color: COLORS.text.medium,
  },
  locationNotes: {
    fontSize: 13,
    color: COLORS.text.light,
    fontStyle: 'italic',
    marginTop: 2,
  },
  locationActions: {
    flexDirection: 'row',
    gap: 12,
  },
  locationButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  locationButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  locationButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  expandButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    backgroundColor: 'transparent',
  },
  expandButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.primary,
  },

  // ── Products ──
  productsList: {
    gap: 0,
  },
  productItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  productItemLast: {
    borderBottomWidth: 0,
  },
  productLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  productIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: COLORS.primarySurface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text.dark,
  },
  productMeta: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.primary,
    marginTop: 1,
  },

  // ── Empty State ──
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
  },
  emptyStateIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text.dark,
    marginBottom: 4,
  },
  emptyStateSubtitle: {
    fontSize: 13,
    color: COLORS.text.medium,
    textAlign: 'center',
  },

  // ── Action Buttons ──
  actionContainer: {
    marginHorizontal: 16,
    marginTop: 16,
    gap: 12,
  },
  primaryButton: {
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: COLORS.shadowDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    backgroundColor: 'transparent',
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.primary,
  },

  // ── Modal Styles - Updated ──
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 16,
    paddingHorizontal: 20,
    zIndex: 10,
    position: 'relative',
  },
  modalHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalHeaderText: {
    flex: 1,
    marginHorizontal: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    marginTop: 2,
  },
  modalCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
  },
  modalShareButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
  },
  modalMapWrapper: {
    flex: 1,
    backgroundColor: '#F8F9FB',
  },
  modalFooter: {
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 30 : 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    backgroundColor: COLORS.surface,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  modalDirectionsButton: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: COLORS.shadowDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  modalDirectionsGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  modalDirectionsText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // ── Bottom Spacer ──
  bottomSpacer: {
    height: 20,
  },
});