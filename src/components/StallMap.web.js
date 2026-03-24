import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Alert,
} from 'react-native';

export default function StallMap({ stall }) {
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
      latitude: 13.9417 + offset.offsetY,
      longitude: 121.1642 + offset.offsetX,
    };
  };

  const openGoogleMaps = () => {
    const pos = getStallPosition();
    const url = `https://www.google.com/maps/dir/?api=1&destination=${pos.latitude},${pos.longitude}&travelmode=walking`;
    Linking.openURL(url).catch(() => Alert.alert('Error', 'Could not open Google Maps'));
  };

  return (
    <View style={styles.container}>
      <View style={styles.mapPlaceholder}>
        <Text style={styles.mapPlaceholderText}>🗺️</Text>
        <Text style={styles.mapPlaceholderTitle}>Stall #{stall.stall_number}</Text>
        <Text style={styles.mapPlaceholderSubtext}>Section: {stall.section}</Text>
        <Text style={styles.mapPlaceholderSubtext}>{stall.stall_name || 'Market Stall'}</Text>
        <TouchableOpacity style={styles.directionsButton} onPress={openGoogleMaps}>
          <Text style={styles.directionsButtonText}>📍 Get Directions</Text>
        </TouchableOpacity>
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
  mapPlaceholder: {
    padding: 20,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapPlaceholderText: {
    fontSize: 60,
    marginBottom: 12,
  },
  mapPlaceholderTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  mapPlaceholderSubtext: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  directionsButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 16,
  },
  directionsButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
});