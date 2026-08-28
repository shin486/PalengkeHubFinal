import React, { useMemo } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker } from 'react-native-maps';
import { useColors } from '../contexts/ThemeContext';

export default function StallMap({
  latitude,
  longitude,
  stallName,
  stallNumber,
  section,
  height = 200,
  interactive = true
}) {
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);

  //  If no valid coordinates, show placeholder
  if (!latitude || !longitude) {
    return (
      <View style={[styles.placeholderContainer, { height }]}>
        <Ionicons name="location-outline" size={28} color={COLORS.text.quaternary} />
        <Text style={styles.placeholderText}>Location not available</Text>
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

const createStyles = (COLORS) => StyleSheet.create({
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
    backgroundColor: COLORS.accentSoft,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  placeholderText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
    marginBottom: 4,
  },
  placeholderSubtext: {
    fontSize: 12,
    color: COLORS.text.tertiary,
  },
});
