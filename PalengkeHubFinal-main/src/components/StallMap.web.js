import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Linking, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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

  const openInGoogleMaps = () => {
    if (!latitude || !longitude) {
      return;
    }
    const url = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
    Linking.openURL(url);
  };

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
    <TouchableOpacity
      style={[styles.container, { height }]}
      onPress={openInGoogleMaps}
      disabled={!interactive}
      activeOpacity={0.7}
    >
      <View style={styles.mapPlaceholder}>
        <Ionicons name="map-outline" size={40} color={COLORS.primary} />
        <Text style={styles.mapTitle}>{stallName || 'Stall Location'}</Text>
        <Text style={styles.mapSubtitle}>
          {stallNumber ? `Stall #${stallNumber}` : ''} {section ? `- ${section}` : ''}
        </Text>
        <View style={styles.mapButton}>
          <Text style={styles.mapButtonText}>Tap to view in Google Maps</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const createStyles = (COLORS) => StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: COLORS.surfaceSecondary,
  },
  mapPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.accentSoft,
    padding: 16,
  },
  mapEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  mapTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text.primary,
    marginBottom: 4,
  },
  mapSubtitle: {
    fontSize: 12,
    color: COLORS.text.secondary,
    marginBottom: 12,
    textAlign: 'center',
  },
  mapButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  mapButtonText: {
    color: COLORS.text.inverse,
    fontSize: 12,
    fontWeight: '500',
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
