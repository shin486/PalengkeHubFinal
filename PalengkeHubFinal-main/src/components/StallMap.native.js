import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

export default function StallMap({ 
  latitude, 
  longitude, 
  stallName, 
  stallNumber, 
  section, 
  height = 200,
  interactive = true 
}) {
  // ✅ If no valid coordinates, show placeholder
  if (!latitude || !longitude) {
    return (
      <View style={[styles.placeholderContainer, { height }]}>
        <Text style={styles.placeholderText}>📍 Location not available</Text>
        <Text style={styles.placeholderSubtext}>Stall location coming soon</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { height }]}>
      <MapView
        style={styles.map}
        initialRegion={{
          latitude,
          longitude,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        }}
        scrollEnabled={interactive}
        zoomEnabled={interactive}
        pitchEnabled={interactive}
        rotateEnabled={interactive}
      >
        <Marker
          coordinate={{ latitude, longitude }}
          title={stallName || 'Stall'}
          description={stallNumber ? `Stall #${stallNumber} - ${section || ''}` : section || 'Market Stall'}
        />
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  placeholderContainer: {
    width: '100%',
    backgroundColor: '#FEF3F2',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  placeholderText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF6B6B',
    marginBottom: 4,
  },
  placeholderSubtext: {
    fontSize: 12,
    color: '#6B7280',
  },
});