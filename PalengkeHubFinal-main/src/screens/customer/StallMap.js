import { useColors } from '../../contexts/ThemeContext';
// src/components/StallMap.js
import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Platform,
  Alert,
  ActivityIndicator,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';

// Only import MapView on native platforms
let MapView, Marker, Callout;
if (Platform.OS !== 'web') {
  const Maps = require('react-native-maps');
  MapView = Maps.default;
  Marker = Maps.Marker;
  Callout = Maps.Callout;
}

const { width } = Dimensions.get('window');

// ============================================================
// COLORS - PalengkeHub Branding
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
// MAIN COMPONENT
// ============================================================
export default function StallMap({ 
  latitude, 
  longitude, 
  stallName, 
  stallNumber, 
  section, 
  height = 200,
  interactive = true,
}) {
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const [userLocation, setUserLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  const marketLocation = {
    latitude: 13.9417,
    longitude: 121.1642,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  };

  // Fallback position if no props provided
  const getStallPosition = () => {
    if (latitude && longitude) {
      return { latitude, longitude };
    }
    return marketLocation;
  };

  useEffect(() => {
    const getLocation = async () => {
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          let location = await Location.getCurrentPositionAsync({});
          setUserLocation({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          });
        }
      } catch (error) {
        console.error('Location error:', error);
      } finally {
        setLoading(false);
        // Start fade-in animation after loading
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.spring(scaleAnim, {
            toValue: 1,
            tension: 200,
            friction: 20,
            useNativeDriver: true,
          }),
        ]).start();
      }
    };
    getLocation();
  }, []);

  const openDirections = () => {
    const pos = getStallPosition();
    const url = Platform.select({
      ios: `maps:${pos.latitude},${pos.longitude}?q=${stallName || 'Stall'}`,
      android: `geo:${pos.latitude},${pos.longitude}?q=${stallName || 'Stall'}`,
      web: `https://www.google.com/maps/search/?api=1&query=${pos.latitude},${pos.longitude}`,
    });
    Linking.openURL(url).catch(() => Alert.alert('Error', 'Could not open maps'));
  };

  const openGoogleMaps = () => {
    const pos = getStallPosition();
    const url = `https://www.google.com/maps/dir/?api=1&destination=${pos.latitude},${pos.longitude}&travelmode=walking`;
    Linking.openURL(url).catch(() => Alert.alert('Error', 'Could not open Google Maps'));
  };

  const stallPosition = getStallPosition();

  // ============================================================
  // WEB FALLBACK - Redesigned
  // ============================================================
  if (Platform.OS === 'web') {
    return (
      <Animated.View 
        style={[
          styles.webContainer,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          }
        ]}
      >
        <View style={styles.webPlaceholder}>
          <View style={styles.webPlaceholderIcon}>
            <Ionicons name="map-outline" size={48} color="#D1D5DB" />
          </View>
          <Text style={styles.webPlaceholderTitle}>Map Preview</Text>
          <Text style={styles.webPlaceholderSubtext}>
            Interactive maps are available on mobile devices
          </Text>
          <View style={styles.webPlaceholderInfo}>
            <View style={styles.webPlaceholderRow}>
              <Ionicons name="storefront-outline" size={16} color={COLORS.text.light} />
              <Text style={styles.webPlaceholderRowText}>
                {stallName || 'Market Stall'} • Stall #{stallNumber || 'N/A'}
              </Text>
            </View>
            <View style={styles.webPlaceholderRow}>
              <Ionicons name="location-outline" size={16} color={COLORS.text.light} />
              <Text style={styles.webPlaceholderRowText}>
                {section || 'Lipa City Public Market'}
              </Text>
            </View>
          </View>
          <TouchableOpacity 
            style={styles.webDirectionsButton}
            onPress={openGoogleMaps}
            activeOpacity={0.8}
          >
            <Ionicons name="navigate-outline" size={20} color="#FFFFFF" />
            <Text style={styles.webDirectionsButtonText}>Get Directions</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    );
  }

  // ============================================================
  // LOADING STATE - Redesigned
  // ============================================================
  if (loading) {
    return (
      <View style={[styles.loadingContainer, { height }]}>
        <View style={styles.loadingSkeleton} />
        <View style={styles.loadingContent}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading location...</Text>
        </View>
      </View>
    );
  }

  // ============================================================
  // NATIVE MAP - Redesigned
  // ============================================================
  return (
    <Animated.View 
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }],
        }
      ]}
    >
      {/* ==========================================================
          SECTION HEADER
      ========================================================== */}
      <View style={styles.headerContainer}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIcon}>
            <Ionicons name="location-outline" size={18} color={COLORS.primary} />
          </View>
          <View>
            <Text style={styles.headerTitle}>Location</Text>
            <Text style={styles.headerSubtitle}>Lipa City Public Market</Text>
          </View>
        </View>
        {userLocation && (
          <View style={styles.userLocationBadge}>
            <View style={styles.userLocationDot} />
            <Text style={styles.userLocationText}>Nearby</Text>
          </View>
        )}
      </View>

      {/* ==========================================================
          MAP VIEW
      ========================================================== */}
      <View style={[styles.mapContainer, { height }]}>
        {!mapReady && (
          <View style={[styles.mapLoadingOverlay, { height }]}>
            <ActivityIndicator size="small" color={COLORS.primary} />
            <Text style={styles.mapLoadingText}>Loading map...</Text>
          </View>
        )}
        <MapView
          style={[styles.map, { height }]}
          initialRegion={{
            latitude: stallPosition.latitude,
            longitude: stallPosition.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
          showsUserLocation={userLocation !== null}
          showsMyLocationButton={true}
          onMapReady={() => setMapReady(true)}
          zoomEnabled={interactive}
          scrollEnabled={interactive}
        >
          {/* Market Marker */}
          <Marker 
            coordinate={marketLocation} 
            pinColor={COLORS.primary}
          >
            <Callout>
              <View style={styles.calloutContainer}>
                <Text style={styles.calloutTitle}>Lipa City Public Market</Text>
                <Text style={styles.calloutText}>Main Market</Text>
              </View>
            </Callout>
          </Marker>
          
          {/* Stall Marker - Custom Branded Marker */}
          <Marker 
            coordinate={stallPosition}
          >
            <View style={styles.customMarker}>
              <View style={styles.customMarkerInner}>
                <Ionicons name="storefront" size={16} color={COLORS.primary} />
              </View>
              <View style={styles.customMarkerPulse} />
            </View>
            <Callout>
              <View style={styles.calloutContainer}>
                <Text style={styles.calloutTitle}>{stallName || 'Market Stall'}</Text>
                <Text style={styles.calloutText}>Stall #{stallNumber || 'N/A'} • {section || 'No section'}</Text>
              </View>
            </Callout>
          </Marker>
        </MapView>
      </View>

      {/* ==========================================================
          LOCATION INFORMATION - Redesigned
      ========================================================== */}
      <View style={styles.locationInfoContainer}>
        <View style={styles.locationInfoRow}>
          <View style={styles.locationInfoIcon}>
            <Ionicons name="location-outline" size={16} color={COLORS.text.light} />
          </View>
          <Text style={styles.locationInfoLabel}>Section</Text>
          <Text style={styles.locationInfoValue}>{section || 'No section'}</Text>
        </View>
        
        <View style={styles.locationInfoRow}>
          <View style={styles.locationInfoIcon}>
            <Ionicons name="storefront-outline" size={16} color={COLORS.text.light} />
          </View>
          <Text style={styles.locationInfoLabel}>Stall Number</Text>
          <Text style={styles.locationInfoValue}>#{stallNumber || 'N/A'}</Text>
        </View>
        
        <View style={styles.locationInfoRow}>
          <View style={styles.locationInfoIcon}>
            <Ionicons name="business-outline" size={16} color={COLORS.text.light} />
          </View>
          <Text style={styles.locationInfoLabel}>Market</Text>
          <Text style={styles.locationInfoValue}>Lipa City Public Market</Text>
        </View>
      </View>

      {/* ==========================================================
          ACTION BUTTONS - Redesigned
      ========================================================== */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity 
          style={styles.primaryButton}
          onPress={openGoogleMaps}
          activeOpacity={0.8}
        >
          <Ionicons name="navigate-outline" size={18} color="#FFFFFF" />
          <Text style={styles.primaryButtonText}>Get Directions</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.secondaryButton}
          onPress={openDirections}
          activeOpacity={0.7}
        >
          <Ionicons name="map-outline" size={18} color={COLORS.primary} />
          <Text style={styles.secondaryButtonText}>Open in Maps</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

// ============================================================
// STYLES - Red & White Theme
// ============================================================
const createStyles = (COLORS) => StyleSheet.create({
  // ── Main Container ──
  container: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },

  // ── Section Header ──
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  headerIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: COLORS.primarySurface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text.dark,
  },
  headerSubtitle: {
    fontSize: 12,
    color: COLORS.text.light,
  },
  userLocationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: COLORS.primarySurface,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
  },
  userLocationDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.success,
  },
  userLocationText: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.success,
  },

  // ── Map Container ──
  mapContainer: {
    position: 'relative',
    marginHorizontal: SPACING.lg,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  map: {
    width: '100%',
  },
  mapLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.inputBg,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
    gap: SPACING.md,
  },
  mapLoadingText: {
    fontSize: 12,
    color: COLORS.text.light,
  },

  // ── Custom Marker ──
  customMarker: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  customMarkerInner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.surface,
    borderWidth: 2,
    borderColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.shadowDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  customMarkerPulse: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(220,38,38,0.15)',
    top: -6,
    left: -6,
  },

  // ── Callout ──
  calloutContainer: {
    padding: SPACING.sm,
    maxWidth: 180,
  },
  calloutTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text.dark,
  },
  calloutText: {
    fontSize: 12,
    color: COLORS.text.medium,
    marginTop: 2,
  },

  // ── Location Information ──
  locationInfoContainer: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  locationInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  locationInfoIcon: {
    width: 24,
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  locationInfoLabel: {
    fontSize: 13,
    color: COLORS.text.light,
    width: 80,
  },
  locationInfoValue: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text.dark,
    flex: 1,
  },

  // ── Action Buttons ──
  actionsContainer: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.lg,
    gap: SPACING.md,
  },
  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    shadowColor: COLORS.shadowDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 2,
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },

  // ── Web Placeholder ──
  webContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  webPlaceholder: {
    padding: SPACING.xxl,
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  webPlaceholderIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.primarySurface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  webPlaceholderTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text.dark,
    marginBottom: SPACING.xs,
  },
  webPlaceholderSubtext: {
    fontSize: 13,
    color: COLORS.text.medium,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  webPlaceholderInfo: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.sm,
    padding: SPACING.md,
    width: '100%',
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    marginBottom: SPACING.md,
  },
  webPlaceholderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: 2,
  },
  webPlaceholderRowText: {
    fontSize: 13,
    color: COLORS.text.medium,
  },
  webDirectionsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.xxl,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    shadowColor: COLORS.shadowDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 2,
  },
  webDirectionsButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // ── Loading State ──
  loadingContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingSkeleton: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.surfaceSecondary,
  },
  loadingContent: {
    alignItems: 'center',
    gap: SPACING.md,
    zIndex: 1,
  },
  loadingText: {
    fontSize: 13,
    color: COLORS.text.light,
  },
});