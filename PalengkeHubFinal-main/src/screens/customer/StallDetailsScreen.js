// src/screens/customer/StallDetailsScreen.js
import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { chatService } from '../../services/chatService';
import { Header } from '../../components/Header';
import StallMap from '../../components/StallMap';

const { width, height } = Dimensions.get('window');

// ✅ Generate consistent random rating based on stall ID
const getStallRating = (stallId, realRating) => {
  if (realRating && realRating > 0) return realRating;
  
  const seed = String(stallId).split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const randomValue = ((seed * 9301 + 49297) % 233280) / 233280;
  const rating = 2.5 + (randomValue * 2.5);
  return Math.round(rating * 10) / 10;
};

// ✅ Generate random review count
const getRandomRatingCount = (stallId) => {
  const seed = String(stallId).split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const randomValue = ((seed * 9301 + 49297) % 233280) / 233280;
  return Math.floor(5 + (randomValue * 195));
};

// ✅ Star Rating Component
const StarRating = ({ rating, size = 14 }) => {
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
  
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {[...Array(fullStars)].map((_, i) => (
        <Text key={`full-${i}`} style={{ fontSize: size, color: '#F59E0B' }}>★</Text>
      ))}
      {hasHalfStar && (
        <Text style={{ fontSize: size, color: '#F59E0B' }}>½</Text>
      )}
      {[...Array(emptyStars)].map((_, i) => (
        <Text key={`empty-${i}`} style={{ fontSize: size, color: '#D1D5DB' }}>★</Text>
      ))}
    </View>
  );
};

