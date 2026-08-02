import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';

// Only import MapView on native platforms
let MapView, Marker, Callout;
if (Platform.OS !== 'web') {
  // Dynamic import for native only
  const Maps = require('react-native-maps');
  MapView = Maps.default;
  Marker = Maps.Marker;
  Callout = Maps.Callout;
}

import * as Location from 'expo-location';

export default function StallMap({ stall }) {
  const [userLocation, setUserLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);

  const marketLocation = {
    latitude: 13.9417,
    longitude: 121.1642,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  };

  const getStallPosition = () => {
    const sections = {
      'Meat Section': { offsetX: 0.0005, offsetY: 0.0003 },
      'Vegetable Section': { offsetX: -0.0003, offsetY: 0.0005 },
      'Fish Section': { offsetX: 0.0004, offsetY: -0.0004 },
      'Fruit Section': { offsetX: -0.0005, offsetY: -0.0002 },
      'Dry Goods': { offsetX: 0.0002, offsetY: 0.0006 },
    };
    const section = stall?.section || 'Meat Section';
    const offset = sections[section] || { offsetX: 0, offsetY: 0 };
    return {
      latitude: marketLocation.latitude + offset.offsetY,
      longitude: marketLocation.longitude + offset.offsetX,
    };
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
      }
    };
    getLocation();
  }, []);

  const openDirections = () => {
    const pos = getStallPosition();
    const url = Platform.select({
      ios: `maps:${pos.latitude},${pos.longitude}?q=Stall ${stall.stall_number}`,
      android: `geo:${pos.latitude},${pos.longitude}?q=Stall ${stall.stall_number}`,
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

  // Web fallback - show map placeholder
  if (Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        <View style={styles.mapPlaceholder}>
          <Text style={styles.mapPlaceholderText}>🗺️</Text>
          <Text style={styles.mapPlaceholderTitle}>Map View</Text>
          <Text style={styles.mapPlaceholderSubtext}>Stall #{stall.stall_number}</Text>
          <Text style={styles.mapPlaceholderSubtext}>Section: {stall.section}</Text>
          <TouchableOpacity style={styles.directionsButton} onPress={openGoogleMaps}>
            <Text style={styles.directionsButtonText}>📍 Get Directions</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#FF6B6B" />
        <Text style={styles.loadingText}>Loading map...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.mapContainer}>
        {!mapReady && (
          <View style={styles.mapPlaceholder}>
            <Text style={styles.mapPlaceholderText}>🗺️</Text>
            <Text style={styles.mapPlaceholderSubtext}>Loading map...</Text>
          </View>
        )}
        <MapView
          style={styles.map}
          initialRegion={marketLocation}
          showsUserLocation={userLocation !== null}
          showsMyLocationButton={true}
          onMapReady={() => setMapReady(true)}
        >
          <Marker coordinate={marketLocation} pinColor="#FF6B6B">
            <Callout>
              <Text style={styles.calloutTitle}>Lipa City Public Market</Text>
            </Callout>
          </Marker>
          <Marker coordinate={stallPosition} pinColor="#4CAF50">
            <Callout>
              <Text style={styles.calloutTitle}>Stall #{stall.stall_number}</Text>
              <Text style={styles.calloutText}>{stall.stall_name || stall.section}</Text>
            </Callout>
          </Marker>
        </MapView>
      </View>

      <View style={styles.directionsContainer}>
        <TouchableOpacity style={styles.directionsButton} onPress={openDirections}>
          <Text style={styles.directionsButtonText}>🗺️ Open in Maps</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.googleMapsButton} onPress={openGoogleMaps}>
          <Text style={styles.googleMapsButtonText}>📍 Get Directions</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.locationInfo}>
        <Text style={styles.locationTitle}>📍 Stall Location</Text>
        <Text style={styles.locationText}>Section: {stall.section}</Text>
        <Text style={styles.locationText}>Stall #{stall.stall_number}</Text>
        <Text style={styles.locationHint}>Tap a button above to get directions</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 15,
    backgroundColor: 'white',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e9ecef',
    marginHorizontal: 15,
  },
  mapContainer: {
    height: 200,
    width: '100%',
    position: 'relative',
  },
  map: {
    height: 200,
    width: '100%',
  },
  mapPlaceholder: {
    height: 200,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  mapPlaceholderText: {
    fontSize: 40,
    marginBottom: 8,
  },
  mapPlaceholderTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  mapPlaceholderSubtext: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    marginHorizontal: 15,
    marginVertical: 15,
  },
  loadingText: {
    marginTop: 8,
    color: '#666',
    fontSize: 12,
  },
  directionsContainer: {
    flexDirection: 'row',
    padding: 12,
    gap: 10,
  },
  directionsButton: {
    flex: 1,
    backgroundColor: '#FF6B6B',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  directionsButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  googleMapsButton: {
    flex: 1,
    backgroundColor: '#4CAF50',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  googleMapsButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  locationInfo: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  locationTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  locationText: {
    fontSize: 13,
    color: '#666',
    marginBottom: 2,
  },
  locationHint: {
    fontSize: 11,
    color: '#999',
    marginTop: 6,
    fontStyle: 'italic',
  },
  calloutTitle: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  calloutText: {
    fontSize: 12,
    color: '#666',
  },
});