export default function StallDetailsScreen({ navigation, route }) {
  const { stallId } = route.params;
  const { user, isGuest, setIsGuest } = useAuth();
  const [stall, setStall] = useState(null);
  const [vendor, setVendor] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mapModalVisible, setMapModalVisible] = useState(false);
  const [stallImageError, setStallImageError] = useState(false);
  const [vendorAvatarError, setVendorAvatarError] = useState(false);

  // Stall location mapping based on section
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

  const handleReportVendor = () => {
    if (!user) {
      Alert.alert(
        'Login Required',
        'Please login to report a vendor',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Login', 
            onPress: () => {
              if (setIsGuest) setIsGuest(false);
            }
          }
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

  useEffect(() => {
    fetchStallDetails();
  }, [stallId]);

  const fetchStallDetails = async () => {
    try {
      setLoading(true);
      
      const { data: stallData, error: stallError } = await supabase
        .from('stalls')
        .select('*')
        .eq('id', stallId)
        .single();
      
      if (stallError) throw stallError;
      
      // Fetch vendor profile
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
      
      // Check if stall is inactive
      if (stallData && !stallData.is_active) {
        Alert.alert(
          'Stall Unavailable',
          'This stall is currently inactive and not accepting orders.',
          [
            { 
              text: 'Go Back', 
              onPress: () => navigation.goBack()
            }
          ]
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

  // ✅ Get display rating (randomized if no real rating)
  const displayRating = stall ? getStallRating(stall.id, stall.average_rating) : 0;
  const ratingCount = stall ? getRandomRatingCount(stall.id) : 0;

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#DC2626" />
      </View>
    );
  }

  const stallCoords = getStallCoordinates(stall?.section, stall?.stall_number);

  return (
    <SafeAreaView style={styles.container}>
     
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        
        {/* STALL BANNER IMAGE */}
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
              colors={['#DC2626', '#EF4444', '#F87171']}
              style={styles.bannerPlaceholder}
            >
              <Text style={styles.bannerPlaceholderText}>🏪</Text>
            </LinearGradient>
          )}
        </View>

        {/* Stall Info Card */}
        <View style={styles.infoCard}>
          <View style={styles.stallHeader}>
            {/* VENDOR AVATAR */}
            <View style={styles.avatarContainer}>
              {vendor?.avatar_url && !vendorAvatarError ? (
                <Image 
                  source={{ uri: vendor.avatar_url }} 
                  style={styles.vendorAvatar}
                  onError={() => setVendorAvatarError(true)}
                />
              ) : (
                <LinearGradient
                  colors={['#DC2626', '#EF4444']}
                  style={styles.avatarGradient}
                >
                  <Text style={styles.avatarEmoji}>
                    {vendor?.full_name?.charAt(0)?.toUpperCase() || '👤'}
                  </Text>
                </LinearGradient>
              )}
            </View>
            <View style={styles.stallInfo}>
              <Text style={styles.stallName}>{stall?.stall_name || 'Market Stall'}</Text>
              <Text style={styles.stallNumber}>Stall #{stall?.stall_number}</Text>
              <Text style={styles.stallSection}>{stall?.section}</Text>
              {vendor?.full_name && (
                <Text style={styles.vendorName}>👨‍🍳 {vendor.full_name}</Text>
              )}
            </View>
          </View>
          
          {/* ✅ Updated Rating Section with Stars */}
          <View style={styles.ratingContainer}>
            <Text style={styles.ratingTitle}>⭐ Rating</Text>
            <View style={styles.ratingRow}>
              <StarRating rating={displayRating} size={20} />
              <Text style={styles.ratingValue}>{displayRating.toFixed(1)}</Text>
              <Text style={styles.ratingTotal}>/ 5.0</Text>
              <Text style={styles.ratingCount}>({ratingCount} reviews)</Text>
            </View>
          </View>
          
          {/* Temporarily Closed Warning */}
          {stall?.is_temporarily_closed && (
            <View style={styles.closedWarning}>
              <Text style={styles.closedWarningIcon}>⚠️</Text>
              <View style={styles.closedWarningContent}>
                <Text style={styles.closedWarningTitle}>Temporarily Closed</Text>
                <Text style={styles.closedWarningText}>
                  This stall is currently closed. Please check back later.
                </Text>
              </View>
            </View>
          )}
          
          {stall?.description && (
            <View style={styles.descriptionContainer}>
              <Text style={styles.descriptionTitle}>About</Text>
              <Text style={styles.descriptionText}>{stall.description}</Text>
            </View>
          )}
          
          {/* Message Button */}
          {!stall?.is_temporarily_closed && stall?.is_active && (
            <TouchableOpacity style={styles.messageButton} onPress={startChat}>
              <LinearGradient colors={['#DC2626', '#EF4444']} style={styles.messageGradient}>
                <Text style={styles.messageButtonText}>💬 Message Stall</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}

          {/* Report Vendor Button */}
          <TouchableOpacity style={styles.reportVendorButton} onPress={handleReportVendor}>
            <LinearGradient 
              colors={['#FEF2F2', '#FEE2E2']} 
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.reportVendorGradient}
            >
              <Text style={styles.reportIcon}>🏪</Text>
              <Text style={styles.reportButtonText}>Report this Vendor</Text>
            </LinearGradient>
          </TouchableOpacity>
          <Text style={styles.reportNote}>
            Found an issue with this vendor? Let us know so we can investigate.
          </Text>
        </View>

        {/* Map Section */}
        <View style={styles.mapCard}>
          <Text style={styles.sectionTitle}>📍 Location</Text>
          <TouchableOpacity 
            style={styles.mapPreview}
            onPress={showFullMap}
            activeOpacity={0.8}
          >
            <StallMap
              latitude={stallCoords.latitude}
              longitude={stallCoords.longitude}
              stallName={stall?.stall_name}
              stallNumber={stall?.stall_number}
              section={stall?.section}
              height={180}
              interactive={false}
            />
            <View style={styles.mapOverlay}>
              <Text style={styles.mapOverlayText}>Tap to expand map</Text>
            </View>
          </TouchableOpacity>
          
          <View style={styles.locationInfo}>
            <Text style={styles.locationAddress}>
              📍 {stall?.section} - Stall #{stall?.stall_number}
            </Text>
            {stall?.location_notes && (
              <Text style={styles.locationNotes}>📝 {stall.location_notes}</Text>
            )}
          </View>
          
          <TouchableOpacity style={styles.directionsButton} onPress={openMapsDirections}>
            <LinearGradient colors={['#DC2626', '#EF4444']} style={styles.directionsGradient}>
              <Text style={styles.directionsButtonText}>📍 Get Directions</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
        
        {/* Products Section */}
        <View style={styles.productsCard}>
          <Text style={styles.productsTitle}>Products ({products.length})</Text>
          {products.length === 0 ? (
            <Text style={styles.noProductsText}>No products available</Text>
          ) : (
            products.map(product => (
              <TouchableOpacity
                key={product.id}
                style={styles.productItem}
                onPress={() => navigation.navigate('ProductDetails', { productId: product.id })}
              >
                <View style={styles.productInfo}>
                  <Text style={styles.productName}>{product.name}</Text>
                  <Text style={styles.productPrice}>₱{product.price} / {product.unit}</Text>
                </View>
                <Text style={styles.viewArrow}>→</Text>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>

      {/* Full Screen Map Modal */}
      <Modal
        visible={mapModalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setMapModalVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{stall?.stall_name || 'Stall Location'}</Text>
            <Text style={styles.modalSubtitle}>
              Stall #{stall?.stall_number} - {stall?.section}
            </Text>
            <TouchableOpacity 
              style={styles.modalCloseButton}
              onPress={() => setMapModalVisible(false)}
            >
              <Text style={styles.modalCloseText}>✕ Close</Text>
            </TouchableOpacity>
          </View>
          
          <StallMap
            latitude={stallCoords.latitude}
            longitude={stallCoords.longitude}
            stallName={stall?.stall_name}
            stallNumber={stall?.stall_number}
            section={stall?.section}
            height={height - 150}
            interactive={true}
          />
          
          <View style={styles.modalFooter}>
            <TouchableOpacity 
              style={styles.modalDirectionsButton}
              onPress={() => {
                setMapModalVisible(false);
                openMapsDirections();
              }}
            >
              <LinearGradient
                colors={['#DC2626', '#EF4444']}
                style={styles.modalDirectionsGradient}
              >
                <Text style={styles.modalDirectionsText}>📍 Get Directions</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 30,
  },
  // Banner Image Styles
  bannerContainer: {
    width: '100%',
    height: 200,
  },
  bannerImage: {
    width: '100%',
    height: 200,
  },
  bannerPlaceholder: {
    width: '100%',
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bannerPlaceholderText: {
    fontSize: 60,
  },
  // Info Card Styles
  infoCard: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    margin: 16,
    marginTop: -30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  stallHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#FEF3F2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    overflow: 'hidden',
  },
  avatarGradient: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
  },
  vendorAvatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 2,
    borderColor: '#DC2626',
  },
  avatarEmoji: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'white',
  },
  stallInfo: {
    flex: 1,
  },
  stallName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  stallNumber: {
    fontSize: 14,
    color: '#DC2626',
    fontWeight: '500',
    marginBottom: 2,
  },
  stallSection: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 4,
  },
  vendorName: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '500',
  },
  // ✅ Updated Rating Container
  ratingContainer: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 16,
    marginBottom: 16,
  },
  ratingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ratingValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F59E0B',
  },
  ratingTotal: {
    fontSize: 14,
    color: '#6B7280',
  },
  ratingCount: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  closedWarning: {
    flexDirection: 'row',
    backgroundColor: '#FEF3F2',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FEE2E2',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  closedWarningIcon: {
    fontSize: 24,
  },
  closedWarningContent: {
    flex: 1,
  },
  closedWarningTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EF4444',
    marginBottom: 2,
  },
  closedWarningText: {
    fontSize: 12,
    color: '#6B7280',
  },
  descriptionContainer: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 16,
    marginBottom: 16,
  },
  descriptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  descriptionText: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  messageButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 8,
  },
  messageGradient: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  messageButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  reportVendorButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  reportVendorGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  reportIcon: {
    fontSize: 18,
  },
  reportButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#DC2626',
  },
  reportNote: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 8,
    textAlign: 'center',
  },
  // Map Card Styles
  mapCard: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  mapPreview: {
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
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingVertical: 8,
    alignItems: 'center',
  },
  mapOverlayText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
  },
  locationInfo: {
    marginBottom: 12,
  },
  locationAddress: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 4,
  },
  locationNotes: {
    fontSize: 12,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  directionsButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  directionsGradient: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  directionsButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  // Products Card Styles
  productsCard: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    marginHorizontal: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  productsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 16,
  },
  noProductsText: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    paddingVertical: 20,
  },
  productItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 4,
  },
  productPrice: {
    fontSize: 14,
    color: '#DC2626',
    fontWeight: '500',
  },
  viewArrow: {
    fontSize: 18,
    color: '#9CA3AF',
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: '#DC2626',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  modalSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 4,
  },
  modalCloseButton: {
    position: 'absolute',
    top: 50,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  modalCloseText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  modalFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  modalDirectionsButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  modalDirectionsGradient: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalDirectionsText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});